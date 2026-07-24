import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationGeneric, RouteRecordRaw } from 'vue-router'
import { APP_TITLE } from '@/constants/app'
import { appPageMeta } from './app-shell'
import { isDatabaseConnected } from '@/services/db-core'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: appPageMeta.Dashboard
      },
      {
        path: 'projects',
        name: 'ProjectList',
        component: () => import('@/views/projects/ProjectList.vue'),
        meta: appPageMeta.ProjectList
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/projects/ProjectDetail.vue'),
        meta: appPageMeta.ProjectDetail
      },
      {
        path: 'costs',
        name: 'CostManagement',
        component: () => import('@/views/costs/CostManagement.vue'),
        meta: appPageMeta.CostManagement
      },
      // 旧路由兼容重定向
      { path: 'contracts', redirect: '/projects' },
      { path: 'contracts/create', redirect: '/projects' },
      { path: 'contracts/:id', redirect: '/projects' },
      { path: 'contracts/:id/boq', redirect: '/projects' },
      {
        path: 'projects/:projectId/contracts/create',
        redirect: (to: RouteLocationGeneric) => ({ path: `/projects/${String(to.params.projectId)}` })
      },
      {
        path: 'projects/:projectId/contracts/:contractId',
        redirect: (to: RouteLocationGeneric) => ({ path: `/projects/${String(to.params.projectId)}` })
      },
      {
        path: 'settlements',
        name: 'SettlementList',
        component: () => import('@/views/settlements/SettlementList.vue'),
        meta: appPageMeta.SettlementList
      },
      {
        path: 'settlements/create',
        name: 'SettlementCreate',
        component: () => import('@/views/settlements/SettlementDetail.vue'),
        meta: appPageMeta.SettlementCreate
      },
      {
        path: 'settlements/:id',
        name: 'SettlementDetail',
        component: () => import('@/views/settlements/SettlementDetail.vue'),
        meta: appPageMeta.SettlementDetail
      },
      {
        path: 'payments',
        name: 'PaymentList',
        component: () => import('@/views/payments/PaymentList.vue'),
        meta: appPageMeta.PaymentList
      },
      {
        path: 'reports',
        name: 'ReportCenter',
        component: () => import('@/views/reports/ReportCenter.vue'),
        meta: appPageMeta.ReportCenter
      },
      {
        path: 'partners',
        name: 'ContractorSummary',
        component: () => import('@/views/partners/ContractorSummary.vue'),
        meta: appPageMeta.ContractorSummary
      },
      {
        path: 'data',
        name: 'DataCenter',
        component: () => import('@/views/data/DataCenter.vue'),
        meta: appPageMeta.DataCenter
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  next()
})

router.onError((error, to) => {
  const message = error instanceof Error ? error.message : String(error)
  const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)
  if (!isChunkLoadError) return

  const reloadKey = 'settlement_router_chunk_reload'
  const lastTarget = sessionStorage.getItem(reloadKey)
  if (lastTarget === String(to.fullPath)) return

  sessionStorage.setItem(reloadKey, String(to.fullPath))
  window.location.assign(String(to.fullPath))
})

router.afterEach((to) => {
  sessionStorage.removeItem('settlement_router_chunk_reload')
  const pageTitle = typeof to.meta?.title === 'string' ? to.meta.title : '首页'
  document.title = `${pageTitle} - ${APP_TITLE}`
})

export default router
