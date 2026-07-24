<template>
  <el-table
    class="pd-boq-table"
    :class="{ 'pd-boq-table--new': variant === 'new' }"
    :data="rows"
    border
    size="small"
    table-layout="auto"
    :show-summary="showSummary"
    :summary-method="summaryMethod"
    :max-height="maxHeight"
    :show-empty="showEmpty"
  >
    <el-table-column type="index" label="#" width="44" fixed="left" />
    <el-table-column prop="itemName" label="项目名称" min-width="150">
      <template #default="{ row }">
        <el-input v-model="row.itemName" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" resize="vertical" class="pd-boq-textarea" placeholder="项目名称" />
      </template>
    </el-table-column>
    <el-table-column prop="remark" label="特征描述" min-width="140">
      <template #default="{ row }">
        <el-input v-model="row.remark" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" resize="vertical" class="pd-boq-textarea" placeholder="特征描述" />
      </template>
    </el-table-column>
    <el-table-column prop="unit" label="单位" width="60">
      <template #default="{ row }">
        <el-input v-model="row.unit" size="small" placeholder="㎡" />
      </template>
    </el-table-column>
    <el-table-column prop="quantity" label="工程量" width="96" align="right">
      <template #default="{ row }">
        <el-input-number v-model="row.quantity" :min="0" :precision="3" :controls="false" size="small" :class="quantityClass" @change="$emit('quantity-change', row)" />
      </template>
    </el-table-column>
    <el-table-column prop="taxRate" :label="taxRateLabel" :width="taxRateWidth" align="center">
      <template #default="{ row }">
        <el-select v-model="row.taxRate" size="small" :class="taxRateClass" @change="$emit('tax-rate-change', row)">
          <el-option v-for="rate in taxRateOptions" :key="rate.value" :label="rate.label" :value="rate.value" />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column prop="noTaxUnitPrice" label="不含税单价" width="96" align="right">
      <template #default="{ row }">
        <el-input-number v-model="row.noTaxUnitPrice" :min="0" :precision="3" :controls="false" size="small" class="pd-field-price" @change="$emit('no-tax-price-change', row)" />
      </template>
    </el-table-column>
    <el-table-column prop="unitPrice" label="含税单价" width="96" align="right">
      <template #default="{ row }">
        <el-input-number v-model="row.unitPrice" :min="0" :precision="3" :controls="false" size="small" class="pd-field-price" @change="$emit('unit-price-change', row)" />
      </template>
    </el-table-column>
    <el-table-column v-if="showTaxBreakdown" prop="noTaxTotalPrice" label="不含税合价" width="108" align="right">
      <template #default="{ row }">
        <span>{{ RMB_SYMBOL }}{{ formatAmount(row.noTaxTotalPrice || 0) }}</span>
      </template>
    </el-table-column>
    <el-table-column v-if="showTaxBreakdown" prop="taxAmount" label="税额" width="92" align="right">
      <template #default="{ row }">
        <span>{{ RMB_SYMBOL }}{{ formatAmount(row.taxAmount || 0) }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="totalPrice" label="含税合价" :width="totalWidth" align="right">
      <template #default="{ row }">
        <span :class="totalClass">{{ RMB_SYMBOL }}{{ formatAmount(row.totalPrice || 0) }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="note" label="备注" min-width="120">
      <template #default="{ row }">
        <el-input v-model="row.note" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" resize="vertical" class="pd-boq-textarea" placeholder="备注" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="56" fixed="right">
      <template #default="{ $index }">
        <el-popconfirm v-if="confirmRemove" title="确认删除？" @confirm="$emit('remove', $index)">
          <template #reference>
            <el-button link type="danger" size="small">删除</el-button>
          </template>
        </el-popconfirm>
        <el-button v-else link type="danger" size="small" @click="$emit('remove', $index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BillOfQuantities } from '@/types'
import { formatAmount, RMB_SYMBOL } from '@/utils/calculations'
import type { TableSummaryParams } from '@/utils/table-summary'
import type { EditableBoqItem } from '../project-detail.helpers'

type BoqTableVariant = 'new' | 'existing'
type TaxRateOption = { label: string; value: number }

const props = withDefaults(defineProps<{
  rows: EditableBoqItem[]
  taxRateOptions: readonly TaxRateOption[]
  maxHeight: number
  variant?: BoqTableVariant
  showTaxBreakdown?: boolean
  showSummary?: boolean
  showEmpty?: boolean
  confirmRemove?: boolean
  summaryMethod?: (param: TableSummaryParams<Partial<BillOfQuantities>>) => string[]
}>(), {
  variant: 'existing',
  showTaxBreakdown: true,
  showSummary: false,
  showEmpty: false,
  confirmRemove: false,
  summaryMethod: undefined,
})

defineEmits<{
  remove: [index: number]
  'quantity-change': [row: EditableBoqItem]
  'tax-rate-change': [row: EditableBoqItem]
  'no-tax-price-change': [row: EditableBoqItem]
  'unit-price-change': [row: EditableBoqItem]
}>()

const isNew = computed(() => props.variant === 'new')
const quantityClass = computed(() => isNew.value ? 'pd-field-quantity' : 'pd-field-price')
const taxRateLabel = computed(() => isNew.value ? '税率%' : '税率')
const taxRateWidth = computed(() => isNew.value ? 72 : 70)
const taxRateClass = computed(() => ['pd-field-tax-rate', { 'pd-field-tax-rate--compact': isNew.value }])
const totalWidth = computed(() => props.showTaxBreakdown ? 108 : 104)
const totalClass = computed(() => isNew.value ? 'pd-amount-mini' : 'pd-amount-strong')
</script>
