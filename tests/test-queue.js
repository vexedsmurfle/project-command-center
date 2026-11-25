/* Project Command Center — end-to-end tests for the dependency queue,
 * idea-promotion gate and sync/conflict merge (core.js, Node).
 * Run: node tests/test-queue.js   (exit 0 = all pass)
 */
var assert = require('assert');
var PCCore = require('../app/core.js');

var passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { console.log('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }
}
function tasks(list) { return JSON.parse(JSON.stringify(list)); }

var base = [
  { id: 'A', status: 'done', accepted: true, prerequisites: [] },
  { id: 'B', status: 'queued', prerequisites: ['A'] },
  { id: 'C', status: 'queued', prerequisites: ['B'] },
  { id: 'D', status: 'idea', prerequisites: [] },
  { id: 'E', status: 'queued', prerequisites: ['X-MISSING'] }
];

check('prereq satisfied moves dependent queued -> ready (ready-for-review)', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  assert.strictEqual(t.find(function (x) { return x.id === 'B'; }).status, 'ready');
  assert.strictEqual(t.find(function (x) { return x.id === 'C'; }).status, 'waiting');
});

check('unmet prerequisite keeps dependent waiting with a visible blocker', function () {
  var t = tasks([{ id: 'A', status: 'in-progress', prerequisites: [] },
                 { id: 'B', status: 'queued', prerequisites: ['A'] }]);
  PCCore.recomputeAll(t);
  var b = t.find(function (x) { return x.id === 'B'; });
  assert.strictEqual(b.status, 'waiting');
  assert.ok(PCCore.blockersFor(t, b).join(' ').indexOf('A') !== -1);
});

check('missing prerequisite record is a visible blocker, not a crash', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  var e = t.find(function (x) { return x.id === 'E'; });
  assert.strictEqual(e.status, 'waiting');
  assert.ok(PCCore.blockersFor(t, e).join(' ').indexOf('missing') !== -1);
});

check('done-but-unaccepted prerequisite does NOT unblock the dependent', function () {
  var t = tasks([
    { id: 'A', status: 'queued', prerequisites: [] },
    { id: 'B', status: 'queued', prerequisites: ['A'] }
  ]);
  var r = PCCore.completeTask(t, 'A', { by: 'tester' });
  assert.strictEqual(r.ok, true);
  var b = t.find(function (x) { return x.id === 'B'; });
  assert.strictEqual(b.status, 'waiting', 'acceptance gate: done != accepted');
  assert.strictEqual(r.unblocked.length, 0);
  var r2 = PCCore.acceptTask(t, 'A', { by: 'Ryan' });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(b.status, 'ready');
  assert.strictEqual(r2.unblocked.length, 1);
});

check('completion cascades: B done+accepted unblocks C', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  PCCore.completeTask(t, 'B', { by: 'tester' });
  PCCore.acceptTask(t, 'B', { by: 'Ryan' });
  assert.strictEqual(t.find(function (x) { return x.id === 'C'; }).status, 'ready');
});

check('cycle prevention: adding a prerequisite that closes a loop is refused', function () {
  var t = tasks(base);
  var r = PCCore.addPrerequisite(t, 'A', 'C'); // A <- B <- C, so A depending on C cycles
  assert.strictEqual(r.ok, false);
  assert.ok(/cycle/.test(r.error));
  var r2 = PCCore.addPrerequisite(t, 'B', 'B');
  assert.strictEqual(r2.ok, false);
});

check('dispatch without explicit authorization is refused', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  var r = PCCore.dispatchTask(t, 'B', {});
  assert.strictEqual(r.ok, false);
  assert.ok(/authorization/.test(r.error));
  assert.strictEqual(t.find(function (x) { return x.id === 'B'; }).status, 'ready');
});

check('dispatch of a waiting task is refused with blockers listed', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  var r = PCCore.dispatchTask(t, 'C', { authorizedBy: 'Ryan' });
  assert.strictEqual(r.ok, false);
  assert.ok(/blocked/.test(r.error));
});

