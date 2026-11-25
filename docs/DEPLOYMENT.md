# Deployment, setup, costs, failure states

## Hosting: GitHub Pages (free, $0)

The app is a static site (repo root — no build step, no backend). It is
deployed from the `main` branch via GitHub Pages:

1. Repo: `https://github.com/vexedsmurfle/project-command-center`
   (branch `main`; Pages source: branch `main`, path `/`).
2. GitHub Pages serves the repo root on the `main` branch.
3. Live URL: `https://vexedsmurfle.github.io/project-command-center/`

Verify after deploy: the page loads, the passcode gate appears, a seeded
project card renders. If Pages is not yet live when you read this, the
local run below is the verified path and the Pages URL is the next step
(see "Deployment status" in the result file for this task).

## Run locally (verified)

```sh
cd project-command-center
python3 -m http.server 8000
# open http://localhost:8000
```

First visit: set a passcode. It is stored only in that browser
(SHA-256 hash in localStorage). There is no server-side reset — clearing
the browser's site data removes the lock and the local cache; the Drive
JSON remains the durable copy.

## Alternative: Firebase Hosting (free tier, same as comedy-card-builder)

```sh
firebase init hosting   # project: <existing or new free-tier project>
firebase deploy --only hosting
```

Same static files, same $0. Use this if GitHub Pages is ever
unavailable. Do not create a new Firebase project or enable billing
without Ryan's approval.

## Authentication

**Shipped:** local passcode gate. It keeps a casual visitor out of the
page on a shared screen; it is NOT server-side auth. Anyone with the
device and the passcode (or with browser-data access) can read the local
cache. The durable Drive record is protected by Ryan's Google account,
not by this gate.

**For a shared/hosted deployment (not yet wired):** add Firebase Auth
with Google sign-in, restricted to Ryan's Google account, before sharing
the URL with anyone. Until that is done, treat the Pages URL as
"anyone with the link can open the gate page; the passcode is the only
barrier" — do not put private data in the seed beyond what is already
in the Drive exchange, and do not share the URL publicly.

**Failure states (tested/observed):**

- Wrong passcode → "Wrong passcode" message, no access, no lockout
  (deliberate: a lockout would lock Ryan out of his own notebook).
- No passcode set yet → first entry sets it; the app says so plainly.
- Seed file missing / fetch fails → the app starts with an empty project
  list and a "no projects" message rather than crashing; re-export from
  Drive to restore.
- Import of a non-Command-Center file → "Import failed: not a Project
  Command Center record" toast; nothing is overwritten.
- Import with both-sides edits → amber conflict banner listing the
  record IDs; local copy kept; human resolves.
- Offline → the app shell is cached by the service worker; the local
  cache still works. Export/Import to Drive needs connectivity.

## Setup checklist for Ryan

1. Open the live URL (or local run), set the passcode.
2. Check the seeded projects; correct anything labelled unknown.
3. Export JSON → upload to the Drive Task Exchange folder (this becomes
   the durable record).
4. Decide: keep the passcode gate, or ask for Firebase Auth / Google
   sign-in to be wired (half a day's work, still $0).
5. Accept the Command Center (PCC-001) — that unblocks CG-001 Ocean
   Dynamics to ready-for-review. It still needs a separate explicit
   authorization before any development starts.

## Costs

| Item | Cost |
|---|---|
| GitHub Pages hosting | $0 |
| Repo (public) | $0 |
| Firebase Hosting alternative (free tier) | $0 |
| App itself (no backend, no APIs) | $0 |
| **Total** | **$0 / month** |

No new paid services were created. No billing was enabled anywhere.
