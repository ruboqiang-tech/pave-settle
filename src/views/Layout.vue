<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-collapsed': sidebarCollapsed }">
    <aside
      class="app-sidebar"
      :class="{ 'app-sidebar--collapsed': sidebarCollapsed }"
    >
      <div
        class="app-sidebar__brand"
        :class="{ 'app-sidebar__brand--collapsed': sidebarCollapsed }"
      >
        <div class="app-sidebar__logo">
          <el-icon class="app-sidebar__logo-icon"><OfficeBuilding /></el-icon>
        </div>
        <span v-if="!sidebarCollapsed" class="app-sidebar__title">{{ APP_SIDEBAR_TITLE }}</span>
        <el-button
          link
          class="app-icon-button app-sidebar__toggle"
          @click="toggleSidebar"
        >
          <el-icon class="app-sidebar__toggle-icon"><component :is="sidebarCollapsed ? Expand : Fold" /></el-icon>
        </el-button>
      </div>

      <nav class="app-sidebar__nav">
        <router-link
          v-for="item in appMenuItems"
          :key="item.path"
          :to="item.path"
          :title="item.title"
          class="app-sidebar__item"
          :class="{
            'app-sidebar__item--active': isActive(item.path)
          }"
        >
          <el-icon class="app-sidebar__item-icon" :class="{ 'app-sidebar__item-icon--collapsed': sidebarCollapsed }"><component :is="item.icon" /></el-icon>
          <span v-if="!sidebarCollapsed" class="app-sidebar__item-label">{{ item.title }}</span>
        </router-link>
      </nav>

      <div class="app-sidebar__footer">
        <template v-if="!sidebarCollapsed">
          <p class="app-sidebar__footer-version">v1.0.0</p>
        </template>
        <p v-else class="app-sidebar__footer-version app-sidebar__footer-version--compact">v1.0</p>
      </div>
    </aside>

    <main class="app-main">
      <header class="app-main-header">
        <div class="app-main-header__row">
          <div class="app-main-header__copy">
            <h1 class="app-main-header__title">{{ currentRoute.meta?.title || '首页' }}</h1>
            <p v-if="currentHeaderDescription" class="app-main-header__desc">{{ currentHeaderDescription }}</p>
          </div>
          <el-tooltip :content="isDark ? '切换为日间模式' : '切换为夜间模式'" placement="bottom">
            <el-button circle class="theme-toggle-button" @click="toggleTheme">
              <el-icon><component :is="isDark ? Sunny : Moon" /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </header>

      <div class="app-main-body">
        <el-alert
          v-if="showMainDbWarning"
          title="主业务库未接入"
          type="warning"
          description="当前尚未接入主业务库文件（处于临时内存模式，修改在刷新后丢失）。请前往「数据中心」选择接入主业务库文件或创建默认库。"
          show-icon
          :closable="false"
          style="margin-bottom: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.05);"
        />
        <el-alert
          v-if="showGlobalDbWarning"
          title="全局资产库未接入"
          type="warning"
          description="当前尚未接入全局资产库文件（价格库、定额库、系统设置等资产功能不可写）。请前往「数据中心」选择接入全局资产库文件或创建默认库。"
          show-icon
          :closable="false"
          style="margin-bottom: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.05);"
        />
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Expand, Fold, Moon, OfficeBuilding, Sunny } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { APP_SIDEBAR_TITLE } from '@/constants/app'
import { appMenuItems } from '@/router/app-shell'
import { isMainDatabaseConnected, isGlobalDatabaseConnected } from '@/services/db-core'

const route = useRoute()
const currentRoute = computed(() => route)
const SIDEBAR_STORAGE_KEY = 'layout.sidebar.collapsed'
const sidebarMediaQuery = window.matchMedia('(max-width: 1024px)')
const getStoredSidebarState = () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
const sidebarCollapsed = ref(sidebarMediaQuery.matches || getStoredSidebarState())
const { isDark, toggleTheme } = useTheme()

const currentHeaderDescription = computed(() => {
  return typeof route.meta?.description === 'string' ? route.meta.description : ''
})

const isMainDbConnected = computed(() => isMainDatabaseConnected())
const isGlobalDbConnected = computed(() => isGlobalDatabaseConnected())

const showMainDbWarning = computed(() => {
  const isBusinessPage = route.path !== '/data' && !route.path.startsWith('/costs')
  return !isMainDbConnected.value && isBusinessPage
})

const showGlobalDbWarning = computed(() => {
  const isAssetPage = route.path.startsWith('/costs')
  return !isGlobalDbConnected.value && isAssetPage
})

watch(sidebarCollapsed, (value) => {
  if (sidebarMediaQuery.matches) return
  localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? '1' : '0')
})

function syncSidebarForViewport(event: MediaQueryListEvent | MediaQueryList) {
  sidebarCollapsed.value = event.matches || getStoredSidebarState()
}

onMounted(() => {
  syncSidebarForViewport(sidebarMediaQuery)
  sidebarMediaQuery.addEventListener('change', syncSidebarForViewport)
})

onBeforeUnmount(() => {
  sidebarMediaQuery.removeEventListener('change', syncSidebarForViewport)
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  if (!sidebarMediaQuery.matches) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed.value ? '1' : '0')
  }
}
</script>
