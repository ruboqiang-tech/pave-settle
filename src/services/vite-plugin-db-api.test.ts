import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { __internal } from '../../vite-plugin-db-api'

describe('vite-plugin-db-api config compatibility', () => {
  it('prefers databaseRoot as the current config contract', () => {
    const resolved = __internal.resolveConfiguredDatabaseRoot({
      databaseRoot: 'F:/Settlement/实例A',
    })

    expect(resolved).toContain('F:')
    expect(resolved?.replace(/\\/g, '/')).toContain('/Settlement/实例A')
  })

  it('does not resolve removed legacy database file path config anymore', () => {
    const resolved = __internal.resolveConfiguredDatabaseRoot({
      legacyDatabaseFilePath: 'F:/Settlement/实例B/pave.db',
    } as unknown as { databaseRoot?: unknown })

    expect(resolved).toBeUndefined()
  })

  it('does not resolve removed instanceRoot-only config anymore', () => {
    const resolved = __internal.resolveConfiguredDatabaseRoot({
      instanceRoot: 'F:/Settlement/旧实例',
    } as unknown as { databaseRoot?: unknown })

    expect(resolved).toBeUndefined()
  })

  it('creates scaffold for new databaseRoot config without keeping a stale db file', () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'settlement-dbroot-'))
    const targetRoot = join(sandboxRoot, '新空库')
    const staleDbPath = join(targetRoot, 'pave.db')

    try {
      __internal.ensureDatabaseScaffold(targetRoot)
      writeFileSync(staleDbPath, 'stale-db', 'utf8')

      __internal.writeDatabaseConfig(targetRoot, 'new', {
        configPath: join(sandboxRoot, 'db-config.json'),
      })

      const config = JSON.parse(readFileSync(join(sandboxRoot, 'db-config.json'), 'utf8')) as { databaseRoot?: string }
      expect(config.databaseRoot).toBe(targetRoot)
      expect(existsSync(join(targetRoot, 'backups'))).toBe(true)
      expect(existsSync(staleDbPath)).toBe(true)
    } finally {
      rmSync(sandboxRoot, { recursive: true, force: true })
    }
  })
})
