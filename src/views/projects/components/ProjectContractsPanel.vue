<template>
  <div class="pd-panel">
    <div class="pd-section-head">
      <h2 class="pd-section-title">合同信息（{{ contracts.length }} 份）</h2>
      <el-button type="primary" size="small" @click="$emit('create-contract')">新建合同</el-button>
    </div>

    <el-empty v-if="contracts.length === 0 && !showNewContract" description="暂无合同信息" :image-size="60" />

    <div v-if="showNewContract" class="project-contract-editor pd-contract-editor">
      <div class="pd-subsection-head">
        <h3 class="pd-subsection-title">新建合同</h3>
        <div class="pd-action-row">
          <el-button size="small" @click="$emit('cancel-new-contract')">取消</el-button>
          <el-button type="primary" size="small" :loading="newSaving" @click="$emit('save-new-contract')">保存合同</el-button>
        </div>
      </div>

      <div class="pd-contract-editor-body">
        <div class="pd-contract-form-col">
          <el-form :model="newForm" :rules="contractRules" :ref="(el: any) => setNewFormRef(el)" :label-width="labelWidth" class="pd-form-stack">
            <el-form-item label="合同编号" prop="contractNo">
              <el-input v-model="newForm.contractNo" placeholder="如：HT2026001" />
            </el-form-item>
            <el-form-item label="合同名称" prop="contractName">
              <el-input v-model="newForm.contractName" placeholder="请输入合同名称" />
            </el-form-item>
            <el-form-item label="签订日期" prop="contractDate">
              <el-date-picker v-model="newForm.contractDate" type="date" placeholder="选择签订日期" class="pd-field-full" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="合同概要">
              <el-input v-model="newForm.summary" type="textarea" :rows="3" placeholder="付款条款、工程范围等" />
            </el-form-item>
          </el-form>
        </div>

        <div class="pd-contract-boq-col">
          <div class="pd-subsection-head pd-subsection-head--compact">
            <span class="pd-subsection-title pd-subsection-title--small">工程量清单（{{ newBoqRows.length }} 项）</span>
            <el-button size="small" type="primary" plain @click="$emit('add-new-boq-row')">
              <el-icon><Plus /></el-icon>添加清单项
            </el-button>
          </div>
          <BoqEditableTable
            :rows="newBoqRows"
            :tax-rate-options="taxRateOptions"
            :max-height="newBoqTableMaxHeight"
            variant="new"
            :show-tax-breakdown="false"
            show-empty
            @remove="$emit('remove-new-boq-row', $event)"
            @quantity-change="$emit('new-boq-quantity-change', $event)"
            @tax-rate-change="$emit('new-boq-tax-rate-change', $event)"
            @no-tax-price-change="$emit('new-boq-no-tax-price-change', $event)"
            @unit-price-change="$emit('new-boq-unit-price-change', $event)"
          />
          <div v-if="newBoqRows.length === 0" class="project-boq-empty pd-boq-empty">
            暂无清单项，点击上方「添加清单项」录入
          </div>
        </div>
      </div>
    </div>

    <div v-for="contract in contracts" :key="contract.id" class="pd-contract-stack">
      <div
        class="project-contract-row pd-contract-row"
        :class="{ 'pd-contract-row--expanded': expandedIds.has(contract.id) }"
        @click="$emit('toggle-contract', contract.id)"
      >
        <div class="pd-contract-row-main">
          <el-icon class="pd-contract-arrow" :class="{ 'pd-contract-arrow--expanded': expandedIds.has(contract.id) }"><ArrowRight /></el-icon>
          <span class="pd-contract-code">{{ contract.contractNo }}</span>
          <span class="pd-contract-name">{{ contract.contractName }}</span>
        </div>
        <div class="pd-contract-row-meta">
          <span class="pd-amount-strong pd-amount-strong--primary">{{ RMB_SYMBOL }}{{ formatAmount(contract.contractAmount) }}</span>
          <el-button link type="danger" size="small" @click.stop>
            <el-popconfirm title="删除后不可恢复；若该合同已被结算引用，系统会阻止删除。确认删除该合同？" @confirm="$emit('delete-contract', contract.id)">
              <template #reference>删除</template>
            </el-popconfirm>
          </el-button>
        </div>
      </div>

      <div v-if="expandedIds.has(contract.id)" class="project-contract-detail pd-contract-detail">
        <div class="pd-contract-detail-body">
          <div class="pd-contract-detail-form">
            <el-form :model="editForms[contract.id]" :rules="contractRules" :ref="(el: any) => setFormRef(contract.id, el)" :label-width="labelWidth" class="pd-form-stack">
              <el-form-item label="合同编号" prop="contractNo">
                <el-input v-model="editForms[contract.id].contractNo" placeholder="如：HT2026001" />
              </el-form-item>
              <el-form-item label="合同名称" prop="contractName">
                <el-input v-model="editForms[contract.id].contractName" placeholder="请输入合同名称" />
              </el-form-item>
              <el-form-item label="签订日期" prop="contractDate">
                <el-date-picker v-model="editForms[contract.id].contractDate" type="date" placeholder="选择签订日期" class="pd-field-full" value-format="YYYY-MM-DD" />
              </el-form-item>
            </el-form>
            <div class="project-contract-summary pd-contract-summary">
              <div class="pd-summary-row"><span class="pd-summary-label">含税金额</span><span class="pd-summary-value pd-summary-value--primary">{{ RMB_SYMBOL }}{{ getContractTotal(contract.id) }}</span></div>
              <div class="pd-summary-row"><span class="pd-summary-label">不含税金额</span><span class="pd-summary-value">{{ RMB_SYMBOL }}{{ getContractNoTax(contract.id) }}</span></div>
              <div class="pd-summary-row"><span class="pd-summary-label">税额</span><span class="pd-summary-value">{{ RMB_SYMBOL }}{{ getContractTax(contract.id) }}</span></div>
            </div>
          </div>
          <div class="pd-contract-detail-copy">
            <div class="pd-subsection-label">合同概要</div>
            <el-input
              v-model="editForms[contract.id].summary"
              type="textarea"
              :rows="5"
              placeholder="付款条款、工程范围、工期要求等（选填）"
              class="summary-textarea"
            />
          </div>
        </div>

        <div class="pd-toolbar">
          <div class="pd-toolbar-group">
            <h4 class="pd-toolbar-title">工程量清单（{{ boqMap[contract.id]?.length || 0 }} 项）</h4>
          </div>
          <div class="pd-toolbar-group">
            <el-button size="small" @click="$emit('open-attach-drawer', contract.id)">
              <template #icon><Paperclip /></template>附件
              <el-badge v-if="attachCounts[contract.id]" :value="attachCounts[contract.id]" type="primary" class="pd-inline-badge" />
            </el-button>
            <el-button size="small" @click="$emit('open-import-dialog', contract.id)">
              <template #icon><Upload /></template>导入CSV
            </el-button>
            <el-button size="small" @click="$emit('download-template')">
              <template #icon><Download /></template>下载模板
            </el-button>
            <el-button size="small" @click="$emit('add-boq-row', contract.id)">
              <template #icon><Plus /></template>添加
            </el-button>
            <el-button size="small" @click="$emit('export-boq', contract)">导出清单</el-button>
            <el-button type="primary" size="small" :loading="savingId === contract.id" @click="$emit('save-contract', contract)">保存</el-button>
          </div>
        </div>

        <BoqEditableTable
          v-if="boqMap[contract.id]?.length > 0"
          :rows="boqMap[contract.id]"
          :tax-rate-options="taxRateOptions"
          :max-height="boqTableMaxHeight"
          show-summary
          :summary-method="boqSummaryMethod"
          confirm-remove
          @remove="$emit('remove-boq-row', contract.id, $event)"
          @quantity-change="$emit('boq-quantity-change', $event)"
          @tax-rate-change="$emit('boq-tax-rate-change', $event)"
          @no-tax-price-change="$emit('boq-no-tax-price-change', $event)"
          @unit-price-change="$emit('boq-unit-price-change', $event)"
        />
        <el-empty v-else description="暂无清单项，可添加或导入CSV" :image-size="60" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight, Download, Paperclip, Plus, Upload } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { BillOfQuantities, Contract } from '@/types'
