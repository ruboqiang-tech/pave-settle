import { computed, readonly, ref } from 'vue'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'app.theme'
const theme = ref<AppTheme>('light')

let initialized = false

function getPreferredTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(nextTheme: AppTheme) {
  theme.value = nextTheme

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
  }
}

export function initTheme() {
  if (initialized) {
    applyTheme(theme.value)
    return
  }

  applyTheme(getPreferredTheme())
  initialized = true
}

export function useTheme() {
  return {
    theme: readonly(theme),
    isDark: computed(() => theme.value === 'dark'),
    setTheme: applyTheme,
    toggleTheme: () => applyTheme(theme.value === 'dark' ? 'light' : 'dark'),
  }
}
