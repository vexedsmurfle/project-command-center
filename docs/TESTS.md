# Tests — what was tested, how, and what is still unverified

Run: `node tests/test-queue.js && node tests/test-secure.js`
(exit 0 = all pass). Queue suite: 16 tests (15 original + 1 synthetic
fixture test); security suite: 9 tests. All passing as of 2026-11-25.

## Covered by automated tests (`tests/test-queue.js`, core.js)

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
15. Dependency queue on a synthetic fixture: a task waiting on an
    unaccepted prerequisite is not dispatchable.
16. Seed data (local-only file, runs only when `data/seed.json` exists
    on the machine; skips in a clean checkout): the seeded backlog item
    that depends on the Command Center task is `waiting`, is not
    dispatchable, and its full scope is preserved verbatim in its
    project's notebook.

A test failure during development (queued→waiting counted as "unblocked")
was fixed in `core.js` — `completeTask`/`acceptTask` now only report a
dependent as unblocked when it actually reaches `ready`.

## Covered by security tests (`tests/test-secure.js`, auth.js)

1. The seed file is not tracked by git.
2. The seed file and `firebase-config.js` are gitignored.
3. No served file contains seeded project records (project names, task
   IDs, supplier names, scope text).
4. The app never fetches the seed file (app.js, sw.js, index.html).
5. No file contains a real Firebase API key; the example config carries
   placeholders only.
6. `firestore.rules` requires authentication, checks the owner email,
   contains no open allow, and denies everything outside `pcc/main`.
7. Gate logic: the owner account is admitted (case-insensitive), every
   other account and every missing value is refused.
8. Gate states: login / owner / not-owner / local-only.
9. Data loads only for the owner or local-only gates — never for the
   unauthenticated login shell or a non-owner.

## Verified by hand (2026-11-25)

- `node --check` on core.js, auth.js, firebase.js and app.js: clean.
- Public-bundle check: `curl` of the live Pages site confirms the old
  build still serves `data/seed.json` (HTTP 200) on `main` — the leak
  this branch removes. After merge, re-check that the URL 404s.
- App served locally via `python3 -m http.server` and smoke-checked
  (see screenshots).

## Still unverified / not yet tested

- **Live Firestore rules enforcement: UNTESTED.** No Firebase project
  exists yet, so no live read/write was ever attempted against the
  rules, and the Firestore emulator could not run here (no Java, no
  firebase CLI in this environment). The rules file was reviewed line
  by line and is covered by static tests. Ryan must run the Rules
  Playground + sign-in checks in `docs/FIREBASE-SETUP.md` before
  treating the deployment as secure.
- **Live Google sign-in round-trip: UNTESTED.** Same blocker — no
  Firebase project, no config. The sign-in code path (including the
  non-owner refusal) is written and code-reviewed, not observed.
- **Two-session live sync** (edit in browser A, see it in browser B)
  was not observed end to end — it needs the Firebase project plus two
  signed-in sessions. The load/save code path and the merge logic are
  tested; the live round-trip is the first acceptance check after setup.
- **Mobile + desktop responsive screenshots:** VERIFIED 2026-11-25 with
  the sandboxed Chromium via puppeteer-core (`screenshots/shot.js`).
  `screenshots/desktop-gate.png`, `desktop-empty.png`,
  `mobile-gate.png`, `mobile-empty.png` show the unauthenticated login
  shell and the empty state after unlock (no project data in either).
  The authenticated view (`desktop-cards.png`, `desktop-project.png`,
  `desktop-tasks.png` and mobile equivalents) is verified from a local
  run with the gitignored seed injected into localStorage, but those
  files are NOT committed — screenshots showing project records are
  never put in the public repo. Note: the sandboxed browser cannot
  reach this VM's loopback server, so shots were taken over `file://`.
- **Note create/read/edit across sessions:** the code path is exercised
  by the app (localStorage persistence + Export/Import), but a true
  two-session round-trip (edit in browser A, import in browser B) was
  not observed end to end — it needs two browser sessions. The merge
  logic that underpins it IS tested (tests 13–14).
- **Live Drive round-trip:** Export JSON → upload to Drive → Import on
  a second device was not observed in this run; the file format and
  merge are tested, the Drive upload step is the standard exchange
  workflow.
- **GitHub Pages live URL:** LIVE as of 2026-11-25 ~19:00 CST
  (`https://vexedsmurfle.github.io/project-command-center/`, HTTP 200).
  The live site is still the old `main` build until this branch's PR
  merges — see `docs/DEPLOYMENT.md`.
