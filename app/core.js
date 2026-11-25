/**
 * Project Command Center — core domain logic.
 * Pure functions, no DOM. Shared by the browser app (app.js) and the
 * Node test suite (tests/test-queue.js) via UMD export.
 *
 * Invariants enforced here (never bypassed by the UI):
 *  1. An IDEA is never executable: it has no owner, no scope approval and
 *     cannot be dispatched. Promotion to an authorized task requires an
 *     explicit approval record (approvedBy + scope + owner) and writes an
 *     audit entry. There is no code path from idea -> task without it.
 *  2. A task with unmet prerequisites is WAITING, never READY and never
 *     dispatchable. When all prerequisites are DONE *and accepted*, the
 *     dependent moves to READY-FOR-REVIEW (not straight to development).
 *  3. Development is never auto-dispatched: dispatch requires an explicit
 *     user authorization flag on the task (dispatchAuthorizedBy).
 *  4. Prerequisite graphs must stay acyclic (cycle prevention on add).
 *  5. No progress is invented: status is only ever set from an explicit
 *     event with provenance (who/when/source).
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PCCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var STATUSES = ['idea', 'queued', 'waiting', 'ready', 'in-progress', 'in-review', 'done', 'blocked'];
  // ready = ready-for-review (prereqs complete + accepted, awaiting user go-ahead)

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function nowIso() { return new Date().toISOString(); }

  /** Detect a cycle if taskId were to depend (transitively) on candidateId. */
  function wouldCycle(tasks, taskId, candidateId) {
    var seen = {};
    var stack = [candidateId];
    while (stack.length) {
      var cur = stack.pop();
      if (cur === taskId) return true;
      if (seen[cur]) continue;
      seen[cur] = true;
      var t = tasks.find(function (x) { return x.id === cur; });
      if (t) (t.prerequisites || []).forEach(function (p) { stack.push(p); });
    }
    return false;
  }

  /** Add a prerequisite. Returns {ok} or {ok:false, error}. */
  function addPrerequisite(tasks, taskId, prereqId) {
    var task = tasks.find(function (x) { return x.id === taskId; });
    var pre = tasks.find(function (x) { return x.id === prereqId; });
    if (!task) return { ok: false, error: 'task not found: ' + taskId };
    if (!pre) return { ok: false, error: 'prerequisite not found: ' + prereqId };
    if (taskId === prereqId) return { ok: false, error: 'a task cannot depend on itself' };
    if ((task.prerequisites || []).indexOf(prereqId) !== -1)
      return { ok: false, error: 'prerequisite already listed' };
    if (wouldCycle(tasks, taskId, prereqId))
      return { ok: false, error: 'cycle prevented: ' + prereqId + ' already (transitively) depends on ' + taskId };
    task.prerequisites = (task.prerequisites || []).concat([prereqId]);
    recomputeWaiting(tasks, task);
    return { ok: true };
  }

  /** A prerequisite counts as satisfied only when DONE and accepted. */
  function prereqSatisfied(tasks, prereqId) {
    var p = tasks.find(function (x) { return x.id === prereqId; });
    if (!p) return { satisfied: false, reason: 'missing prerequisite record: ' + prereqId };
    if (p.status !== 'done') return { satisfied: false, reason: 'prerequisite ' + prereqId + ' is ' + p.status };
    if (!p.accepted) return { satisfied: false, reason: 'prerequisite ' + prereqId + ' is done but not yet accepted' };
    return { satisfied: true };
  }

  /** Visible blockers for a task: every unmet prerequisite, in words. */
  function blockersFor(tasks, task) {
    return (task.prerequisites || []).map(function (pid) {
      var r = prereqSatisfied(tasks, pid);
      return r.satisfied ? null : r.reason;
    }).filter(Boolean);
  }

  /**
   * Recompute waiting/ready for one task from its prerequisites.
   * - queued/waiting with unmet prereqs -> waiting
   * - queued/waiting with all prereqs satisfied -> ready (ready-for-review)
   * - in-progress / in-review / done / blocked / idea are never auto-moved.
   */
  function recomputeWaiting(tasks, task) {
    if (['queued', 'waiting', 'ready'].indexOf(task.status) === -1) return task;
    var blockers = blockersFor(tasks, task);
    if (blockers.length) {
      if (task.status !== 'waiting') task.status = 'waiting';
    } else {
      if (task.status !== 'ready') task.status = 'ready';
    }
    return task;
  }

  function recomputeAll(tasks) {
    tasks.forEach(function (t) { recomputeWaiting(tasks, t); });
    return tasks;
  }

  /** Mark a task done (explicit event, with provenance). Returns blockers that clear. */
  function completeTask(tasks, taskId, event) {
    var task = tasks.find(function (x) { return x.id === taskId; });
    if (!task) return { ok: false, error: 'task not found: ' + taskId };
    if (task.status === 'idea') return { ok: false, error: 'ideas cannot be completed; promote first' };
    task.status = 'done';
    task.completedAt = (event && event.at) || nowIso();
    task.completedBy = (event && event.by) || 'unknown';
    task.accepted = false; // done != accepted: acceptance is a separate gate
    var unblocked = [];
    tasks.forEach(function (t) {
      if ((t.prerequisites || []).indexOf(taskId) !== -1) {
        var before = t.status;
        recomputeWaiting(tasks, t);
        if (before !== t.status && t.status === 'ready') unblocked.push({ id: t.id, from: before, to: t.status });
      }
    });
    return { ok: true, unblocked: unblocked };
  }

  /** Acceptance gate: a done task is accepted only by explicit approval. */
  function acceptTask(tasks, taskId, event) {
    var task = tasks.find(function (x) { return x.id === taskId; });
    if (!task) return { ok: false, error: 'task not found: ' + taskId };
    if (task.status !== 'done') return { ok: false, error: 'only a done task can be accepted (current: ' + task.status + ')' };
    task.accepted = true;
    task.acceptedAt = (event && event.at) || nowIso();
    task.acceptedBy = (event && event.by) || 'unknown';
    var unblocked = [];
    tasks.forEach(function (t) {
      if ((t.prerequisites || []).indexOf(taskId) !== -1) {
        var before = t.status;
        recomputeWaiting(tasks, t);
        if (before !== t.status && t.status === 'ready') unblocked.push({ id: t.id, from: before, to: t.status });
      }
    });
    return { ok: true, unblocked: unblocked };
  }

  /**
   * Promote an idea to an authorized task. REQUIRES explicit approval.
   * approval = { by, scope, owner }. Missing any field -> refused.
   * Returns {ok} or {ok:false, error}. Writes the audit entry into `audit`
   * (array passed in) so the promotion is traceable.
   */
  function promoteIdea(tasks, ideaId, approval, audit) {
    var idea = tasks.find(function (x) { return x.id === ideaId; });
    if (!idea) return { ok: false, error: 'idea not found: ' + ideaId };
    if (idea.status !== 'idea') return { ok: false, error: 'only ideas are promoted (current: ' + idea.status + ')' };
    if (!approval || !approval.by || !approval.scope || !approval.owner)
      return { ok: false, error: 'promotion refused: explicit approval with approver, scope and owner is required' };
    idea.status = 'queued';
    idea.owner = approval.owner;
    idea.scope = approval.scope;
    idea.approvedBy = approval.by;
    idea.approvedAt = approval.at || nowIso();
    idea.dispatchAuthorizedBy = null; // promotion != dispatch authorization
    if (audit) audit.push({
      at: idea.approvedAt, actor: approval.by, action: 'idea-promoted',
      itemId: idea.id, detail: 'Promoted to authorized task. Scope: ' + approval.scope + '. Owner: ' + approval.owner + '.'
    });
    recomputeWaiting(tasks, idea);
    return { ok: true };
  }

  /** Dispatch (start development) — requires explicit user authorization. */
  function dispatchTask(tasks, taskId, event) {
    var task = tasks.find(function (x) { return x.id === taskId; });
    if (!task) return { ok: false, error: 'task not found: ' + taskId };
    if (task.status === 'idea') return { ok: false, error: 'ideas are not dispatchable' };
    if (task.status === 'waiting') {
      var b = blockersFor(tasks, task);
      return { ok: false, error: 'blocked by unmet prerequisites: ' + b.join('; ') };
    }
    if (task.status === 'queued' || task.status === 'ready') {
      if (!event || !event.authorizedBy)
        return { ok: false, error: 'dispatch refused: explicit user authorization is required' };
      task.status = 'in-progress';
      task.dispatchAuthorizedBy = event.authorizedBy;
      task.startedAt = event.at || nowIso();
      return { ok: true };
    }
    return { ok: false, error: 'cannot dispatch from status ' + task.status };
  }

  /** Merge two record versions. Returns {merged, conflicts[]}.
   *  Last-write-wins per record (by updatedAt), but any record changed on
   *  BOTH sides since the common base is reported as a conflict for human
   *  review instead of being silently overwritten. */
  function mergeRecords(local, incoming, base) {
    var conflicts = [];
    var merged = clone(local);
    var index = {};
    merged.records.forEach(function (r, i) { index[r.id] = i; });
    (incoming.records || []).forEach(function (rec) {
      var baseRec = (base.records || []).find(function (r) { return r.id === rec.id; });
      var localRec = merged.records[index[rec.id]];
      if (!localRec) { merged.records.push(clone(rec)); return; }
      var baseAt = baseRec ? baseRec.updatedAt : null;
      var localChanged = baseAt && localRec.updatedAt !== baseAt;
      var remoteChanged = baseAt && rec.updatedAt !== baseAt;
      if (localChanged && remoteChanged && localRec.updatedAt !== rec.updatedAt) {
        conflicts.push({ id: rec.id, localUpdatedAt: localRec.updatedAt, remoteUpdatedAt: rec.updatedAt });
        return; // keep local; human resolves
      }
      if (rec.updatedAt > localRec.updatedAt) merged.records[index[rec.id]] = clone(rec);
    });
    merged.updatedAt = nowIso();
    return { merged: merged, conflicts: conflicts };
  }

  return {
    STATUSES: STATUSES, clone: clone, nowIso: nowIso,
    wouldCycle: wouldCycle, addPrerequisite: addPrerequisite,
    prereqSatisfied: prereqSatisfied, blockersFor: blockersFor,
    recomputeWaiting: recomputeWaiting, recomputeAll: recomputeAll,
    completeTask: completeTask, acceptTask: acceptTask,
    promoteIdea: promoteIdea, dispatchTask: dispatchTask,
    mergeRecords: mergeRecords
  };
});
