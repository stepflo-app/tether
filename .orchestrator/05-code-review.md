# Phase 5 — Adversarial Code Review

## Section 1 — Plan compliance

- Severity: `P2`
  File: `.gitignore:10-11`, `.orchestrator/02-plan.md:24-35`
  Problem: The planned repository tree says `.orchestrator/01-discovery.md`, `.orchestrator/02-plan.md`, and `.orchestrator/03-plan-review.md` should exist on the tagged repo tree, but the repo currently ignores the entire `.orchestrator/` directory. In the tracked tree (`git ls-files`), none of those files are present.
  Fix applied / deferral: Deferred. This is a real plan-compliance miss, but it does not affect the published package or runtime behavior. I left repo-internal tracking policy unchanged in this pass.

- Severity: `P2`
  File: `package-lock.json:1`, `examples/draft-followup/package-lock.json:1`, `.orchestrator/02-plan.md:95-98`, `.orchestrator/02-plan.md:520-529`
  Problem: The tracked tree contains two lockfiles that are not in the planned “exact tree” section. This is mechanical drift rather than a runtime problem, but the implementation is not literally plan-identical.
  Fix applied / deferral: Deferred. Both lockfiles are harmless, improve reproducibility, and do not ship in the npm tarball.

- Severity: `P2`
  File: `.orchestrator/04-implement-report.md:117-119`, `src/index.ts:13-21`, `dist/index.d.ts:1-10`
  Problem: Deviation 3 in the implementation report claimed that exporting `getPendingReview` from `src/draft.ts` was “harmless.” It was not. That export leaked a private resolution hook into the public API, and the root package surface also exposed additional internal accessors the plan did not call for.
  Fix applied / deferral: Fixed. I removed the accidental public surface so the published API now matches the README/plan more closely.

- Severity: `P2`
  File: `.orchestrator/04-implement-report.md:115-116`, `package.json:51-60`
  Problem: Deviation 1 (ESLint 8 instead of 9) is mechanical, not a hidden design issue. The current `.eslintrc.cjs` shape and `@typescript-eslint` 7.x combination justify the pin.
  Fix applied / deferral: No change needed.

- Severity: `P2`
  File: `.orchestrator/04-implement-report.md:116-116`, `tests/channels.slack-post.test.ts:13-19`
  Problem: Deviation 2 (typed `vi.fn` mocks) is mechanical. It fixes a Vitest inference problem without changing behavior or hiding a design issue.
  Fix applied / deferral: No change needed.

- Severity: `P2`
  File: `.orchestrator/04-implement-report.md:118-118`, `README.md:185-205`, `examples/draft-followup/README.md:44-64`, `src/index.ts:23-32`
  Problem: Deviation 4 (runtime warning on import) is acceptable. The single-process limitation is surfaced in all three places Phase 3 required: runtime, README, and example README.
  Fix applied / deferral: No change needed.

- Severity: `deferred`
  File: `.orchestrator/04-implement-report.md:119-119`, `vitest.config.ts:4-13`
  Problem: Deviation 5 is not merely mechanical. The repo still does not enforce the plan’s coverage promises as a gate, and the current verified coverage numbers do not actually meet the report’s claimed critical-file target (`draft.ts` 95.66%, `pending-reviews.ts` 97.05%, `timeout.ts` 86.53% line coverage; 94.69% overall lines, 78.73% overall branches).
  Fix applied / deferral: Deferred. Tightening this correctly would require either a broader coverage pass or a deliberate rewrite of currently “unreachable” guard branches.

## Section 2 — Code correctness

- Severity: `P1`
  File: `src/channels/slack.ts:224-256`, `src/runtime/pending-reviews.ts:30-50`, `tests/channels.slack-interaction.test.ts:302-413`
  Problem: Before this pass, duplicate Slack interaction delivery could claim success multiple times because the first approve/reject path resolved the deferred directly but left the pending registry entry alive until much later. A retrying Slack client could receive multiple “Approved.” responses for the same review, and timeout-vs-click races could also settle twice.
  Fix applied / deferral: Fixed. I added `resolvePendingReview()` as an atomic resolve-and-remove helper and routed both Slack interaction settlement and timeout settlement through it. I also added integration tests for duplicate approve delivery and late clicks after timeout.

- Severity: `P1`
  File: `src/draft.ts:152-158`, `tests/draft.timeout.test.ts:53-92`
  Problem: Before this pass, if the timeout fired while a slow `state.set()` was still in flight, `draft()` could continue on to `adapter.postReview()` and send a stale Slack review after the deadline had already passed.
  Fix applied / deferral: Fixed. `draft()` now checks whether the pending review still exists before posting, and it bails out to the already-resolved timeout outcome if the timer won the race.

