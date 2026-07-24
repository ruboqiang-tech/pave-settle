/**
 * Excel 导入导出统一工具
 * 封装 xlsx 库的动态导入和常用操作，避免各视图重复代码
 */
import { saveBlobFile, type SaveFileResult } from './file-download'

// 懒加载 xlsx 库（只在需要时加载，不影响首屏性能）
async function loadXLSX() {
  return import('xlsx')
}

/**
 * 导出 Excel 文件（从二维数组）
 * @param fileName 文件名（不含 .xlsx 后缀）
 * @param sheetName 工作表名称
 * @param data 二维数组，第一行为表头
 * @param colWidths 可选，列宽数组（单位：字符数）
 */
export async function exportToExcel(
  fileName: string,
  sheetName: string,
  data: (string | number | undefined | null)[][],
  colWidths?: number[]
): Promise<SaveFileResult> {
  const XLSX = await loadXLSX()
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // 设置列宽
  if (colWidths && colWidths.length > 0) {
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }))
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return saveBlobFile(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), {
    fileName: `${fileName}.xlsx`,
    description: 'Excel 工作簿',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
  })
}

export interface MergeRange {
  s: { r: number; c: number }
  e: { r: number; c: number }
}

/**
 * 导出带标题行的 Excel（常用于结算单、清单等有抬头信息的场景）
 * @param fileName 文件名（不含 .xlsx 后缀）
 * @param sheetName 工作表名称
 * @param titleRows 标题行（如项目名、结算单号等信息行）
 * @param headers 表头行
 * @param dataRows 数据行
 * @param colWidths 可选列宽
 * @param merges 可选合并单元格范围
 */
export async function exportToExcelWithTitle(
  fileName: string,
  sheetName: string,
  titleRows: (string | number | undefined | null)[][],
  headers: (string | number)[],
  dataRows: (string | number | undefined | null)[][],
  colWidths?: number[],
  merges?: MergeRange[]
): Promise<SaveFileResult> {
  const XLSX = await loadXLSX()
  const allData = [...titleRows, headers, ...dataRows]
  const worksheet = XLSX.utils.aoa_to_sheet(allData)
  if (colWidths && colWidths.length > 0) {
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }))
  }
  if (merges && merges.length > 0) {
    worksheet['!merges'] = merges
  }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return saveBlobFile(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), {
    fileName: `${fileName}.xlsx`,
    description: 'Excel 工作簿',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
  })
}

/**
 * 从 Excel 文件读取数据
 * @param file File 对象
 * @param sheetIndex 工作表索引（默认第一个）
 * @returns 解析后的 JSON 数组
 */
export async function importFromExcel<T = Record<string, unknown>>(
  file: File,
  sheetIndex: number = 0
): Promise<T[]> {
  const XLSX = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[sheetIndex]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<T>(sheet)
}

/**
 * 下载 Excel 导入模板
 * @param fileName 文件名（不含 .xlsx 后缀）
 * @param sheetName 工作表名称
 * @param headers 表头数组
 * @param exampleData 示例数据行（可选）
 * @param colWidths 列宽数组（可选）
 */
export async function downloadTemplate(
  fileName: string,
  sheetName: string,
  headers: string[],
  exampleData: (string | number)[][] = [],
  colWidths?: number[]
): Promise<SaveFileResult> {
  const data: (string | number)[][] = [headers, ...exampleData]
  return exportToExcel(fileName, sheetName, data, colWidths)
}
