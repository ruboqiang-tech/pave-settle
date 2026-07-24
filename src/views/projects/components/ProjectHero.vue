<template>
  <div class="pd-panel pd-hero">
    <div class="pd-hero-head">
      <div class="pd-hero-copy">
        <h1 class="pd-hero-title">{{ project.name }}</h1>
        <p class="pd-hero-meta">{{ project.code }} · {{ projectTypeText }}</p>
      </div>
      <div class="pd-hero-actions">
        <el-tag :type="getStatusType(project.status)" size="large">{{ getStatusText(project.status) }}</el-tag>
        <el-button type="primary" size="small" @click="$emit('edit')">编辑</el-button>
      </div>
    </div>
    <el-descriptions :column="4" border size="small">
      <el-descriptions-item label="工程类型">{{ projectTypeText }}</el-descriptions-item>
      <el-descriptions-item label="项目地点">{{ project.location || '-' }}</el-descriptions-item>
      <el-descriptions-item label="项目难度">
        <el-tag :type="getDifficultyTagType(project.difficulty)" size="small">
          {{ getDifficultyText(project.difficulty) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="项目规模">
        <el-tag :type="getScaleTagType(projectScale)" size="small">
          {{ getScaleText(projectScale) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="业主单位">{{ project.ownerUnit || '-' }}</el-descriptions-item>
      <el-descriptions-item label="总包单位">{{ project.generalContractor || '-' }}</el-descriptions-item>
      <el-descriptions-item label="开工日期">{{ project.startDate || '-' }}</el-descriptions-item>
      <el-descriptions-item label="计划完工">{{ project.plannedEndDate || '-' }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@/types'
import { getStatusText, getStatusType } from '../project-detail.helpers'

defineEmits<{
  edit: []
}>()

const props = defineProps<{
  project: Project
  projectScale: 'small' | 'medium' | 'large'
}>()

const projectTypeText = computed(() => props.project.projectType === 'highway' ? '公路工程' : '市政工程')

function getDifficultyText(difficulty?: 'easy' | 'medium' | 'hard'): string {
  if (difficulty === 'easy') return '简单'
  if (difficulty === 'hard') return '困难'
  return '中等'
}

function getDifficultyTagType(difficulty?: 'easy' | 'medium' | 'hard'): 'success' | 'warning' | 'danger' | 'info' {
  if (difficulty === 'easy') return 'success'
  if (difficulty === 'hard') return 'danger'
  return 'warning'
}

function getScaleText(scale: 'small' | 'medium' | 'large'): string {
  if (scale === 'small') return '小型'
  if (scale === 'large') return '大型'
  return '中型'
}

function getScaleTagType(scale: 'small' | 'medium' | 'large'): 'info' | 'primary' | 'success' {
  if (scale === 'small') return 'info'
  if (scale === 'large') return 'success'
  return 'primary'
}
</script>