import { formatAmount, RMB_SYMBOL } from '@/utils/calculations'
import type { TableSummaryParams } from '@/utils/table-summary'
import BoqEditableTable from './BoqEditableTable.vue'
import type { ContractEditForm, EditableBoqItem } from '../project-detail.helpers'

type TaxRateOption = { label: string; value: number }

defineProps<{
  contracts: Contract[]
  boqMap: Record<number, EditableBoqItem[]>
  editForms: Record<number, ContractEditForm>
  expandedIds: Set<number>
  savingId: number | null
  showNewContract: boolean
  newSaving: boolean
  newForm: ContractEditForm
  newBoqRows: EditableBoqItem[]
  attachCounts: Record<number, number>
  contractRules: FormRules
  taxRateOptions: readonly TaxRateOption[]
  labelWidth: string
  newBoqTableMaxHeight: number
  boqTableMaxHeight: number
  setNewFormRef: (el: FormInstance | null | undefined) => void
  setFormRef: (id: number, el: FormInstance | null | undefined) => void
  getContractTotal: (id: number) => string
  getContractNoTax: (id: number) => string
  getContractTax: (id: number) => string
  boqSummaryMethod: (param: TableSummaryParams<Partial<BillOfQuantities>>) => string[]
}>()

defineEmits<{
  'create-contract': []
  'cancel-new-contract': []
  'save-new-contract': []
  'toggle-contract': [id: number]
  'delete-contract': [id: number]
  'add-new-boq-row': []
  'remove-new-boq-row': [index: number]
  'new-boq-quantity-change': [row: EditableBoqItem]
  'new-boq-tax-rate-change': [row: EditableBoqItem]
  'new-boq-no-tax-price-change': [row: EditableBoqItem]
  'new-boq-unit-price-change': [row: EditableBoqItem]
  'open-attach-drawer': [id: number]
  'open-import-dialog': [id: number]
  'download-template': []
  'add-boq-row': [id: number]
  'export-boq': [contract: Contract]
  'save-contract': [contract: Contract]
  'remove-boq-row': [id: number, index: number]
  'boq-quantity-change': [row: EditableBoqItem]
  'boq-tax-rate-change': [row: EditableBoqItem]
  'boq-no-tax-price-change': [row: EditableBoqItem]
  'boq-unit-price-change': [row: EditableBoqItem]
}>()
</script>
