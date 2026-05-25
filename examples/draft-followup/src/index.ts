import 'dotenv/config'
import express from 'express'
import { createSlackAdapter, draft, setChannelAdapter } from 'tether'
import { draftFollowupEmail, type FollowupEmail } from './llm-stub.js'
import { sendEmail } from './gmail-stub.js'
import { mountSlackRoute } from './slack-route.js'

/**
 * draft-followup example.
 *
 * This script intentionally runs everything in ONE Node process:
 *   - hosts the Slack interactivity HTTP endpoint
 *   - calls draft() with a hardcoded meeting transcript
 *   - on approve, "sends" the email via the gmail stub
 *
 * v0.1 of tether is single-process only. If you split the HTTP route and the
 * draft() worker across processes (or run multiple replicas, or deploy to
 * serverless), the Slack callback will arrive on a process that does not
 * own the pending review, and the Slack helper will respond with an
 * "unsupported deployment shape" message.
 */

function readEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[draft-followup] Missing required env var: ${name}`)
    console.error('Copy .env.example to .env and fill it in.')
    process.exit(1)
  }
  return v
}

async function main(): Promise<void> {
  const botToken = readEnv('SLACK_BOT_TOKEN')
  const signingSecret = readEnv('SLACK_SIGNING_SECRET')
  const channel = readEnv('SLACK_CHANNEL_ID')
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)

  // 1. Wire the Slack adapter.
  const slack = createSlackAdapter({ botToken, signingSecret })
  setChannelAdapter('slack', slack)

  // 2. Boot Express in the SAME process.
  const app = express()
  app.use(mountSlackRoute(slack))
  app.get('/healthz', (_req, res) => res.send('ok'))
  app.listen(port, () => {
    console.log(`[draft-followup] listening on http://localhost:${port}`)
    console.log(`[draft-followup] Slack interactivity URL: /slack/interactivity`)
  })

  // 3. Run a draft() in this same process. In a real app you might trigger
  //    this from a webhook ("meeting ended") or a cron — what matters is
  //    it runs in the same Node process as the route above.
  const transcript =
    `Product/Eng standup, May 25, 2026\n` +
    `Decided: ship v0.1 walking skeleton this week\n` +
    `Open: who picks up the Postgres adapter for v0.2?`

  console.log('[draft-followup] Calling draft() ...')
  const result = await draft<unknown, FollowupEmail>({
    context: { transcript },
    produce: () => draftFollowupEmail(transcript),
    review: {
      channel: 'slack',
      destination: channel,
      timeout: '24h',
      onTimeout: 'reject',
      message: (artifact) =>
        `*Draft email*\nTo: ${artifact.to}\nSubject: ${artifact.subject}\n\n${artifact.body}`,
    },
    onApprove: async (email) => {
      await sendEmail(email)
    },
    onReject: async (reason, detail) => {
      console.log(`[draft-followup] Rejected (${reason}): ${detail ?? ''}`)
    },
  })

  console.log('[draft-followup] draft() resolved:', result)
}

main().catch((err) => {
  console.error('[draft-followup] fatal:', err)
  process.exit(1)
})
