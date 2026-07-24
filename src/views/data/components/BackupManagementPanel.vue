<template>
  <section class="dc-panel mt-4 sm:mt-6">
    <div class="dc-section-header flex-col md:flex-row md:items-center">
      <div class="dc-header-block">
        <div class="dc-inline-icon">
          <DatabaseIcon class="w-5 h-5" />
        </div>
        <div class="dc-header-stack">
          <h3 class="dc-section-heading">手动容灾备份管理</h3>
          <p class="dc-section-desc">
            在进行大批数据修改或进行接管切换前，备份能够随时保障您的项目事务主库与企业全局资产定额库数据的绝对安全。
          </p>
        </div>
      </div>
    </div>

    <div class="backup-form-panel dc-soft-block dc-soft-block-pad mb-4">
      <div class="dc-split-card p-0 md:items-center">
        <div class="max-w-xl">
          <h4 class="dc-title flex items-center gap-1.5">
            <Check class="w-5 h-5 dc-icon-success" /> 快速生成当前双数据库冷备份
          </h4>
          <p class="dc-muted mt-1">
            系统将捕获当前事务主库与全局资产库的完整二进制流快照，并克隆保存到
            <b class="dc-strong-muted">`backups/`</b> 目录下。
          </p>
        </div>
        <div class="dc-form-actions md:w-auto">
          <el-input v-model="backupDraftName" placeholder="如: 五月大宗盘点前备份" clearable class="md:w-64">
            <template #prepend>
              <span class="dc-strong-muted text-xs">备份备注</span>
            </template>
          </el-input>
          <el-button type="primary" :loading="backupSaving" class="btn-create-backup" @click="$emit('createBackup')">
            <template #icon><Check /></template>创建系统冷备份
          </el-button>
        </div>
      </div>
    </div>

    <div class="backup-list-container">
      <h4 class="dc-title text-sm mb-3 flex items-center gap-1.5">
        <Folder class="w-4 h-4 dc-icon-success" /> 已备份历史清单 ({{ backupList.length }} 个)
      </h4>

      <el-table
        v-if="backupList.length > 0"
        :data="backupList"
        style="width: 100%"
        class="custom-table"
        header-cell-class-name="table-header-cell"
      >
        <el-table-column label="备份备注/名称" min-width="180">
          <template #default="{ row }">
            <div class="flex items-center gap-2.5">
              <div class="dc-file-icon dc-icon-success">
                <DatabaseIcon class="w-4 h-4" />
              </div>
              <div>
                <div class="dc-title">{{ row.name }}</div>
                <div class="dc-subtle text-[10px] font-mono mt-0.5 select-all">{{ row.id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Schema" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain" class="font-mono">v{{ row.schemaVersion || '11' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            <span class="dc-muted">{{ formatBackupTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="大小" width="110" align="right">
          <template #default="{ row }">
            <span class="dc-title text-xs font-mono">
              {{ formatBackupSize(row.size) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="物理文件绝对路径（切换接管可用）" min-width="260">
          <template #default="{ row }">
            <div class="backup-path-cell dc-code-line flex items-center justify-between gap-2 font-mono text-xs select-all">
              <el-tooltip :content="row.databaseFilePath || row.databaseRoot" placement="top">
                <span class="truncate block pr-2 select-all">{{ row.databaseFilePath || row.databaseRoot }}</span>
              </el-tooltip>
              <el-button link type="primary" size="small" @click="$emit('copyPath', row.databaseFilePath || row.databaseRoot, '该备份路径')">
                <template #icon><CopyDocument /></template>
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="$emit('deleteBackup', row)">
              <template #icon><Delete /></template>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="backup-empty-state">
        <el-empty :image-size="120" description="未检测到任何本地冷备份文件">
          <template #extra>
            <p class="dc-muted max-w-sm mx-auto text-center mb-3">
              手动备份存放在当前数据库主路径下的 `backups/` 文件夹中。建议在进行大批量清单数据录入、结算审定或切换本地路径前生成一个快照冷备份。
            </p>
          </template>
        </el-empty>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Check, CopyDocument, Delete, Folder } from '@element-plus/icons-vue'
import type { DatabaseBackupMeta } from '@/services/database-storage.types'
import { formatBackupSize, formatBackupTime } from '../data-center.helpers'
import DatabaseIcon from './DataCenterDatabaseIcon'

defineProps<{
  backupSaving: boolean
  backupList: DatabaseBackupMeta[]
}>()

const backupDraftName = defineModel<string>('backupDraftName', { required: true })

defineEmits<{
  createBackup: []
  deleteBackup: [backup: DatabaseBackupMeta]
  copyPath: [path: string, label: string]
}>()
</script>
