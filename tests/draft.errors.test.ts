import { describe, it, expect, beforeEach } from 'vitest'
import { draft } from '../src/draft.js'
import {
  _resetChannelAdaptersForTests,
  setChannelAdapter,
} from '../src/channels/index.js'
import { _resetPendingReviewsForTests } from '../src/runtime/pending-reviews.js'
import { setStateAdapter } from '../src/state/index.js'
import { TetherError } from '../src/errors.js'
import { createFakeChannel } from './fixtures/fake-channel.js'
import type { StateAdapter } from '../src/state/index.js'

describe('draft error paths', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
  })

  it('throws PRODUCE_FAILED when produce throws', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    await expect(
      draft({
        context: {},
        produce: async () => {
          throw new Error('llm down')
        },
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '1h',
          onTimeout: 'reject',
        },
      }),
    ).rejects.toMatchObject({ code: 'PRODUCE_FAILED' })
  })

  it('throws CHANNEL_POST_FAILED when postReview throws', async () => {
    const channel = createFakeChannel()
    channel.throwOnNext = new Error('slack 500')
    setChannelAdapter('slack', channel)

    await expect(
      draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '1h',
          onTimeout: 'reject',
        },
      }),
    ).rejects.toMatchObject({ code: 'CHANNEL_POST_FAILED' })
  })

  it('throws STATE_FAILED when state.set throws', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    const brokenAdapter: StateAdapter = {
      async get() {
        return null
      },
      async set() {
        throw new Error('redis down')
      },
      async delete() {},
    }
    setStateAdapter(brokenAdapter)

    await expect(
      draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '1h',
          onTimeout: 'reject',
        },
      }),
    ).rejects.toMatchObject({ code: 'STATE_FAILED' })
  })

  it('throws INVALID_DURATION on a malformed timeout', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    await expect(
      draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: 'forever',
          onTimeout: 'reject',
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DURATION' })
  })

  it('throws INVALID_REVIEW_CONFIG on disallowed onTimeout', async () => {
    const channel = createFakeChannel()
    setChannelAdapter('slack', channel)

    await expect(
      draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '1h',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onTimeout: 'approve' as any,
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REVIEW_CONFIG' })
  })

  it('throws INVALID_REVIEW_CONFIG when no adapter is registered', async () => {
    // Note: no setChannelAdapter call.
    await expect(
      draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '1h',
          onTimeout: 'reject',
        },
      }),
    ).rejects.toBeInstanceOf(TetherError)
  })
})
