# data/ — local-only seed data (NOT committed, NOT served)

`seed.json` in this directory is the first-run record for the Project
Command Center (format `pcc-1`, same as the Drive export). It is:

- **gitignored** — it never enters the repo and is never served by
  GitHub Pages. The public site ships only the login shell; project
  records load after authentication, from Firestore (or from a local
  Drive JSON import).
- **local-only** — it exists on the developer's machine so the app can
  be tested and screenshotted with real records, and so the test suite
  (`tests/test-queue.js`, seed test) can verify the real record.
  In a clean checkout the file is absent and that test skips itself.

Do NOT commit `seed.json`, do NOT copy it into the repo, and do NOT
upload it anywhere public. The durable copy of the record is the JSON
export in the Google Drive Task Exchange folder (and, once Firebase is
set up, the `pcc/main` Firestore document).
