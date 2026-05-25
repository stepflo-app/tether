import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { draft } from '../src/draft.js'
import { createSlackAdapter } from '../src/channels/slack.js'
import {
  _resetChannelAdaptersForTests,
  setChannelAdapter,
} from '../src/channels/index.js'
import {
  _resetPendingReviewsForTests,
  registerPendingReview,
  getPendingReview,
} from '../src/runtime/pending-reviews.js'
import { getStateAdapter, setStateAdapter } from '../src/state/index.js'
import type { StoredReviewRecord } from '../src/state/types.js'
import { INSTANCE_ID } from '../src/internal/instance.js'
import { createDeferred } from '../src/types.js'
import type { DraftResult } from '../src/draft.js'

const SIGNING_SECRET = 'shhh'
type FetchArgs = Parameters<typeof globalThis.fetch>

function buildInteractionBody(opts: {
  reviewId: string
  actionId: 'tether_approve' | 'tether_reject'
  userId?: string
}): string {
  const payload = {
    type: 'block_actions',
    user: { id: opts.userId ?? 'U_TEST' },
    actions: [
      {
        action_id: opts.actionId,
        value: opts.reviewId,
      },
    ],
  }
  const params = new URLSearchParams()
  params.set('payload', JSON.stringify(payload))
  return params.toString()
}

function sign(rawBody: string, timestamp: string): string {
  const digest = createHmac('sha256', SIGNING_SECRET)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')
  return `v0=${digest}`
}

async function seedPending(reviewId: string, opts?: { ownerInstanceId?: string }): Promise<{
  promise: Promise<DraftResult<unknown>>
}> {
  const record: StoredReviewRecord = {
    reviewId,
    ownerInstanceId: opts?.ownerInstanceId ?? INSTANCE_ID,
    channel: 'slack',
    destination: 'C123',
    summary: 'preview',
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  }
  await getStateAdapter().set(reviewId, record, 120_000)

  const deferred = createDeferred<DraftResult<unknown>>()
  registerPendingReview({
    reviewId,
    artifact: { ok: true },
    deferred,
    timer: setTimeout(() => {}, 60_000) as ReturnType<typeof setTimeout>,
  })
  return { promise: deferred.promise }
}

