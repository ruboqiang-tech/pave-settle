<template>
  <section class="dc-panel overflow-hidden">
    <div class="dc-section-header">
      <div class="dc-header-block">
        <div class="dc-inline-icon">
          <Folder class="w-5 h-5" />
        </div>
        <div class="dc-header-stack">
          <h3 class="dc-section-heading">双数据库存储绝对路径配置</h3>
          <p class="dc-section-desc">配置项目事务主库与企业全局资产库的物理路径，支持一键点击选择与智能初始化</p>
        </div>
      </div>
    </div>

    <div class="card-body pt-2 space-y-4">
      
      <!-- Slot 1: 项目事务主库 (pave.db) -->
      <div class="slot-card" :class="{ 'slot-card--connected': mainDbExists }">
        <div class="slot-header">
          <div class="flex items-center gap-2">
            <Document class="w-4 h-4 text-indigo" />
            <span class="slot-title">项目事务主库 (pave.db)</span>
            <el-tag size="small" :type="mainDbExists ? 'success' : 'danger'" effect="plain">
              {{ mainDbExists ? '已连接' : '未接入' }}
            </el-tag>
          </div>
          <div class="flex gap-2">
            <el-button 
              v-if="!mainDbExists" 
              link 
              type="primary" 
              size="small" 
              @click="$emit('useDefaultMain')"
            >
              <template #icon><Setting class="w-3.5 h-3.5" /></template>初始化数据库
            </el-button>
            <el-button 
              v-if="mainDbExists && mainPath" 
              link 
              type="primary" 
              size="small" 
              @click="$emit('copyPath', mainPath, '主业务库路径')"
            >
              <template #icon><CopyDocument /></template>复制路径
            </el-button>
          </div>
        </div>

        <div class="slot-body">
          <div class="slot-meta" v-if="mainDbExists && mainMeta">
            <span class="meta-item"><Clock class="w-3 h-3" />更新: {{ mainMeta?.updatedAt || '无' }}</span>
            <span class="meta-item"><Setting class="w-3 h-3" />大小: {{ mainMeta?.size || '未知' }}</span>
          </div>

          <div class="flex gap-2 items-center">
            <el-input 
              v-model="mainDatabaseLocation" 
              size="small" 
              placeholder="例如: D:\Data\pave.db (为空保存可断开连接)" 
              clearable 
              style="flex: 1;" 
            >
              <template #append>
                <el-button @click="$emit('selectMainNativeFile')">
                  <Folder class="w-3.5 h-3.5" />
                </el-button>
              </template>
            </el-input>
            <el-button 
              type="primary" 
              size="small" 
              :loading="pathSubmitting" 
              @click="$emit('saveMainPath')"
            >
              保存并接入
            </el-button>
          </div>
        </div>
      </div>

      <!-- Slot 2: 企业全局资产库 (global-assets.db) -->
      <div class="slot-card" :class="{ 'slot-card--connected': globalDbExists }">
        <div class="slot-header">
          <div class="flex items-center gap-2">
            <Document class="w-4 h-4 text-emerald" />
            <span class="slot-title">企业全局资产库 (global-assets.db)</span>
            <el-tag size="small" :type="globalDbExists ? 'success' : 'info'" effect="plain">
              {{ globalDbExists ? '已连接' : '未接入' }}
            </el-tag>
          </div>
          <div class="flex gap-2">
            <el-button 
              v-if="!globalDbExists" 
              link 
              type="primary" 
              size="small" 
              @click="$emit('useDefaultGlobal')"
            >
              <template #icon><Setting class="w-3.5 h-3.5" /></template>初始化资产库
            </el-button>
            <el-button 
              v-if="mainDbExists && !globalDbExists" 
              link 
              type="primary" 
              size="small" 
              @click="$emit('createGlobalNextToMain')"
            >
              <template #icon><FolderAdd class="w-3.5 h-3.5" /></template>在同级创建
            </el-button>
            <el-button 
              v-if="globalDbExists && globalPath" 
              link 
              type="primary" 
              size="small" 
              @click="$emit('copyPath', globalPath, '全局资产库路径')"
            >
              <template #icon><CopyDocument /></template>复制路径
            </el-button>
          </div>
        </div>

        <div class="slot-body">
          <div class="slot-meta" v-if="globalDbExists && globalMeta">
            <span class="meta-item"><Clock class="w-3 h-3" />更新: {{ globalMeta?.updatedAt || '无' }}</span>
            <span class="meta-item"><Setting class="w-3 h-3" />大小: {{ globalMeta?.size || '未知' }}</span>
          </div>

          <div class="flex gap-2 items-center">
            <el-input 
              v-model="globalDatabaseLocation" 
              size="small" 
              placeholder="例如: D:\Data\global-assets.db (为空保存可断开连接)" 
              clearable 
              style="flex: 1;" 
            >
              <template #append>
                <el-button @click="$emit('selectGlobalNativeFile')">
                  <Folder class="w-3.5 h-3.5" />
                </el-button>
              </template>
            </el-input>
            <el-button 
              type="primary" 
              size="small" 
              :loading="pathSubmitting" 
              @click="$emit('saveGlobalPath')"
            >
              保存并接入
            </el-button>
          </div>
        </div>
      </div>


    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CopyDocument, Document, Folder, Setting, Clock, FolderAdd } from '@element-plus/icons-vue'
import type { DatabaseStructureItem } from '../data-center.helpers'

const props = defineProps<{
  mainDbExists: boolean
  globalDbExists: boolean
  mainPath: string
  globalPath: string
  structureItems: DatabaseStructureItem[]
  pathSubmitting: boolean
}>()

const mainDatabaseLocation = defineModel<string>('mainDatabaseLocation', { required: true })
const globalDatabaseLocation = defineModel<string>('globalDatabaseLocation', { required: true })

defineEmits<{
  copyPath: [path: string, label: string]
  saveMainPath: []
  saveGlobalPath: []
  useDefaultMain: []
  useDefaultGlobal: []
  createGlobalNextToMain: []
  selectMainNativeFile: []
  selectGlobalNativeFile: []
}>()

const mainMeta = computed(() => {
  return props.structureItems.find(item => item.key === 'database')
})

const globalMeta = computed(() => {
  return props.structureItems.find(item => item.key === 'globalDatabase')
})
</script>

<style scoped>
.slot-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 14px;
}

.slot-card--connected {
  border-color: var(--el-color-primary-light-8);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.03);
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  padding-bottom: 8px;
}

.slot-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--el-text-color-primary);
}

.slot-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 0.72rem;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.text-emerald {
  color: #10b981;
}
</style>
