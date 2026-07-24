<template>
  <div class="ca-panel">
    <h3 class="ca-title">费用调整项</h3>
    <div class="ca-stack">
      <!-- 变更签证 -->
      <div class="ca-item">
        <div class="ca-item-head">
          <div>
            <span class="ca-item-title">变更签证金额</span>
            <p class="ca-item-desc">合同外签证工程量金额</p>
          </div>
          <el-input-number
            v-model="costData.changeAmount"
            :precision="3"
            :controls="false"
            size="small"
            class="ca-amount-input"
            :disabled="props.disabled"
          />
        </div>
        <el-input
          v-model="costData.changeRemark"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="变更签证说明（可调整大小）"
          class="ca-remark-input"
          :disabled="props.disabled"
        />
      </div>

      <!-- 材料调差 -->
      <div class="ca-item">
        <div class="ca-item-head">
          <div>
            <span class="ca-item-title">材料调差金额</span>
            <p class="ca-item-desc">沥青、集料等主要材料价格调差</p>
          </div>
          <el-input-number
            v-model="costData.materialAdjustment"
            :precision="3"
            :controls="false"
            size="small"
            class="ca-amount-input"
            :disabled="props.disabled"
          />
        </div>
        <el-input
          v-model="costData.materialRemark"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="材料调差说明（可调整大小）"
          class="ca-remark-input"
          :disabled="props.disabled"
        />
      </div>

      <!-- 施工措施增加费 -->
      <div class="ca-item">
        <div class="ca-item-head">
          <div>
            <span class="ca-item-title">施工措施增加费</span>
            <p class="ca-item-desc">夜间施工、赶工、交通导改等</p>
          </div>
          <el-input-number
            v-model="costData.surchargeAmount"
            :precision="3"
            :controls="false"
            size="small"
            class="ca-amount-input"
            :disabled="props.disabled"
          />
        </div>
        <el-input
          v-model="costData.surchargeRemark"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="施工措施费说明（可调整大小）"
          class="ca-remark-input"
          :disabled="props.disabled"
        />
      </div>

      <!-- 扣款 -->
      <div class="ca-item ca-item--last">
        <div class="ca-item-head">
          <div>
            <span class="ca-item-title ca-item-title--danger">扣款金额</span>
            <p class="ca-item-desc">罚款、水电费、其他扣款项</p>
          </div>
          <el-input-number
            v-model="costData.deductionAmount"
            :precision="3"
            :controls="false"
            :min="0"
            size="small"
            class="ca-amount-input"
            :disabled="props.disabled"
          />
        </div>
        <el-input
          v-model="costData.deductionRemark"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="扣款原因说明（可调整大小）"
          class="ca-remark-input"
          :disabled="props.disabled"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './cost-adjustment.css'
import { reactive, watch } from 'vue'
import type { CostAdjustmentData } from '@/types'

const props = defineProps<{
  modelValue: CostAdjustmentData
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [data: CostAdjustmentData]
}>()

// 直接在 reactive 上绑定——不再是黑盒 computed
const costData = reactive<CostAdjustmentData>({
  changeAmount: props.modelValue.changeAmount,
  changeRemark: props.modelValue.changeRemark,
  materialAdjustment: props.modelValue.materialAdjustment,
  materialRemark: props.modelValue.materialRemark,
  surchargeAmount: props.modelValue.surchargeAmount,
  surchargeRemark: props.modelValue.surchargeRemark,
  deductionAmount: props.modelValue.deductionAmount,
  deductionRemark: props.modelValue.deductionRemark
})

// 父组件外部更新时同步进来（如重置、加载数据）
watch(
  () => props.modelValue,
  (val) => {
    Object.assign(costData, val)
  },
  { deep: true }
)

// 任何字段变化立即向上 emit（el-input-number 的 v-model 触发）
watch(
  () => ({ ...costData }),
  (val) => {
    emit('update:modelValue', { ...val })
  },
  { deep: true }
)
</script>
