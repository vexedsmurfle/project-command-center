# Read/write interface for ChatGPT, Muse, Codex and Gemini

The interface is deliberately boring: **plain files in Google Drive**,
plus the JSON record the app reads and writes. No new server, no new
credentials, no new paid service. Every agent below already has the
access it needs through existing integrations.

## For ChatGPT (via existing Drive access)

ChatGPT already reads and writes the Task Exchange folders. It uses the
Command Center the same way:

**Read** — download the current `pcc-1` JSON from the Task Exchange
folder and read it as the project summary. Project cards, statuses,
blockers, next steps, notebook decisions and the audit log are all in
that one file. Do not reconstruct project status from chat history.

**Write** — ChatGPT must never edit the JSON directly in Drive (no
merge, no conflict handling there). Instead:

1. Post a normal Task Exchange task (`TASK-GPT-YYYYMMDD-<slug>`, status
   NEW) describing the change, **or**
2. Ask Muse to apply the change (Muse owns the merge step), **or**
3. Download the JSON, edit it locally, and re-upload it as a new
   version **only** after reading the current version first — and say
   so in a task comment so Muse can check for conflicts.

**Task Exchange conventions are unchanged:** statuses NEW / IN PROGRESS /
COMPLETE, results in Muse Results, claim via Drive comment, never delete,
never move to Archive unprompted. The Command Center links to task
documents by Task ID; it does not replace them.

## For Muse and Codex (via local repo + Drive)

- Repo: `project-command-center` (see `docs/DEPLOYMENT.md` for the URL).
  Clone, branch, edit `data/seed.json` or the app, run
  `node tests/test-queue.js`, open a PR. No direct pushes to `main`.
- Drive: `hatch_gws_cli drive files get/update/create` as in the existing
  exchange workflow. The JSON record is uploaded with `drive files
  create` (parents as an array inside the JSON body) or updated in place.
- The app's Export/Import is the merge path: import the Drive JSON into
  the app, edit, export, upload. `PCCore.mergeRecords` flags both-sides
  edits as conflicts — resolve by hand, never by force.

## For Gemini (via supported integrations)

- Read: the same Drive JSON, or the repo (public GitHub Pages site for
  viewing; the JSON is linked from the app footer in a deployed build).
- Write: same rule as ChatGPT — via a Task Exchange task, or by asking
  Muse to apply the change. Gemini does not edit the Drive JSON in place.
- The Gemini coding worker (TASK-GPT-20261123) works from the repo the
  same way it works from `ai-gateway`: isolated branch per task, draft
  PR, no merge without Ryan's approval.

## Rules every agent follows

1. **Ideas are never assignments.** Promoting an idea needs Ryan's
   explicit approval with approver + scope + owner, recorded in the
   audit log. No agent promotes an idea on its own say-so.
2. **No dispatch without authorization.** `ready` means ready-for-review,
   not "go". Starting work needs Ryan's explicit authorization each time.
3. **No invented progress.** If a status is unknown, say so. Provenance
   is mandatory on seeded facts; "unknown" is a valid value.
4. **No automatic merges or deployments.** PRs and deploys wait for Ryan.
5. **One editor at a time** on the JSON record; export immediately after
   editing; conflicts are resolved by a human, never silently.

## Machine-readable entry points

- Record: `data/seed.json` (format `pcc-1`, documented in
  `docs/DATA-MODEL.md`).
- Logic: core.js — `promoteIdea`, `dispatchTask`, `completeTask`,
  `acceptTask`, `addPrerequisite`, `blockersFor`, `mergeRecords`. Pure
  functions, usable from Node or the browser, no DOM dependency.
- Tests: `tests/test-queue.js` — run before claiming any queue behaviour
  works.
