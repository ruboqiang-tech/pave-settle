<template>
  <div class="page-theme dashboard-page dash-page">
    <section class="dash-stat-grid">
      <article class="dash-stat-card">
        <div class="dash-stat-head">
          <div class="dash-stat-copy">
            <p class="dash-stat-label">项目总览</p>
            <p class="dash-stat-value">{{ stats.totalProjects }}</p>
          </div>
          <div class="dash-stat-icon dash-stat-icon--sky">
            <el-icon class="dash-stat-icon-glyph"><OfficeBuilding /></el-icon>
          </div>
        </div>
        <p class="dash-stat-note">
          进行中 {{ stats.inProgressProjects }} / 结算中 {{ stats.settlingProjects }} / 已完工 {{ stats.completedProjects }}
        </p>
      </article>

      <article class="dash-stat-card">
        <div class="dash-stat-head">
          <div class="dash-stat-copy">
            <p class="dash-stat-label">合同金额</p>
            <p class="dash-stat-value">{{ formatCompactCurrency(stats.totalContractAmount) }}</p>
          </div>
          <div class="dash-stat-icon dash-stat-icon--emerald">
            <el-icon class="dash-stat-icon-glyph"><Document /></el-icon>
          </div>
        </div>
        <p class="dash-stat-note">
          累计已结算 <span class="dash-inline-value dash-inline-value--success">{{ formatCompactCurrency(stats.totalSettledAmount) }}</span>
        </p>
      </article>

      <article class="dash-stat-card">
        <div class="dash-stat-head">
          <div class="dash-stat-copy">
            <p class="dash-stat-label">{{ currentPeriodTitle }}</p>
            <p class="dash-stat-value">{{ formatCompactCurrency(currentPeriodSettlement) }}</p>
          </div>
          <div class="dash-stat-icon dash-stat-icon--amber">
            <el-icon class="dash-stat-icon-glyph"><Money /></el-icon>
          </div>
        </div>
        <p class="dash-stat-note">累计结算 {{ stats.totalSettlements }} 笔</p>
      </article>

      <article class="dash-stat-card">
        <div class="dash-stat-head">
          <div class="dash-stat-copy">
            <p class="dash-stat-label">收款概况</p>
            <p class="dash-stat-value dash-stat-value--success">{{ formatCompactCurrency(stats.totalReceived) }}</p>
          </div>
          <div class="dash-stat-icon dash-stat-icon--teal">
            <el-icon class="dash-stat-icon-glyph"><Wallet /></el-icon>
          </div>
        </div>
        <p class="dash-stat-note">
          待收款 <span class="dash-inline-value dash-inline-value--neutral">{{ formatCompactCurrency(stats.totalUnreceived) }}</span>
        </p>
      </article>
    </section>

    <section class="dash-analytics-grid">
      <div class="dash-panel">
        <div class="dash-panel-copy">
          <h3 class="dash-panel-title">各项目收款进度</h3>
          <p class="dash-panel-desc">按已结算对比已收款，更直观看各项目回款情况。</p>
        </div>
        <div class="dash-panel-body">
          <SettlementProgressChart :projects="chartProjectData" />
        </div>
      </div>

      <div class="dash-panel">
        <div class="dash-trend-shell">
          <div class="dash-trend-top">
            <div>
              <h3 class="dash-panel-title">结算 / 收款趋势</h3>
              <p class="dash-panel-desc">按年或按月查看，并通过跨度切换观察区间变化。</p>
            </div>
            <div class="dash-control-row">
              <el-radio-group v-model="trendGranularity" size="small">
                <el-radio-button value="month">按月</el-radio-button>
                <el-radio-button value="year">按年</el-radio-button>
              </el-radio-group>
              <el-select v-model="selectedTrendSpan" size="small" class="dash-span-select">
                <el-option
                  v-for="option in trendSpanOptions"
                  :key="option"
                  :label="trendGranularity === 'month' ? `近 ${option} 个月` : `近 ${option} 年`"
                  :value="option"
                />
              </el-select>
            </div>
          </div>

          <div class="dash-mini-grid">
            <div class="dash-mini-card">
              <div class="dash-mini-head">
                <span class="dash-mini-dot dash-mini-dot--primary"></span>
                <span>{{ trendSummaryLabel }}结算总额</span>
              </div>
              <div class="dash-mini-value">{{ formatCurrency(trendSettlementTotal) }}</div>
            </div>
            <div class="dash-mini-card">
              <div class="dash-mini-head">
                <span class="dash-mini-dot dash-mini-dot--success"></span>
                <span>{{ trendSummaryLabel }}收款总额</span>
              </div>
              <div class="dash-mini-value">{{ formatCurrency(trendReceivedTotal) }}</div>
            </div>
          </div>

          <div class="dash-panel-body">
            <PaymentTrendChart
              :labels="trendDisplayLabels"
              :settlement-amounts="trendSettlementAmounts"
              :received-amounts="trendReceivedAmounts"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="dash-list-panel">
      <div class="dash-list-header">
        <div>
          <div class="dash-badge dash-badge--primary">重点跟进</div>
          <h3 class="dash-list-title">进行中的项目</h3>
          <p class="dash-list-desc">首页只保留需要持续跟进结算与收款的项目。</p>
        </div>
        <el-link type="primary" @click="goToProjects">查看全部</el-link>
      </div>

      <div class="dash-table-shell">
        <el-table :data="activeProjects" class="dash-table" size="small" stripe>
          <el-table-column prop="name" label="项目名称" min-width="180">
            <template #default="{ row }">
              <el-link type="primary" @click="viewProject(row.id)">{{ row.name }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="projectType" label="类型" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.projectType === 'highway' ? 'primary' : 'success'" size="small">
                {{ row.projectType === 'highway' ? '公路' : '市政' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getProjectStatusType(row.status)" size="small">{{ getProjectStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="settlementRatio" label="结算进度" width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="clampProgressPercentage(Number(row.settlementRatio))"
                :color="'#409EFF'"
                :format="() => formatProgressRatio(Number(row.settlementRatio))"
                :stroke-width="DASH_PROGRESS_STROKE_WIDTH"
              />
            </template>
          </el-table-column>
          <el-table-column label="收款" width="160" align="center">
            <template #default="{ row }">
              <span class="dash-inline-value dash-inline-value--success">{{ formatCurrency(row.receivedAmount) }}</span>
              <span class="dash-inline-separator">/</span>
              <span class="dash-inline-value dash-inline-value--muted">{{ formatCurrency(row.settledAmount) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="activeProjects.length === 0" class="dash-empty" description="暂无进行中的项目" :image-size="60" />
    </section>

    <section class="dash-list-panel">
      <div class="dash-list-header">
        <div>
          <div class="dash-badge dash-badge--success">最近更新</div>
          <h3 class="dash-list-title">近期结算记录</h3>
          <p class="dash-list-desc">快速回看最近录入或调整过的结算单。</p>
        </div>
        <el-link type="primary" @click="goToSettlements">查看全部</el-link>
      </div>

      <div class="dash-table-shell">
        <el-table :data="recentSettlements" class="dash-table" size="small" stripe>
          <el-table-column prop="settlementNo" label="结算单号" width="220" />
          <el-table-column label="项目名称" min-width="180">
            <template #default="{ row }">{{ getProjectName(row.projectId) }}</template>
          </el-table-column>
          <el-table-column prop="settlementType" label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.settlementType === 'final' ? 'success' : 'primary'" size="small">
                {{ row.settlementType === 'final' ? '最终' : '中期' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="currentAmount" label="结算金额" width="150" align="right">
            <template #default="{ row }">
              <span class="dash-inline-value dash-inline-value--primary">{{ formatCurrency(row.currentAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建日期" width="120">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewSettlement(row.id)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="recentSettlements.length === 0" class="dash-empty" description="暂无结算记录" :image-size="60" />
    </section>
  </div>
</template>

<script setup lang="ts">
import './dashboard.css'
import { Document, Money, OfficeBuilding, Wallet } from '@element-plus/icons-vue'
import { clampProgressPercentage, formatCompactCurrency, formatCurrency, formatProgressRatio } from '@/utils/calculations'
import { formatDate, getProjectStatusText, getProjectStatusType } from '@/utils/format'
import { useDashboard } from './useDashboard'

const DASH_PROGRESS_STROKE_WIDTH = 10

const {
  SettlementProgressChart,
  PaymentTrendChart,
  stats,
  activeProjects,
  recentSettlements,
  chartProjectData,
  trendGranularity,
  selectedTrendSpan,
  trendSpanOptions,
  trendDisplayLabels,
  trendSettlementAmounts,
  trendReceivedAmounts,
  trendSettlementTotal,
  trendReceivedTotal,
  currentPeriodSettlement,
  currentPeriodTitle,
  trendSummaryLabel,
  getProjectName,
  goToProjects,
  goToSettlements,
  viewProject,
  viewSettlement,
} = useDashboard()
</script>
