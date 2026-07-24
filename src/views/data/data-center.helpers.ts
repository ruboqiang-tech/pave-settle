import type { BrowserStorageAction, CurrentDatabaseVersionInfo } from '@/services/db-core'
import type { DatabaseConfigState } from '@/services/database-storage.types'
import type { DataSummary } from '@/services/integrity.service'

export const emptyDataSummary: DataSummary = {
  projects: 0,
  contracts: 0,
  boqItems: 0,
  confirmedSettlements: 0,
  payments: 0,
}

export const emptyDatabaseConfig: DatabaseConfigState = {
  config: null,
  storageKind: 'dev-api',
  mainDatabaseFilePath: null,
  mainDatabaseFileName: null,
  mainDatabaseFileExists: false,
  mainDatabaseUpdatedAt: null,
  globalDatabaseFilePath: null,
  globalDatabaseFileName: null,
  globalDatabaseFileExists: false,
  globalDatabaseUpdatedAt: null,
  canShowPhysicalPath: false,

  customDatabaseRoot: null,
  currentDatabaseRoot: null,
  databaseFilePath: null,
  backupsPath: null,
  databaseFileExists: false,
  backupsDirExists: false,
  storageLabel: null,
  databaseFileName: null,
  databaseFileSize: null,
  databaseUpdatedAt: null,
  lastSelectedAt: null,
}

export const dataCenterStructureTree = `数据中心
├─ 1. 当前数据库
│  ├─ 当前数据库位置
│  ├─ 主库 / 备份目录状态
│  └─ 当前使用来源
├─ 2. 备份数据库
│  ├─ 创建数据库备份
│  ├─ 查看备份路径
│  └─ 删除无效备份
└─ 3. 选择数据库路径
   ├─ 选择已有数据库文件夹
   ├─ 迁移当前数据库到新文件夹
   └─ 选择新的数据库路径`

export interface HealthSummary {
  errors: number
  warnings: number
  total: number
}

export interface DatabaseStructureStatus {
  mainDatabaseFileExists: boolean
  globalDatabaseFileExists: boolean
}

export interface DatabaseStructureItem {
  key: 'database' | 'globalDatabase'
  label: string
  path: string
  ok: boolean
  hint: string
  size?: string | null
  updatedAt?: string | null
}

export function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function buildBackupName(date = new Date()): string {
  return `手动备份 ${formatLocalDateTime(date)}`
}

export function formatBackupTime(value: string): string {
  if (/^\d+$/.test(value)) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return value
    const timestamp = value.length <= 10 ? numericValue * 1000 : numericValue
    return formatLocalDateTime(new Date(timestamp))
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatLocalDateTime(date)
}

