# Firebase setup — owner steps (Google sign-in + Firestore)

Everything in the app that needs Firebase is already written and tested
as far as it can be without a Firebase project. **No Firebase project
exists yet, and none can be created without Ryan signing in to the
Firebase console** — that step is his, about 15 minutes, $0, no billing.

Owner account for everything below: **ryan.l.brown@gmail.com**
(the Google account Ryan uses for the Drive Task Exchange). If he signs
in with a different Google account, the owner email in
`firebase-config.js` and in `firestore.rules` must be changed to match —
the two must agree.

## What Ryan does, in order

### 1. Create the Firebase project (free tier, no billing)

1. Open https://console.firebase.google.com/ and sign in as
   **ryan.l.brown@gmail.com**.
2. **Add project** → name it `project-command-center` → Continue.
3. Google Analytics: leave it **off** (the app sends no analytics).
4. Create project. **Do NOT enable billing** — the Spark (free) plan is
   all this needs. If any screen offers Blaze / pay-as-you-go, decline
   it; nothing in this setup requires it.

### 2. Enable Google sign-in

1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Google** → **Enable** → Save.
3. If it asks for a support email, pick ryan.l.brown@gmail.com.
   (Firebase creates the OAuth client for you; there is nothing to
   download or paste at this step.)

### 3. Create the Firestore database

1. Left menu → **Build → Firestore Database** → **Create database**.
2. **Start in production mode** (not test mode — test mode allows
   anyone to read/write for 30 days; never use it).
3. Location: pick **nam5 (United States)** (or the nearest region —
   it cannot be changed later, but any region works for this app).
4. Create.

### 4. Publish the security rules (owner-only)

1. In Firestore Database → **Rules** tab.
2. Replace the whole editor contents with the file
   **`firestore.rules`** from this repo (copy/paste).
3. **Publish.** The rules allow exactly one account —
   ryan.l.brown@gmail.com — to read/write the single document
   `pcc/main`, and deny everything else.
4. Sanity check in the same tab (**Rules Playground**): simulate a
   `get` on `/pcc/main` with **unauthenticated** → must be **Denied**;
   simulate with authentication provider **Google**, auth token email
   `ryan.l.brown@gmail.com` → must be **Allowed**. Simulate any other
   email → **Denied**.

### 5. Register the web app and copy the config

1. Left menu → **Project settings** (gear) → **Your apps** →
   **Web** (`</>`).
2. App nickname: `Project Command Center` → **Register app**.
   (No Firebase Hosting checkbox needed — hosting is GitHub Pages.)
3. Copy the `firebaseConfig` object it shows.

### 6. Put the config in the repo (local file, never committed)

1. In the repo, copy `firebase-config.example.js` to
   **`firebase-config.js`**.
2. Paste the values from step 5 into it. Keep
   `ownerEmail: 'ryan.l.brown@gmail.com'`.
3. Run `git status` — **`firebase-config.js` must NOT appear**.
   It is gitignored; if it shows up, stop and tell Muse — do not commit
   it.
4. This file lives on Ryan's machine / the deploy machine only. The
   public GitHub Pages site does not have it yet — see step 7.

### 7. Deploy the config to the live site

`firebase-config.js` is gitignored, so GitHub Pages cannot see it —
that is deliberate (real keys never go in a public repo). Two safe
options; pick one:

- **Option A (simplest, recommended for now): run it locally.**
  `python3 -m http.server 8000` in the repo with `firebase-config.js`
  present, open http://localhost:8000, sign in with Google. Full
  Firebase sync on the owner's machine, $0, nothing secret published.
- **Option B (hosted, later):** deploy the static site to **Firebase
  Hosting** instead of GitHub Pages (`firebase init hosting`,
  `firebase deploy --only hosting` — free tier), and let the Firebase
  CLI inject the config at deploy time from the project Ryan owns.
  Do NOT paste the config into a file and push it to GitHub to make
  Pages work — that would publish the API key in a public repo.

Until one of these is done, the live Pages site stays in **local-only
mode**: passcode gate, no cloud data, Drive export/import still works.

### 8. First sign-in and data migration

1. Open the app (local run, or the hosted URL from step 7).
2. Click **Sign in with Google**, choose **ryan.l.brown@gmail.com**.
   Any other account is refused and signed straight back out.
3. First sign-in with projects already in the browser cache: the app
   **migrates the local cache up to Firestore** (`pcc/main`) once, and
   says so. If the browser cache is empty, the app shows the empty
   state — **Import** the Drive JSON export to load the projects.
4. From then on, every save writes to Firestore as well as the local
   cache, and opening the app on another signed-in device loads the
   newer record automatically.

### 9. Verify the security (do this once, it takes two minutes)

1. Open the live app in a **private/incognito window** → only the
   login shell appears; no project names, no task titles anywhere.
2. Sign in with a **different Google account** (any spare account) →
   the app refuses it and signs it out; no data loads.
3. Sign in as ryan.l.brown@gmail.com → projects load.
4. Firebase console → Firestore → `pcc/main` exists and holds the
   record; **no other collections/documents** exist.

## Costs (Spark free tier — no billing)

| Item | Free-tier allowance | This app's use |
|---|---|---|
| Firestore storage | 1 GiB | One small JSON document — kilobytes |
| Firestore reads | 50,000 / day | One read per app open |
| Firestore writes | 20,000 / day | One write per save |
| Firebase Auth (Google) | Free, unlimited | One user |
| **Total** | | **$0 / month** |

The free tier cannot be exceeded by one user editing a notebook. No
billing is enabled, and nothing in this setup can charge Ryan.

## Backup / export / import (unchanged)

- **Export JSON** in the app still downloads the full `pcc-1` record;
  upload it to the Drive Task Exchange folder as before — Drive
  version history is the backup of record.
- **Import JSON** still merges a Drive export into the app (conflicts
  flagged for human review, never silently overwritten).
- Firestore is a sync layer, not the only copy: if Firebase ever goes
  away, the Drive export is still the durable record, and the app
  keeps working in local-only mode.
- **Conflict resolution:** Firestore holds one document (`pcc/main`),
  last write wins per save. Two devices editing at once: the later
  save overwrites the earlier one. The one-editor-at-a-time rule
  still applies — export to Drive after editing, and use Import to
  reconcile rather than editing on two devices simultaneously.

## What is NOT verified yet

- **Live rules enforcement is UNTESTED.** The rules file was reviewed
  line by line and is covered by static tests (`tests/test-secure.js`),
  but no Firebase project exists yet, so no live read/write was ever
  attempted against them — and the Firestore emulator could not run
  here (no Java, no firebase CLI in this environment). Run the Rules
  Playground checks in step 4 and the sign-in checks in step 9 before
  treating the deployment as secure.
- **Two-session live sync** (edit in browser A, see it in browser B)
  was not observed end to end — it needs the Firebase project plus
  two signed-in sessions. The load/save code path and the merge logic
  are tested; the live round-trip is the first acceptance check after
  setup.
- **Firebase SDK loading from the CDN** is code-complete but was not
  observed against a real config (no config exists yet). If the CDN
  import fails in Ryan's browser, the app falls back to local-only
  mode and says so — it never fails silently into an unlocked state.
