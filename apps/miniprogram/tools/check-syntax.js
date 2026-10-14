#!/usr/bin/env node
/**
 * 小程序交付前静态自检（常驻脚本，勿删）
 * 用法：node tools/check-syntax.js   （在 apps/miniprogram 下执行）
 *
 * 为什么需要它：微信开发者工具的编译期/模板期限制，Node 侧"require 成功"完全覆盖不到。
 * 历史事故（均已复现）：
 *   1. 数组解构 `([k,v]) =>` / `const [a,b] = x` → 编译器生成 require('@babel/runtime/helpers/arrayWithHoles')
 *      → 小程序无该模块 → 页面白屏。已两次踩坑。
 *   2. app.json 分包页面写成裸目录名 "tech" → 解析到 tech.js 空壳 → 空白页。
 *   3. WXML 表达式里写函数调用 / 箭头函数 / 括号 → 模板编译报错。
 *   4. WXSS 规则块外出现裸声明（如全局字符串替换切错位置）→ 样式编译报错。
 *   5. index.js 从 cloud.js 导入了 pullCloudSave，而它其实定义在 storage.js
 *      → 点「云端同步」才抛 pullCloudSave is not a function。
 *   6. 同一文件里还导入了并不存在的 executeGachaDraw（真名 pullGeneral）→ 同类隐患。
 *
 * 覆盖 6 类：JS helper 触发语法 / WXML 表达式 / WXSS 结构与 @import / app.json 路由与文件对应
 *          / 具名导入与目标模块导出一致性 / 未声明即调用（漏 import 或拼错名）
 *
 * 注意：所有代码处理都用「等长空白替换、保留换行」，保证报出的行号与原文件严格一致。
 * 退出码非 0 表示存在必须修的问题。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm', '.git', 'tools', 'assets']);
const problems = [];
const notes = [];

/* ------------------------------------------------------------------ 工具 */

function walk(dir, filter, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, filter, acc);
    else if (filter(name)) acc.push(full);
  }
  return acc;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** 等长空白替换（保留换行）—— 保证处理后索引与原文严格对齐，行号才不会漂 */
const blankOut = (s) => s.replace(/[^\n]/g, ' ');

/** 只去注释、保留字符串（用于解析 require 路径、@import 路径等） */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e === -1 ? src.length : e + 2;
      out += blankOut(src.slice(i, end)); i = end; continue;
    }
    if (c === '/' && n === '/') {
      let e = src.indexOf('\n', i);
      if (e === -1) e = src.length;
      out += blankOut(src.slice(i, e)); i = e; continue;
    }
    out += c; i++;
  }
  return out;
}

/** 去注释与字符串（用于语法扫描，避免把注释/字符串里的示例语法当成真代码） */
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e === -1 ? src.length : e + 2;
      out += blankOut(src.slice(i, end)); i = end; continue;
    }
    if (c === '/' && n === '/') {
      let e = src.indexOf('\n', i);
      if (e === -1) e = src.length;
      out += blankOut(src.slice(i, e)); i = e; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const end = Math.min(j + 1, src.length);
      out += blankOut(src.slice(i, end)); i = end; continue;
    }
    out += c; i++;
  }
  return out;
}

/* ---------------------------------------------------------- 1. JS 语法扫描 */

// 数组解构的 4 种形态。方括号内必须"只有标识符/逗号/空白/剩余运算符"，以排除数组字面量。
const isDestructureInner = (inner) =>
  /^\s*(?:[A-Za-z_$][\w$]*\s*,\s*)*(?:[A-Za-z_$][\w$]*|\.\.\.[A-Za-z_$][\w$]*)\s*$/.test(inner) ||
  /^\s*\.\.\.[A-Za-z_$][\w$]*\s*$/.test(inner);

