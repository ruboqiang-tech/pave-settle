<template>
  <div class="page-theme project-list-page pj-page">
    <section class="pj-filter-card">
      <div class="pj-filter-shell">
        <div class="pj-filter-form">
          <el-input
            v-model="searchQuery"
            placeholder="搜索项目名称、编号、业主或总包"
            clearable
            size="small"
            class="pj-filter-search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterStatus" placeholder="项目状态" clearable size="small" class="pj-filter-select pj-filter-select--compact">
            <el-option v-for="option in projectStatusOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-select v-model="filterType" placeholder="工程类型" clearable size="small" class="pj-filter-select pj-filter-select--compact">
            <el-option v-for="option in projectTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-button v-if="hasActiveFilters" size="small" @click="resetFilters">清空筛选</el-button>
        </div>

        <div class="pj-filter-actions">
          <el-button type="primary" size="small" :icon="Plus" @click="openCreateDialog">新建项目</el-button>
        </div>
      </div>

      <div class="pj-summary-row">
        <el-tag size="small" effect="plain">{{ projectSummary.totalCount }} 个项目</el-tag>
        <el-tag size="small" type="info" effect="plain">准备 {{ projectSummary.preparingCount }}</el-tag>
        <el-tag size="small" effect="plain">施工 {{ projectSummary.inProgressCount }}</el-tag>
        <el-tag size="small" type="warning" effect="plain">结算 {{ projectSummary.settlingCount }}</el-tag>
        <el-tag size="small" type="success" effect="plain">完工 {{ projectSummary.completedCount }}</el-tag>
        <el-tag size="small" effect="plain">合同 {{ formatCurrency(projectSummary.contractAmount) }}</el-tag>
        <el-tag size="small" type="primary" effect="plain">结算 {{ formatCurrency(projectSummary.settledAmount) }}</el-tag>
        <el-tag size="small" type="success" effect="plain">已收 {{ formatCurrency(projectSummary.receivedAmount) }}</el-tag>
        <el-tag size="small" type="info" effect="plain">待收 {{ formatCurrency(projectSummary.unreceivedAmount) }}</el-tag>
      </div>
    </section>

    <section v-if="filteredProjectRows.length > 0" class="pj-card-grid">
      <article
        v-for="project in filteredProjectRows"
        :key="project.id"
        class="pj-card"
        @click="viewProject(project.id)"
      >
        <div class="pj-card-head">
          <div class="pj-card-copy">
            <div class="pj-card-title-row">
              <h2 class="pj-card-title">{{ project.name }}</h2>
              <el-tag size="small" effect="plain">{{ projectTypeTextMap[project.projectType] }}</el-tag>
              <el-tag size="small" :type="getDifficultyTagType(project.difficulty)" style="margin-left: 4px;">{{ getDifficultyText(project.difficulty) }}</el-tag>
              <el-tag size="small" :type="getScaleTagType(project.contractAmount)" style="margin-left: 4px;">{{ getScaleText(project.contractAmount) }}</el-tag>
            </div>
            <p class="pj-card-code">{{ project.code }}</p>
          </div>
          <el-tag :type="projectStatusTypeMap[project.status]" size="small">{{ projectStatusTextMap[project.status] }}</el-tag>
        </div>

        <div class="pj-meta-list">
          <div class="pj-meta-row">
            <el-icon class="pj-meta-icon"><Location /></el-icon>
            <span class="pj-meta-text">{{ project.location || '未填写项目地点' }}</span>
          </div>
          <div class="pj-meta-row pj-meta-row--top">
            <el-icon class="pj-meta-icon pj-meta-icon--offset"><OfficeBuilding /></el-icon>
            <div class="pj-meta-stack">
              <p class="pj-meta-text">总包：{{ project.generalContractor || '-' }}</p>
              <p class="pj-meta-text">业主：{{ project.ownerUnit || '-' }}</p>
            </div>
          </div>
          <div class="pj-meta-row">
            <el-icon class="pj-meta-icon"><Calendar /></el-icon>
            <span>开工 {{ project.startDate || '-' }} · 计划完工 {{ project.plannedEndDate || '-' }}</span>
          </div>
        </div>

        <div class="pj-metric-panel">
          <div class="pj-metric-head">
            <span class="pj-metric-label">结算进度</span>
            <span class="pj-value-primary pj-value-strong">{{ formatProgressRatio(project.settlementRatio, 1) }}</span>
          </div>
          <el-progress
            class="pj-progress"
            :percentage="clampProgressPercentage(project.settlementRatio)"
            :show-text="false"
            :stroke-width="8"
            :color="'#0ea5e9'"
          />

          <div class="pj-stat-grid">
            <div>
              <p class="pj-stat-label">合同金额</p>
              <p class="pj-stat-value">{{ formatCurrency(project.contractAmount) }}</p>
            </div>
            <div>
              <p class="pj-stat-label">结算金额</p>
              <p class="pj-stat-value pj-value-primary">{{ formatCurrency(project.settledAmount) }}</p>
            </div>
            <div>
              <p class="pj-stat-label">已收金额</p>
              <p class="pj-stat-value pj-value-success">{{ formatCurrency(project.receivedAmount) }}</p>
            </div>
            <div>
              <p class="pj-stat-label">待收金额</p>
              <p class="pj-stat-value pj-value-neutral">{{ formatCurrency(project.unreceivedAmount) }}</p>
            </div>
          </div>
        </div>

        <div class="pj-card-actions">
          <el-button link type="primary" size="small" @click.stop="viewProject(project.id)">查看详情</el-button>
          <div class="pj-action-row">
            <el-button link type="primary" size="small" @click.stop="openEditDialog(project)">编辑</el-button>
            <el-popconfirm title="确认删除该项目？关联的合同、结算、收款和发票记录会一并删除。" @confirm="handleDelete(project.id)">
              <template #reference>
                <el-button link type="danger" size="small" @click.stop>删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </article>
    </section>

    <el-empty v-else description="暂无符合条件的项目" :image-size="80">
      <el-button type="primary" size="small" @click="openCreateDialog">新建项目</el-button>
    </el-empty>

    <el-dialog v-model="showDialog" :title="dialogTitle" width="620px" destroy-on-close @closed="resetForm">
      <el-form ref="projectFormRef" :model="projectForm" :rules="projectRules" label-width="100px">
        <el-form-item label="项目编号" prop="code">
          <el-input v-model="projectForm.code" placeholder="例如 XM2026001" />
        </el-form-item>
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="projectForm.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="工程类型" prop="projectType">
          <el-radio-group v-model="projectForm.projectType">
            <el-radio v-for="option in projectTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="项目地点">
          <el-input v-model="projectForm.location" placeholder="请输入项目地点" />
        </el-form-item>
        <el-form-item label="业主单位">
          <el-input v-model="projectForm.ownerUnit" placeholder="请输入业主单位" />
        </el-form-item>
        <el-form-item label="总包单位">
          <el-input v-model="projectForm.generalContractor" placeholder="请输入总包单位" />
        </el-form-item>
        <el-form-item label="开工日期" prop="startDate">
          <el-date-picker v-model="projectForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选择开工日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计划完工">
          <el-date-picker v-model="projectForm.plannedEndDate" type="date" value-format="YYYY-MM-DD" placeholder="选择计划完工日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="项目状态" prop="status">
          <el-select v-model="projectForm.status" style="width: 100%">
            <el-option v-for="option in projectStatusOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目难度" prop="difficulty">
          <el-radio-group v-model="projectForm.difficulty">
            <el-radio-button value="easy">简单</el-radio-button>
            <el-radio-button value="medium">中等</el-radio-button>
            <el-radio-button value="hard">困难</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="pj-dialog-footer">
          <el-button @click="showDialog = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import './project-list.css'
