/**
 * utils/cloud.js — 云服务客户端（带优雅降级）
 *
 * 唯一初始化点：整个 App 共用这一个 cloud 实例，各页面 require 本文件即可复用。
 *
 * ⚠️ 关键前提：小程序使用 npm 包必须先在微信开发者工具执行「工具 → 构建 npm」，
 *    产物生成到 miniprogram_npm/。若未构建，require 该 SDK 会在**模块加载阶段直接抛错**：
 *      module 'miniprogram_npm/@tencent-ai/workbuddy-cloud-sdk/miniprogram.js' is not defined
 *    该错误发生在 require 期间而非调用期间，**会导致引用它的整个页面白屏**。
 *
 *    因此本文件改用「惰性 require + try/catch」包一层：
 *      - 已构建 npm：返回真实云客户端，云端成绩同步正常
 *      - 未构建 npm：cloud = null，页面各云端调用走降级分支
 *    即把「云同步」降级为**增强功能**而非「游戏能玩的必要条件」。
 *
 * 接入说明（构建 npm 后生效）：
 * - endpoint 必填 —— 小程序没有 location.origin，SDK 的同源回退在此不存在。
 * - 必须走 /miniprogram 子路径 —— 小程序无 fetch / localStorage / location 等浏览器运行时。
 * - publishableKey 只标识「哪个应用」，本身不带权限，服务端按精确 Origin 匹配鉴权，
 *   因此可出现在前端代码，但不要写进日志。
 */

/**
 * 应用激活返回的 publicConfig（billingStatus=normal / provisionStatus=assigned）
 */
const PUBLIC_CONFIG = {
  endpoint: 'https://sanguo-slg-53583.app.workbuddy.host',
  publishableKey: 'wbpk_e4AAf18vVSyi8IVkeuxBLN_7wU0QnD8rWRxgK1KcNRPFDBYbrQoBgDy'
}

/**
 * 尝试加载真实云客户端；不可用时返回 null 而不是抛错。
 * @returns {object|null}
 */
function loadCloud() {
  try {
    const mod = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')
    const factory = mod.createMiniProgramWorkBuddyCloud || mod.default

    if (typeof factory !== 'function') {
      console.warn('[cloud] SDK 导出异常（未找到 createMiniProgramWorkBuddyCloud），云同步已禁用')
      return null
    }

    // 诊断 wx 包装器本身也可能是可选依赖，单独兜底
    let wrappedWx = wx
    try {
      const diag = require('./workbuddy-cloud-diagnostics')
      if (diag && typeof diag.createDiagnosticWx === 'function') {
        // 包一层 wx，失败请求会在手机 vConsole 里打印方法/URL/状态码/错误码，
        // 成功与主动取消保持静默。排障时先看这行日志，不要在页面 error 分支重复打印。
        wrappedWx = diag.createDiagnosticWx(wx)
      }
    } catch (e) {
      console.warn('[cloud] 诊断包装器不可用，使用原生 wx', e && e.message)
    }

    return factory({
      endpoint: PUBLIC_CONFIG.endpoint,
      publishableKey: PUBLIC_CONFIG.publishableKey,
      wx: wrappedWx
    })
  } catch (e) {
    // 未构建 npm 时会走到这里，属于预期情况，不影响游戏本体
    console.warn(
      '[cloud] 未检测到已构建的 npm 模块，云端同步已降级为「仅本地纪录」。' +
      '如需启用：微信开发者工具 → 工具 → 构建 npm（并确认「使用 npm 模块」已勾选）。' +
      '原始错误：', e && e.message
    )
    return null
  }
}

const cloud = loadCloud()

/** 云端是否可用，页面据此决定是否展示「云同步」相关 UI */
const isCloudAvailable = !!(cloud && cloud.database)

module.exports = { cloud, PUBLIC_CONFIG, isCloudAvailable }