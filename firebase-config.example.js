// Firebase web config for the Project Command Center.
// ---------------------------------------------------------------------------
// COPY this file to `firebase-config.js` and fill in the values from the
// Firebase console (see docs/FIREBASE-SETUP.md for the exact steps).
//
// `firebase-config.js` is gitignored and must NEVER be committed — the
// values below are PLACEHOLDERS ONLY. This file contains no real key,
// no real project id, and no credential of any kind.
//
// `ownerEmail` is the ONLY Google account allowed to read or write project
// data (enforced again server-side by firestore.rules). It must be the
// Google account Ryan signs in with: ryan.l.brown@gmail.com. If Ryan signs
// in with a different Google account, change this value AND the email in
// firestore.rules to match — the two must agree.
// ---------------------------------------------------------------------------
export default {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  ownerEmail: 'ryan.l.brown@gmail.com'
};
