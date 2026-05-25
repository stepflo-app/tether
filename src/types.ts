/**
 * Shared shapes used across the library.
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'approval_failed'

export type RejectionReason = 'timeout' | 'explicit'

/**
 * A tiny Deferred utility — a Promise plus a resolver pair. Used by the
 * process-local pending-review registry to suspend the `draft()` call
 * until either a timeout fires or a Slack interaction resolves it.
 */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
