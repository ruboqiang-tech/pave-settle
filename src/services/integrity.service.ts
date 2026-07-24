/**
 * 数据中心轻量摘要服务。
 * 旧的数据完整性扫描已迁移到 data-health.service，这里只保留数据中心仍在使用的汇总计数。
 */
import { getDb } from './db-core'

export interface DataSummary {
  projects: number
  contracts: number
  boqItems: number
  confirmedSettlements: number
  payments: number
}

function getCountValue(sql: string): number {
  const db = getDb()
  if (!db) return 0

  return Number(db.exec(sql)[0]?.values?.[0]?.[0] ?? 0)
}

export const getDataSummary = async (): Promise<DataSummary> => {
  return {
    projects: getCountValue('SELECT COUNT(*) FROM projects'),
    contracts: getCountValue('SELECT COUNT(*) FROM contracts'),
    boqItems: getCountValue('SELECT COUNT(*) FROM bill_of_quantities'),
    confirmedSettlements: getCountValue("SELECT COUNT(*) FROM settlements WHERE status IN ('confirmed', 'approved')"),
    payments: getCountValue('SELECT COUNT(*) FROM payments'),
  }
}
