# tether

Three primitives for AI features that know when to ask for help.

*by [@cngonzo](https://github.com/cngonzo) · MIT*

---

```bash
npm install tether
```

---

```typescript
import { createSlackAdapter, draft, setChannelAdapter } from 'tether'

const slack = createSlackAdapter({ botToken, signingSecret })
setChannelAdapter('slack', slack)

const result = await draft({
  context: { transcript },
  produce: async (ctx) => llm.generateFollowupEmail(ctx.transcript),
  review: {
    channel: 'slack',
    destination: 'C0123456789',
    timeout: '24h',
    onTimeout: 'reject',
  },
  onApprove: async (email) => gmail.send(email),
})
```

---

Most production AI features live somewhere between "suggests an option" and "does the thing autonomously." Right now you're probably hand-rolling the same plumbing for every feature: agent runs, produces output, you build a UI to show it, you wire up approve/reject buttons, you handle timeouts, you write the rollback path. Every time.

`tether` gives that pattern a name and a shape.

Three primitives — `suggest`, `draft`, `act` — each with built-in human checkpoints and timeout handling. Pick the one that matches how much autonomy this feature should have. The agent has freedom of motion within the boundary you define; at the edge, it snaps back to you.

> **v0.1 ships `draft` only.** `suggest` and `act` are roadmap surface for v0.1.x. The library's positioning is built around all three primitives — but only `draft` exists in code today.

---

## The three primitives

| | `suggest` | `draft` | `act` |
|---|---|---|---|
| **What the agent does** | Surfaces options | Produces a complete artifact | Executes end-to-end |
| **Human role** | Picks one | Approves before commit | Notified after, can undo |
| **Default for** | High-stakes decisions, ambiguous context | Most production AI features | Repetitive, well-understood, low-blast-radius work |
| **v0.1 status** | planned | shipped | planned |

---

## `draft` — agent produces artifact, human approves before commit

> **v0.1 ships `draft` only.** `suggest` and `act` are roadmap surface for v0.1.x.
>
> **v0.1 review is approve/reject only.** Edit flows are out of scope for the walking skeleton.

```typescript
import { draft } from 'tether'

const result = await draft({
  context: { transcript },
  produce: async (ctx) => await llm.generateFollowupEmail(ctx.transcript),
  review: {
    channel: 'slack',
    destination: 'C0123456789',
    timeout: '24h',
    onTimeout: 'reject',
  },
  onApprove: async (email) => await gmail.send(email),
})
```

Meeting ends. Agent drafts a follow-up email. Slack message goes to the meeting organizer with approve/reject buttons. They approve, email sends. They don't respond in 24h, nothing sends — not a silent drop, an explicit rejection.

`draft` is the right default for most AI features. The agent does the work; a human decides whether to ship it.

### Slack wiring in v0.1

v0.1 does not run an HTTP server for you. You host the Slack interactivity route in your app and forward the raw request to the Slack adapter helper:

```typescript
const slack = createSlackAdapter({ botToken, signingSecret })
setChannelAdapter('slack', slack)

app.post(
  '/slack/interactivity',
  express.raw({ type: 'application/x-www-form-urlencoded' }),
  async (req, res) => {
    const response = await slack.handleInteraction({
      rawBody: req.body.toString('utf8'),
      headers: req.headers,
    })

    res.status(response.status).send(response.body)
  },
)
```

The library owns signature verification, payload parsing, action decoding, and stale-click handling. Your app owns the HTTP framework, hosting, and tunnel.

---

## `suggest` — agent surfaces options, human picks *(coming in v0.1.x)*

```typescript
import { suggest } from 'tether'

const result = await suggest({
  context: { issue },
  produce: async (ctx) => ({
    options: await llm.triageTeams(ctx.issue),
  }),
  review: {
    channel: 'slack',
    timeout: '4h',
    onTimeout: 'reject',
  },
})

if (result.status === 'approved') {
  await linear.assign(issue.id, result.chosen.teamId)
}
```

New Linear issue comes in. Agent suggests three possible teams. Slack message goes to `#triage` with buttons. An engineer clicks one. If nobody clicks in 4 hours, it rejects — no silent auto-assignment.

---

## `act` — agent executes, human can undo *(coming in v0.1.x)*

```typescript
import { act } from 'tether'

const result = await act({
  context: { cutoff: daysAgo(30) },
  reversible: {
    snapshot: async (ctx) => {
      const stale = await linear.getIssues({ updatedBefore: ctx.cutoff })
      return stale.map(i => i.id)
    },
    rollback: async (snapshotIds) => {
      await Promise.all(snapshotIds.map(id => linear.removeComment(id, AUTO_TRIAGE_NOTE)))
    },
  },
  execute: async (ctx) => {
    const stale = await linear.getIssues({ updatedBefore: ctx.cutoff })
    await Promise.all(stale.map(i => linear.addComment(i.id, AUTO_TRIAGE_NOTE)))
    return { triaged: stale.map(i => i.id) }
  },
  review: {
    channel: 'slack',
    message: (result) => `Triaged ${result.triaged.length} stale issues. Undo?`,
    undoWindow: '30m',
  },
})
```

Cron fires every Monday. Agent finds stale issues and adds a triage comment. Slack message goes to `#engineering` summarizing what ran, with an undo button active for 30 minutes.

**`act` will require a `reversible` block.** If you can't define a rollback, you probably shouldn't be giving the agent full autonomy — use `draft` instead. The type system will tell you.

---

## Examples

One runnable example ships in v0.1:

- **[`draft-followup`](./examples/draft-followup)** — Meeting transcript → agent drafts follow-up email → Slack approval → send

Four example directories are included as roadmap placeholders:

- **`suggest-triage`** — coming soon
- **`act-stale-issues`** — coming soon
- **`suggest-pr-reviewer`** — coming soon
- **`draft-changelog`** — coming soon

---

## State & persistence

> ⚠️ **v0.1 is single-process only.** The same long-running Node process that calls `draft()` must also receive the Slack interaction callback.
>
> ⚠️ **v0.1 stores only metadata durably.** A custom state adapter can persist review status, timestamps, and expiry metadata, but it does **not** make pending reviews resumable across restarts, replicas, or serverless invocations.
>
> **Do not deploy v0.1 to serverless or multiple replicas.** The supported target is one long-running Node process.

If you want to persist review metadata anyway, plug in your own state adapter:

```typescript
import { setStateAdapter } from 'tether'

setStateAdapter({
  get: async (key) => { /* your store */ },
  set: async (key, value, ttlMs) => { /* your store */ },
  delete: async (key) => { /* your store */ },
})
```

First-party adapters for Redis and Postgres are planned for v0.2+, alongside a real cross-process resume story.

---

## API

### `draft<TContext, TArtifact>`

```typescript
draft<TContext, TArtifact>(config: {
  context: TContext
  produce: (ctx: TContext) => Promise<TArtifact>
  review: DraftReviewConfig<TArtifact>
  onApprove?: (artifact: TArtifact) => Promise<void>
  onReject?: (reason: 'timeout' | 'explicit', detail?: string) => Promise<void>
}): Promise<DraftResult<TArtifact>>

type DraftReviewConfig<TArtifact> = {
  channel: 'slack'
  destination: string
  timeout: string
  onTimeout: 'reject'
  message?: string | ((artifact: TArtifact) => string)
}

type DraftResult<TArtifact> =
  | { status: 'approved'; artifact: TArtifact; reviewId: string }
  | { status: 'rejected'; reason: 'timeout' | 'explicit'; reviewId: string; detail?: string }
  | { status: 'approval_failed'; artifact: TArtifact; reviewId: string; error: { message: string } }
```

Notes:

- `channel` is the string literal `'slack'` in v0.1. Other channels are future work.
- `onTimeout` is the string literal `'reject'` for `draft`. Auto-approve on timeout is not allowed.
- `approval_failed` is its own outcome: the human approved, but your `onApprove` side effect threw. The result is not coerced into rejection.

### `createSlackAdapter`

```typescript
createSlackAdapter(opts: {
  botToken: string
  signingSecret: string
}): SlackChannelAdapter

interface SlackChannelAdapter extends ChannelAdapter {
  postReview(args: { reviewId: string; destination: string; summary: string }): Promise<void>
  handleInteraction(args: {
    rawBody: string
    headers: Record<string, string | string[] | undefined>
  }): Promise<{ status: number; body: string }>
}
```

`handleInteraction` verifies the Slack request signature, parses the payload, and resolves the in-process pending review. It does NOT wait for `onApprove` — Slack gets an immediate ACK; your `draft()` call continues in-process and runs `onApprove` there.

### `setStateAdapter` / `StateAdapter`

```typescript
interface StateAdapter {
  get(key: string): Promise<StoredReviewRecord | null>
  set(key: string, value: StoredReviewRecord, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}
```

Adapters are passive storage only. They do not own promises or timers, and they do not enable multi-process or serverless deployments in v0.1.

---

## FAQ

**Why is it called `tether`?**

An agent on a tether has freedom of motion within a boundary you define. At the edge, it snaps back to you. That's the mental model — the library doesn't restrict what your agent can do, it defines where it has to stop and check with a human.

**Why not Mastra?**

Mastra is the closest comparable: a TypeScript agent framework with human-in-the-loop suspension built in. The difference is opinion and surface area. Mastra is a framework; `tether` is a small library whose core API is the autonomy decision itself — `suggest`, `draft`, or `act`. If you want a full workflow and agent framework, use Mastra. If you want a small primitive that composes into your existing stack and makes the human-checkpoint decision explicit in code, use `tether`.

**Why not just use LangChain / LangGraph / Inngest?**

Those are workflow orchestrators. `tether` is a smaller, more opinionated library focused on one question: how much autonomy does this AI feature have? Use them together — `tether` primitives compose naturally into LangGraph nodes or Inngest steps.

**Why not Temporal?**

Temporal solves durability: your workflow survives process restarts, timeouts persist across days, and history is replayed on failure. That's a different layer than what this library handles. If you're already on Temporal, `tether` primitives run cleanly inside your Temporal workflows. If you're not, `tether`'s state adapter interface lets you persist review metadata to your own store — and a future version will offer real cross-process resumption.

**Why three separate functions instead of one with an `autonomyLevel` flag?**

Because the autonomy decision should be visible in your code. A flag parameter is easy to ignore or change carelessly. A different import — `suggest` vs `draft` vs `act` — forces the choice to be deliberate. Same logic as React separating `useState` and `useEffect` rather than `useReact({ type })`.

**Why does `act` require a `reversible` block? That feels heavy.**

That's the point. If you can't define a rollback, you probably shouldn't be giving the agent full autonomy over this action — you should use `draft` instead and let a human approve before it runs. The type signature is the guardrail. If you genuinely have an irreversible action that should run autonomously, you're outside the scope of this library.

**What LLM does this use?**

None — bring your own. `tether` handles checkpoint logic, review routing, timeout handling, and (in future) rollback orchestration. You handle the model calls. It works with Anthropic, OpenAI, or anything else.

**Does this work with Python?**

Not yet. TypeScript first. Python port if there's pull.

**Can I use this without Slack?**

In v0.1, no — Slack is the only shipped channel. Email and generic webhook adapters are future work. The adapter surface is designed to extend, but they are not part of the v0.1 release.

---

## Status

v0.1 — walking skeleton. API may change before v1.0.

What's shipped in v0.1:

- `draft` primitive (Slack-only, approve/reject only)
- `createSlackAdapter` with outbound `postReview` and inbound `handleInteraction`
- in-memory state adapter + pluggable `StateAdapter` interface for BYO metadata durability
- one runnable example (`draft-followup`)

What's NOT in v0.1:

- `suggest` and `act` primitives
- email / webhook channel adapters
- Slack edit flows
- multi-replica or serverless deployment support
- cross-process resumption after restart

See [`CHANGELOG.md`](./CHANGELOG.md) for the full list.

---

## License

MIT

---

*Built by the team at [Stepflo](https://stepflo.com). We use these primitives in production multi-step workflows. For orchestration beyond single primitives, see Stepflo.*
