import { createApp } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'element-plus/theme-chalk/el-message-box.css'
import 'element-plus/theme-chalk/el-message.css'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import { initDatabase } from './services/db-core'
import { repairLegacySettlementDetailLinks } from './services/settlement-link-repair.service'
import './style.css'

function canonicalizeLocalhostOrigin(): void {
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return
  const { hostname, protocol, port, pathname, search, hash } = window.location
  if (hostname !== '127.0.0.1' && hostname !== '::1') return
  if (protocol !== 'http:' && protocol !== 'https:') return

  const nextUrl = `${protocol}//localhost${port ? `:${port}` : ''}${pathname}${search}${hash}`
  window.location.replace(nextUrl)
}

canonicalizeLocalhostOrigin()
initTheme()
dayjs.locale('zh-cn')

function showStartupFailure() {
  const tip = document.createElement('div')
  tip.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f44336;color:#fff;padding:12px 24px;font-size:14px;text-align:center;'
  tip.textContent = '数据库初始化失败，请打开控制台查看详细错误，然后刷新页面重试。'
  const mountTarget = document.body || document.documentElement
  mountTarget.appendChild(tip)
  setTimeout(() => tip.remove(), 8000)
}

export async function bootstrap() {
  let dbReady = false
  try {
    dbReady = await initDatabase()
  } catch (err) {
    console.error('数据库初始化异常:', err)
  }

  if (dbReady) {
    try {
      const repairResult = await repairLegacySettlementDetailLinks()
      if (repairResult.repairedCount > 0) {
        console.info('[startup-repair] settlement detail links repaired:', repairResult)
      }
    } catch (err) {
      console.error('历史结算明细关联修复失败:', err)
    }
  }

  if (!dbReady) {
    showStartupFailure()
    return
  }

  const app = createApp(App)
  app.use(router)

  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue全局错误]', info, err)
    const tip = document.getElementById('vue-global-error-tip') ?? document.createElement('div')
    tip.id = 'vue-global-error-tip'
    tip.style.cssText =
      'position:fixed;bottom:16px;right:16px;z-index:99998;background:#f44336;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;max-width:360px;'
    tip.textContent = `页面遇到错误：${err instanceof Error ? err.message : String(err)}`
    document.body?.appendChild(tip)
    setTimeout(() => tip.remove(), 8000)
  }

  app.mount('#app')
}

if (import.meta.env.MODE !== 'test') {
  void bootstrap()
}
