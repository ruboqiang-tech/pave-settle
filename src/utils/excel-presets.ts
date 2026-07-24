import type {
  ContractorSummaryRow,
  ProjectSummaryRow,
  ReceivableRow,
  SettlementReportRow,
} from '@/services/analytics.service'
import type { BillOfQuantities, Settlement, SettlementDetailRow } from '@/types'
import { roundAmount } from '@/utils/calculations'
import { projectStatusTextMap } from '@/utils/format'
import { downloadCsvFile, type CsvRow } from '@/utils/csv'
import { exportToExcelWithTitle } from '@/utils/excel'
import type { SaveFileResult } from '@/utils/file-download'

type ExcelCell = string | number | undefined | null
type ExcelRow = ExcelCell[]
type TemplateCell = string | number
type TemplateRow = TemplateCell[]

interface TemplatePreset {
  headers: string[]
  exampleData: TemplateRow[]
}

interface FlatExcelExportPayload {
  fileName: string
  sheetName: string
  data: ExcelRow[]
  colWidths?: number[]
}

const UNIT_SQUARE_METER = '\u33a1'
const LABEL_SETTLEMENT = '\u7ed3\u7b97\u5355'

const BASIC_BOQ_TEMPLATE: TemplatePreset = {
  headers: ['itemName', 'remark', 'unit', 'quantity', 'taxRate', 'noTaxUnitPrice', 'unitPrice', 'note'],
  exampleData: [
    ['\u900f\u5c42\u6cb9', '\u4e3b\u7ebf K0+000-K0+500', UNIT_SQUARE_METER, 100, 9, 1.83, 2, ''],
    ['\u7c98\u5c42\u6cb9', '\u6865\u5934\u642d\u63a5', UNIT_SQUARE_METER, 50, 9, 0.92, 1, ''],
    ['\u6ca5\u9752\u6df7\u51dd\u571f\u4e0b\u9762\u5c42', '\u4fa7\u77f3\u5185\u5bbd', UNIT_SQUARE_METER, 20, 9, 9.17, 10, '']
  ],
}

const FULL_BOQ_TEMPLATE: TemplatePreset = {
  headers: ['itemCode', 'itemName', 'remark', 'unit', 'quantity', 'taxRate', 'noTaxUnitPrice', 'unitPrice', 'note', 'category', 'chapterCode'],
  exampleData: [
    ['BOQ-01', '\u900f\u5c42\u6cb9', '\u4e3b\u7ebf K0+000-K0+500', UNIT_SQUARE_METER, 100, 9, 1.83, 2, '', '\u8def\u9762\u5de5\u7a0b', '300'],
    ['BOQ-02', '\u7c98\u5c42\u6cb9', '\u6865\u5934\u642d\u63a5', UNIT_SQUARE_METER, 50, 9, 0.92, 1, '', '\u8def\u9762\u5de5\u7a0b', '300'],
    ['BOQ-03', '\u6ca5\u9752\u6df7\u51dd\u571f\u4e0b\u9762\u5c42', '\u4fa7\u77f3\u5185\u5bbd', UNIT_SQUARE_METER, 20, 9, 9.17, 10, '', '\u8def\u9762\u5de5\u7a0b', '300']
  ],
}

type ProjectBoqExportItem = Pick<
  BillOfQuantities,
  | 'itemName'
  | 'remark'
  | 'note'
  | 'unit'
  | 'quantity'
  | 'taxRate'
  | 'noTaxUnitPrice'
  | 'unitPrice'
  | 'noTaxTotalPrice'
  | 'taxAmount'
  | 'totalPrice'
>

type SettlementExportSource = Pick<
  Settlement,
  | 'settlementNo'
  | 'settlementType'
  | 'startDate'
  | 'endDate'
  | 'changeAmount'
  | 'materialAdjustment'
  | 'surchargeAmount'
  | 'deductionAmount'
  | 'currentAmount'
  | 'previousCumulative'
  | 'currentCumulative'
>

