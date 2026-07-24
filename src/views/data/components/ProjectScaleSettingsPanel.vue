<template>
  <div class="dc-panel" style="padding: 10px 14px; border-radius: 8px;">
    <!-- Compact header -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <el-icon class="dc-icon-primary" style="font-size: 0.875rem;"><Operation /></el-icon>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--dc-text-title);">项目规模阈值</span>
      </div>
      <el-button
        type="primary"
        size="small"
        :loading="saving"
        @click="handleSave"
        style="padding: 2px 8px; height: 20px; font-size: 0.7rem; border-radius: 4px;"
      >
        保存
      </el-button>
    </div>

    <!-- 2-column input fields -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center;">
      <!-- Small limit -->
      <div style="background: var(--dc-surface-card, rgba(0, 0, 0, 0.02)); border: 1px solid var(--dc-border-panel, #e4e7ed); border-radius: 4px; padding: 4px 8px; display: flex; flex-direction: column; gap: 1px;">
        <span style="font-size: 0.65rem; color: var(--el-text-color-secondary);">小型上限 (万元)</span>
        <el-input-number
          v-model="smallInWan"
          :min="0"
          :controls="false"
          size="small"
          style="width: 100%;"
          class="compact-input-number"
          placeholder="小型上限"
        />
      </div>

      <!-- Large limit -->
      <div style="background: var(--dc-surface-card, rgba(0, 0, 0, 0.02)); border: 1px solid var(--dc-border-panel, #e4e7ed); border-radius: 4px; padding: 4px 8px; display: flex; flex-direction: column; gap: 1px;">
        <span style="font-size: 0.65rem; color: var(--el-text-color-secondary);">大型下限 (万元)</span>
        <el-input-number
          v-model="largeInWan"
          :min="smallInWan"
          :controls="false"
          size="small"
          style="width: 100%;"
          class="compact-input-number"
          placeholder="大型下限"
        />
      </div>
    </div>

    <div style="margin-top: 6px; font-size: 0.68rem; color: var(--el-text-color-secondary); text-align: center; background: rgba(59, 130, 246, 0.04); padding: 3px; border-radius: 4px;">
      小型 &lt; {{ smallInWan }}万 | 中型 {{ smallInWan }}万~{{ largeInWan }}万 | 大型 &gt; {{ largeInWan }}万
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation } from '@element-plus/icons-vue'

const props = defineProps<{
  thresholds: { small: number; large: number }
}>()

const emit = defineEmits<{
  (e: 'save-thresholds', thresholds: { small: number; large: number }): void
}>()

const smallInWan = ref(500)
const largeInWan = ref(2000)
const saving = ref(false)

watch(() => props.thresholds, (val) => {
  if (val) {
    smallInWan.value = Math.round(val.small / 10000)
    largeInWan.value = Math.round(val.large / 10000)
  }
}, { immediate: true })

async function handleSave() {
  if (smallInWan.value >= largeInWan.value) {
    ElMessage.error('小型项目上限必须小于大型项目下限')
    return
  }
  saving.value = true
  try {
    emit('save-thresholds', {
      small: smallInWan.value * 10000,
      large: largeInWan.value * 10000,
    })
    ElMessage.success('阈值保存成功')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
:deep(.compact-input-number.el-input-number .el-input__inner) {
  text-align: left;
  padding: 0;
  height: 20px;
  line-height: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}
:deep(.compact-input-number.el-input-number .el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  padding: 0;
}
</style>
