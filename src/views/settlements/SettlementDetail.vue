<template>
  <div class="page-theme settlement-detail-page sd-page">
    <section class="sd-hero-panel">
      <div class="sd-hero-shell">
        <div class="sd-hero-main">
          <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
          <div class="sd-hero-copy">
            <h2 class="sd-hero-title">{{ pageTitle }}</h2>
            <p class="sd-hero-desc">
              {{ projectName || '未选择项目' }}
              <span v-if="settlement.settlementNo"> · {{ settlement.settlementNo }}</span>
            </p>
          </div>
          <el-tag
            v-if="settlement.id"
            :type="settlement.status === 'approved' ? 'success' : settlement.status === 'confirmed' ? 'primary' : 'info'"
            size="large"
          >
            {{ settlement.status === 'approved' ? '已审批' : settlement.status === 'confirmed' ? '已确认' : '草稿' }}
          </el-tag>
        </div>

        <div class="sd-hero-actions">
          <el-button @click="showAttachmentDrawer = true">
            附件
            <el-badge v-if="attachmentCount" :value="attachmentCount" type="primary" class="sd-inline-badge" />
          </el-button>
          <el-button :loading="exporting" @click="handleExportExcel">导出 Excel</el-button>
          <el-button v-if="settlement.status === 'approved'" type="warning" :loading="saving" @click="handleUndoConfirm">撤销审批</el-button>
          <template v-if="settlement.status === 'confirmed'">
            <el-button type="warning" :loading="saving" @click="handleSave('draft')">退回草稿</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave('confirmed')">保存修改</el-button>
            <el-button type="success" :loading="saving" @click="handleSave('approved')">审批通过</el-button>
          </template>
          <template v-if="settlement.status === 'draft'">
            <el-button type="primary" :loading="saving" @click="handleSave('draft')">保存草稿</el-button>
            <el-button type="success" :loading="saving" @click="handleSave('confirmed')">确认结算</el-button>
          </template>
        </div>
      </div>
    </section>

    <el-alert
      v-if="detailsLoadedFromFallback"
      type="warning"
      :closable="false"
      show-icon
      title="这张结算单主表有金额，但原始明细没有读到，当前已按合同清单生成补录底稿。"
      description="请先核对本期完成数量，再保存一次，系统会重新写入明细并回刷后续累计结算。"
    />

    <section class="sd-overview-grid">
      <div class="sd-panel">
        <div class="sd-section-copy">
          <h3 class="sd-section-title">结算基本信息</h3>
          <p class="sd-section-desc">先确认项目、合同与结算期间，再进入工程量和调差项核对。</p>
        </div>

        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="结算单号">
            <template v-if="settlement.status === 'draft'">
              <el-input
                v-model="settlement.settlementNo"
                size="small"
                placeholder="请输入结算单号"
                clearable
              />
            </template>
            <template v-else>
              {{ settlement.settlementNo || '-' }}
            </template>
          </el-descriptions-item>
          <el-descriptions-item label="所属项目">{{ projectName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="结算类型">
            <el-radio-group v-model="settlement.settlementType" size="small" :disabled="settlement.status === 'approved'">
              <el-radio :value="'interim'">中期结算</el-radio>
              <el-radio :value="'final'">最终结算</el-radio>
            </el-radio-group>
          </el-descriptions-item>
          <el-descriptions-item label="结算期间" :span="2">
            <el-date-picker
              v-model="settlementDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              size="small"
              class="sd-field-full"
              :disabled="settlement.status === 'approved'"
            />
          </el-descriptions-item>
          <el-descriptions-item label="合同总额">
            <span class="sd-value-strong">{{ formatCurrency(contractAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联合同" :span="2">
            <div class="sd-tag-row">
              <el-tag v-for="name in contractNameList" :key="name" size="small" effect="plain">{{ name }}</el-tag>
              <span v-if="contractNameList.length === 0">-</span>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="备注说明" :span="3">
            <el-input
              v-model="settlement.remark"
              type="textarea"
              :rows="3"
              placeholder="请输入结算说明或补充备注"
              :disabled="settlement.status === 'approved'"
            />
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="sd-panel">
        <div class="sd-section-copy">
          <h3 class="sd-section-title">结算概览</h3>
          <p class="sd-section-desc">这里汇总结算结果，明细和调差项在下方联动计算。</p>
        </div>

        <div class="sd-stat-stack">
          <div class="sd-stat-row"><span class="sd-stat-label">上期累计</span><span class="sd-value-strong">{{ formatCurrency(settlement.previousCumulative) }}</span></div>
          <div class="sd-stat-row"><span class="sd-stat-label">本期结算</span><span class="sd-value-strong sd-value-primary">{{ formatCurrency(settlement.currentAmount) }}</span></div>
          <div class="sd-stat-row"><span class="sd-stat-label">累计结算</span><span class="sd-value-strong">{{ formatCurrency(settlement.currentCumulative) }}</span></div>
          <div class="sd-stat-row"><span class="sd-stat-label">剩余合同金额</span><span class="sd-value-strong sd-value-danger">{{ formatCurrency(remainingContractAmount) }}</span></div>
        </div>

        <div class="sd-progress-block">
          <div class="sd-progress-head">
            <span class="sd-stat-label">结算进度</span>
            <span class="sd-value-strong">{{ settlementRatio.toFixed(1) }}%</span>
          </div>
          <el-progress :percentage="settlementProgress" :stroke-width="SD_PROGRESS_STROKE_WIDTH" />
        </div>
      </div>
    </section>

    <section class="sd-overview-grid">
      <div class="sd-panel sd-panel--flush">
        <div class="sd-panel-header">
          <div class="sd-panel-head">
            <div>
              <h3 class="sd-section-title">工程量结算明细</h3>
              <p class="sd-section-desc">按合同折叠管理，避免明细区在页面上无限拉长。</p>
            </div>
            <el-tag size="small" effect="plain">{{ groupedDetails.length }} 份合同</el-tag>
          </div>
        </div>

        <div class="sd-panel-body">
          <el-empty v-if="groupedDetails.length === 0" description="暂无可编辑的结算明细" :image-size="60" />
          <el-collapse v-else v-model="activeDetailPanels">
            <el-collapse-item v-for="group in groupedDetails" :key="group.contractId" :name="String(group.contractId)">
              <template #title>
                <div class="sd-collapse-title">
                  <div class="sd-collapse-copy">
                    <span class="sd-value-strong">{{ group.contractName }}</span>
                    <span class="sd-collapse-meta">含税合同 {{ formatCurrency(group.contractAmount) }}</span>
                  </div>
                  <span class="sd-value-strong sd-value-primary">本期 {{ formatCurrency(getGroupCurrentAmount(group)) }}</span>
                </div>
              </template>

              <el-table
                :data="group.items"
                border
                size="small"
                :max-height="SD_ENGINEERING_TABLE_MAX_HEIGHT"
                show-summary
                :summary-method="getGroupSummary"
                class="engineering-table"
              >
                <el-table-column type="index" label="序号" width="50" fixed="left" />
                <el-table-column prop="itemName" label="项目名称" min-width="180" fixed="left">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.itemName"
                      type="textarea"
                      autosize
                      readonly
                      class="no-border-textarea"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="remark" label="特征描述" min-width="160">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.remark"
                      type="textarea"
                      autosize
                      readonly
                      class="no-border-textarea"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="unit" label="单位" width="60" align="center" />
                <el-table-column prop="contractQuantity" label="合同工程量" width="120" align="right">
                  <template #default="{ row }">{{ formatQuantity(row.contractQuantity) }}</template>
                </el-table-column>
                <el-table-column prop="previousCumulative" label="上期累计完成" width="120" align="right">
                  <template #default="{ row }">{{ formatQuantity(row.previousCumulative) }}</template>
                </el-table-column>
                <el-table-column prop="currentQuantity" label="本期完成" width="130" align="right">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.currentQuantity"
                      :min="0"
                      :precision="3"
                      :controls="false"
                      size="small"
                      class="sd-quantity-input"
                      :disabled="settlement.status === 'approved'"
                      @change="onQuantityChange(row)"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="currentCumulative" label="本期累计" width="120" align="right">
                  <template #default="{ row }">{{ formatQuantity(row.currentCumulative) }}</template>
                </el-table-column>
                <el-table-column prop="unitPrice" label="含税单价" width="120" align="right">
                  <template #default="{ row }">{{ formatCurrency(row.unitPrice) }}</template>
                </el-table-column>
                <el-table-column prop="currentAmount" label="含税合价" width="140" align="right">
                  <template #default="{ row }">
                    <span class="sd-value-strong">{{ formatCurrency(row.currentAmount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="note" label="备注" min-width="200">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.note"
                      type="textarea"
                      :autosize="{ minRows: 1, maxRows: 6 }"
                      placeholder="备注"
                      size="small"
                      :disabled="settlement.status === 'approved'"
                    />
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>

      <CostAdjustment v-model="costAdjustment" :disabled="settlement.status === 'approved'" />
    </section>

    <el-drawer
      v-model="showAttachmentDrawer"
      title="结算附件"
      size="520px"
      destroy-on-close
      @closed="handleAttachmentDrawerClosed"
    >
      <AttachmentManager
        ref="attachmentManagerRef"
        :entity-id="settlement.id"
        :service="settlementAttachmentAdapter"
        :show-upload-time="true"
        :pending-mode="true"
        title="结算附件"
      />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import './settlement-detail.css'
import { ArrowLeft } from '@element-plus/icons-vue'
import AttachmentManager from '@/components/AttachmentManager.vue'
import CostAdjustment from '@/components/CostAdjustment.vue'
import { formatCurrency } from '@/utils/calculations'
import { formatQuantity } from '@/utils/format'
import { useSettlementDetail } from './useSettlementDetail'

const SD_PROGRESS_STROKE_WIDTH = 10
const SD_ENGINEERING_TABLE_MAX_HEIGHT = 460

const {
  settlementAttachmentAdapter,
  saving,
  exporting,
  attachmentManagerRef,
  showAttachmentDrawer,
  attachmentCount,
  activeDetailPanels,
  pageTitle,
  projectName,
  contractNameList,
  contractAmount,
  detailsLoadedFromFallback,
  settlement,
  costAdjustment,
  groupedDetails,
  settlementDateRange,
  settlementRatio,
  remainingContractAmount,
  settlementProgress,
  getGroupCurrentAmount,
  onQuantityChange,
  getGroupSummary,
  handleAttachmentDrawerClosed,
  handleUndoConfirm,
  handleSave,
  handleExportExcel,
  goBack,
} = useSettlementDetail()
</script>
