# Tests — what was tested, how, and what is still unverified

Run: `node tests/test-queue.js` (exit 0 = all pass). 15 tests, all passing
as of 2026-11-25.

## Covered by automated tests (`tests/test-queue.js`, `app/core.js`)

1. Prerequisite satisfied (done + accepted) → dependent `queued` →
   `ready` (ready-for-review).
2. Unmet prerequisite → dependent stays `waiting`, blocker named.
3. Missing prerequisite record → visible blocker, no crash.
4. **Done ≠ accepted:** completing a prerequisite does NOT unblock the
   dependent; only explicit acceptance does.
5. Completion + acceptance cascade: B done + accepted unblocks C.
6. Cycle prevention: adding a prerequisite that closes a loop is refused
   (including self-dependency).
7. Dispatch without explicit authorization is refused.
8. Dispatch of a `waiting` task is refused, blockers listed.
9. Dispatch with authorization starts work (`in-progress`).
10. Idea promotion without approver/scope/owner is refused and writes no
    audit entry.
11. Idea promotion with full approval succeeds, audits, and does NOT
    grant dispatch authorization.
12. Ideas cannot be completed or dispatched.
13. Merge: one-sided change applies cleanly.
14. Merge: both-sides change is flagged as a conflict; local copy kept.
15. Seed data: CG-001 Ocean Dynamics is `waiting` on PCC-001, is not
    dispatchable, and its full scope is preserved verbatim in notebook
    CG-NB-01.

A test failure during development (queued→waiting counted as "unblocked")
was fixed in `core.js` — `completeTask`/`acceptTask` now only report a
dependent as unblocked when it actually reaches `ready`.

## Verified by hand (2026-11-25)

- `node --check` on `app/core.js` and `app/app.js`: clean.
- `data/seed.json` parses; all seeded task/idea/notebook IDs are unique
  (checked in the test suite's seed test and by inspection).
- App served locally via `python3 -m http.server` and smoke-checked
  (see screenshots).

## Still unverified / not yet tested

- **Mobile + desktop responsive screenshots:** attempted with a
  headless Chromium install; if the install failed in this environment,
  screenshots are listed as BLOCKED in the result file rather than
  faked. Re-run with a real browser before claiming this acceptance
  item.
- **Note create/read/edit across sessions:** the code path is exercised
  by the app (localStorage persistence + Export/Import), but a true
  two-session round-trip (edit in browser A, import in browser B) was
  not observed end to end — it needs two browser sessions. The merge
  logic that underpins it IS tested (tests 13–14).
- **Firebase Auth / Google sign-in:** documented, not wired. The shipped
  gate is a local passcode only (see `docs/DEPLOYMENT.md`).
- **Live Drive round-trip:** Export JSON → upload to Drive → Import on
  a second device was not observed in this run; the file format and
  merge are tested, the Drive upload step is the standard exchange
  workflow.
- **GitHub Pages live URL:** verify by opening the URL after the Pages
  deploy propagates (can take minutes). If it is not live at result
  time, the result file says so plainly.
