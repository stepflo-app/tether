/**
 * Serializable review metadata persisted via the {@link StateAdapter}.
 *
 * The stored record does NOT contain:
 *  - the full artifact
 *  - in-flight promises, Deferreds, or timer handles
 *  - user-provided callbacks
 *
 * It only carries enough information to:
 *  - handle stale Slack clicks ("already resolved or expired")
 *  - detect cross-instance callbacks (`ownerInstanceId`)
 *  - keep ~24h of debugging metadata about what happened
 */
export type StoredReviewRecord =
  | {
      reviewId: string
      ownerInstanceId: string
      channel: 'slack'
      destination: string
      summary: string
      status: 'pending'
      createdAt: number
      expiresAt: number
    }
  | {
      reviewId: string
      ownerInstanceId: string
      channel: 'slack'
      destination: string
      summary: string
      status: 'approved' | 'rejected' | 'approval_failed'
      createdAt: number
      expiresAt: number
      resolvedAt: number
      reason?: 'timeout' | 'explicit'
      detail?: string
      resolverUserId?: string
      errorMessage?: string
    }

/**
 * Pluggable storage for {@link StoredReviewRecord}s. Adapters are PASSIVE —
 * they only persist serializable bytes. They do NOT own in-flight promises
 * or timers, and they are NOT a cross-process resume engine in v0.1.
 *
 * A custom adapter (e.g. Redis, Postgres) in v0.1 buys you:
 *  - longer-lived metadata for debugging
 *  - cleaner stale-click messages even after a process restart
 *
 * It does NOT buy you:
 *  - resumable `draft()` calls after a restart
 *  - safe multi-replica deployments
 *  - serverless support
 */
export interface StateAdapter {
  get(key: string): Promise<StoredReviewRecord | null>
  set(key: string, value: StoredReviewRecord, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

/**
 * Bounded retention for terminal records — kept so that repeated Slack
 * clicks get a useful "already resolved" response and developers have a
 * 24h debug window. This is NOT marketed as a full audit trail.
 */
export const TERMINAL_RECORD_TTL_MS = 24 * 60 * 60 * 1000
