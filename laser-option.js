/* Laser option switch, shared by the Zeeman EIT guide, Equipment, 3D Bench and DIY pages.
   The choice (Eagleyard BFY12 or Yanban RB-795-DFB-BFW) is stored in localStorage ('rb87-laser') and applied to
   <html data-laser="...">. Content written for one laser carries data-laser-only="eagleyard" or "yanban" and is hidden
   for the other one. Scripts can read window.LaserOpt.get() and listen with window.LaserOpt.on(fn).
   Load it in <head> (not deferred) so the page never flashes the wrong variant. */
(function () {
  var KEY = 'rb87-laser';
  var OPTS = {
    eagleyard: { label: 'Eagleyard BFY12', title: 'Toptica Eagleyard EYP-DFB-0795-00015-1500-BFY12-0005: PM fibre, micro-isolator inside, 5–15 mW' },
    yanban: { label: 'Yanban RB-795-DFB-BFW', title: 'Yanban RB-795-DFB-BFW: 100–120 mW, 200 kHz; packaging pending the supplier reply (PM fibre with built-in isolator asked, free space listed)' }
  };
  var DEF = 'eagleyard';
  function get() {
    try { var v = localStorage.getItem(KEY); return OPTS[v] ? v : DEF; } catch (e) { return DEF; }
  }
  var css = 'html[data-laser="yanban"] [data-laser-only="eagleyard"],html:not([data-laser="yanban"]) [data-laser-only="yanban"]{display:none!important}' +
    '.laser-pill{position:fixed;left:12px;bottom:12px;z-index:9000;display:flex;align-items:center;gap:6px;padding:5px 7px 5px 10px;border-radius:999px;' +
    'background:var(--bg,#fff);color:var(--ink,#1b1f24);border:1px solid var(--rule-strong,#9aa5b1);box-shadow:0 2px 10px rgba(0,0,0,.18);font:600 12px/1.2 var(--font-body,system-ui,sans-serif)}' +
    '.laser-pill .lp-k{letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;color:var(--muted,#6b7280)}' +
    '.laser-sw{display:inline-flex;border:1px solid var(--rule-strong,#9aa5b1);border-radius:999px;overflow:hidden}' +
    '.laser-sw button{all:unset;cursor:pointer;padding:4px 10px;font:600 12px/1.3 var(--font-body,system-ui,sans-serif);color:var(--ink,#1b1f24)}' +
    '.laser-sw button[aria-pressed="true"]{background:var(--accent,#1f5fa8);color:#fff}' +
    '.laser-sw button:focus-visible{outline:2px solid var(--focus,#1f5fa8);outline-offset:-2px}' +
    '.laser-pend{font-weight:500;font-size:11px;color:var(--muted,#6b7280);max-width:220px}' +
    '.laser-box{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0;padding:10px 12px;border:1px solid var(--rule,#d0d5dc);border-radius:8px;background:var(--accent-soft,#eef3fa)}' +
    '@media (max-width:560px){.laser-pill{left:8px;right:8px;bottom:8px;justify-content:space-between}.laser-pend{display:none}}' +
    '@media print{.laser-pill{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.documentElement.setAttribute('data-laser', get());

  function switchEl() {
    var w = document.createElement('span'); w.className = 'laser-sw'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', 'Laser option');
    Object.keys(OPTS).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = OPTS[k].label; b.title = OPTS[k].title; b.dataset.v = k;
      b.addEventListener('click', function () { set(k); });
      w.appendChild(b);
    });
    return w;
  }
  function paint() {
    var v = get();
    document.querySelectorAll('.laser-sw button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); });
    document.querySelectorAll('.laser-pend').forEach(function (s) { s.style.display = v === 'yanban' ? '' : 'none'; });
  }
  function apply(v) {
    document.documentElement.setAttribute('data-laser', v);
    paint();
    try { document.dispatchEvent(new CustomEvent('rb87-laser', { detail: v })); } catch (e) {}
  }
  function set(v) {
    if (!OPTS[v]) return;
    try { localStorage.setItem(KEY, v); } catch (e) {}
    apply(v);
  }
  function build() {
    if (!document.querySelector('.laser-pill')) {
      var p = document.createElement('div'); p.className = 'laser-pill';
      var k = document.createElement('span'); k.className = 'lp-k'; k.textContent = 'Laser';
      p.appendChild(k); p.appendChild(switchEl());
      var n = document.createElement('span'); n.className = 'laser-pend'; n.textContent = 'packaging pending supplier reply';
      p.appendChild(n);
      document.body.appendChild(p);
    }
    document.querySelectorAll('.laser-switch').forEach(function (el) { if (!el.querySelector('.laser-sw')) el.appendChild(switchEl()); });
    paint();
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(get()); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  window.LaserOpt = {
    get: get, set: set, options: OPTS,
    on: function (fn) { document.addEventListener('rb87-laser', function (e) { fn(e.detail); }); },
    pick: function (e, y) { return get() === 'yanban' ? y : e; }
  };
})();
