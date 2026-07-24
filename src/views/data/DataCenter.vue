<template>
  <div class="data-center-page">
    <el-alert
      v-if="!isMainDbConnected"
      title="主业务数据库未接入"
      type="warning"
      description="检测到当前未接入项目事务主业务库（系统正处于临时内存模式，修改在刷新后丢失）。请在下方「项目事务主库」槽位中选择默认位置新建或接入已有数据库文件。"
      show-icon
      :closable="false"
      style="margin-bottom: 12px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.05); border-radius: 8px;"
    />
    <el-alert
      v-if="!isGlobalDbConnected"
      title="全局资产数据库未接入"
      type="info"
      description="检测到当前未接入全局资产库（价格库、定额库、系统设置等资产功能不可写）。请在下方「企业全局资产库」槽位中选择默认位置新建或接入已有资产数据库文件。"
      show-icon
      :closable="false"
      style="margin-bottom: 20px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.05); border-radius: 8px;"
    />



    <div class="dc-layout-grid">
      <div class="dc-layout-column">
        <StorageStatusPanel
          v-model:main-database-location="mainDatabaseLocationInput"
          v-model:global-database-location="globalDatabaseLocationInput"
          :main-db-exists="isMainDbConnected"
          :global-db-exists="isGlobalDbConnected"
          :main-path="currentDatabaseFilePath"
          :global-path="dbConfig.globalDatabaseFilePath || ''"
          :structure-items="structureItems"
          :path-submitting="pathSubmitting"
          @copy-path="copyPath"
          @use-default-main="handleUseDefaultMain"
          @use-default-global="handleUseDefaultGlobal"
          @save-main-path="handleSaveMainPath"
          @save-global-path="handleSaveGlobalPath"
          @create-global-next-to-main="handleCreateGlobalNextToMain"
          @select-main-native-file="handleSelectMainNativeFile"
          @select-global-native-file="handleSelectGlobalNativeFile"
        />
        <ProjectScaleSettingsPanel
          :thresholds="projectScaleThresholds"
          @save-thresholds="handleSaveScaleThresholds"
        />
        <DatabaseMappingPanel />
      </div>

      <div class="dc-layout-column">
        <BusinessMetricsPanel :summary="summary" />
        <AiConfigPanel
          :configs="aiConfigs"
          :saving="aiConfigSaving"
          :model-states="modelStates"
          @add-config="handleAddAiConfig"
          @delete-config="handleDeleteAiConfig"
          @set-default-config="handleSetDefaultAiConfig"
          @save-configs="handleSaveAiConfigs"
          @fetch-models="handleFetchModels"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './data-center.css'
import AiConfigPanel from './components/AiConfigPanel.vue'
import BusinessMetricsPanel from './components/BusinessMetricsPanel.vue'
import StorageStatusPanel from './components/StorageStatusPanel.vue'
import ProjectScaleSettingsPanel from './components/ProjectScaleSettingsPanel.vue'
import DatabaseMappingPanel from './components/DatabaseMappingPanel.vue'
import { useDataCenter } from './useDataCenter'

const {
  pathSubmitting,
  aiConfigSaving,
  summary,
  aiConfigs,
  modelStates,
  mainDatabaseLocationInput,
  globalDatabaseLocationInput,
  currentDatabaseFilePath,
  dbConfig,
  structureItems,
  refreshAll,
  copyPath,
  isMainDbConnected,
  isGlobalDbConnected,
  handleUseDefaultMain,
  handleUseDefaultGlobal,
  handleSaveMainPath,
  handleSaveGlobalPath,
  handleCreateGlobalNextToMain,
  handleSelectMainNativeFile,
  handleSelectGlobalNativeFile,
  handleAddAiConfig,
  handleDeleteAiConfig,
  handleSetDefaultAiConfig,
  handleSaveAiConfigs,
  handleFetchModels,
  projectScaleThresholds,
  handleSaveScaleThresholds,
} = useDataCenter()
</script>
