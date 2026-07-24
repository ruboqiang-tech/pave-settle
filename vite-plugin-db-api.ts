/**
 * Vite 开发服务器插件：提供 /api/db 端点。
 * 仅用于 Web 前端在本地开发环境读写数据库。
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import type { Plugin } from 'vite'

type StorageBackend = 'dev-api' | 'browser-file'

interface DatabaseFileSlot {
  label: string
  fileName: string
  absolutePath: string | null
  virtualPath: string | null
}

interface DatabaseFileSelectionConfig {
  version: 2
  backend: StorageBackend
  mainDatabase: DatabaseFileSlot
  globalDatabase: DatabaseFileSlot
  updatedAt: string
}

interface DatabaseConfigState {
  config: DatabaseFileSelectionConfig | null
  storageKind: StorageBackend
  mainDatabaseFilePath: string | null
  mainDatabaseFileName: string | null
  mainDatabaseFileExists: boolean
  mainDatabaseUpdatedAt: string | null
  globalDatabaseFilePath: string | null
  globalDatabaseFileName: string | null
  globalDatabaseFileExists: boolean
  globalDatabaseUpdatedAt: string | null
  canShowPhysicalPath: boolean

  // Legacy fields for backward compatibility
  customDatabaseRoot?: string | null
  currentDatabaseRoot?: string | null
  databaseFilePath?: string | null
  backupsPath?: string | null
  databaseFileExists?: boolean
  backupsDirExists?: boolean
  databaseFileName?: string | null
  databaseFileSize?: number | null
  databaseUpdatedAt?: string | null
  globalDatabaseFileSize?: number | null
  lastSelectedAt?: string | null
}

function ensureDir(target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }
}

function getConfigDir(): string {
  const configDir = path.join(os.homedir(), '.pave-settle-config')
  ensureDir(configDir)

  // Backward compatibility migration
  const newConfigPath = path.join(configDir, 'db-config.json')
  if (!fs.existsSync(newConfigPath)) {
    const legacyConfigPath = path.join(os.homedir(), '.settlement-management-config', 'db-config.json')
    if (fs.existsSync(legacyConfigPath)) {
      try {
        fs.copyFileSync(legacyConfigPath, newConfigPath)
        console.log(`[ViteDB-Config] Migrated database config from legacy location to: ${newConfigPath}`)
      } catch (err) {
        console.error(`[ViteDB-Config] Failed to migrate database config:`, err)
      }
    }
  }

  return configDir
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'db-config.json')
}

function normalizeInputPath(rawPath: string): string {
  let cleaned = rawPath.trim().replace(/^["']|["']$/g, '').trim()
  let resolvedPath = path.resolve(cleaned)
  
  const firstColon = resolvedPath.indexOf(':')
  if (firstColon !== -1) {
    const secondColon = resolvedPath.indexOf(':', firstColon + 1)
    if (secondColon !== -1) {
      const driveChar = resolvedPath.charAt(secondColon - 1)
      resolvedPath = path.resolve(driveChar + resolvedPath.substring(secondColon))
    }
  }
  return resolvedPath
}

function readDbConfig(configPath = getConfigPath()): DatabaseFileSelectionConfig {
  const defaultConfig: DatabaseFileSelectionConfig = {
    version: 2,
    backend: 'dev-api',
    mainDatabase: {
      label: '主业务库',
      fileName: 'pave.db',
      absolutePath: null,
      virtualPath: null,
    },
    globalDatabase: {
      label: '全局资产库',
      fileName: 'global-assets.db',
      absolutePath: null,
      virtualPath: null,
    },
    updatedAt: new Date().toISOString(),
  }

  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      const parsed = JSON.parse(data)
      if (parsed.version === 2) {
        return parsed as DatabaseFileSelectionConfig
      }
      
      // Migrate version 1 databaseRoot configuration
      if (typeof parsed.databaseRoot === 'string' && parsed.databaseRoot.trim() !== '') {
        const root = normalizeInputPath(parsed.databaseRoot)
        const migrated: DatabaseFileSelectionConfig = {
          version: 2,
          backend: 'dev-api',
          mainDatabase: {
            label: '主业务库',
            fileName: 'pave.db',
            absolutePath: path.join(root, 'pave.db'),
            virtualPath: null,
          },
          globalDatabase: {
            label: '全局资产库',
            fileName: 'global-assets.db',
            absolutePath: path.join(root, 'global-assets.db'),
            virtualPath: null,
          },
          updatedAt: new Date().toISOString(),
        }
        fs.writeFileSync(configPath, JSON.stringify(migrated, null, 2))
        console.log(`[ViteDB-Config] Migrated legacy databaseRoot: ${root} to v2 slots config.`)
        return migrated
      }
    }
  } catch (error) {
    console.error(`[ViteDB-Config] 读取配置文件失败: ${configPath}`, error)
  }
  return defaultConfig
}

function writeDbConfig(config: DatabaseFileSelectionConfig, configPath = getConfigPath()): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function getDatabaseConfigState(configPath = getConfigPath()): DatabaseConfigState {
  const config = readDbConfig(configPath)
  const mainPath = config.mainDatabase.absolutePath
  const globalPath = config.globalDatabase.absolutePath
  
  const mainExists = mainPath ? fs.existsSync(mainPath) : false
  const globalExists = globalPath ? fs.existsSync(globalPath) : false

  let mainDatabaseFileSize: number | null = null
  let mainDatabaseUpdatedAt: string | null = null
  if (mainExists && mainPath) {
    try {
      const stat = fs.statSync(mainPath)
      mainDatabaseFileSize = stat.size
      mainDatabaseUpdatedAt = stat.mtime.toISOString()
    } catch (e) {
      console.error('[ViteDB] 获取主库信息失败', e)
    }
  }

  let globalDatabaseFileSize: number | null = null
  let globalDatabaseUpdatedAt: string | null = null
  if (globalExists && globalPath) {
    try {
      const stat = fs.statSync(globalPath)
      globalDatabaseFileSize = stat.size
      globalDatabaseUpdatedAt = stat.mtime.toISOString()
    } catch (e) {
      console.error('[ViteDB] 获取资产库信息失败', e)
    }
  }

  const rootDir = mainPath ? path.dirname(mainPath) : null

  return {
    config,
    storageKind: config.backend,
    mainDatabaseFilePath: mainPath,
    mainDatabaseFileName: config.mainDatabase.fileName,
    mainDatabaseFileExists: mainExists,
    mainDatabaseUpdatedAt,
    globalDatabaseFilePath: globalPath,
    globalDatabaseFileName: config.globalDatabase.fileName,
    globalDatabaseFileExists: globalExists,
    globalDatabaseUpdatedAt,
    canShowPhysicalPath: true,

    // Legacy fields for backward compatibility during migration
    customDatabaseRoot: rootDir,
    currentDatabaseRoot: rootDir || '',
    databaseFilePath: mainPath,
    backupsPath: rootDir ? path.join(rootDir, 'backups') : null,
    databaseFileExists: mainExists,
    backupsDirExists: rootDir ? fs.existsSync(path.join(rootDir, 'backups')) : false,
    databaseFileName: config.mainDatabase.fileName,
    databaseFileSize: mainDatabaseFileSize,
    databaseUpdatedAt: mainDatabaseUpdatedAt,
    globalDatabaseFileSize,
    lastSelectedAt: config.updatedAt,
  }
}

export default function dbApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-db-api',
    configureServer(server) {
      server.middlewares.use('/api/db/open-dialog', (req, res, next) => {
        if (req.method === 'POST') {
          console.log(`[ViteDB-FileDialog] Triggering native file picker dialog`)
          const title = req.url?.includes('type=global') ? '选择企业全局资产库数据库文件 (global-assets.db)' : '选择项目事务主库数据库文件 (pave.db)'
          const psCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'SQLite Database (*.db)|*.db'; $f.Title = '${title}'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.FileName }`
          
          exec(`pwsh -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, (error, stdout) => {
            if (error) {
              console.log('[FileDialog] pwsh failed, falling back to powershell...')
              exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, (error2, stdout2) => {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                if (error2) {
                  console.error('[FileDialog] Both pwsh and powershell failed:', error2)
                  res.end(JSON.stringify({ path: null }))
                } else {
                  res.end(JSON.stringify({ path: stdout2.trim() || null }))
                }
              })
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ path: stdout.trim() || null }))
          })
          return
        }
        next()
      })

      server.middlewares.use('/api/db/config', (req, res, next) => {
        console.log(`[ViteDB-Config] ${req.method} ${req.url}`)
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(getDatabaseConfigState()))
          return
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as {
                action?: string
                path?: string
                databaseRoot?: string
                mode?: string
              }

              const config = readDbConfig()
              const action = body.action

              if (action === 'use-default-main') {
                const defaultMain = path.join(process.cwd(), 'data', 'pave.db')
                ensureDir(path.dirname(defaultMain))
                config.mainDatabase.absolutePath = defaultMain
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (action === 'use-default-global') {
                const defaultGlobal = path.join(process.cwd(), 'data', 'global-assets.db')
                ensureDir(path.dirname(defaultGlobal))
                config.globalDatabase.absolutePath = defaultGlobal
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (action === 'select-main') {
                const resolved = (body.path && body.path.trim()) ? normalizeInputPath(body.path) : null
                if (resolved) {
                  if (config.globalDatabase.absolutePath && resolved.toLowerCase() === config.globalDatabase.absolutePath.toLowerCase()) {
                    throw new Error('主业务库与全局资产库不得指向同一个文件')
                  }
                  ensureDir(path.dirname(resolved))
                }
                config.mainDatabase.absolutePath = resolved
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (action === 'select-global') {
                const resolved = (body.path && body.path.trim()) ? normalizeInputPath(body.path) : null
                if (resolved) {
                  if (config.mainDatabase.absolutePath && resolved.toLowerCase() === config.mainDatabase.absolutePath.toLowerCase()) {
                    throw new Error('主业务库与全局资产库不得指向同一个文件')
                  }
                  ensureDir(path.dirname(resolved))
                }
                config.globalDatabase.absolutePath = resolved
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (action === 'create-global-next-to-main') {
                if (!config.mainDatabase.absolutePath) {
                  throw new Error('主业务库尚未接入，无法在同目录下创建资产库')
                }
                const targetDir = path.dirname(config.mainDatabase.absolutePath)
                const targetGlobal = path.join(targetDir, 'global-assets.db')
                config.globalDatabase.absolutePath = targetGlobal
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (action === 'select-main-with-detected-global') {
                if (!body.path) throw new Error('未提供路径参数')
                const resolved = normalizeInputPath(body.path)
                ensureDir(path.dirname(resolved))
                config.mainDatabase.absolutePath = resolved
                
                const possibleGlobal = path.join(path.dirname(resolved), 'global-assets.db')
                if (fs.existsSync(possibleGlobal)) {
                  config.globalDatabase.absolutePath = possibleGlobal
                }
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else if (body.databaseRoot) {
                // Backward compatibility legacy POST config
                const root = normalizeInputPath(body.databaseRoot)
                ensureDir(root)
                config.mainDatabase.absolutePath = path.join(root, 'pave.db')
                config.globalDatabase.absolutePath = path.join(root, 'global-assets.db')
                config.updatedAt = new Date().toISOString()
                writeDbConfig(config)
              } else {
                throw new Error(`未知的动作或参数: ${JSON.stringify(body)}`)
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true }))
            } catch (error) {
              console.error('[ViteDB-Config] 保存配置失败', error)
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }))
            }
          })
          return
        }

        next()
      })

      server.middlewares.use('/api/db', async (req, res, next) => {
        console.log(`[ViteDB] ${req.method} ${req.url}`)
        if (req.url === '/config') return next()

        const [urlPath] = (req.url || '').split('?');
        
        // Handle deprecated backups endpoints by returning empty responses
        if (urlPath.startsWith('/backups')) {
          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify([]))
            return
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        const config = readDbConfig()

        if (urlPath === '/global' || urlPath === '/global/') {
          const globalPath = config.globalDatabase.absolutePath

          if (req.method === 'GET') {
            if (!globalPath || !fs.existsSync(globalPath)) {
              res.writeHead(204)
              res.end()
              return
            }
            const data = fs.readFileSync(globalPath)
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': data.length.toString(),
            })
            res.end(data)
            return
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              try {
                if (!globalPath) {
                  throw new Error('全局资产库尚未配置路径，无法写入')
                }
                ensureDir(path.dirname(globalPath))
                fs.writeFileSync(globalPath, Buffer.concat(chunks))
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(error) }))
              }
            })
            return
          }
        }

        if (urlPath === '' || urlPath === '/') {
          const mainPath = config.mainDatabase.absolutePath

          if (req.method === 'GET') {
            if (!mainPath || !fs.existsSync(mainPath)) {
              res.writeHead(204)
              res.end()
              return
            }
            const data = fs.readFileSync(mainPath)
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': data.length.toString(),
            })
            res.end(data)
            return
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              try {
                if (!mainPath) {
                  throw new Error('主业务库尚未配置路径，无法写入')
                }
                ensureDir(path.dirname(mainPath))
                fs.writeFileSync(mainPath, Buffer.concat(chunks))
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(error) }))
              }
            })
            return
          }
        }

        next()
      })

      console.log('📦 数据库位置 API 已就绪 (双库解耦模式)')
    },
  }
}

// Temporary backward compatibility helper functions for tests
function resolveConfiguredDatabaseRoot(raw: { databaseRoot?: unknown }): string | undefined {
  if (typeof raw.databaseRoot === 'string' && raw.databaseRoot.trim() !== '') {
    return normalizeInputPath(raw.databaseRoot)
  }
  return undefined
}

function ensureDatabaseScaffold(databaseRoot: string): void {
  ensureDir(databaseRoot)
  ensureDir(path.join(databaseRoot, 'backups'))
}

function writeDatabaseConfig(
  databaseRoot: string,
  _mode = 'existing',
  options?: { configPath?: string },
): void {
  const trimmed = databaseRoot.trim()
  if (trimmed === '') return
  
  const resolved = normalizeInputPath(trimmed)
  ensureDatabaseScaffold(resolved)

  const configPath = options?.configPath ?? getConfigPath()
  const config: { databaseRoot: string } = {
    databaseRoot: resolved,
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export const __internal = {
  normalizeInputPath,
  readDbConfig,
  writeDbConfig,
  getDatabaseConfigState,
  resolveConfiguredDatabaseRoot,
  ensureDatabaseScaffold,
  writeDatabaseConfig,
}
