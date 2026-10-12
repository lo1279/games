/**
 * utils/cloud.js — 云服务客户端
 *
 * 唯一初始化点：整个 App 共用这一个 cloud 实例，
 * 各页面 require 本文件即可复用，不要在别处重复创建客户端。
 *
 * 接入说明：
 * - endpoint 与 publishableKey 来自应用激活时返回的 publicConfig，
 *   endpoint 必填 —— 小程序没有 location.origin，SDK 的同源回退在这里不存在，
 *   省略 endpoint 会导致初始化直接失败。
 * - 小程序没有浏览器运行时（无 fetch / localStorage / location），
 *   必须走 @tencent-ai/workbuddy-cloud-sdk/miniprogram 这个专用子路径，
 *   不能用根入口的 createWorkBuddyCloud，也不能用 CDN <script> 形式。
 * - publishableKey 只标识「哪个应用」，本身不带任何权限，
 *   服务端按精确 Origin 匹配鉴权，因此可以出现在前端代码里，但不要写进日志。
 */

const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics')

/**
 * 应用激活返回的 publicConfig（billingStatus=normal / provisionStatus=assigned）
 */
const PUBLIC_CONFIG = {
  endpoint: 'https://sanguo-slg-53583.app.workbuddy.host',
  publishableKey: 'wbpk_e4AAf18vVSyi8IVkeuxBLN_7wU0QnD8rWRxgK1KcNRPFDBYbrQoBgDy'
}

const cloud = createMiniProgramWorkBuddyCloud({
  endpoint: PUBLIC_CONFIG.endpoint,
  publishableKey: PUBLIC_CONFIG.publishableKey,
  // 包一层 wx，失败请求会在手机 vConsole 里打印方法/URL/状态码/错误码，
  // 成功与主动取消保持静默。排障时先看这行日志，不要在页面的 error 分支重复打印。
  wx: createDiagnosticWx(wx)
})

module.exports = { cloud, PUBLIC_CONFIG }