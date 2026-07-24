<template>
  <div class="ptc-chart theme-chart">
    <div class="ptc-legend">
      <div class="ptc-legend-item">
        <span class="ptc-legend-dot ptc-legend-dot--settlement"></span>
        <span>结算金额</span>
      </div>
      <div class="ptc-legend-item">
        <span class="ptc-legend-dot ptc-legend-dot--received"></span>
        <span>收款金额</span>
      </div>
    </div>

    <div v-if="isEmpty" class="ptc-empty theme-chart-empty">
      当前跨度内暂无结算或收款数据
    </div>

    <div v-else class="ptc-panel theme-chart-panel">
      <svg
        viewBox="0 0 720 280"
        class="ptc-svg"
        preserveAspectRatio="none"
        aria-label="结算收款趋势图"
        :style="{ fontFamily: chartFontFamily }"
      >
        <defs>
          <linearGradient id="settlement-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="palette.settlement" stop-opacity="0.25" />
            <stop offset="100%" :stop-color="palette.settlement" stop-opacity="0.02" />
          </linearGradient>
          <linearGradient id="received-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="palette.received" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="palette.received" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <g v-for="line in gridLines" :key="line.y">
          <line x1="52" :y1="line.y" x2="684" :y2="line.y" :stroke="palette.grid" stroke-dasharray="4 6" />
          <text x="44" :y="line.y + 4" text-anchor="end" font-size="11" :fill="palette.axisMuted">{{ line.label }}</text>
        </g>

        <path :d="settlementAreaPath" fill="url(#settlement-area)" />
        <path :d="receivedAreaPath" fill="url(#received-area)" />
        <path :d="settlementLinePath" fill="none" :stroke="palette.settlement" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <path :d="receivedLinePath" fill="none" :stroke="palette.received" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

        <g v-for="point in settlementPoints" :key="`settlement-${point.index}`">
          <circle :cx="point.x" :cy="point.y" r="4" :fill="palette.settlement" />
        </g>
        <g v-for="point in receivedPoints" :key="`received-${point.index}`">
          <circle :cx="point.x" :cy="point.y" r="4" :fill="palette.received" />
        </g>

        <g v-for="label in xAxisLabels" :key="label.index">
          <text :x="label.x" y="262" text-anchor="middle" font-size="11" :fill="palette.axis">{{ label.text }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import './payment-trend-chart.css'
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  labels: string[]
  settlementAmounts: number[]
  receivedAmounts: number[]
}>()

const { isDark } = useTheme()

const chartFontFamily = "'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function readThemeVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const palette = computed(() => {
  void isDark.value
  return {
    grid: readThemeVar('--chart-grid', '#E2E8F0'),
    axis: readThemeVar('--chart-axis', '#64748B'),
    axisMuted: readThemeVar('--chart-axis-muted', '#94A3B8'),
    settlement: readThemeVar('--chart-settlement', '#0EA5E9'),
    received: readThemeVar('--chart-received', '#10B981'),
  }
})

const chart = {
  left: 52,
  right: 684,
  top: 24,
  bottom: 236,
}

const maxValue = computed(() => {
  const values = [...props.settlementAmounts, ...props.receivedAmounts]
  const rawMax = Math.max(...values, 0)
  if (rawMax <= 0) return 1
  return Math.ceil(rawMax / 10) * 10
})

const isEmpty = computed(() => {
  return props.settlementAmounts.every(value => value === 0) && props.receivedAmounts.every(value => value === 0)
})

function valueToY(value: number) {
  const usableHeight = chart.bottom - chart.top
  return chart.bottom - (value / maxValue.value) * usableHeight
}

function buildPoints(values: number[]) {
  const step = values.length > 1 ? (chart.right - chart.left) / (values.length - 1) : 0
  return values.map((value, index) => ({
    index,
    x: chart.left + step * index,
    y: valueToY(value),
    value,
  }))
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function buildAreaPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  const start = points[0]
  const end = points[points.length - 1]
  return `${buildLinePath(points)} L ${end.x} ${chart.bottom} L ${start.x} ${chart.bottom} Z`
}

const settlementPoints = computed(() => buildPoints(props.settlementAmounts))
const receivedPoints = computed(() => buildPoints(props.receivedAmounts))
const settlementLinePath = computed(() => buildLinePath(settlementPoints.value))
const receivedLinePath = computed(() => buildLinePath(receivedPoints.value))
const settlementAreaPath = computed(() => buildAreaPath(settlementPoints.value))
const receivedAreaPath = computed(() => buildAreaPath(receivedPoints.value))

const gridLines = computed(() => {
  return Array.from({ length: 5 }, (_, index) => {
    const value = (maxValue.value / 4) * (4 - index)
    return {
      y: chart.top + ((chart.bottom - chart.top) / 4) * index,
      label: value.toFixed(0),
    }
  })
})

const xAxisLabels = computed(() => {
  const step = props.labels.length > 1 ? (chart.right - chart.left) / (props.labels.length - 1) : 0
  const labelStep = props.labels.length > 24 ? 6 : props.labels.length > 12 ? 3 : 1
  return props.labels
    .map((label, index) => ({
      index,
      x: chart.left + step * index,
      text: label,
    }))
    .filter(label => label.index % labelStep === 0 || label.index === props.labels.length - 1)
})
</script>
