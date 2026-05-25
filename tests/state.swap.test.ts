import { describe, it, expect, beforeEach } from 'vitest'
import { draft } from '../src/draft.js'
import {
  _resetChannelAdaptersForTests,
  setChannelAdapter,
} from '../src/channels/index.js'
import {
  _resetPendingReviewsForTests,
  getPendingReview,
} from '../src/runtime/pending-reviews.js'
import { setStateAdapter, type StateAdapter, type StoredReviewRecord } from '../src/state/index.js'
import { createFakeChannel } from './fixtures/fake-channel.js'

/**
 * Verifies that a fake external state adapter is exercised end-to-end by
 * draft(), while the local pending registry retains ownership of the
 * deferred + timer.
 */
describe('draft with a swapped state adapter', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
  })

  it('uses the swapped adapter for storage, registry for deferred', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const store = new Map<string, StoredReviewRecord>()
    const calls: { method: string; key: string }[] = []
    const fake: StateAdapter = {
      async get(key) {
        calls.push({ method: 'get', key })
        return store.get(key) ?? null
      },
      async set(key, value) {
        calls.push({ method: 'set', key })
        store.set(key, value)
      },
      async delete(key) {
        calls.push({ method: 'delete', key })
        store.delete(key)
      },
    }
    setStateAdapter(fake)

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '1h',
        onTimeout: 'reject',
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(calls.find((c) => c.method === 'set')).toBeDefined()
    expect(channel.calls).toHaveLength(1)
    const reviewId = channel.calls[0]!.reviewId

    // Pending registry holds the in-flight promise.
    const pending = getPendingReview(reviewId)
    expect(pending).toBeDefined()

    // Stored record is in the external store and is pending.
    const stored = store.get(reviewId)
    expect(stored?.status).toBe('pending')

    // Resolve via the registry (simulating the Slack helper).
    pending!.deferred.resolve({
      status: 'approved',
      artifact: pending!.artifact as { ok: true },
      reviewId,
    })

    const result = await promise
    expect(result.status).toBe('approved')

    // Terminal record should have been persisted via the external adapter.
    const terminal = store.get(reviewId)
    expect(terminal?.status).toBe('approved')
  })
})
