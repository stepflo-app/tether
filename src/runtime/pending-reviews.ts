import type { Deferred, RejectionReason } from '../types.js'
import type { DraftResult } from '../draft.js'

/**
 * Process-local registry of pending reviews. This is where in-flight
 * promises, timers, and user-provided callbacks live. State adapters
 * never touch any of this — they only persist serializable metadata.
 *
 * This registry is THE reason v0.1 is single-process only.
 */
export interface PendingReview<TArtifact = unknown> {
  reviewId: string
  artifact: TArtifact
  deferred: Deferred<DraftResult<TArtifact>>
  timer: ReturnType<typeof setTimeout>
  onApprove?: (artifact: TArtifact) => Promise<void>
  onReject?: (reason: RejectionReason, detail?: string) => Promise<void>
}

const registry = new Map<string, PendingReview<unknown>>()

export function registerPendingReview<TArtifact>(review: PendingReview<TArtifact>): void {
  registry.set(review.reviewId, review as PendingReview<unknown>)
}

export function getPendingReview(reviewId: string): PendingReview<unknown> | undefined {
  return registry.get(reviewId)
}

/**
 * Resolve and remove a pending review atomically from the local registry.
 *
 * This is the only safe way for timers and channel helpers to settle a review:
 * it prevents duplicate Slack deliveries (or timeout-vs-click races) from
 * claiming success more than once.
 */
export function resolvePendingReview<TArtifact>(
  reviewId: string,
  outcome: DraftResult<TArtifact>,
): boolean {
  const existing = registry.get(reviewId) as PendingReview<TArtifact> | undefined
  if (!existing) {
    return false
  }

  clearTimeout(existing.timer)
  registry.delete(reviewId)
  existing.deferred.resolve(outcome)
  return true
}

export function removePendingReview(reviewId: string): void {
  const existing = registry.get(reviewId)
  if (existing) {
    clearTimeout(existing.timer)
    registry.delete(reviewId)
  }
}

/**
 * Test-only helper. Not part of the public API.
 */
export function _resetPendingReviewsForTests(): void {
  for (const review of registry.values()) {
    clearTimeout(review.timer)
  }
  registry.clear()
}
