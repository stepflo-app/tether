import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { draft } from '../src/draft.js'
import {
  _resetChannelAdaptersForTests,
  setChannelAdapter,
} from '../src/channels/index.js'
import { _resetPendingReviewsForTests } from '../src/runtime/pending-reviews.js'
import { setStateAdapter, type StateAdapter } from '../src/state/index.js'
import { createFakeChannel } from './fixtures/fake-channel.js'

describe('draft timeout', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves rejected with reason=timeout when no one responds', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const onReject = vi.fn(async () => {})

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '50ms',
        onTimeout: 'reject',
      },
      onReject,
    })

    // Let produce + state.set + channel.postReview microtask chain settle.
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(50)

    const result = await promise
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.reason).toBe('timeout')
    }
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledWith('timeout', undefined)
  })

  it('does not post to Slack after the timeout has already fired', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    let setCalls = 0
    const slowStateAdapter: StateAdapter = {
      async get() {
        return null
      },
      async set() {
        setCalls += 1
        if (setCalls === 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 100)
          })
        }
      },
      async delete() {},
    }
    setStateAdapter(slowStateAdapter)

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '50ms',
        onTimeout: 'reject',
      },
    })

    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toMatchObject({
      status: 'rejected',
      reason: 'timeout',
    })
    expect(channel.calls).toHaveLength(0)
  })
})
