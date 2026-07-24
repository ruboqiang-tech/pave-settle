import type { Component } from 'vue'
import {
  DataLine,
  Document,
  HomeFilled,
  Money,
  OfficeBuilding,
  PieChart,
  Wallet,
} from '@element-plus/icons-vue'

export interface AppPageMeta {
  title: string
  description: string
}

export interface AppMenuItem {
  path: string
  title: string
  icon: Component
}

export const appPageMeta = {
  Dashboard: {
    title: '首页',
    description: '首页只保留项目、合同、结算、收款四条主线。',
  },
  ProjectList: {
    title: '项目管理',
    description: '项目、合同、清单和结算入口统一从项目管理进入。',
  },
  ProjectDetail: {
    title: '项目详情',
    description: '围绕单个项目处理合同、清单、结算与收款。',
  },
  CostManagement: {
    title: '成本管理',
    description: '按单个项目维护前期成本预算与完工成本核算。',
  },
  SettlementList: {
    title: '结算管理',
    description: '按项目和状态查看当前所有结算单。',
  },
  SettlementCreate: {
    title: '新建结算单',
    description: '逐项核对工程量、调整项和累计结算链。',
  },
  SettlementDetail: {
    title: '结算单详情',
    description: '逐项核对工程量、调整项和累计结算链。',
  },
  PaymentList: {
    title: '收款管理',
    description: '统一管理收款记录、发票台账和回款节奏。',
  },
  ReportCenter: {
    title: '报表中心',
    description: '统一查看项目汇总、结算明细和应收款口径。',
  },
  ContractorSummary: {
    title: '总包汇总',
    description: '按总包单位汇总合同、结算、收款和开票口径。',
  },
  DataCenter: {
    title: '数据中心',
    description: '统一查看当前数据库位置、备份数据库，并切换到其他数据库位置。',
  },
} as const satisfies Record<string, AppPageMeta>

export const appMenuItems: AppMenuItem[] = [
  { path: '/', title: appPageMeta.Dashboard.title, icon: HomeFilled },
  { path: '/projects', title: appPageMeta.ProjectList.title, icon: OfficeBuilding },
  { path: '/costs', title: appPageMeta.CostManagement.title, icon: PieChart },
  { path: '/partners', title: appPageMeta.ContractorSummary.title, icon: OfficeBuilding },
  { path: '/settlements', title: appPageMeta.SettlementList.title, icon: Money },
  { path: '/payments', title: appPageMeta.PaymentList.title, icon: Wallet },
  { path: '/reports', title: appPageMeta.ReportCenter.title, icon: Document },
  { path: '/data', title: appPageMeta.DataCenter.title, icon: DataLine },
]