import { Calendar, Location, OfficeBuilding, Plus, Search } from '@element-plus/icons-vue'
import { clampProgressPercentage, formatCurrency, formatProgressRatio } from '@/utils/calculations'
import { useProjectList } from './useProjectList'

const {
  searchQuery,
  filterStatus,
  filterType,
  showDialog,
  saving,
  projectFormRef,
  projectForm,
  projectRules,
  dialogTitle,
  projectStatusOptions,
  projectStatusTextMap,
  projectStatusTypeMap,
  projectTypeOptions,
  projectTypeTextMap,
  filteredProjectRows,
  projectSummary,
  hasActiveFilters,
  resetFilters,
  resetForm,
  openCreateDialog,
  openEditDialog,
  handleSave,
  handleDelete,
  viewProject,
  scaleThresholds,
} = useProjectList()

function getDifficultyText(difficulty?: string): string {
  if (difficulty === 'easy') return '简单'
  if (difficulty === 'hard') return '困难'
  return '中等'
}

function getDifficultyTagType(difficulty?: string): 'success' | 'warning' | 'danger' {
  if (difficulty === 'easy') return 'success'
  if (difficulty === 'hard') return 'danger'
  return 'warning'
}

function getScale(contractAmount: number): 'small' | 'medium' | 'large' {
  const small = scaleThresholds.value.small
  const large = scaleThresholds.value.large
  if (contractAmount < small) return 'small'
  if (contractAmount > large) return 'large'
  return 'medium'
}

function getScaleText(contractAmount: number): string {
  const scale = getScale(contractAmount)
  if (scale === 'small') return '小型'
  if (scale === 'large') return '大型'
  return '中型'
}

function getScaleTagType(contractAmount: number): 'info' | 'primary' | 'success' {
  const scale = getScale(contractAmount)
  if (scale === 'small') return 'info'
  if (scale === 'large') return 'success'
  return 'primary'
}
</script>
