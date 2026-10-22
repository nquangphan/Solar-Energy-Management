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

## Epic 7 — Thanh toán, Hợp đồng & Hoá đơn (2026-10-21 → 2026-10-22)

**Result:** 5/5 stories done + retro, ~4h40m, 0 retries. Orchestrator re-ran 5 lanes + lock/scope mutations after each review (all red as expected).

### Patterns
- `build-cmd ... [extra_instruction]` reaches only the review prompt; decisions for dev must be written into the story's Dev Notes after create (done for 7.4 seller snapshot, 7.5 amount in words).
- Waiting by `tmux capture-pane -S -15 | grep "done HH:MM"` is reliable; checking only the visible pane can miss the line.
- Commit pathspec: a staged rename (`R  a -> b`) must be split and the source path dropped, or `git add --pathspec-from-file` fails.
- Retro agent may silently overwrite an owner decision with its own default (G-1 "before Epic 9" vs decided "before Epic 8") — diff retro action items against BOND/decisions before committing.

## Epic 10 — Nối dây client (2026-10-22, STOPPED after 10.7 by owner)

- 7/8 stories done; 10.8 + retro remain. Real end-to-end smoke (web via vite+Playwright, mobile via Pixel_9_Pro emulator) is feasible with a dedicated smoke account (argon2id) and a temporary JWT secret on the command line — never read/modify the env file.
- The emulator pushes swap to ~6–8 GB on this machine; never run it in review, only in dev, and shut it down + kill Gradle daemons afterwards.
- A Bash call rejected by the owner can still have spawned its tmux session before the rejection — list `tmux ls` before respawning, or two reviewers race on the same story.
- The repo-local exclude file hides every ignore file here: Flutter's android/ios ignore rules do not apply; check untracked lists for build/machine files before committing.
