import {
  createManualDatabaseBackupAndReloadState,
  deleteDatabaseBackupAndReloadState,
  getCurrentDataCenterVersionInfo,
  loadDatabaseBackupState,
  type DatabaseBackupState,
} from '@/services/data-center.service'
import type { DatabaseBackupMeta } from '@/services/database-storage.types'
import { getDataSummary, type DataSummary } from '@/services/integrity.service'

export interface DataCenterPageState {
  summary: DataSummary
  backupState: DatabaseBackupState
}

export async function loadDataCenterPage(): Promise<DataCenterPageState> {
  const [summary, backupState] = await Promise.all([
    getDataSummary(),
    loadDatabaseBackupState(),
  ])

  return {
    summary,
    backupState,
  }
}

export async function loadDataCenterSummary(): Promise<DataSummary> {
  return getDataSummary()
}

export async function loadDataCenterBackups(): Promise<DatabaseBackupState> {
  return loadDatabaseBackupState()
}

export function getLatestDataCenterVersionInfo(backupCount?: number) {
  return getCurrentDataCenterVersionInfo(backupCount)
}

export async function createDataCenterBackup(
  backupName: string,
  fallbackName: string,
): Promise<{
  backupState: DatabaseBackupState
  nextBackupDraftName: string
  successMessage: string
}> {
  const backupState = await createManualDatabaseBackupAndReloadState(backupName, fallbackName)
  return {
    backupState,
    nextBackupDraftName: fallbackName,
    successMessage: '数据库备份已保存',
  }
}

export async function deleteDataCenterBackup(
  backup: DatabaseBackupMeta,
): Promise<{
  backupState: DatabaseBackupState
  successMessage: string
}> {
  const backupState = await deleteDatabaseBackupAndReloadState(backup.id)
  return {
    backupState,
    successMessage: '数据库备份已删除',
  }
}
