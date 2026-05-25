/**
 * Stable error codes for tether v0.1.
 *
 * These codes are part of the public surface — downstream code is expected to
 * branch on them when handling failures, so any change here is a breaking
 * change.
 */
export type TetherErrorCode =
  | 'PRODUCE_FAILED'
  | 'CHANNEL_POST_FAILED'
  | 'STATE_FAILED'
  | 'INVALID_REVIEW_CONFIG'
  | 'INVALID_DURATION'
  | 'SLACK_SIGNATURE_INVALID'
  | 'SLACK_PAYLOAD_INVALID'
  | 'CROSS_PROCESS_UNSUPPORTED'

export class TetherError extends Error {
  public readonly code: TetherErrorCode
  public override readonly cause?: unknown

  constructor(code: TetherErrorCode, message?: string, cause?: unknown) {
    super(message ?? code)
    this.name = 'TetherError'
    this.code = code
    if (cause !== undefined) {
      this.cause = cause
    }
    // Maintain prototype chain through transpilation targets that may
    // strip the implicit `extends Error` super-call.
    Object.setPrototypeOf(this, TetherError.prototype)
  }
}
