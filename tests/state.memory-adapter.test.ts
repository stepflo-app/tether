import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryAdapter } from '../src/state/memory-adapter.js'
import type { StoredReviewRecord } from '../src/state/types.js'

const makeRecord = (overrides: Partial<StoredReviewRecord> = {}): StoredReviewRecord =>
  ({
    reviewId: 'rv_test',
    ownerInstanceId: 'inst_test',
    channel: 'slack',
    destination: 'C123',
    summary: 'summary',
    status: 'pending',
    createdAt: 1,
    expiresAt: 100,
    ...overrides,
  }) as StoredReviewRecord

describe('createMemoryAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips set / get / delete', async () => {
    const adapter = createMemoryAdapter()
    const rec = makeRecord()
    await adapter.set('k1', rec, 10_000)
    expect(await adapter.get('k1')).toEqual(rec)
    await adapter.delete('k1')
    expect(await adapter.get('k1')).toBeNull()
  })

  it('returns null for missing keys', async () => {
    const adapter = createMemoryAdapter()
    expect(await adapter.get('missing')).toBeNull()
  })

  it('clears records after TTL', async () => {
    const adapter = createMemoryAdapter()
    await adapter.set('k', makeRecord(), 1_000)
    expect(await adapter.get('k')).not.toBeNull()
    vi.advanceTimersByTime(1_001)
    expect(await adapter.get('k')).toBeNull()
  })

  it('overwriting resets TTL', async () => {
    const adapter = createMemoryAdapter()
    await adapter.set('k', makeRecord({ summary: 'a' }), 1_000)
    vi.advanceTimersByTime(500)
    await adapter.set('k', makeRecord({ summary: 'b' }), 1_000)
    vi.advanceTimersByTime(800)
    // First TTL would have fired at +1000; with the reset it fires at +1300.
    expect((await adapter.get('k'))?.summary).toBe('b')
    vi.advanceTimersByTime(300)
    expect(await adapter.get('k')).toBeNull()
  })

  it('retains terminal records for the requested TTL', async () => {
    const adapter = createMemoryAdapter()
    const terminal = makeRecord({
      status: 'approved',
      resolvedAt: 5,
    } as Partial<StoredReviewRecord>)
    await adapter.set('k', terminal, 60_000)
    vi.advanceTimersByTime(30_000)
    expect(await adapter.get('k')).not.toBeNull()
    vi.advanceTimersByTime(31_000)
    expect(await adapter.get('k')).toBeNull()
  })
})
