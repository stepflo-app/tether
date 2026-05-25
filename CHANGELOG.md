# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-25

### Added

- Initial walking-skeleton release.
- `draft<TContext, TArtifact>` primitive with approve / reject / approval_failed /
  timeout-reject outcomes.
- Slack channel adapter (`createSlackAdapter`) with:
  - outbound Block Kit review messages via `chat.postMessage`
  - `handleInteraction({ rawBody, headers })` helper that verifies Slack
    request signatures and resolves pending reviews in-process
- In-memory state adapter, with a `StateAdapter` interface for BYO durability of
  serializable review metadata only. The state adapter is **not** a cross-process
  resume engine in v0.1.
- Process-local pending-review registry (single-process, same-instance only).
- `draft-followup` example: meeting transcript → LLM draft (stub) → Slack
  approval → email send (stub), all hosted in one Node process via Express.
- Roadmap placeholder directories for `suggest-triage`, `act-stale-issues`,
  `suggest-pr-reviewer`, `draft-changelog`.
- GitHub Actions CI matrix (Node 20 + 22): typecheck, lint, test with coverage,
  build, `npm pack --dry-run`, example install + typecheck.

### Known limitations

- v0.1 is single-process only. The same process that calls `draft()` must
  receive the Slack interactivity callback. Multi-replica and serverless
  deployments are explicitly unsupported.
- Slack is the only shipped channel. Email and webhook adapters are future
  work.
- Review is approve/reject only. Edit flows are out of scope.

---

*Built with a soft fingerprint from the team at [Stepflo](https://stepflo.com).*
