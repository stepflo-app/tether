import type { FollowupEmail } from './llm-stub.js'

/**
 * Stubbed mail send. Prints to stdout instead of actually delivering email.
 */
export async function sendEmail(email: FollowupEmail): Promise<void> {
  console.log('---')
  console.log('[gmail-stub] Sending email')
  console.log(`To:      ${email.to}`)
  console.log(`Subject: ${email.subject}`)
  console.log(`Body:    ${email.body.split('\n')[0]} …`)
  console.log('---')
}
