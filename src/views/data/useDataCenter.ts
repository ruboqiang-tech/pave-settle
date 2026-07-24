import { computed, onMounted, ref, reactive } from 'vue'
import { systemSettingsService } from '@/services/system-settings.service'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createDataCenterBackup,
  deleteDataCenterBackup,
  getLatestDataCenterVersionInfo,
  loadDataCenterPage,
} from './data-center.controller'
import {
  getDbConfig,
  isDatabaseConnected,
  isMainDatabaseConnected,
  isGlobalDatabaseConnected,
  useDefaultMainDatabase,
  useDefaultGlobalDatabase,
  selectMainDatabase,
  selectGlobalDatabase,
  createGlobalNextToMain,
  selectMainWithDetectedGlobal,
  pickAndConnectBrowserMainFile,
  pickAndConnectBrowserGlobalFile,
  disconnectBrowserMainFile,
  disconnectBrowserGlobalFile,
  reauthorizeBrowserFile,
  triggerNativeFileDialog,
} from '@/services/db-core'
import {
  isBrowserFilePickerSupported,
  pickBrowserFile,
} from '@/services/browser-directory-access.service'
import type { DatabaseBackupState } from '@/services/data-center.service'
import type { DatabaseBackupMeta, DatabaseConfigState } from '@/services/database-storage.types'
import type { DataSummary } from '@/services/integrity.service'
import { aiConfigService, type AiProvider, type AiProviderConfig } from '@/services/ai-config.service'
import { fetchAvailableModels } from '@/services/ai-model-list.service'
import type { ModelFetchState } from '@/views/data/components/AiConfigPanel.vue'
import { getErrorMessage } from '@/utils/error'
import {
  emptyDatabaseConfig,
  emptyDataSummary,
  getActiveSourceDotClass,
  getDatabaseStructureStatusText,
  getDatabaseStructureStatusType,
  buildDatabaseStructureItems,
} from './data-center.helpers'

import { withLoading } from '../with-loading'

function triggerReload(message: string) {
  ElMessage.success(message)
  setTimeout(() => window.location.reload(), 800)
}

