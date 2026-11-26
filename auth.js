/**
 * Project Command Center — access-gate helpers.
 * Pure functions, no DOM. Shared by the browser app (app.js) and the
 * Node test suite (tests/test-secure.js) via UMD export.
 *
 * Access model:
 *  - Firebase configured + signed in as the owner -> 'owner': project
 *    data may load (from Firestore) and sync back.
 *  - Firebase configured + signed in as anyone else -> 'not-owner':
 *    no data loads, the session is signed out by the app.
 *  - Firebase configured + not signed in -> 'login': only the login
 *    shell is shown; no project data is rendered or fetched.
 *  - Firebase NOT configured -> 'local-only': the device passcode gate
 *    applies and data lives only in this browser's cache + Drive
 *    export/import. This is the fallback until Ryan completes the
 *    Firebase setup in docs/FIREBASE-SETUP.md.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PCAuth = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /** True only when the signed-in account is the owner account. */
  function isOwner(user, ownerEmail) {
    if (!user || !user.email || !ownerEmail) return false;
    return String(user.email).toLowerCase() === String(ownerEmail).toLowerCase();
  }

  /**
   * Gate state for a given situation.
   * opts: { firebaseConfigured, user, ownerEmail }
   * Returns 'login' | 'owner' | 'not-owner' | 'local-only'.
   */
  function gateState(opts) {
    opts = opts || {};
    if (opts.firebaseConfigured) {
      if (!opts.user) return 'login';
      return isOwner(opts.user, opts.ownerEmail) ? 'owner' : 'not-owner';
    }
    return 'local-only';
  }

  /** Project data may load only in these gate states. */
  function canLoadData(gate) {
    return gate === 'owner' || gate === 'local-only';
  }

  return {
    isOwner: isOwner,
    gateState: gateState,
    canLoadData: canLoadData
  };
});
