import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  appMountMock,
  appUseMock,
  createAppMock,
  initDatabaseMock,
  repairLegacySettlementDetailLinksMock,
} = vi.hoisted(() => {
  const appMountMock = vi.fn()
  const appUseMock = vi.fn(() => ({ mount: appMountMock }))
  const createAppMock = vi.fn(() => ({
    use: appUseMock,
    mount: appMountMock,
  }))
  const initDatabaseMock = vi.fn()
  const repairLegacySettlementDetailLinksMock = vi.fn()

  return {
    appMountMock,
    appUseMock,
    createAppMock,
    initDatabaseMock,
    repairLegacySettlementDetailLinksMock,
  }
})

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    createApp: createAppMock,
  }
})

vi.mock('./router', () => ({
  default: {},
}))

vi.mock('./services/db-core', () => ({
  initDatabase: initDatabaseMock,
}))

vi.mock('./services/settlement-link-repair.service', () => ({
  repairLegacySettlementDetailLinks: repairLegacySettlementDetailLinksMock,
}))

vi.mock('./composables/useTheme', () => ({
  initTheme: vi.fn(),
}))

vi.mock('./App.vue', () => ({
  default: {},
}))

describe('main bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('blocks mount when database initialization fails', async () => {
    initDatabaseMock.mockRejectedValue(new Error('init failed'))

    const { bootstrap } = await import('./main')
    await bootstrap()

    expect(initDatabaseMock).toHaveBeenCalledTimes(1)
    expect(repairLegacySettlementDetailLinksMock).not.toHaveBeenCalled()
    expect(createAppMock).not.toHaveBeenCalled()
    expect(appUseMock).not.toHaveBeenCalled()
    expect(appMountMock).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('数据库初始化失败')
  })
})
