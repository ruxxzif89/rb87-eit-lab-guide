/* Lab Inventory page: an editable list of what the lab already owns, with a 3D picture of each item.
   Edits live in this browser (localStorage). With the group password they can also be saved to, and loaded from, the shared private database
   (the same Google Apps Script as the costed BOM). */
(function () {
  'use strict';
  var SEED = window.LAB_INVENTORY || { version: 1, items: [] };
  var LS = 'rb87-inventory-v1', ENDPOINT = 'https://script.google.com/macros/s/AKfycbzf7xklNDJ5bgLxpbI09A7oD6qLGath35qEceIK33m8HxycpijV6eH2y5VMXlvdEqcD2g/exec';
  var FIELDS = ['id', 'name', 'part', 'brand', 'qty', 'specs', 'link', 'loc', 'owner', 'role', 'status', 'bom', 'model', 'notes'];
  var STATUS = { use: ['Can use', 'src'], check: ['Check first', 'est'], no: ['Not suitable', 'gap'] };
  var $ = function (id) { return document.getElementById(id); };
  var items = [], PW = '', filterText = '', filterStatus = 'all', editing = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function host(u) { var m = /^https?:\/\/(?:www\.)?([^\/]+)/i.exec(u); return m ? m[1] : u; }

  /* ---- storage ---- */
  function load() {
    var seed = clone(SEED.items);
    try {
      var j = JSON.parse(localStorage.getItem(LS) || 'null');
      if (j && Array.isArray(j.items)) {
        var have = {}; j.items.forEach(function (i) { have[i.id] = 1; });
        if (j.v !== SEED.version) seed.forEach(function (s) { if (!have[s.id]) j.items.push(s); });   // new default items appear, edits are kept
        return j.items;
      }
    } catch (e) { }
    return seed;
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ v: SEED.version, items: items })); } catch (e) { } }
  function nextId() { var n = 1, ids = {}; items.forEach(function (i) { ids[i.id] = 1; }); while (ids['U' + n]) n++; return 'U' + n; }
  function clean(it) {
    var o = {}; FIELDS.forEach(function (k) { o[k] = String(it[k] == null ? '' : it[k]).slice(0, k === 'specs' ? 2000 : 500); });
    if (!STATUS[o.status]) o.status = '';
    o.link = safeUrl(o.link); o.mp = it.mp && typeof it.mp === 'object' ? it.mp : {};
    return o;
  }

  /* ---- table ---- */
  function matches(it) {
    if (filterStatus !== 'all' && it.status !== filterStatus) return false;
    if (!filterText) return true;
    return (it.name + ' ' + it.part + ' ' + it.brand + ' ' + it.specs + ' ' + it.role + ' ' + it.bom + ' ' + it.loc + ' ' + it.owner + ' ' + it.notes).toLowerCase().indexOf(filterText) >= 0;
  }
  function rowHtml(it) {
    var st = STATUS[it.status], link = safeUrl(it.link);
    return '<tr data-id="' + esc(it.id) + '"><td>' + esc(it.id) + '</td>' +
      '<td class="look"><span class="p3d" data-p3d="' + esc(it.model || 'generic') + '" data-p3dp=\'' + esc(JSON.stringify(it.mp || {})) + '\' data-title="' + esc(it.name) + '" data-sub="' + esc(it.part || it.id) + '"></span></td>' +
      '<td><b>' + esc(it.name) + '</b>' + (it.notes ? '<br><span class="muted">' + esc(it.notes) + '</span>' : '') + '</td>' +
      '<td>' + esc(it.part) + (it.brand ? '<br><span class="muted">' + esc(it.brand) + '</span>' : '') + '</td>' +
      '<td class="num">' + (it.qty ? esc(it.qty) : '<span class="muted" title="Quantity not recorded">?</span>') + '</td>' +
      '<td class="specs">' + esc(it.specs) + '</td>' +
      '<td>' + (st ? '<span class="tag ' + st[1] + '">' + st[0] + '</span><br>' : '') + esc(it.role) + (it.bom ? '<br><span class="pn">BOM: ' + esc(it.bom) + '</span>' : '') + '</td>' +
      '<td>' + (it.loc ? esc(it.loc) : '<span class="muted">—</span>') + (it.owner ? '<br><span class="muted">' + esc(it.owner) + '</span>' : '') + '</td>' +
      '<td>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(host(link)) + ' ↗</a>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="acts"><button type="button" class="btn invEdit" data-id="' + esc(it.id) + '">Edit</button> <button type="button" class="btn danger invDel" data-id="' + esc(it.id) + '">Delete</button></td></tr>';
  }
  function paint() {
    var vis = items.filter(matches);
    $('invBody').innerHTML = vis.map(rowHtml).join('') || '<tr><td colspan="10" class="muted">No items match.</td></tr>';
    var n = { use: 0, check: 0, no: 0 }; items.forEach(function (i) { if (n[i.status] != null) n[i.status]++; });
    $('invStats').innerHTML = '<span><b>' + items.length + '</b> items</span><span><b>' + n.use + '</b> can use</span><span><b>' + n.check + '</b> to check</span><span><b>' + n.no + '</b> not suitable</span><span class="muted">showing ' + vis.length + '</span>';
    if (window.Parts3D) window.Parts3D.scan($('invBody'));
  }

  /* ---- edit dialog ---- */
  function field(id, label, val, type, extra) {
    return '<label class="inv-f' + (extra && extra.wide ? ' wide' : '') + '"><span>' + label + '</span>' + (type === 'textarea' ? '<textarea id="f_' + id + '" rows="' + (extra.rows || 3) + '">' + esc(val) + '</textarea>' : '<input id="f_' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '">') + '</label>';
  }
  function openEdit(id) {
    var it = id ? items.filter(function (i) { return i.id === id; })[0] : { id: nextId(), name: '', part: '', brand: '', qty: '', specs: '', link: '', loc: '', owner: '', role: '', status: 'check', bom: '', model: 'generic', notes: '', mp: {} };
    editing = { id: id || null, mp: clone(it.mp || {}) };
    var models = (window.Parts3D ? window.Parts3D.models : ['generic']).slice().sort();
    var wrap = document.createElement('div'); wrap.className = 'p3d-modal'; wrap.id = 'invModal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', id ? 'Edit item' : 'Add item');
    wrap.innerHTML = '<form class="p3d-box inv-form" id="invForm"><div class="p3d-head"><h3>' + (id ? 'Edit item ' + esc(it.id) : 'Add an item') + '</h3><button type="button" class="p3d-x" id="invClose" aria-label="Close">×</button></div><div class="inv-grid">' +
      field('name', 'Name', it.name) + field('part', 'Part / model number', it.part) + field('brand', 'Brand', it.brand) + field('qty', 'Quantity', it.qty) +
      field('specs', 'Specifications', it.specs, 'textarea', { wide: 1, rows: 4 }) +
      '<label class="inv-f"><span>Use in this project</span><select id="f_status"><option value="use">Can use</option><option value="check">Check first</option><option value="no">Not suitable</option></select></label>' +
      field('bom', 'Covers BOM item(s)', it.bom) + field('role', 'Role / comment', it.role, 'textarea', { wide: 1, rows: 2 }) +
      field('loc', 'Location', it.loc) + field('owner', 'Owner / user', it.owner) + field('link', 'Link (http…)', it.link, 'url', { wide: 1 }) + field('notes', 'Notes', it.notes, 'text', { wide: 1 }) +
      '<label class="inv-f"><span>3D picture</span><select id="f_model">' + models.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="p3d-foot"><button type="submit" class="btn primary">Save</button><button type="button" class="btn" id="invCancel">Cancel</button><span class="muted">Saved in this browser. Use “Save to shared list” on the page to share it.</span></div></form>';
    document.body.appendChild(wrap);
    $('f_status').value = STATUS[it.status] ? it.status : 'check'; $('f_model').value = it.model || 'generic';
    function close() { wrap.remove(); editing = null; document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    $('invClose').addEventListener('click', close); $('invCancel').addEventListener('click', close);
    $('f_name').focus();
    $('invForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var o = { id: it.id, mp: it.model === $('f_model').value ? editing.mp : {} };
      FIELDS.forEach(function (k) { var el = $('f_' + k); if (el) o[k] = el.value.trim(); });
      if (!o.name) { $('f_name').focus(); return; }
      o.id = it.id; o = clean(o);
      if (id) items = items.map(function (i) { return i.id === id ? o : i; }); else items.push(o);
      save(); paint(); close();
    });
  }

  /* ---- toolbar actions ---- */
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function bind() {
    $('invAdd').addEventListener('click', function () { openEdit(null); });
    $('invSearch').addEventListener('input', function (e) { filterText = e.target.value.trim().toLowerCase(); paint(); });
    $('invStatus').addEventListener('change', function (e) { filterStatus = e.target.value; paint(); });
    $('invBody').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return; var id = b.getAttribute('data-id');
      if (b.classList.contains('invEdit')) openEdit(id);
      if (b.classList.contains('invDel')) { var it = items.filter(function (i) { return i.id === id; })[0]; if (it && window.confirm('Delete “' + it.name + '” from this list?')) { items = items.filter(function (i) { return i.id !== id; }); save(); paint(); } }
    });
    $('invJson').addEventListener('click', function () { download('rb87-lab-inventory.json', JSON.stringify({ items: items }, null, 1), 'application/json'); });
    $('invCsv').addEventListener('click', function () {
      var cols = FIELDS.filter(function (k) { return k !== 'model'; });
      download('rb87-lab-inventory.csv', [cols.join(',')].concat(items.map(function (i) { return cols.map(function (k) { return csvCell(i[k]); }).join(','); })).join('\n'), 'text/csv');
    });
    $('invImport').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () {
        try { var j = JSON.parse(r.result), arr = Array.isArray(j) ? j : j.items; if (!Array.isArray(arr)) throw new Error('no items'); items = arr.map(clean).map(function (o, n) { if (!o.id) o.id = 'U' + (n + 1); return o; }); save(); paint(); status('Imported ' + items.length + ' items.'); }
        catch (err) { status('Could not read that file.', true); }
      };
      r.readAsText(f); e.target.value = '';
    });
    $('invReset').addEventListener('click', function () { if (window.confirm('Replace this list with the default one? Your edits in this browser will be lost (the shared list is not touched).')) { items = clone(SEED.items); save(); paint(); } });
    $('invLoad').addEventListener('click', function () { call('invget').then(function (d) { if (d && d.ok) { if (!d.items.length) { status('The shared list is empty. Save this list to share it.'); return; } items = d.items.map(clean); save(); paint(); status('Loaded ' + items.length + ' items from the shared list.'); } else status((d && d.error) || 'Error', true); }).catch(function () { status('Could not reach the service.', true); }); });
    $('invSave').addEventListener('click', function () { call('invset', { items: items.map(clean) }).then(function (d) { if (d && d.ok) status('Saved ' + d.count + ' items to the shared list at ' + new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) + '.'); else status((d && d.error) || 'Error', true); }).catch(function () { status('Could not reach the service.', true); }); });
  }
  function status(t, bad) { var el = $('invStatusMsg'); el.textContent = t; el.className = 'bom-status' + (bad ? ' bad' : ''); }
  function call(action, extra) {
    PW = $('invPw').value; if (!PW) return Promise.resolve({ ok: false, error: 'Enter the group password first.' });
    var body = Object.assign({ action: action, pw: PW }, extra || {}); status('Working…');
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  items = load(); save(); bind(); paint();
})();
