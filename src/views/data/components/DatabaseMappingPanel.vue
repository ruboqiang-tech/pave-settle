<template>
  <div class="dc-panel" style="padding: 10px 14px; border-radius: 8px;">
    <!-- Clickable Header for toggling -->
    <div 
      style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;"
      @click="isOpen = !isOpen"
    >
      <div style="display: flex; align-items: center; gap: 6px;">
        <el-icon class="dc-icon-primary" style="font-size: 0.875rem;"><InfoFilled /></el-icon>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--dc-text-title);">各业务板块数据库归属表</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 0.7rem; color: var(--el-text-color-secondary);">
          {{ isOpen ? '收起' : '展开' }}
        </span>
        <el-icon 
          style="font-size: 0.75rem; color: var(--el-text-color-secondary); transition: transform 0.25s;"
          :style="{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }"
        >
          <ArrowDown />
        </el-icon>
      </div>
    </div>

    <!-- Collapsible Table Content -->
    <el-collapse-transition>
      <div v-show="isOpen" style="margin-top: 10px;">
        <el-table 
          :data="mappingData" 
          size="small" 
          border 
          style="width: 100%; font-size: 0.72rem; border-radius: 4px; overflow: hidden;"
          :header-cell-style="{ background: 'var(--el-fill-color-light)', color: 'var(--el-text-color-primary)', fontWeight: '600', padding: '4px 0' }"
          :cell-style="{ padding: '4px 0' }"
        >
          <el-table-column prop="module" label="业务板块" width="100" />
          <el-table-column prop="dbName" label="归属数据库" width="120">
            <template #default="{ row }">
              <el-tag 
                size="small" 
                :type="row.dbKey === 'main' ? 'primary' : row.dbKey === 'global' ? 'success' : 'info'" 
                effect="plain"
                style="font-size: 0.7rem; height: 18px; line-height: 16px; padding: 0 4px;"
              >
                {{ row.dbName }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="数据流向与功能范围" />
        </el-table>
      </div>
    </el-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { InfoFilled, ArrowDown } from '@element-plus/icons-vue'

const isOpen = ref(false) // Default to collapsed

interface MappingItem {
  module: string
  dbName: string
  dbKey: 'main' | 'global' | 'dynamic'
  description: string
}

const mappingData = ref<MappingItem[]>([
  {
    module: '项目管理',
    dbName: '项目事务主库',
    dbKey: 'main',
    description: '包含项目列表、基础参数、标段划分。属于项目专属数据。'
  },
  {
    module: '预算与测算',
    dbName: '项目事务主库',
    dbKey: 'main',
    description: '存放预算书与工程清单（BOQ）。清单来源于主库；测算时套用的定额公式与指导单价则实时拉取自全局资产库。'
  },
  {
    module: '结算管理',
    dbName: '项目事务主库',
    dbKey: 'main',
    description: '记录清单期次结算明细、扣减金额、调差记录。属于项目执行流水。'
  },
  {
    module: '成本与收付款',
    dbName: '项目事务主库',
    dbKey: 'main',
    description: '包含合同总额、发票流水、收付款台账以及工料机实际消耗记账。属于独立的纯主库数据源。'
  },
  {
    module: '消耗分析',
    dbName: '内存动态计算',
    dbKey: 'dynamic',
    description: '实时读取主库数据（结算量与实际支出）进行多维分析。结果支持导出 Excel，且实际材料损耗率可反向沉淀更新回定额库。'
  },
  {
    module: '价格库维护',
    dbName: '企业全局资产库',
    dbKey: 'global',
    description: '存放材料分类指导价、供货商报价单。属于企业全局共享静态资产。'
  },
  {
    module: '定额库维护',
    dbName: '企业全局资产库',
    dbKey: 'global',
    description: '存放沥青、水稳等材料定额及计算公式。支持从项目消耗分析中回传经验数据，反哺定额指标。'
  },
  {
    module: '企业规模阈值',
    dbName: '企业全局资产库',
    dbKey: 'global',
    description: '存放企业大、中、小型标段金额的统一划分阈值。'
  },
  {
    module: 'AI智能配置',
    dbName: '项目事务主库',
    dbKey: 'main',
    description: '存放本项目的 AI API Key 与首选模型。各项目可独立配置不同的 AI 实例。'
  }
])
</script>
