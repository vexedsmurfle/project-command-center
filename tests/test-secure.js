/* Project Command Center — security tests for the auth-gated deployment.
 * Run: node tests/test-secure.js   (exit 0 = all pass)
 * These tests cover what can be verified WITHOUT a Firebase project:
 *   - the public bundle contains no seeded project records
 *   - the seed file is not tracked by git and is gitignored
 *   - firestore.rules restricts access to the owner account only
 *   - the example config contains placeholders only, no real key
 *   - the access-gate logic (auth.js) admits only the owner
 * What these tests do NOT cover (stated plainly, not claimed):
 *   - live Firestore rules enforcement (needs a Firebase project;
 *     the emulator could not run here — no Java, no firebase CLI)
 *   - a live Google sign-in round-trip
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var ROOT = path.join(__dirname, '..');
var passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { console.log('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function tracked(rel) {
  try {
    var out = execSync('git ls-files -- ' + rel, { cwd: ROOT, encoding: 'utf8' }).trim();
    return out.length > 0;
  } catch (e) { return false; }
}

var PCAuth = require('../auth.js');

// Markers that must NEVER appear in any file served by GitHub Pages.
// (Real project names, task IDs, supplier names, scope text from the seed.)
var PRIVATE_MARKERS = [
  'Kitchen Hub', 'Ctrl Assist', 'Caribbean game', 'AI Gateway',
  'BXAIOT', 'Ocean Dynamics', 'CG-001', 'PCC-001', 'KH-001', 'KH-002',
  'KH-003', 'PU-001', 'PU-002', 'PU-003', 'CA-001', 'AG-001', 'AG-002',
  'KH-IDEA-01', 'PU-IDEA-01', 'AG-IDEA-01', 'CG-NB-01',
  'Eric Chen', 'HuTag', 'simulated wave erosion', 'KitchenHub.exe',
  'OwnTracks', 'Wilkins', 'Dell OptiPlex'
];
// Files the static site serves (the app bundle + docs + config example).
var SERVED_FILES = [
  'index.html', 'app.js', 'core.js', 'auth.js', 'firebase.js',
  'styles.css', 'sw.js', 'manifest.json', 'firebase-config.example.js',
  'firestore.rules',
  'README.md', 'docs/DATA-MODEL.md', 'docs/DEPLOYMENT.md',
  'docs/INTERFACE.md', 'docs/TESTS.md', 'docs/FIREBASE-SETUP.md',
  'data/README.md'
];

check('seed file is not tracked by git', function () {
  assert.strictEqual(tracked('data/seed.json'), false, 'data/seed.json must not be tracked');
});

check('seed file and firebase config are gitignored', function () {
  var gi = read('.gitignore');
  assert.ok(gi.indexOf('data/seed.json') !== -1, '.gitignore must list data/seed.json');
  assert.ok(gi.indexOf('firebase-config.js') !== -1, '.gitignore must list firebase-config.js');
});

check('no served file contains seeded project records', function () {
  var hits = [];
  SERVED_FILES.forEach(function (f) {
    var body = read(f);
    PRIVATE_MARKERS.forEach(function (m) {
      if (body.indexOf(m) !== -1) hits.push(f + ' contains "' + m + '"');
    });
  });
  assert.strictEqual(hits.length, 0, hits.join('; '));
});

check('app never fetches the seed file', function () {
  assert.ok(read('app.js').indexOf('seed.json') === -1, 'app.js must not reference seed.json');
  assert.ok(read('sw.js').indexOf('seed.json') === -1, 'sw.js must not cache seed.json');
  assert.ok(read('index.html').indexOf('seed.json') === -1, 'index.html must not reference seed.json');
});

check('test files contain no verbatim seeded scope text', function () {
  // The test suite must not become a second copy of the record: IDs and
  // scope bodies are derived from the local seed at run time, never
  // quoted in the test files. (tests/test-secure.js itself lists the
  // forbidden markers — that list is the exception; it names strings to
  // forbid and holds no record content.)
  var tq = read('tests/test-queue.js');
  ['simulated wave erosion', 'Ocean Dynamics', 'BXAIOT', 'Eric Chen', 'HuTag',
   'CG-001', 'PCC-001', 'KH-001', 'Kitchen Hub'].forEach(function (m) {
    assert.ok(tq.indexOf(m) === -1, 'tests/test-queue.js must not quote "' + m + '"');
  });
});

check('no file contains a real Firebase API key', function () {
  var hits = [];
  SERVED_FILES.concat(['tests/test-secure.js']).forEach(function (f) {
    var body = read(f);
    if (/AIza[0-9A-Za-z_-]{10,}/.test(body)) hits.push(f);
  });
  assert.strictEqual(hits.length, 0, 'real API key pattern in: ' + hits.join(', '));
  assert.ok(read('firebase-config.example.js').indexOf('YOUR_API_KEY') !== -1,
    'example config must carry the YOUR_API_KEY placeholder');
});

check('firestore.rules: owner-only read/write, no open access', function () {
  var rules = read('firestore.rules');
  assert.ok(rules.indexOf('rules_version') !== -1, 'rules_version present');
  assert.ok(rules.indexOf('request.auth != null') !== -1, 'must require authentication');
  assert.ok(rules.indexOf('request.auth.token.email') !== -1, 'must check the auth email');
  assert.ok(rules.indexOf('ryan.l.brown@gmail.com') !== -1, 'must name the owner account');
  assert.ok(/allow read, write: if true/.test(rules) === false, 'must not contain an open allow');
  assert.ok(/allow read, write: if request\.auth != null\s*$/.test(rules) === false,
    'must not allow any authenticated user (email check required)');
  assert.ok(rules.indexOf('allow read, write: if false') !== -1, 'catch-all deny present');
  assert.ok(rules.indexOf('pcc/main') !== -1, 'rules scope the pcc/main document');
});

check('gate: owner account is admitted, everyone else is not', function () {
  assert.strictEqual(PCAuth.isOwner({ email: 'ryan.l.brown@gmail.com' }, 'ryan.l.brown@gmail.com'), true);
  assert.strictEqual(PCAuth.isOwner({ email: 'Ryan.L.Brown@Gmail.com' }, 'ryan.l.brown@gmail.com'), true,
    'email match is case-insensitive');
  assert.strictEqual(PCAuth.isOwner({ email: 'someone.else@gmail.com' }, 'ryan.l.brown@gmail.com'), false);
  assert.strictEqual(PCAuth.isOwner(null, 'ryan.l.brown@gmail.com'), false);
  assert.strictEqual(PCAuth.isOwner({ email: null }, 'ryan.l.brown@gmail.com'), false);
  assert.strictEqual(PCAuth.isOwner({ email: 'ryan.l.brown@gmail.com' }, null), false);
});

check('gate states: login / owner / not-owner / local-only', function () {
  var owner = { email: 'ryan.l.brown@gmail.com' };
  var other = { email: 'intruder@example.com' };
  assert.strictEqual(PCAuth.gateState({ firebaseConfigured: true, user: null, ownerEmail: 'ryan.l.brown@gmail.com' }), 'login');
  assert.strictEqual(PCAuth.gateState({ firebaseConfigured: true, user: owner, ownerEmail: 'ryan.l.brown@gmail.com' }), 'owner');
  assert.strictEqual(PCAuth.gateState({ firebaseConfigured: true, user: other, ownerEmail: 'ryan.l.brown@gmail.com' }), 'not-owner');
  assert.strictEqual(PCAuth.gateState({ firebaseConfigured: false, user: null }), 'local-only');
  assert.strictEqual(PCAuth.gateState({ firebaseConfigured: false, user: owner }), 'local-only');
});

check('data loads only for owner or local-only gates', function () {
  assert.strictEqual(PCAuth.canLoadData('owner'), true);
  assert.strictEqual(PCAuth.canLoadData('local-only'), true);
  assert.strictEqual(PCAuth.canLoadData('login'), false, 'unauthenticated shell must load no data');
  assert.strictEqual(PCAuth.canLoadData('not-owner'), false);
});

check('firebase.js refuses non-owner sign-ins (code inspection)', function () {
  var fb = read('firebase.js');
  assert.ok(fb.indexOf('isOwner') !== -1, 'must call the owner check');
  assert.ok(fb.indexOf('signOut') !== -1, 'must sign out a non-owner');
  assert.ok(fb.indexOf('firebase-config.js') !== -1, 'must load the gitignored config');
  assert.ok(fb.indexOf('pcc') !== -1, 'must use the pcc Firestore document');
});

console.log(passed + ' tests passed.');
