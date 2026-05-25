export interface FollowupEmail {
  to: string
  subject: string
  body: string
}

/**
 * Stubbed "LLM" call. In a real integration this would call Anthropic, OpenAI,
 * or the SDK of your choice. The exact provider is BYO — `tether` does not
 * care about model selection.
 */
export async function draftFollowupEmail(transcript: string): Promise<FollowupEmail> {
  // Trivial deterministic summary so the example is reproducible.
  const firstLine = transcript.split('\n')[0] ?? 'meeting'
  return {
    to: 'team@example.com',
    subject: `Follow-up: ${firstLine.slice(0, 60)}`,
    body:
      `Hi team,\n\n` +
      `Thanks for the discussion. Quick recap and next steps:\n\n` +
      `- ${firstLine}\n` +
      `- (pretend the LLM filled this in)\n\n` +
      `Let me know if I missed anything.`,
  }
}