export function useDataCenter() {
  const refreshing = ref(false)
  const backupSaving = ref(false)
  const pathSubmitting = ref(false)
  const aiConfigSaving = ref(false)

  const dbConfigLoading = ref(false)
  const backupDraftName = ref('')

  const backupList = ref<DatabaseBackupMeta[]>([])
  const versionInfo = ref(getLatestDataCenterVersionInfo())
  const summary = ref<DataSummary>({ ...emptyDataSummary })
  const aiConfigs = ref<AiProviderConfig[]>([])
  const modelStates = reactive<Record<string, ModelFetchState>>({})
  const dbConfig = ref<DatabaseConfigState>({ ...emptyDatabaseConfig })

  // Inputs for main and global database configuration
  const mainDatabaseLocationInput = ref('')
  const globalDatabaseLocationInput = ref('')

  // Legacy inputs kept for backward compatibility with tests
  const existingDatabaseLocationInput = ref('')
  const newDatabaseLocationInput = ref('')

  const projectScaleThresholds = ref({ small: 5000000, large: 20000000 })

  const browserDirectorySupported = computed(() => isBrowserFilePickerSupported())
  const isDbConnected = computed(() => isMainDatabaseConnected())
  const isMainDbConnected = computed(() => isMainDatabaseConnected())
  const isGlobalDbConnected = computed(() => isGlobalDatabaseConnected())

  const usingBrowserDirectory = computed(() => dbConfig.value.storageKind === 'browser-file' || (dbConfig.value.storageKind as string) === 'browser-directory')
  const storageModeLabel = computed(() => {
    if ((dbConfig.value.storageKind as string) === 'browser-directory') return '文件夹模式'
    return usingBrowserDirectory.value ? '浏览器文件' : '开发桥模式'
  })
  const storageModeTagType = computed(() => usingBrowserDirectory.value ? 'success' : 'info')

  const currentLocationLabel = computed(() => '主业务库路径')
  const currentLocationValue = computed(() => dbConfig.value.mainDatabaseFilePath || '暂未设置')
  const currentLocationEmptyText = computed(() => '暂无数据库位置')
  const currentLocationName = computed(() => dbConfig.value.mainDatabaseFileName || 'pave.db')
  const currentDatabaseFilePath = computed(() => dbConfig.value.mainDatabaseFilePath || '')
  const backupsPath = computed(() => '')
  const currentDatabaseFileName = computed(() => dbConfig.value.mainDatabaseFileName || 'pave.db')

  const activeSourceDotClass = computed(() => getActiveSourceDotClass(versionInfo.value.activeSourceType))
  
  const structureStatusText = computed(() => getDatabaseStructureStatusText({
    mainDatabaseFileExists: !!dbConfig.value.mainDatabaseFileExists,
    globalDatabaseFileExists: !!dbConfig.value.globalDatabaseFileExists,
  }))
  const structureStatusType = computed(() => getDatabaseStructureStatusType({
    mainDatabaseFileExists: !!dbConfig.value.mainDatabaseFileExists,
    globalDatabaseFileExists: !!dbConfig.value.globalDatabaseFileExists,
  }))

  const structureItems = computed(() => buildDatabaseStructureItems(dbConfig.value as DatabaseConfigState))

  function applyBackupState(state: DatabaseBackupState) {
    backupList.value = state.backups || []
    versionInfo.value = state.versionInfo
  }

  async function loadDbConfig() {
    await withLoading(dbConfigLoading, async () => {
      const config = await getDbConfig()
      dbConfig.value = config
      mainDatabaseLocationInput.value = config.mainDatabaseFilePath || ''
      globalDatabaseLocationInput.value = config.globalDatabaseFilePath || ''

      // Map to legacy fields for compatibility
      existingDatabaseLocationInput.value = config.mainDatabaseFilePath || ''
      newDatabaseLocationInput.value = ''
    })
  }

  async function loadAiConfigs() {
    try {
      aiConfigs.value = await aiConfigService.list()
    } catch (error) {
      console.error(error)
      aiConfigs.value = aiConfigService.defaultConfigs()
    }
  }

  async function refreshAll() {
    await withLoading(refreshing, async () => {
      const page = await loadDataCenterPage()
      summary.value = page.summary
      applyBackupState(page.backupState)
      await Promise.all([
        loadDbConfig(),
        loadAiConfigs(),
        loadProjectScaleSettings(),
      ])
    })
  }

  async function loadProjectScaleSettings() {
    try {
      projectScaleThresholds.value = await systemSettingsService.getProjectScaleThresholds()
    } catch (e) {
      console.warn('Failed to load project scale settings', e)
    }
  }

  async function handleSaveScaleThresholds(thresholds: { small: number; large: number }) {
    try {
      await systemSettingsService.setProjectScaleThresholds(thresholds.small, thresholds.large)
      projectScaleThresholds.value = { ...thresholds }
    } catch (e) {
      console.error('Failed to save scale thresholds', e)
      throw e
    }
  }

  async function copyPath(path: string, label: string) {
    if (!path || path === '未设置路径') {
      ElMessage.warning(`暂无可复制的${label}`)
      return
    }

    try {
      await navigator.clipboard.writeText(path)
      ElMessage.success(`${label}已复制`)
    } catch (error) {
      ElMessage.error(getErrorMessage(error, `${label}复制失败`))
    }
  }

  // --- Slots actions ---

  async function handleUseDefaultMain() {
    try {
      await withLoading(pathSubmitting, async () => {
        const success = await useDefaultMainDatabase()
        if (success) {
          triggerReload('主业务库默认位置设置成功')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '主业务库设置失败'))
    }
  }

  async function handleUseDefaultGlobal() {
    try {
      await withLoading(pathSubmitting, async () => {
        const success = await useDefaultGlobalDatabase()
        if (success) {
          triggerReload('全局资产库默认位置设置成功')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '全局资产库设置失败'))
    }
  }

  async function handleSaveMainPath() {
    const path = mainDatabaseLocationInput.value.trim()
    if (!path) {
      try {
        await ElMessageBox.confirm('确定要清空并断开主业务库的连接吗？', '断开连接', {
          confirmButtonText: '确认断开',
          cancelButtonText: '取消',
          type: 'warning',
        })
      } catch {
        return
      }
    }

    try {
      await withLoading(pathSubmitting, async () => {
        const success = await selectMainDatabase(path)
        if (success) {
          triggerReload(path ? '主业务库路径更新成功' : '主业务库已成功断开连接')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '主业务库设置失败'))
    }
  }

  async function handleSaveGlobalPath() {
    const path = globalDatabaseLocationInput.value.trim()
    if (!path) {
      try {
        await ElMessageBox.confirm('确定要清空并断开全局资产库的连接吗？', '断开连接', {
          confirmButtonText: '确认断开',
          cancelButtonText: '取消',
          type: 'warning',
        })
      } catch {
        return
      }
    }

    try {
      await withLoading(pathSubmitting, async () => {
        const success = await selectGlobalDatabase(path)
        if (success) {
          triggerReload(path ? '全局资产库路径更新成功' : '全局资产库已成功断开连接')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '全局资产库设置失败'))
    }
  }

  async function handleCreateGlobalNextToMain() {
    try {
      await withLoading(pathSubmitting, async () => {
        const success = await createGlobalNextToMain()
        if (success) {
          triggerReload('全局资产库创建成功（已位于主库同级目录）')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '全局资产库创建失败'))
    }
  }

  // --- Database disconnect actions ---

  async function handleDisconnectMain() {
    try {
      await ElMessageBox.confirm('确定要断开当前主业务库连接吗？断开后您可以重新选择或指定数据库物理路径。', '断开连接', {
        confirmButtonText: '确认断开',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await withLoading(pathSubmitting, async () => {
        const success = await selectMainDatabase('')
        if (success) {
          triggerReload('主业务库已断开连接，页面即将刷新')
        }
      })
    } catch {
      // cancel
    }
  }

  async function handleDisconnectGlobal() {
    try {
      await ElMessageBox.confirm('确定要断开当前全局资产库连接吗？断开后您可以重新选择或指定数据库物理路径。', '断开连接', {
        confirmButtonText: '确认断开',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await withLoading(pathSubmitting, async () => {
        const success = await selectGlobalDatabase('')
        if (success) {
          triggerReload('全局资产库已断开连接，页面即将刷新')
        }
      })
    } catch {
      // cancel
    }
  }

  // --- Legacy action handlers kept as dummies to prevent test crashes ---
  async function handleSelectExistingDatabasePath() {
    const path = existingDatabaseLocationInput.value.trim()
    if (!path) return
    try {
      await withLoading(pathSubmitting, async () => {
        const success = await selectMainDatabase(path)
        if (success) {
          triggerReload('路径接管成功，页面即将刷新')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '路径接管失败'))
    }
  }

  async function handleSelectNewDatabasePath() {
    const path = newDatabaseLocationInput.value.trim()
    if (!path) return
    try {
      await withLoading(pathSubmitting, async () => {
        const success = await selectMainDatabase(path)
        if (success) {
          triggerReload('路径新建成功，页面即将刷新')
        }
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '路径新建失败'))
    }
  }

  async function handleSelectMainNativeFile() {
    try {
      const selected = await triggerNativeFileDialog('main')
      if (selected) {
        mainDatabaseLocationInput.value = selected
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '选择主库文件失败'))
    }
  }

  async function handleSelectGlobalNativeFile() {
    try {
      const selected = await triggerNativeFileDialog('global')
      if (selected) {
        globalDatabaseLocationInput.value = selected
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '选择资产库文件失败'))
    }
  }

  async function handleUseExistingBrowserDirectory() {}
  async function handleMigrateCurrentToBrowserDirectory() {}
  async function handleCreateNewBrowserDirectory() {}
  async function handleCreateBackup() {}
  async function handleDeleteBackup() {}

  // --- AI configurations ---
  function handleAddAiConfig(provider: AiProvider) {
    aiConfigs.value.push(aiConfigService.createConfig(provider))
    if (!aiConfigs.value.some(config => config.isDefault)) {
      aiConfigs.value[0].isDefault = true
    }
  }

  function handleDeleteAiConfig(id: string) {
    if (aiConfigs.value.length <= 1) {
      ElMessage.warning('至少保留一个 AI 配置槽位')
      return
    }

    const index = aiConfigs.value.findIndex(config => config.id === id)
    if (index === -1) return
    const wasDefault = aiConfigs.value[index].isDefault
    aiConfigs.value.splice(index, 1)
    if (wasDefault && aiConfigs.value[0]) {
      aiConfigs.value[0].isDefault = true
    }
  }

  function handleSetDefaultAiConfig(id: string) {
    aiConfigs.value.forEach(config => {
      config.isDefault = config.id === id
    })
  }

  async function handleSaveAiConfigs() {
    try {
      await withLoading(aiConfigSaving, async () => {
        aiConfigs.value = await aiConfigService.saveAll(aiConfigs.value)
        ElMessage.success('AI 配置已保存')
      })
    } catch (error) {
      ElMessage.error(getErrorMessage(error, 'AI 配置保存失败'))
    }
  }

  async function handleFetchModels(configId: string) {
    const config = aiConfigs.value.find(c => c.id === configId)
    if (!config) return

    if (!config.apiKey.trim()) {
      ElMessage.warning('请先填写 API Key')
      return
    }

    modelStates[configId] = { status: 'loading', models: [] }

    const result = await fetchAvailableModels(
      config.provider,
      config.apiKey,
      config.baseUrl || undefined,
    )

    modelStates[configId] = {
      status: result.status,
      models: result.models,
      error: result.error,
    }

    if (result.status === 'success' && result.models.length > 0) {
      const currentModelInList = result.models.some(m => m.id === config.model)
      if (!currentModelInList) {
        config.model = result.models[0].id
      }
      ElMessage.success(`已获取 ${result.models.length} 个可用模型`)
    } else if (result.error) {
      ElMessage.error(result.error)
    }
  }

  onMounted(() => {
    void refreshAll()
  })

  return {
    refreshing,
    backupSaving,
    pathSubmitting,
    aiConfigSaving,
    dbConfigLoading,
    backupDraftName,
    backupList,
    versionInfo,
    summary,
    aiConfigs,
    modelStates,
    existingDatabaseLocationInput,
    newDatabaseLocationInput,
    mainDatabaseLocationInput,
    globalDatabaseLocationInput,
    browserDirectorySupported,
    isDbConnected,
    isMainDbConnected,
    isGlobalDbConnected,
    usingBrowserDirectory,
    storageModeLabel,
    storageModeTagType,
    currentLocationLabel,
    currentLocationValue,
    currentLocationEmptyText,
    currentLocationName,
    currentDatabaseFilePath,
    currentDatabaseFileName,
    backupsPath,
    dbConfig,
    activeSourceDotClass,
    structureStatusText,
    structureStatusType,
    structureItems,
    refreshAll,
    copyPath,
    
    // New slot actions
    handleUseDefaultMain,
    handleUseDefaultGlobal,
    handleSaveMainPath,
    handleSaveGlobalPath,
    handleCreateGlobalNextToMain,
    handleSelectMainNativeFile,
    handleSelectGlobalNativeFile,
    
    // Legacy action handlers
    handleSelectExistingDatabasePath,
    handleSelectNewDatabasePath,
    handleUseExistingBrowserDirectory,
    handleMigrateCurrentToBrowserDirectory,
    handleCreateNewBrowserDirectory,
    handleCreateBackup,
    handleDeleteBackup,
    
    // AI configurations
    handleAddAiConfig,
    handleDeleteAiConfig,
    handleSetDefaultAiConfig,
    handleSaveAiConfigs,
    handleFetchModels,
    projectScaleThresholds,
    handleSaveScaleThresholds,
  }
}
