import { describe, it, expect, beforeEach, vi } from 'vitest'
import { draft } from '../src/draft.js'
import {
  _resetChannelAdaptersForTests,
  setChannelAdapter,
} from '../src/channels/index.js'
import {
  _resetPendingReviewsForTests,
  getPendingReview,
} from '../src/runtime/pending-reviews.js'
import { setStateAdapter } from '../src/state/index.js'
import { createFakeChannel } from './fixtures/fake-channel.js'

describe('draft explicit reject', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
  })

  it('resolves rejected with reason=explicit when helper resolves explicit', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const onReject = vi.fn(async () => {})

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '1h',
        onTimeout: 'reject',
      },
      onReject,
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const reviewId = channel.calls[0]!.reviewId
    const pending = getPendingReview(reviewId)!
    pending.deferred.resolve({
      status: 'rejected',
      reason: 'explicit',
      reviewId,
      detail: 'Rejected by Slack user U999',
    })

    const result = await promise
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.reason).toBe('explicit')
      expect(result.detail).toContain('U999')
    }
    expect(onReject).toHaveBeenCalledWith('explicit', 'Rejected by Slack user U999')
  })

  it('does not throw when onReject itself throws', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '1h',
        onTimeout: 'reject',
      },
      onReject: async () => {
        throw new Error('side effect failed')
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const reviewId = channel.calls[0]!.reviewId
    getPendingReview(reviewId)!.deferred.resolve({
      status: 'rejected',
      reason: 'explicit',
      reviewId,
    })

    const result = await promise
    expect(result.status).toBe('rejected')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
