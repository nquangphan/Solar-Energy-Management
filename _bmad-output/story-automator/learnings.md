# Story Automator — Learnings

## Epic 1 — Design System & App Shell (2026-07-07 → 2026-07-08)

**Result:** 11/11 stories completed, committed, and epic retrospective done.

### What worked
- Uniform Claude agent for all tasks (create/dev/auto/review) fit an all-Low-complexity epic well.
- Custom review step using `/ck:code-review` (auto-fix loop until clean) before marking `done` — honored per user instruction; each story's session updated sprint-status → done only after a clean review.
- Source-of-truth verification (sprint-status.yaml) recovered reliably every time `monitor-session` hit the 10-minute wrapper timeout while a session was still legitimately active.

### Friction / patterns observed
- **Monitor timeouts are routine**, not failures: dev + review sessions frequently exceeded 10 min. Fallback = `tmux-status-check` + read sprint-status, then resume monitor. Never assumed failure.
- **Sessions linger after completing their work**: several dev/review sessions stayed `active` after sprint-status had already advanced. Trusting source-of-truth (status = review/done) + killing the session was correct.
- **Create step occasionally produced no story file** (1.9): retried create once → succeeded. Dev 1.3 also needed one retry (first pass produced nothing, status stayed ready-for-dev).

### Recommendations for next epics (2+)
- Epics 2+ include backend (NestJS/Prisma), auth, pricing, state machine — higher real complexity. Consider Codex/opus for the genuinely Medium/High stories, and keep tests mandatory on financial/permission paths per project-context.md.
- Keep the `/ck:code-review`-before-done gate; it caught and fixed issues especially on 1.6 and 1.10 (multi-cycle).
- `all-claude` preset is saved — reuse via `[L]oad saved` to skip agent config next run.
