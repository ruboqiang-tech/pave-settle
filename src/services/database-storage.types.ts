export type DatabaseConfigMode = 'existing' | 'new'
export type StorageBackend = 'dev-api' | 'browser-file'

export interface DatabaseFileSlot {
  label: string
  fileName: string
  absolutePath: string | null
  virtualPath: string | null
}

export interface DatabaseFileSelectionConfig {
  version: 2
  backend: StorageBackend
  mainDatabase: DatabaseFileSlot
  globalDatabase: DatabaseFileSlot
  updatedAt: string
}

export interface DatabaseConfigState {
  config: DatabaseFileSelectionConfig | null
  storageKind: StorageBackend
  mainDatabaseFilePath: string | null
  mainDatabaseFileName: string | null
  mainDatabaseFileExists: boolean
  mainDatabaseUpdatedAt: string | null
  globalDatabaseFilePath: string | null
  globalDatabaseFileName: string | null
  globalDatabaseFileExists: boolean
  globalDatabaseUpdatedAt: string | null
  canShowPhysicalPath: boolean

  // Legacy properties kept optional for backward compatibility during transition
  customDatabaseRoot?: string | null
  currentDatabaseRoot?: string | null
  databaseFilePath?: string | null
  backupsPath?: string | null
  databaseFileExists?: boolean
  backupsDirExists?: boolean
  storageLabel?: string | null
  databaseFileName?: string | null
  databaseFileSize?: number | null
  databaseUpdatedAt?: string | null
  globalDatabaseFileSize?: number | null
  lastSelectedAt?: string | null
}

export interface DatabaseBackupMeta {
  id: string
  name: string
  createdAt: string
  size: number
  source?: 'web' | 'unknown'
  databaseFilePath?: string | null
  databaseRoot?: string | null
  schemaVersion?: string | null
}
