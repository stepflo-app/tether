const DEFAULT_MAX_PREVIEW_CHARS = 2_500

/**
 * Render an artifact to a Slack-safe preview string.
 *
 * Behavior:
 *  - if `messageOption` is a string, use it verbatim
 *  - if `messageOption` is a function, call it with the artifact
 *  - otherwise, fall back to JSON.stringify with 2-space indent
 *
 * In all cases, the result is truncated defensively so we never exceed
 * Slack Block Kit text limits (3000 chars per section text). We aim well
 * under that to leave room for surrounding markdown.
 */
export function renderPreview<TArtifact>(
  artifact: TArtifact,
  messageOption: string | ((artifact: TArtifact) => string) | undefined,
  maxChars: number = DEFAULT_MAX_PREVIEW_CHARS,
): string {
  let raw: string
  if (typeof messageOption === 'string') {
    raw = messageOption
  } else if (typeof messageOption === 'function') {
    try {
      raw = messageOption(artifact)
    } catch (err) {
      raw = `[preview function threw: ${(err as Error).message ?? String(err)}]`
    }
  } else {
    try {
      raw = JSON.stringify(artifact, null, 2)
    } catch (err) {
      raw = `[unserializable artifact: ${(err as Error).message ?? String(err)}]`
    }
  }

  if (typeof raw !== 'string') {
    raw = String(raw)
  }

  return truncate(raw, maxChars)
}

export function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input
  }
  const suffix = `… [truncated ${input.length - maxChars} chars]`
  // Make sure suffix itself fits.
  if (maxChars <= suffix.length) {
    return input.slice(0, Math.max(0, maxChars))
  }
  return input.slice(0, maxChars - suffix.length) + suffix
}