const JS_RULES = [
  // 注意：以下正则用 [^\[\]] 限制单层方括号，够用且不误吞数组字面量
  ['数组解构赋值', () => /(?:^|[^\w$.#])(?:const|let|var)\s*\[([^\[\]]*)\]\s*=/g],
  ['for…of 数组解构', () => /for\s*\(\s*(?:const|let|var)?\s*\[([^\[\]]*)\]\s+of\b/g],
  ['箭头函数参数数组解构', () => /\(\[([^\[\]]*)\]\)\s*=>/g],
  ['函数参数数组解构', () => /function\s*[\w$]*\s*\([^()]*\[([^\[\]]*)\]/g],
  ['对象解构中的剩余属性（…rest）', () => /(?:const|let|var)\s*\{[^{}]*\.\.\.[^{}]*\}\s*=/g],
];

for (const file of walk(ROOT, (n) => n.endsWith('.js'))) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripCommentsAndStrings(raw);
  for (const [label, make] of JS_RULES) {
    const re = make();
    let m;
    while ((m = re.exec(src)) !== null) {
      const inner = m[1];
      // 「函数参数数组解构」规则里 inner 可能混入其它内容，统一做一次判定
      if (inner !== undefined && !isDestructureInner(inner) && !/\[[^\]]*\]/.test(m[0])) continue;
      if (inner !== undefined && /['"`]/.test(inner)) continue; // 数组字面量
      if (label === '函数参数数组解构' && !isDestructureInner(inner || '')) continue;
      problems.push(
        `[JS] ${rel(file)}:${lineOf(src, m.index)}  ${label} → 会触发 @babel/runtime helper，请改写为下标取值\n        ${raw.split('\n')[lineOf(src, m.index) - 1].trim().slice(0, 100)}`
      );
    }
  }
}

/* --------------------------------------------------------- 2. WXML 表达式 */

// WXML 表达式是 WXS 子集：不支持函数调用、箭头函数、括号
const WXML_BAD = [
  [/{{[^}]*=>/, '箭头函数'],
  [/{{[^}]*\(/, '函数调用或括号'],
  [/{{[^}]*`/, '模板字符串'],
  [/{{[^}]*\bnew\b/, 'new 表达式'],
];

for (const file of walk(ROOT, (n) => n.endsWith('.wxml'))) {
  const raw = fs.readFileSync(file, 'utf8');
  raw.split('\n').forEach((line, i) => {
    for (const [re, what] of WXML_BAD) {
      if (re.test(line)) {
        problems.push(`[WXML] ${rel(file)}:${i + 1}  表达式含${what}（WXML 不支持）\n        ${line.trim().slice(0, 100)}`);
      }
    }
  });
  // wx:elif 必须紧跟 wx:if / wx:elif
  const tags = [...raw.matchAll(/<(view|text|button|image|scroll-view|block)[^>]*?(wx:if|wx:elif)[^>]*>/g)];
  for (let k = 1; k < tags.length; k++) {
    if (/wx:elif/.test(tags[k][0]) && !/wx:(if|elif)/.test(tags[k - 1][0])) {
      problems.push(`[WXML] ${rel(file)}  wx:elif 前一个同级节点不是 wx:if/wx:elif`);
    }
  }
}

/* ----------------------------------------------------------- 3. WXSS 结构 */

for (const file of walk(ROOT, (n) => n.endsWith('.wxss'))) {
  const rawWxss = stripComments(fs.readFileSync(file, 'utf8'));
  const src = stripCommentsAndStrings(fs.readFileSync(file, 'utf8'));
  let depth = 0, buf = '', bufLine = 1, line = 1;
  const flush = (isOpen) => {
    const t = buf.trim();
    if (!t) { buf = ''; return; }
    if (isOpen) { depth++; }
    else if (!/^@/.test(t) && depth === 0) {
      problems.push(`[WXSS] ${rel(file)}:${bufLine}  规则块外的裸声明（会导致编译失败）\n        ${t.slice(0, 100)}`);
    }
    buf = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') line++;
    if (!buf.trim()) bufLine = line;
    if (c === '{') { buf += c; flush(true); continue; }
    if (c === '}') { flush(false); depth--; if (depth < 0) { problems.push(`[WXSS] ${rel(file)}:${line}  多余的 }`); depth = 0; } continue; }
    if (c === ';') { buf += c; flush(false); continue; }
    buf += c;
  }
  if (buf.trim()) flush(false);
  if (depth !== 0) problems.push(`[WXSS] ${rel(file)}  有 ${depth} 个未闭合的 {`);

  // @import 目标必须真实存在（相对当前文件）
  for (const m of rawWxss.matchAll(/@import\s+["']([^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!fs.existsSync(target)) problems.push(`[WXSS] ${rel(file)}  @import 目标不存在：${m[1]} → ${rel(target)}`);
  }
}

/* --------------------------------------------------- 4. 分包路由与文件对应 */

const appJsonPath = path.join(ROOT, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

function checkPageRoute(route, declaredBy) {
  const js = path.join(ROOT, route + '.js');
  const wxml = path.join(ROOT, route + '.wxml');
  if (!fs.existsSync(js)) problems.push(`[路由] ${declaredBy} 声明的页面 ${route} 找不到 ${route}.js`);
  else if (!fs.existsSync(wxml)) notes.push(`[路由] ${route}.wxml 不存在（纯 JS 页面？请确认）`);
  return js;
}

const registered = [];
for (const p of appJson.pages || []) { registered.push(p); checkPageRoute(p, 'app.json/pages'); }
for (const sp of appJson.subPackages || []) {
  for (const p of sp.pages || []) {
    const route = `${sp.root}/${p}`;
    registered.push(route);
    checkPageRoute(route, `app.json/subPackages(${sp.root})`);
  }
}

// 反向检查：SLG 分包里存在 index.js 的目录，是否都在 app.json 注册
const slgRoot = path.join(ROOT, 'pages/games/three-kingdoms-slg');
if (fs.existsSync(slgRoot)) {
  const dirs = fs.readdirSync(slgRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(slgRoot, d.name, 'index.js')))
    .map((d) => d.name);
  for (const d of dirs) {
    if (!registered.includes(`pages/games/three-kingdoms-slg/${d}/index`)) {
      problems.push(`[路由] 目录 ${d}/ 有 index.js，但未在 app.json 分包 pages 中注册 → 点击后无法跳转`);
    }
  }
  // 根目录不该再有 IDE 自动生成的空壳页面文件（同名子目录已经提供了真实页面）
  for (const ent of fs.readdirSync(slgRoot, { withFileTypes: true })) {
    if (!ent.isFile()) continue; // 只看文件，同名目录本身是正常的
    const base = ent.name.replace(/\.(js|json|wxml|wxss)$/, '');
    if (ent.name === 'index.js' || ent.name === 'slg-common.js' || ent.name === 'audio.js') continue;
    if (dirs.includes(base)) {
      problems.push(`[路由] 根目录残留空壳文件 ${ent.name}（与同名子目录 ${base}/ 冲突，应删除）`);
    }
  }
}

/* ------------------------------------------- 5. 具名导入 ↔ 目标模块导出一致性 */

/**
 * 历史事故：index.js 从 cloud.js 里 require 了 pullCloudSave，但该函数其实定义在 storage.js。
 * CommonJS 下缺失的具名导入只会得到 undefined，直到某处调用才抛
 * `xxx is not a function` —— 编译器完全不管，属于典型的"点了某个按钮才炸"。
 * 这里静态解析各模块的导出名，逐一核对具名导入是否存在。
 */

/** 按顶层逗号切分对象字面量内容（忽略嵌套 {} [] () 内的逗号） */
function splitTopLevel(block) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of block) {
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function exportedNames(src) {
  const names = new Set();
  let detectable = false;
  let dynamic = false;

  const scan = (block) => {
    if (/\.\.\./.test(block)) { dynamic = true; return; }
    for (const part of splitTopLevel(block)) {
      const key = part.split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(key)) names.add(key);
    }
  };

  let m;
  const assignRe = /module\.exports\s*=\s*Object\.assign\(\s*(?:module\.exports\s*\|\|\s*)?\{\}\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  while ((m = assignRe.exec(src)) !== null) { scan(m[1]); detectable = true; }
  const plainRe = /module\.exports\s*=\s*\{([\s\S]*?)\}\s*;/g;
  while ((m = plainRe.exec(src)) !== null) { scan(m[1]); detectable = true; }
  const propRe = /(?:^|[^\w$.])exports\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = propRe.exec(src)) !== null) { names.add(m[1]); detectable = true; }

  return { names, detectable, dynamic };
}

const exportCache = new Map();
function getExports(file) {
  if (!exportCache.has(file)) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    exportCache.set(file, exportedNames(src));
  }
  return exportCache.get(file);
}

const IMPORT_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const file of walk(ROOT, (n) => n.endsWith('.js'))) {
  const src = stripComments(fs.readFileSync(file, 'utf8')); // 保留字符串：否则 require 路径被抹掉
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // 第三方包交给运行时/构建 npm
    let target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target) && fs.existsSync(target + '.js')) target += '.js';
    if (!fs.existsSync(target) || !target.endsWith('.js')) continue;
    const info = getExports(target);
    if (!info.detectable || info.dynamic) continue; // 导出无法静态确定，跳过
    const wanted = m[1].split(',').map((s) => s.trim().split(':')[0].split(/\s+as\s+/)[0].trim()).filter(Boolean);
    for (const name of wanted) {
      if (!info.names.has(name)) {
        problems.push(
          `[导入] ${rel(file)}:${lineOf(src, m.index)}  从 ${spec} 导入了「${name}」，但该模块并未导出它\n` +
          `        （CommonJS 下会得到 undefined，直到调用处才抛 "${name} is not a function"）\n` +
          `        该模块实际导出：${[...info.names].sort().join(', ').slice(0, 160)}`
        );
      }
    }
  }
}

/* --------------------------------------- 6. 未声明即调用（疑似漏 import / 拼错名） */

/**
 * 历史事故：handleCloudSync 里裸调 pullCloudSave，但它压根没被声明（导错了模块）。
 * 这类错误编译器不管、只有点到那个按钮才炸。这里做一个保守的"自由变量"检查：
 * 收集文件内所有声明名 + 已知全局，再找形如 `name(` 的调用点，未声明者报出。
 * 为避免误报，把「方法简写定义」name(...) { 也计入声明。
 */

const KNOWN_GLOBALS = new Set([
  'wx', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date',
  'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Symbol', 'Proxy', 'Reflect', 'BigInt', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'require', 'module', 'exports', 'globalThis', 'undefined', 'NaN', 'Infinity',
  'arguments', 'structuredClone', 'queueMicrotask', 'escape', 'unescape', 'Function', 'ArrayBuffer',
  'getApp', 'getCurrentPages', 'Page', 'Component', 'Behavior', 'App', 'window', 'global', 'process',
]);

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'delete', 'void',
  'in', 'of', 'do', 'else', 'await', 'yield', 'case', 'throw', 'instanceof', 'super', 'class', 'try',
  'finally', 'default', 'export', 'import', 'extends', 'async',
]);

function collectDeclared(src) {
  const set = new Set();
  const add = (s) => { if (s) set.add(s); };
  let m;
  const pats = [
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s*\{([^}]*)\}/g,                                  // 对象解构
    /function\s+([A-Za-z_$][\w$]*)/g,
    /class\s+([A-Za-z_$][\w$]*)/g,
    /catch\s*\(\s*([A-Za-z_$][\w$]*)/g,
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const re of pats) {
    while ((m = re.exec(src)) !== null) {
      if (re.source.includes('\\{')) {
        for (const part of m[1].split(',')) add(part.trim().split(':')[0].trim());
      } else add(m[1]);
    }
  }
  // 函数/箭头参数名（近似：取参数列表里的裸标识符）
  const fnRe = /(?:function\s*[\w$]*\s*|\b[\w$]*\s*)?\(([^()]*)\)\s*(?:=>|\{)/g;
  while ((m = fnRe.exec(src)) !== null) {
    for (const tok of m[1].split(',')) {
      const t = tok.trim().split('=')[0].trim();          // 去默认值，如 logFn = log
      if (/^[A-Za-z_$][\w$]*$/.test(t)) { add(t); continue; }
      if (t.startsWith('{') || t.startsWith('[')) {        // 解构参数，如 ({ email, password })
        for (const piece of t.replace(/[{}[\]]/g, '').split(',')) {
          const q = piece.trim().split(':').pop().trim();
          if (/^[A-Za-z_$][\w$]*$/.test(q)) add(q);
        }
      }
    }
  }
  // 方法简写定义： name(...) {
  const methodRe = /(?:^|[,{\n])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm;
  while ((m = methodRe.exec(src)) !== null) add(m[1]);
  return set;
}

for (const file of walk(ROOT, (n) => n.endsWith('.js'))) {
  const src = stripCommentsAndStrings(fs.readFileSync(file, 'utf8'));
  const declared = collectDeclared(src);
  const callRe = /(?:^|[^\w$.\[\]])([A-Za-z_$][\w$]*)\s*\(/g;
  const seen = new Set();
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const name = m[1];
    if (KEYWORDS.has(name) || KNOWN_GLOBALS.has(name) || declared.has(name) || seen.has(name)) continue;
    seen.add(name);
    problems.push(
      `[调用] ${rel(file)}:${lineOf(src, m.index)}  调用了「${name}(...)」，但该文件内既未声明也未导入它\n` +
      `        （运行时将抛 "${name} is not a function"）`
    );
  }
}

/* --------------------------------------- 7. 战斗日志必须净化后再 setData */

// 事故背景（2026-10-14 真机）：simulateBattle 的原始 logs 每条是
// { round, text, type, meta }，meta.actor 是战斗内武将对象，挂着 buffs / myTeam /
// oppTeam 且互为引用成环（logs[i].meta.actor.buffs.myTeam[0].buffs.oppTeam[0] … 回到自身）。
// 把这批 logs 直接 setData，基础库序列化会无限递归，真机抛
//   RangeError: Maximum call stack size exceeded
// 且堆栈全在基础库内部（WASubContext），没有一条业务帧，只能靠猜。
//
// 规则：**setData 载荷内**赋值给 `logs` 的表达式，必须是 viewLogs(...) 或空数组。
// 注意不能一刀切禁止 `logs:` 别处出现——传给 recordBattle 的 opts.logs 必须是原始
// 日志（makeReport 内部会裁剪），把那个也判违规就是误报。
// 本检查只覆盖「明显没包装」的写法；对象内部是否带环由 check-view-data.js 运行时实测。

/**
 * 找出源码中每个 fnName(...) 调用的实参区间 [open, close)，按括号配平。
 * ⚠️ 前缀只排除「标识符字符」，**不能排除点号**——真实调用形如 `this.setData(`，
 * 早期写成 [^\w$.] 会把所有方法调用漏掉，导致整条规则静默失效（已踩过）。
 */
function callArgRanges(src, fnName) {
  const re = new RegExp('(?:^|[^\\w$])' + fnName + '\\s*\\(', 'g');
  const ranges = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
    }
    ranges.push([open, i]);
  }
  return ranges;
}

const LOGS_ASSIGN_RE = /(^|[^\w$.])logs\s*:\s*([^\n]*)/g;
for (const file of walk(ROOT, (n) => n.endsWith('.js'))) {
  // 剥离字符串后括号才是「真括号」；stripCommentsAndStrings 是等长替换，位置不漂移
  const src = stripCommentsAndStrings(fs.readFileSync(file, 'utf8'));
  const setDataRanges = callArgRanges(src, 'setData');
  if (!setDataRanges.length) continue;
  let m;
  LOGS_ASSIGN_RE.lastIndex = 0;
  while ((m = LOGS_ASSIGN_RE.exec(src)) !== null) {
    const at = m.index;
    const inSetData = setDataRanges.some((r) => at >= r[0] && at < r[1]);
    if (!inSetData) continue;
    const expr = m[2].trim();
    if (!expr) continue;                      // 冒号后换行，多行写法，跳过
    if (expr.startsWith('[]')) continue;      // 空数组
    if (expr.includes('viewLogs(')) continue; // 已净化
    problems.push(
      `[视图] ${rel(file)}:${lineOf(src, at)}  setData 里的 logs 未经净化，真机可能栈溢出\n` +
      `        表达式：logs: ${expr}\n` +
      `        修复：logs: viewLogs(<logs变量>, '兜底文案')   ← slg-common.js`
    );
  }
}

/* ---------------------------------------------------------------- 输出 */

if (notes.length) {
  console.log('\n— 提示 —');
  for (const n of notes) console.log('  · ' + n);
}
if (!problems.length) {
  console.log('\n✅ 全部检查通过');
  console.log('   ① JS helper 触发语法  ② WXML 表达式  ③ WXSS 结构与 @import');
  console.log('   ④ app.json 路由与文件对应  ⑤ 具名导入↔导出一致性  ⑥ 未声明即调用');
  console.log('   ⑦ 战斗日志净化（viewLogs）');
  process.exit(0);
}
console.log(`\n🔴 发现 ${problems.length} 个问题：\n`);
problems.forEach((p, i) => console.log(`${i + 1}. ${p}\n`));
process.exit(1);
