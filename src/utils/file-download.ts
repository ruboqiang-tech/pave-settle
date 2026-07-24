export type SaveFileMethod = 'file-system-access' | 'browser-download'

export interface SaveFileResult {
  canceled: boolean
  fileName: string
  method: SaveFileMethod
}

interface FilePickerWritable {
  write(data: Blob): Promise<void> | void
  close(): Promise<void> | void
}

interface FilePickerHandle {
  name?: string
  createWritable(): Promise<FilePickerWritable>
}

interface SaveFilePickerAccept {
  description: string
  accept: Record<string, string[]>
}

interface SaveFilePickerOptions {
  suggestedName: string
  types?: SaveFilePickerAccept[]
}

type SaveFilePicker = (options: SaveFilePickerOptions) => Promise<FilePickerHandle>

export interface SaveBlobFileOptions {
  fileName: string
  description: string
  mimeType: string
  extensions: string[]
}

function getSaveFilePicker(): SaveFilePicker | null {
  const candidate = (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker
  return typeof candidate === 'function' ? candidate as SaveFilePicker : null
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'AbortError'
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function saveBlobFile(blob: Blob, options: SaveBlobFileOptions): Promise<SaveFileResult> {
  const picker = getSaveFilePicker()

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: options.fileName,
        types: [{
          description: options.description,
          accept: {
            [options.mimeType]: options.extensions,
          },
        }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return {
        canceled: false,
        fileName: handle.name || options.fileName,
        method: 'file-system-access',
      }
    } catch (error) {
      if (isAbortError(error)) {
        return {
          canceled: true,
          fileName: options.fileName,
          method: 'file-system-access',
        }
      }
    }
  }

  triggerBrowserDownload(blob, options.fileName)
  return {
    canceled: false,
    fileName: options.fileName,
    method: 'browser-download',
  }
}

export function buildSaveFileSuccessMessage(result: SaveFileResult, action = '导出'): string {
  if (result.method === 'file-system-access') {
    return `${action}完成：${result.fileName}`
  }

  return `已开始下载：${result.fileName}`
}
