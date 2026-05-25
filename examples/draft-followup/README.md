# draft-followup example

Meeting transcript → agent drafts follow-up email → Slack approval → send.

This is the v0.1 walking-skeleton example. It runs the Slack interactivity route
and the `draft()` worker in **one Node process**. That same-process topology is
the point: tether v0.1 is single-process only.

## What's real vs stubbed

| Component             | Real?     | Why                              |
| --------------------- | --------- | -------------------------------- |
| LLM call              | stubbed   | BYO LLM is a design decision     |
| Gmail send            | stubbed   | keeps the example self-contained |
| Slack post            | real      | proves outbound review flow      |
| Slack callback route  | real      | proves approval round-trip       |
| State adapter         | real      | default in-memory                |

## Setup

1. Create a Slack app at https://api.slack.com/apps.
2. Add the **`chat:write`** bot token scope.
3. Install the app to your workspace. If the target channel is private, invite
   the bot.
4. Enable **Interactivity & Shortcuts** and set the Request URL to
   `https://<your-tunnel>/slack/interactivity`. Use `ngrok`, Cloudflare Tunnel,
   or similar for local development.
5. Copy your **Bot User OAuth Token** (`xoxb-...`) and **Signing Secret**.

## Run

```bash
cp .env.example .env
# edit .env and fill in SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_CHANNEL_ID

npm install
npm run start
```

You should see a "Review needed" message in your Slack channel within a second
or two. Click **Approve** and the terminal will print the `[gmail-stub] Sending
email` block.

## Single-process limitations (read me)

v0.1 of tether stores pending reviews **in process memory only**. The
behaviors below are intentional, but you should know about them:

- **Restart the process before clicking → the pending review is lost.** The
  Slack click will get "already resolved or expired" because the in-memory
  registry is empty.
- **Multiple replicas are unsupported.** If the Slack click arrives on a
  different replica than the one that called `draft()`, the Slack helper logs
  `CROSS_PROCESS_UNSUPPORTED` and responds with a clear message.
- **Serverless is unsupported.** Functions-as-a-service environments destroy
  the process between requests; the pending review registry does not survive.

If you want to persist review metadata anyway, plug in your own state adapter
with `setStateAdapter(...)` — but understand that even with a Redis or Postgres
adapter, the awaiting `draft()` promise still lives in this process and only
this process.

First-party Redis and Postgres adapters and a real cross-process resume story
are planned for v0.2+.
