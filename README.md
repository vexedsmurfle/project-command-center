# Project Command Center

A persistent project notebook and management dashboard, independent of any
chat history, built for Ryan's Muse ↔ ChatGPT task exchange and AI resource
pool. Built 2026-11-25 under **TASK-GPT-20261125-Project-Command-Center**;
secure deployment (Firebase Auth + Firestore, auth-gated data loading) added
2026-11-25 under **TASK-GPT-20261125-Project-Command-Center-Secure-Deployment**.

## What it is

- **Responsive PWA** (repo root): project cards with summary, status, next
  steps, active assignments, blockers and last update. Per-project
  Overview / Tasks / Ideas-backlog / Notebook-decisions / Activity views.
  Search + status filter. Editable notes with timestamps and provenance.
  Stable IDs and links to task docs, results, repos and PRs.
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
- **Drive-backed records:** the durable record is a JSON file (format
  `pcc-1`) exported from the app and stored in the Google Drive Task
  Exchange folder. The browser's localStorage copy is a cache only. See
  `docs/DATA-MODEL.md` for source of truth, sync, dedup, concurrent
  edits, permissions and backups.
- **Authenticated access:** Google sign-in via Firebase Auth (owner
  account only, enforced server-side by `firestore.rules`) with
  Firestore sync, when `firebase-config.js` is present — see
  `docs/FIREBASE-SETUP.md` for the owner setup steps. Without it, the app
  runs in local-only mode behind a device passcode gate (SHA-256,
  device-only). **The public site ships no project records at all:**
  the login shell is all an unauthenticated visitor sees; records load
  only after authentication, from Firestore or from a Drive JSON import.
  Project records live in the Drive exchange and in the owner-only
  Firestore document — never in this repo.

## Seeded projects

The record ships with the owner's current projects (loaded after sign-in
from Firestore, or imported from the Drive JSON export — not from this
repo). Seeded future ideas are NOT assignments: they stay non-executable
until deliberately promoted with the owner's approval. Anything labelled
"unknown" in the record is unverified.

## Run locally

```sh
cd project-command-center
python3 -m http.server 8000
# open http://localhost:8000 — sign in with Google (if Firebase is
# configured) or set a passcode on first visit (local-only mode)
```

No build step, no backend, no dependencies. `node tests/test-queue.js`
runs the queue/gate suite; `node tests/test-secure.js` runs the
auth-gating and public-bundle security checks.

## Costs

$0. Static hosting (GitHub Pages) + Firebase free tier (Auth + Firestore),
no backend, no paid services, no billing enabled anywhere.

## Limitations (honest)

- Live Firestore rules enforcement is **untested** until Ryan creates
  the Firebase project and runs the checks in `docs/FIREBASE-SETUP.md`
  (Rules Playground + sign-in checks). The rules file is reviewed and
  covered by static tests, but no live read/write has been attempted
  against it yet.
- The passcode gate (local-only mode) is a device lock, not server-side
  auth; it applies only until Firebase is configured.
- Sync is manual Export JSON → upload to Drive / Import JSON, plus
  automatic Firestore sync once signed in. There is no live Drive API
  sync in the browser build; the merge function flags both-sides edits
  as conflicts for human review instead of silently overwriting.
- No automatic merges or deployments anywhere in the system.
- Status reflects records as of the last export; it never invents
  progress. Anything labelled "unknown" is unverified.

## Docs

- `docs/DATA-MODEL.md` — source of truth, sync, dedup, conflicts,
  permissions, backups, record format.
- `docs/INTERFACE.md` — the low-cost read/write interface for ChatGPT
  (via Drive), Muse, Codex and Gemini.
- `docs/DEPLOYMENT.md` — hosting, auth, setup, costs, failure states.
- `docs/FIREBASE-SETUP.md` — the exact owner steps to enable Google
  sign-in + Firestore (free tier, no billing).
- `docs/TESTS.md` — what was tested, how, and what is still unverified.
