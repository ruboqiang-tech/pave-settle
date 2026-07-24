<template>
  <div class="spc-chart theme-chart">
    <div v-if="projects.length === 0" class="spc-empty theme-chart-empty">
      暂无项目数据
    </div>

    <div v-else class="spc-stack">
      <div
        v-for="project in rankedProjects"
        :key="project.name"
        class="spc-item theme-project-item"
      >
        <div class="spc-item-head">
          <div class="spc-item-meta">
            <div class="spc-item-title">{{ project.name }}</div>
            <div class="spc-item-desc">
              已结算 {{ project.settledAmount.toFixed(3) }} / 已收款 {{ project.receivedAmount.toFixed(3) }}
            </div>
          </div>
          <div class="spc-item-value" :class="project.progress >= 90 ? 'spc-item-value--success' : 'spc-item-value--warning'">
            {{ project.progress.toFixed(1) }}%
          </div>
        </div>

        <div class="spc-track theme-progress-track">
          <div
            class="spc-bar"
            :class="project.progress >= 90 ? 'spc-bar--success' : 'spc-bar--warning'"
            :style="{ width: `${Math.min(project.progress, 100)}%` }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './settlement-progress-chart.css'
import { computed } from 'vue'

const props = defineProps<{
  projects: { name: string; settledAmount: number; receivedAmount: number }[]
}>()

const rankedProjects = computed(() => {
  return [...props.projects]
    .map(project => ({
      ...project,
      progress: project.settledAmount > 0 ? (project.receivedAmount / project.settledAmount) * 100 : 0,
    }))
    .sort((left, right) => right.progress - left.progress)
    .slice(0, 6)
})
</script>
