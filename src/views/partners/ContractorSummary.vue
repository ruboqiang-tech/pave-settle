<template>
  <div class="page-theme contractor-summary-page cs-page">
    <section class="cs-overview-grid">
      <article class="cs-overview-card">
        <div class="cs-overview-head">
          <span class="cs-overview-dot cs-overview-dot--neutral"></span>
          <span>总包单位</span>
        </div>
        <div class="cs-overview-value">{{ overall.totalContractors }}</div>
        <div class="cs-overview-note">覆盖 {{ overall.totalProjects }} 个项目</div>
      </article>

      <article class="cs-overview-card">
        <div class="cs-overview-head">
          <span class="cs-overview-dot cs-overview-dot--primary"></span>
          <span>合同总额</span>
        </div>
        <div class="cs-overview-value">{{ formatCurrency(overall.totalContractAmount) }}</div>
        <div class="cs-overview-note">按总包口径汇总含税合同金额</div>
      </article>

      <article class="cs-overview-card">
        <div class="cs-overview-head">
          <span class="cs-overview-dot cs-overview-dot--success"></span>
          <span>已结算 / 已收款</span>
        </div>
        <div class="cs-overview-value">{{ formatCurrency(overall.totalSettled) }}</div>
        <div class="cs-overview-note">已收 {{ formatCurrency(overall.totalReceived) }}</div>
      </article>

      <article class="cs-overview-card">
        <div class="cs-overview-head">
          <span class="cs-overview-dot cs-overview-dot--danger"></span>
          <span>待收款 / 已开票</span>
        </div>
        <div class="cs-overview-value">{{ formatCurrency(overall.totalUnreceived) }}</div>
        <div class="cs-overview-note">已开票 {{ formatCurrency(overall.totalInvoiced) }}</div>
      </article>
    </section>

    <div class="cs-panel">
      <div class="cs-panel-header">
        <div class="cs-panel-head">
          <div>
            <h2 class="cs-panel-title">总包单位明细</h2>
            <p class="cs-panel-desc">展开后查看各总包单位下项目的合同、结算、收款和开票明细。</p>
          </div>
          <el-button type="primary" :loading="exporting" @click="handleExport">
            <template #icon><Download /></template>
            导出 CSV
          </el-button>
        </div>
      </div>

      <div class="cs-panel-body">
        <el-table
          v-if="contractorRows.length > 0"
          :data="contractorRows"
          border
          size="small"
          stripe
          row-key="contractorName"
          :expand-row-keys="expandedRows"
          @expand-change="handleExpandChange"
          show-summary
          :summary-method="getContractorSummary"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="cs-project-panel">
                <h4 class="cs-project-heading">
                  {{ row.contractorName }} 旗下项目明细（{{ row.projects.length }} 个）
                </h4>
                <el-table :data="row.projects" border size="small" class="nested-table">
                  <el-table-column type="index" label="#" width="45" />
                  <el-table-column label="项目名称" min-width="180" show-overflow-tooltip>
                    <template #default="{ row: proj }">
                      <el-button link type="primary" @click="goProject(proj.projectId)">{{ proj.projectName }}</el-button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="projectCode" label="项目编号" width="120" />
                  <el-table-column prop="status" label="状态" width="80" align="center">
                    <template #default="{ row: proj }">
                      <el-tag :type="getProjectStatusType(proj.status)" size="small">{{ getProjectStatusText(proj.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="contractAmount" label="合同(含税)" width="130" align="right">
                    <template #default="{ row: proj }">{{ formatCurrency(proj.contractAmount) }}</template>
                  </el-table-column>
                  <el-table-column prop="settledAmount" label="已结算" width="130" align="right">
                    <template #default="{ row: proj }"><span class="cs-value-primary">{{ formatCurrency(proj.settledAmount) }}</span></template>
                  </el-table-column>
                  <el-table-column prop="receivedAmount" label="已收款" width="130" align="right">
                    <template #default="{ row: proj }"><span class="cs-value-success">{{ formatCurrency(proj.receivedAmount) }}</span></template>
                  </el-table-column>
                  <el-table-column prop="unreceivedAmount" label="待收款" width="130" align="right">
                    <template #default="{ row: proj }"><span class="cs-value-neutral">{{ formatCurrency(proj.unreceivedAmount) }}</span></template>
                  </el-table-column>
                  <el-table-column prop="invoicedAmount" label="已开票" width="130" align="right">
                    <template #default="{ row: proj }"><span class="cs-value-violet">{{ formatCurrency(proj.invoicedAmount) }}</span></template>
                  </el-table-column>
                  <el-table-column label="结算进度" width="100" align="center">
                    <template #default="{ row: proj }">
                      <el-progress
                        :percentage="clampProgressPercentage(Number(proj.settlementRatio))"
                        :stroke-width="8"
                        :color="'#409EFF'"
                        :format="() => formatProgressRatio(Number(proj.settlementRatio))"
                      />
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="contractorName" label="总包单位" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="cs-contractor-cell">
                <span class="cs-contractor-name">{{ row.contractorName }}</span>
                <span class="cs-contractor-note">覆盖 {{ row.projectCount }} 个项目</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="projectCount" label="项目数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" round>{{ row.projectCount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="contractAmount" label="合同总额(含税)" width="150" align="right">
            <template #default="{ row }">{{ formatCurrency(row.contractAmount) }}</template>
          </el-table-column>
          <el-table-column prop="settledAmount" label="已结算" width="140" align="right">
            <template #default="{ row }"><span class="cs-value-primary">{{ formatCurrency(row.settledAmount) }}</span></template>
          </el-table-column>
          <el-table-column prop="receivedAmount" label="已收款" width="140" align="right">
            <template #default="{ row }"><span class="cs-value-success">{{ formatCurrency(row.receivedAmount) }}</span></template>
          </el-table-column>
          <el-table-column prop="unreceivedAmount" label="待收款" width="140" align="right">
            <template #default="{ row }"><span class="cs-value-neutral">{{ formatCurrency(row.unreceivedAmount) }}</span></template>
          </el-table-column>
          <el-table-column prop="invoicedAmount" label="已开票" width="130" align="right">
            <template #default="{ row }"><span class="cs-value-violet">{{ formatCurrency(row.invoicedAmount) }}</span></template>
          </el-table-column>
          <el-table-column label="结算进度" width="110" align="center">
            <template #default="{ row }">
              <el-progress
                :percentage="clampProgressPercentage(Number(row.settlementRatio))"
                :stroke-width="8"
                :color="'#409EFF'"
                :format="() => formatProgressRatio(Number(row.settlementRatio))"
              />
            </template>
          </el-table-column>
          <el-table-column label="收款进度" width="110" align="center">
            <template #default="{ row }">
              <el-progress
                :percentage="clampProgressPercentage(Number(row.receiveRatio))"
                :stroke-width="8"
                :color="'#67C23A'"
                :format="() => formatProgressRatio(Number(row.receiveRatio))"
              />
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="暂无项目数据，请先在项目管理中填写总包单位" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './contractor-summary.css'
import { Download } from '@element-plus/icons-vue'
import { clampProgressPercentage, formatCurrency, formatProgressRatio } from '@/utils/calculations'
import { getProjectStatusText, getProjectStatusType } from '@/utils/format'
import { buildTableSummary, createSummaryFormatters, type TableSummaryParams } from '@/utils/table-summary'
import type { ContractorSummaryRow } from '@/services/analytics.service'
import { useContractorSummary } from './useContractorSummary'

const getContractorSummary = (param: TableSummaryParams<ContractorSummaryRow>) => {
  return buildTableSummary(param, {
    formatters: {
      projectCount: total => String(total),
      ...createSummaryFormatters<ContractorSummaryRow>(
        ['contractAmount', 'settledAmount', 'receivedAmount', 'unreceivedAmount', 'invoicedAmount'],
        total => formatCurrency(total),
      ),
    },
  })
}

const {
  expandedRows,
  exporting,
  contractorRows,
  overall,
  handleExpandChange,
  goProject,
  handleExport,
} = useContractorSummary()
</script>
