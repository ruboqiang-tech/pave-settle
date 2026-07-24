import type { BillOfQuantities } from '@/types'
import { roundAmount, sumRounded } from '@/utils/calculations'
import { calcFromNoTaxAmount, calcFromTotalAmount } from '@/utils/tax'

type BoqRow = Partial<BillOfQuantities>
type ImportSourceRow = Record<string, unknown>

export interface BoqImportHeader {
  field: string
  required: boolean
  desc: string
}

const DEFAULT_UNIT = '\u33a1'

const FIELD_ALIASES = {
  itemCode: ['itemCode', '\u9879\u76ee\u7f16\u7801', '\u7f16\u7801'],
  itemName: ['itemName', '\u9879\u76ee\u540d\u79f0', '\u540d\u79f0'],
  remark: ['remark', '\u7279\u5f81\u63cf\u8ff0'],
  note: ['note', '\u5907\u6ce8'],
  unit: ['unit', '\u5355\u4f4d'],
  quantity: ['quantity', '\u5de5\u7a0b\u91cf'],
  taxRate: ['taxRate', '\u7a0e\u7387', '\u7a0e\u7387%'],
  noTaxUnitPrice: ['noTaxUnitPrice', '\u4e0d\u542b\u7a0e\u5355\u4ef7', '\u4e0d\u542b\u7a0e\u5355\u4ef7(\u5143)'],
  unitPrice: ['unitPrice', '\u542b\u7a0e\u5355\u4ef7', '\u542b\u7a0e\u5355\u4ef7(\u5143)', '\u7efc\u5408\u5355\u4ef7', '\u7efc\u5408\u5355\u4ef7(\u5143)', '\u5355\u4ef7'],
  category: ['category', '\u7c7b\u522b'],
  chapterCode: ['chapterCode', '\u7ae0\u53f7'],
}

export const BASIC_BOQ_IMPORT_HEADERS: BoqImportHeader[] = [
  { field: 'itemName', required: true, desc: '\u9879\u76ee\u540d\u79f0\uff08\u5982 AC-13C \u6ca5\u9752\u6df7\u51dd\u571f\u4e0a\u9762\u5c42\uff09' },
  { field: 'remark', required: false, desc: '\u7279\u5f81\u63cf\u8ff0' },
  { field: 'unit', required: true, desc: '\u8ba1\u91cf\u5355\u4f4d\uff08\u33a1\u3001m\u00b3\u3001t\u3001kg\uff09' },
  { field: 'quantity', required: true, desc: '\u5de5\u7a0b\u91cf' },
  { field: 'taxRate', required: false, desc: '\u7a0e\u7387\uff0c\u9ed8\u8ba4 9' },
  { field: 'noTaxUnitPrice', required: false, desc: '\u4e0d\u542b\u7a0e\u5355\u4ef7\uff08\u5143\uff09' },
  { field: 'unitPrice', required: true, desc: '\u542b\u7a0e\u5355\u4ef7\uff08\u5143\uff09' },
  { field: 'note', required: false, desc: '\u5907\u6ce8' },
]

export const FULL_BOQ_IMPORT_HEADERS: BoqImportHeader[] = [
  { field: 'itemCode', required: false, desc: '\u9879\u76ee\u7f16\u7801\uff08\u5982 300-1\u3001040203003\uff09' },
  { field: 'itemName', required: true, desc: '\u9879\u76ee\u540d\u79f0\uff08\u5982 AC-13C \u6ca5\u9752\u6df7\u51dd\u571f\u4e0a\u9762\u5c42\uff09' },
  { field: 'remark', required: false, desc: '\u7279\u5f81\u63cf\u8ff0' },
  { field: 'unit', required: true, desc: '\u8ba1\u91cf\u5355\u4f4d\uff08\u33a1\u3001m\u00b3\u3001t\u3001kg\uff09' },
  { field: 'quantity', required: true, desc: '\u5de5\u7a0b\u91cf' },
  { field: 'taxRate', required: false, desc: '\u7a0e\u7387\uff0c\u9ed8\u8ba4 9' },
  { field: 'noTaxUnitPrice', required: false, desc: '\u4e0d\u542b\u7a0e\u5355\u4ef7\uff08\u5143\uff09' },
  { field: 'unitPrice', required: true, desc: '\u542b\u7a0e\u5355\u4ef7\uff08\u5143\uff09' },
  { field: 'note', required: false, desc: '\u5907\u6ce8' },
  { field: 'category', required: false, desc: '\u5206\u90e8\u5206\u9879\u7c7b\u522b' },
  { field: 'chapterCode', required: false, desc: '\u7ae0\u53f7\uff08\u5982 200\u3001300\u30010402\uff09' },
]

function getFieldValue(source: ImportSourceRow, aliases: string[]) {
  for (const alias of aliases) {
    if (source[alias] !== undefined && source[alias] !== null && source[alias] !== '') {
      return source[alias]
    }
  }
  return undefined
}

function readString(source: ImportSourceRow, aliases: string[], fallback = '') {
  const value = getFieldValue(source, aliases)
  return value === undefined ? fallback : String(value).trim()
}