function getDateSuffix(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function sanitizeFileNamePart(value: string | undefined, fallback: string) {
  const normalized = (value ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-')
  return normalized || fallback
}

async function downloadPreset(fileName: string, _sheetName: string, preset: TemplatePreset): Promise<SaveFileResult> {
  return downloadCsvFile(fileName, [
    preset.headers,
    ...preset.exampleData,
  ])
}

export async function downloadBasicBoqImportTemplate(
  fileName: string = 'project-boq-import-template',
  sheetName: string = 'project-boq'
): Promise<SaveFileResult> {
  return downloadPreset(fileName, sheetName, BASIC_BOQ_TEMPLATE)
}

export async function downloadFullBoqImportTemplate(
  fileName: string = 'boq-import-template',
  sheetName: string = 'boq'
): Promise<SaveFileResult> {
  return downloadPreset(fileName, sheetName, FULL_BOQ_TEMPLATE)
}

export function buildContractorSummaryExportPayload(
  rows: ContractorSummaryRow[],
  date = new Date(),
): FlatExcelExportPayload {
  const data: ExcelRow[] = [
    ['总包单位', '项目数', '合同总额(含税)', '已结算', '已收款', '待收款', '已开票', '开票差额', '结算进度', '收款进度'],
  ]

  for (const row of rows) {
    data.push([
      row.contractorName,
      row.projectCount,
      row.contractAmount,
      row.settledAmount,
      row.receivedAmount,
      row.unreceivedAmount,
      row.invoicedAmount,
      row.invoiceGap,
      `${row.settlementRatio}%`,
      `${row.receiveRatio}%`,
    ])

    for (const project of row.projects) {
      data.push([
        `  - ${project.projectName} (${project.projectCode})`,
        '',
        project.contractAmount,
        project.settledAmount,
        project.receivedAmount,
        project.unreceivedAmount,
        project.invoicedAmount,
        '',
        `${project.settlementRatio}%`,
        `${project.receiveRatio}%`,
      ])
    }
  }

  return {
    fileName: `总包汇总_${getDateSuffix(date)}`,
    sheetName: '总包汇总',
    data,
    colWidths: [32, 10, 16, 14, 14, 14, 14, 14, 12, 12],
  }
}

export function buildProjectSummaryReportExportPayload(rows: ProjectSummaryRow[]): FlatExcelExportPayload {
  return {
    fileName: '项目汇总表',
    sheetName: '项目汇总表',
    data: [
      ['项目编号', '项目名称', '工程类型', '项目状态', '合同不含税价', '合同税额', '合同含税价', '已结算金额', '结算比例', '未结算金额'],
      ...rows.map(row => [
        row.projectCode,
        row.projectName,
        row.projectType === 'highway' ? '公路' : '市政',
        projectStatusTextMap[row.status],
        row.noTaxContractAmount,
        row.contractTaxAmount,
        row.contractAmount,
        row.settledAmount,
        `${row.settlementRatio}%`,
        row.unsettledAmount,
      ]),
    ],
    colWidths: [14, 28, 12, 12, 16, 14, 16, 16, 12, 16],
  }
}

export function buildSettlementDetailReportExportPayload(rows: SettlementReportRow[]): FlatExcelExportPayload {
  return {
    fileName: '结算明细表',
    sheetName: '结算明细表',
    data: [
      ['结算单号', '项目名称', '类型', '结算期间', '清单金额', '调差/签证/措施费', '扣款', '本期结算'],
      ...rows.map(row => [
        row.settlementNo,
        row.projectName,
        row.settlementType === 'final' ? '最终' : '中期',
        `${row.startDate} 至 ${row.endDate}`,
        row.baseAmount,
        row.adjustment,
        row.deductionAmount,
        row.currentAmount,
      ]),
    ],
    colWidths: [24, 28, 10, 24, 14, 18, 12, 14],
  }
}

export function buildReceivableReportExportPayload(rows: ReceivableRow[]): FlatExcelExportPayload {
  return {
    fileName: '应收款统计',
    sheetName: '应收款统计',
    data: [
      ['项目名称', '合同不含税价', '合同税额', '合同含税价', '已结算', '已收款', '待收款', '已开票', '开票差额', '结算进度', '收款进度'],
      ...rows.map(row => [
        row.projectName,
        row.noTaxContractAmount,
        row.contractTaxAmount,
        row.contractAmount,
        row.settledAmount,
        row.receivedAmount,
        row.unreceivedAmount,
        row.invoicedAmount,
        row.invoiceGap,
        `${row.settleRatio}%`,
        `${row.receiveRatio}%`,
      ]),
    ],
    colWidths: [28, 16, 14, 16, 14, 14, 14, 14, 14, 12, 12],
  }
}

export async function exportProjectBoqCsv(args: {
  projectCode?: string
  projectName?: string
  contractNo: string
  contractName: string
  items: ProjectBoqExportItem[]
}): Promise<SaveFileResult> {
  const headers = [
    '\u5e8f\u53f7',
    '\u9879\u76ee\u540d\u79f0',
    '\u7279\u5f81\u63cf\u8ff0',
    '\u5355\u4f4d',
    '\u5de5\u7a0b\u91cf',
    '\u7a0e\u7387',
    '\u4e0d\u542b\u7a0e\u5355\u4ef7(\u5143)',
    '\u542b\u7a0e\u5355\u4ef7(\u5143)',
    '\u4e0d\u542b\u7a0e\u5408\u4ef7(\u5143)',
    '\u7a0e\u989d(\u5143)',
    '\u542b\u7a0e\u5408\u4ef7(\u5143)',
    '\u5907\u6ce8'
  ]

  const rows: CsvRow[] = args.items.map((item, index) => [
    index + 1,
    item.itemName,
    item.remark,
    item.unit,
    Number(item.quantity || 0),
    Number(item.taxRate || 0),
    Number(item.noTaxUnitPrice || 0),
    Number(item.unitPrice || 0),
    Number(item.noTaxTotalPrice || 0),
    Number(item.taxAmount || 0),
    Number(item.totalPrice || 0),
    item.note,
  ])

  const total = roundAmount(args.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0))
  const noTaxTotal = roundAmount(args.items.reduce((sum, item) => sum + Number(item.noTaxTotalPrice || 0), 0))
  const taxTotal = roundAmount(args.items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0))
  rows.push([])
  rows.push(['', '', '', '', '\u5408\u8ba1', '', '', '', noTaxTotal, taxTotal, total, ''])

  const fileName = `${sanitizeFileNamePart(args.projectCode, 'project')}_${sanitizeFileNamePart(args.contractNo, 'contract')}_boq`

  return downloadCsvFile(fileName, [
    headers,
    ...rows,
  ])
}

