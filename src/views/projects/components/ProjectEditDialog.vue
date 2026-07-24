<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑项目"
    width="500px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form :model="editForm" :label-width="labelWidth">
      <el-form-item label="项目编号"><el-input v-model="editForm.code" /></el-form-item>
      <el-form-item label="项目名称"><el-input v-model="editForm.name" /></el-form-item>
      <el-form-item label="项目地点"><el-input v-model="editForm.location" /></el-form-item>
      <el-form-item label="业主单位"><el-input v-model="editForm.ownerUnit" /></el-form-item>
      <el-form-item label="总包单位"><el-input v-model="editForm.generalContractor" /></el-form-item>
      <el-form-item label="项目状态">
        <el-select v-model="editForm.status" class="pd-field-full">
          <el-option label="准备中" value="preparing" />
          <el-option label="施工中" value="in_progress" />
          <el-option label="结算中" value="settling" />
          <el-option label="已完工" value="completed" />
        </el-select>
      </el-form-item>
      <el-form-item label="计划完工">
        <el-date-picker v-model="editForm.plannedEndDate" type="date" class="pd-field-full" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="项目难度">
        <el-radio-group v-model="editForm.difficulty">
          <el-radio-button value="easy">简单</el-radio-button>
          <el-radio-button value="medium">中等</el-radio-button>
          <el-radio-button value="hard">困难</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="$emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { ProjectEditForm } from '../project-detail.helpers'

defineEmits<{
  'update:modelValue': [value: boolean]
  save: []
}>()

defineProps<{
  modelValue: boolean
  editForm: ProjectEditForm
  labelWidth: string
}>()
</script>
