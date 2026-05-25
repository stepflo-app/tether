import { describe, it, expect, vi } from 'vitest'
import { createSlackAdapter } from '../src/channels/slack.js'
import { TetherError } from '../src/errors.js'

type FetchArgs = Parameters<typeof globalThis.fetch>

const okResponse = () =>
  new Response(JSON.stringify({ ok: true, channel: 'C123', ts: '1.2' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('Slack postReview', () => {
  it('POSTs to chat.postMessage with Bearer auth and Block Kit body', async () => {
    const fetchMock = vi.fn<FetchArgs, Promise<Response>>(async () => okResponse())
    const adapter = createSlackAdapter({
      botToken: 'xoxb-test',
      signingSecret: 'sec',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await adapter.postReview({
      reviewId: 'rv_abc',
      destination: 'C123',
      summary: 'hello',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call!
    expect(url).toBe('https://slack.com/api/chat.postMessage')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer xoxb-test')
    expect(headers['Content-Type']).toMatch(/application\/json/)
    const body = JSON.parse(String(init?.body))
    expect(body.channel).toBe('C123')
    expect(body.blocks).toHaveLength(2)
    expect(body.blocks[0].text.text).toContain('hello')
    expect(body.blocks[1].block_id).toBe('tether_review_rv_abc')
    const approve = body.blocks[1].elements.find(
      (e: Record<string, unknown>) => e.action_id === 'tether_approve',
    )
    expect(approve.value).toBe('rv_abc')
  })

  it('throws CHANNEL_POST_FAILED on non-ok HTTP status', async () => {
    const fetchMock = vi.fn<FetchArgs, Promise<Response>>(
      async () => new Response('boom', { status: 500 }),
    )
    const adapter = createSlackAdapter({
      botToken: 'xoxb-test',
      signingSecret: 'sec',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(
      adapter.postReview({
        reviewId: 'rv_x',
        destination: 'C1',
        summary: 's',
      }),
    ).rejects.toMatchObject({ code: 'CHANNEL_POST_FAILED' })
  })

  it('throws CHANNEL_POST_FAILED when Slack returns 200 but ok:false', async () => {
    const fetchMock = vi.fn<FetchArgs, Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ ok: false, error: 'not_in_channel' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const adapter = createSlackAdapter({
      botToken: 'xoxb-test',
      signingSecret: 'sec',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(
      adapter.postReview({ reviewId: 'rv_x', destination: 'C1', summary: 's' }),
    ).rejects.toMatchObject({
      code: 'CHANNEL_POST_FAILED',
    })
  })

  it('truncates long previews before sending', async () => {
    const longText = 'A'.repeat(10_000)
    const fetchMock = vi.fn<FetchArgs, Promise<Response>>(async () => okResponse())
    const adapter = createSlackAdapter({
      botToken: 'xoxb-test',
      signingSecret: 'sec',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await adapter.postReview({
      reviewId: 'rv_x',
      destination: 'C1',
      summary: longText,
    })

    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const init = call![1]
    const body = JSON.parse(String(init?.body))
    expect(body.blocks[0].text.text.length).toBeLessThan(longText.length)
    expect(body.blocks[0].text.text).toContain('truncated')
  })

  it('throws on bad config', () => {
    expect(() =>
      createSlackAdapter({ botToken: '', signingSecret: 'x' }),
    ).toThrow(TetherError)
    expect(() =>
      createSlackAdapter({ botToken: 'x', signingSecret: '' }),
    ).toThrow(TetherError)
  })
})