export async function exportSettlementExcel(args: {
  settlement: SettlementExportSource
  projectName?: string
  contractNames: string[]
  contractAmount: number
  settlementRatio: number
  details: SettlementDetailRow[]
}): Promise<SaveFileResult> {
  const headers = [
    '\u5408\u540c\u540d\u79f0',
    '\u9879\u76ee\u540d\u79f0',
    '\u5907\u6ce8',
    '\u5355\u4f4d',
    '\u5408\u540c\u5de5\u7a0b\u91cf',
    '\u4e0a\u671f\u7d2f\u8ba1\u5b8c\u6210',
    '\u672c\u671f\u5b8c\u6210',
    '\u672c\u671f\u7d2f\u8ba1\u5b8c\u6210',
    '\u7efc\u5408\u5355\u4ef7(\u5143)',
    '\u672c\u671f\u91d1\u989d(\u5143)'
  ]

  const rows: ExcelRow[] = args.details.map(item => [
    item.contractName,
    item.itemName,
    item.remark,
    item.unit,
    Number(item.contractQuantity || 0),
    Number(item.previousCumulative || 0),
    Number(item.currentQuantity || 0),
    Number(item.currentCumulative || 0),
    Number(item.unitPrice || 0),
    Number(item.currentAmount || 0)
  ])

  const baseAmount = roundAmount(args.details.reduce((sum, item) => sum + Number(item.currentAmount || 0), 0))
  rows.push([])
  rows.push(['', '', '', '', '', '', '', '', '\u5de5\u7a0b\u91cf\u6e05\u5355\u5c0f\u8ba1', baseAmount])
  rows.push(['', '', '', '', '', '', '', '', '+ \u53d8\u66f4\u7b7e\u8bc1', Number(args.settlement.changeAmount || 0)])
  rows.push(['', '', '', '', '', '', '', '', '+ \u6750\u6599\u8c03\u5dee', Number(args.settlement.materialAdjustment || 0)])
  rows.push(['', '', '', '', '', '', '', '', '+ \u65bd\u5de5\u63aa\u65bd\u589e\u52a0\u8d39', Number(args.settlement.surchargeAmount || 0)])
  rows.push(['', '', '', '', '', '', '', '', '- \u6263\u6b3e', -Number(args.settlement.deductionAmount || 0)])
  rows.push(['', '', '', '', '', '', '', '', '\u672c\u671f\u7ed3\u7b97\u91d1\u989d', Number(args.settlement.currentAmount || 0)])
  rows.push(['', '', '', '', '', '', '', '', '\u4e0a\u671f\u7d2f\u8ba1\u7ed3\u7b97', Number(args.settlement.previousCumulative || 0)])
  rows.push(['', '', '', '', '', '', '', '', '\u7d2f\u8ba1\u7ed3\u7b97\u91d1\u989d', Number(args.settlement.currentCumulative || 0)])
  rows.push(['', '', '', '', '', '', '', '', '\u5408\u540c\u91d1\u989d\u5408\u8ba1', Number(args.contractAmount || 0)])
  rows.push(['', '', '', '', '', '', '', '', '\u7ed3\u7b97\u6bd4\u4f8b', `${Number(args.settlementRatio || 0)}%`])

  const projectLabel = args.projectName?.trim() || '\u9879\u76ee'
  const settlementTypeLabel = args.settlement.settlementType === 'final' ? '\u6700\u7ec8' : '\u4e2d\u671f'
  const linkedContracts = args.contractNames.filter(Boolean).join('\u3001') || '\u672a\u5173\u8054\u5408\u540c'
  const title = `${projectLabel} - ${settlementTypeLabel}${LABEL_SETTLEMENT}`
  const info =
    `\u7ed3\u7b97\u671f\u95f4\uff1a${args.settlement.startDate} \u81f3 ${args.settlement.endDate}` +
    `    \u7ed3\u7b97\u5355\u53f7\uff1a${args.settlement.settlementNo}` +
    `    \u5173\u8054\u5408\u540c\uff1a${linkedContracts}`

  return exportToExcelWithTitle(
    sanitizeFileNamePart(args.settlement.settlementNo, 'settlement'),
    LABEL_SETTLEMENT,
    [[title], [info], []],
    headers,
    rows,
    [20, 30, 20, 8, 14, 14, 14, 14, 14, 14],
    [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }]
  )
}
