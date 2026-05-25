import { createHmac, timingSafeEqual } from 'node:crypto'
import { TetherError } from '../errors.js'
import { INSTANCE_ID } from '../internal/instance.js'
import { truncate } from '../internal/preview.js'
import {
  getPendingReview,
  removePendingReview,
} from '../runtime/pending-reviews.js'
import { getStateAdapter, TERMINAL_RECORD_TTL_MS } from '../state/index.js'
import type { StoredReviewRecord } from '../state/types.js'
import type { ChannelAdapter } from './types.js'

const SLACK_TIMESTAMP_SKEW_SECONDS = 60 * 5
const SLACK_API_URL = 'https://slack.com/api/chat.postMessage'

/**
 * Public Slack adapter shape. v0.1 ships only this implementation of
 * {@link ChannelAdapter}, and it has one extension method — `handleInteraction`
 * — which encapsulates the Slack-specific webhook round trip.
 */
export interface SlackChannelAdapter extends ChannelAdapter {
  handleInteraction(args: {
    rawBody: string
    headers: Record<string, string | string[] | undefined>
  }): Promise<{ status: number; body: string }>
}

export interface CreateSlackAdapterOptions {
  botToken: string
  signingSecret: string
  /**
   * Override the outbound `fetch`. Used by tests; production code should
   * not need to set this.
   */
  fetch?: typeof globalThis.fetch
}

/**
 * Create a Slack channel adapter. Owns:
 *  - outbound `chat.postMessage` calls with approve/reject buttons
 *  - inbound interaction handling: signature verification, payload parsing,
 *    correlation to pending reviews, and stale-click responses
 */
