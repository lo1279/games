const fs = require('fs');
const path = require('path');

const files = [
  'data/generals-three.js',
  'data/generals.js',
  'data/tactics.js',
  'data/bonds.js',
  'data/campaigns.js',
  'engine/battle.js',
  'engine/map.js',
  'engine/city.js',
  'engine/cloud.js',
  'engine/gacha.js',
  'engine/power.js',
  'engine/pvp.js',
  'engine/pvpBattle.js',
  'engine/report.js',
  'engine/storage.js'
];

files.forEach(rel => {
  const full = path.join(__dirname, '..', 'apps/miniprogram/pages/games/three-kingdoms-slg', rel);
  let code = fs.readFileSync(full, 'utf8');
  
  // 转换 import { a, b } from './xxx.js'
  code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (m, g1, g2) => {
    return `const { ${g1.trim()} } = require("${g2}");`;
  });
  
  // 转换 import a from './xxx.js'
  code = code.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g, (m, g1, g2) => {
    return `const ${g1} = require("${g2}");`;
  });

  const namedExports = [];

  // 转换 export const / function / let / var / async function
  code = code.replace(/export\s+const\s+(\w+)/g, (m, g1) => {
    namedExports.push(g1);
    return `const ${g1}`;
  });
  code = code.replace(/export\s+function\s+(\w+)/g, (m, g1) => {
    namedExports.push(g1);
    return `function ${g1}`;
  });
  code = code.replace(/export\s+let\s+(\w+)/g, (m, g1) => {
    namedExports.push(g1);
    return `let ${g1}`;
  });
  code = code.replace(/export\s+async\s+function\s+(\w+)/g, (m, g1) => {
    namedExports.push(g1);
    return `async function ${g1}`;
  });
  
  // 转换 export { a, b, c as d }
  code = code.replace(/export\s+\{([^}]+)\};?/g, (m, g1) => {
    g1.split(',').forEach(item => {
      const part = item.trim().split(/\s+as\s+/);
      const expName = part[part.length - 1].trim();
      if (expName) namedExports.push(expName);
    });
    return '';
  });

  // 转换 export default xxx
  code = code.replace(/export\s+default\s+([^;]+);?/g, (m, g1) => {
    return `module.exports = ${g1};`;
  });

  if (namedExports.length > 0) {
    const unique = Array.from(new Set(namedExports));
    code += `\nmodule.exports = Object.assign(module.exports || {}, {\n  ${unique.join(',\n  ')}\n});\n`;
  }

  fs.writeFileSync(full, code, 'utf8');
  console.log('✅ Converted to CJS:', rel);
});
