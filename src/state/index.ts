import { createMemoryAdapter } from './memory-adapter.js'
import type { StateAdapter } from './types.js'

let activeAdapter: StateAdapter = createMemoryAdapter()

/**
 * Replace the active state adapter. Pass `null` or omit to reset to the
 * default in-memory adapter (mostly useful in tests).
 */
export function setStateAdapter(adapter: StateAdapter | null): void {
  activeAdapter = adapter ?? createMemoryAdapter()
}

/**
 * Internal accessor — not part of the public API.
 */
export function getStateAdapter(): StateAdapter {
  return activeAdapter
}

export { createMemoryAdapter }
export type { StateAdapter, StoredReviewRecord } from './types.js'
export { TERMINAL_RECORD_TTL_MS } from './types.js'