## Section 3 — Test quality

- Severity: `P2`
  File: `tests/draft.happy-path.test.ts:56-62`, `tests/draft.explicit-reject.test.ts:44-49`, `tests/draft.approval-failed.test.ts:44-48`, `tests/channels.slack-interaction.test.ts:302-413`
  Problem: The original happy-path tests resolved `pending.deferred` directly. That is fine for unit isolation, but it means the most important behavior in this library — the published Slack interaction contract — was under-tested in the exact retry/race scenarios that matter operationally.
  Fix applied / deferral: Partially fixed. I kept the direct-deferred unit tests, but added real `draft() + handleInteraction()` integration coverage for duplicate delivery and timeout-after-click behavior.

- Severity: `P2`
  File: `tests/state.swap.test.ts:26-88`
  Problem: The adapter-swap test only proves that a fake adapter sees `set()` calls and terminal overwrites. It does not exercise the durability-story edge cases the README warns about: restart semantics, stale-click behavior after swap, or the fact that swapping storage still does not make `draft()` resumable.
  Fix applied / deferral: Deferred. This needs a broader harness that simulates persisted metadata plus a missing local registry.

- Severity: `deferred`
  File: `vitest.config.ts:4-13`
  Problem: Coverage is reported but not enforced, and the current numbers still miss the critical-file target described in the plan/report. That makes the CI “green” less meaningful than it sounds.
  Fix applied / deferral: Deferred. The library is still well-covered for v0.1, but the gating story is not yet as strong as the plan claims.

## Section 4 — README and packaging

- Severity: `P2`
  File: `src/index.ts:13-21`, `dist/index.d.ts:1-10`, `README.md:209-271`
  Problem: The published package surface was broader than the README and plan described. That kind of accidental export drift is especially dangerous in a library, because once users take a dependency on it, cleanup becomes a breaking change.
  Fix applied / deferral: Fixed. The root export surface now matches the documented v0.1 story: `draft`, `createSlackAdapter`, `setChannelAdapter`, `setStateAdapter`, and types.

- Severity: `P2`
  File: `package.json:14-32`, `.npmignore:1-15`
  Problem: No packaging blocker found after verification. `npm publish --dry-run` succeeds (with a writable npm cache), the tarball is still 64 files / ~26.2 kB, and it excludes `src/`, `tests/`, `examples/`, and `.orchestrator/`.
  Fix applied / deferral: No change needed.

- Severity: `P2`
  File: `README.md:42-43`, `README.md:57-105`, `README.md:170-205`, `README.md:281-311`
  Problem: No README blocker found on the Phase 3 mandated edits. The shipped README does include the walking-skeleton scope marker, the honest single-process warning, the Slack helper snippet, the timeout framing, and the Mastra FAQ.
  Fix applied / deferral: No change needed.

## Section 5 — Launch-readiness blockers

- `P0`: None remaining after fixes.
- `P1`: None remaining after fixes.
- `P2`: Repo/tree compliance still drifts from the exact planned tree because `.orchestrator/` is ignored and two lockfiles were added outside the planned structure.
- `P2`: Coverage gating is still softer than the plan claims.

## Section 6 — What is good

- The separation between passive persisted review metadata and the process-local pending registry is the right v0.1 cut. It keeps the durability story honest.
- Owning Slack signature verification and payload handling inside `createSlackAdapter()` is the right abstraction boundary. The example stays thin, and the hard security logic is centralized.
- The README and example are unusually honest for a first release. The single-process limitation is not buried, and that will save users time.

## Section 7 — The actual fixes

1. `src/runtime/pending-reviews.ts:30-50`
   Added `resolvePendingReview()` so timers and Slack interactions settle reviews atomically and idempotently.

2. `src/channels/slack.ts:203-256`
   Switched interaction handling to the atomic settle helper, tightened the expiry check to `>=`, and made duplicate deliveries return “already resolved or expired” instead of claiming success twice.

3. `src/draft.ts:95-100`, `src/draft.ts:152-158`
   Routed timeout settlement through the atomic helper and blocked stale Slack posting if the timeout already won while persistence was still in flight.

4. `src/index.ts:13-21`
   Removed accidental public exports so the root package surface matches the documented v0.1 API.

5. `tests/channels.slack-interaction.test.ts:302-413`
   Added integration coverage for duplicate approve delivery and late clicks after timeout.

6. `tests/draft.timeout.test.ts:53-92`
   Added a regression test for the slow-state-write timeout race so a stale review message is not posted after expiration.
