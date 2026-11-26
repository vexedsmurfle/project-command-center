# Deployment, setup, costs, failure states

## Hosting: GitHub Pages (free, $0)

The app is a static site (repo root — no build step, no backend). It is
deployed from the `main` branch via GitHub Pages:

1. Repo: `https://github.com/vexedsmurfle/project-command-center`
   (branch `main`; Pages source: branch `main`, path `/`).
2. GitHub Pages serves the repo root on the `main` branch.
3. Live URL: `https://vexedsmurfle.github.io/project-command-center/`

Verify after deploy: the page loads and the login shell appears — no
project names or task titles are visible before sign-in. Then sign in
(see "Authentication") and confirm the projects load.

## Deployment status (2026-11-25)

- **GitHub Pages: LIVE** at
  `https://vexedsmurfle.github.io/project-command-center/`
  (enabled 2026-11-25 ~19:00 CST via the GitHub API after earlier 500s;
  the first check 404'd while the deploy propagated, then returned 200).
- **Security fix on this branch:** the live `main` site still serves the
  old build, which bundles the seed record (`data/seed.json` returns
  HTTP 200 — verified 2026-11-25). That leak is removed by this branch:
  the seed is no longer in the repo, the service worker no longer caches
  it, and the app never fetches it. The fix takes effect when this
  branch's PR is merged — until then, treat the live URL as "public
  shell serving the old seeded build" and do not share it further.
- **Local run: VERIFIED.** `cd project-command-center &&
  python3 -m http.server 8000`, open http://localhost:8000 — serves
  200 on all app files; screenshots below were taken against the real
  running app.

## Run locally (verified)

```sh
cd project-command-center
python3 -m http.server 8000
# open http://localhost:8000
```

First visit: sign in with Google (if Firebase is configured — see
`docs/FIREBASE-SETUP.md`) or set a passcode (local-only mode). The
passcode is stored only in that browser (SHA-256 hash in localStorage).
There is no server-side reset — clearing the browser's site data removes
the lock and the local cache; the Drive JSON (or Firestore record)
remains the durable copy.

## Alternative: Firebase Hosting (free tier, same as comedy-card-builder)

```sh
firebase init hosting   # project: <existing or new free-tier project>
firebase deploy --only hosting
```

Same static files, same $0. Use this if GitHub Pages is ever
unavailable. Do not create a new Firebase project or enable billing
without Ryan's approval.

## Authentication

**Shipped:** Google sign-in via Firebase Auth (owner account only),
wired in `firebase.js` / `auth.js`, enforced server-side by
`firestore.rules`. It activates only when `firebase-config.js` exists
— see `docs/FIREBASE-SETUP.md` for the exact owner steps (create the
free-tier project, enable Google sign-in, create Firestore, publish the
rules, paste the web config). Until then the app runs in **local-only
mode** behind the device passcode gate described below.

**Local-only mode (fallback):** a local passcode gate. It keeps a casual
visitor out of the page on a shared screen; it is NOT server-side auth.
Anyone with the device and the passcode (or with browser-data access)
can read the local cache. The durable Drive record is protected by
Ryan's Google account, not by this gate.

**What the gate guarantees in either mode:** an unauthenticated visitor
sees only the login shell. No project data is fetched, rendered, cached
or shipped with the page before authentication passes — the public
bundle contains no seeded records at all (enforced by
`tests/test-secure.js`).

**Failure states (tested/observed):**

- Wrong passcode → "Wrong passcode" message, no access, no lockout
  (deliberate: a lockout would lock Ryan out of his own notebook).
- No passcode set yet → first entry sets it; the app says so plainly.
- Signed in with a non-owner Google account → refused, signed straight
  back out, no data loads (client check; the Firestore rules deny it
  server-side as well).
- Firebase not configured → the app runs in local-only mode and says so
  on the login screen; nothing fails silently into an unlocked state.
- No projects loaded (fresh sign-in, empty Firestore) → the app shows
  an empty state with Import instructions rather than crashing;
  re-import from Drive to restore.
- Import of a non-Command-Center file → "Import failed: not a Project
  Command Center record" toast; nothing is overwritten.
- Import with both-sides edits → amber conflict banner listing the
  record IDs; local copy kept; human resolves.
- Offline → the app shell is cached by the service worker; the local
  cache still works. Export/Import to Drive needs connectivity.

## Setup checklist for Ryan

1. Complete the Firebase setup in `docs/FIREBASE-SETUP.md` (create the
   free-tier project, enable Google sign-in, create Firestore, publish
   the rules, copy the web config into `firebase-config.js` — never
   committed).
2. Open the live URL (or local run), sign in with Google, check the
   projects load; correct anything labelled unknown.
3. Export JSON → upload to the Drive Task Exchange folder (this becomes
   the durable record).
4. Accept the Command Center task — that moves its dependent backlog
   item to ready-for-review. It still needs a separate explicit
   authorization before any development starts.

## Costs

| Item | Cost |
|---|---|
| GitHub Pages hosting | $0 |
| Repo (public) | $0 |
| Firebase Auth (Google, 1 user) | $0 |
| Firestore (Spark free tier) | $0 |
| Firebase Hosting alternative (free tier) | $0 |
| App itself (no backend, no APIs) | $0 |
| **Total** | **$0 / month** |

No new paid services were created. No billing was enabled anywhere.
