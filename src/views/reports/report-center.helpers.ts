import type {
  ProjectSummaryRow,
  ReceivableRow,
  SettlementReportRow,
} from '@/services/analytics.service'
import { formatCurrency } from '@/utils/calculations'
import { buildTableSummary, createSummaryFormatters, sumByField, type TableSummaryParams } from '@/utils/table-summary'

export type ReportType = 'project_summary' | 'settlement_detail' | 'receivable'

export const reportOptions = [
  { value: 'project_summary', label: '项目汇总表' },
  { value: 'settlement_detail', label: '结算明细表' },
  { value: 'receivable', label: '应收款统计' },
] as const

export function formatSummaryAmount(value: number): string {
  return formatCurrency(value)
}

export function buildReportMeta(
  reportType: ReportType,
  counts: {
    projectCount: number
    settlementCount: number
    totalUnreceived: number
  },
) {
  if (reportType === 'project_summary') {
    return {
      description: '统一查看项目合同参考额、已结算与参考未结算余额，避免项目页、汇总页、报表页各算各的。',
      highlight: `当前共 ${counts.projectCount} 个项目`,
    }
  }

  if (reportType === 'settlement_detail') {
    return {
      description: '按时间维度检查结算单据，重点看本期金额、调整项与状态是否一致。',
      highlight: `当前共 ${counts.settlementCount} 笔结算`,
    }
  }

  return {
    description: '把结算、收款、开票放在同一张表里，便于统一核对待收款和待开票参考。',
    highlight: `当前待收 ${formatSummaryAmount(counts.totalUnreceived)}`,
  }
}

export function buildReportHighlightCards(
  reportType: ReportType,
  data: {
    projectSummary: ProjectSummaryRow[]
    settlementDetails: SettlementReportRow[]
    receivableList: ReceivableRow[]
    receivableSummary: {
      totalSettled: number
      totalReceived: number
      totalUnreceived: number
      totalInvoiced: number
    }
  },
) {
  if (reportType === 'project_summary') {
    const totalContract = sumByField(data.projectSummary, 'contractAmount')
    const totalSettled = sumByField(data.projectSummary, 'settledAmount')
    const totalUnsettled = sumByField(data.projectSummary, 'unsettledAmount')
    return [
      { label: '项目数', value: `${data.projectSummary.length}`, note: '当前筛选范围内的项目数量', dotClass: 'bg-slate-500' },
      { label: '合同总额', value: formatSummaryAmount(totalContract), note: '按项目汇总后的合同含税额', dotClass: 'bg-sky-500' },
      { label: '已结算', value: formatSummaryAmount(totalSettled), note: '仅统计已确认与已审批结算', dotClass: 'bg-emerald-500' },
      { label: '参考未结算', value: formatSummaryAmount(totalUnsettled), note: '按合同参考额减已结算后的参考余额', dotClass: 'bg-amber-500' },
    ]
  }

  if (reportType === 'settlement_detail') {
    const totalBase = sumByField(data.settlementDetails, 'baseAmount')
    const totalAdjustment = sumByField(data.settlementDetails, 'adjustment')
    const totalCurrent = sumByField(data.settlementDetails, 'currentAmount')
    return [
      { label: '结算笔数', value: `${data.settlementDetails.length}`, note: '当前筛选范围内的结算单数量', dotClass: 'bg-slate-500' },
      { label: '清单金额', value: formatSummaryAmount(totalBase), note: '未含调差、签证、扣款前的基数', dotClass: 'bg-sky-500' },
      { label: '调整合计', value: formatSummaryAmount(totalAdjustment), note: '调差 / 签证 / 措施费汇总', dotClass: 'bg-violet-500' },
      { label: '本期结算', value: formatSummaryAmount(totalCurrent), note: '当前表内本期结算金额总和', dotClass: 'bg-emerald-500' },
    ]
  }

  return [
    { label: '已结算', value: formatSummaryAmount(data.receivableSummary.totalSettled), note: '仅统计已确认与已审批结算', dotClass: 'bg-sky-500' },
    { label: '已收款', value: formatSummaryAmount(data.receivableSummary.totalReceived), note: '已登记的收款金额汇总', dotClass: 'bg-emerald-500' },
    { label: '待收款', value: formatSummaryAmount(data.receivableSummary.totalUnreceived), note: '已结算减已收款后的差额', dotClass: 'bg-rose-500' },
    { label: '已开票', value: formatSummaryAmount(data.receivableSummary.totalInvoiced), note: '用于核对开票缺口和回款进度', dotClass: 'bg-amber-500' },
  ]
}

export function buildProjectSummaryTableSummary(param: TableSummaryParams<ProjectSummaryRow>) {
  return buildTableSummary(param, {
    formatters: {
      ...createSummaryFormatters<ProjectSummaryRow>(
        ['noTaxContractAmount', 'contractTaxAmount', 'contractAmount', 'settledAmount', 'unsettledAmount'],
        formatSummaryAmount,
      ),
    },
  })
}

export function buildSettlementTableSummary(param: TableSummaryParams<SettlementReportRow>) {
  return buildTableSummary(param, {
    formatters: {
      ...createSummaryFormatters<SettlementReportRow>(
        ['baseAmount', 'adjustment', 'deductionAmount', 'currentAmount'],
        formatSummaryAmount,
      ),
    },
  })
}

export function buildReceivableTableSummary(param: TableSummaryParams<ReceivableRow>) {
  return buildTableSummary(param, {
    formatters: {
      ...createSummaryFormatters<ReceivableRow>(
        ['noTaxContractAmount', 'contractTaxAmount', 'contractAmount', 'settledAmount', 'receivedAmount', 'unreceivedAmount', 'invoicedAmount', 'invoiceGap'],
        formatSummaryAmount,
      ),
    },
  })
}
