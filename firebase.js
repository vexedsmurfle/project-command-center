/* Firebase Auth (Google sign-in) + Firestore sync — optional layer.
 *
 * Only activates when `firebase-config.js` exists next to this file.
 * That file is gitignored and NEVER committed; without it the app runs in
 * local-only mode (device passcode gate + localStorage cache + Drive
 * export/import), exactly as before.
 *
 * The Firebase JS SDK is loaded on demand from Google's CDN (v10.12.2).
 * No network call to Google happens until the owner signs in. No project
 * data is read or written before authentication succeeds AND the signed-in
 * account matches the owner email in the config (checked here AND enforced
 * server-side by firestore.rules).
 *
 * Firestore layout: a single document `pcc/main` holds the whole `pcc-1`
 * record (projects + audit). Only the owner account can read/write it.
 */
(function () {
  'use strict';
  var SDK_VERSION = '10.12.2';
  var state = {
    configured: false, config: null, app: null, auth: null, db: null,
    user: null, fns: null
  };

  function loadConfig() {
    // Dynamic import: a missing file (or file:// module restrictions)
    // rejects -> not configured. Never throws.
    return import('./firebase-config.js').then(function (m) {
      var cfg = m.default || m.firebaseConfig || null;
      if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf('YOUR_') === 0) return false;
      state.config = cfg;
      return true;
    }).catch(function () { return false; });
  }

  function loadSdk() {
    var base = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
    return Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js')
    ]);
  }

  /** Initialise if a real config exists. Resolves true/false; never throws. */
  function init() {
    return loadConfig().then(function (ok) {
      if (!ok) { state.configured = false; return false; }
      return loadSdk().then(function (mods) {
        var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
        state.app = appMod.initializeApp(state.config);
        state.auth = authMod.getAuth(state.app);
        state.db = fsMod.getFirestore(state.app);
        state.fns = { auth: authMod, fs: fsMod };
        state.configured = true;
        state.auth.onAuthStateChanged(function (u) {
          state.user = u
            ? { uid: u.uid, email: u.email || null, displayName: u.displayName || null }
            : null;
          document.dispatchEvent(new CustomEvent('pcc-auth-changed', { detail: { user: state.user } }));
        });
        return true;
      });
    }).catch(function () { state.configured = false; return false; });
  }

  function isConfigured() { return state.configured; }
  function currentUser() { return state.user; }
  function ownerEmail() { return state.config ? state.config.ownerEmail : null; }

  /** Google sign-in. Refuses (and signs out) any non-owner account. */
  function signInWithGoogle() {
    if (!state.configured) {
      return Promise.reject(new Error('Firebase is not configured (no firebase-config.js). See docs/FIREBASE-SETUP.md.'));
    }
    var provider = new state.fns.auth.GoogleAuthProvider();
    return state.fns.auth.signInWithPopup(state.auth, provider).then(function (cred) {
      var u = cred.user;
      if (!window.PCAuth || !PCAuth.isOwner({ email: u.email }, state.config.ownerEmail)) {
        return state.fns.auth.signOut(state.auth).then(function () {
          throw new Error('Signed in as ' + (u.email || 'unknown') +
            ', which is not the owner account (' + state.config.ownerEmail + '). Signed out.');
        });
      }
      state.user = { uid: u.uid, email: u.email, displayName: u.displayName || null };
      return state.user;
    });
  }

  function signOut() {
    if (!state.configured) return Promise.resolve();
    return state.fns.auth.signOut(state.auth);
  }

  function docRef() { return state.fns.fs.doc(state.db, 'pcc', 'main'); }

  /** Load the owner-only record. Resolves null when absent / not signed in. */
  function loadState() {
    if (!state.configured || !state.user) return Promise.resolve(null);
    return state.fns.fs.getDoc(docRef()).then(function (snap) {
      if (!snap.exists()) return null;
      var d = snap.data();
      if (!d || !Array.isArray(d.projects)) return null;
      return {
        version: d.version || 1,
        updatedAt: d.updatedAt || null,
        projects: d.projects,
        audit: d.audit || []
      };
    });
  }

  /** Save the record to the owner-only document. Resolves false when not signed in. */
  function saveState(store) {
    if (!state.configured || !state.user) return Promise.resolve(false);
    var payload = {
      version: store.version || 1,
      updatedAt: store.updatedAt || new Date().toISOString(),
      projects: store.projects || [],
      audit: store.audit || [],
      updatedBy: state.user.email,
      updatedByUid: state.user.uid
    };
    return state.fns.fs.setDoc(docRef(), payload, { merge: true }).then(function () { return true; });
  }

  window.PCFirebase = {
    init: init,
    isConfigured: isConfigured,
    currentUser: currentUser,
    ownerEmail: ownerEmail,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    loadState: loadState,
    saveState: saveState
  };
})();
