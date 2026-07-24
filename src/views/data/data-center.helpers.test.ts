import { describe, expect, it } from 'vitest'
import {
  buildBrowserDirectoryConfirmMessage,
  buildBackupName,
  buildDatabaseStructureItems,
  dataCenterStructureTree,
  emptyDatabaseConfig,
  formatBackupSize,
  formatBackupTime,
  formatLocalDateTime,
  getActiveSourceDotClass,
  getBrowserActionFallbackMessage,
  getBrowserActionTitle,
  getBrowserDirectorySuccessMessage,
  getDatabaseStructureStatusText,
  getDatabaseStructureStatusType,
  getHealthBadgeClass,
  getHealthBadgeText,
  getPathLeafName,
} from './data-center.helpers'

describe('data-center helpers', () => {
  it('formats local time and backup point name consistently', () => {
    const date = new Date(2026, 3, 9, 8, 5)

    expect(formatLocalDateTime(date)).toBe('2026-04-09 08:05')
    expect(buildBackupName(date)).toBe('手动备份 2026-04-09 08:05')
  })

  it('formats backup time from seconds, milliseconds and iso string', () => {
    const date = new Date(2026, 3, 9, 8, 5)
    const unixSeconds = String(Math.floor(date.getTime() / 1000))
    const unixMilliseconds = String(date.getTime())

    expect(formatBackupTime(unixSeconds)).toBe('2026-04-09 08:05')
    expect(formatBackupTime(unixMilliseconds)).toBe('2026-04-09 08:05')
    expect(formatBackupTime('2026-04-09T08:05:00')).toBe('2026-04-09 08:05')
    expect(formatBackupTime('invalid')).toBe('invalid')
  })

  it('formats backup sizes by unit', () => {
    expect(formatBackupSize(512)).toBe('512 B')
    expect(formatBackupSize(2048)).toBe('2.0 KB')
    expect(formatBackupSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('maps health summaries to badge text and class', () => {
    expect(getHealthBadgeText({ errors: 1, warnings: 0, total: 1 })).toBe('需立即处理')
    expect(getHealthBadgeClass({ errors: 1, warnings: 0, total: 1 })).toBe('bg-red-50 text-red-600')
    expect(getHealthBadgeText({ errors: 0, warnings: 1, total: 1 })).toBe('有待核查项')
    expect(getHealthBadgeClass({ errors: 0, warnings: 1, total: 1 })).toBe('bg-orange-50 text-orange-600')
    expect(getHealthBadgeText({ errors: 0, warnings: 0, total: 0 })).toBe('状态良好')
    expect(getHealthBadgeClass({ errors: 0, warnings: 0, total: 0 })).toBe('bg-emerald-50 text-emerald-600')
  })

  it('maps data source type to dot class', () => {
    expect(getActiveSourceDotClass('backup')).toBe('bg-emerald-400')
    expect(getActiveSourceDotClass('demo')).toBe('bg-cyan-300')
    expect(getActiveSourceDotClass('empty')).toBe('bg-slate-300')
    expect(getActiveSourceDotClass('live')).toBe('bg-blue-300')
  })

  it('reads path leaf names and current structure status correctly', () => {
    expect(getPathLeafName('D:/SettlementData/正式库')).toBe('正式库')
    expect(getPathLeafName('D:/SettlementData/正式库/')).toBe('正式库')
    expect(getPathLeafName('')).toBe('')

    expect(getDatabaseStructureStatusText({ mainDatabaseFileExists: false, globalDatabaseFileExists: false })).toBe('双数据库未接入')
    expect(getDatabaseStructureStatusType({ mainDatabaseFileExists: false, globalDatabaseFileExists: false })).toBe('danger')
    expect(getDatabaseStructureStatusText({ mainDatabaseFileExists: false, globalDatabaseFileExists: true })).toBe('主业务库未接入')
    expect(getDatabaseStructureStatusType({ mainDatabaseFileExists: false, globalDatabaseFileExists: true })).toBe('warning')
    expect(getDatabaseStructureStatusText({ mainDatabaseFileExists: true, globalDatabaseFileExists: false })).toBe('全局资产库未接入')
    expect(getDatabaseStructureStatusType({ mainDatabaseFileExists: true, globalDatabaseFileExists: false })).toBe('warning')
    expect(getDatabaseStructureStatusText({ mainDatabaseFileExists: true, globalDatabaseFileExists: true })).toBe('双数据库均已就绪')
    expect(getDatabaseStructureStatusType({ mainDatabaseFileExists: true, globalDatabaseFileExists: true })).toBe('success')
  })

  it('builds database structure rows from config instead of view state', () => {
    expect(buildDatabaseStructureItems({
      ...emptyDatabaseConfig,
      mainDatabaseFilePath: 'D:/实例A/pave.db',
      globalDatabaseFilePath: 'D:/实例A/global-assets.db',
      mainDatabaseFileExists: true,
      globalDatabaseFileExists: true,
    })).toEqual([
      {
        key: 'database',
        label: '项目事务主库',
        path: 'D:/实例A/pave.db',
        ok: true,
        hint: '存储项目、结算、合同、收付款等核心业务数据',
        size: null,
        updatedAt: null,
      },
      {
        key: 'globalDatabase',
        label: '企业全局资产库',
        path: 'D:/实例A/global-assets.db',
        ok: true,
        hint: '存储价格库、定额模板、参数校验范围和全局系统设置等资产数据',
        size: null,
        updatedAt: null,
      }
    ])
  })

  it('centralizes browser directory action copy', () => {
    expect(getBrowserActionTitle('use-existing')).toBe('使用现有库')
    expect(getBrowserActionFallbackMessage('migrate-current')).toBe('迁移当前数据库失败')
    expect(getBrowserDirectorySuccessMessage('create-new')).toBe('新的数据库路径已设置，页面即将刷新并初始化空库')

    expect(buildBrowserDirectoryConfirmMessage('use-existing', '实例A', true, true))
      .toBe('系统会直接接管文件夹“实例A”中的数据库。是否继续？')
    expect(buildBrowserDirectoryConfirmMessage('migrate-current', '实例B', false, false))
      .toBe('当前数据库还是空库；继续后会把当前空数据库写入文件夹“实例B”并开始使用这个路径。是否继续？')
    expect(buildBrowserDirectoryConfirmMessage('create-new', '实例C', true, true))
      .toBe('文件夹“实例C”里已存在主库文件，继续后会移除该主库文件，并在刷新后重新初始化空白数据库。该文件夹里的备份目录会保留。是否继续？')
  })

  it('keeps the structure tree focused on current database, backup and switching', () => {
    expect(dataCenterStructureTree).toContain('数据中心')
    expect(dataCenterStructureTree).toContain('备份数据库')
    expect(dataCenterStructureTree).toContain('选择新的数据库路径')
  })
})
