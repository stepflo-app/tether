import { getChannelAdapter } from './channels/index.js'
import { TetherError } from './errors.js'
import { createReviewId } from './internal/id.js'
import { INSTANCE_ID } from './internal/instance.js'
import { renderPreview } from './internal/preview.js'
import {
  getPendingReview,
  registerPendingReview,
  resolvePendingReview,
  removePendingReview,
} from './runtime/pending-reviews.js'
import { getStateAdapter, TERMINAL_RECORD_TTL_MS } from './state/index.js'
import type { StoredReviewRecord } from './state/types.js'
import { parseDuration } from './timeout.js'
import { createDeferred, type RejectionReason } from './types.js'

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type DraftReviewConfig<TArtifact> = {
  channel: 'slack'
  destination: string
  timeout: string
  onTimeout: 'reject'
  message?: string | ((artifact: TArtifact) => string)
}

export type DraftResult<TArtifact> =
  | { status: 'approved'; artifact: TArtifact; reviewId: string }
  | {
      status: 'rejected'
      reason: RejectionReason
      reviewId: string
      detail?: string
    }
  | {
      status: 'approval_failed'
      artifact: TArtifact
      reviewId: string
      error: { message: string }
    }

export type DraftConfig<TContext, TArtifact> = {
  context: TContext
  produce: (ctx: TContext) => Promise<TArtifact>
  review: DraftReviewConfig<TArtifact>
  onApprove?: (artifact: TArtifact) => Promise<void>
  onReject?: (reason: RejectionReason, detail?: string) => Promise<void>
}

// ----------------------------------------------------------------------------
// draft()
// ----------------------------------------------------------------------------

/**
 * The `draft` primitive: agent produces an artifact, a human approves before
 * commit. In v0.1, `draft` is Slack-only and approve/reject only.
 *
 * v0.1 is single-process and same-instance only. The same Node process that
 * calls `draft()` must also receive the Slack interaction callback. Do not
 * deploy to multi-replica or serverless environments.
 */
