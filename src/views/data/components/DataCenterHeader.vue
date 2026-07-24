<template>
  <header class="hero-banner dc-split-card lg:items-center">
    <div class="max-w-3xl space-y-2">
      <div class="dc-header-block">
        <span class="hero-kicker">ADMINISTRATION HUB</span>
        <span class="pulse-indicator">
          <span class="ping"></span>
          <span class="core"></span>
        </span>
      </div>
      <h2 class="hero-title">数据中心</h2>
      <p class="hero-desc">
        核心存储状态监控与容灾管理。系统基于
        <b class="dc-accent-text">数据库存放位置、主库文件与备份目录</b>
        契约进行本地数据调度与接管。
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-3 shrink-0">
      <el-tooltip :content="`数据来源：${versionInfo.activeSourceLabel}`" placement="top" effect="dark">
        <div class="status-badge">
          <span class="status-dot" :class="activeSourceDotClass"></span>
          <span class="status-text">{{ versionInfo.activeSourceLabel }}</span>
        </div>
      </el-tooltip>
      <el-tag :type="structureStatusType" effect="dark" class="glowing-tag uppercase tracking-wider font-semibold">
        {{ structureStatusText }}
      </el-tag>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { CurrentDatabaseVersionInfo } from '@/services/db-core'

defineProps<{
  versionInfo: CurrentDatabaseVersionInfo
  activeSourceDotClass: string
  structureStatusType: 'success' | 'warning' | 'danger'
  structureStatusText: string
}>()
</script>
