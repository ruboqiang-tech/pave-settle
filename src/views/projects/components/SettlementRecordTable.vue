<template>
  <div class="pd-panel">
    <div class="pd-section-head">
      <h2 class="pd-section-title">结算记录</h2>
    </div>
    <el-table v-if="settlements.length > 0" :data="settlements" border size="small" show-summary :summary-method="summaryMethod">
      <el-table-column prop="settlementNo" label="结算单号" width="220" />
      <el-table-column prop="settlementType" label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.settlementType === 'final' ? 'success' : 'primary'" size="small">
            {{ row.settlementType === 'final' ? '最终' : '中期' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="结算期间" width="200">
        <template #default="{ row, $index }">
          <span>{{ row.startDate }} 至 {{ row.endDate }}</span>
          <el-tooltip
            v-if="$index > 0 && settlements[$index - 1].endDate && row.startDate && row.startDate > addOneDay(settlements[$index - 1].endDate)"
            content="与上一期存在时间断层"
            placement="top"
          >
            <el-icon class="pd-warning-icon"><Warning /></el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="currentAmount" label="本期结算" width="140" align="right">
        <template #default="{ row }">
          <span class="pd-amount-strong pd-amount-strong--primary">{{ RMB_SYMBOL }}{{ formatAmount(row.currentAmount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="currentCumulative" label="累计结算" width="140" align="right">
        <template #default="{ row }">{{ RMB_SYMBOL }}{{ formatAmount(row.currentCumulative) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'confirmed' ? undefined : 'info'" size="small">
            {{ row.status === 'approved' ? '已审批' : row.status === 'confirmed' ? '已确认' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="$emit('view', row.id)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无结算记录" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue'
import type { TableColumnCtx } from 'element-plus'
import type { Settlement } from '@/types'
import { formatAmount, RMB_SYMBOL } from '@/utils/calculations'

defineEmits<{
  view: [id: number]
}>()

defineProps<{
  settlements: Settlement[]
  summaryMethod: (param: {
    columns: Array<TableColumnCtx<Settlement>>
    data: Settlement[]
  }) => string[]
}>()

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
</script>