function readNumber(source: ImportSourceRow, aliases: string[], fallback = 0) {
  const value = getFieldValue(source, aliases)
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function createEmptyBoqRow(contractId: number, sortOrder: number): BoqRow {
  return {
    contractId,
    itemCode: '',
    itemName: '',
    remark: '',
    note: '',
    unit: DEFAULT_UNIT,
    quantity: 0,
    taxRate: 9,
    noTaxUnitPrice: 0,
    unitPrice: 0,
    noTaxTotalPrice: 0,
    taxAmount: 0,
    totalPrice: 0,
    category: '',
    chapterCode: '',
    sortOrder,
  }
}

function applyBoqAmountResult(
  row: BoqRow,
  amount: { noTaxAmount: number; taxAmount: number; totalAmount: number },
) {
  row.noTaxUnitPrice = roundAmount(amount.noTaxAmount)
  row.unitPrice = roundAmount(amount.totalAmount)
  row.noTaxTotalPrice = roundAmount((row.quantity || 0) * amount.noTaxAmount)
  row.totalPrice = roundAmount((row.quantity || 0) * amount.totalAmount)
  row.taxAmount = roundAmount((row.totalPrice || 0) - (row.noTaxTotalPrice || 0))
}

export function recalculateBoqFromNoTaxPrice(row: BoqRow) {
  applyBoqAmountResult(row, calcFromNoTaxAmount(row.noTaxUnitPrice || 0, row.taxRate || 0))
}

export function recalculateBoqFromUnitPrice(row: BoqRow) {
  applyBoqAmountResult(row, calcFromTotalAmount(row.unitPrice || 0, row.taxRate || 0))
}

export function recalculateBoqFromQuantity(row: BoqRow) {
  row.noTaxTotalPrice = roundAmount((row.quantity || 0) * (row.noTaxUnitPrice || 0))
  row.totalPrice = roundAmount((row.quantity || 0) * (row.unitPrice || 0))
  row.taxAmount = roundAmount((row.totalPrice || 0) - (row.noTaxTotalPrice || 0))
}

export function recalculateBoqRow(row: BoqRow) {
  if ((row.noTaxUnitPrice || 0) > 0) {
    recalculateBoqFromNoTaxPrice(row)
    return
  }
  recalculateBoqFromUnitPrice(row)
}

function hasAnyBoqContent(item: BoqRow) {
  const unit = String(item.unit || '').trim()
  return Boolean(
    String(item.itemCode || '').trim()
    || String(item.itemName || '').trim()
    || String(item.remark || '').trim()
    || String(item.note || '').trim()
    || (unit && unit !== DEFAULT_UNIT)
    || Number(item.quantity || 0) !== 0
    || Number(item.noTaxUnitPrice || 0) !== 0
    || Number(item.unitPrice || 0) !== 0
    || String(item.category || '').trim()
    || String(item.chapterCode || '').trim(),
  )
}

export function getFilledBoqItems<T extends BoqRow>(items: T[]) {
  return items.filter(hasAnyBoqContent)
}

export function validateBoqItems(items: BoqRow[]) {
  const invalid = items.find(item => !String(item.itemName || '').trim() || !String(item.unit || '').trim())
  return invalid ? '\u8bf7\u586b\u5199\u6240\u6709\u6e05\u5355\u9879\u7684\u540d\u79f0\u548c\u5355\u4f4d' : null
}

export function prepareBoqItemsForSave(contractId: number, items: BoqRow[]) {
  return items.map((item, index) => ({
    ...item,
    contractId,
    sortOrder: index + 1,
  }))
}

export function summarizeBoqAmounts(items: BoqRow[]) {
  const noTax = sumRounded(items.map(item => Number(item.noTaxTotalPrice || 0)))
  const tax = sumRounded(items.map(item => Number(item.taxAmount || 0)))
  return {
    noTax,
    tax,
    total: roundAmount(noTax + tax),
  }
}

export function parseImportedBoqRows(
  rows: ImportSourceRow[],
  options: { contractId: number; sortStart?: number },
): BoqRow[] {
  const sortStart = options.sortStart || 0

  return rows.map((source, index) => {
    const row = createEmptyBoqRow(options.contractId, sortStart + index + 1)
    row.itemCode = readString(source, FIELD_ALIASES.itemCode)
    row.itemName = readString(source, FIELD_ALIASES.itemName)
    row.remark = readString(source, FIELD_ALIASES.remark)
    row.note = readString(source, FIELD_ALIASES.note)
    row.unit = readString(source, FIELD_ALIASES.unit, DEFAULT_UNIT)
    row.quantity = readNumber(source, FIELD_ALIASES.quantity, 0)
    row.taxRate = readNumber(source, FIELD_ALIASES.taxRate, 9)
    row.category = readString(source, FIELD_ALIASES.category)
    row.chapterCode = readString(source, FIELD_ALIASES.chapterCode)
    row.noTaxUnitPrice = readNumber(source, FIELD_ALIASES.noTaxUnitPrice, 0)
    row.unitPrice = readNumber(source, FIELD_ALIASES.unitPrice, 0)

    recalculateBoqRow(row)
    return row
  })
}
