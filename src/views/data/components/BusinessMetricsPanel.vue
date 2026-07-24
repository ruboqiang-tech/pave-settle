<template>
  <section class="dc-panel">
    <div class="dc-section-header">
      <div class="dc-header-block">
        <div class="dc-inline-icon">
          <Grid class="w-5 h-5" />
        </div>
        <div class="dc-header-stack">
          <h3 class="dc-section-heading">业务数据库规模统计</h3>
          <p class="dc-section-desc">当前活跃主库中物理实体的业务规模概览</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <div class="metric-block dc-info-card metric-tone-indigo">
        <div class="metric-header">
          <span>项目总数</span>
          <span class="metric-icon"><Folder class="w-4 h-4" /></span>
        </div>
        <div class="metric-value mt-2">{{ summary.projects }} <span class="unit">个</span></div>
      </div>

      <div class="metric-block dc-info-card metric-tone-primary">
        <div class="metric-header">
          <span>合同总数</span>
          <span class="metric-icon"><Document class="w-4 h-4" /></span>
        </div>
        <div class="metric-value mt-2">{{ summary.contracts }} <span class="unit">份</span></div>
      </div>

      <div class="metric-block dc-info-card metric-tone-success">
        <div class="metric-header">
          <span>清单条目</span>
          <span class="metric-icon"><Grid class="w-4 h-4" /></span>
        </div>
        <div class="metric-value mt-2">{{ summary.boqItems }} <span class="unit">条</span></div>
      </div>

      <div class="metric-block dc-info-card metric-tone-warning">
        <div class="metric-header">
          <span>结算 / 收款</span>
          <span class="metric-icon"><Check class="w-4 h-4" /></span>
        </div>
        <div class="metric-value mt-2">{{ summary.confirmedSettlements }} / {{ summary.payments }} <span class="unit">笔</span></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Check, Document, Folder, Grid } from '@element-plus/icons-vue'
import type { DataSummary } from '@/services/integrity.service'

defineProps<{
  summary: DataSummary
}>()
</script>
