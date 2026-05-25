import type { ChannelAdapter } from '../../src/channels/index.js'

export interface FakeChannelCall {
  reviewId: string
  destination: string
  summary: string
}

export interface FakeChannel extends ChannelAdapter {
  calls: FakeChannelCall[]
  throwOnNext: Error | null
}

/**
 * Test double for a channel adapter. Records every postReview call;
 * never actually contacts an external service.
 */
export function createFakeChannel(): FakeChannel {
  const channel: FakeChannel = {
    calls: [],
    throwOnNext: null,
    async postReview(args) {
      if (channel.throwOnNext) {
        const err = channel.throwOnNext
        channel.throwOnNext = null
        throw err
      }
      channel.calls.push({ ...args })
    },
  }
  return channel
}
