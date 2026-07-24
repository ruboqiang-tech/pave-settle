import {
  createDatabaseBackup,
  deleteDatabaseBackup,
  getCurrentDatabaseVersionInfo,
  listDatabaseBackups,
  type CurrentDatabaseVersionInfo,
} from './db-core'
import type { DatabaseBackupMeta } from './database-storage.types'

export interface DatabaseBackupState {
  backups: DatabaseBackupMeta[]
  versionInfo: CurrentDatabaseVersionInfo
}

export function getCurrentDataCenterVersionInfo(backupCount?: number): CurrentDatabaseVersionInfo {
  return getCurrentDatabaseVersionInfo(backupCount)
}

export async function createManualDatabaseBackup(
  backupName: string,
  fallbackName: string,
): Promise<DatabaseBackupMeta> {
  return createDatabaseBackup(backupName.trim() || fallbackName)
}

export async function loadDatabaseBackupState(): Promise<DatabaseBackupState> {
  const backups = await listDatabaseBackups()
  return {
    backups,
    versionInfo: getCurrentDataCenterVersionInfo(backups.length),
  }
}

export async function createManualDatabaseBackupAndReloadState(
  backupName: string,
  fallbackName: string,
): Promise<DatabaseBackupState> {
  await createManualDatabaseBackup(backupName, fallbackName)
  return loadDatabaseBackupState()
}

export async function deleteDatabaseBackupAndReloadState(
  backupId: string,
): Promise<DatabaseBackupState> {
  await deleteDatabaseBackup(backupId)
  return loadDatabaseBackupState()
}
