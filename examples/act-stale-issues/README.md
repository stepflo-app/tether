# act-stale-issues (coming soon)

Roadmap placeholder for v0.1.x.

The plan: a cron job runs once a week, finds stale Linear issues, adds a triage
comment via `act()` with a `reversible` block, and posts a Slack summary with an
"undo" button active for 30 minutes.

Out of scope for v0.1. The `act` primitive itself is not implemented yet.
