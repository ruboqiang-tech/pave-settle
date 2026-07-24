import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureBrowserDirectoryPermission,
  getBrowserDirectoryLabel,
  isBrowserDirectoryPickerSupported,
  normalizeBrowserDirectoryError,
  pickBrowserDirectory,
} from './browser-directory-access.service'

describe('browser-directory-access.service', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects directory picker support and resolves trimmed labels', () => {
    vi.stubGlobal('window', {})
    expect(isBrowserDirectoryPickerSupported()).toBe(false)

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(),
    })
    expect(isBrowserDirectoryPickerSupported()).toBe(true)
    expect(getBrowserDirectoryLabel({ name: '  结算数据库  ' })).toBe('结算数据库')
    expect(getBrowserDirectoryLabel(null)).toBe('已选中文件夹')
  })

  it('returns granted permission directly when queryPermission already grants access', async () => {
    const queryPermission = vi.fn().mockResolvedValue('granted')
    const requestPermission = vi.fn().mockResolvedValue('granted')

    await expect(ensureBrowserDirectoryPermission({
      name: '实例A',
      queryPermission,
      requestPermission,
    })).resolves.toBe('granted')

    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('requests permission when current state is not granted', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt')
    const requestPermission = vi.fn().mockResolvedValue('granted')

    await expect(ensureBrowserDirectoryPermission({
      name: '实例A',
      queryPermission,
      requestPermission,
    }, 'read')).resolves.toBe('granted')

    expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' })
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' })
  })

  it('picks browser directory and returns handle with normalized label', async () => {
    const handle = {
      name: '  浏览器文件夹A  ',
      queryPermission: vi.fn().mockResolvedValue('granted'),
    }
    const showDirectoryPicker = vi.fn().mockResolvedValue(handle)
    vi.stubGlobal('window', { showDirectoryPicker })

    await expect(pickBrowserDirectory()).resolves.toEqual({
      handle,
      label: '浏览器文件夹A',
    })

    expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('normalizes permission errors from directory picker flow', async () => {
    const handle = {
      name: '浏览器文件夹B',
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    }
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(handle),
    })

    await expect(pickBrowserDirectory()).rejects.toThrow('当前文件夹访问权限不足，请重新授权后再试')
    expect(normalizeBrowserDirectoryError(new Error('permission denied'), 'fallback')).toBe('当前文件夹访问权限不足，请重新授权后再试')
  })
})
