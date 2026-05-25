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
import { setStateAdapter } from '../src/state/index.js'
import { createFakeChannel } from './fixtures/fake-channel.js'

describe('draft approval_failed', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
  })

  it('returns approval_failed when onApprove throws', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const promise = draft<unknown, { id: number }>({
      context: {},
      produce: async () => ({ id: 1 }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '1h',
        onTimeout: 'reject',
      },
      onApprove: async () => {
        throw new Error('gmail down')
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const reviewId = channel.calls[0]!.reviewId
    const pending = getPendingReview(reviewId)!
    pending.deferred.resolve({
      status: 'approved',
      artifact: pending.artifact as { id: number },
      reviewId,
    })

    const result = await promise
    expect(result.status).toBe('approval_failed')
    if (result.status === 'approval_failed') {
      expect(result.artifact).toEqual({ id: 1 })
      expect(result.error.message).toBe('gmail down')
      expect(result.reviewId).toBe(reviewId)
    }
  })
})