export function createSlackAdapter(opts: CreateSlackAdapterOptions): SlackChannelAdapter {
  if (!opts.botToken || typeof opts.botToken !== 'string') {
    throw new TetherError('INVALID_REVIEW_CONFIG', 'createSlackAdapter: botToken is required')
  }
  if (!opts.signingSecret || typeof opts.signingSecret !== 'string') {
    throw new TetherError(
      'INVALID_REVIEW_CONFIG',
      'createSlackAdapter: signingSecret is required',
    )
  }

  const fetchImpl: typeof globalThis.fetch = opts.fetch ?? globalThis.fetch

  async function postReview(args: {
    reviewId: string
    destination: string
    summary: string
  }): Promise<void> {
    const summary = truncate(args.summary, 2500)
    const body = {
      channel: args.destination,
      text: 'Review needed',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Review needed*\n${summary}`,
          },
        },
        {
          type: 'actions',
          block_id: `tether_review_${args.reviewId}`,
          elements: [
            {
              type: 'button',
              style: 'primary',
              text: { type: 'plain_text', text: 'Approve' },
              action_id: 'tether_approve',
              value: args.reviewId,
            },
            {
              type: 'button',
              style: 'danger',
              text: { type: 'plain_text', text: 'Reject' },
              action_id: 'tether_reject',
              value: args.reviewId,
            },
          ],
        },
      ],
    }

    let response: Response
    try {
      response = await fetchImpl(SLACK_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new TetherError(
        'CHANNEL_POST_FAILED',
        `Slack chat.postMessage failed: ${(err as Error).message ?? String(err)}`,
        err,
      )
    }

    if (!response.ok) {
      throw new TetherError(
        'CHANNEL_POST_FAILED',
        `Slack chat.postMessage HTTP ${response.status}`,
      )
    }

    let json: unknown
    try {
      json = await response.json()
    } catch (err) {
      throw new TetherError(
        'CHANNEL_POST_FAILED',
        `Slack chat.postMessage returned non-JSON: ${(err as Error).message ?? String(err)}`,
        err,
      )
    }

    if (!isSlackOk(json)) {
      const errMsg =
        json && typeof json === 'object' && 'error' in json
          ? String((json as { error: unknown }).error)
          : 'unknown'
      throw new TetherError(
        'CHANNEL_POST_FAILED',
        `Slack chat.postMessage error: ${errMsg}`,
      )
    }
  }

  async function handleInteraction(args: {
    rawBody: string
    headers: Record<string, string | string[] | undefined>
  }): Promise<{ status: number; body: string }> {
    // 1. Verify signature.
    const signature = pickHeader(args.headers, 'x-slack-signature')
    const timestampRaw = pickHeader(args.headers, 'x-slack-request-timestamp')
    if (!signature || !timestampRaw) {
      return { status: 401, body: 'Missing Slack signature headers.' }
    }

    const timestamp = Number.parseInt(timestampRaw, 10)
    if (!Number.isFinite(timestamp)) {
      return { status: 401, body: 'Invalid Slack timestamp.' }
    }
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > SLACK_TIMESTAMP_SKEW_SECONDS) {
      return { status: 401, body: 'Slack request timestamp out of acceptable range.' }
    }

    const expected = computeSlackSignature(opts.signingSecret, timestampRaw, args.rawBody)
    if (!safeEqual(signature, expected)) {
      return { status: 401, body: 'Slack signature verification failed.' }
    }

    // 2. Parse the form-encoded payload.
    let payload: unknown
    try {
      const params = new URLSearchParams(args.rawBody)
      const payloadStr = params.get('payload')
      if (!payloadStr) {
        return { status: 400, body: 'Missing payload field in Slack request.' }
      }
      payload = JSON.parse(payloadStr)
    } catch {
      return { status: 400, body: 'Malformed Slack payload.' }
    }

    const parsed = parseInteractionPayload(payload)
    if (!parsed) {
      return { status: 400, body: 'Unsupported Slack interaction payload.' }
    }

    // 3. Look up the stored review record.
    const state = getStateAdapter()
    let record: StoredReviewRecord | null
    try {
      record = await state.get(parsed.reviewId)
    } catch (err) {
      // Don't expose internal details to Slack — but keep a server-side log.
      console.error('[tether] state.get threw while handling Slack interaction', err)
      return { status: 500, body: 'Internal error reading review state.' }
    }

    if (!record || record.status !== 'pending') {
      return { status: 200, body: 'This review is already resolved or expired.' }
    }

    if (Date.now() > record.expiresAt) {
      return { status: 200, body: 'This review has expired.' }
    }

    // 4. Cross-instance guard. v0.1 is single-process only.
    if (record.ownerInstanceId !== INSTANCE_ID) {
      console.error(
        '[tether] CROSS_PROCESS_UNSUPPORTED: Slack callback for review %s arrived on instance %s but was created on %s. v0.1 does not support multi-replica or serverless deployments.',
        parsed.reviewId,
        INSTANCE_ID,
        record.ownerInstanceId,
      )
      return {
        status: 200,
        body:
          'This review was started on a different process instance. ' +
          'tether v0.1 only supports single-process deployments — multi-replica and ' +
          'serverless are unsupported. See README "State & persistence".',
      }
    }

    // 5. Resolve the local pending review.
    const pending = getPendingReview(parsed.reviewId)
    if (!pending) {
      // Stored record says pending, but we have no local entry. Could be
      // a race between resolution paths, or pending was already drained.
      return { status: 200, body: 'This review is already resolved or expired.' }
    }

    if (parsed.action === 'approve') {
      // Resolve the deferred with approved; the awaiting draft() call will
      // run onApprove and decide between approved / approval_failed.
      pending.deferred.resolve({
        status: 'approved',
        artifact: pending.artifact,
        reviewId: parsed.reviewId,
      })
      return { status: 200, body: 'Approved.' }
    }

    // Explicit reject path.
    pending.deferred.resolve({
      status: 'rejected',
      reason: 'explicit',
      reviewId: parsed.reviewId,
      detail: parsed.userId ? `Rejected by Slack user ${parsed.userId}` : undefined,
    })
    return { status: 200, body: 'Rejected.' }
  }

  // Mark unused vars referenced for type guards.
  void removePendingReview
  void TERMINAL_RECORD_TTL_MS

  return {
    postReview,
    handleInteraction,
  }
}

// ----------------------------------------------------------------------------
// helpers (not exported)
// ----------------------------------------------------------------------------

function pickHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      const v = headers[key]
      if (Array.isArray(v)) return v[0]
      return v
    }
  }
  return undefined
}

function computeSlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
): string {
  const base = `v0:${timestamp}:${rawBody}`
  const digest = createHmac('sha256', signingSecret).update(base).digest('hex')
  return `v0=${digest}`
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) {
    // timingSafeEqual requires equal-length buffers; the early return is
    // unavoidable. The leak (length-only) is acceptable for Slack sigs.
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

interface ParsedInteraction {
  reviewId: string
  action: 'approve' | 'reject'
  userId?: string
}

function parseInteractionPayload(payload: unknown): ParsedInteraction | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  if (obj.type !== 'block_actions') return null

  const actions = obj.actions
  if (!Array.isArray(actions) || actions.length === 0) return null
  const first = actions[0]
  if (!first || typeof first !== 'object') return null
  const a = first as Record<string, unknown>
  const actionId = typeof a.action_id === 'string' ? a.action_id : undefined
  const value = typeof a.value === 'string' ? a.value : undefined

  if (!actionId || !value) return null

  let action: 'approve' | 'reject'
  if (actionId === 'tether_approve') {
    action = 'approve'
  } else if (actionId === 'tether_reject') {
    action = 'reject'
  } else {
    return null
  }

  let userId: string | undefined
  if (obj.user && typeof obj.user === 'object') {
    const u = obj.user as Record<string, unknown>
    if (typeof u.id === 'string') userId = u.id
  }

  return { reviewId: value, action, userId }
}

function isSlackOk(json: unknown): boolean {
  return (
    !!json &&
    typeof json === 'object' &&
    'ok' in json &&
    (json as { ok: unknown }).ok === true
  )
}