export function formatBackupSize(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function getHealthBadgeText(summary: HealthSummary): string {
  if (summary.errors > 0) return '需立即处理'
  if (summary.warnings > 0) return '有待核查项'
  return '状态良好'
}

export function getHealthBadgeClass(summary: HealthSummary): string {
  if (summary.errors > 0) return 'bg-red-50 text-red-600'
  if (summary.warnings > 0) return 'bg-orange-50 text-orange-600'
  return 'bg-emerald-50 text-emerald-600'
}

export function getActiveSourceDotClass(activeSourceType: CurrentDatabaseVersionInfo['activeSourceType']): string {
  if (activeSourceType === 'backup') return 'bg-emerald-400'
  if (activeSourceType === 'demo') return 'bg-cyan-300'
  if (activeSourceType === 'empty') return 'bg-slate-300'
  return 'bg-blue-300'
}

export function getPathLeafName(value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.replace(/[\\/]+$/, '')
  const segments = normalized.split(/[\\/]/).filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : normalized
}

export function getDatabaseStructureStatusText(status: DatabaseStructureStatus): string {
  if (!status.mainDatabaseFileExists && !status.globalDatabaseFileExists) return '双数据库未接入'
  if (!status.mainDatabaseFileExists) return '主业务库未接入'
  if (!status.globalDatabaseFileExists) return '全局资产库未接入'
  return '双数据库均已就绪'
}

export function getDatabaseStructureStatusType(status: DatabaseStructureStatus): 'success' | 'warning' | 'danger' {
  if (!status.mainDatabaseFileExists && !status.globalDatabaseFileExists) return 'danger'
  if (!status.mainDatabaseFileExists || !status.globalDatabaseFileExists) return 'warning'
  return 'success'
}

export function buildDatabaseStructureItems(
  config: DatabaseConfigState
): DatabaseStructureItem[] {
  const mainExists = !!(config.mainDatabaseFileExists || config.databaseFileExists)
  const mainTime = config.mainDatabaseUpdatedAt || config.databaseUpdatedAt
  const dbSizeStr = mainExists && config.databaseFileSize != null ? formatBackupSize(config.databaseFileSize) : null
  const dbTimeStr = mainExists && mainTime ? formatBackupTime(mainTime) : null

  const globalExists = !!(config.globalDatabaseFileExists || config.databaseFileExists)
  const globalTime = config.globalDatabaseUpdatedAt || config.globalDatabaseUpdatedAt
  const gdbSizeStr = globalExists && config.globalDatabaseFileSize != null ? formatBackupSize(config.globalDatabaseFileSize) : null
  const gdbTimeStr = globalExists && globalTime ? formatBackupTime(globalTime) : null

  return [
    {
      key: 'database',
      label: '项目事务主库',
      path: config.mainDatabaseFilePath || config.databaseFilePath || '未设置路径',
      ok: mainExists,
      hint: '存储项目、结算、合同、收付款等核心业务数据',
      size: dbSizeStr,
      updatedAt: dbTimeStr,
    },
    {
      key: 'globalDatabase',
      label: '企业全局资产库',
      path: config.globalDatabaseFilePath || '未设置路径',
      ok: globalExists,
      hint: '存储价格库、定额模板、参数校验范围和全局系统设置等资产数据',
      size: gdbSizeStr,
      updatedAt: gdbTimeStr,
    }
  ]
}

export function getBrowserActionTitle(action: BrowserStorageAction): string {
  if (action === 'use-existing') return '使用现有库'
  if (action === 'migrate-current') return '迁移当前库'
  return '新建空库'
}

export function getBrowserActionFallbackMessage(action: BrowserStorageAction): string {
  if (action === 'use-existing') return '选择现有数据库目录失败'
  if (action === 'migrate-current') return '迁移当前数据库失败'
  return '新建空库失败'
}

export function buildBrowserDirectoryConfirmMessage(
  action: BrowserStorageAction,
  label: string,
  hasDatabase: boolean,
  hasBusinessData: boolean,
): string {
  if (action === 'use-existing') {
    return `系统会直接接管文件夹“${label}”中的数据库。是否继续？`
  }

  if (action === 'migrate-current') {
    if (hasDatabase) {
      return `文件夹“${label}”里已存在主库文件，继续后会用当前数据库覆盖它，并保留该文件夹里的备份目录。是否继续？`
    }
    return hasBusinessData
      ? `系统会把当前数据库迁移到文件夹“${label}”，并切换到这个目录。是否继续？`
      : `当前数据库还是空库；继续后会把当前空数据库写入文件夹“${label}”并开始使用这个路径。是否继续？`
  }

  if (hasDatabase) {
    return `文件夹“${label}”里已存在主库文件，继续后会移除该主库文件，并在刷新后重新初始化空白数据库。该文件夹里的备份目录会保留。是否继续？`
  }

  return `系统会把文件夹“${label}”设为新的数据库路径，并在刷新后初始化空白数据库与备份目录。是否继续？`
}

export function getBrowserDirectorySuccessMessage(action: BrowserStorageAction): string {
  if (action === 'use-existing') return '已切换到现有数据库，页面即将刷新'
  if (action === 'migrate-current') return '当前数据库已迁移到新文件夹，页面即将刷新'
  return '新的数据库路径已设置，页面即将刷新并初始化空库'
}
