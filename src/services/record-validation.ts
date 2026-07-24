import { roundAmount } from '@/utils/calculations'
import { getDb } from './db-core'

export function projectExists(projectId: number): boolean {
  const db = getDb()
  if (!db) return false
  const result = db.exec('SELECT 1 FROM projects WHERE id = ? LIMIT 1', [projectId])
  return (result[0]?.values?.length ?? 0) > 0
}

export function roundCurrencyAmount(amount: number): number {
  return roundAmount(Number(amount || 0))
}
