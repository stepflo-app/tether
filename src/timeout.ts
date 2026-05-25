import { TetherError } from './errors.js'

/**
 * Parse a duration string like '500ms', '30m', '4h', '24h', '7d' into milliseconds.
 *
 * Accepted units: `ms`, `s`, `m`, `h`, `d`.
 * The numeric portion must be a positive integer; `0` is rejected because a
 * zero-length timeout is always a misuse.
 */
export function parseDuration(input: string): number {
  if (typeof input !== 'string') {
    throw new TetherError('INVALID_DURATION', `Duration must be a string, got ${typeof input}`)
  }

  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim())
  if (!match) {
    throw new TetherError(
      'INVALID_DURATION',
      `Invalid duration: ${JSON.stringify(input)}. Expected e.g. '500ms', '30m', '4h', '24h', '7d'.`,
    )
  }

  const [, rawAmount, unit] = match
  // Regex guarantees `rawAmount` is a non-empty digit string, but TS sees
  // it as possibly undefined under noUncheckedIndexedAccess. Guard anyway.
  if (rawAmount === undefined || unit === undefined) {
    throw new TetherError('INVALID_DURATION', `Invalid duration: ${JSON.stringify(input)}`)
  }

  const amount = Number.parseInt(rawAmount, 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TetherError(
      'INVALID_DURATION',
      `Duration amount must be a positive integer, got ${JSON.stringify(input)}`,
    )
  }

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }
  const multiplier = multipliers[unit]
  if (multiplier === undefined) {
    // Unreachable because of the regex, but keep the type-safe guard.
    throw new TetherError('INVALID_DURATION', `Unknown duration unit: ${unit}`)
  }

  return amount * multiplier
}
