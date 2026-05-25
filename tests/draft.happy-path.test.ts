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

describe('draft happy path', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null) // reset to fresh memory adapter
  })

  it('produces artifact, posts to channel, and resolves on approve', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const onApprove = vi.fn(async () => {})

    type Email = { to: string; subject: string; body: string }
    const promise = draft<{ topic: string }, Email>({
      context: { topic: 'standup' },
      produce: async (ctx) => ({
        to: 'team@example.com',
        subject: `Follow-up: ${ctx.topic}`,
        body: 'Hi team',
      }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '5m',
        onTimeout: 'reject',
      },
      onApprove,
    })

    // Wait for produce + post to settle so the pending review is registered.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(channel.calls).toHaveLength(1)
    const reviewId = channel.calls[0]!.reviewId
    expect(reviewId).toMatch(/^rv_/)

    const pending = getPendingReview(reviewId)
    expect(pending).toBeDefined()

    // Simulate Slack approval by resolving the deferred directly with the
    // approved branch — this is exactly what handleInteraction() does.
    pending!.deferred.resolve({
      status: 'approved',
      artifact: pending!.artifact as Email,
      reviewId,
    })

    const result = await promise
    expect(result.status).toBe('approved')
    expect(onApprove).toHaveBeenCalledTimes(1)
    if (result.status === 'approved') {
      expect(result.artifact.subject).toBe('Follow-up: standup')
      expect(result.reviewId).toBe(reviewId)
    }
  })

  it('returns approved with no onApprove configured', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const promise = draft<unknown, { ok: true }>({
      context: {},
      produce: async () => ({ ok: true }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '5m',
        onTimeout: 'reject',
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const pending = getPendingReview(channel.calls[0]!.reviewId)!
    pending.deferred.resolve({
      status: 'approved',
      artifact: pending.artifact as { ok: true },
      reviewId: pending.reviewId,
    })

    await expect(promise).resolves.toMatchObject({ status: 'approved' })
  })

  it('renders preview via message string when provided', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const promise = draft<unknown, { body: string }>({
      context: {},
      produce: async () => ({ body: 'hi' }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '5m',
        onTimeout: 'reject',
        message: 'static preview',
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(channel.calls[0]!.summary).toBe('static preview')

    const pending = getPendingReview(channel.calls[0]!.reviewId)!
    pending.deferred.resolve({
      status: 'approved',
      artifact: pending.artifact as { body: string },
      reviewId: pending.reviewId,
    })
    await promise
  })

  it('renders preview via message function when provided', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const promise = draft<unknown, { to: string }>({
      context: {},
      produce: async () => ({ to: 'a@b.c' }),
      review: {
        channel: 'slack',
        destination: 'C123',
        timeout: '5m',
        onTimeout: 'reject',
        message: (artifact) => `email to ${artifact.to}`,
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(channel.calls[0]!.summary).toBe('email to a@b.c')

    const pending = getPendingReview(channel.calls[0]!.reviewId)!
    pending.deferred.resolve({
      status: 'approved',
      artifact: pending.artifact as { to: string },
      reviewId: pending.reviewId,
    })
    await promise
  })
})
