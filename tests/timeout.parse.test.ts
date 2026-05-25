import { describe, it, expect } from 'vitest'
import { parseDuration } from '../src/timeout.js'
import { TetherError } from '../src/errors.js'

describe('parseDuration', () => {
  it.each([
    ['500ms', 500],
    ['1s', 1_000],
    ['30m', 30 * 60_000],
    ['4h', 4 * 3_600_000],
    ['24h', 24 * 3_600_000],
    ['7d', 7 * 86_400_000],
  ])('parses %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected)
  })

  it('trims surrounding whitespace', () => {
    expect(parseDuration('  10m  ')).toBe(10 * 60_000)
  })

  it.each(['garbage', '', '5', 'h', '5x', '5.5h', '-1h'])(
    'throws INVALID_DURATION on %s',
    (input) => {
      expect(() => parseDuration(input)).toThrow(TetherError)
      try {
        parseDuration(input)
      } catch (err) {
        expect((err as TetherError).code).toBe('INVALID_DURATION')
      }
    },
  )

  it('rejects 0h', () => {
    expect(() => parseDuration('0h')).toThrow(TetherError)
  })
})
