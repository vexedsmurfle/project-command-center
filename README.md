# Project Command Center

A persistent project notebook and management dashboard, independent of any
chat history, built for Ryan's Muse ↔ ChatGPT task exchange and AI resource
pool. Built 2026-11-25 under **TASK-GPT-20261125-Project-Command-Center**.

## What it is

- **Responsive PWA** (repo root): project cards with summary, status, next
  steps, active assignments, blockers and last update. Per-project
  Overview / Tasks / Ideas-backlog / Notebook-decisions / Activity views.
  Search + status filter. Editable notes with timestamps and provenance.
  Stable IDs (`KH-001`, `CG-001`, …) and links to task docs, results,
  repos and PRs.
- **Dependency-based task queues** (core.js, tested in
  `tests/test-queue.js`): prerequisite task IDs, waiting / ready-for-review
  states, completion *and* acceptance gates, cycle prevention, visible
  blockers. When prerequisites complete **and are accepted**, dependents
  move to ready-for-review — never straight to development.
- **Idea-promotion gate (the critical rule):** brainstorming notes and
  future ideas NEVER become executable assignments without explicit user
  approval. Promotion requires approver + scope + owner, is written to
  the audit log, and still does not authorize dispatch. Dispatch needs a
  separate explicit authorization every time. There is no code path from
  idea to work without those two approvals.
- **Drive-backed records:** the durable record is a JSON file
  (`data/seed.json` format, `pcc-1`) exported from the app and stored in
  the Google Drive Task Exchange folder. The browser's localStorage copy
  is a cache only. See `docs/DATA-MODEL.md` for source of truth, sync,
  dedup, concurrent edits, permissions and backups.
- **Authenticated access:** a local passcode gate (SHA-256, device-only)
  ships in the app. For a shared/hosted deployment, use Firebase Auth /
  Google sign-in — see `docs/DEPLOYMENT.md`. No credentials or private
  data are in the repo or the app.

## Seeded projects (verified records only; unknowns labelled)

Kitchen Hub · Pulse · Ctrl Assist · Caribbean game · AI Gateway / resource
pool · Project Command Center (itself). Seeded future ideas (NOT
assignments): Kitchen Hub child chore chart; standalone cross-platform task
manager; Pulse family location tracking (consent/battery/geofencing
evaluation first). Caribbean backlog item **Ocean Dynamics and Discovery
(CG-001)** is seeded QUEUED/WAITING on this Command Center (PCC-001) with
its full scope preserved verbatim in the notebook — no implementation
started. Today's Kitchen Hub "Today at a Glance" task is linked, not
duplicated.

## Run locally

```sh
cd project-command-center
python3 -m http.server 8000
# open http://localhost:8000 — set a passcode on first visit
```

No build step, no backend, no dependencies. `node tests/test-queue.js`
runs the 15-test suite (exit 0 = all pass).

## Costs

$0. Static hosting (GitHub Pages), no backend, no paid services. Firebase
Hosting free tier is the documented alternative.

## Limitations (honest)

- The passcode gate is a device lock, not server-side auth; real shared
  hosting needs Firebase Auth / Google sign-in (documented, not wired).
- Sync is manual Export JSON → upload to Drive / Import JSON. There is no
  live Drive API sync in the browser build; the merge function flags
  both-sides edits as conflicts for human review instead of silently
  overwriting.
- No automatic merges or deployments anywhere in the system.
- Status reflects records as of the last export; it never invents
  progress. Anything labelled "unknown" in the seed data is unverified.

## Docs

- `docs/DATA-MODEL.md` — source of truth, sync, dedup, conflicts,
  permissions, backups, record format.
- `docs/INTERFACE.md` — the low-cost read/write interface for ChatGPT
  (via Drive), Muse, Codex and Gemini.
- `docs/DEPLOYMENT.md` — hosting, auth, setup, costs, failure states.
- `docs/TESTS.md` — what was tested, how, and what is still unverified.
