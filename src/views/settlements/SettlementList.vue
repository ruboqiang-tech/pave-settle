<template>
  <div class="page-theme settlement-list-page sl-page">
    <section class="sl-filter-card">
      <div class="sl-filter-shell">
        <div class="sl-filter-form">
          <el-input
            v-model="searchQuery"
            placeholder="搜索结算单号、项目或合同"
            clearable
            size="small"
            class="sl-filter-search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterStatus" placeholder="结算状态" clearable size="small" class="sl-filter-select sl-filter-select--compact">
            <el-option v-for="option in settlementStatusOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-select v-model="filterType" placeholder="结算类型" clearable size="small" class="sl-filter-select sl-filter-select--compact">
            <el-option v-for="option in settlementTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-select v-model="filterProject" placeholder="所属项目" clearable filterable size="small" class="sl-filter-select">
            <el-option v-for="project in projectOptions" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <el-button v-if="hasActiveFilters" size="small" @click="resetFilters">清空筛选</el-button>
        </div>

        <div class="sl-filter-actions">
          <el-button size="small" :icon="Download" :loading="exporting" @click="handleExport">导出 CSV</el-button>
          <el-button type="primary" size="small" :icon="Plus" @click="showCreateDrawer = true">新建结算</el-button>
        </div>
      </div>

      <div class="sl-summary-row">
        <el-tag size="small" effect="plain">{{ settlementSummary.totalCount }} 张结算单</el-tag>
        <el-tag size="small" type="info" effect="plain">草稿 {{ settlementSummary.draftCount }}</el-tag>
        <el-tag size="small" effect="plain">已生效 {{ settlementSummary.effectiveCount }}</el-tag>
        <el-tag size="small" type="success" effect="plain">已审批 {{ settlementSummary.approvedCount }}</el-tag>
        <el-tag size="small" type="primary" effect="plain">本期结算 {{ formatCurrency(settlementSummary.effectiveAmount) }}</el-tag>
      </div>
    </section>

    <section class="sl-panel">
      <div class="sl-panel-header">
        <div class="sl-panel-head">
          <div>
            <h2 class="sl-panel-title">结算单列表</h2>
            <p class="sl-panel-desc">列表只保留项目、合同、状态和金额主信息，工程量与调整项进入详情页处理。</p>
          </div>
        </div>
      </div>

      <div class="sl-panel-body">
        <el-table v-if="filteredSettlementRows.length > 0" :data="filteredSettlementRows" border size="small" stripe>
          <el-table-column prop="settlementNo" label="结算单号" width="220" />
          <el-table-column prop="projectName" label="项目名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="关联合同" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="sl-contract-cell">
                <span class="sl-contract-text">{{ row.contractNamesText || '-' }}</span>
                <el-tag v-if="row.contractCount > 1" size="small" effect="plain">共 {{ row.contractCount }} 份</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="settlementType" label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.settlementType === 'final' ? 'success' : 'primary'" size="small">
                {{ getSettlementTypeText(row.settlementType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="结算期间" width="220">
            <template #default="{ row }">{{ row.startDate }} 至 {{ row.endDate }}</template>
          </el-table-column>
          <el-table-column prop="currentAmount" label="本期结算" width="150" align="right">
            <template #default="{ row }">
              <span class="sl-value-primary">{{ formatCurrency(row.currentAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="currentCumulative" label="累计结算" width="150" align="right">
            <template #default="{ row }">{{ formatCurrency(row.currentCumulative) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getSettlementStatusType(row.status)" size="small">{{ getSettlementStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewSettlement(row.id)">查看</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="暂无符合条件的结算单" :image-size="70">
          <el-button type="primary" size="small" @click="showCreateDrawer = true">新建结算</el-button>
        </el-empty>
      </div>
    </section>

    <el-drawer v-model="showCreateDrawer" title="新建结算单" size="480px" destroy-on-close @closed="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="96px">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="createForm.projectId" placeholder="请选择项目" filterable style="width: 100%" @change="onProjectChange">
            <el-option v-for="project in projectOptions" :key="project.id" :label="`${project.code} - ${project.name}`" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择合同" prop="contractIds">
          <el-select
            v-model="createForm.contractIds"
            placeholder="请先选择项目"
            filterable
            multiple
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            :disabled="!createForm.projectId"
          >
            <el-option v-for="contract in contractOptions" :key="contract.id" :label="`${contract.contractNo} - ${contract.contractName}`" :value="contract.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算类型" prop="settlementType">
          <el-radio-group v-model="createForm.settlementType">
            <el-radio v-for="option in settlementTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="结算期间" prop="dateRange">
          <el-date-picker
            v-model="createForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="sl-drawer-footer">
          <el-button @click="showCreateDrawer = false">取消</el-button>
          <el-button type="primary" @click="handleCreate">下一步</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import './settlement-list.css'
import { Download, Plus, Search } from '@element-plus/icons-vue'
import { formatCurrency } from '@/utils/calculations'
import { useSettlementList } from './useSettlementList'

const {
  searchQuery,
  filterType,
  filterStatus,
  filterProject,
  showCreateDrawer,
  createFormRef,
  createForm,
  exporting,
  createRules,
  projectOptions,
  contractOptions,
  settlementStatusOptions,
  settlementTypeOptions,
  filteredSettlementRows,
  settlementSummary,
  hasActiveFilters,
  getSettlementTypeText,
  getSettlementStatusText,
  getSettlementStatusType,
  resetFilters,
  resetCreateForm,
  onProjectChange,
  viewSettlement,
  handleCreate,
  handleExport,
  handleDelete,
} = useSettlementList()
</script>