export async function draft<TContext, TArtifact>(
  config: DraftConfig<TContext, TArtifact>,
): Promise<DraftResult<TArtifact>> {
  // 1. Validate review config (cheap, sync).
  validateReviewConfig(config.review as DraftReviewConfig<unknown>)
  const timeoutMs = parseDuration(config.review.timeout)

  // 2. Produce the artifact.
  let artifact: TArtifact
  try {
    artifact = await config.produce(config.context)
  } catch (err) {
    throw new TetherError(
      'PRODUCE_FAILED',
      `produce() threw: ${(err as Error).message ?? String(err)}`,
      err,
    )
  }

  // 3. Render preview.
  const summary = renderPreview(artifact, config.review.message)

  // 4. IDs + timestamps.
  const reviewId = createReviewId()
  const createdAt = Date.now()
  const expiresAt = createdAt + timeoutMs

  // 5. Create the deferred and arm the local timer FIRST, so the timer
  //    fires correctly even if state.set / channel.postReview are slow.
  const deferred = createDeferred<DraftResult<TArtifact>>()

  const timer = setTimeout(() => {
    resolvePendingReview(reviewId, {
      status: 'rejected',
      reason: 'timeout',
      reviewId,
    })
  }, timeoutMs)
  if (typeof timer.unref === 'function') {
    // Don't hold the event loop open just for a pending review timer.
    timer.unref()
  }

  registerPendingReview<TArtifact>({
    reviewId,
    artifact,
    deferred,
    timer,
    ...(config.onApprove ? { onApprove: config.onApprove } : {}),
    ...(config.onReject ? { onReject: config.onReject } : {}),
  })

  // 6. Persist pending record.
  const state = getStateAdapter()
  const pendingRecord: StoredReviewRecord = {
    reviewId,
    ownerInstanceId: INSTANCE_ID,
    channel: 'slack',
    destination: config.review.destination,
    summary,
    status: 'pending',
    createdAt,
    expiresAt,
  }
  try {
    await state.set(reviewId, pendingRecord, timeoutMs + TERMINAL_RECORD_TTL_MS)
  } catch (err) {
    removePendingReview(reviewId)
    throw new TetherError(
      'STATE_FAILED',
      `state.set threw while creating pending review: ${(err as Error).message ?? String(err)}`,
      err,
    )
  }

  // 7. Post to Slack via channel adapter.
  const adapter = getChannelAdapter(config.review.channel)
  if (!adapter) {
    removePendingReview(reviewId)
    // Best-effort cleanup; if state.delete fails we don't escalate.
    state.delete(reviewId).catch(() => {})
    throw new TetherError(
      'INVALID_REVIEW_CONFIG',
      `No channel adapter is registered for channel ${JSON.stringify(config.review.channel)}. ` +
        `Call setChannelAdapter('${config.review.channel}', createSlackAdapter(...)) before calling draft().`,
    )
  }

  // If the review already timed out while persistence or adapter lookup was in
  // flight, do not post a stale Slack message after the deadline.
  if (!getPendingReview(reviewId)) {
    const outcome = await deferred.promise
    await persistTerminalRecord(state, pendingRecord, outcome, Date.now())
    return outcome
  }

  try {
    await adapter.postReview({
      reviewId,
      destination: config.review.destination,
      summary,
    })
  } catch (err) {
    removePendingReview(reviewId)
    state.delete(reviewId).catch(() => {})
    if (err instanceof TetherError) throw err
    throw new TetherError(
      'CHANNEL_POST_FAILED',
      `channel.postReview threw: ${(err as Error).message ?? String(err)}`,
      err,
    )
  }

  // 8. Await resolution.
  const outcome = await deferred.promise

  // 9. Best-effort terminal-record persistence. Errors here are non-fatal —
  //    metadata retention is a debugging convenience, not the source of truth.
  const resolvedAt = Date.now()
  let finalResult: DraftResult<TArtifact> = outcome

  if (outcome.status === 'approved') {
    if (config.onApprove) {
      try {
        await config.onApprove(outcome.artifact)
      } catch (err) {
        finalResult = {
          status: 'approval_failed',
          artifact: outcome.artifact,
          reviewId,
          error: {
            message: (err as Error).message ?? String(err),
          },
        }
      }
    }
  } else if (outcome.status === 'rejected') {
    if (config.onReject) {
      try {
        await config.onReject(outcome.reason, outcome.detail)
      } catch (err) {
        console.error('[tether] onReject threw; ignoring:', err)
      }
    }
  }

  await persistTerminalRecord(state, pendingRecord, finalResult, resolvedAt)

  // 10. Remove local pending review.
  removePendingReview(reviewId)

  return finalResult
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function validateReviewConfig(review: DraftReviewConfig<unknown>): void {
  if (!review || typeof review !== 'object') {
    throw new TetherError('INVALID_REVIEW_CONFIG', 'review config is required')
  }
  if (review.channel !== 'slack') {
    throw new TetherError(
      'INVALID_REVIEW_CONFIG',
      `review.channel must be 'slack' in v0.1, got ${JSON.stringify(review.channel)}`,
    )
  }
  if (typeof review.destination !== 'string' || review.destination.length === 0) {
    throw new TetherError('INVALID_REVIEW_CONFIG', 'review.destination must be a non-empty string')
  }
  if (typeof review.timeout !== 'string' || review.timeout.length === 0) {
    throw new TetherError('INVALID_REVIEW_CONFIG', 'review.timeout must be a non-empty string')
  }
  if (review.onTimeout !== 'reject') {
    throw new TetherError(
      'INVALID_REVIEW_CONFIG',
      `review.onTimeout must be 'reject' for draft() in v0.1, got ${JSON.stringify(review.onTimeout)}`,
    )
  }
}

async function persistTerminalRecord(
  state: ReturnType<typeof getStateAdapter>,
  pendingRecord: StoredReviewRecord & { status: 'pending' },
  finalResult: DraftResult<unknown>,
  resolvedAt: number,
): Promise<void> {
  // Build the terminal record matching the DraftResult shape.
  let terminal: StoredReviewRecord
  if (finalResult.status === 'approved') {
    terminal = {
      reviewId: pendingRecord.reviewId,
      ownerInstanceId: pendingRecord.ownerInstanceId,
      channel: pendingRecord.channel,
      destination: pendingRecord.destination,
      summary: pendingRecord.summary,
      status: 'approved',
      createdAt: pendingRecord.createdAt,
      expiresAt: pendingRecord.expiresAt,
      resolvedAt,
    }
  } else if (finalResult.status === 'rejected') {
    terminal = {
      reviewId: pendingRecord.reviewId,
      ownerInstanceId: pendingRecord.ownerInstanceId,
      channel: pendingRecord.channel,
      destination: pendingRecord.destination,
      summary: pendingRecord.summary,
      status: 'rejected',
      createdAt: pendingRecord.createdAt,
      expiresAt: pendingRecord.expiresAt,
      resolvedAt,
      reason: finalResult.reason,
      ...(finalResult.detail !== undefined ? { detail: finalResult.detail } : {}),
    }
  } else {
    terminal = {
      reviewId: pendingRecord.reviewId,
      ownerInstanceId: pendingRecord.ownerInstanceId,
      channel: pendingRecord.channel,
      destination: pendingRecord.destination,
      summary: pendingRecord.summary,
      status: 'approval_failed',
      createdAt: pendingRecord.createdAt,
      expiresAt: pendingRecord.expiresAt,
      resolvedAt,
      errorMessage: finalResult.error.message,
    }
  }

  try {
    await state.set(terminal.reviewId, terminal, TERMINAL_RECORD_TTL_MS)
  } catch (err) {
    console.error('[tether] persistTerminalRecord failed; not escalating:', err)
  }
}
