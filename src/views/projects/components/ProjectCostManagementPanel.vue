<template>
  <div class="pd-panel pd-cost-panel">
    <!-- 项目选择与台账管理头部 -->
    <div class="pd-section-head" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 class="pd-section-title" style="margin: 0;">签订项目成本台账</h2>
        <el-tag v-if="project" size="small" type="success">已签约</el-tag>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="font-size: 0.8125rem; font-weight: bold;">切换项目：</span>
        <el-select
          v-model="localProjectId"
          placeholder="请选择已签订项目"
          size="small"
          style="width: 250px;"
          @change="handleProjectChange"
        >
          <el-option
            v-for="item in signedProjects"
            :key="item.id"
            :label="`${item.code} ${item.name}`"
            :value="item.id"
          />
        </el-select>
      </div>
    </div>

    <div v-if="project">
      <!-- 预算关联控制 -->
      <div style="margin-bottom: 15px; padding: 12px; background: var(--cost-surface-panel-soft); border-radius: 6px; border: 1px solid var(--cost-border-soft); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 0.8125rem; font-weight: bold; color: var(--cost-text-title);">关联预算测算文件：</span>
          <el-select
            v-model="localBudgetFileId"
            placeholder="请选择关联预算测算文件"
            size="small"
            clearable
            style="width: 220px;"
            @change="handleBudgetFileAssociationChange"
          >
            <el-option
              v-for="file in budgetFiles"
              :key="file.id"
              :label="file.name"
              :value="file.id"
            />
          </el-select>
          <span style="font-size: 0.75rem; color: var(--cost-text-muted);">
            * 关联后，预算测算清单的内容将自动同步为该项目的前期预算。
          </span>
        </div>
      </div>

      <!-- 成本指标卡 -->
      <div class="pd-cost-metrics">
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">合同金额</span>
          <strong>{{ RMB_SYMBOL }}{{ formatAmount(summary.contractAmount) }}</strong>
        </div>
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">累计结算</span>
          <strong>{{ RMB_SYMBOL }}{{ formatAmount(summary.settledAmount) }}</strong>
        </div>
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">预算成本</span>
          <strong>{{ RMB_SYMBOL }}{{ formatAmount(budgetCost) }}</strong>
        </div>
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">实际成本支出</span>
          <strong>{{ RMB_SYMBOL }}{{ formatAmount(actualCost) }}</strong>
        </div>
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">成本差异</span>
          <strong :class="getVarianceClass(costVariance)">
            {{ formatSignedAmount(costVariance) }}
          </strong>
        </div>
        <div class="pd-cost-metric">
          <span class="pd-cost-metric-label">核算毛利率</span>
          <strong :class="actualProfit >= 0 ? 'pd-cost-positive' : 'pd-cost-negative'">
            {{ formatRatio(actualMarginRate) }}
          </strong>
        </div>
      </div>

      <el-tabs v-model="activePhase" class="pd-cost-tabs">
        <el-tab-pane name="actual" :label="`实际成本支出 (${actualRows.length})`" />
        <el-tab-pane name="budget" :label="`预算测算清单 (${associatedBoqItems.length})`" />
      </el-tabs>

      <!-- 工具栏 -->
      <div class="pd-toolbar pd-cost-toolbar">
        <div class="pd-toolbar-group">
          <span class="pd-toolbar-title">{{ phaseTitle }}</span>
        </div>
        <div v-if="activePhase === 'actual'" class="pd-toolbar-group">
          <el-button size="small" @click="$emit('add-row', 'actual')">
            <template #icon><Plus /></template>添加费用支出
          </el-button>
          <el-button type="primary" size="small" :loading="actualSaving" @click="$emit('save', 'actual')">
            <template #icon><Check /></template>保存台账
          </el-button>
        </div>
      </div>

      <!-- 分类支出条 (仅在实际成本支出页签显示) -->
      <div v-if="activePhase === 'actual'" class="pd-cost-breakdown">
        <span v-for="item in activeBreakdown" :key="item.category" class="pd-cost-breakdown-item">
          <span>{{ item.label }}</span>
          <strong>{{ RMB_SYMBOL }}{{ formatAmount(item.amount) }}</strong>
        </span>
      </div>

      <!-- 实际支出表格 -->
      <div v-if="activePhase === 'actual'">
        <el-table
          v-if="actualRows.length > 0"
          :data="actualRows"
          border
          size="small"
          show-summary
          :summary-method="buildCostSummary"
          class="pd-cost-table"
        >
          <el-table-column label="类别" prop="category" width="110">
            <template #default="{ row }">
              <el-select v-model="row.category" size="small">
                <el-option
                  v-for="option in categoryOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="成本项目" prop="itemName" min-width="180">
            <template #default="{ row }">
              <el-select
                v-model="row.itemName"
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入成本项目"
                size="small"
                style="width: 100%"
                @change="(val) => handleItemNameChange(row, val)"
              >
                <el-option
                  v-for="item in getFilteredResources(row.category)"
                  :key="item.id"
                  :label="item.name"
                  :value="item.name"
                >
                  <span style="float: left">{{ item.name }}</span>
                  <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px;">
                    {{ item.spec ? `${item.spec} | ` : '' }}{{ getResourcePrice(item) }}元/{{ item.unit }}
                  </span>
                </el-option>
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="规格/说明" prop="spec" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.spec" size="small" placeholder="型号、部位等" />
            </template>
          </el-table-column>
          <el-table-column label="单位" prop="unit" width="90">
            <template #default="{ row }">
              <el-input v-model="row.unit" size="small" placeholder="t" />
            </template>
          </el-table-column>
          <el-table-column label="数量" prop="quantity" width="130" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                size="small"
                :controls="false"
                :precision="3"
                class="pd-field-quantity"
                @change="$emit('recalculate-row', row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价" prop="unitCost" width="130" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitCost"
                size="small"
                :controls="false"
                :precision="3"
                class="pd-field-price"
                @change="$emit('recalculate-row', row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="金额" prop="amount" width="140" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.amount"
                size="small"
                :controls="false"
                :precision="3"
                class="pd-field-price"
              />
            </template>
          </el-table-column>
          <el-table-column label="日期" prop="occurredOn" width="150">
            <template #default="{ row }">
              <el-date-picker
                v-model="row.occurredOn"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                class="pd-field-full"
              />
            </template>
          </el-table-column>
          <el-table-column label="备注" prop="note" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.note" size="small" placeholder="来源、依据" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="$emit('remove-row', 'actual', $index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无实际成本支出，请点击上方“添加费用支出”进行记账。" :image-size="70" />
      </div>

      <!-- 只读预算清单表格 -->
      <div v-else>
        <el-table
          v-if="associatedBoqItems.length > 0"
          :data="associatedBoqItems"
          border
          size="small"
          show-summary
          :summary-method="buildBudgetSummary"
          class="pd-cost-table"
        >
          <el-table-column label="清单编码" prop="itemCode" width="120" />
          <el-table-column label="清单名称" prop="itemName" min-width="220" />
          <el-table-column label="组价模式" prop="pricingMode" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.pricingMode === 'quota' ? 'primary' : 'success'" size="small">
                {{ row.pricingMode === 'quota' ? '定额测算' : '自由组价' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="关联定额" prop="linkedQuotaId" min-width="180">
            <template #default="{ row }">
              <span>{{ getQuotaName(row.linkedQuotaId) || '无' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="单位" prop="unit" width="90" align="center" />
          <el-table-column label="工程量" prop="quantity" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.quantity, 2) }}</template>
          </el-table-column>
          <el-table-column label="测算综合单价" prop="unitPrice" width="130" align="right">
            <template #default="{ row }">
              <span style="font-weight: 700; color: var(--price-primary);">{{ formatAmount(row.unitPrice, 2) }}</span> 元
            </template>
          </el-table-column>
          <el-table-column label="预算合价" prop="total" width="140" align="right">
            <template #default="{ row }">{{ formatAmount(row.total, 2) }} 元</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无关联的前期预算，请在上方选择测算文件进行关联。" :image-size="70" />
      </div>
    </div>
    <div v-else style="padding: 60px 0;">
      <el-empty description="请在右上方选择已签订的项目以查看或记录成本台账。" :image-size="100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Delete, Plus } from '@element-plus/icons-vue'
import type { TableColumnCtx } from 'element-plus'
import {
  type CostCategory,
  type CostPhase,
  type ProjectCostEntry,
  type ProjectCostManagementSummary,
} from '@/services/costing.service'
import { formatAmount, formatRatio, RMB_SYMBOL } from '@/utils/calculations'
import type { Project } from '@/types'
import type { BudgetFile } from '@/services/budget-file.service'
import type { QuotaItem } from '@/views/costs/useCostManagement'
import type { PriceResourceItem } from '@/types/price-library.types'

const props = defineProps<{
  project: Project | null
  signedProjects: Project[]
  budgetFiles: BudgetFile[]
  associatedBoqItems: any[]
  actualRows: ProjectCostEntry[]
  summary: ProjectCostManagementSummary
  actualSaving: boolean
  quotaItems?: QuotaItem[]
  priceResourceItems?: PriceResourceItem[]
  selectedQuoteMap?: Record<string, string>
}>()

function getFilteredResources(category: CostCategory): PriceResourceItem[] {
  if (!props.priceResourceItems) return []
  if (category === 'labor') {
    return props.priceResourceItems.filter(item => item.category === 'labor')
  }
  if (category === 'material') {
    return props.priceResourceItems.filter(item => item.category === 'material' || item.category === 'finished')
  }
  if (category === 'machine') {
    return props.priceResourceItems.filter(item => item.category === 'machine')
  }
  if (category === 'other') {
    return props.priceResourceItems.filter(item => item.category === 'transport')
  }
  return props.priceResourceItems
}

function getResourcePrice(item: PriceResourceItem): number {
  if (!item.quotes || item.quotes.length === 0) return 0
  const quoteId = props.selectedQuoteMap?.[item.id]
  const quote = item.quotes.find(q => q.id === quoteId)
  return quote ? quote.price : item.quotes[0].price
}

function handleItemNameChange(row: ProjectCostEntry, name: string) {
  const resource = props.priceResourceItems?.find(r => r.name === name)
  if (resource) {
    row.spec = resource.spec
    row.unit = resource.unit
    row.unitCost = getResourcePrice(resource)
    emit('recalculate-row', row)
  }
}

const emit = defineEmits<{
  (e: 'select-project', projectId: number): void
  (e: 'associate-budget', projectId: number, budgetFileId: number | null): void
  (e: 'add-row', phase: CostPhase): void
  (e: 'remove-row', phase: CostPhase, index: number): void
  (e: 'recalculate-row', row: ProjectCostEntry): void
  (e: 'save', phase: CostPhase): void
}>()

const activePhase = ref<CostPhase>('actual')

const localProjectId = ref<number | null>(null)
const localBudgetFileId = ref<number | null>(null)

watch(
  () => props.project,
  (newProj) => {
    localProjectId.value = newProj ? newProj.id : null
    localBudgetFileId.value = newProj ? newProj.budgetFileId || null : null
  },
  { immediate: true }
)

function handleProjectChange(val: number) {
  emit('select-project', val)
}

function handleBudgetFileAssociationChange(val: number | null) {
  if (props.project) {
    emit('associate-budget', props.project.id, val)
  }
}

function statusText(status: string) {
  const map: Record<string, string> = {
    preparing: '意向/未签约',
    in_progress: '施工中',
    settling: '结算中',
    completed: '已完工'
  }
  return map[status] || status
}

function getQuotaName(id?: string): string {
  if (!id) return ''
  const item = props.quotaItems?.find(q => q.id === id)
  return item ? `${item.code} ${item.name}` : id
}

// Recalculated reactive metrics
const budgetCost = computed(() => {
  return props.associatedBoqItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
})

const actualCost = computed(() => {
  return props.actualRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
})

const costVariance = computed(() => {
  return actualCost.value - budgetCost.value
})

const actualProfit = computed(() => {
  return Number(props.summary.settledAmount || 0) - actualCost.value
})

const actualMarginRate = computed(() => {
  const settled = Number(props.summary.settledAmount || 0)
  if (settled <= 0) return 0
  return actualProfit.value / settled
})

const categoryOptions: Array<{ label: string; value: CostCategory }> = [
  { label: '人工', value: 'labor' },
  { label: '材料', value: 'material' },
  { label: '机械', value: 'machine' },
  { label: '其他', value: 'other' },
]

const phaseTitle = computed(() => activePhase.value === 'budget' ? '前期预算测算清单' : '完工实际成本支出')
const activeTotals = computed(() => props.summary.actualTotals)
const activeBreakdown = computed(() => categoryOptions.map(option => ({
  category: option.value,
  label: option.label,
  amount: activeTotals.value[option.value],
})))

function formatSignedAmount(amount: number): string {
  const safeAmount = Number(amount || 0)
  const prefix = safeAmount > 0 ? '+' : safeAmount < 0 ? '-' : ''
  return `${prefix}${RMB_SYMBOL}${formatAmount(Math.abs(safeAmount))}`
}

function getVarianceClass(amount: number): string {
  if (amount > 0) return 'pd-cost-negative'
  if (amount < 0) return 'pd-cost-positive'
  return ''
}

function buildCostSummary(param: {
  columns: Array<TableColumnCtx<ProjectCostEntry>>
  data: ProjectCostEntry[]
}): string[] {
  return param.columns.map((column, index) => {
    if (index === 0) return '合计'
    if (column.property === 'amount') {
      const total = param.data.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      return formatAmount(total)
    }
    return ''
  })
}

function buildBudgetSummary(param: {
  columns: Array<TableColumnCtx<any>>
  data: any[]
}): string[] {
  return param.columns.map((column, index) => {
    if (index === 0) return '合计'
    if (column.property === 'total') {
      const total = param.data.reduce((sum, row) => sum + Number(row.total || 0), 0)
      return formatAmount(total)
    }
    return ''
  })
}
</script>
