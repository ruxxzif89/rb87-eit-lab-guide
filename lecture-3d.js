/* lecture-3d.js
   Interactive three.js illustrations for the lecture notes. Usage in HTML:
     <div class="viz3d" data-scene="bloch-drive" data-title="..." data-caption="..."></div>
   Each scene is created lazily when it scrolls into view. Requires three.js r128 + OrbitControls.
   All numbers shown come from the formulas in the lectures; "arbitrary units" are said so in the captions. */
(function () {
  'use strict';
  var T = window.THREE;
  var TAU = Math.PI * 2, DEG = Math.PI / 180;

  /* ---------------- small helpers ---------------- */
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmt(x, d) { return (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d); }
  var COL = { bg: 0x0e1a21, grid: 0x34505c, ink: 0xe6edf0, red: 0xff5468, blue: 0x5db3d6, orange: 0xf2a65a, green: 0x6fd39a, violet: 0xa497de, yellow: 0xf2c14e, grey: 0x7f8f98 };

  function lineObj(pts, color, opacity, dashed) {
    var g = new T.BufferGeometry().setFromPoints(pts);
    var m = dashed ? new T.LineDashedMaterial({ color: color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: opacity == null ? 1 : opacity }) : new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity == null ? 1 : opacity });
    var l = new T.Line(g, m); l.frustumCulled = false; if (dashed) l.computeLineDistances(); return l;
  }
  function circle(r, plane, color, op, n) {
    var pts = [], N = n || 96;
    for (var i = 0; i <= N; i++) { var a = i / N * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r; pts.push(plane === 'xz' ? new T.Vector3(c, 0, s) : plane === 'xy' ? new T.Vector3(c, s, 0) : new T.Vector3(0, c, s)); }
    return lineObj(pts, color, op);
  }
  function arrow(dir, len, color, o) { var a = new T.ArrowHelper(dir.clone().normalize(), new T.Vector3(), len, color, (o && o.head) || 0.12 * len + 0.04, (o && o.hw) || 0.06); return a; }
  function setArrow(a, v, minLen) { var l = v.length(); if (l < (minLen || 1e-4)) { a.visible = false; return; } a.visible = true; a.setDirection(v.clone().normalize()); a.setLength(l, Math.min(0.18, l * 0.3), 0.07); }
  function sphereWire(r, op) {
    var g = new T.Group(); g.add(circle(r, 'xz', COL.grid, op || 0.8)); g.add(circle(r, 'xy', COL.grid, op || 0.5)); g.add(circle(r, 'yz', COL.grid, op || 0.5));
    var s = new T.Mesh(new T.SphereGeometry(r, 32, 24), new T.MeshBasicMaterial({ color: 0x1d3a47, transparent: true, opacity: 0.18, depthWrite: false })); g.add(s); return g;
  }
  function dot(color, r) { return new T.Mesh(new T.SphereGeometry(r || 0.05, 16, 12), new T.MeshBasicMaterial({ color: color })); }

  /* ---------------- stage (renderer, camera, labels, loop) ---------------- */
  function Stage(host, o) {
    var self = this; this.host = host; this.o = o || {};
    this.scene = new T.Scene(); this.scene.background = new T.Color(COL.bg);
    this.camera = new T.PerspectiveCamera(40, 1, 0.05, 200);
    var p = this.o.cam || [3.2, 2.4, 3.6]; this.camera.position.set(p[0], p[1], p[2]);
    this.scene.add(new T.AmbientLight(0xffffff, 0.8)); var dl = new T.DirectionalLight(0xffffff, 0.8); dl.position.set(3, 5, 4); this.scene.add(dl);
    this.labels = []; this.tick = []; this.running = false; this.t = 0; this.visible = false;
    this.canvasHost = h('div', 'viz-canvas'); this.labelLayer = h('div', 'viz-labels'); this.canvasHost.appendChild(this.labelLayer);
  }
  Stage.prototype.init = function () {
    var self = this;
    try { this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    catch (e) { this.canvasHost.appendChild(h('div', 'viz-fallback', '3D view needs WebGL, which is not available here. The equations and text above still hold.')); this.failed = true; return; }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.canvasHost.insertBefore(this.renderer.domElement, this.labelLayer);
    this.renderer.domElement.setAttribute('aria-label', this.o.aria || '3D illustration. Drag to rotate, scroll to zoom.'); this.renderer.domElement.tabIndex = 0;
    this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.1; this.controls.minDistance = 1.5; this.controls.maxDistance = this.o.maxDist || 18;
    var tg = this.o.target || [0, 0, 0]; this.controls.target.set(tg[0], tg[1], tg[2]);
    this.resize(); var ro = new ResizeObserver(function () { self.resize(); }); ro.observe(this.canvasHost);
  };
  Stage.prototype.resize = function () {
    if (!this.renderer) return; var w = this.canvasHost.clientWidth, hh = this.canvasHost.clientHeight; if (!w || !hh) return;
    this.renderer.setSize(w, hh, false); this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); this.dirty = true;
  };
  Stage.prototype.label = function (text, pos, cls) {
    var el = h('span', 'viz-lab' + (cls ? ' ' + cls : ''), text); this.labelLayer.appendChild(el);
    var o = { el: el, pos: pos.clone ? pos.clone() : new T.Vector3(pos[0], pos[1], pos[2]) }; this.labels.push(o); return o;
  };
  Stage.prototype.start = function () {
    if (this.running || this.failed) return; this.running = true; var self = this, last = 0;
    function frame(ts) {
      if (!self.running) return; requestAnimationFrame(frame);
      if (document.hidden && !window.__vizForce) return;
      var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; self.t += dt;
      for (var i = 0; i < self.tick.length; i++) self.tick[i](dt, self.t);
      self.controls.update(); self.renderer.render(self.scene, self.camera);
      var w = self.canvasHost.clientWidth, hh = self.canvasHost.clientHeight, v = new T.Vector3();
      for (var j = 0; j < self.labels.length; j++) {
        var L = self.labels[j]; v.copy(L.pos).project(self.camera);
        var hide = v.z > 1 || v.z < -1; L.el.style.display = hide ? 'none' : '';
        if (!hide) L.el.style.transform = 'translate(-50%,-50%) translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * hh).toFixed(1) + 'px)';
      }
    }
    requestAnimationFrame(frame);
  };
  Stage.prototype.stop = function () { this.running = false; };

  /* ---------------- controls builder ---------------- */
  function UI(panel, onChange) {
    this.v = {}; this.panel = panel; this.onChange = onChange || function () { };
  }
  UI.prototype.range = function (key, label, min, max, step, val, f) {
    var self = this, id = 'v' + Math.random().toString(36).slice(2, 8); this.v[key] = val;
    var wrap = h('label', 'viz-row'); wrap.setAttribute('for', id);
    var lt = h('span', 'lt', label + ' <output for="' + id + '"></output>'); var out = lt.querySelector('output');
    var inp = h('input'); inp.type = 'range'; inp.id = id; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    function upd() { self.v[key] = +inp.value; out.textContent = f ? f(self.v[key]) : fmt(self.v[key]); }
    inp.addEventListener('input', function () { upd(); self.onChange(key); }); upd();
    wrap.appendChild(lt); wrap.appendChild(inp); this.panel.appendChild(wrap);
    return { set: function (x) { inp.value = x; upd(); }, el: inp };
  };
  UI.prototype.select = function (key, label, opts, val) {
    var self = this, id = 'v' + Math.random().toString(36).slice(2, 8); this.v[key] = val;
    var wrap = h('label', 'viz-row'); wrap.setAttribute('for', id); wrap.appendChild(h('span', 'lt', label));
    var s = h('select'); s.id = id; opts.forEach(function (o) { var op = h('option', null, o[1]); op.value = o[0]; if (o[0] === val) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function () { self.v[key] = s.value; self.onChange(key); }); wrap.appendChild(s); this.panel.appendChild(wrap);
    return { set: function (x) { s.value = x; self.v[key] = x; }, el: s };
  };
  UI.prototype.check = function (key, label, val) {
    var self = this, id = 'v' + Math.random().toString(36).slice(2, 8); this.v[key] = !!val;
    var wrap = h('label', 'viz-row chk'); wrap.setAttribute('for', id); var c = h('input'); c.type = 'checkbox'; c.id = id; c.checked = !!val;
    c.addEventListener('change', function () { self.v[key] = c.checked; self.onChange(key); }); wrap.appendChild(c); wrap.appendChild(document.createTextNode(' ' + label)); this.panel.appendChild(wrap);
    return { set: function (x) { c.checked = x; self.v[key] = x; }, el: c };
  };
  UI.prototype.buttons = function (list) {
    var row = h('div', 'viz-btns'); list.forEach(function (b) { var bt = h('button', 'btn', b[0]); bt.type = 'button'; bt.addEventListener('click', b[1]); row.appendChild(bt); }); this.panel.appendChild(row); return row;
  };
  UI.prototype.readout = function () { var r = h('div', 'viz-read'); r.setAttribute('aria-live', 'polite'); this.panel.appendChild(r); return r; };

  /* ======================================================================== */
  /* scenes: each returns nothing; they register stage.tick callbacks         */
  /* ======================================================================== */
  var SCENES = {};

  /* ---------- L1: electromagnetic wave and polarization ---------- */
  SCENES['wave'] = {
    opts: { cam: [3.2, 3.0, 9.6], target: [3, 0, 0], maxDist: 24 },
    build: function (st, ui) {
      var pol = ui.select('pol', 'Polarization', [['H', 'linear, horizontal (H)'], ['V', 'linear, vertical (V)'], ['D', 'linear, +45°'], ['sp', 'circular σ⁺ (right-handed about the beam)'], ['sm', 'circular σ⁻'], ['el', 'elliptical']], 'D');
      ui.range('lam', 'Wavelength (arb. units)', 0.8, 3, 0.05, 1.6, function (x) { return fmt(x, 2); });
      ui.range('spd', 'Time speed', 0, 2, 0.05, 0.6, function (x) { return fmt(x, 2) + '×'; });
      ui.check('showB', 'Show magnetic field B', true);
      var out = ui.readout();
      var N = 160, L = 6, g = new T.Group(); st.scene.add(g);
      var axis = lineObj([new T.Vector3(0, 0, 0), new T.Vector3(L + 0.6, 0, 0)], COL.grey, 0.7); g.add(axis);
      var k = arrow(new T.Vector3(1, 0, 0), 0.9, COL.ink); k.position.set(L + 0.05, 0, 0); g.add(k);
      st.label('propagation direction', new T.Vector3(L + 0.2, 0.55, 0));
      st.label('vertical axis (V)', new T.Vector3(0.3, 1.35, 0), 'e'); st.label('horizontal axis (H)', new T.Vector3(0.3, 0, 1.45), 'b');
      var ePts = [], bPts = []; for (var i = 0; i < N; i++) { ePts.push(new T.Vector3()); bPts.push(new T.Vector3()); }
      var eLine = new T.Line(new T.BufferGeometry().setFromPoints(ePts), new T.LineBasicMaterial({ color: COL.blue })), bLine = new T.Line(new T.BufferGeometry().setFromPoints(bPts), new T.LineBasicMaterial({ color: COL.orange }));
      g.add(eLine); g.add(bLine);
      var NS = 40, segE = new T.LineSegments(new T.BufferGeometry().setFromPoints(new Array(NS * 2).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.55 }));
      var segB = new T.LineSegments(new T.BufferGeometry().setFromPoints(new Array(NS * 2).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.45 }));
      g.add(segE); g.add(segB);
      function jones() { // field amplitudes (Ey, Ez) at phase phi: Ey = ay cos(phi + dy), Ez = az cos(phi + dz)
        switch (ui.v.pol) { case 'H': return [0, 1, 0, 0]; case 'V': return [1, 0, 0, 0]; case 'D': return [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
          case 'sp': return [Math.SQRT1_2, Math.SQRT1_2, 0, -Math.PI / 2]; case 'sm': return [Math.SQRT1_2, Math.SQRT1_2, 0, Math.PI / 2];
          default: return [0.9, 0.45, 0, -Math.PI / 2]; }
      }
      var t = 0;
      st.tick.push(function (dt) {
        t += dt * ui.v.spd; var J = jones(), kk = TAU / ui.v.lam, A = 1.15;
        function fld(x) { var ph = t * TAU / 1.6 - kk * x; return [J[0] * Math.cos(ph + J[2]) * A, J[1] * Math.cos(ph + J[3]) * A]; }
        var pe = eLine.geometry.attributes.position, pb = bLine.geometry.attributes.position;
        for (var i = 0; i < N; i++) { var x = i / (N - 1) * L, f = fld(x); pe.setXYZ(i, x, f[0], f[1]); pb.setXYZ(i, x, -f[1], f[0]); }
        pe.needsUpdate = true; pb.needsUpdate = true; bLine.visible = ui.v.showB; segB.visible = ui.v.showB;
        var se = segE.geometry.attributes.position, sb = segB.geometry.attributes.position;
        for (var j = 0; j < NS; j++) { var xx = (j + 0.5) / NS * L, ff = fld(xx); se.setXYZ(2 * j, xx, 0, 0); se.setXYZ(2 * j + 1, xx, ff[0], ff[1]); sb.setXYZ(2 * j, xx, 0, 0); sb.setXYZ(2 * j + 1, xx, -ff[1], ff[0]); }
        se.needsUpdate = true; sb.needsUpdate = true;
        var spinTxt = { H: 'a superposition of σ⁺ and σ⁻ (average spin 0)', V: 'a superposition of σ⁺ and σ⁻ (average spin 0)', D: 'a superposition of σ⁺ and σ⁻ (average spin 0)', sp: '+ħ per photon along the beam', sm: '−ħ per photon along the beam', el: 'between: net spin between −ħ and +ħ per photon' }[ui.v.pol];
        out.innerHTML = 'λ in the display is arbitrary. A real 795 nm beam has λ = 794.979 nm and ν = 377.107 THz.<br>Photon spin angular momentum: <b>' + spinTxt + '</b>.<br>E, B and the propagation direction are mutually perpendicular: B = (k̂ × E)/c.';
      });
    }
  };

  /* ---------- L2 / L3 / L4: Bloch sphere (three modes) ---------- */
  function blochScene(mode) {
    return {
      opts: { cam: [3.0, 2.1, 3.6], maxDist: 10 },
      build: function (st, ui) {
        var R = 1, sph = sphereWire(R); st.scene.add(sph);
        var ax = [[new T.Vector3(-1.35, 0, 0), new T.Vector3(1.35, 0, 0)], [new T.Vector3(0, -1.35, 0), new T.Vector3(0, 1.35, 0)], [new T.Vector3(0, 0, -1.35), new T.Vector3(0, 0, 1.35)]];
        ax.forEach(function (a) { st.scene.add(lineObj(a, COL.grey, 0.5)); });
        st.label('|e⟩', new T.Vector3(0, 1.5, 0), 'e'); st.label('|g⟩', new T.Vector3(0, -1.5, 0), 'b');
        st.label('u', new T.Vector3(1.5, 0, 0)); st.label('v', new T.Vector3(0, 0, -1.5));
        var vec = arrow(new T.Vector3(0, 1, 0), 1, COL.red, { hw: 0.07 }); st.scene.add(vec);
        var torque = arrow(new T.Vector3(1, 0, 0), 1.2, COL.green); st.scene.add(torque); torque.visible = false;
        var tip = dot(COL.yellow, 0.05); st.scene.add(tip);
        var ss = dot(COL.violet, 0.045); ss.visible = false; st.scene.add(ss);
        var trailN = 260, trailArr = [];
        var trail = new T.Line(new T.BufferGeometry().setFromPoints(new Array(trailN).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.yellow, transparent: true, opacity: 0.8 })); st.scene.add(trail);
        var out = null, r = { u: 0, v: 0, w: -1 };
        function P(u, v, w) { return new T.Vector3(u, w, -v); }  // Bloch (u,v,w) -> scene (x,y,z)
        function pushTrail() {
          trailArr.push(P(r.u, r.v, r.w)); if (trailArr.length > trailN) trailArr.shift();
          var pos = trail.geometry.attributes.position; for (var i = 0; i < trailN; i++) { var q = trailArr[Math.min(i, trailArr.length - 1)]; pos.setXYZ(i, q.x, q.y, q.z); } pos.needsUpdate = true;
        }
        function clearTrail() { trailArr.length = 0; pushTrail(); }
        function show() { var p = P(r.u, r.v, r.w); setArrow(vec, p, 1e-3); tip.position.copy(p); }

        if (mode === 'state') {
          var th = ui.range('th', 'Polar angle θ', 0, 180, 1, 60, function (x) { return fmt(x, 0) + '°'; });
          var ph = ui.range('ph', 'Relative phase φ', 0, 360, 1, 40, function (x) { return fmt(x, 0) + '°'; });
          ui.check('free', 'Let the phase run (free precession, Δ ≠ 0)', false);
          ui.range('dlt', 'Detuning of the frame Δ (arb.)', -2, 2, 0.05, 0.6, function (x) { return fmt(x, 2); });
          out = ui.readout(); var phase = 40 * DEG;
          st.tick.push(function (dt) {
            if (ui.v.free) { phase += ui.v.dlt * dt * 1.5; ph.set(((phase / DEG) % 360 + 360) % 360); } else phase = ui.v.ph * DEG;
            var t = ui.v.th * DEG; r.u = Math.sin(t) * Math.cos(phase); r.v = Math.sin(t) * Math.sin(phase); r.w = Math.cos(t); show(); if (ui.v.free) pushTrail(); else clearTrail();
            var pe = Math.cos(t / 2) * Math.cos(t / 2);
            out.innerHTML = '|ψ⟩ = cos(θ/2)|e⟩ + e<sup>iφ</sup> sin(θ/2)|g⟩<br>P(e) = <b>' + fmt(pe, 3) + '</b>, P(g) = <b>' + fmt(1 - pe, 3) + '</b>, relative phase φ = <b>' + fmt((phase / DEG % 360 + 360) % 360, 0) + '°</b><br>Bloch vector (u, v, w) = (' + fmt(r.u) + ', ' + fmt(r.v) + ', ' + fmt(r.w) + '); w = P(e) − P(g)<br>Measuring in {g, e} sees only θ. The phase φ is invisible there but sets the equator direction.';
          });
        } else {
          var Om = ui.range('Om', 'Rabi frequency Ω (arb.)', 0, 3, 0.05, 1, function (x) { return fmt(x, 2); });
          var De = ui.range('De', 'Detuning Δ (arb.)', -3, 3, 0.05, 0, function (x) { return fmt(x, 2); });
          var Ga, Gd;
          if (mode === 'decay') { Ga = ui.range('Ga', 'Decay rate Γ (arb.)', 0, 1.5, 0.02, 0.25, function (x) { return fmt(x, 2); }); Gd = ui.range('Gd', 'Extra dephasing γ_deph (arb.)', 0, 1.5, 0.02, 0, function (x) { return fmt(x, 2); }); ss.visible = true; }
          ui.range('sp', 'Time speed', 0.2, 3, 0.05, 1, function (x) { return fmt(x, 2) + '×'; });
          ui.buttons([['Reset to |g⟩', function () { r.u = 0; r.v = 0; r.w = -1; clearTrail(); }], ['Reset to |e⟩', function () { r.u = 0; r.v = 0; r.w = 1; clearTrail(); }]]);
          out = ui.readout(); r.u = 0; r.v = 0; r.w = -1;
          function f(s) { var O = ui.v.Om, D = ui.v.De, G = mode === 'decay' ? ui.v.Ga : 0, gp = mode === 'decay' ? G / 2 + ui.v.Gd : 0;
            return { u: D * s.v - gp * s.u, v: -D * s.u + O * s.w - gp * s.v, w: -O * s.v - (mode === 'decay' ? G * (s.w + 1) : 0) }; }
          st.tick.push(function (dt) {
            var n = 8, hh = dt * ui.v.sp * 1.4 / n;
            for (var i = 0; i < n; i++) { // RK4
              var s0 = { u: r.u, v: r.v, w: r.w }, k1 = f(s0);
              var s1 = { u: s0.u + hh / 2 * k1.u, v: s0.v + hh / 2 * k1.v, w: s0.w + hh / 2 * k1.w }, k2 = f(s1);
              var s2 = { u: s0.u + hh / 2 * k2.u, v: s0.v + hh / 2 * k2.v, w: s0.w + hh / 2 * k2.w }, k3 = f(s2);
              var s3 = { u: s0.u + hh * k3.u, v: s0.v + hh * k3.v, w: s0.w + hh * k3.w }, k4 = f(s3);
              r.u += hh / 6 * (k1.u + 2 * k2.u + 2 * k3.u + k4.u); r.v += hh / 6 * (k1.v + 2 * k2.v + 2 * k3.v + k4.v); r.w += hh / 6 * (k1.w + 2 * k2.w + 2 * k3.w + k4.w);
            }
            show(); pushTrail();
            var O = ui.v.Om, D = ui.v.De, ef = new T.Vector3(O, -D, 0); // torque (u,v,w)=(Ω,0,-Δ) -> scene (Ω, -Δ, 0)
            torque.visible = ef.length() > 1e-3; if (torque.visible) { torque.setDirection(ef.clone().normalize()); torque.setLength(Math.min(1.5, 0.5 + ef.length() * 0.3), 0.15, 0.07); }
            var pe = (r.w + 1) / 2, gen = Math.sqrt(O * O + D * D), mx = O * O / (O * O + D * D || 1);
            var txt = 'P(e) = <b>' + fmt(pe, 3) + '</b>, |r| = <b>' + fmt(Math.sqrt(r.u * r.u + r.v * r.v + r.w * r.w), 3) + '</b><br>Green arrow: torque axis Ω_eff = (Ω, 0, −Δ); the state precesses about it at √(Ω²+Δ²) = <b>' + fmt(gen, 2) + '</b>.';
            if (mode === 'drive') txt += '<br>Without decay: max P(e) = Ω²/(Ω²+Δ²) = <b>' + fmt(mx, 3) + '</b>. The vector stays on the sphere (|r| = 1).';
            else {
              var G = ui.v.Ga, gp = G / 2 + ui.v.Gd, s = G > 0 ? O * O * gp / (G * (D * D + gp * gp)) : Infinity;
              var wss = isFinite(s) ? -1 / (1 + s) : 0, vss = isFinite(s) ? O * wss * gp / (D * D + gp * gp) : 0, uss = gp > 0 ? D * vss / gp : 0;
              ss.position.copy(P(uss, vss, wss));
              txt += '<br>T₁ = 1/Γ = <b>' + (G > 0 ? fmt(1 / G, 1) : '∞') + '</b>, T₂ = 1/γ⊥ = <b>' + (gp > 0 ? fmt(1 / gp, 1) : '∞') + '</b> with γ⊥ = Γ/2 + γ_deph. Violet dot: steady state (saturation s = <b>' + (isFinite(s) ? fmt(s, 2) : '∞') + '</b>). The vector shrinks inside the sphere: a mixed state.';
            }
            out.innerHTML = txt;
          });
        }
        show();
      }
    };
  }
  SCENES['bloch-state'] = blochScene('state');
  SCENES['bloch-drive'] = blochScene('drive');
  SCENES['bloch-decay'] = blochScene('decay');

  /* ---------- L5: Zeeman sublevels, vector model and level ladder ---------- */
  SCENES['zeeman'] = {
    opts: { cam: [3.4, 2.8, 9.0], target: [2.8, 0.5, 0], maxDist: 22 },
    build: function (st, ui) {
      ui.select('F', 'Hyperfine level of 5S₁/₂', [['2', 'F = 2 (g_F = +½)'], ['1', 'F = 1 (g_F = −½)']], '2');
      var msel = ui.range('m', 'm_F', -2, 2, 1, 2, function (x) { return (x > 0 ? '+' : '') + fmt(x, 0); });
      ui.select('pol', 'Light on F = 2 → F′ = 1 (D1)', [['sp', 'σ⁺ (Δm = +1)'], ['sm', 'σ⁻ (Δm = −1)'], ['pi', 'π (Δm = 0)']], 'sp');
      ui.range('B', 'Magnetic field B', 0, 5, 0.05, 1.5, function (x) { return fmt(x, 2) + ' G'; });
      ui.check('prec', 'Show Larmor precession', true);
      var out = ui.readout(), grp = new T.Group(); st.scene.add(grp);
      grp.add(sphereWire(1.0, 0.25));
      grp.add(lineObj([new T.Vector3(0, -1.6, 0), new T.Vector3(0, 1.6, 0)], COL.ink, 0.8)); st.label('B ∥ z', new T.Vector3(0, 1.75, 0));
      var cones = new T.Group(); grp.add(cones); var Fv = arrow(new T.Vector3(1, 1, 0), 1, COL.red); grp.add(Fv);
      var mcol = [0x5db3d6, 0x6fd39a, 0xf2c14e, 0xf2a65a, 0xff5468];
      var lad = new T.Group(); st.scene.add(lad);
      var tx = { a: 2.6, b: 4.1, c: 5.8 }, K = 0.17;  // ladder columns and visual energy scale per (g_F m_F B)
      function mkLevels(n, x, offs) { var arr = []; for (var i = 0; i < n; i++) { var l = lineObj([new T.Vector3(x - 0.35, 0, 0), new T.Vector3(x + 0.35, 0, 0)], mcol[(n === 5 ? i : i + 1)], 1); lad.add(l); arr.push(l); } return arr; }
      var L2 = mkLevels(5, tx.a), L1 = mkLevels(3, tx.b), LE = mkLevels(3, tx.c), arrowT = arrow(new T.Vector3(1, 0, 0), 1, COL.violet); lad.add(arrowT);
      var Y2 = 1.0, Y1 = -1.0, YE = 2.6;
      st.label('5S₁/₂ F=2', new T.Vector3(tx.a, Y2 + 0.95, 0)); st.label('5S₁/₂ F=1', new T.Vector3(tx.b, Y1 - 0.95, 0)); st.label('5P₁/₂ F′=1', new T.Vector3(tx.c, YE + 0.9, 0));
      function setLine(l, x, y) { var q = l.geometry.attributes.position; q.setXYZ(0, x - 0.35, y, 0); q.setXYZ(1, x + 0.35, y, 0); q.needsUpdate = true; }
      var ang = 0, lastKey = '';
      function rebuildCones(F, m) {
        while (cones.children.length) { var c0 = cones.children[0]; cones.remove(c0); c0.geometry.dispose(); }
        var Fm = Math.sqrt(F * (F + 1));
        for (var q = -F; q <= F; q++) { var r2 = Math.sqrt(Math.max(0, F * (F + 1) - q * q)) / Fm; var c = circle(r2, 'xz', mcol[q + 2], q === m ? 1 : 0.3); c.position.y = q / Fm; cones.add(c); }
      }
      st.tick.push(function (dt) {
        var F = +ui.v.F, m = Math.max(-F, Math.min(F, Math.round(ui.v.m))), g = F === 2 ? 0.5 : -0.5, B = ui.v.B, sh = 1.39962449;  // MHz per gauss per unit g_F m_F
        if (m !== ui.v.m) msel.set(m);
        var key = F + ':' + m; if (key !== lastKey) { rebuildCones(F, m); lastKey = key; }
        for (var j = 0; j < 5; j++) setLine(L2[j], tx.a, Y2 + 0.5 * (j - 2) * B * K);
        for (j = 0; j < 3; j++) setLine(L1[j], tx.b, Y1 - 0.5 * (j - 1) * B * K);
        for (j = 0; j < 3; j++) setLine(LE[j], tx.c, YE - (1 / 6) * (j - 1) * B * K);
        ang += dt * (ui.v.prec ? Math.abs(g) * B * 1.2 + 0.4 : 0) * (g > 0 ? 1 : -1);
        var Fm = Math.sqrt(F * (F + 1)), rr = Math.sqrt(Math.max(0, F * (F + 1) - m * m)) / Fm, yy = m / Fm;
        Fv.setDirection(new T.Vector3(rr * Math.cos(ang), yy, rr * Math.sin(ang)).normalize()); Fv.setLength(1.0, 0.16, 0.07);
        var q2 = ui.v.pol === 'sp' ? 1 : ui.v.pol === 'sm' ? -1 : 0, ok = F === 2 && Math.abs(m + q2) <= 1;
        arrowT.visible = ok;
        if (ok) { var from = new T.Vector3(tx.a + 0.38, Y2 + 0.5 * m * B * K, 0), to = new T.Vector3(tx.c - 0.38, YE - (1 / 6) * (m + q2) * B * K, 0), d = to.clone().sub(from); arrowT.position.copy(from); arrowT.setDirection(d.clone().normalize()); arrowT.setLength(d.length(), 0.18, 0.08); }
        var shift = g * m * sh * B, lar = Math.abs(g) * sh * B;
        var msg = F !== 2 ? 'The D1 arrow is drawn for F = 2 only (the Method A scheme).' : ok ? 'This light drives <b>m_F = ' + m + ' → m_F′ = ' + (m + q2) + '</b> (F = 2 → F′ = 1): allowed.' : '<b style="color:#ff8a8a">m_F = ' + m + ' with ' + (q2 > 0 ? 'σ⁺' : q2 < 0 ? 'σ⁻' : 'π') + ' light is dark on F = 2 → F′ = 1</b>: it would need m_F′ = ' + (m + q2) + ', which F′ = 1 does not have (|m_F′| ≤ 1). That is why σ⁺ light pumps atoms toward the high-m_F end of F = 2.';
        out.innerHTML = 'g_F = <b>' + (g > 0 ? '+' : '−') + '½</b> → Zeeman shift of this sublevel = g_F m_F μ_B B/h = <b>' + fmt(shift, 3) + ' MHz</b> at B = ' + fmt(B, 2) + ' G.<br>Larmor precession frequency |g_F| μ_B B/h = <b>' + fmt(lar, 3) + ' MHz</b> (vector model: F precesses about B).<br>Splitting between m_F = +2 and 0 in F = 2: 2 × 0.70 kHz/mG × B = <b>' + fmt(1.40 * B * 1000, 0) + ' kHz</b> at this field: the two-photon resonance of Method A.<br>' + msg + '<br><small>Ladder heights are exaggerated and not to scale (the optical gap is ~377 THz; F′ = 1 has g_F = −1/6).</small>';
      });
    }
  };

  /* ---------- L6: complex susceptibility ribbon (Kramers-Kronig) ---------- */
  SCENES['kk'] = {
    opts: { cam: [4.2, 3.2, 9.2], target: [0, 0.2, 0.8], maxDist: 22 },
    build: function (st, ui) {
      var Oc = ui.range('Oc', 'Control Rabi frequency Ω_c (in units of γ₁₃)', 0, 3, 0.05, 1.2, function (x) { return fmt(x, 2); });
      ui.range('g12', 'Ground decoherence γ₁₂ (in units of γ₁₃)', 0.005, 0.5, 0.005, 0.03, function (x) { return fmt(x, 3); });
      ui.range('mk', 'Marker detuning Δ/γ₁₃', -4, 4, 0.02, 0.4, function (x) { return fmt(x, 2); });
      ui.check('proj', 'Show projections (absorption and dispersion curves)', true);
      var out = ui.readout();
      var X0 = 4, N = 401, gr = new T.Group(); st.scene.add(gr);
      gr.add(lineObj([new T.Vector3(-X0 - 0.3, 0, 0), new T.Vector3(X0 + 0.3, 0, 0)], COL.grey, 0.8)); gr.add(lineObj([new T.Vector3(0, -1.3, 0), new T.Vector3(0, 1.3, 0)], COL.grey, 0.4)); gr.add(lineObj([new T.Vector3(0, 0, -0.3), new T.Vector3(0, 0, 2.4)], COL.grey, 0.4));
      st.label('Δ (detuning)', new T.Vector3(X0 + 0.7, 0, 0)); st.label('χ′  (dispersion, n)', new T.Vector3(0, 1.45, 0), 'b'); st.label('χ″  (absorption)', new T.Vector3(0, 0, 2.6), 'e');
      var curve = new T.Line(new T.BufferGeometry().setFromPoints(new Array(N).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.yellow })); gr.add(curve);
      var fins = new T.LineSegments(new T.BufferGeometry().setFromPoints(new Array(80 * 2).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.violet, transparent: true, opacity: 0.4 })); gr.add(fins);
      var pAbs = new T.Line(new T.BufferGeometry().setFromPoints(new Array(N).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.red, transparent: true, opacity: 0.8 }));
      var pDis = new T.Line(new T.BufferGeometry().setFromPoints(new Array(N).fill(0).map(function () { return new T.Vector3(); })), new T.LineBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.8 })); gr.add(pAbs); gr.add(pDis);
      var m = dot(COL.green, 0.07); gr.add(m);
      function chi(D, Ocv, g12) { // i (g12 - iΔ) / [ (1 - iΔ)(g12 - iΔ) + Ωc²/4 ] ; with Ωc = 0 reduces to i/(1 - iΔ)
        var a = { re: g12, im: -D }, b = { re: 1, im: -D };
        var den = { re: b.re * a.re - b.im * a.im + Ocv * Ocv / 4, im: b.re * a.im + b.im * a.re };
        var num = { re: -a.im, im: a.re }; // i * a
        var d2 = den.re * den.re + den.im * den.im; return { re: (num.re * den.re + num.im * den.im) / d2, im: (num.im * den.re - num.re * den.im) / d2 };
      }
      function upd() {
        var O = ui.v.Oc, g12 = ui.v.g12, pc = curve.geometry.attributes.position, pa = pAbs.geometry.attributes.position, pd = pDis.geometry.attributes.position;
        for (var i = 0; i < N; i++) { var D = -X0 + 2 * X0 * i / (N - 1), c = chi(D, O, O === 0 ? 1 : g12); var y = c.re * 1.2, z = c.im * 1.2; pc.setXYZ(i, D, y, z); pa.setXYZ(i, D, -1.3, z); pd.setXYZ(i, D, y, -0.3); }
        pc.needsUpdate = true; pa.needsUpdate = true; pd.needsUpdate = true; pAbs.visible = pDis.visible = ui.v.proj;
        var pf = fins.geometry.attributes.position; for (var j = 0; j < 80; j++) { var Dj = -X0 + 2 * X0 * j / 79, cj = chi(Dj, O, O === 0 ? 1 : g12); pf.setXYZ(2 * j, Dj, 0, 0); pf.setXYZ(2 * j + 1, Dj, cj.re * 1.2, cj.im * 1.2); } pf.needsUpdate = true;
        var Dm = ui.v.mk, cm = chi(Dm, O, O === 0 ? 1 : g12); m.position.set(Dm, cm.re * 1.2, cm.im * 1.2);
        var dD = 1e-3, c1 = chi(dD, O, O === 0 ? 1 : g12), c0 = chi(-dD, O, O === 0 ? 1 : g12), slope = (c1.re - c0.re) / (2 * dD), c00 = chi(0, O, O === 0 ? 1 : g12);
        out.innerHTML = 'At the marker: χ′ = <b>' + fmt(cm.re, 3) + '</b> (n − 1 ≈ χ′/2 in arbitrary units), χ″ = <b>' + fmt(cm.im, 3) + '</b>.<br>At Δ = 0: absorption χ″ = <b>' + fmt(c00.im, 3) + '</b> (1 for a plain absorber), slope dχ′/dΔ = <b>' + fmt(slope, 2) + '</b> (−1 for a plain absorber).<br>' + (O === 0 ? 'Ω_c = 0: a plain two-level absorber. The absorption peak and the S-shaped dispersion are two views of one helix (Kramers–Kronig).' : 'With the control on, absorption is carved away at line centre while the dispersion becomes <b>steep and positive</b> there: slope ≈ ' + fmt(slope, 1) + ' (compare −1 for the plain absorber: the sign is reversed, from anomalous to normal dispersion).') + '<br><small>Formula: χ ∝ i(γ₁₂ − iΔ) / [(γ₁₃ − iΔ)(γ₁₂ − iΔ) + Ω_c²/4], units of γ₁₃ = 1, resonant control.</small>';
      }
      ui.onChange = upd; upd(); st.tick.push(function () { });
    }
  };

  /* ---------- L7: dark and bright states in the ground-state plane ---------- */
  SCENES['dark'] = {
    opts: { cam: [3.6, 2.6, 4.8], target: [0.1, 0.2, 0.2], maxDist: 12 },
    build: function (st, ui) {
      var Op = ui.range('Op', 'Probe Rabi frequency Ω_p', 0.02, 2, 0.02, 0.3, function (x) { return fmt(x, 2); });
      var Oc = ui.range('Oc', 'Control Rabi frequency Ω_c', 0.02, 3, 0.02, 1.4, function (x) { return fmt(x, 2); });
      var anim = { mode: 0, t: 0 };
      ui.buttons([['Store: ramp control to zero', function () { anim.mode = 1; }], ['Retrieve: ramp control back', function () { anim.mode = 2; }]]);
      var out = ui.readout();
      var sc = st.scene;
      var X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, -1), Y = new T.Vector3(0, 1, 0);
      sc.add(lineObj([X.clone().multiplyScalar(-1.3), X.clone().multiplyScalar(1.3)], COL.grey, 0.7)); sc.add(lineObj([Z.clone().multiplyScalar(-1.3), Z.clone().multiplyScalar(1.3)], COL.grey, 0.7)); sc.add(lineObj([Y.clone().multiplyScalar(-0.2), Y.clone().multiplyScalar(1.3)], COL.grey, 0.7));
      var plane = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ color: 0x1d3a47, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false })); plane.rotation.x = -Math.PI / 2; sc.add(plane);
      sc.add(circle(1, 'xz', COL.grid, 0.8));
      st.label('|1⟩ probe', new T.Vector3(1.55, 0, 0)); st.label('|2⟩ control', new T.Vector3(0, 0, -1.65)); st.label('|3⟩ excited', new T.Vector3(0, 1.45, 0));
      var D = arrow(new T.Vector3(1, 0, 0), 1, COL.blue, { hw: 0.07 }), B = arrow(new T.Vector3(0, 0, -1), 1, COL.orange, { hw: 0.07 }); sc.add(D); sc.add(B);
      var dl = st.label('dark |D⟩', new T.Vector3(1, 0.2, 0), 'e'), bl = st.label('bright |B⟩', new T.Vector3(0, 0.2, -1), 'b');
      var arcPts = new Array(40).fill(0).map(function () { return new T.Vector3(); }); var arc = new T.Line(new T.BufferGeometry().setFromPoints(arcPts), new T.LineBasicMaterial({ color: COL.green })); sc.add(arc);
      var bar1 = new T.Mesh(new T.BoxGeometry(0.12, 1, 0.12), new T.MeshBasicMaterial({ color: COL.blue })), bar2 = new T.Mesh(new T.BoxGeometry(0.12, 1, 0.12), new T.MeshBasicMaterial({ color: COL.orange })), bar3 = new T.Mesh(new T.BoxGeometry(0.12, 1, 0.12), new T.MeshBasicMaterial({ color: COL.red }));
      bar1.position.set(-1.45, 0, 1.2); bar2.position.set(-1.25, 0, 1.2); bar3.position.set(-1.05, 0, 1.2); sc.add(bar1); sc.add(bar2); sc.add(bar3);
      st.label('populations |1⟩ |2⟩ |3⟩', new T.Vector3(-1.25, 1.2, 1.2));
      var scale = { c: 1.4 };
      st.tick.push(function (dt) {
        if (anim.mode === 1) { ui.v.Oc = Math.max(0.02, ui.v.Oc - dt * 1.0); Oc.set(ui.v.Oc); if (ui.v.Oc <= 0.021) anim.mode = 0; }
        if (anim.mode === 2) { ui.v.Oc = Math.min(1.4, ui.v.Oc + dt * 1.0); Oc.set(ui.v.Oc); if (ui.v.Oc >= 1.399) anim.mode = 0; }
        var p = ui.v.Op, c = ui.v.Oc, O0 = Math.sqrt(p * p + c * c), th = Math.atan2(p, c);
        // |D> = cosθ|1> − sinθ|2>, |B> = sinθ|1> + cosθ|2>
        var d = new T.Vector3(Math.cos(th), 0, Math.sin(th)), b = new T.Vector3(Math.sin(th), 0, -Math.cos(th));  // z axis drawn as -|2>
        setArrow(D, d, 1e-3); setArrow(B, b, 1e-3); dl.pos.copy(d).multiplyScalar(1.12).setY(0.18); bl.pos.copy(b).multiplyScalar(1.12).setY(0.18);
        var ap = arc.geometry.attributes.position; for (var i = 0; i < 40; i++) { var a = th * i / 39; ap.setXYZ(i, 0.35 * Math.cos(a), 0, 0.35 * Math.sin(a)); } ap.needsUpdate = true;
        var P1 = Math.cos(th) * Math.cos(th), P2 = Math.sin(th) * Math.sin(th);
        bar1.scale.y = Math.max(1e-3, P1); bar1.position.y = P1 / 2; bar2.scale.y = Math.max(1e-3, P2); bar2.position.y = P2 / 2; bar3.scale.y = 1e-3; bar3.position.y = 0;
        out.innerHTML = 'Dark state: |D⟩ = (Ω_c|1⟩ − Ω_p|2⟩)/√(Ω_p²+Ω_c²) = cos θ |1⟩ − sin θ |2⟩ with tan θ = Ω_p/Ω_c → θ = <b>' + fmt(th / DEG, 1) + '°</b>.<br>Populations: |1⟩ <b>' + fmt(P1, 3) + '</b>, |2⟩ <b>' + fmt(P2, 3) + '</b>, |3⟩ <b>0</b>: the dark state never populates |3⟩, so it cannot scatter or absorb.<br>The bright state |B⟩ is the one that couples to |3⟩ with Ω₀ = √(Ω_p²+Ω_c²) = <b>' + fmt(O0, 2) + '</b>.<br>Press <b>Store</b>: as Ω_c → 0, θ → 90° and |D⟩ rotates from |1⟩ to −|2⟩. The excitation, which started as a light field coupled to |1⟩, is now purely in the ground-state coherence: the stored light.<br><small>For a quantum probe, replace Ω_p by g√N: tan θ = g√N/Ω_c (the polariton mixing angle of L8).</small>';
      });
    }
  };

  /* ---------- L8: slow, stopped and retrieved light ---------- */
  SCENES['slow'] = {
    opts: { cam: [7, 6.2, 15], target: [7, 0, 0], maxDist: 40 },
    build: function (st, ui) {
      ui.range('vg', 'Group velocity v_g / c with control ON', 0.05, 0.5, 0.01, 0.2, function (x) { return fmt(x, 2); });
      ui.range('lw', 'Pulse length in vacuum (display units)', 1, 3, 0.1, 2, function (x) { return fmt(x, 1); });
      ui.range('gam', 'Spin-wave decay γ₁₂ (per display second)', 0, 0.6, 0.01, 0.1, function (x) { return fmt(x, 2); });
      var M = 700, Ltot = 14, cd = 4, dx = Ltot / M, n = new Float32Array(M), fl = new Float32Array(M + 1);
      var m0 = Ltot * 0.285, m1 = Ltot * 0.715, sim = { u: 1, target: 1, inj: false, tinj: 0, seq: 0, hold: 0, N0: 0 };
      function reset() { n.fill(0); sim.u = 1; sim.target = 1; sim.inj = false; sim.seq = 0; sim.N0 = 0; }
      function send() { sim.inj = true; sim.tinj = 0; }
      ui.buttons([['Send pulse', function () { reset(); send(); }], ['Control OFF (store)', function () { sim.target = 0; }], ['Control ON (retrieve)', function () { sim.target = 1; }], ['Auto: store, hold, retrieve', function () { reset(); send(); sim.seq = 1; }], ['Clear', reset]]);
      var out = ui.readout();
      var med = new T.Mesh(new T.BoxGeometry(m1 - m0, 1.9, 1.4), new T.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.12, depthWrite: false })); med.position.set((m0 + m1) / 2, 0, 0); st.scene.add(med);
      var medE = new T.LineSegments(new T.EdgesGeometry(med.geometry), new T.LineBasicMaterial({ color: COL.violet, transparent: true, opacity: 0.8 })); medE.position.copy(med.position); st.scene.add(medE);
      st.scene.add(lineObj([new T.Vector3(0, 0, 0), new T.Vector3(Ltot, 0, 0)], COL.grey, 0.7));
      st.label('atomic vapour (EIT medium)', new T.Vector3((m0 + m1) / 2, 1.35, 0)); st.label('light in →', new T.Vector3(1.0, 0.6, 0)); st.label('→ light out', new T.Vector3(Ltot - 1.0, 0.6, 0));
      var lightG = new T.BufferGeometry(), spinG = new T.BufferGeometry(), lp = new Float32Array(M * 2 * 3), sp = new Float32Array(M * 2 * 3);
      lightG.setAttribute('position', new T.BufferAttribute(lp, 3)); spinG.setAttribute('position', new T.BufferAttribute(sp, 3));
      st.scene.add(new T.LineSegments(lightG, new T.LineBasicMaterial({ color: COL.red }))); st.scene.add(new T.LineSegments(spinG, new T.LineBasicMaterial({ color: COL.blue })));
      st.label('light (cos θ)', new T.Vector3(Ltot * 0.93, 1.1, 0), 'e'); st.label('spin wave (sin θ)', new T.Vector3(Ltot * 0.93, -1.1, 0), 'b');
      var ctrl = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshBasicMaterial({ color: COL.green })); ctrl.position.set((m0 + m1) / 2, 2.0, 0); st.scene.add(ctrl); st.label('control beam', new T.Vector3((m0 + m1) / 2, 2.5, 0));
      function lim(r) { return r <= 0 ? 0 : (2 * r) / (1 + r); }   // van Leer flux limiter
      st.tick.push(function (dt) {
        var vg = ui.v.vg, G2 = (1 - vg) / vg;
        sim.u += (sim.target - sim.u) * Math.min(1, dt * 5);
        var cos2 = sim.u / (sim.u + G2), sin2 = 1 - cos2, steps = Math.max(1, Math.ceil(cd * dt / dx / 0.8)), hh = dt / steps;
        for (var s2 = 0; s2 < steps; s2++) {
          if (sim.inj) { sim.tinj += hh; var sg = ui.v.lw / 2.6 / cd, t0 = 3 * sg, a = Math.exp(-0.5 * Math.pow((sim.tinj - t0) / sg, 2)); n[0] = a * a * 0.5 + n[0] * 0.5; if (sim.tinj > 7 * sg) sim.inj = false; }
          fl[0] = cd * n[0];
          for (var i = 0; i < M; i++) {
            var x = (i + 0.5) * dx, v = (x >= m0 && x <= m1) ? cd * cos2 : cd, cfl = v * hh / dx;
            var dn = n[i] - (i > 0 ? n[i - 1] : 0), dn2 = (i < M - 1 ? n[i + 1] : n[i]) - n[i];
            var slope = lim(Math.abs(dn2) > 1e-12 ? dn / dn2 : 0) * dn2;   // limited slope in cell i
            fl[i + 1] = v * (n[i] + 0.5 * (1 - cfl) * slope);
          }
          for (i = 0; i < M; i++) { n[i] = Math.max(0, n[i] - hh / dx * (fl[i + 1] - fl[i])); var xx = (i + 0.5) * dx; if (xx >= m0 && xx <= m1) n[i] *= Math.exp(-2 * ui.v.gam * sin2 * hh); }
        }
        var lg = lightG.attributes.position, sg3 = spinG.attributes.position, tot = 0, inMed = 0, outP = 0;
        for (var j = 0; j < M; j++) {
          var xj = (j + 0.5) * dx, inM = xj >= m0 && xj <= m1, cs = inM ? cos2 : 1, ss = inM ? sin2 : 0, amp = Math.sqrt(n[j]);
          lg.setXYZ(2 * j, xj, 0, 0); lg.setXYZ(2 * j + 1, xj, amp * Math.sqrt(cs) * 1.1, 0); sg3.setXYZ(2 * j, xj, 0, 0); sg3.setXYZ(2 * j + 1, xj, -amp * Math.sqrt(ss) * 1.1, 0);
          tot += n[j] * dx; if (inM) inMed += n[j] * dx; if (xj > m1) outP += n[j] * dx;
        }
        lg.needsUpdate = true; sg3.needsUpdate = true;
        ctrl.scale.setScalar(0.2 + 0.8 * sim.u); ctrl.material.color.setHex(sim.u > 0.5 ? COL.green : COL.grey);
        if (!sim.inj && tot > sim.N0) sim.N0 = tot;
        if (sim.seq === 1 && !sim.inj && tot > 1e-3 && inMed > 0.985 * tot) { sim.target = 0; sim.seq = 2; sim.hold = 0; }
        else if (sim.seq === 2) { sim.hold += dt; if (sim.hold > 2.5) { sim.target = 1; sim.seq = 3; } }
        var N0 = Math.max(sim.N0, 1e-6), th = Math.atan2(Math.sqrt(sin2), Math.sqrt(cos2)) / DEG;
        out.innerHTML = 'Pulse length in the medium = vacuum length × v_g/c = ' + fmt(ui.v.lw, 1) + ' × ' + fmt(vg, 2) + ' = <b>' + fmt(ui.v.lw * vg, 2) + '</b> display units: <b>compressed ' + fmt(1 / vg, 1) + '×</b> (real vapour: ~10⁵ to 10⁶ times).<br>Control level <b>' + fmt(sim.u, 2) + '</b> → mixing angle θ = <b>' + fmt(th, 0) + '°</b>. With the control OFF, θ → 90°: all of the excitation is atomic spin wave (blue, below the axis) and v_g → 0.<br>Excitation inside the medium: <b>' + fmt(inMed / N0 * 100, 0) + ' %</b> of the pulse. Already delivered past the medium: <b>' + fmt(outP / N0 * 100, 0) + ' %</b>.<br>Try it: send a pulse, press Control OFF while it is completely inside, wait, then Control ON. Raise γ₁₂ and the retrieved pulse shrinks. Switch off too early or too late and part of the pulse is lost.<br><small>Dark-state polariton model: ∂ₜn + ∂ₓ(v n) = 0 for the excitation density n, with v = c in vacuum and v_g = c cos²θ in the medium, tan²θ = g²N/Ω_c². Display units, not to scale.</small>';
      });
    }
  };

  /* ---------- L11: Wigner functions ---------- */
  SCENES['wigner'] = {
    opts: { cam: [4.8, 3.8, 6.4], target: [0, 0.2, 0.8], maxDist: 18 },
    build: function (st, ui) {
      var sel = ui.select('st', 'State', [['coh', 'coherent state |α⟩ (laser)'], ['fock', 'Fock state |n⟩ (n photons)'], ['th', 'thermal state (mean n̄)'], ['sq', 'squeezed vacuum']], 'coh');
      ui.range('al', 'Coherent amplitude |α|', 0, 3, 0.05, 1.5, function (x) { return fmt(x, 2); });
      ui.range('ph', 'Coherent phase arg α', 0, 360, 5, 45, function (x) { return fmt(x, 0) + '°'; });
      ui.range('n', 'Fock number n', 0, 5, 1, 1, function (x) { return fmt(x, 0); });
      ui.range('nb', 'Thermal mean n̄', 0.1, 4, 0.1, 1, function (x) { return fmt(x, 1); });
      ui.range('r', 'Squeezing r', 0, 1.5, 0.05, 0.7, function (x) { return fmt(x, 2); });
      var out = ui.readout(), R = 3.2, NG = 90;
      var geo = new T.PlaneGeometry(2 * R, 2 * R, NG - 1, NG - 1); geo.rotateX(-Math.PI / 2);
      var colors = new Float32Array(NG * NG * 3); geo.setAttribute('color', new T.BufferAttribute(colors, 3));
      var mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })), wire = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.12 })); st.scene.add(mesh); st.scene.add(wire);
      st.scene.add(lineObj([new T.Vector3(-R - 0.2, 0, 0), new T.Vector3(R + 0.2, 0, 0)], COL.grey, 0.8)); st.scene.add(lineObj([new T.Vector3(0, 0, -R - 0.2), new T.Vector3(0, 0, R + 0.2)], COL.grey, 0.8));
      st.label('x (amplitude quadrature)', new T.Vector3(R + 0.5, 0, 0)); st.label('p (phase quadrature)', new T.Vector3(0, 0, -R - 0.5)); st.label('W', new T.Vector3(0, 1.3, 0));
      var bars = new T.Group(); st.scene.add(bars); var barM = [], i;
      for (i = 0; i <= 10; i++) { var b = new T.Mesh(new T.BoxGeometry(0.2, 1, 0.2), new T.MeshBasicMaterial({ color: COL.yellow })); b.position.set(-R + 0.5 + i * 0.28, 0, R + 1.2); bars.add(b); barM.push(b); }
      st.label('photon number distribution P(n), n = 0…10', new T.Vector3(-R + 1.9, 1.4, R + 1.2));
      function lag(n, x) { var a = 1, b = 1 - x; if (n === 0) return 1; if (n === 1) return b; var l0 = 1, l1 = 1 - x; for (var k = 1; k < n; k++) { var l2 = ((2 * k + 1 - x) * l1 - k * l0) / (k + 1); l0 = l1; l1 = l2; } return l1; }
      function W(x, p) {
        var s = ui.v.st;
        if (s === 'coh') { var a = ui.v.al, ph = ui.v.ph * DEG, x0 = Math.SQRT2 * a * Math.cos(ph), p0 = Math.SQRT2 * a * Math.sin(ph); return Math.exp(-((x - x0) * (x - x0) + (p - p0) * (p - p0))) / Math.PI; }
        if (s === 'fock') { var n = ui.v.n, r2 = x * x + p * p; return (n % 2 ? -1 : 1) / Math.PI * Math.exp(-r2) * lag(n, 2 * r2) * 1; }
        if (s === 'th') { var v = ui.v.nb + 0.5; return Math.exp(-(x * x + p * p) / (2 * v)) / (2 * Math.PI * v); }
        var r = ui.v.r; return Math.exp(-(x * x * Math.exp(2 * r) + p * p * Math.exp(-2 * r))) / Math.PI;
      }
      function fact(n) { var f = 1; for (var k = 2; k <= n; k++) f *= k; return f; }
      function Pn(n) {
        var s = ui.v.st;
        if (s === 'coh') { var m = ui.v.al * ui.v.al; return Math.exp(-m) * Math.pow(m, n) / fact(n); }
        if (s === 'fock') return n === ui.v.n ? 1 : 0;
        if (s === 'th') { var nb = ui.v.nb; return Math.pow(nb, n) / Math.pow(1 + nb, n + 1); }
        var r = ui.v.r; if (n % 2) return 0; var mm = n / 2; return fact(n) / (Math.pow(2, n) * fact(mm) * fact(mm)) * Math.pow(Math.tanh(r), n) / Math.cosh(r);
      }
      function upd() {
        var pos = geo.attributes.position, col = geo.attributes.color, wmin = 1e9, wmax = -1e9, k = 0;
        for (var j = 0; j < NG; j++) for (var i2 = 0; i2 < NG; i2++, k++) {
          var x = pos.getX(k), p = pos.getZ(k), w = W(x, p); wmin = Math.min(wmin, w); wmax = Math.max(wmax, w); pos.setY(k, w * 3.2);
          if (w >= 0) { var t = Math.min(1, w / 0.32); col.setXYZ(k, 0.25 + 0.75 * t, 0.2 + 0.45 * t, 0.15); } else { var u = Math.min(1, -w / 0.32); col.setXYZ(k, 0.1, 0.35 + 0.4 * u, 0.9); }
        }
        pos.needsUpdate = true; col.needsUpdate = true; geo.computeVertexNormals();
        var mean = 0, m2 = 0; for (i = 0; i <= 60; i++) { var pp = Pn(i); mean += i * pp; m2 += i * (i - 1) * pp; }
        for (i = 0; i <= 10; i++) { var pv = Pn(i); barM[i].scale.y = Math.max(1e-3, pv * 1.6); barM[i].position.y = pv * 0.8; }
        var g2 = mean > 1e-9 ? m2 / (mean * mean) : NaN, s = ui.v.st;
        out.innerHTML = '⟨n⟩ = <b>' + fmt(mean, 2) + '</b>, g⁽²⁾(0) = <b>' + (isNaN(g2) ? '—' : fmt(g2, 2)) + '</b>, most negative W = <b>' + fmt(wmin, 3) + '</b>.<br>' + { coh: 'Coherent: a vacuum-sized Gaussian blob displaced to |α|; Poissonian photon numbers, g⁽²⁾ = 1. Rotating the phase just moves the blob around a circle.', fock: 'Fock |n⟩: rings, and for odd n a <b>negative</b> region at the centre (blue). No classical probability distribution can do that: the signature of a non-classical state. n = 1 gives g⁽²⁾ → 0.', th: 'Thermal: a broad Gaussian centred on zero (phase completely random), g⁽²⁾ = 2.', sq: 'Squeezed vacuum: the blob is narrower than vacuum along one quadrature and wider along the other; photons come in pairs (only even n), so g⁽²⁾ = 3 + 1/⟨n⟩.' }[s] + '<br><small>Convention: vacuum has variance ½ per quadrature; W(0,0) = 1/π for vacuum. Height scaled ×3.2.</small>';
      }
      ui.onChange = upd; upd(); st.tick.push(function () { });
    }
  };

  /* ---------- L12: avoided crossing / polariton branches ---------- */
  SCENES['avoided'] = {
    opts: { cam: [4.4, 3.2, 5.6], target: [0, 0, 0], maxDist: 16 },
    build: function (st, ui) {
      ui.range('g', 'Coupling g (arb.)', 0, 1.2, 0.02, 0.5, function (x) { return fmt(x, 2); });
      ui.range('ka', 'Cavity loss κ', 0.02, 1.5, 0.02, 0.2, function (x) { return fmt(x, 2); });
      ui.range('ga', 'Emitter decay γ', 0.02, 1.5, 0.02, 0.2, function (x) { return fmt(x, 2); });
      var out = ui.readout(), NX = 70, NZ = 40, DX = 2.2, GM = 1.2;
      function surf(sign) {
        var geo = new T.PlaneGeometry(2 * DX, GM, NX - 1, NZ - 1); geo.rotateX(-Math.PI / 2); var cols = new Float32Array(NX * NZ * 3); geo.setAttribute('color', new T.BufferAttribute(cols, 3));
        var m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: 0.8 })); st.scene.add(m); m.userData.sign = sign;
        var pos = geo.attributes.position, k = 0; for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++, k++) {
          var D = -DX + 2 * DX * i / (NX - 1), g = j / (NZ - 1) * GM, root = Math.sqrt(D * D + 4 * g * g), E = sign * 0.5 * root, pf = 0.5 * (1 + sign * D / (root || 1));
          pos.setXYZ(k, D, E, g - GM / 2); cols[3 * k] = 0.2 + 0.8 * pf; cols[3 * k + 1] = 0.35 + 0.1 * pf; cols[3 * k + 2] = 1 - 0.85 * pf;
        }
        pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; return m;
      }
      surf(+1); surf(-1);
      st.scene.add(lineObj([new T.Vector3(-DX - 0.2, 0, 0), new T.Vector3(DX + 0.2, 0, 0)], COL.grey, 0.7)); st.label('detuning Δ = ω_cavity − ω_emitter', new T.Vector3(DX + 0.2, -0.2, 0)); st.label('energy', new T.Vector3(0, 1.45, -0.6)); st.label('coupling g →', new T.Vector3(-DX - 0.1, 0, GM / 2 + 0.1));
      st.label('upper polariton', new T.Vector3(DX * 0.7, 1.35, 0), 'e'); st.label('lower polariton', new T.Vector3(DX * 0.7, -1.35, 0), 'b');
      var sl = lineObj(new Array(80).fill(0).map(function () { return new T.Vector3(); }), COL.yellow, 1), sl2 = lineObj(new Array(80).fill(0).map(function () { return new T.Vector3(); }), COL.yellow, 1); st.scene.add(sl); st.scene.add(sl2);
      var u1 = lineObj([new T.Vector3(-DX, -DX / 2, -GM / 2), new T.Vector3(DX, DX / 2, -GM / 2)], COL.grey, 0.8, true), u2 = lineObj([new T.Vector3(-DX, DX / 2, -GM / 2), new T.Vector3(DX, -DX / 2, -GM / 2)], COL.grey, 0.8, true); st.scene.add(u1); st.scene.add(u2);
      st.label('uncoupled: g = 0', new T.Vector3(-DX * 0.85, -DX / 2 - 0.15, -GM / 2));
      function upd() {
        var g = ui.v.g, pa = sl.geometry.attributes.position, pb = sl2.geometry.attributes.position;
        for (var i = 0; i < 80; i++) { var D = -DX + 2 * DX * i / 79, root = Math.sqrt(D * D + 4 * g * g); pa.setXYZ(i, D, 0.5 * root, g - GM / 2); pb.setXYZ(i, D, -0.5 * root, g - GM / 2); } pa.needsUpdate = true; pb.needsUpdate = true;
        var ka = ui.v.ka, ga = ui.v.ga, C = 4 * g * g / (ka * ga), strong = g > ka && g > ga;
        out.innerHTML = 'Yellow curves: the two polariton branches at the chosen g. At Δ = 0 the splitting is <b>2g = ' + fmt(2 * g, 2) + '</b> (vacuum Rabi splitting).<br>g/κ = <b>' + fmt(g / ka, 2) + '</b>, g/γ = <b>' + fmt(g / ga, 2) + '</b>, cooperativity C = 4g²/(κγ) = <b>' + fmt(C, 1) + '</b>.<br>' + (strong ? '<b style="color:#6fd39a">Strong coupling (g > κ, γ):</b> the splitting beats both losses, so the two peaks are resolved and energy oscillates back and forth.' : '<b style="color:#ffb86b">Weak coupling (g < κ or γ):</b> the avoided crossing exists, but the lines are too broad to show two resolved peaks.') + '<br>Colour: red = photon-like, blue = emitter-like (Hopfield fractions). For N emitters replace g by g√N.<br><small>Lossless two-mode model: E± = ½(ω_c+ω_x) ± ½√(Δ²+4g²). Display units.</small>';
      }
      ui.onChange = upd; upd(); st.tick.push(function () { });
    }
  };

  /* ---------- L13: Poincare sphere and waveplates ---------- */
  SCENES['poincare'] = {
    opts: { cam: [3.8, 2.4, 6.0], target: [1.0, -0.2, 0], maxDist: 14 },
    build: function (st, ui) {
      ui.select('in', 'Input polarization', [['H', 'H (horizontal)'], ['V', 'V (vertical)'], ['D', 'D (+45°)'], ['A', 'A (−45°)'], ['sp', 'σ⁺ (circular)'], ['sm', 'σ⁻ (circular)']], 'H');
      ui.range('hw', 'Half-wave plate angle θ₁', -90, 90, 0.5, 0, function (x) { return fmt(x, 1) + '°'; });
      ui.range('qw', 'Quarter-wave plate angle θ₂', -90, 90, 0.5, 45, function (x) { return fmt(x, 1) + '°'; });
      ui.check('orth', 'Also show the orthogonal polarization (e.g. the other arm of Method A)', true);
      ui.check('sweep', 'Trace the sweep of the quarter-wave plate angle', true);
      var out = ui.readout();
      st.scene.add(sphereWire(1));
      [[new T.Vector3(-1.4, 0, 0), new T.Vector3(1.4, 0, 0)], [new T.Vector3(0, -1.4, 0), new T.Vector3(0, 1.4, 0)], [new T.Vector3(0, 0, -1.4), new T.Vector3(0, 0, 1.4)]].forEach(function (a) { st.scene.add(lineObj(a, COL.grey, 0.5)); });
      // S1 -> x, S3 -> y (up), S2 -> -z
      function Pt(s) { return new T.Vector3(s[0], s[2], -s[1]); }
      st.label('H', new T.Vector3(1.5, 0, 0)); st.label('V', new T.Vector3(-1.5, 0, 0)); st.label('σ⁺', new T.Vector3(0, 1.5, 0)); st.label('σ⁻', new T.Vector3(0, -1.5, 0)); st.label('D', new T.Vector3(0, 0, -1.5)); st.label('A', new T.Vector3(0, 0, 1.5));
      var a = dot(COL.red, 0.07), b = dot(COL.blue, 0.06), mid = dot(COL.yellow, 0.05); st.scene.add(a); st.scene.add(b); st.scene.add(mid);
      var la = st.label('output', new T.Vector3(), 'e'), lb = st.label('orthogonal', new T.Vector3(), 'b');
      var swp = lineObj(new Array(181).fill(0).map(function () { return new T.Vector3(); }), COL.violet, 0.9); st.scene.add(swp);
      var ell = lineObj(new Array(65).fill(0).map(function () { return new T.Vector3(); }), COL.red, 1); ell.position.set(2.4, -1.0, 0); st.scene.add(ell); st.label('polarization ellipse (E-field tip, beam toward you)', new T.Vector3(2.4, -1.75, 0));
      var ellb = lineObj(new Array(65).fill(0).map(function () { return new T.Vector3(); }), COL.blue, 0.9); ellb.position.set(2.4, -1.0, 0); st.scene.add(ellb);
      function C(re, im) { return { re: re, im: im }; }
      function mul(p, q) { return C(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re); }
      function add(p, q) { return C(p.re + q.re, p.im + q.im); }
      function mv(Mx, v) { return [add(mul(Mx[0][0], v[0]), mul(Mx[0][1], v[1])), add(mul(Mx[1][0], v[0]), mul(Mx[1][1], v[1]))]; }
      function hwp(t) { var c = Math.cos(2 * t), s = Math.sin(2 * t); return [[C(c, 0), C(s, 0)], [C(s, 0), C(-c, 0)]]; }
      function qwp(t) { var c = Math.cos(t), s = Math.sin(t); return [[C(c * c, s * s), C(c * s, -c * s)], [C(c * s, -c * s), C(s * s, c * c)]]; } // R(-t) diag(1,i) R(t)
      function inVec(n) { var q = Math.SQRT1_2; return { H: [C(1, 0), C(0, 0)], V: [C(0, 0), C(1, 0)], D: [C(q, 0), C(q, 0)], A: [C(q, 0), C(-q, 0)], sp: [C(q, 0), C(0, q)], sm: [C(q, 0), C(0, -q)] }[n]; }
      function stokes(v) { var a0 = v[0], b0 = v[1], p = a0.re * a0.re + a0.im * a0.im, q = b0.re * b0.re + b0.im * b0.im; var ab = mul(C(a0.re, -a0.im), b0); return [p - q, 2 * mul(a0, C(b0.re, -b0.im)).re, 2 * ab.im]; }
      function name(s) { var s3 = s[2]; if (Math.abs(s3) > 0.97) return s3 > 0 ? 'circular σ⁺' : 'circular σ⁻'; var ang = 0.5 * Math.atan2(s[1], s[0]) / DEG; if (Math.abs(s3) < 0.03) return 'linear at ' + fmt(ang, 1) + '° from horizontal'; return 'elliptical (ellipse axis at ' + fmt(ang, 1) + '°, S₃ = ' + fmt(s3, 2) + ')'; }
      function setEll(line, v) { var p = line.geometry.attributes.position; for (var i = 0; i <= 64; i++) { var ph = i / 64 * TAU, ey = v[0].re * Math.cos(ph) + v[0].im * Math.sin(ph), ez = v[1].re * Math.cos(ph) + v[1].im * Math.sin(ph); p.setXYZ(i, 0, ey * 0.55, ez * 0.55); } p.needsUpdate = true; }
      function upd() {
        var t1 = ui.v.hw * DEG, t2 = ui.v.qw * DEG, v0 = inVec(ui.v.in), vo = inVec({ H: 'V', V: 'H', D: 'A', A: 'D', sp: 'sm', sm: 'sp' }[ui.v.in]);
        var o1 = mv(qwp(t2), mv(hwp(t1), v0)), o2 = mv(qwp(t2), mv(hwp(t1), vo)), s1 = stokes(o1), s2 = stokes(o2);
        a.position.copy(Pt(s1)); b.position.copy(Pt(s2)); b.visible = ui.v.orth; lb.el.style.visibility = ui.v.orth ? 'visible' : 'hidden';
        la.pos.copy(Pt(s1)).multiplyScalar(1.14); lb.pos.copy(Pt(s2)).multiplyScalar(1.14);
        var mv1 = mv(hwp(t1), v0), sm = stokes(mv1); mid.position.copy(Pt(sm));
        var sp = swp.geometry.attributes.position; for (var i = 0; i <= 180; i++) { var t = (i - 90) * DEG, s = stokes(mv(qwp(t), mv(hwp(t1), v0))); var P = Pt(s); sp.setXYZ(i, P.x, P.y, P.z); } sp.needsUpdate = true; swp.visible = ui.v.sweep;
        setEll(ell, o1); setEll(ellb, o2); ellb.visible = ui.v.orth;
        out.innerHTML = 'Input <b>' + ui.v.in + '</b> → HWP at ' + fmt(ui.v.hw, 1) + '° → QWP at ' + fmt(ui.v.qw, 1) + '°.<br>Yellow dot: after the HWP. Red dot: after the QWP = <b>' + name(s1) + '</b> (S₁, S₂, S₃) = (' + fmt(s1[0]) + ', ' + fmt(s1[1]) + ', ' + fmt(s1[2]) + ').<br>' + (ui.v.orth ? 'Blue dot: the orthogonal input, which stays exactly opposite on the sphere: <b>' + name(s2) + '</b>. With H and V into a QWP at 45° the two come out as opposite circular states, the σ⁺/σ⁻ pair of Method A.<br>' : '') + 'A HWP reflects the sphere through an axis in the equatorial plane at 2θ₁; a QWP rotates it by 90° about the axis at 2θ₂ in the equatorial plane. Sign convention: σ⁺ has S₃ > 0 and E rotating counter-clockwise about the beam direction, as in the wave illustration (L1).';
      }
      ui.onChange = upd; upd(); st.tick.push(function () { });
    }
  };

  /* ---------- L13: Gaussian beam ---------- */
  SCENES['gaussian'] = {
    opts: { cam: [0.0, 3.2, 12.5], target: [0, 0, 0], maxDist: 28 },
    build: function (st, ui) {
      ui.range('w0', 'Waist radius w₀', 0.1, 2.5, 0.05, 0.75, function (x) { return fmt(x, 2) + ' mm'; });
      ui.range('P', 'Beam power P', 0.01, 10, 0.01, 1.0, function (x) { return fmt(x, 2) + ' mW'; });
      var out = ui.readout(), lam = 794.979e-6;   // mm
      var grp = new T.Group(); st.scene.add(grp); var env1 = lineObj(new Array(121).fill(0).map(function () { return new T.Vector3(); }), COL.red, 1), env2 = lineObj(new Array(121).fill(0).map(function () { return new T.Vector3(); }), COL.red, 1); grp.add(env1); grp.add(env2);
      var tube = null, fill = null;
      grp.add(lineObj([new T.Vector3(-5.2, 0, 0), new T.Vector3(5.2, 0, 0)], COL.grey, 0.8));
      var ap = lineObj([new T.Vector3(0, -0.75, 0), new T.Vector3(0, 0.75, 0)], COL.green, 1); grp.add(ap); st.label('AOM aperture 1.5 mm (typical, check the data sheet)', new T.Vector3(0, -1.5, 0), 'b');
      st.label('z (beam axis)', new T.Vector3(5.5, 0.2, 0)); var zl = st.label('z_R', new T.Vector3(), 'e'), zl2 = st.label('−z_R', new T.Vector3(), 'e'), wl = st.label('w₀', new T.Vector3(), 'e');
      var zRm = lineObj([new T.Vector3(), new T.Vector3()], COL.yellow, 0.8, true), zRm2 = lineObj([new T.Vector3(), new T.Vector3()], COL.yellow, 0.8, true); grp.add(zRm); grp.add(zRm2);
      function upd() {
        var w0 = ui.v.w0, zR = Math.PI * w0 * w0 / lam;          // mm
        var zmax = Math.max(3 * zR, 400), sx = 5 / zmax, sy = 0.9 / Math.max(w0, 0.3); // x: mm -> scene, y: mm -> scene (not isotropic: aspect exaggerated)
        var p1 = env1.geometry.attributes.position, p2 = env2.geometry.attributes.position;
        for (var i = 0; i <= 120; i++) { var z = -zmax + 2 * zmax * i / 120, w = w0 * Math.sqrt(1 + (z / zR) * (z / zR)); p1.setXYZ(i, z * sx, w * sy, 0); p2.setXYZ(i, z * sx, -w * sy, 0); } p1.needsUpdate = true; p2.needsUpdate = true;
        if (fill) { grp.remove(fill); fill.geometry.dispose(); }
        var pts = []; for (i = 0; i <= 60; i++) { var zz = -zmax + 2 * zmax * i / 60, ww = w0 * Math.sqrt(1 + (zz / zR) * (zz / zR)); pts.push(new T.Vector2(ww * sy, zz * sx)); }
        fill = new T.Mesh(new T.LatheGeometry(pts, 24), new T.MeshBasicMaterial({ color: COL.red, transparent: true, opacity: 0.2, depthWrite: false })); fill.rotation.z = -Math.PI / 2; grp.add(fill);
        ap.geometry.attributes.position.setXYZ(0, 0, -0.75 * sy, 0); ap.geometry.attributes.position.setXYZ(1, 0, 0.75 * sy, 0); ap.geometry.attributes.position.needsUpdate = true;
        zRm.geometry.attributes.position.setXYZ(0, zR * sx, -1.4, 0); zRm.geometry.attributes.position.setXYZ(1, zR * sx, 1.4, 0); zRm2.geometry.attributes.position.setXYZ(0, -zR * sx, -1.4, 0); zRm2.geometry.attributes.position.setXYZ(1, -zR * sx, 1.4, 0); zRm.geometry.attributes.position.needsUpdate = true; zRm2.geometry.attributes.position.needsUpdate = true; zRm.computeLineDistances(); zRm2.computeLineDistances();
        zl.pos.set(zR * sx, 1.55, 0); zl2.pos.set(-zR * sx, 1.55, 0); wl.pos.set(0.45, w0 * sy + 0.18, 0);
        var I0 = 2 * (ui.v.P * 1e-3) / (Math.PI * (w0 * 0.1) * (w0 * 0.1)) * 1e3; // mW/cm^2: 2P/(π w²), w in cm
        var G = 2 * Math.PI * 5.750e6, Isat = 4.4876, Om = G * Math.sqrt(I0 / (2 * Isat)) / (2 * Math.PI) / 1e6;
        out.innerHTML = 'Rayleigh range z_R = πw₀²/λ = <b>' + fmt(zR / 1000, 2) + ' m</b>; far-field half-angle λ/(πw₀) = <b>' + fmt(lam / (Math.PI * w0) * 1000, 2) + ' mrad</b>.<br>Peak intensity at the waist I₀ = 2P/(πw₀²) = <b>' + fmt(I0, 2) + ' mW/cm²</b> → two-level estimate Ω/2π = Γ√(I/2I_sat)/2π ≈ <b>' + fmt(Om, 2) + ' MHz</b> (Γ/2π = 5.750 MHz, I_sat = 4.488 mW/cm² for far-detuned π light, Steck).<br>Beam diameter at the waist 2w₀ = <b>' + fmt(2 * w0, 2) + ' mm</b> versus a 1.5 mm AOM aperture: ratio <b>' + fmt(2 * w0 / 1.5, 2) + '</b>.<br>Check: the paper’s 1.3 mW/cm² control with a 2.55 mm radius needs only P = I₀πw²/2 ≈ 0.13 mW.<br><small>Vertical scale is exaggerated relative to z so the envelope is visible. Gaussian-beam formulas: w(z) = w₀√(1+(z/z_R)²), z_R = πw₀²/λ, λ = 794.979 nm.</small>';
      }
      ui.onChange = upd; upd(); st.tick.push(function () { });
    }
  };

  /* ---------------- mounting ---------------- */
  function mount(host) {
    var name = host.getAttribute('data-scene'), def = SCENES[name]; if (!def) return;
    var title = host.getAttribute('data-title') || name, cap = host.getAttribute('data-caption') || '';
    host.classList.add('viz3d-ready'); host.innerHTML = '';
    var head = h('div', 'viz-head', '<b>3D illustration · ' + title + '</b><span class="viz-hint">drag to rotate · scroll to zoom · sliders change the physics</span>');
    var body = h('div', 'viz-body'); var panel = h('div', 'viz-ctrl'); host.appendChild(head); host.appendChild(body);
    var st = new Stage(host, Object.assign({ aria: '3D illustration: ' + title + '. Drag to rotate, scroll to zoom.' }, def.opts)); body.appendChild(st.canvasHost); body.appendChild(panel);
    if (cap) host.appendChild(h('p', 'viz-cap', cap));
    var ui = new UI(panel, function () { }); var built = false;
    function ensure() {
      if (built) return; built = true; st.init(); if (st.failed) return;
      def.build(st, ui); if (st.once) st.once();
      st.scene.traverse(function (o) { o.frustumCulled = false; });
      var base = ui.onChange; ui.onChange = function (k) { if (base) base(k); };
      st.start();
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { var vis = es[0].isIntersecting; if (vis) { ensure(); st.visible = true; st.start(); } else { st.visible = false; st.stop(); } }, { rootMargin: '120px', threshold: 0.01 });
      io.observe(host);
    } else ensure();
  }
  function init() { document.querySelectorAll('.viz3d').forEach(mount); }
  if (!T || !T.OrbitControls) { console.warn('three.js not loaded: 3D illustrations disabled'); return; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Lecture3D = { scenes: SCENES, remount: init };
})();