check('dispatch with authorization starts work', function () {
  var t = tasks(base);
  PCCore.recomputeAll(t);
  var r = PCCore.dispatchTask(t, 'B', { authorizedBy: 'Ryan' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(t.find(function (x) { return x.id === 'B'; }).status, 'in-progress');
});

check('idea promotion without approver/scope/owner is refused', function () {
  var t = tasks(base);
  var audit = [];
  assert.strictEqual(PCCore.promoteIdea(t, 'D', { by: 'Ryan' }, audit).ok, false);
  assert.strictEqual(PCCore.promoteIdea(t, 'D', null, audit).ok, false);
  assert.strictEqual(t.find(function (x) { return x.id === 'D'; }).status, 'idea');
  assert.strictEqual(audit.length, 0, 'refused promotion writes no audit entry');
});

check('idea promotion with full approval succeeds and audits', function () {
  var t = tasks(base);
  var audit = [];
  var r = PCCore.promoteIdea(t, 'D', { by: 'Ryan', owner: 'Muse', scope: 'Evaluate only' }, audit);
  assert.strictEqual(r.ok, true);
  var d = t.find(function (x) { return x.id === 'D'; });
  assert.strictEqual(d.status, 'ready', 'no prerequisites, so it is ready-for-review — still not dispatched');
  assert.strictEqual(d.owner, 'Muse');
  assert.strictEqual(d.dispatchAuthorizedBy, null, 'promotion is not dispatch authorization');
  assert.strictEqual(audit.length, 1);
  assert.strictEqual(audit[0].action, 'idea-promoted');
});

check('ideas cannot be completed or dispatched', function () {
  var t = tasks(base);
  assert.strictEqual(PCCore.completeTask(t, 'D', { by: 'x' }).ok, false);
  assert.strictEqual(PCCore.dispatchTask(t, 'D', { authorizedBy: 'Ryan' }).ok, false);
});

check('merge: one-sided change applies cleanly', function () {
  var local = { records: [{ id: 'P1', updatedAt: '2026-11-25T10:00:00Z', v: 1 }], updatedAt: '2026-11-25T10:00:00Z' };
  var incoming = { records: [{ id: 'P1', updatedAt: '2026-11-25T11:00:00Z', v: 2 }], updatedAt: '2026-11-25T11:00:00Z' };
  var baseRec = { records: [{ id: 'P1', updatedAt: '2026-11-25T10:00:00Z', v: 1 }], updatedAt: '2026-11-25T10:00:00Z' };
  var res = PCCore.mergeRecords(local, incoming, baseRec);
  assert.strictEqual(res.conflicts.length, 0);
  assert.strictEqual(res.merged.records[0].v, 2);
});

check('merge: both-sides change is flagged as a conflict, local kept', function () {
  var local = { records: [{ id: 'P1', updatedAt: '2026-11-25T11:00:00Z', v: 'local' }], updatedAt: '2026-11-25T11:00:00Z' };
  var incoming = { records: [{ id: 'P1', updatedAt: '2026-11-25T12:00:00Z', v: 'remote' }], updatedAt: '2026-11-25T12:00:00Z' };
  var baseRec = { records: [{ id: 'P1', updatedAt: '2026-11-25T10:00:00Z', v: 1 }], updatedAt: '2026-11-25T10:00:00Z' };
  var res = PCCore.mergeRecords(local, incoming, baseRec);
  assert.strictEqual(res.conflicts.length, 1);
  assert.strictEqual(res.conflicts[0].id, 'P1');
  assert.strictEqual(res.merged.records[0].v, 'local');
});

check('seed data: Ocean Dynamics (CG-001) is waiting on PCC-001 and is not dispatchable', function () {
  var seed = require('../data/seed.json');
  var all = [];
  seed.projects.forEach(function (p) { (p.tasks || []).forEach(function (t) { all.push(t); }); });
  var cg = all.find(function (t) { return t.id === 'CG-001'; });
  assert.ok(cg, 'CG-001 exists');
  assert.deepStrictEqual(cg.prerequisites, ['PCC-001']);
  PCCore.recomputeAll(all);
  assert.strictEqual(cg.status, 'waiting');
  assert.strictEqual(PCCore.dispatchTask(all, 'CG-001', { authorizedBy: 'Ryan' }).ok, false);
  var nb = seed.projects.find(function (p) { return p.id === 'caribbean-game'; }).notebook
    .find(function (n) { return n.id === 'CG-NB-01'; });
  assert.ok(nb && nb.body.indexOf('simulated wave erosion') !== -1, 'full Ocean Dynamics scope preserved verbatim in notebook');
});

console.log(passed + ' tests passed.');