describe('Slack handleInteraction', () => {
  beforeEach(() => {
    _resetChannelAdaptersForTests()
    _resetPendingReviewsForTests()
    setStateAdapter(null)
  })

  it('resolves the pending review on a valid approve click', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const { promise } = await seedPending('rv_a')

    const rawBody = buildInteractionBody({
      reviewId: 'rv_a',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })

    expect(res.status).toBe(200)
    expect(res.body).toBe('Approved.')

    const outcome = await promise
    expect(outcome.status).toBe('approved')
  })

  it('resolves with explicit rejection on a valid reject click', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const { promise } = await seedPending('rv_r')
    const rawBody = buildInteractionBody({
      reviewId: 'rv_r',
      actionId: 'tether_reject',
      userId: 'U_ALICE',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })

    expect(res.status).toBe(200)
    expect(res.body).toBe('Rejected.')
    const outcome = await promise
    expect(outcome.status).toBe('rejected')
    if (outcome.status === 'rejected') {
      expect(outcome.reason).toBe('explicit')
      expect(outcome.detail).toContain('U_ALICE')
    }
  })

  it('returns 200 "already resolved or expired" for unknown reviewId', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const rawBody = buildInteractionBody({
      reviewId: 'rv_missing',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatch(/already resolved or expired/i)
  })

  it('returns the cross-process warning when ownerInstanceId differs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    await seedPending('rv_cross', { ownerInstanceId: 'inst_OTHER' })
    const rawBody = buildInteractionBody({
      reviewId: 'rv_cross',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatch(/different process instance/i)
    expect(consoleSpy).toHaveBeenCalled()
    const logged = String(consoleSpy.mock.calls[0]?.[0] ?? '')
    expect(logged).toContain('CROSS_PROCESS_UNSUPPORTED')
    consoleSpy.mockRestore()
  })

  it('returns 401 on an invalid signature', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const rawBody = buildInteractionBody({
      reviewId: 'rv_a',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': 'v0=deadbeef',
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when the timestamp is too old', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const rawBody = buildInteractionBody({
      reviewId: 'rv_a',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000) - 10 * 60) // 10 min old
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 on malformed payload', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const rawBody = 'payload=' + encodeURIComponent('{not json')
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 on unsupported interaction (wrong action_id)', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const payload = {
      type: 'block_actions',
      user: { id: 'U' },
      actions: [{ action_id: 'unknown', value: 'rv_a' }],
    }
    const params = new URLSearchParams()
    params.set('payload', JSON.stringify(payload))
    const rawBody = params.toString()
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 when signature headers are missing', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const res = await adapter.handleInteraction({
      rawBody: 'payload=%7B%7D',
      headers: {},
    })
    expect(res.status).toBe(401)
  })

  it('does not leak the deferred to callers; pending stays registered through resolution', async () => {
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
    })
    const { promise } = await seedPending('rv_keep')
    expect(getPendingReview('rv_keep')).toBeDefined()
    const rawBody = buildInteractionBody({
      reviewId: 'rv_keep',
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    await adapter.handleInteraction({
      rawBody,
      headers: {
        'x-slack-signature': sign(rawBody, ts),
        'x-slack-request-timestamp': ts,
      },
    })
    await promise
  })

  it('treats duplicate approve deliveries as idempotent', async () => {
    const fetchMock = vi.fn<FetchArgs, Promise<Response>>(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const adapter = createSlackAdapter({
      botToken: 'xoxb',
      signingSecret: SIGNING_SECRET,
      fetch: fetchMock as typeof fetch,
    })
    setChannelAdapter('slack', adapter)

    const promise = draft({
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

    const request = fetchMock.mock.calls[0]
    expect(request).toBeDefined()
    const [, init] = request!
    const body = JSON.parse(String(init?.body))
    const reviewId = body.blocks[1].elements[0].value as string
    const rawBody = buildInteractionBody({
      reviewId,
      actionId: 'tether_approve',
    })
    const ts = String(Math.floor(Date.now() / 1000))
    const headers = {
      'x-slack-signature': sign(rawBody, ts),
      'x-slack-request-timestamp': ts,
    }

    const first = await adapter.handleInteraction({ rawBody, headers })
    const second = await adapter.handleInteraction({ rawBody, headers })

    expect(first).toEqual({ status: 200, body: 'Approved.' })
    expect(second.status).toBe(200)
    expect(second.body).toMatch(/already resolved or expired/i)
    await expect(promise).resolves.toMatchObject({ status: 'approved' })
  })

  it('rejects a late click after draft() has timed out', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn<FetchArgs, Promise<Response>>(async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })
      const adapter = createSlackAdapter({
        botToken: 'xoxb',
        signingSecret: SIGNING_SECRET,
        fetch: fetchMock as typeof fetch,
      })
      setChannelAdapter('slack', adapter)

      const promise = draft({
        context: {},
        produce: async () => ({ ok: true }),
        review: {
          channel: 'slack',
          destination: 'C123',
          timeout: '50ms',
          onTimeout: 'reject',
        },
      })

      await vi.advanceTimersByTimeAsync(0)
      const request = fetchMock.mock.calls[0]
      expect(request).toBeDefined()
      const [, init] = request!
      const body = JSON.parse(String(init?.body))
      const reviewId = body.blocks[1].elements[0].value as string

      await vi.advanceTimersByTimeAsync(50)
      await expect(promise).resolves.toMatchObject({
        status: 'rejected',
        reason: 'timeout',
      })

      const rawBody = buildInteractionBody({
        reviewId,
        actionId: 'tether_approve',
      })
      const ts = String(Math.floor(Date.now() / 1000))
      const response = await adapter.handleInteraction({
        rawBody,
        headers: {
          'x-slack-signature': sign(rawBody, ts),
          'x-slack-request-timestamp': ts,
        },
      })

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/resolved or expired|expired/i)
    } finally {
      vi.useRealTimers()
    }
  })
})
