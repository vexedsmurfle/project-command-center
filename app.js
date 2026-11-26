/* Project Command Center — browser app.
 * Storage: localStorage key 'pcc-store-v1' is a CACHE. Durable records are
 * the exported JSON (upload to Drive Task Exchange) and, once Firebase is
 * configured, the owner-only Firestore document `pcc/main` (see
 * docs/FIREBASE-SETUP.md). Export/Import = manual sync.
 * Auth: Google sign-in via Firebase Auth when `firebase-config.js` is
 * present (owner account only — enforced server-side by firestore.rules).
 * Without it, a local passcode (SHA-256) set on first use. The passcode
 * is a device lock, not server auth. No project data is ever fetched or
 * rendered before the access gate passes (see auth.js). No data leaves
 * the device except via an explicit Export you upload yourself, or a
 * Firestore write after the owner signs in.
 */
(function () {
  'use strict';
  var STORE_KEY = 'pcc-store-v1';
  var PASS_KEY = 'pcc-passcode-hash-v1';
  var state = null;      // full store object
  var baseSnapshot = null; // last imported/exported snapshot, for conflict detection
  var currentProject = null;
  var currentTab = 'overview';
  var cloudUser = null; // signed-in Firebase user, or null
  var $ = function (id) { return document.getElementById(id); };

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 3500);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function save() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    cloudSave();
  }
  function setSyncStatus(msg) {
    var el = $('sync-status');
    if (el) el.textContent = msg;
  }
  /* Write the record to Firestore when the owner is signed in.
   * Silent no-op in local-only mode. Failures are shown, never hidden. */
  function cloudSave() {
    if (!window.PCFirebase || !PCFirebase.isConfigured() || !PCFirebase.currentUser()) return;
    PCFirebase.saveState(state).then(function (ok) {
      if (ok) setSyncStatus('Synced to Firestore · signed in as ' + PCFirebase.currentUser().email);
    }).catch(function (e) {
      setSyncStatus('Firestore save failed: ' + e.message + ' — local copy + Drive export still safe.');
    });
  }
  /* After sign-in: pull the Firestore record if it is newer; push the
   * local cache up on first sign-in (migration); otherwise stay local. */
  function syncFromCloud() {
    if (!window.PCFirebase || !PCFirebase.isConfigured() || !PCFirebase.currentUser()) return;
    PCFirebase.loadState().then(function (cloud) {
      if (!cloud) {
        if (state.projects.length) {
          return PCFirebase.saveState(state).then(function () {
            setSyncStatus('Local records migrated to Firestore (first sign-in).');
            audit('You (browser)', 'cloud-migrated', '', 'Local cache uploaded to Firestore on first sign-in.');
            save();
          });
        }
        setSyncStatus('Signed in — Firestore is empty. Import a JSON export to load projects.');
        return;
      }
      if (!state.updatedAt || (cloud.updatedAt && cloud.updatedAt > state.updatedAt)) {
        state = cloud;
        baseSnapshot = JSON.parse(JSON.stringify(state));
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        setSyncStatus('Loaded newer record from Firestore.');
        renderCards(); if (currentProject) renderDetail();
      } else if (cloud.updatedAt && cloud.updatedAt < state.updatedAt) {
        cloudSave();
        setSyncStatus('Local record is newer — pushed to Firestore.');
      } else {
        setSyncStatus('Firestore in sync · signed in as ' + PCFirebase.currentUser().email);
      }
    }).catch(function (e) {
      setSyncStatus('Firestore load failed: ' + e.message + ' — using the local cache.');
    });
  }
  function audit(actor, action, itemId, detail) {
    state.audit.push({ at: new Date().toISOString(), actor: actor, action: action, itemId: itemId || '', detail: detail || '' });
  }
  function logActivity(project, action, detail) {
    project.activity.unshift({ at: new Date().toISOString(), actor: 'You (browser)', action: action, detail: detail });
  }
  function allTasks() {
    // Includes ideas: promotion and prerequisite resolution need them.
    // PCCore guards keep ideas non-executable (recompute skips 'idea',
    // complete/dispatch refuse ideas).
    var out = [];
    state.projects.forEach(function (p) {
      (p.tasks || []).forEach(function (t) { out.push(t); });
      (p.ideas || []).forEach(function (i) { out.push(i); });
    });
    return out;
  }
  function findTask(id) {
    var found = null;
    state.projects.forEach(function (p) {
      (p.tasks || []).forEach(function (t) { if (t.id === id) found = { task: t, project: p }; });
      (p.ideas || []).forEach(function (i) { if (i.id === id) found = { task: i, project: p, isIdea: true }; });
    });
    return found;
  }

  /* ---------- auth ---------- */
  async function sha256(text) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function unlock() {
    var input = $('passcode').value;
    if (!input) { $('auth-msg').textContent = 'Enter a passcode.'; return; }
    var stored = localStorage.getItem(PASS_KEY);
    var hash = await sha256(input);
    if (!stored) {
      localStorage.setItem(PASS_KEY, hash);
      $('auth-msg').textContent = '';
      enterApp(true);
      toast('Passcode set on this device. Keep it safe — there is no reset except clearing browser data.');
      return;
    }
    if (hash === stored) { $('auth-msg').textContent = ''; enterApp(false); }
    else $('auth-msg').textContent = 'Wrong passcode. (No reset: clearing this browser\'s site data removes the lock and the local cache — the Drive JSON remains the durable copy.)';
  }
  function enterApp(firstTime) {
    $('auth-gate').hidden = true;
    $('app').hidden = false;
    if (cloudUser) {
      $('signout-btn').hidden = false;
      setSyncStatus('Signed in as ' + cloudUser.email + ' — checking Firestore…');
      syncFromCloud();
    } else if (window.PCFirebase && PCFirebase.isConfigured()) {
      setSyncStatus('Signed in — checking Firestore…');
      syncFromCloud();
    } else {
      setSyncStatus('Local-only mode — Firebase not configured. See docs/FIREBASE-SETUP.md.');
    }
    renderCards();
  }

  /* ---------- data load ---------- */
  function loadState() {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { state = JSON.parse(raw); } catch (e) { state = null; } }
    if (!state) {
      // No bundled seed any more: the public shell ships no project
      // records. First run starts empty; data arrives after auth from
      // Firestore, or from a Drive JSON import. See docs/FIREBASE-SETUP.md.
      state = { version: 1, updatedAt: new Date().toISOString(), projects: [], audit: [] };
    }
    baseSnapshot = JSON.parse(JSON.stringify(state));
  }

  /* ---------- rendering ---------- */
  function projectMatches(p, q, statusFilter) {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!q) return true;
    q = q.toLowerCase();
    var hay = [p.name, p.summary, p.nextSteps, p.status].join(' ');
    (p.tasks || []).forEach(function (t) { hay += ' ' + t.title + ' ' + (t.notes || ''); });
    (p.ideas || []).forEach(function (i) { hay += ' ' + i.title; });
    (p.notebook || []).forEach(function (n) { hay += ' ' + n.title + ' ' + n.body; });
    return hay.toLowerCase().indexOf(q) !== -1;
  }
  function statusBadge(s) { return '<span class="badge ' + esc(s) + '">' + esc(s) + '</span>'; }
  function renderCards() {
    if (!state) return;
    var q = $('search').value || '';
    var f = $('status-filter').value || '';
    var cards = $('cards');
    cards.innerHTML = '';
    var shown = 0;
    state.projects.forEach(function (p) {
      if (!projectMatches(p, q, f)) return;
      shown++;
      var open = (p.tasks || []).filter(function (t) { return ['queued', 'waiting', 'ready', 'in-progress', 'in-review'].indexOf(t.status) !== -1; }).length;
      var blocked = (p.tasks || []).filter(function (t) { return t.status === 'waiting' || t.status === 'blocked'; }).length;
      var btn = document.createElement('button');
      btn.className = 'card';
      btn.innerHTML = '<h3>' + esc(p.name) + '</h3>' +
        statusBadge(p.status) +
        '<p>' + esc(p.summary) + '</p>' +
        '<p class="meta">Last update: ' + esc(p.lastUpdate || 'unknown') + ' · Open tasks: ' + open + ' · Blocked/waiting: ' + blocked + ' · Ideas: ' + (p.ideas || []).length + '</p>' +
        '<p><strong>Next:</strong> ' + esc(p.nextSteps || '—') + '</p>' +
        ((p.blockers || []).length ? '<p class="blocker"><strong>Blocker:</strong> ' + esc(p.blockers[0]) + '</p>' : '');
      btn.addEventListener('click', function () { openProject(p.id); });
      cards.appendChild(btn);
    });
    if (!shown) {
      if (!state.projects.length) {
        cards.innerHTML = '<p class="muted"><strong>No projects loaded.</strong> ' +
          'If you just signed in, use <strong>Import JSON</strong> above to load the record exported ' +
          'from Drive, or wait for the Firestore sync. Project records are never shipped with ' +
          'this page — they load only after authentication. See <code>docs/FIREBASE-SETUP.md</code>.</p>';
      } else {
        cards.innerHTML = '<p class="muted">No projects match. Clear the search or filter.</p>';
      }
    }
  }
  function openProject(id) {
    currentProject = state.projects.find(function (p) { return p.id === id; });
    if (!currentProject) return;
    $('cards').hidden = true;
    $('detail').hidden = false;
    $('detail-name').textContent = currentProject.name;
    $('detail-summary').textContent = currentProject.summary;
    renderDetail();
    window.scrollTo(0, 0);
  }
  function closeProject() {
    currentProject = null;
    $('cards').hidden = false;
    $('detail').hidden = true;
    renderCards();
  }
  function renderDetail() {
    var p = currentProject; if (!p) return;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === currentTab);
    });
    ['overview', 'tasks', 'ideas', 'notebook', 'activity'].forEach(function (t) {
      $('tab-' + t).hidden = t !== currentTab;
    });
    if (currentTab === 'overview') renderOverview(p);
    if (currentTab === 'tasks') renderTasks(p);
    if (currentTab === 'ideas') renderIdeas(p);
    if (currentTab === 'notebook') renderNotebook(p);
    if (currentTab === 'activity') renderActivity(p);
  }
  function renderOverview(p) {
    var el = $('tab-overview');
    var links = (p.links || []).map(function (l) {
      return '<li>' + esc(l.label) + ': ' + esc(l.url) + '</li>';
    }).join('');
    el.innerHTML =
      '<div class="kv"><dt>Status</dt><dd>' + statusBadge(p.status) + '</dd>' +
      '<dt>Last update</dt><dd>' + esc(p.lastUpdate || 'unknown') + '</dd>' +
      '<dt>Provenance</dt><dd>' + esc(p.provenance || 'Not recorded — treat as unverified.') + '</dd></div>' +
      '<h3>Next steps</h3><p>' + esc(p.nextSteps || '—') + '</p>' +
      '<h3>Blockers</h3>' + ((p.blockers || []).length ? '<ul>' + p.blockers.map(function (b) { return '<li class="blocker">' + esc(b) + '</li>'; }).join('') + '</ul>' : '<p>None recorded.</p>') +
      '<h3>Links</h3>' + (links ? '<ul>' + links + '</ul>' : '<p>None recorded.</p>') +
      '<h3>Active assignments</h3>' +
      ((p.tasks || []).filter(function (t) { return t.status === 'in-progress'; }).map(function (t) {
        return '<p><strong>' + esc(t.id) + '</strong> — ' + esc(t.title) + ' (owner: ' + esc(t.owner || 'unassigned') + ')</p>';
      }).join('') || '<p>None in progress.</p>');
  }
  function taskHtml(p, t) {
    var blockers = PCCore.blockersFor(allTasks(), t);
    var prereqList = (t.prerequisites || []).map(function (pid) {
      var f = findTask(pid);
      var label = f ? pid + ' — ' + f.task.title + ' (' + f.task.status + (f.task.status === 'done' ? (f.task.accepted ? ', accepted' : ', awaiting acceptance') : '') + ')' : pid + ' (record missing)';
      return '<li>' + esc(label) + '</li>';
    }).join('');
    return '<div class="task"><h4>' + esc(t.id) + ' — ' + esc(t.title) + '</h4>' +
      '<p>' + statusBadge(t.status) + ' ' + (t.accepted ? '<span class="badge done">accepted</span>' : '') + '</p>' +
      '<p>' + esc(t.notes || '') + '</p>' +
      '<p class="meta">Owner: ' + esc(t.owner || 'unassigned') + ' · Updated: ' + esc(t.updatedAt || 'unknown') + ' · Provenance: ' + esc(t.provenance || 'not recorded') + '</p>' +
      (prereqList ? '<p><strong>Prerequisites:</strong></p><ul>' + prereqList + '</ul>' : '') +
      (blockers.length ? '<p class="blocker"><strong>Blocked by:</strong> ' + esc(blockers.join('; ')) + '</p>' : '') +
      '<div class="actions">' +
      (t.status !== 'done' && t.status !== 'idea' ? '<button class="btn" data-act="complete" data-id="' + esc(t.id) + '">Mark done</button>' : '') +
      (t.status === 'done' && !t.accepted ? '<button class="btn" data-act="accept" data-id="' + esc(t.id) + '">Accept (approval gate)</button>' : '') +
      ((t.status === 'queued' || t.status === 'ready') ? '<button class="btn primary" data-act="dispatch" data-id="' + esc(t.id) + '">Authorize &amp; start…</button>' : '') +
      '</div></div>';
  }
  function renderTasks(p) {
    var el = $('tab-tasks');
    var tasks = p.tasks || [];
    el.innerHTML = tasks.length ? '' : '<p class="muted">No tasks yet.</p>';
    tasks.forEach(function (t) {
      var div = document.createElement('div');
      div.innerHTML = taskHtml(p, t);
      el.appendChild(div.firstChild);
    });
    el.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { taskAction(b.dataset.act, b.dataset.id); });
    });
  }
  function renderIdeas(p) {
    var el = $('tab-ideas');
    var ideas = p.ideas || [];
    el.innerHTML = '<p class="muted"><strong>Ideas are not assignments.</strong> Nothing here can be dispatched, completed or worked until it is deliberately promoted with an approver, a scope and an owner — and that promotion is written to the audit log.</p>';
    ideas.forEach(function (i) {
      var div = document.createElement('div');
      div.className = 'idea';
      div.innerHTML = '<h4>' + esc(i.id) + ' — ' + esc(i.title) + '</h4>' + statusBadge('idea') +
        '<p>' + esc(i.notes || '') + '</p>' +
        '<p class="meta">Provenance: ' + esc(i.provenance || 'not recorded') + ' · Updated: ' + esc(i.updatedAt || 'unknown') + '</p>' +
        '<div class="actions"><button class="btn primary" data-promote="' + esc(i.id) + '">Promote to authorized task…</button></div>';
      el.appendChild(div);
    });
    if (!ideas.length) el.innerHTML += '<p class="muted">No ideas recorded for this project.</p>';
    el.querySelectorAll('button[data-promote]').forEach(function (b) {
      b.addEventListener('click', function () { openPromote(b.dataset.promote); });
    });
  }
  function renderNotebook(p) {
    var el = $('tab-notebook');
    el.innerHTML = '';
    (p.notebook || []).forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'note';
      div.innerHTML = '<h4>' + esc(n.title) + '</h4><p>' + esc(n.body) + '</p>' +
        '<p class="meta">By ' + esc(n.author || 'unknown') + ' · ' + esc(n.updatedAt || 'unknown') + '</p>' +
        '<div class="actions"><button class="btn" data-edit-note="' + esc(n.id) + '">Edit</button></div>';
      el.appendChild(div);
    });
    var add = document.createElement('div');
    add.innerHTML = '<h3>Add a note</h3>' +
      '<label>Title <input id="new-note-title" placeholder="Note title"></label><br>' +
      '<label>Body <textarea id="new-note-body" rows="4" placeholder="Decision, context, link…"></textarea></label><br>' +
      '<button class="btn primary" id="add-note-btn">Save note</button>';
    el.appendChild(add);
    el.querySelectorAll('button[data-edit-note]').forEach(function (b) {
      b.addEventListener('click', function () { editNote(p, b.dataset.editNote); });
    });
    $('add-note-btn').addEventListener('click', function () {
      var title = $('new-note-title').value.trim();
      var body = $('new-note-body').value.trim();
      if (!title || !body) { toast('Title and body are both required.'); return; }
      var id = p.id.toUpperCase().replace(/[^A-Z0-9]/g, '') + '-NB-' + String((p.notebook || []).length + 1).padStart(2, '0');
      p.notebook = p.notebook || [];
      p.notebook.push({ id: id, title: title, body: body, author: 'You (browser)', updatedAt: new Date().toISOString() });
      p.lastUpdate = new Date().toISOString().slice(0, 10);
      logActivity(p, 'note-added', 'Note "' + title + '" (' + id + ') added.');
      audit('You (browser)', 'note-added', id, 'Note added to ' + p.name + '.');
      save(); renderDetail(); toast('Note saved (' + id + '). Export JSON to make it durable.');
    });
  }
  function editNote(p, noteId) {
    var n = (p.notebook || []).find(function (x) { return x.id === noteId; });
    if (!n) return;
    var body = prompt('Edit note body:', n.body);
    if (body == null) return;
    n.body = body;
    n.updatedAt = new Date().toISOString();
    logActivity(p, 'note-edited', 'Note "' + n.title + '" (' + n.id + ') edited.');
    audit('You (browser)', 'note-edited', n.id, 'Note edited in ' + p.name + '.');
    save(); renderDetail(); toast('Note updated. Export JSON to make it durable.');
  }
  function renderActivity(p) {
    var el = $('tab-activity');
    var items = (p.activity || []).slice().reverse();
    el.innerHTML = items.length ? '' : '<p class="muted">No activity recorded.</p>';
    items.forEach(function (a) {
      var div = document.createElement('div');
      div.className = 'activity-item';
      div.innerHTML = '<p><strong>' + esc(a.action) + '</strong> — ' + esc(a.detail || '') + '</p><p class="meta">' + esc(a.at || '') + ' · ' + esc(a.actor || 'unknown') + '</p>';
      el.appendChild(div);
    });
    el.innerHTML += '<h3>Audit log (all projects)</h3>' +
      (state.audit.slice().reverse().slice(0, 50).map(function (a) {
        return '<p class="meta">' + esc(a.at) + ' · ' + esc(a.actor) + ' · ' + esc(a.action) + ' · ' + esc(a.itemId) + ' — ' + esc(a.detail) + '</p>';
      }).join('') || '<p class="muted">No audit entries yet.</p>');
  }

  /* ---------- actions ---------- */
  function taskAction(act, id) {
    var f = findTask(id); if (!f) return;
    var t = f.task, p = f.project;
    if (act === 'complete') {
      var r = PCCore.completeTask(allTasks(), id, { by: 'You (browser)' });
      if (!r.ok) { toast(r.error); return; }
      logActivity(p, 'task-done', t.id + ' "' + t.title + '" marked done (acceptance still pending).');
      audit('You (browser)', 'task-done', id, 'Marked done; acceptance gate still open.');
      (r.unblocked || []).forEach(function (u) {
        var uf = findTask(u.id);
        if (uf) logActivity(uf.project, 'queue-update', u.id + ' moved ' + u.from + ' → ' + u.to + ' (prerequisite ' + id + ' done).');
      });
      save(); renderDetail(); renderCards();
      toast(t.id + ' marked done. Acceptance is a separate step.');
    }
    if (act === 'accept') {
      var by = prompt('Accept ' + t.id + ' as complete? Enter your name to record acceptance:');
      if (!by) return;
      var r2 = PCCore.acceptTask(allTasks(), id, { by: by });
      if (!r2.ok) { toast(r2.error); return; }
      logActivity(p, 'task-accepted', t.id + ' accepted by ' + by + '.');
      audit(by, 'task-accepted', id, 'Completion accepted.');
      (r2.unblocked || []).forEach(function (u) {
        var uf = findTask(u.id);
        if (uf) logActivity(uf.project, 'queue-update', u.id + ' moved ' + u.from + ' → ' + u.to + ' — now ready-for-review.');
      });
      save(); renderDetail(); renderCards();
      toast(t.id + ' accepted. Dependents (if any) moved to ready-for-review.');
    }
    if (act === 'dispatch') {
      $('dispatch-task-title').textContent = t.id + ' — ' + t.title;
      var dlg = $('dispatch-dialog');
      dlg.showModal();
      $('dispatch-form').onsubmit = function (e) {
        var by = $('dispatch-by').value.trim();
        if (!by) return; // required field blocks submit
        var r3 = PCCore.dispatchTask(allTasks(), id, { authorizedBy: by });
        if (!r3.ok) { toast(r3.error); return; }
        logActivity(p, 'task-dispatched', t.id + ' started — authorized by ' + by + '.');
        audit(by, 'task-dispatched', id, 'Development authorized by ' + by + '.');
        save(); renderDetail(); renderCards();
        toast(t.id + ' started (authorized by ' + by + ').');
      };
    }
  }
  var promoteTarget = null;
  function openPromote(ideaId) {
    var f = findTask(ideaId); if (!f) return;
    promoteTarget = f;
    $('promote-idea-title').textContent = f.task.id + ' — ' + f.task.title;
    $('promote-error').textContent = '';
    $('promote-dialog').showModal();
  }

  /* ---------- export / import (the Drive sync) ---------- */
  function exportJson() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'project-command-center-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    baseSnapshot = JSON.parse(JSON.stringify(state));
    toast('Exported. Upload the JSON to the Drive Task Exchange folder to make it durable.');
  }
  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var incoming = JSON.parse(reader.result);
        if (!incoming.projects) throw new Error('not a Project Command Center record (no projects array)');
        var res = PCCore.mergeRecords(
          { records: state.projects, updatedAt: state.updatedAt },
          { records: incoming.projects, updatedAt: incoming.updatedAt },
          { records: (baseSnapshot && baseSnapshot.projects) || [], updatedAt: baseSnapshot && baseSnapshot.updatedAt }
        );
        state.projects = res.merged.records;
        state.updatedAt = res.merged.updatedAt;
        PCCore.recomputeAll(allTasks());
        save();
        if (res.conflicts.length) {
          var banner = $('conflict-banner');
          banner.hidden = false;
          banner.innerHTML = '<strong>Sync conflict — human review needed.</strong> ' + res.conflicts.length +
            ' record(s) changed on both sides since the last sync: ' + res.conflicts.map(function (c) { return esc(c.id); }).join(', ') +
            '. Your local copy was kept for those records. Resolve by editing the record, then re-export.';
          toast('Import finished with conflicts — see the banner.');
        } else {
          $('conflict-banner').hidden = true;
          toast('Import complete — no conflicts.');
        }
        baseSnapshot = JSON.parse(JSON.stringify(state));
        renderCards(); if (currentProject) renderDetail();
        cloudSave();
      } catch (e) { toast('Import failed: ' + e.message); }
    };
    reader.readAsText(file);
  }

  /* ---------- wire up ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    /* Access gate: Firebase Google sign-in when configured, otherwise
     * the local passcode. The gate state comes from auth.js; no project
     * data is rendered or fetched before it passes. */
    if (window.PCFirebase) {
      PCFirebase.init().then(function (configured) {
        if (configured) {
          $('passcode-block').hidden = true;
          $('google-block').hidden = false;
          $('firebase-status').textContent = 'Firebase configured — sign in with Google (owner account only).';
        } else {
          $('firebase-status').textContent = 'Firebase not configured — local-only mode. See docs/FIREBASE-SETUP.md to enable Google sign-in + Firestore sync.';
        }
      });
    }
    document.addEventListener('pcc-auth-changed', function (e) {
      cloudUser = e.detail && e.detail.user ? e.detail.user : null;
    });
    $('google-signin-btn').addEventListener('click', function () {
      $('auth-msg').textContent = '';
      PCFirebase.signInWithGoogle().then(function (user) {
        cloudUser = user;
        enterApp(false);
        toast('Signed in as ' + user.email + '.');
      }).catch(function (e) {
        $('auth-msg').textContent = e.message;
      });
    });
    $('unlock-btn').addEventListener('click', unlock);
    $('passcode').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });
    $('lock-btn').addEventListener('click', function () { location.reload(); });
    $('signout-btn').addEventListener('click', function () {
      if (window.PCFirebase && PCFirebase.isConfigured()) {
        PCFirebase.signOut().then(function () { location.reload(); });
      } else { location.reload(); }
    });
    $('search').addEventListener('input', renderCards);
    $('status-filter').addEventListener('change', renderCards);
    $('export-btn').addEventListener('click', exportJson);
    $('import-file').addEventListener('change', function (e) { if (e.target.files[0]) importJson(e.target.files[0]); });
    $('back-btn').addEventListener('click', closeProject);
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { currentTab = b.dataset.tab; renderDetail(); });
    });
    $('promote-form').addEventListener('submit', function (e) {
      if (e.submitter && e.submitter.value !== 'promote') return;
      e.preventDefault();
      if (!promoteTarget) return;
      var approval = {
        by: $('promote-by').value.trim(),
        owner: $('promote-owner').value.trim(),
        scope: $('promote-scope').value.trim()
      };
      var res = PCCore.promoteIdea(allTasks(), promoteTarget.task.id, approval, state.audit);
      if (!res.ok) { $('promote-error').textContent = res.error; return; }
      var p = promoteTarget.project;
      p.ideas = (p.ideas || []).filter(function (i) { return i.id !== promoteTarget.task.id; });
      p.tasks = p.tasks || [];
      p.tasks.push(promoteTarget.task);
      logActivity(p, 'idea-promoted', promoteTarget.task.id + ' promoted to authorized task by ' + approval.by + ' (owner: ' + approval.owner + ').');
      save();
      $('promote-dialog').close();
      renderDetail(); renderCards();
      toast('Promoted: ' + promoteTarget.task.id + ' is now a queued task. It still needs explicit dispatch authorization to start.');
      promoteTarget = null;
    });
    renderCards();
  });
})();
