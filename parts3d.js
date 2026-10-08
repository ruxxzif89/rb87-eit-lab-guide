/* parts3d.js: three.js models of the lab equipment, for the equipment lists.
   The optics and instruments are ported from the 3D bench simulator in index.html (same shapes, sizes and materials,
   units in mm, local +x = beam direction, y up, group origin on the beam axis, posts down to y = -40).
   Extra models cover the items the simulator does not draw (cables, goggles, tools, ...).
   Usage: <span class="p3d" data-p3d="mirror" data-p3dp='{"k":1}' data-title="Mirror"></span>, then Parts3D.scan(root).
   Each element gets a rendered thumbnail; clicking it opens an interactive viewer (drag to rotate, scroll to zoom). */
(function () {
  'use strict';
  var T = window.THREE; if (!T) return;
  var H = 40;                       // beam height above the table, as in the simulator
  var geoCache = {}, MT = null;

  function std(color, metal, rough, extra) { return new T.MeshStandardMaterial(Object.assign({ color: color, metalness: metal, roughness: rough }, extra || {})); }
  function mats() {
    if (MT) return MT; var M = MT = {};
    M.metal = std(0xa9b2b8, 0.3, 0.38); M.alu = std(0xc9d0d4, 0.3, 0.38); M.dark = std(0x22282e, 0.35, 0.55);
    M.black = std(0x0d0f12, 0.5, 0.55); M.matte = std(0x07080a, 0.1, 0.95); M.mirror = std(0xf2f6f8, 0.45, 0.1);
    M.brass = std(0xd1a94d, 0.4, 0.35);
    M.glass = std(0x6fb7d6, 0.05, 0.08, { transparent: true, opacity: 0.38, depthWrite: false });
    M.glassDiag = new T.MeshBasicMaterial({ color: 0x6fb7d6, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false });
    M.accent = std(0x5db3d6, 0.3, 0.45); M.laser = std(0xff5468, 0.2, 0.5);
    M.hwp = std(0x5b8bde, 0.1, 0.12, { transparent: true, opacity: 0.7, depthWrite: false });
    M.qwp = std(0x3fbf96, 0.1, 0.12, { transparent: true, opacity: 0.7, depthWrite: false });
    M.copper = std(0xc17a3d, 0.4, 0.35); M.mumetal = std(0x9aa5ad, 0.35, 0.4, { side: T.DoubleSide });
    M.nd = std(0x2a2d33, 0.2, 0.3, { transparent: true, opacity: 0.82 });
    M.on = new T.MeshBasicMaterial({ color: 0x39d36b }); M.off = new T.MeshBasicMaterial({ color: 0xd33a3a });
    M.screen = std(0x0b2a1f, 0.1, 0.4, { emissive: 0x1c9a68, emissiveIntensity: 0.55 });
    M.knob = std(0xd9dde0, 0.8, 0.25);
    M.white = std(0xe8ebee, 0.05, 0.6); M.yellow = std(0xf2c230, 0.05, 0.55); M.orange = std(0xe8791c, 0.1, 0.5);
    M.blue = std(0x2f6fb5, 0.1, 0.5); M.red = std(0xc23030, 0.1, 0.5); M.green = std(0x3a8f4f, 0.1, 0.5);
    M.amber = std(0xff9a2a, 0.1, 0.15, { transparent: true, opacity: 0.62, depthWrite: false });
    M.rubber = std(0x15181b, 0.05, 0.85); M.foil = std(0xd88a1d, 0.3, 0.55, { emissive: 0xff6a00, emissiveIntensity: 0.35 });
    M.vapor = new T.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.22, depthWrite: false });
    return M;
  }

  /* ---- geometry helpers (same signatures as the simulator) ---- */
  function geo(key, mk) { return geoCache[key] || (geoCache[key] = mk()); }
  function bx(w, h, d, m, x, y, z) { var o = new T.Mesh(geo('b' + w + '_' + h + '_' + d, function () { return new T.BoxGeometry(w, h, d); }), m); o.position.set(x || 0, y || 0, z || 0); return o; }
  function cy(r, len, m, x, y, z, ax, seg) {
    var o = new T.Mesh(geo('c' + r + '_' + len + '_' + (seg || 24), function () { return new T.CylinderGeometry(r, r, len, seg || 24, 1, false); }), m);
    if (ax === 'y') { } else if (ax === 'z') o.rotation.x = Math.PI / 2; else o.rotation.z = Math.PI / 2;
    o.position.set(x || 0, y || 0, z || 0); return o;
  }
  function tr(R, t, m, x, y, z, ry) { var o = new T.Mesh(geo('t' + R + '_' + t, function () { return new T.TorusGeometry(R, t, 10, 36); }), m); o.rotation.y = ry === undefined ? Math.PI / 2 : ry; o.position.set(x || 0, y || 0, z || 0); return o; }
  function sp(r, m, x, y, z, sx) { var o = new T.Mesh(geo('s' + r, function () { return new T.SphereGeometry(r, 20, 14); }), m); o.position.set(x || 0, y || 0, z || 0); if (sx) o.scale.set(sx, 1, 1); return o; }
  function tube(pts, r, m, seg) { var c = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); })); return new T.Mesh(new T.TubeGeometry(c, seg || 60, r, 8, false), m); }
  function aim(o, from, to) { var d = new T.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize(); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); return o; }
  function stand(g) { // base plate, post and clamp
    var M = mats();
    g.add(bx(30, 3, 22, M.black, 0, -H + 1.5, 0));
    var h = H - 14; g.add(cy(4.5, h, M.alu, 0, -H + 3 + h / 2, 0, 'y', 14));
    g.add(cy(7.5, 9, M.black, 0, -15.5, 0, 'y', 16));
    g.add(cy(2.2, 8, M.brass, 8, -15.5, 0, 'x', 10));
  }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new T.CanvasTexture(c); }
  function scopeTex() {
    return canvasTex(128, 80, function (x) {
      x.fillStyle = '#05140e'; x.fillRect(0, 0, 128, 80); x.strokeStyle = '#124a32'; x.lineWidth = 1;
      for (var i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 80); x.stroke(); }
      for (i = 1; i < 5; i++) { x.beginPath(); x.moveTo(0, i * 16); x.lineTo(128, i * 16); x.stroke(); }
      x.strokeStyle = '#ffd54a'; x.lineWidth = 2; x.beginPath();
      for (i = 0; i <= 128; i++) { var u = (i - 64) / 7, y = 52 - 8 - 22 / (1 + u * u * 0.5) + 18 * (1 - 1 / (1 + (u * 0.3) * (u * 0.3))); if (i) x.lineTo(i, y); else x.moveTo(i, y); } x.stroke();
    });
  }
  function textTex(txt, w, h, fg, bg, font) {
    return canvasTex(w, h, function (x) { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font || 'bold 40px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2); });
  }

  /* ---- generic bench instrument (front panel faces local -x); ported from the simulator ---- */
  function instrument(g, w, h, d, variant) {
    var M = mats(), y0 = h / 2 - H, fx = -w / 2;
    var body = variant === 'rfamp' ? std(0x23292f, 0.4, 0.5) : M.dark;
    g.add(bx(w, h, d, body, 0, y0, 0));
    g.add(bx(w + 2, 3, d + 2, M.black, 0, y0 + h / 2, 0));
    if (variant === 'rfamp') { for (var f = -3; f <= 3; f++) g.add(bx(w - 6, 6, 1.6, M.alu, 0, y0 + h / 2 + 4.5, f * d * 0.13)); }
    if (variant === 'scope') {
      var sc = new T.Mesh(new T.PlaneGeometry(d * 0.7, h * 0.62), new T.MeshBasicMaterial({ map: scopeTex() })); sc.rotation.y = -Math.PI / 2; sc.position.set(fx - 0.9, y0 + h * 0.08, 0); g.add(sc);
      for (var kn = 0; kn < 4; kn++) g.add(cy(2.6, 3, M.knob, fx - 1.4, y0 - h * 0.34, -d * 0.3 + kn * 9, 'x', 14));
    } else if (variant === 'rfatt') {
      g.add(cy(2.2, 6, M.brass, fx - 3, y0, d * 0.25, 'x', 10)); g.add(cy(2.2, 6, M.brass, fx - 3, y0, -d * 0.25, 'x', 10)); g.add(cy(4, 3, M.knob, fx - 1.4, y0 + h * 0.2, 0, 'x', 14)); g.add(bx(2, 4, 8, M.knob, fx - 1.2, y0 - h * 0.25, 0));
    } else if (variant === 'rfamp') {
      g.add(cy(2.2, 6, M.brass, fx - 3, y0, d * 0.25, 'x', 10)); g.add(cy(2.2, 6, M.brass, fx - 3, y0, -d * 0.25, 'x', 10)); g.add(bx(1.4, 5, 8, M.on, fx - 0.5, y0 + h * 0.25, 0));
    } else if (variant === 'rfgen') {
      g.add(bx(1.4, h * 0.38, d * 0.42, M.screen, fx - 0.4, y0 + h * 0.18, -d * 0.2));
      for (var c1 = 0; c1 < 2; c1++) g.add(cy(2.6, 6, M.brass, fx - 3, y0 - h * 0.3, d * 0.12 + c1 * 12, 'x', 10));
      for (var k2 = 0; k2 < 3; k2++) g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.3 + k2 * 9, 'x', 14));
    } else if (variant === 'psu') {
      g.add(bx(1.4, h * 0.3, d * 0.34, M.screen, fx - 0.4, y0 + h * 0.2, -d * 0.18)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.25, -d * 0.25, 'x', 14)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.25, d * 0.05, 'x', 14));
      for (var t2 = 0; t2 < 3; t2++) g.add(cy(2.2, 5, t2 === 1 ? M.alu : (t2 ? M.black : M.laser), fx - 3, y0 - h * 0.25, d * 0.22 + t2 * 6, 'x', 10));
    } else if (variant === 'pwrmeter') {
      g.add(bx(1.4, h * 0.4, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.15, 0)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.2, 'x', 14)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, d * 0.2, 'x', 14));
    } else if (variant === 'csrc') {
      g.add(cy(7, 4, M.knob, fx - 2, y0 + h * 0.05, -d * 0.12, 'x', 20)); g.add(bx(1.4, h * 0.3, d * 0.3, M.screen, fx - 0.4, y0 + h * 0.2, d * 0.2)); g.add(cy(2.6, 6, M.copper, fx - 3, y0 - h * 0.28, d * 0.25, 'x', 10));
    } else if (variant === 'tctrl') {
      g.add(bx(1.4, h * 0.34, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.18, -d * 0.1)); for (var k3 = 0; k3 < 3; k3++) g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.3 + k3 * 9, 'x', 14));
    } else if (variant === 'dmm') {
      g.add(bx(1.4, h * 0.3, d * 0.6, M.screen, fx - 0.4, y0 + h * 0.2, 0));
      g.add(cy(4, 3, M.knob, fx - 1.4, y0 - h * 0.12, 0, 'x', 18));
      for (var j = 0; j < 4; j++) g.add(cy(1.9, 5, j === 3 ? M.black : (j === 2 ? M.red : M.alu), fx - 2.6, y0 - h * 0.34, -d * 0.27 + j * 7, 'x', 10));
    } else if (variant === 'sa') {
      g.add(bx(1.4, h * 0.5, d * 0.62, M.screen, fx - 0.4, y0 + h * 0.14, -d * 0.08));
      for (var q = 0; q < 6; q++) g.add(bx(1.4, 2.6, 4, M.knob, fx - 0.4, y0 - h * 0.27, -d * 0.36 + q * 5.2));
      g.add(cy(3.2, 3, M.knob, fx - 1.4, y0 - h * 0.1, d * 0.38, 'x', 14)); g.add(cy(2.2, 6, M.brass, fx - 3, y0 + h * 0.3, d * 0.38, 'x', 10));
    } else if (variant === 'wave') {
      g.add(bx(1.4, h * 0.36, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.16, -d * 0.1)); g.add(cy(2.6, 7, M.green, fx - 3.4, y0 - h * 0.25, d * 0.22, 'x', 10)); g.add(cy(1.2, 9, M.yellow, fx - 5, y0 - h * 0.25, d * 0.22, 'x', 8));
    } else {
      g.add(bx(1.4, h * 0.42, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.12, -d * 0.12));
      for (var i = 0; i < 3; i++) g.add(cy(3, 3, M.knob, fx - 1, y0 - h * 0.28, d * 0.28 - i * 9, 'x', 14));
    }
    return y0;
  }
  function small(g, w, h, d, ports, body) { // small RF module: box with SMA ports at both ends
    var M = mats(); g.add(bx(w, h, d, body || M.alu, 0, 0, 0));
    ports.forEach(function (p) { g.add(cy(3.2, 9, M.brass, p[0], p[1] || 0, p[2] || 0, 'x', 6)); g.add(cy(1.2, 11, M.mirror, p[0] + (p[0] < 0 ? -1 : 1), p[1] || 0, p[2] || 0, 'x', 6)); });
  }
  function conn(g, type, p, to) { // cable connector, axis from p towards 'to'
    var M = mats(), m = new T.Group();
    if (type === 'bnc') { m.add(cy(5, 15, M.alu, 0, 7.5, 0, 'y', 16)); m.add(cy(6.2, 3, M.brass, 0, 12.5, 0, 'y', 16)); m.add(cy(2, 5, M.knob, 5.5, 8, 0, 'x', 8)); m.add(cy(2, 5, M.knob, -5.5, 8, 0, 'x', 8)); m.add(cy(3.2, 4, M.rubber, 0, 1, 0, 'y', 12)); }
    else if (type === 'sma') { m.add(cy(3.4, 12, M.brass, 0, 6, 0, 'y', 6)); m.add(cy(2.4, 4, M.alu, 0, 13, 0, 'y', 10)); m.add(cy(2.2, 3, M.rubber, 0, 1, 0, 'y', 10)); }
    else { m.add(cy(2.6, 10, M.alu, 0, 5, 0, 'y', 8)); }
    m.position.set(p[0], p[1], p[2]); aim(m, p, to); g.add(m);
  }

  /* ------------------------------------------------------------------ models */
  var MODELS = {
    laser: function (g) {
      var M = mats(); stand(g);
      g.add(bx(46, 28, 32, M.alu, -18, 0, 0)); g.add(bx(46, 4, 33, M.laser, -18, 15, 0));
      for (var f = 0; f < 6; f++) g.add(bx(2.2, 8, 34, M.black, -34 + f * 6, 19, 0));
      g.add(cy(3.6, 12, M.green, 12, 0, 0, 'x', 14)); g.add(cy(4.8, 3, M.knob, 19, 0, 0, 'x', 14)); g.add(cy(1.5, 20, M.yellow, 30, 0, 0, 'x', 8));
      g.add(bx(8, 3, 6, M.accent, -34, -13, 0)); g.add(sp(1.9, M.on, -38, 13, 17));
    },
    mount14: function (g, p) { // 14-pin butterfly laser mount
      var M = mats(); stand(g);
      g.add(bx(40, 8, 34, M.black, 0, -4, 0)); g.add(bx(34, 10, 28, M.alu, 0, 4, 0));
      g.add(bx(22, 6, 14, M.dark, 2, 12, 0)); g.add(cy(2.6, 10, M.brass, 15, 6, 0)); g.add(cy(1.2, 22, M.yellow, 30, 6, 0));
      for (var i = 0; i < 7; i++) { g.add(cy(0.7, 5, M.brass, -12 + i * 4, 15, 7, 'y', 6)); g.add(cy(0.7, 5, M.brass, -12 + i * 4, 15, -7, 'y', 6)); }
      g.add(bx(8, 4, 12, M.green, -22, 4, 0)); g.add(cy(2.2, 8, M.knob, -22, 14, 0, 'y', 8));
    },
    fibcol: function (g) { // fibre collimator, FC/APC
      var M = mats(); stand(g);
      g.add(cy(10, 22, M.black, 4, 0, 0)); g.add(cy(11.2, 6, M.alu, -2, 0, 0)); g.add(cy(8, 16, M.alu, 22, 0, 0)); g.add(cy(5.6, 2, M.glass, 30.5, 0, 0));
      g.add(cy(4.6, 14, M.green, -14, 0, 0)); g.add(cy(5.4, 3, M.knob, -9, 0, 0)); g.add(cy(1.4, 38, M.yellow, -34, 0, 0));
      for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; g.add(bx(1.4, 3, 1.4, M.knob, 8, Math.sin(a) * 10.6, Math.cos(a) * 10.6)); }
    },
    isolator: function (g) { // fibre-inline dual-stage isolator (PM fibre, FC/APC) followed by the collimator, as in the simulator
      var M = mats(); stand(g);
      g.add(cy(1.5, 14, M.yellow, -33, 0, 0, 'x', 8)); g.add(cy(3.6, 9, M.green, -24, 0, 0, 'x', 14)); g.add(cy(4.8, 3, M.knob, -18, 0, 0, 'x', 14));
      g.add(cy(5.6, 11, M.accent, -10, 0, 0, 'x', 20)); g.add(cy(6.2, 2, M.black, -3.5, 0, 0, 'x', 20)); g.add(cy(5.6, 11, M.accent, 3, 0, 0, 'x', 20));
      g.add(cy(4.8, 3, M.knob, 10, 0, 0, 'x', 14)); g.add(cy(8, 18, M.black, 20, 0, 0, 'x', 20)); g.add(cy(4.2, 4, M.brass, 31, 0, 0, 'x', 14)); g.add(cy(3.2, 1.2, M.glass, 33.4, 0, 0, 'x', 14));
      var cone = new T.Mesh(geo('cone', function () { return new T.ConeGeometry(3.4, 9, 12); }), M.laser); cone.rotation.z = -Math.PI / 2; cone.position.set(-2, 10, 0); g.add(cone); g.add(bx(12, 1.8, 1.8, M.laser, -10, 10, 0));
    },
    fibiso: function (g) { // the isolator alone: a short steel tube between two FC/APC boots, two Faraday stages, fibre in and out
      var M = mats(); stand(g);
      g.add(tube([[-46, 0, 14], [-36, 0, 6], [-26, 0, 0]], 1.4, M.yellow, 20)); g.add(cy(3.6, 9, M.green, -22, 0, 0, 'x', 14)); g.add(cy(4.8, 3, M.knob, -16, 0, 0, 'x', 14));
      g.add(cy(5.6, 14, M.accent, -7, 0, 0, 'x', 20)); g.add(cy(6.2, 2, M.black, 1, 0, 0, 'x', 20)); g.add(cy(5.6, 14, M.accent, 9, 0, 0, 'x', 20));
      g.add(cy(4.8, 3, M.knob, 18, 0, 0, 'x', 14)); g.add(cy(3.6, 9, M.green, 24, 0, 0, 'x', 14)); g.add(tube([[28, 0, 0], [38, 0, -6], [48, 0, -14]], 1.4, M.yellow, 20));
      var cone = new T.Mesh(geo('cone', function () { return new T.ConeGeometry(3.4, 9, 12); }), M.laser); cone.rotation.z = -Math.PI / 2; cone.position.set(0, 10, 0); g.add(cone); g.add(bx(12, 1.8, 1.8, M.laser, -8, 10, 0));
    },
    mirror: function (g) {
      var M = mats(); stand(g);
      g.add(bx(8, 30, 30, M.black, -6, 0, 0)); g.add(cy(13.5, 3, M.mirror, 0, 0, 0)); g.add(cy(14.5, 2, M.alu, -2.5, 0, 0));
      g.add(cy(2.6, 9, M.knob, -12, 11, 10)); g.add(cy(2.6, 9, M.knob, -12, -11, 10)); g.add(cy(2.6, 9, M.knob, -12, 11, -10));
    },
    pbs: function (g, p) {
      var M = mats(); stand(g);
      g.add(bx(20, 20, 20, M.glass)); g.add(bx(22, 2, 22, M.alu, 0, -11, 0));
      var pl = new T.Mesh(geo('diag', function () { return new T.PlaneGeometry(28, 20); }), M.glassDiag); pl.rotation.y = -Math.PI / 4; g.add(pl);
      if (p && p.np) g.add(bx(20, 2, 20, M.accent, 0, 11, 0)); else g.add(bx(4, 1, 4, M.accent, 8, 10.6, 8));
    },
    wp: function (g, p) {
      var M = mats(); stand(g); var hw = !(p && p.q), ax = (p && p.axis) || (hw ? 0 : 45);
      g.add(tr(13.2, 2.2, M.black, -2, 0, 0)); g.add(cy(12, 2.6, hw ? M.hwp : M.qwp, 0, 0, 0)); g.add(tr(14.4, 1.4, M.knob, 0, 0, 0));
      for (var t = 0; t < 12; t++) { var a = t * Math.PI / 6; g.add(bx(0.8, t % 3 ? 1.6 : 3, 0.8, M.knob, 1.2, Math.sin(a) * 14.6, Math.cos(a) * 14.6)); }
      var axm = bx(1.2, 1.4, 22, M.black, 1.6, 0, 0); axm.rotation.x = ax * Math.PI / 180; g.add(axm);
      g.add(bx(1.6, 4, 2.4, M.laser, 1.8, -Math.sin(ax * Math.PI / 180) * 11, Math.cos(ax * Math.PI / 180) * 11));
    },
    aom: function (g, p) {
      var M = mats(); stand(g);
      g.add(bx(28, 20, 24, M.alu)); g.add(bx(28, 6, 24, M.accent, 0, 12, 0)); g.add(bx(30, 2, 26, M.black, 0, -11, 0));
      g.add(cy(4, 2, M.black, -14.4, 0, 0)); g.add(cy(4, 2, M.black, 14.4, 0, 0)); g.add(cy(2.6, 9, M.brass, 6, 18, 0, 'y', 10)); g.add(sp(2.4, M.on, -9, 15.5, 8));
      if (p && p.mode === 'double') {
        g.add(cy(9, 2, M.glass, 32, 0, 0)); g.add(tr(10, 1.4, M.black, 32, 0, 0)); g.add(cy(8.5, 2, M.qwp, 42, 0, 0)); g.add(tr(9.5, 1.2, M.black, 42, 0, 0));
        g.add(cy(10, 3, M.mirror, 54, 0, 0)); g.add(bx(4, 22, 22, M.black, 58, 0, 0)); g.add(bx(62, 3, 28, M.black, 25, -14, 0)); g.add(cy(3.5, 24, M.alu, 54, -14, 0, 'y', 10));
      }
    },
    lens: function (g) { var M = mats(); stand(g); g.add(tr(13.5, 2, M.black, 0, 0, 0)); g.add(sp(12, M.glass, 0, 0, 0, 0.24)); g.add(cy(1.6, 6, M.knob, 0, 15, 0, 'y', 8)); },
    iris: function (g) { var M = mats(); stand(g); g.add(tr(11, 3, M.black, 0, 0, 0)); g.add(tr(6, 3.2, M.dark, 0, 0, 0)); g.add(bx(2, 2, 12, M.knob, 0, 13, 5)); },
    nd: function (g) { var M = mats(); stand(g); g.add(bx(2.5, 24, 24, M.nd)); g.add(bx(5, 3, 26, M.black, 0, -13, 0)); g.add(bx(3, 26, 2, M.black, 0, 0, 13)); g.add(bx(3, 26, 2, M.black, 0, 0, -13)); },
    glan: function (g) { var M = mats(); stand(g); g.add(bx(22, 22, 30, M.glass)); g.add(bx(24, 4, 32, M.alu, 0, -12, 0)); g.add(bx(24, 4, 32, M.alu, 0, 12, 0)); g.add(cy(3, 12, M.black, 0, 0, 18, 'z', 10)); },
    pd: function (g) { var M = mats(); stand(g); g.add(bx(18, 26, 22, M.dark)); g.add(cy(7, 4, M.accent, 10, 0, 0)); g.add(cy(5, 1.2, M.glass, 12.4, 0, 0)); g.add(cy(2.4, 8, M.brass, -12, 6, 0, 'x', 10)); g.add(bx(6, 3, 8, M.laser, -2, 14.5, 0)); },
    dump: function (g) { var M = mats(); stand(g); g.add(bx(20, 30, 26, M.matte)); for (var q = -2; q <= 2; q++) g.add(bx(2, 28, 28, M.black, -4 + q * 3.2, 0, 0)); g.add(bx(2, 18, 16, M.black, 10.5, 0, 0)); },
    refcell: function (g) {
      var M = mats(); stand(g);
      g.add(cy(9.5, 75, M.glass)); g.add(cy(7.8, 70, M.vapor)); g.add(cy(10.1, 2, M.glass, -37.5, 0, 0)); g.add(cy(10.1, 2, M.glass, 37.5, 0, 0));   // Ø19 x 75 mm reference cell
      g.add(tr(9.9, 1, M.alu, -36.5, 0, 0)); g.add(tr(9.9, 1, M.alu, 36.5, 0, 0)); g.add(cy(2.4, 10, M.glass, 0, 14, 0, 'y', 10));
    },
    cell: function (g, p) {
      var M = mats(); p = p || {}; stand(g);
      var heat = p.heater ? 1 : 0;
      g.add(cy(9.5, 75, M.glass)); g.add(cy(7.8, 70, M.vapor)); g.add(cy(10.1, 2, M.glass, -37, 0, 0)); g.add(cy(10.1, 2, M.glass, 37, 0, 0));   // Ø19 x 75 mm quartz cell
      g.add(tr(9.9, 1.1, M.alu, -36, 0, 0)); g.add(tr(9.9, 1.1, M.alu, 36, 0, 0));
      g.add(cy(3, 14, M.glass, 0, 16, 0, 'y', 10)); g.add(sp(2.4, std(0xa08060, 0.8, 0.3), 0, 23, 0));
      if (heat) g.add(cy(10.9, 40, M.foil));
      if (p.solenoid) for (var i = -4; i <= 4; i++) g.add(tr(14.4, 1.5, M.copper, i * 8.5, 0, 0));
      if (p.shield) {
        [[21, 108], [24.5, 114], [28, 120]].forEach(function (L) {
          var sh = new T.Mesh(new T.CylinderGeometry(L[0], L[0], L[1], 44, 1, true, Math.PI * 0.75, Math.PI * 1.5), M.mumetal); sh.rotation.z = Math.PI / 2; g.add(sh);
          [-1, 1].forEach(function (s) { var cap = new T.Mesh(new T.RingGeometry(6, L[0], 36, 1, Math.PI * 0.75, Math.PI * 1.5), M.mumetal); cap.rotation.y = Math.PI / 2; cap.position.x = s * L[1] / 2; g.add(cap); });
        });
        g.add(bx(100, 3, 70, M.black, 0, -H + 1.5, 0));
      } else g.add(bx(70, 3, 40, M.black, 0, -H + 1.5, 0));
    },
    foil: function (g) { // polyimide foil heater with Pt100 sensor
      var M = mats();
      var plate = bx(70, 0.8, 40, M.foil, 0, 0, 0); g.add(plate);
      for (var i = -5; i <= 5; i++) g.add(bx(60, 0.5, 1, M.copper, 0, 0.7, i * 3.2));
      g.add(bx(8, 1.2, 8, M.dark, 26, 1, -12)); g.add(tube([[30, 1, -12], [46, 3, -16], [60, 3, -10]], 0.8, M.yellow, 20));
      g.add(tube([[-34, 1, 0], [-48, 4, 6], [-62, 3, 8]], 1.0, M.red, 20)); g.add(tube([[-34, 1, 3], [-48, 4, 9], [-62, 3, 11]], 1.0, M.black, 20));
      g.add(bx(60, 0.4, 30, M.yellow, 0, -0.6, 0));
    },
    solenoid: function (g) { // non-magnetic former wound with copper wire
      var M = mats(); g.add(cy(14, 100, M.white, 0, 0, 0, 'x', 32));
      for (var i = -11; i <= 11; i++) g.add(tr(15.2, 1.1, M.copper, i * 4.2, 0, 0));
      g.add(cy(15.8, 3, M.white, -52, 0, 0)); g.add(cy(15.8, 3, M.white, 52, 0, 0));
      g.add(tube([[48, 14, 4], [64, 18, 14], [86, 6, 22]], 1.0, M.red, 20)); g.add(tube([[-48, 14, -4], [-64, 18, -14], [-86, 6, -22]], 1.0, M.black, 20));
    },
    shield: function (g) { // three concentric µ-metal layers, cut away to show the nesting
      var M = mats();
      [[16, 100], [21, 108], [26, 116]].forEach(function (L, i) {
        var sh = new T.Mesh(new T.CylinderGeometry(L[0], L[0], L[1], 44, 1, true, Math.PI * 0.55, Math.PI * 1.6), M.mumetal); sh.rotation.z = Math.PI / 2; g.add(sh);
        [-1, 1].forEach(function (s) { var cap = new T.Mesh(new T.RingGeometry(6, L[0], 36, 1, Math.PI * 0.55, Math.PI * 1.6), M.mumetal); cap.rotation.y = Math.PI / 2; cap.position.x = s * L[1] / 2; g.add(cap); });
      });
      g.add(cy(10, 70, M.glass, 0, 0, 0)); g.add(cy(8.2, 64, M.vapor));
      g.add(bx(110, 3, 70, M.black, 0, -27, 0));
    },
    degauss: function (g) { // degaussing coil + variac
      var M = mats();
      for (var i = 0; i < 6; i++) g.add(tr(40 + i * 0.8, 2.2, M.copper, i * 2.4 - 6, 0, 0, Math.PI / 2));
      g.add(cy(41, 3, M.black, -9, 0, 0)); g.add(cy(41, 3, M.black, 9, 0, 0));
      var v = new T.Group(); v.position.set(40, -26, 70); instrument(v, 44, 30, 40, 'csrc'); v.position.y += H - 15; g.add(v);
      g.add(tube([[0, -40, 0], [14, -44, 30], [38, -30, 66]], 1.4, M.black, 20));
    },
    fluxgate: function (g) { // 3-axis fluxgate magnetometer: probe + readout
      var M = mats(); var v = new T.Group(); instrument(v, 56, 26, 40, 'pwrmeter'); v.position.y += H - 13; g.add(v);
      g.add(cy(5, 70, M.alu, 8, -4, 54, 'x', 14)); g.add(cy(5.6, 4, M.black, 44, -4, 54)); g.add(cy(6, 10, M.brass, -30, -4, 54));
      g.add(tube([[-34, -4, 54], [-48, -10, 40], [-34, -12, 22]], 1.2, M.black, 24));
    },
    holder: function (g) { // custom mount: base plate + V-block cradle with clamp
      var M = mats(); g.add(bx(60, 4, 40, M.black, 0, -H + 2, 0)); g.add(bx(8, 26, 36, M.alu, -22, -H + 17, 0)); g.add(bx(8, 26, 36, M.alu, 22, -H + 17, 0));
      g.add(cy(10.5, 36, M.dark, 0, -H + 19, 0, 'x', 20)); g.add(bx(30, 3, 22, M.alu, 0, -H + 32, 0)); g.add(cy(2, 12, M.knob, 0, -H + 38, 0, 'y', 10)); g.add(cy(3.6, 3, M.knob, 0, -H + 45, 0, 'y', 10));
    },
    postset: function (g) { // 1" post, post holder, clamping fork, base
      var M = mats(); g.add(bx(40, 4, 24, M.black, 0, -H + 2, 0)); g.add(cy(9, 22, M.black, -18, -H + 15, 0, 'y', 16)); g.add(cy(6.2, 60, M.alu, 6, -H + 30, 0, 'y', 16));
      g.add(cy(7.8, 20, M.black, 6, -H + 14, 0, 'y', 16)); g.add(cy(2.6, 12, M.brass, 14, -H + 14, 0, 'x', 10)); g.add(bx(26, 5, 10, M.metal, -22, -H + 5, 0));
      g.add(bx(3, 14, 10, M.metal, -34, -H + 9, 0)); g.add(cy(2, 12, M.knob, -12, -H + 12, 0, 'y', 10));
    },
    breadboard: function (g) {
      var M = mats();
      var tex = canvasTex(64, 64, function (x) { x.fillStyle = '#46555b'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64); x.fillStyle = '#1b272c'; x.beginPath(); x.arc(32, 32, 9, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1.2; x.beginPath(); x.arc(32, 32, 9, 0.2, 2.6); x.stroke(); });
      tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(12, 9); tex.anisotropy = 8;
      var top = new T.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.35 }), side = new T.MeshStandardMaterial({ color: 0x2c3a40, roughness: 0.7, metalness: 0.3 });
      var b = new T.Mesh(new T.BoxGeometry(240, 14, 180), [side, side, top, side, side, side]); g.add(b);
    },
    legs: function (g) { // vibration-isolated support: top frame + four air legs
      var M = mats(); var legM = std(0x2a3238, 0.3, 0.55);
      g.add(bx(250, 8, 190, M.dark, 0, 0, 0));
      [[-105, -75], [105, -75], [-105, 75], [105, 75]].forEach(function (q) { g.add(cy(8, 90, legM, q[0], -49, q[1], 'y', 16)); g.add(cy(11, 6, M.black, q[0], -95, q[1], 'y', 16)); g.add(cy(6, 14, M.alu, q[0], -6, q[1], 'y', 16)); });
      g.add(bx(210, 4, 6, M.black, 0, -30, -75)); g.add(bx(210, 4, 6, M.black, 0, -30, 75));
    },
    enclosure: function (g) { // black hardboard box with a beam tube
      var M = mats(); g.add(bx(150, 34, 70, std(0x1d2a31, 0.1, 0.9), 0, 0, 0)); g.add(bx(154, 3, 74, M.black, 0, 18, 0));
      g.add(cy(7, 40, M.black, -95, 4, 0)); g.add(cy(8, 4, M.dark, -75, 4, 0)); g.add(cy(7, 40, M.black, 95, 4, 0)); g.add(cy(8, 4, M.dark, 75, 4, 0));
      g.add(bx(30, 20, 2, M.black, 0, 6, 36)); g.add(bx(3, 3, 8, M.knob, 12, 10, 38));
    },
    baseplate: function (g, p) { // square or round mounting / adapter plate, optional black finish and clear aperture
      var M = mats(), body; p = p || {}; body = p.black ? M.black : M.alu;
      if (p.round) g.add(cy(26, 7, body, 0, 0, 0, 'y', 44)); else g.add(bx(46, 7, 46, body, 0, 0, 0));
      if (p.ap) g.add(cy(9, 7.4, M.dark, 0, 0, 0, 'y', 24));
      [[-17, -17], [17, -17], [-17, 17], [17, 17]].forEach(function (q) { g.add(cy(2.3, 7.4, M.dark, q[0], 0, q[1], 'y', 10)); });
    },
    rodclamp: function (g) { // rod / post clamp with side knob
      var M = mats(); g.add(cy(18, 22, M.black, 0, 0, 0, 'y', 28)); g.add(cy(12.5, 22.4, M.dark, 0, 0, 0, 'y', 24)); g.add(bx(14, 22, 22, M.black, -20, 0, 0)); g.add(cy(5, 12, M.knob, 24, 0, 0, 'x', 14)); g.add(cy(7, 4, M.knob, 31, 0, 0, 'x', 14));
    },
    rotstage: function (g) { // manual rotation stage with graduated ring and micrometer
      var M = mats(); g.add(cy(32, 8, M.black, 0, -6, 0, 'y', 44)); g.add(cy(28, 6, M.alu, 0, 1, 0, 'y', 44)); g.add(cy(8, 6.4, M.dark, 0, 1, 0, 'y', 20));
      for (var i = 0; i < 36; i++) { var a = i * Math.PI / 18; g.add(cy(0.6, 1.4, M.black, Math.cos(a) * 25, 4.2, Math.sin(a) * 25, 'y', 6)); }
      g.add(cy(4, 20, M.knob, 36, -6, 0, 'x', 12)); g.add(cy(6.4, 6, M.brass, 49, -6, 0, 'x', 12));
    },
    goniometer: function (g) { // tilt (goniometer) stage
      var M = mats(); g.add(bx(40, 6, 40, std(0x24282c, 0.4, 0.5), 0, -6, 0)); g.add(bx(36, 10, 36, M.brass, 0, 2, 0));
      var t = bx(40, 5, 40, M.black, 0, 10, 0); t.rotation.z = 0.12; g.add(t);
      g.add(cy(4, 12, M.knob, 27, 0, 0, 'x', 12)); g.add(cy(3, 8, M.knob, 0, 0, 25, 'z', 10)); g.add(cy(2.2, 3, M.dark, 12, 13, 12, 'y', 8));
    },
    xyzstage: function (g) { // three-axis micrometer translation stage
      var M = mats(); g.add(bx(54, 8, 54, M.alu, 0, -14, 0)); g.add(bx(50, 8, 46, M.metal, 0, -6, 0)); g.add(bx(46, 10, 40, M.alu, 0, 2, 0)); g.add(bx(40, 3, 40, M.black, 0, 8.5, 0));
      g.add(cy(3.6, 18, M.knob, 36, -14, 0, 'x', 12)); g.add(cy(5, 4, M.brass, 46, -14, 0, 'x', 12));
      g.add(cy(3.6, 18, M.knob, 0, -6, -34, 'z', 12)); g.add(cy(5, 4, M.brass, 0, -6, -44, 'z', 12));
      g.add(cy(3.6, 18, M.knob, -30, 2, 0, 'x', 12)); g.add(cy(5, 4, M.brass, -40, 2, 0, 'x', 12));
    },
    fiberbench: function (g) { // fibre-to-fibre coupler bench with a clear cover
      var M = mats(); g.add(bx(110, 14, 40, M.alu, 0, -8, 0)); g.add(bx(100, 18, 30, M.glass, 0, 8, 0));
      [-1, 1].forEach(function (s) { g.add(cy(8, 16, M.black, s * 62, 0, 0, 'x', 20)); g.add(cy(4, 10, M.green, s * 74, 0, 0, 'x', 12)); g.add(cy(1.4, 14, M.yellow, s * 86, 0, 0, 'x', 8)); });
      g.add(bx(60, 2, 2, M.laser, 0, 4, 0));
    },
    postholder: function (g) { // post holder with a post in it
      var M = mats(); g.add(cy(7, 70, M.alu, 0, 20, 0, 'y', 16)); g.add(cy(10, 50, M.black, 0, -10, 0, 'y', 24)); g.add(cy(2.5, 12, M.knob, 12, 6, 0, 'x', 10)); g.add(cy(5, 6, M.metal, 0, -38, 0, 'y', 14));
    },
    tubeadapter: function (g) { // stepped lens-tube adapter with a set screw
      var M = mats(); g.add(cy(15, 24, M.black, 0, 0, 0, 'x', 32)); g.add(cy(11, 16, M.dark, -18, 0, 0, 'x', 28)); g.add(cy(16, 3, M.alu, 12, 0, 0, 'x', 32)); g.add(cy(2, 6, M.knob, 0, 16, 0, 'y', 8));
    },
    osa: function (g) { // benchtop optical spectrum analyzer
      var M = mats(); instrument(g, 96, 52, 70, 'sa'); g.add(cy(4, 6, M.green, -51, -H + 36, -26, 'x', 12));
    },
    generic: function (g) { // unidentified item
      var M = mats(); g.add(bx(40, 26, 32, M.alu, 0, 0, 0)); g.add(bx(42, 3, 34, M.black, 0, 14, 0)); g.add(cy(3, 8, M.knob, 0, 0, 18, 'z', 10));
    },
    tctrl: function (g) { instrument(g, 70, 32, 48, 'tctrl'); },
    csrc: function (g) { instrument(g, 70, 32, 48, 'csrc'); },
    rfgen: function (g) { var M = mats(); instrument(g, 84, 36, 56, 'rfgen'); g.add(bx(1.4, 5, 5, M.on, -42.6, -H + 7, 22)); },
    rfatt: function (g) { instrument(g, 56, 24, 40, 'rfatt'); },
    rfamp: function (g) { instrument(g, 64, 28, 44, 'rfamp'); },
    scope: function (g) { instrument(g, 70, 56, 74, 'scope'); },
    psu: function (g) { instrument(g, 60, 30, 44, 'psu'); },
    pwrmeter: function (g) { instrument(g, 56, 26, 40, 'pwrmeter'); var M = mats(); g.add(cy(7, 6, M.black, -56, -H + 12, 40, 'x', 16)); g.add(cy(4, 10, M.alu, -62, -H + 12, 40, 'x', 16)); g.add(tube([[-30, -H + 12, 18], [-48, -H + 5, 30], [-56, -H + 12, 40]], 1.2, M.black, 20)); },
    fgen: function (g) { var M = mats(); instrument(g, 92, 46, 62); g.add(bx(1.4, 8, 8, M.on, -46.6, -H + 10, 20)); },
    lctrl: function (g) { var M = mats(); instrument(g, 58, 36, 46); g.add(bx(1.4, 6, 6, M.on, -29.6, -H + 10, 16)); },
    lockbox: function (g) { var M = mats(); instrument(g, 52, 30, 42); g.add(bx(1.4, 6, 6, M.on, -26.6, -H + 8, 16)); },
    dmm: function (g) { instrument(g, 60, 28, 44, 'dmm'); },
    sa: function (g) { instrument(g, 76, 44, 58, 'sa'); },
    wavemeter: function (g) { instrument(g, 60, 34, 46, 'wave'); },
    rfswitch: function (g) { var M = mats(); small(g, 30, 14, 20, [[-17, 0, 0], [17, 0, 0]]); g.add(bx(12, 2, 8, M.black, 0, 8, 0)); g.add(cy(1.2, 6, M.laser, 0, 10, 0, 'y', 8)); g.add(cy(2, 8, M.brass, 0, -9, 7, 'y', 8)); },
    coupler: function (g) { small(g, 36, 14, 22, [[-20, 0, 0], [20, 0, 0], [0, 0, 14]]); },
    laptop: function (g) {
      var M = mats(); g.add(bx(90, 4, 62, M.alu, 0, 2, 0));
      for (var r = 0; r < 4; r++) for (var c = 0; c < 12; c++) g.add(bx(5.4, 1.2, 5, M.dark, -20 + r * 6.2, 4.4, -30 + c * 5.4 + 2));
      g.add(bx(26, 0.4, 20, M.knob, 34, 4.3, 0));
      var lid = new T.Group(); lid.position.set(-42, 4, 0); lid.rotation.z = 0.32; lid.add(bx(3, 60, 88, M.alu, 0, 30, 0));
      var scr = new T.Mesh(new T.PlaneGeometry(82, 54), new T.MeshBasicMaterial({ map: scopeTex() })); scr.rotation.y = Math.PI / 2; scr.position.set(1.8, 30, 0); lid.add(scr); g.add(lid);
    },
    cable: function (g, p) { // coiled coax with connectors at both ends
      var M = mats(), kind = (p && p.k) || 'bnc', col = kind === 'sma' ? std(0x3a3f45, 0.05, 0.7) : kind === 'leads' ? M.black : std(0x1a1d22, 0.05, 0.7);
      var pts = [[-46, 0, -20]], n = 16, i;
      for (i = 0; i <= n; i++) { var a = i / n * Math.PI * 3.2, rr = 26 - i * 0.6; pts.push([Math.cos(a) * rr, (i / n) * 8 - 4, Math.sin(a) * rr]); }
      pts.push([46, 0, 24]);
      g.add(tube(pts, kind === 'sma' ? 1.6 : kind === 'leads' ? 1.5 : 2.6, col, 120));
      if (kind === 'leads') { g.add(tube(pts.map(function (q) { return [q[0], q[1] + 3, q[2]]; }), 1.5, M.red, 120)); g.add(cy(4, 8, M.copper, -48, 0, -20, 'x', 10)); g.add(cy(4, 8, M.copper, 48, 0, 24, 'x', 10)); }
      else { conn(g, kind, pts[0], pts[1]); conn(g, kind, pts[pts.length - 1], pts[pts.length - 2]); }
    },
    adapters: function (g) { // tray with a BNC T, an SMA-BNC adapter and a terminator
      var M = mats(); g.add(bx(100, 4, 62, M.black, 0, -2, 0)); [[-50, 0, 2, 64], [50, 0, 2, 64]].forEach(function (w) { g.add(bx(w[2], 12, w[3], M.dark, w[0], 4, 0)); }); g.add(bx(100, 12, 2, M.dark, 0, 4, 31)); g.add(bx(100, 12, 2, M.dark, 0, 4, -31));
      g.add(cy(5, 16, M.alu, -22, 10, -8, 'x', 16)); g.add(cy(5, 16, M.alu, -22, 10, -8, 'z', 16)); g.add(cy(4, 8, M.brass, -22, 10, 4, 'z', 12));
      g.add(cy(5, 14, M.alu, 14, 8, 12, 'x', 16)); g.add(cy(3.2, 12, M.brass, 28, 8, 12, 'x', 8)); g.add(cy(5.6, 3, M.knob, 8, 8, 12, 'x', 16));
      g.add(cy(5, 10, M.alu, 12, 8, -14, 'x', 16)); g.add(cy(5.6, 6, M.black, 20, 8, -14, 'x', 16)); g.add(cy(2.2, 3, M.copper, 8, 8, -14, 'x', 8));
    },
    powerstrip: function (g) {
      var M = mats(); g.add(bx(110, 10, 22, M.white, 0, 0, 0));
      for (var i = 0; i < 4; i++) { g.add(bx(14, 1.2, 14, M.dark, -38 + i * 20, 5.4, 0)); g.add(bx(1.4, 1.4, 4, M.black, -40 + i * 20, 5.9, 3)); g.add(bx(1.4, 1.4, 4, M.black, -36 + i * 20, 5.9, 3)); }
      g.add(bx(10, 2, 7, M.red, 52, 6, 0)); g.add(sp(1.6, M.on, 52, 7.5, 7)); g.add(tube([[-55, 0, 0], [-80, -2, 10], [-110, 0, 6]], 2, M.black, 24));
    },
    goggles: function (g) {
      var M = mats();
      [-17, 17].forEach(function (z) {
        var l = cy(15, 2.4, M.amber, 0, 0, z, 'x', 28); l.scale.set(1, 1, 0.78); g.add(l);
        var fr = tr(15, 2.2, M.black, 0, 0, z, Math.PI / 2); fr.scale.set(0.78, 1, 1); g.add(fr);
      });
      g.add(bx(2, 3, 12, M.black, 0, 6, 0)); g.add(bx(8, 4, 6, M.black, 3, -2, 0));
      [-1, 1].forEach(function (s) { g.add(bx(46, 3, 2.4, M.black, -22, 6, s * 34)); g.add(bx(8, 3.4, 3, M.alu, -2, 6, s * 33)); });
      g.add(tube([[-44, 6, -34], [-52, 4, -18], [-52, 4, 18], [-44, 6, 34]], 1.4, M.rubber, 30));
    },
    card: function (g) {
      var M = mats(); g.add(bx(60, 1.6, 40, M.white, 0, 0, 0)); g.add(bx(1.2, 1.7, 30, M.black, -26, 0, 0));
      var dot = new T.Mesh(new T.CircleGeometry(4.4, 24), new T.MeshBasicMaterial({ color: 0x66ff9a, transparent: true, opacity: 0.85 })); dot.rotation.x = -Math.PI / 2; dot.position.set(8, 1, -2); g.add(dot);
      var dot2 = new T.Mesh(new T.CircleGeometry(9, 24), new T.MeshBasicMaterial({ color: 0x66ff9a, transparent: true, opacity: 0.18, depthWrite: false })); dot2.rotation.x = -Math.PI / 2; dot2.position.set(8, 0.95, -2); g.add(dot2);
      g.rotation.z = 0.0; g.position.y = 0;
    },
    camera: function (g) { // NIR beam-profiling camera
      var M = mats(); stand(g);
      g.add(bx(36, 30, 34, M.dark, -4, 0, 0)); g.add(bx(30, 3, 30, M.black, -4, 16.5, 0)); g.add(cy(11, 12, M.black, 20, 0, 0)); g.add(cy(8.6, 4, M.alu, 28, 0, 0)); g.add(cy(7.4, 1.2, M.glass, 30.6, 0, 0));
      g.add(cy(3, 6, M.brass, -22, -6, 8, 'x', 10)); g.add(tube([[-24, -6, 8], [-40, -14, 14], [-56, -24, 8]], 1.4, M.black, 24)); g.add(sp(1.8, M.on, 6, 12, 17.4));
    },
    sign: function (g) {
      var M = mats();
      var tex = canvasTex(256, 256, function (x) {
        x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(128, 18); x.lineTo(244, 226); x.lineTo(12, 226); x.closePath(); x.fill();
        x.lineWidth = 12; x.strokeStyle = '#111'; x.lineJoin = 'round'; x.stroke();
        x.strokeStyle = '#111'; x.lineWidth = 6; for (var a = -50; a <= 50; a += 25) { x.beginPath(); x.moveTo(128, 178); x.lineTo(128 + Math.sin(a * Math.PI / 180) * 80, 178 - Math.cos(a * Math.PI / 180) * 80); x.stroke(); }
        x.fillStyle = '#111'; x.beginPath(); x.arc(128, 178, 12, 0, 7); x.fill();
      });
      g.add(bx(2, 70, 70, M.black, 0, 0, 0));
      var pl = new T.Mesh(new T.PlaneGeometry(66, 66), new T.MeshBasicMaterial({ map: tex, transparent: true })); pl.rotation.y = Math.PI / 2; pl.position.x = 1.2; g.add(pl);
      g.add(sp(3, M.laser, -2, -42, 0)); g.add(bx(2, 12, 28, M.dark, 0, -46, 0)); g.add(sp(2.4, M.on, -2.5, -46, 8));
    },
    cleaning: function (g) {
      var M = mats();
      g.add(cy(9, 40, std(0xe9eef0, 0.05, 0.2, { transparent: true, opacity: 0.6 }), -18, 0, 0, 'y', 24)); g.add(cy(7.6, 22, std(0x9fd0e6, 0, 0.1, { transparent: true, opacity: 0.6, depthWrite: false }), -18, -8, 0, 'y', 24));
      g.add(cy(5, 10, M.blue, -18, 25, 0, 'y', 16)); g.add(cy(2, 9, M.white, -18, 33, 0, 'y', 8));
      g.add(bx(34, 8, 24, M.white, 18, -16, 4)); g.add(bx(30, 1, 20, M.blue, 18, -11.6, 4));
      for (var i = 0; i < 3; i++) g.add(bx(24, 0.8, 16, M.white, 18, -10.6 + i * 0.9, 4 + i * 0.6));
      g.add(cy(1.4, 40, M.alu, 38, -14, -14, 'x', 6)); g.add(sp(2.2, M.white, 58, -14, -14));
    },
    hexkeys: function (g) {
      var M = mats(); g.add(cy(5, 30, M.black, -22, 0, 0, 'z', 16));
      for (var i = 0; i < 7; i++) {
        var L = 30 + i * 3.4, t = 1 + i * 0.16, hue = i % 2 ? M.alu : M.metal;
        var k = new T.Group(); k.position.set(-22, 0, -13 + i * 4.2); k.add(bx(L, t, t, hue, L / 2 - 3, 0, 0)); k.add(bx(t, 10 + i, t, hue, L - 3, (10 + i) / 2, 0)); k.rotation.z = -0.25 - i * 0.07; g.add(k);
      }
      g.add(cy(3, 28, M.red, 52, 4, 0, 'x', 10)); g.add(cy(0.8, 24, M.alu, 76, 4, 0, 'x', 6)); g.rotation.y = 0.2;
    },
    calliper: function (g) {
      var M = mats(); g.add(bx(120, 1.4, 14, M.alu, 0, 0, 0)); for (var i = 0; i <= 24; i++) g.add(bx(0.4, 1.6, i % 5 ? 3 : 6, M.black, -58 + i * 4.8, 0.2, -4));
      g.add(bx(2.4, 1.4, 30, M.alu, -60, 0, 8)); g.add(bx(2.4, 1.4, 30, M.alu, 6, 0, 8)); g.add(bx(26, 3, 15, M.alu, 14, 1.2, 0)); g.add(bx(11, 1, 7, M.screen, 14, 3, 0));
      g.add(bx(100, 0.8, 12, M.yellow, 0, -1.4, 26)); for (var j = 0; j <= 20; j++) g.add(bx(0.4, 0.9, j % 5 ? 3 : 5, M.black, -48 + j * 4.8, -0.9, 22));
      g.add(bx(20, 6, 14, M.white, 70, 0, 28)); g.add(bx(18, 0.6, 12, M.blue, 70, 3.2, 28));
    },
    fp: function (g) { // scanning Fabry–Pérot + controller
      var M = mats(); stand(g);
      g.add(cy(11, 60, M.alu, 0, 0, 0)); g.add(cy(12.4, 6, M.black, -22, 0, 0)); g.add(cy(12.4, 6, M.black, 22, 0, 0)); g.add(cy(9, 2, M.glass, -30, 0, 0)); g.add(cy(9, 2, M.glass, 30, 0, 0));
      g.add(cy(3, 10, M.brass, 0, 12, 0, 'y', 10));
      var c = new T.Group(); c.position.set(0, 0, 66); instrument(c, 56, 24, 40, 'tctrl'); c.position.y += H - 12; g.add(c);
      g.add(tube([[0, 16, 0], [0, 26, 30], [-20, -16, 60]], 1.2, M.black, 20));
    },
    eom: function (g) { var M = mats(); stand(g); g.add(bx(60, 14, 20, M.alu, 0, 0, 0)); g.add(cy(4, 10, M.green, -36, 0, 0)); g.add(cy(4, 10, M.green, 36, 0, 0)); g.add(cy(2.4, 8, M.brass, 0, 10, 0, 'y', 10)); }
  };
  var INSTR = { lctrl: 1, lockbox: 1, fgen: 1, rfgen: 1, rfatt: 1, rfamp: 1, csrc: 1, tctrl: 1, scope: 1, psu: 1, pwrmeter: 1, dmm: 1, sa: 1, wavemeter: 1, laptop: 1, fluxgate: 1, degauss: 1, adapters: 1, powerstrip: 1, cleaning: 1, calliper: 1, hexkeys: 1, enclosure: 1, goggles: 1, foil: 1, sign: 1, cable: 1, solenoid: 1, shield: 1, breadboard: 1, legs: 1, holder: 1, postset: 1, card: 1, rfswitch: 1, coupler: 1, fp: 1 };
  var FRONT_NEG = { osa: 1, lctrl: 1, lockbox: 1, fgen: 1, rfgen: 1, rfatt: 1, rfamp: 1, csrc: 1, tctrl: 1, scope: 1, psu: 1, pwrmeter: 1, dmm: 1, sa: 1, wavemeter: 1, fluxgate: 1, degauss: 1, fp: 1 };
  var LOW_VIEW = { osa: 1, lctrl: 1, lockbox: 1, fgen: 1, rfgen: 1, rfatt: 1, rfamp: 1, csrc: 1, tctrl: 1, scope: 1, psu: 1, pwrmeter: 1, dmm: 1, sa: 1, wavemeter: 1 };
  var TOP_VIEW = { card: 1, foil: 1 };

  function build(name, params) {
    var f = MODELS[name]; if (!f) f = MODELS.mirror;
    var g = new T.Group(); f(g, params || {});
    g.traverse(function (o) { if (o.isMesh && o.material && o.material.transparent) o.renderOrder = 2; });
    return g;
  }

  /* ---- shared offscreen renderer for thumbnails ---- */
  var TW = 336, TH = 252, R = null, cache = {};
  function lights(scene, sx) {
    scene.add(new T.HemisphereLight(0xe6f0f7, 0x1a2228, 0.95));
    var d = new T.DirectionalLight(0xffffff, 0.95); d.position.set(-120, 200, 160); scene.add(d);
    var d2 = new T.DirectionalLight(0xbcd6ff, 0.4); d2.position.set(160, 60, -140); scene.add(d2);
    var d3 = new T.DirectionalLight(0xffffff, 0.55); d3.position.set(sx * 200, 40, 120); scene.add(d3);
  }
  function groundTex() { return canvasTex(128, 128, function (x) { var gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }); }
  function frame(g, name, aspect) {
    var box = new T.Box3().setFromObject(g), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3());
    var rad = Math.max(0.5 * Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z), 8);
    var fov = 28, dist = rad / Math.sin(fov * Math.PI / 360) * (aspect < 1.2 ? 1.0 : 0.8);
    var sx = FRONT_NEG[name] ? -1 : 1, dir = TOP_VIEW[name] ? new T.Vector3(sx * 0.45, 1.0, 0.55) : new T.Vector3(sx * 0.9, LOW_VIEW[name] ? 0.22 : 0.5, LOW_VIEW[name] ? 0.7 : 0.85);
    dir.normalize();
    return { c: c, box: box, rad: rad, fov: fov, pos: c.clone().add(dir.multiplyScalar(dist)) };
  }
  function ensureR() {
    if (R) return R;
    try { R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setSize(TW, TH, false); R.setClearColor(0x000000, 0); }
    catch (e) { R = false; }
    return R;
  }
  function key(name, params) { return name + '|' + JSON.stringify(params || {}); }
  function thumb(name, params) {
    var k = key(name, params); if (cache[k]) return cache[k];
    var r = ensureR(); if (!r) return '';
    var scene = new T.Scene(); lights(scene, FRONT_NEG[name] ? -1 : 1);
    var g = build(name, params); scene.add(g);
    var fr = frame(g, name, TW / TH);
    var gm = new T.Mesh(new T.PlaneGeometry(fr.rad * 2.6, fr.rad * 2.6), new T.MeshBasicMaterial({ map: groundTex(), transparent: true, depthWrite: false }));
    gm.rotation.x = -Math.PI / 2; gm.position.set(fr.c.x, fr.box.min.y - 0.3, fr.c.z); gm.renderOrder = 0; scene.add(gm);
    var cam = new T.PerspectiveCamera(fr.fov, TW / TH, 1, 4000); cam.position.copy(fr.pos); cam.lookAt(fr.c);
    r.render(scene, cam);
    var url = r.domElement.toDataURL('image/png'); cache[k] = url;
    scene.traverse(function (o) { if (o.material && o.material.map && o.material.map !== null && !(o.material.map.__keep)) { try { o.material.map.dispose(); } catch (e) { } } });
    return url;
  }

  /* ---- DOM: thumbnails + viewer ---- */
  var CSS = '.p3d{display:inline-block;width:112px;height:84px;border:1px solid var(--rule-strong,#888);border-radius:3px;background:radial-gradient(ellipse at 50% 35%,#2b3944 0%,#0e1a21 80%);cursor:zoom-in;padding:0;position:relative;overflow:hidden;vertical-align:middle;font:inherit;color:#9fb2bd}' +
    '.p3d img{display:block;width:100%;height:100%;object-fit:contain}.p3d:hover,.p3d:focus-visible{border-color:var(--laser,#c40f2b);outline:2px solid var(--laser,#c40f2b);outline-offset:1px}' +
    '.p3d::after{content:"3D";position:absolute;right:3px;bottom:2px;font:600 .62rem/1 var(--font-mono,monospace);color:#9fb2bd;opacity:.8}' +
    '.p3d.p3d-na{cursor:default}.p3d.p3d-na::after{content:"no WebGL"}' +
    '.p3d-modal{position:fixed;inset:0;z-index:2000;background:rgba(5,8,10,.72);display:flex;align-items:center;justify-content:center;padding:14px}' +
    '.p3d-box{background:var(--surface,#fff);color:var(--ink,#14181c);border:2px solid var(--ink,#14181c);width:min(760px,100%);max-height:100%;display:flex;flex-direction:column}' +
    '.p3d-head{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--rule,#ccc)}.p3d-head h3{margin:0;font-size:1rem;flex:1}' +
    '.p3d-view{position:relative;height:min(52vh,420px);background:radial-gradient(ellipse at 50% 35%,#2b3944 0%,#0e1a21 85%);touch-action:none}.p3d-view canvas{display:block;width:100%;height:100%}' +
    '.p3d-foot{padding:8px 12px;font-size:.84rem;color:var(--muted,#555);display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}.p3d-foot button{font:inherit;padding:3px 9px;border:1px solid var(--rule-strong,#888);background:var(--surface-2,#eee);color:inherit;border-radius:2px;cursor:pointer}' +
    '.p3d-x{font:inherit;font-size:1.1rem;line-height:1;padding:2px 9px;border:1px solid var(--rule-strong,#888);background:var(--surface-2,#eee);color:inherit;border-radius:2px;cursor:pointer}';
  function injectCss() { if (document.getElementById('p3d-css')) return; var s = document.createElement('style'); s.id = 'p3d-css'; s.textContent = CSS; document.head.appendChild(s); }

  var queue = [], busy = false, io = null;
  function pump() {
    if (busy) return; busy = true;
    (function step() {
      var el = queue.shift(); if (!el) { busy = false; return; }
      if (!el.isConnected) { step(); return; }
      var n = el.getAttribute('data-p3d'), p = parse(el.getAttribute('data-p3dp')), url = '';
      try { url = thumb(n, p); } catch (e) { url = ''; }
      setImg(el, url);
      setTimeout(step, 8);
    })();
  }
  function parse(s) { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
  function setImg(el, url) {
    if (!url) { el.classList.add('p3d-na'); return; }
    var img = el.querySelector('img'); if (!img) { img = document.createElement('img'); img.alt = ''; el.insertBefore(img, el.firstChild); }
    img.src = url; el.setAttribute('data-p3d-done', '1');
  }
  function prep(el) {
    if (el.__p3d) return; el.__p3d = 1;
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
    var t = el.getAttribute('data-title') || el.getAttribute('data-p3d');
    el.setAttribute('aria-label', '3D view: ' + t); el.setAttribute('title', 'Click for an interactive 3D view');
    var hit = cache[key(el.getAttribute('data-p3d'), parse(el.getAttribute('data-p3dp')))];
    if (hit) { setImg(el, hit); return; }
    if (io) io.observe(el); else { queue.push(el); pump(); }
  }
  function scan(root) {
    injectCss(); root = root || document;
    if (!io && 'IntersectionObserver' in window) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); if (!e.target.getAttribute('data-p3d-done')) { queue.push(e.target); pump(); } } }); }, { rootMargin: '200px' });
    var els = root.querySelectorAll('.p3d'); for (var i = 0; i < els.length; i++) prep(els[i]);
  }

  var modal = null;
  function openViewer(el) {
    if (modal) closeViewer(); if (!ensureR() || !T.OrbitControls) return;
    var name = el.getAttribute('data-p3d'), p = parse(el.getAttribute('data-p3dp')), title = el.getAttribute('data-title') || name, sub = el.getAttribute('data-sub') || '';
    var wrap = document.createElement('div'); wrap.className = 'p3d-modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', '3D view: ' + title);
    wrap.innerHTML = '<div class="p3d-box"><div class="p3d-head"><h3></h3><button type="button" class="p3d-x" aria-label="Close">×</button></div><div class="p3d-view"></div><div class="p3d-foot"><span>Drag to rotate · scroll or pinch to zoom · right-drag to pan</span><button type="button" class="p3d-spin">Auto-rotate: on</button><button type="button" class="p3d-rst">Reset view</button></div></div>';
    wrap.querySelector('h3').textContent = title + (sub ? ' · ' + sub : '');
    document.body.appendChild(wrap);
    var host = wrap.querySelector('.p3d-view'), rn = new T.WebGLRenderer({ antialias: true }); rn.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); rn.setClearColor(0x0e1a21, 1); host.appendChild(rn.domElement);
    var scene = new T.Scene(); lights(scene, FRONT_NEG[name] ? -1 : 1); var g = build(name, p); scene.add(g);
    var w = host.clientWidth || 600, h = host.clientHeight || 360, fr = frame(g, name, w / h);
    var gm = new T.Mesh(new T.PlaneGeometry(fr.rad * 3, fr.rad * 3), new T.MeshBasicMaterial({ map: groundTex(), transparent: true, depthWrite: false })); gm.rotation.x = -Math.PI / 2; gm.position.set(fr.c.x, fr.box.min.y - 0.3, fr.c.z); scene.add(gm);
    var cam = new T.PerspectiveCamera(fr.fov, w / h, 1, 5000), ctl = new T.OrbitControls(cam, rn.domElement);
    function reset() { cam.position.copy(fr.pos); ctl.target.copy(fr.c); ctl.update(); }
    reset(); ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.minDistance = fr.rad * 0.6; ctl.maxDistance = fr.rad * 8;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; ctl.autoRotate = !reduce; ctl.autoRotateSpeed = 2.2;
    var spin = wrap.querySelector('.p3d-spin'); function lab() { spin.textContent = 'Auto-rotate: ' + (ctl.autoRotate ? 'on' : 'off'); } lab();
    spin.addEventListener('click', function () { ctl.autoRotate = !ctl.autoRotate; lab(); });
    wrap.querySelector('.p3d-rst').addEventListener('click', reset);
    ctl.addEventListener('start', function () { if (ctl.autoRotate) { ctl.autoRotate = false; lab(); } });
    function size() { var W = host.clientWidth, Hh = host.clientHeight; if (!W || !Hh) return; rn.setSize(W, Hh, false); cam.aspect = W / Hh; cam.updateProjectionMatrix(); }
    size(); var ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(host);
    var raf = 0, alive = true; (function loop() { if (!alive) return; raf = requestAnimationFrame(loop); ctl.update(); rn.render(scene, cam); })();
    var last = document.activeElement;
    function key2(e) { if (e.key === 'Escape') closeViewer(); }
    document.addEventListener('keydown', key2);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeViewer(); });
    wrap.querySelector('.p3d-x').addEventListener('click', closeViewer); wrap.querySelector('.p3d-x').focus();
    modal = { wrap: wrap, close: function () { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); document.removeEventListener('keydown', key2); ctl.dispose(); rn.dispose(); try { rn.forceContextLoss(); } catch (e) { } wrap.remove(); if (last && last.focus) last.focus(); } };
  }
  function closeViewer() { if (modal) { var m = modal; modal = null; m.close(); } }
  document.addEventListener('click', function (e) { var el = e.target.closest && e.target.closest('.p3d'); if (el && !el.classList.contains('p3d-na')) { e.preventDefault(); openViewer(el); } });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('p3d')) { e.preventDefault(); openViewer(e.target); } });

  window.Parts3D = { scan: scan, build: build, thumb: thumb, open: openViewer, close: closeViewer, models: Object.keys(MODELS) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); }); else scan();
})();
