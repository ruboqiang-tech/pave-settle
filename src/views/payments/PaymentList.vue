<template>
  <div class="page-theme payment-list-page pl-page">
    <section class="pl-hero">
      <div class="pl-hero-main">
        <div class="pl-hero-copy">
          <p class="pl-hero-kicker">Cashflow Ledger</p>
          <h1 class="pl-hero-title">收款与发票台账</h1>
          <p class="pl-hero-desc">
            项目筛选作用于整页口径，日期筛选聚焦当前台账记录，方便同时核对收款、开票与项目应收。
          </p>
        </div>

        <div class="pl-filter-row">
          <el-select v-model="filterProject" placeholder="全部项目" clearable filterable size="small" class="pl-filter-select pl-filter-select--project">
            <el-option v-for="project in projectOptions" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <el-date-picker
            v-model="filterDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            size="small"
            class="pl-filter-select pl-filter-select--date"
          />
          <el-button v-if="hasActiveFilters" size="small" @click="resetFilters">清空筛选</el-button>
        </div>
      </div>

      <div class="pl-tag-row">
        <el-tag size="small" effect="plain">项目口径：{{ currentProjectScopeLabel }}</el-tag>
        <el-tag size="small" type="info" effect="plain">台账日期：{{ currentFilterDateLabel }}</el-tag>
        <el-tag size="small" type="success" effect="plain">
          {{ paymentLedgerSummary.count }} 条收款 / {{ invoiceLedgerSummary.count }} 张发票
        </el-tag>
      </div>
    </section>

    <section class="pl-stat-grid">
      <article class="pl-stat-card">
        <div class="pl-stat-kicker">项目已结算总额</div>
        <div class="pl-stat-value">{{ formatCurrency(projectSummary.totalSettled) }}</div>
        <div class="pl-stat-note">按项目口径对照应收，不受台账日期筛选影响</div>
      </article>
      <article class="pl-stat-card">
        <div class="pl-stat-kicker">当前筛选收款</div>
        <div class="pl-stat-value pl-amount-success">{{ formatCurrency(paymentLedgerSummary.totalAmount) }}</div>
        <div class="pl-stat-note">随日期与项目筛选同步变化，直接对应收款台账</div>
      </article>
      <article class="pl-stat-card">
        <div class="pl-stat-kicker">项目待收余额</div>
        <div class="pl-stat-value pl-amount-danger">{{ formatCurrency(projectSummary.totalUnreceived) }}</div>
        <div class="pl-stat-note">按项目整体口径核对应收余额，便于判断回款缺口</div>
      </article>
      <article class="pl-stat-card">
        <div class="pl-stat-kicker">当前筛选开票</div>
        <div class="pl-stat-value pl-amount-violet">{{ formatCurrency(invoiceLedgerSummary.totalAmount) }}</div>
        <div class="pl-stat-note">税额 {{ formatCurrency(invoiceLedgerSummary.taxAmount) }}</div>
      </article>
    </section>

    <section class="pl-ledger-grid">
      <div class="pl-panel">
        <div class="pl-panel-header">
          <div class="pl-panel-head">
            <div class="pl-panel-copy">
              <h2 class="pl-panel-title">收款记录</h2>
              <p class="pl-panel-desc">同屏查看到账日期、方式、凭证与备注，减少和发票台账之间来回切换。</p>
            </div>
            <div class="pl-panel-actions">
              <el-tag size="small" effect="plain">{{ paymentLedgerSummary.count }} 条</el-tag>
              <el-tag size="small" type="success" effect="plain">{{ formatCurrency(paymentLedgerSummary.totalAmount) }}</el-tag>
              <el-button size="small" :icon="Download" :loading="paymentExporting" @click="handleExportPayments">导出 CSV</el-button>
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新增收款</el-button>
            </div>
          </div>
        </div>

        <div class="pl-panel-body">
          <el-table
            v-if="filteredPayments.length > 0"
            :data="filteredPayments"
            border
            size="small"
            stripe
            :max-height="PL_LEDGER_TABLE_MAX_HEIGHT"
            show-summary
            :summary-method="getPaymentSummary"
          >
            <el-table-column type="index" label="序号" width="60" />
            <el-table-column label="项目名称" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ getProjectName(row.projectId) }}</template>
            </el-table-column>
            <el-table-column prop="paymentDate" label="收款日期" width="110" align="center" />
            <el-table-column prop="amount" label="收款金额" width="140" align="right">
              <template #default="{ row }">
                <span class="pl-amount-success pl-amount-strong">{{ formatCurrency(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="收款方式" width="120" align="center">
              <template #default="{ row }">{{ getPaymentMethodLabel(row.paymentMethod) }}</template>
            </el-table-column>
            <el-table-column prop="referenceNo" label="凭证号" min-width="160" show-overflow-tooltip />
            <el-table-column prop="description" label="备注" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <div class="pl-table-action-row pl-table-action-row--center">
                  <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                  <el-popconfirm title="确认删除该收款记录？" @confirm="handleDelete(row.id)">
                    <template #reference>
                      <el-button link type="danger">删除</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无收款记录" :image-size="60" />
        </div>
      </div>

      <div class="pl-panel">
        <div class="pl-panel-header">
          <div class="pl-panel-head">
            <div class="pl-panel-copy">
              <h2 class="pl-panel-title">发票记录</h2>
              <p class="pl-panel-desc">同步查看项目开票、税额与备注，便于和收款台账交叉核对。</p>
            </div>
            <div class="pl-panel-actions">
              <el-tag size="small" effect="plain">{{ invoiceLedgerSummary.count }} 张</el-tag>
              <el-tag size="small" type="warning" effect="plain">{{ formatCurrency(invoiceLedgerSummary.totalAmount) }}</el-tag>
              <el-button size="small" :icon="Download" :loading="invoiceExporting" @click="handleExportInvoices">导出 CSV</el-button>
              <el-button type="primary" size="small" :icon="Plus" @click="openInvoiceCreate">新增发票</el-button>
            </div>
          </div>
        </div>

        <div class="pl-panel-body">
          <el-table
            v-if="filteredInvoices.length > 0"
            :data="filteredInvoices"
            border
            size="small"
            stripe
            :max-height="PL_LEDGER_TABLE_MAX_HEIGHT"
            show-summary
            :summary-method="getInvoiceSummary"
          >
            <el-table-column type="index" label="序号" width="60" />
            <el-table-column label="项目名称" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ getProjectName(row.projectId) }}</template>
            </el-table-column>
            <el-table-column prop="invoiceNo" label="发票号码" min-width="160" show-overflow-tooltip />
            <el-table-column prop="invoiceType" label="发票类型" width="120" align="center">
              <template #default="{ row }">{{ getInvoiceTypeLabel(row.invoiceType) }}</template>
            </el-table-column>
            <el-table-column prop="invoiceDate" label="开票日期" width="110" align="center" />
            <el-table-column prop="totalAmount" label="价税合计" width="140" align="right">
              <template #default="{ row }">{{ formatCurrency(row.totalAmount) }}</template>
            </el-table-column>
            <el-table-column prop="invoiceAmount" label="不含税金额" width="140" align="right">
              <template #default="{ row }">{{ formatCurrency(row.invoiceAmount) }}</template>
            </el-table-column>
            <el-table-column prop="taxAmount" label="税额" width="120" align="right">
              <template #default="{ row }">{{ formatCurrency(row.taxAmount) }}</template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <div class="pl-table-action-row pl-table-action-row--center">
                  <el-button link type="primary" @click="openInvoiceEdit(row)">编辑</el-button>
                  <el-popconfirm title="确认作废该发票？" @confirm="handleInvoiceVoid(row.id)">
                    <template #reference>
                      <el-button link type="danger">作废</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无发票记录" :image-size="60" />
        </div>
      </div>
    </section>

    <el-drawer v-model="showDialog" :title="paymentDrawerTitle" size="520px" destroy-on-close @closed="resetPaymentForm">
      <el-form ref="formRef" :model="form" :rules="rules" :label-width="PL_FORM_LABEL_WIDTH" class="pl-dialog-form">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="form.projectId" placeholder="请选择项目" filterable class="pl-field-full">
            <el-option v-for="project in projectOptions" :key="project.id" :label="`${project.code} - ${project.name}`" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款日期" prop="paymentDate">
          <el-date-picker v-model="form.paymentDate" type="date" placeholder="请选择收款日期" value-format="YYYY-MM-DD" class="pl-field-full" />
        </el-form-item>
        <el-form-item label="收款金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="3" :step="10000" controls-position="right" class="pl-field-full" />
        </el-form-item>
        <el-form-item label="收款方式" prop="paymentMethod">
          <el-select v-model="form.paymentMethod" placeholder="请选择收款方式" class="pl-field-full">
            <el-option v-for="item in paymentMethodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="凭证号" prop="referenceNo">
          <el-input v-model="form.referenceNo" placeholder="如银行流水号、回单号等" />
        </el-form-item>
        <el-form-item label="备注" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可补充付款背景或说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="pl-dialog-footer">
          <el-button @click="showDialog = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="showInvoiceForm" :title="invoiceDrawerTitle" size="520px" destroy-on-close @closed="resetInvoiceForm">
      <el-form ref="invoiceFormRef" :model="invoiceForm" :rules="invoiceRules" :label-width="PL_FORM_LABEL_WIDTH" class="pl-dialog-form">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="invoiceForm.projectId" placeholder="请选择项目" filterable class="pl-field-full">
            <el-option v-for="project in projectOptions" :key="project.id" :label="`${project.code} - ${project.name}`" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票号码" prop="invoiceNo">
          <el-input v-model="invoiceForm.invoiceNo" placeholder="请输入发票号码" />
        </el-form-item>
        <el-form-item label="发票类型" prop="invoiceType">
          <el-select v-model="invoiceForm.invoiceType" class="pl-field-full">
            <el-option v-for="item in invoiceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="开票日期" prop="invoiceDate">
          <el-date-picker v-model="invoiceForm.invoiceDate" type="date" placeholder="请选择开票日期" value-format="YYYY-MM-DD" class="pl-field-full" />
        </el-form-item>
        <el-form-item label="不含税金额" prop="invoiceAmount">
          <el-input-number
            v-model="invoiceForm.invoiceAmount"
            :min="0"
            :precision="3"
            :step="10000"
            controls-position="right"
            class="pl-field-full"
            @change="onInvoiceAmountChange"
          />
        </el-form-item>
        <el-form-item label="税率" prop="taxRate">
          <el-select v-model="invoiceForm.taxRate" class="pl-field-full" @change="onInvoiceTaxRateChange">
            <el-option v-for="rate in taxRateOptions" :key="rate.value" :label="rate.label" :value="rate.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="税额">
          <el-input :model-value="formatCurrency(invoiceForm.taxAmount)" disabled />
        </el-form-item>
        <el-form-item label="价税合计" prop="totalAmount">
          <el-input-number
            v-model="invoiceForm.totalAmount"
            :min="0"
            :precision="3"
            :step="10000"
            controls-position="right"
            class="pl-field-full"
            @change="onInvoiceTotalAmountChange"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="invoiceForm.remark" type="textarea" :rows="3" placeholder="可填写开票说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="pl-dialog-footer">
          <el-button @click="showInvoiceForm = false">取消</el-button>
          <el-button type="primary" :loading="invoiceSaving" @click="handleInvoiceSave">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import './payment-list.css'
import { Download, Plus } from '@element-plus/icons-vue'
import { formatCurrency } from '@/utils/calculations'
import { getInvoiceTypeLabel, getPaymentMethodLabel, taxRateOptions } from '@/utils/format'
import { usePaymentList } from './usePaymentList'

const PL_FORM_LABEL_WIDTH = '100px'
const PL_LEDGER_TABLE_MAX_HEIGHT = 560

const {
  filterProject,
  filterDateRange,
  showDialog,
  saving,
  paymentExporting,
  formRef,
  form,
  showInvoiceForm,
  invoiceSaving,
  invoiceExporting,
  invoiceFormRef,
  invoiceForm,
  paymentMethodOptions,
  invoiceTypeOptions,
  rules,
  invoiceRules,
  projectOptions,
  filteredPayments,
  filteredInvoices,
  projectSummary,
  paymentLedgerSummary,
  invoiceLedgerSummary,
  hasActiveFilters,
  currentProjectScopeLabel,
  currentFilterDateLabel,
  paymentDrawerTitle,
  invoiceDrawerTitle,
  onInvoiceAmountChange,
  onInvoiceTotalAmountChange,
  onInvoiceTaxRateChange,
  getProjectName,
  getPaymentSummary,
  getInvoiceSummary,
  resetFilters,
  resetPaymentForm,
  resetInvoiceForm,
  openCreate,
  openEdit,
  openInvoiceCreate,
  openInvoiceEdit,
  handleSave,
  handleDelete,
  handleInvoiceSave,
  handleInvoiceVoid,
  handleExportPayments,
  handleExportInvoices,
} = usePaymentList()
</script>
