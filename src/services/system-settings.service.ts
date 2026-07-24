import { getGlobalDb as getDb, saveGlobalToStorage as saveToStorage } from './db-core'

export const systemSettingsService = {
  async get(key: string, defaultValue: string): Promise<string> {
    const db = getDb()
    if (!db) return defaultValue
    try {
      const result = db.exec('SELECT value FROM system_settings WHERE key = ?', [key])
      if (result.length === 0 || result[0].values.length === 0) return defaultValue
      return String(result[0].values[0][0])
    } catch (e) {
      console.warn(`[SystemSettings] Failed to get key: ${key}`, e)
      return defaultValue
    }
  },

  async set(key: string, value: string): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    db.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, value])
    await saveToStorage()
  },

  async getProjectScaleThresholds(): Promise<{ small: number; large: number }> {
    const smallStr = await this.get('project_scale_small', '5000000')
    const largeStr = await this.get('project_scale_large', '20000000')
    return {
      small: Number(smallStr),
      large: Number(largeStr),
    }
  },

  async setProjectScaleThresholds(small: number, large: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('project_scale_small', ?)", [String(small)])
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('project_scale_large', ?)", [String(large)])
    await saveToStorage()
  }
}
