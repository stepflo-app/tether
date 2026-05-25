import type { Router } from 'express'
import express from 'express'
import type { SlackChannelAdapter } from 'tether'

/**
 * Mounts the `/slack/interactivity` route on the given Express app.
 *
 * IMPORTANT: signature verification needs the RAW request body, so we use
 * `express.raw(...)` rather than `express.urlencoded(...)`. Forward the
 * raw bytes to `slack.handleInteraction(...)` exactly as received.
 */
export function mountSlackRoute(slack: SlackChannelAdapter): Router {
  const router = express.Router()

  router.post(
    '/slack/interactivity',
    express.raw({ type: 'application/x-www-form-urlencoded' }),
    async (req, res) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
      const response = await slack.handleInteraction({
        rawBody,
        headers: req.headers,
      })
      res.status(response.status).type('text/plain').send(response.body)
    },
  )

  return router
}
