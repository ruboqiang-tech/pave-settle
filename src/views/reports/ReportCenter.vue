<template>
  <div class="page-theme report-center-page rc-page">
    <section class="rc-filter-card">
      <div class="rc-filter-shell">
        <div class="rc-filter-head">
          <el-button
            v-for="option in reportOptions"
            :key="option.value"
            size="small"
            :type="reportType === option.value ? 'primary' : undefined"
            :plain="reportType !== option.value"
            @click="reportType = option.value"
          >
            {{ option.label }}
          </el-button>
          <el-tag size="small" effect="plain">{{ reportMeta.highlight }}</el-tag>
        </div>

        <div class="rc-filter-actions">
          <el-select v-model="filterProjectId" placeholder="全部项目" clearable filterable size="small" class="rc-filter-select">
            <el-option v-for="project in snapshot.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <el-button type="primary" size="small" :loading="exporting" @click="handleExport">
            <template #icon><Download /></template>
            导出 CSV
          </el-button>
        </div>
      </div>

      <div class="rc-filter-note">{{ reportMeta.description }}</div>
    </section>

    <section class="rc-highlight-grid">
      <article
        v-for="card in reportHighlightCards"
        :key="card.label"
        class="rc-highlight-card"
      >
        <div class="rc-highlight-head">
          <span class="rc-highlight-dot" :class="card.dotClass"></span>
          <span>{{ card.label }}</span>
        </div>
        <div class="rc-highlight-value">{{ card.value }}</div>
        <div class="rc-highlight-note">{{ card.note }}</div>
      </article>
    </section>

    <div v-if="reportType === 'project_summary'" class="rc-panel">
      <div class="rc-panel-copy">
        <h3 class="rc-panel-title">项目汇总表</h3>
        <p class="rc-panel-desc">按项目查看合同参考额、已结算与参考未结算余额的统一口径。</p>
      </div>

      <el-table :data="projectSummary" border size="small" show-summary :summary-method="getProjectSummary">
        <el-table-column prop="projectCode" label="项目编号" width="120" />
        <el-table-column prop="projectName" label="项目名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="projectType" label="工程类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.projectType === 'highway' ? 'primary' : 'success'" size="small">
              {{ row.projectType === 'highway' ? '公路' : '市政' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="项目状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getProjectStatusType(row.status)" size="small">{{ getProjectStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="noTaxContractAmount" label="合同不含税价" width="150" align="right">
          <template #default="{ row }">{{ formatCurrency(row.noTaxContractAmount) }}</template>
        </el-table-column>
        <el-table-column prop="contractTaxAmount" label="合同税额" width="130" align="right">
          <template #default="{ row }">{{ formatCurrency(row.contractTaxAmount) }}</template>
        </el-table-column>
        <el-table-column prop="contractAmount" label="合同含税价" width="150" align="right">
          <template #default="{ row }">{{ formatCurrency(row.contractAmount) }}</template>
        </el-table-column>
        <el-table-column prop="settledAmount" label="已结算(含税)" width="150" align="right">
          <template #default="{ row }"><span class="rc-value-strong">{{ formatCurrency(row.settledAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="settlementRatio" label="结算比例(参考)" width="120" align="center">
          <template #default="{ row }">
            <span class="rc-value-primary">{{ formatProgressRatio(Number(row.settlementRatio)) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="unsettledAmount" label="参考未结算(含税)" width="170" align="right">
          <template #default="{ row }">{{ formatCurrency(row.unsettledAmount) }}</template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="reportType === 'settlement_detail'" class="rc-panel">
      <div class="rc-panel-copy">
        <h3 class="rc-panel-title">结算明细表</h3>
        <p class="rc-panel-desc">拆开查看每一笔结算的清单金额、调整项和最终本期金额。</p>
      </div>

      <el-table :data="settlementDetails" border size="small" show-summary :summary-method="getSettlementSummary">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="settlementNo" label="结算单号" width="220" />
        <el-table-column prop="projectName" label="项目名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="settlementType" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.settlementType === 'final' ? 'success' : 'primary'" size="small">
              {{ row.settlementType === 'final' ? '最终' : '中期' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结算期间" width="200">
          <template #default="{ row }">{{ row.startDate }} 至 {{ row.endDate }}</template>
        </el-table-column>
        <el-table-column prop="baseAmount" label="清单金额(含税)" width="140" align="right">
          <template #default="{ row }">{{ formatCurrency(row.baseAmount) }}</template>
        </el-table-column>
        <el-table-column prop="adjustment" label="调差/签证/措施费" width="150" align="right">
          <template #default="{ row }">
            <span :class="row.adjustment >= 0 ? 'rc-value-success' : 'rc-value-danger'">
              {{ row.adjustment >= 0 ? '+' : '' }}{{ formatCurrency(row.adjustment) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="deductionAmount" label="扣款" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.deductionAmount > 0" class="rc-value-danger">-{{ formatCurrency(row.deductionAmount) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="currentAmount" label="本期结算(含税)" width="150" align="right">
          <template #default="{ row }"><span class="rc-value-primary rc-value-strong">{{ formatCurrency(row.currentAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'confirmed' ? undefined : row.status === 'approved' ? 'success' : 'info'" size="small">
              {{ row.status === 'confirmed' ? '已确认' : row.status === 'approved' ? '已审批' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="reportType === 'receivable'" class="rc-panel">
      <div class="rc-panel-copy">
        <h3 class="rc-panel-title">应收款统计</h3>
        <p class="rc-panel-desc">把结算、收款、开票三条线放在同一张表里核对。</p>
      </div>

      <el-table :data="receivableList" border size="small" show-summary :summary-method="getReceivableSummary">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="projectName" label="项目名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="noTaxContractAmount" label="合同不含税价" width="140" align="right">
          <template #default="{ row }">{{ formatCurrency(row.noTaxContractAmount) }}</template>
        </el-table-column>
        <el-table-column prop="contractTaxAmount" label="合同税额" width="130" align="right">
          <template #default="{ row }">{{ formatCurrency(row.contractTaxAmount) }}</template>
        </el-table-column>
        <el-table-column prop="contractAmount" label="合同含税价" width="140" align="right">
          <template #default="{ row }">{{ formatCurrency(row.contractAmount) }}</template>
        </el-table-column>
        <el-table-column prop="settledAmount" label="已结算(含税)" width="130" align="right">
          <template #default="{ row }"><span class="rc-value-primary">{{ formatCurrency(row.settledAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="receivedAmount" label="已收款(含税)" width="130" align="right">
          <template #default="{ row }"><span class="rc-value-success">{{ formatCurrency(row.receivedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="unreceivedAmount" label="待收款(含税)" width="130" align="right">
          <template #default="{ row }"><span class="rc-value-neutral">{{ formatCurrency(row.unreceivedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="invoicedAmount" label="已开票" width="130" align="right">
          <template #default="{ row }"><span class="rc-value-warning">{{ formatCurrency(row.invoicedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="invoiceGap" label="待开票参考" width="130" align="right">
          <template #default="{ row }">
            <span class="rc-value-muted">{{ formatCurrency(row.invoiceGap) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结算进度" width="120" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="clampProgressPercentage(Number(row.settleRatio))"
              :color="'#409EFF'"
              :format="() => formatProgressRatio(Number(row.settleRatio))"
              :stroke-width="8"
            />
          </template>
        </el-table-column>
        <el-table-column label="收款进度" width="120" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="clampProgressPercentage(Number(row.receiveRatio))"
              :color="'#67C23A'"
              :format="() => formatProgressRatio(Number(row.receiveRatio))"
              :stroke-width="8"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import './report-center.css'
import { Download } from '@element-plus/icons-vue'
import { clampProgressPercentage, formatCurrency, formatProgressRatio } from '@/utils/calculations'
import { getProjectStatusText, getProjectStatusType } from '@/utils/format'
import { useReportCenter } from './useReportCenter'

const {
  reportType,
  filterProjectId,
  snapshot,
  exporting,
  projectSummary,
  settlementDetails,
  receivableList,
  reportOptions,
  reportMeta,
  reportHighlightCards,
  getProjectSummary,
  getSettlementSummary,
  getReceivableSummary,
  handleExport,
} = useReportCenter()
</script>
