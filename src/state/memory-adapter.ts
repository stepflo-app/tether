import type { StateAdapter, StoredReviewRecord } from './types.js'

/**
 * Default in-memory state adapter. Process-local, lost on restart. Cleans
 * itself up via per-key timers so memory usage stays bounded even if
 * `delete` is never called.
 */
export function createMemoryAdapter(): StateAdapter {
  const records = new Map<string, StoredReviewRecord>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearTimer(key: string): void {
    const existing = timers.get(key)
    if (existing) {
      clearTimeout(existing)
      timers.delete(key)
    }
  }

  return {
    async get(key: string): Promise<StoredReviewRecord | null> {
      return records.get(key) ?? null
    },

    async set(key: string, value: StoredReviewRecord, ttlMs: number): Promise<void> {
      records.set(key, value)
      clearTimer(key)
      if (ttlMs > 0) {
        const t = setTimeout(() => {
          records.delete(key)
          timers.delete(key)
        }, ttlMs)
        // Don't keep the Node event loop alive just to clean up state.
        if (typeof t.unref === 'function') {
          t.unref()
        }
        timers.set(key, t)
      }
    },

    async delete(key: string): Promise<void> {
      records.delete(key)
      clearTimer(key)
    },
  }
}
