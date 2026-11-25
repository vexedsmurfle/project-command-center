# Data model — source of truth, sync, dedup, conflicts, permissions, backups

## Source of truth

There are exactly two copies of the record, with a strict ranking:

1. **Google Drive — durable.** A JSON file in format `pcc-1` (see
   `data/seed.json`) stored in the Task Exchange folder
   "Muse - ChatGPT Task Exchange". This is the record that survives
   browser clears, VM swaps and device loss. Export from the app
   (Export JSON button) and upload it to Drive; that upload IS the save.
   `app/data/seed.json` is only a bundled first-run copy of the same
   file (so the static site works standalone); the Drive copy is
   canonical and the two must be kept in sync on release.
2. **Browser localStorage (`pcc-store-v1`) — cache.** Fast, offline,
   per-device. It is never the authority. Clearing browser data loses
   nothing durable as long as the last export reached Drive.

The Task Exchange task/result documents themselves remain the authority
for individual assignments (statuses NEW / IN PROGRESS / COMPLETE). The
Command Center mirrors their status; it does not replace them. If the
two ever disagree, the task document wins and the Command Center record
must be corrected, not the other way round.

## Record format (`pcc-1`)

```json
{
  "format": "pcc-1", "version": 1, "updatedAt": "<ISO-8601>",
  "projects": [ {
    "id": "kitchen-hub", "name": "Kitchen Hub", "status": "active|paused",
    "summary": "...", "nextSteps": "...", "lastUpdate": "YYYY-MM-DD",
    "provenance": "where each fact was verified from",
    "blockers": ["..."],
    "links": [{ "label": "...", "url": "..." }],
    "tasks": [ {
      "id": "KH-001", "title": "...", "status": "queued|waiting|ready|in-progress|in-review|done|blocked",
      "owner": "Muse|Ryan|null", "prerequisites": ["KH-002"],
      "accepted": false, "approvedBy": null, "approvedAt": null,
      "dispatchAuthorizedBy": null, "notes": "...",
      "provenance": "...", "updatedAt": "<ISO-8601>" } ],
    "ideas": [ { "id": "KH-IDEA-01", "title": "...", "status": "idea",
      "notes": "...", "provenance": "...", "updatedAt": "<ISO-8601>" } ],
    "notebook": [ { "id": "KH-NB-01", "title": "...", "body": "...",
      "author": "...", "updatedAt": "<ISO-8601>" } ],
    "activity": [ { "at": "<ISO-8601>", "actor": "...", "action": "...", "detail": "..." } ]
  } ],
  "audit": [ { "at": "...", "actor": "...", "action": "idea-promoted|task-done|task-accepted|task-dispatched|note-added|note-edited",
    "itemId": "...", "detail": "..." } ]
}
```

## Status vocabulary

| Status | Meaning |
|---|---|
| `idea` | Brainstorming only. Not executable, no owner, cannot be dispatched or completed. |
| `queued` | Authorized task, no unmet prerequisites, not started. |
| `waiting` | Authorized task blocked by at least one unmet prerequisite (listed visibly). |
| `ready` | Ready-for-review: all prerequisites done **and accepted**. Still needs explicit dispatch authorization to start. |
| `in-progress` | Started, with a recorded dispatch authorization. |
| `in-review` | Work submitted, awaiting acceptance. |
| `done` | Marked complete by the worker. **Not** the same as accepted. |
| `blocked` | Manually flagged blocker (distinct from `waiting`, which is prerequisite-driven). |

Project status is `active` / `paused` only — a paused project (e.g. Ctrl
Assist, paused Nov 6 at Ryan's word) never auto-resumes.

## Sync

Manual, deliberate, versioned:

1. In the app: **Export JSON** downloads the current record.
2. Upload it to the Drive Task Exchange folder (replacing the previous
   `pcc-1` file — Drive keeps version history; do not delete old versions).
3. On another device / after a fresh load: **Import JSON** from the Drive
   file. The merge is last-write-wins **per record** by `updatedAt`,
   computed against the last imported/exported snapshot.

## Concurrent edits and conflicts

The merge (`PCCore.mergeRecords`, tested) compares each record against
the common base snapshot:

- Changed on one side only → the newer version wins, silently.
- Changed on **both** sides since the base, with different
  `updatedAt` → **conflict**: the local copy is kept, the record is
  listed in a banner, and a human resolves it by editing and
  re-exporting. Nothing is silently overwritten.
- A record present in the incoming file but absent locally is added;
  nothing is ever deleted by a merge.

Because sync is manual, the practical rule is: **one editor at a time,
export immediately after editing.** The conflict path exists for the
day that rule is broken, not as a routine workflow.

## Deduplication

- Stable IDs are the dedup key: project IDs (`kitchen-hub`),
  task IDs (`KH-001`), idea IDs (`KH-IDEA-01`), notebook IDs
  (`KH-NB-01`). Never reuse an ID; never rename one in place — create
  a new record and link the old one.
- Task Exchange documents are deduped by Task ID in the filename
  (`TASK-GPT-YYYYMMDD-<slug>`); the Command Center links to them, it
  does not copy their bodies.
- Import never creates a duplicate of an existing ID; it updates the
  matching record.

## Permissions

- Drive folder: Ryan's Google account owns it; agents act through the
  existing Task Exchange access only. No new sharing, no public links.
- The app itself: local passcode gate (device lock). For hosted use,
  Firebase Auth / Google sign-in restricted to Ryan's account — see
  `docs/DEPLOYMENT.md`. The app has no server, no user database and no
  way to grant anyone else access.
- Idea promotion and dispatch authorization are recorded with the
  approver's name; the app does not verify identity beyond the passcode
  gate, so treat the audit log as a record of *who claimed to approve*,
  and keep approvals in the Drive exchange where identity is real.

## Backups

- Drive version history on the JSON file (automatic).
- The Task Exchange folders themselves are the backup of record for
  tasks/results; the Command Center JSON is a summary, not the only
  copy of anything important.
- Recommended: keep a dated copy of each export in the repo
  (`data/exports/` is git-ignored by default — exports contain project
  notes; do not commit them unless Ryan asks).

## What the app never does

- No credentials or private data in the repo, the JSON, or any hosted
  page. Provider keys stay in `~/.secure/` and Dell env vars.
- No automatic merges, no automatic deployments, no auto-dispatch.
- No invented progress: a status with no provenance is labelled
  "not recorded — treat as unverified".
