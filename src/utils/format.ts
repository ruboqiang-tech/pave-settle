import type { InvoiceType, ProjectStatus, ProjectType, SettlementStatus, SettlementType } from '@/types'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return dateStr.split('T')[0]
}

export function formatQuantity(val: number, decimals: number = 3): string {
  if (val === null || val === undefined || isNaN(val)) {
    return (0).toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  return Number(val).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function formatNum(val: number, decimals: number = 3): string {
  return formatQuantity(val, decimals)
}

export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger' | undefined

export const projectStatusTypeMap: Record<ProjectStatus, TagType> = {
  preparing: 'info',
  in_progress: undefined,
  settling: 'warning',
  completed: 'success'
}

export const projectStatusTextMap: Record<ProjectStatus, string> = {
  preparing: '准备中',
  in_progress: '施工中',
  settling: '结算中',
  completed: '已完工'
}

export const projectStatusOptions: Array<{ label: string; value: ProjectStatus }> = [
  { label: projectStatusTextMap.preparing, value: 'preparing' },
  { label: projectStatusTextMap.in_progress, value: 'in_progress' },
  { label: projectStatusTextMap.settling, value: 'settling' },
  { label: projectStatusTextMap.completed, value: 'completed' },
]

export function getProjectStatusText(status: ProjectStatus): string {
  return projectStatusTextMap[status]
}

export function getProjectStatusType(status: ProjectStatus): TagType {
  return projectStatusTypeMap[status]
}

export const projectTypeTextMap: Record<ProjectType, string> = {
  highway: '公路工程',
  municipal: '市政工程',
}

export const projectTypeOptions: Array<{ label: string; value: ProjectType }> = [
  { label: projectTypeTextMap.highway, value: 'highway' },
  { label: projectTypeTextMap.municipal, value: 'municipal' },
]

export const settlementStatusTypeMap: Record<SettlementStatus, TagType> = {
  draft: 'info',
  confirmed: undefined,
  approved: 'success'
}

export const settlementStatusTextMap: Record<SettlementStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
  approved: '已审批'
}

export const settlementStatusOptions: Array<{ label: string; value: SettlementStatus }> = [
  { label: settlementStatusTextMap.draft, value: 'draft' },
  { label: settlementStatusTextMap.confirmed, value: 'confirmed' },
  { label: settlementStatusTextMap.approved, value: 'approved' },
]

export function getSettlementStatusText(status: SettlementStatus): string {
  return settlementStatusTextMap[status]
}

export function getSettlementStatusType(status: SettlementStatus): TagType {
  return settlementStatusTypeMap[status]
}

export const settlementTypeTextMap: Record<SettlementType, string> = {
  interim: '中期结算',
  final: '最终结算',
}

export const settlementTypeOptions: Array<{ label: string; value: SettlementType }> = [
  { label: settlementTypeTextMap.interim, value: 'interim' },
  { label: settlementTypeTextMap.final, value: 'final' },
]

export const paymentMethodMap = {
  '银行转账': '转账',
  '支票': '支票',
  '现金': '现金',
  '承兑汇票': '汇票',
  '其他': '其他'
} as const

export const paymentMethodOptions = Object.keys(paymentMethodMap).map(method => ({
  label: method,
  value: method,
}))

export function getPaymentMethodLabel(method: string): string {
  return paymentMethodMap[method as keyof typeof paymentMethodMap] || method
}

export const invoiceTypeMap: Record<InvoiceType, string> = {
  special: '增值税专用发票',
  general: '增值税普通发票',
  electronic: '电子发票'
}

export const invoiceTypeOptions: Array<{ label: string; value: InvoiceType }> = [
  { label: invoiceTypeMap.special, value: 'special' },
  { label: invoiceTypeMap.general, value: 'general' },
  { label: invoiceTypeMap.electronic, value: 'electronic' },
]

export function getInvoiceTypeLabel(type: InvoiceType): string {
  return invoiceTypeMap[type]
}

export const taxRateOptions = [
  { label: '13%', value: 13 },
  { label: '9%', value: 9 },
  { label: '6%', value: 6 },
  { label: '3%', value: 3 },
  { label: '1%', value: 1 }
]
