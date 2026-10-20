/* search.js (v1): site-wide keyword search for the Rb-87 EIT lab guide.
   - adds a Search button to the top bar (Ctrl+K, or "/" outside a field) and a search dialog;
   - searches search-index.json (made by private/build_search.py: every page cut into sections, every Q&A entry, equipment row
     and Lab Inventory item), all words must match (case and accents ignored), headings count more than body text;
   - a result opens the page at its section; on arrival the section is opened (Q&A entries), scrolled to and the words found are
     highlighted (CSS Custom Highlight API where the browser has it). Works offline of any server except the file fetch. */
(function () {
  'use strict';
  var INDEX = null, loading = null, nav = null, dlg = null, inp = null, list = null, stat = null, sel = -1, results = [], lastQ = '';

  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function terms(q) { return norm(q).split(/\s+/).filter(function (t) { return t.length > 0; }); }

  // ---------- index ----------
  function load() {
    if (INDEX) return Promise.resolve(INDEX);
    if (loading) return loading;
    loading = fetch('search-index.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      d.s.forEach(function (s) { s.n3 = norm(s[3]); s.n2 = norm(s[2]); });
      INDEX = d; return d;
    });
    return loading;
  }

  function run(q) {
    var T = terms(q); if (!T.length) return [];
    var out = [];
    INDEX.s.forEach(function (s) {
      var score = 0, ok = true;
      for (var i = 0; i < T.length; i++) {
        var t = T[i], inH = s.n2.indexOf(t) >= 0, c = 0, pos = 0;
        while ((pos = s.n3.indexOf(t, pos)) >= 0 && c < 30) { c++; pos += t.length; }
        if (!inH && !c) { ok = false; break; }
        score += (inH ? 12 : 0) + Math.min(c, 12) + (s.n2.indexOf(t) === 0 ? 6 : 0);
      }
      if (!ok) return;
      if (T.length > 1 && s.n3.indexOf(T.join(' ')) >= 0) score += 15;           // the words together
      if (s[1] && /^qa-/.test(s[1])) score += 3;
      out.push({ s: s, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function snippet(s, T) {
    var text = s[3], n = s.n3, first = -1, best = null;
    T.forEach(function (t) { var p = n.indexOf(t); if (p >= 0 && (first < 0 || p < first)) first = p; });
    if (first < 0) first = 0;
    var a = Math.max(0, first - 70), b = Math.min(text.length, first + 150);
    var sn = (a > 0 ? '… ' : '') + text.slice(a, b) + (b < text.length ? ' …' : '');
    var h = esc(sn);
    T.slice().sort(function (x, y) { return y.length - x.length; }).forEach(function (t) {
      if (t.length < 2 && T.length > 1) return;
      h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return h;
  }

  // ---------- UI ----------
  var CSS = '.srch-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:6px 12px;color:var(--bg,#fff);font:600 .8rem/1 var(--font-mono,monospace);letter-spacing:.04em;opacity:.9}' +
    '.srch-btn:hover{background:rgba(127,127,127,.2)}.srch-btn:focus-visible{outline:2px solid var(--laser,#e0412c);outline-offset:-2px}' +
    '.srch-btn svg{width:17px;height:17px}.srch-btn kbd{font:600 .66rem var(--font-mono,monospace);color:inherit;background:none;box-shadow:none;border:1px solid currentColor;border-radius:3px;padding:1px 4px;opacity:.7}' +
    '@media (max-width:760px){.srch-btn span,.srch-btn kbd{display:none}.srch-btn{padding:6px 8px}}' +
    '.srch-ov{position:fixed;inset:0;z-index:10000;background:rgba(10,14,18,.55);display:none;align-items:flex-start;justify-content:center;padding:8vh 12px 12px}' +
    '.srch-ov.on{display:flex}' +
    '.srch-box{width:min(760px,100%);max-height:82vh;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#14181c);border:1px solid var(--rule-strong,#9aa19a);border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,.35)}' +
    '.srch-top{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--rule,#c6cbc4)}' +
    '.srch-top input{flex:1;font:500 1.05rem var(--font-body,system-ui,sans-serif);padding:9px 10px;border:1px solid var(--rule-strong,#9aa19a);border-radius:4px;background:var(--bg,#f2f3f0);color:inherit;min-width:0}' +
    '.srch-top input:focus{outline:2px solid var(--accent,#0d5a78);outline-offset:0}' +
    '.srch-x{all:unset;cursor:pointer;font:600 .8rem var(--font-mono,monospace);padding:8px 10px;border:1px solid var(--rule-strong,#9aa19a);border-radius:4px}' +
    '.srch-stat{padding:6px 14px;font:500 .78rem var(--font-mono,monospace);color:var(--muted,#626b73);border-bottom:1px solid var(--rule,#c6cbc4)}' +
    '.srch-list{list-style:none;margin:0;padding:4px;overflow:auto}' +
    '.srch-list li a{display:block;padding:8px 10px;border-radius:4px;color:inherit;text-decoration:none;border:1px solid transparent}' +
    '.srch-list li.cur a,.srch-list li a:hover{background:var(--accent-soft,#d7e8ef);border-color:var(--accent,#0d5a78)}' +
    '.srch-pg{font:600 .68rem var(--font-mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--accent,#0d5a78)}' +
    '.srch-h{font-weight:700;font-size:.95rem;margin:1px 0 2px}.srch-sn{font-size:.82rem;color:var(--ink-2,#3d454d);line-height:1.4;overflow-wrap:anywhere}' +
    '.srch-sn mark,.srch-h mark{background:#ffe08a;color:#1b1f24;border-radius:2px;padding:0 1px}' +
    '.srch-hint{padding:8px 14px;font-size:.78rem;color:var(--muted,#626b73);border-top:1px solid var(--rule,#c6cbc4)}' +
    '::highlight(srch-hit){background:#ffe08a;color:#1b1f24}' +
    '.srch-flash{outline:3px solid var(--laser,#e0412c);outline-offset:3px;transition:outline-color 1.8s}' +
    '[id],[data-row]{scroll-margin-top:calc(var(--nav-h,48px) + 12px)}';

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    nav = document.querySelector('.topnav .wrap');
    if (nav) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'srch-btn'; b.setAttribute('aria-label', 'Search the guide (Ctrl+K)');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg><span>Search</span><kbd>Ctrl K</kbd>';
      b.addEventListener('click', open); nav.appendChild(b);
    }
    dlg = document.createElement('div'); dlg.className = 'srch-ov'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Search the guide');
    dlg.innerHTML = '<div class="srch-box"><div class="srch-top"><input type="search" placeholder="Search the whole guide: a word, a part number, a question…" aria-label="Search words" autocomplete="off" spellcheck="false"><button type="button" class="srch-x">Esc</button></div><div class="srch-stat" aria-live="polite"></div><ul class="srch-list" role="listbox"></ul><div class="srch-hint">All words must match. ↑ ↓ to choose, Enter to open. Try: ITC502, double pass, OQAg, stem, 3.39 mG.</div></div>';
    document.body.appendChild(dlg);
    inp = dlg.querySelector('input'); list = dlg.querySelector('.srch-list'); stat = dlg.querySelector('.srch-stat');
    dlg.addEventListener('mousedown', function (e) { if (e.target === dlg) close(); });
    dlg.querySelector('.srch-x').addEventListener('click', close);
    inp.addEventListener('input', function () { go(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); var a = list.querySelector('li.cur a') || list.querySelector('li a'); if (a) a.click(); }
    });
  }
  function open() {
    if (!dlg) build();
    dlg.classList.add('on'); document.documentElement.style.overflow = 'hidden';
    inp.focus(); inp.select();
    stat.textContent = 'Loading the index…';
    load().then(function () { go(inp.value); }, function () { stat.textContent = 'The search index could not be loaded (search-index.json).'; });
  }
  function close() { if (dlg) { dlg.classList.remove('on'); document.documentElement.style.overflow = ''; } }
  function move(d) {
    var items = list.querySelectorAll('li'); if (!items.length) return;
    sel = Math.max(0, Math.min(items.length - 1, sel + d));
    items.forEach(function (li, i) { li.classList.toggle('cur', i === sel); });
    items[sel].scrollIntoView({ block: 'nearest' });
  }
  function go(q) {
    lastQ = q; sel = -1;
    if (!INDEX) return;
    var T = terms(q);
    if (!T.length) { list.innerHTML = ''; stat.textContent = INDEX.s.length + ' sections on ' + INDEX.pages.length + ' pages. Type to search.'; return; }
    results = run(q);
    var shown = results.slice(0, 40);
    stat.textContent = results.length ? (results.length + ' result' + (results.length > 1 ? 's' : '') + (results.length > 40 ? ' (best 40 shown)' : '')) : 'No result. Try fewer or shorter words.';
    var qs = encodeURIComponent(q.trim());
    list.innerHTML = shown.map(function (r) {
      var s = r.s, file = INDEX.files[s[0]], hash = s[1] ? '#' + s[1] : '';
      return '<li role="option"><a href="' + esc(file) + '?q=' + qs + hash + '"><div class="srch-pg">' + esc(INDEX.pages[s[0]]) + '</div><div class="srch-h">' + esc(s[2]) + '</div><div class="srch-sn">' + snippet(s, T) + '</div></a></li>';
    }).join('');
    if (shown.length) { sel = 0; list.querySelector('li').classList.add('cur'); }
  }

  // ---------- arrival: open, scroll, highlight ----------
  function arrive() {
    var qm = /[?&]q=([^&#]*)/.exec(location.search), q = qm ? decodeURIComponent(qm[1].replace(/\+/g, ' ')) : '';
    var h = decodeURIComponent((location.hash || '').slice(1)), el = null;
    if (/^row-/.test(h)) {
      var rows = document.querySelectorAll('tr[data-row="' + h.slice(4).replace(/"/g, '') + '"]');
      for (var i = 0; i < rows.length; i++) if (rows[i].offsetParent !== null) { el = rows[i]; break; }
      if (!el && rows.length) el = rows[0];
    } else if (/^inv-/.test(h)) {
      el = document.getElementById('invBody');
    } else if (h) {
      try { el = document.getElementById(h); } catch (e) { el = null; }
    }
    if (el) {
      for (var p = el; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
      var moved = false, stop = function () { moved = true; };
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, stop, { once: true, passive: true }); });
      var place = function () {   // the page may still be growing (pictures, 3D parts): put the section at the top again, until the reader moves
        if (moved) return;
        var navh = (nav && nav.parentElement ? nav.parentElement.offsetHeight : 48) + 8;
        if (Math.abs(el.getBoundingClientRect().top - navh) > 30) el.scrollIntoView({ block: 'start' });
      };
      [200, 900, 2000, 3500].forEach(function (ms) { setTimeout(place, ms); });
      setTimeout(function () {
        el.classList.add('srch-flash'); setTimeout(function () { el.style.outlineColor = 'transparent'; }, 1600); setTimeout(function () { el.classList.remove('srch-flash'); el.style.outlineColor = ''; }, 3600);
        if (q) mark(el, q);
      }, 300);
    } else if (q) mark(document.body, q);
  }
  function mark(root, q) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    var T = terms(q).filter(function (t) { return t.length > 1 || terms(q).length === 1; });
    if (!T.length) return;
    var ranges = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { var pe = n.parentElement; if (!pe || /^(SCRIPT|STYLE|NOSCRIPT|BUTTON|SELECT|TEXTAREA)$/.test(pe.tagName)) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }
    }), n;
    while ((n = w.nextNode()) && ranges.length < 400) {
      var low = norm(n.nodeValue);
      if (low.length !== n.nodeValue.length) continue;   // accents change the length: skip such nodes rather than mis-place the range
      T.forEach(function (t) { var p = 0; while ((p = low.indexOf(t, p)) >= 0 && ranges.length < 400) { var r = document.createRange(); r.setStart(n, p); r.setEnd(n, p + t.length); ranges.push(r); p += t.length; } });
    }
    if (ranges.length) CSS.highlights.set('srch-hit', new Highlight(...ranges));
  }

  // ---------- start ----------
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && dlg && dlg.classList.contains('on')) { close(); }
  });
  function init() { build(); arrive(); window.SiteSearch = { open: open, close: close, run: function (q) { return load().then(function () { return run(q); }); } }; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
