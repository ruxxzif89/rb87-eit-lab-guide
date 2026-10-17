/* ==========================================================================
   D1 solenoid: step-by-step 3D build simulator (three.js r128 + OrbitControls).
   Every dimension is in millimetres. The numbers come from window.D1P, which
   private/diy/build_d1sim.py writes from params.py (the single source of the
   DIY Section), so the simulator and the drawings cannot disagree.
   World axes: the solenoid axis is world X (cable end at -X), Y is up, the
   bench top is at Y = -100 (the 100 mm beam height of the optical bench). Coaxial parts are built in a "root" group whose
   local Z is the solenoid axis.
   ========================================================================== */
(function () {
  'use strict';
  var P = window.D1P;
  var view = document.getElementById('sim3d'), canvas = document.getElementById('simcv');
  var panel = document.getElementById('panel'), stepsEl = document.getElementById('steps'), labelsEl = document.getElementById('labels');
  function fail(msg) { panel.innerHTML = '<p><b>The 3D view could not start.</b> ' + msg + '</p>'; }
  if (!P || !window.THREE || !THREE.OrbitControls) { fail('three.js did not load (check the network).'); return; }

  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t); return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }
  function f(x, d) { return Number(x).toFixed(d === undefined ? 2 : d); }
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }

  /* ---------------- renderer, camera, lights ---------------- */
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
  catch (e) { fail('WebGL is not available in this browser.'); return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.localClippingEnabled = true;
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(38, 1, 2, 8000);
  cam.position.set(-170, 150, 330);
  var ctr = new THREE.OrbitControls(cam, canvas);
  ctr.enableDamping = true; ctr.dampingFactor = 0.12; ctr.minDistance = 20; ctr.maxDistance = 2400;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x80868e, 0.85));
  var dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(-300, 600, 400); scene.add(dl);
  var dl2 = new THREE.DirectionalLight(0xffffff, 0.3); dl2.position.set(400, 150, -300); scene.add(dl2);

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true; if (t === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  var darkNow = null;
  function paintBg() {
    var d = isDark(); if (d === darkNow) return; darkNow = d;
    scene.background = new THREE.Color(d ? 0x1f252b : 0xe9edf1);
    view.style.background = d ? '#1f252b' : '#e9edf1';
  }
  paintBg();

  /* ---------------- materials ---------------- */
  var CUT = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);   // keeps world z <= 0: the half nearest the default camera is cut away
  var clipMats = [];
  function mat(color, rough, metal, extra, clip) {
    var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: metal, side: THREE.DoubleSide }, extra || {}));
    if (clip) clipMats.push(m);
    return m;
  }
  var M = {
    former: mat(0xefe9d8, 0.55, 0, null, true), groove: mat(0x3b3226, 0.9, 0), copper: mat(0xc06a32, 0.38, 0.35),
    delrin: mat(0xf7f5ef, 0.5, 0, null, true), spacer: mat(0xe6e3d9, 0.5, 0, null, true), notch: mat(0x30343a, 0.8, 0),
    shield: mat(0xc3cad1, 0.35, 0.3, { transparent: true, opacity: 0.55, depthWrite: false }, true),
    cap: mat(0xb2bac2, 0.35, 0.3, { transparent: true, opacity: 0.7, depthWrite: false }, true),
    ghost: mat(0xefe9d8, 0.6, 0, { transparent: true, opacity: 0.35, depthWrite: false }, true),
    quartz: mat(0xcfe8ff, 0.05, 0, { transparent: true, opacity: 0.3, depthWrite: false }),
    rb: mat(0xd9d9d2, 0.25, 0.4), foam: mat(0xd5d8cc, 0.95, 0, null, true), ntc: mat(0x151515, 0.4, 0),
    red: mat(0xc0392b, 0.5, 0), black: mat(0x202428, 0.6, 0), grey: mat(0x7d858d, 0.5, 0.2), dgrey: mat(0x4a5058, 0.6, 0.2),
    steel: mat(0xa3aab1, 0.35, 0.4), brass: mat(0xd2ab55, 0.35, 0.4), alu: mat(0xd0d6dc, 0.4, 0.3),
    pcb: mat(0x2e7d4f, 0.6, 0), yellow: mat(0xf0c419, 0.5, 0), wood: mat(0xa77b4f, 0.8, 0), bench: mat(0x8e979f, 0.9, 0),
    glue: mat(0xf3d27a, 0.2, 0, { transparent: true, opacity: 0.8 }), orange: mat(0xe8742b, 0.5, 0, { emissive: 0x000000 }),
    white: mat(0xfafafa, 0.6, 0), blue: mat(0x2f6db3, 0.5, 0), plastic: mat(0x3a4048, 0.6, 0), felt: mat(0x6b3b2a, 0.95, 0),
    solder: mat(0xdde0e4, 0.3, 0.4), tape: mat(0xd9901f, 0.45, 0, { transparent: true, opacity: 0.85 }), lathe: mat(0x5f7f95, 0.55, 0.3),
    hot: mat(0xd4861a, 0.45, 0, { transparent: true, opacity: 0.8, emissive: 0x000000 }, true)
  };
  var cutOn = false;
  function setCut(on) {
    if (on === cutOn) return; cutOn = on;
    clipMats.forEach(function (m) { m.clippingPlanes = on ? [CUT] : []; m.needsUpdate = true; });
  }

  /* ---------------- geometry helpers ---------------- */
  function shellGeo(ri, ro, len, segs) {   // a tube along Z, centred
    var pts = [new THREE.Vector2(ri, -len / 2), new THREE.Vector2(ro, -len / 2), new THREE.Vector2(ro, len / 2), new THREE.Vector2(ri, len / 2), new THREE.Vector2(ri, -len / 2)];
    var g = new THREE.LatheGeometry(pts, segs || 72); g.rotateX(Math.PI / 2); return g;
  }
  function add(o, parent, x, y, z) { o.position.set(x || 0, y || 0, z || 0); (parent || scene).add(o); return o; }
  function mesh(g, m, parent, x, y, z) { return add(new THREE.Mesh(g, m), parent, x, y, z); }
  function box(w, h, d, m, parent, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), m, parent, x, y, z); }
  function cyl(r1, r2, len, axis, m, parent, x, y, z, segs) {
    var g = new THREE.CylinderGeometry(r1, r2, len, segs || 32);
    if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    return mesh(g, m, parent, x, y, z);
  }
  function group(parent, x, y, z) { return add(new THREE.Group(), parent, x, y, z); }
  var UNITCYL = new THREE.CylinderGeometry(1, 1, 1, 10);
  function rod(r, m, parent) { var o = new THREE.Mesh(UNITCYL, m); o.userData.r = r; (parent || scene).add(o); return o; }
  var _up = V(0, 1, 0);
  function stretch(o, a, b) {
    var d = new THREE.Vector3().subVectors(b, a), L = d.length();
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(o.userData.r, Math.max(L, 1e-3), o.userData.r);
    if (L > 1e-6) o.quaternion.setFromUnitVectors(_up, d.normalize());
  }
  function segLine(a, b, r, m, parent) { var o = rod(r, m, parent); stretch(o, a, b); return o; }

  function Display(w, h, bg, fg) {      // a small LCD made from a canvas texture
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.max(32, Math.round(256 * h / w));
    var tx = new THREE.CanvasTexture(cv);
    var pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx }));
    var last = null;
    function set(s) {
      if (s === last) return; last = s;
      var c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = fg; c.font = 'bold ' + Math.round(cv.height * 0.5) + 'px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s, cv.width / 2, cv.height / 2); tx.needsUpdate = true;
    }
    set(''); return { mesh: pl, set: set };
  }

  /* ---------------- the bench ---------------- */
  box(1200, 12, 760, M.bench, scene, 0, -106, 60);
  var grid = new THREE.GridHelper(1200, 48, 0x7b848c, 0x9aa2aa); grid.position.set(0, -99.9, 60); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);

  /* ---------------- coaxial parts (root: local Z = solenoid axis = world X) ---------------- */
  var root = group(scene); root.rotation.y = Math.PI / 2;
  var spin = group(root);          // turns with the former (lathe, winding rig)

  var NT = P.N, SEG = 64, STARTS = P.starts, PITCH = P.pitches;
  function helixZ(t) {
    if (t <= 0) return STARTS[0];
    if (t >= NT) return STARTS[NT - 1] + PITCH[NT - 1];
    var k = Math.floor(t); return STARTS[k] + PITCH[k] * (t - k);
  }
  class HelixCurve extends THREE.Curve {
    constructor(r) { super(); this.r = r; }
    getPoint(u, tgt) { tgt = tgt || new THREE.Vector3(); var t = u * NT, th = TAU * t; return tgt.set(this.r * Math.cos(th), this.r * Math.sin(th), helixZ(t)); }
    getPointAt(u, tgt) { return this.getPoint(u, tgt); }
    getTangentAt(u, tgt) { return this.getTangent(u, tgt); }
  }
  var RO = P.formerOD / 2, RI = P.formerID / 2;
  var former = mesh(shellGeo(RI, RO, P.formerL), M.former, spin);
  var grooveGeo = new THREE.TubeGeometry(new HelixCurve(RO - P.grooveDepth / 2 - 0.05), NT * SEG, P.grooveW / 2, 6, false);
  var groove = mesh(grooveGeo, M.groove, spin);
  var wireGeo = new THREE.TubeGeometry(new HelixCurve(P.a), NT * SEG, P.wireOD / 2, 6, false);
  var wire = mesh(wireGeo, M.copper, spin);
  var PER_SEG = 6 * 6;
  var midRing = mesh(new THREE.TorusGeometry(RO + 0.02, 0.18, 6, 96), M.dgrey, spin);
  var cableBand = mesh(new THREE.TorusGeometry(RO + 0.05, 0.45, 6, 96), M.red, spin, 0, 0, -P.formerL / 2 + 2.5);
  var startStub = segLine(V(P.a, 0, P.starts[0]), V(P.a, 0, -P.formerL / 2 - 12), 0.3, M.red, spin);
  // marker dots between the grooves at every tenth turn, glue drops on the end turns and every tenth turn
  var dots = [10, 20, 30, 40].map(function (k) {
    var th = Math.PI / 4, t = k - 1 + th / TAU, z = helixZ(t) + PITCH[k - 1] / 2;
    return mesh(new THREE.SphereGeometry(0.7, 10, 8), M.black, spin, (RO + 0.05) * Math.cos(th), (RO + 0.05) * Math.sin(th), z);
  });
  var glueTurns = [1, 2, 3, 10, 20, 30, 40, 41, 42];
  var glues = glueTurns.map(function (k) {
    var th = 3 * Math.PI / 4, t = k - 1 + th / TAU;
    return mesh(new THREE.SphereGeometry(0.95, 10, 8), M.glue, spin, P.a * Math.cos(th), P.a * Math.sin(th), helixZ(t));
  });
  // two return wires at 90 and 270 degrees, with their end arcs, solder joints and Kapton tapes
  var RR = RO + 0.55, ZF = STARTS[NT - 1] + PITCH[NT - 1] + 1.1, ZC = STARTS[0] - 1.4;
  var returns = [Math.PI / 2, -Math.PI / 2].map(function (th) {
    var g = group(spin); g.rotation.z = th;
    var straight = rod(0.275, M.copper, g);
    var arcF = mesh(new THREE.TorusGeometry(RR, 0.275, 6, 24, Math.PI / 2), M.copper, g, 0, 0, ZF); arcF.rotation.z = th > 0 ? -Math.PI / 2 : 0;
    var arcC = mesh(new THREE.TorusGeometry(RR, 0.275, 6, 24, Math.PI / 2), M.copper, g, 0, 0, ZC); arcC.rotation.z = th > 0 ? -Math.PI / 2 : 0;
    var tapes = [-60, -20, 20, 60].map(function (z) { return box(6, 0.25, 6, M.tape, g, RR + 0.35, 0, z); });
        return { g: g, straight: straight, arcF: arcF, arcC: arcC, tapes: tapes };
  });
  // the returns are drawn in a group rotated by th: local x of the group is the return's radial direction
  returns.forEach(function (r) { r.tapes.forEach(function (t) { t.geometry = new THREE.BoxGeometry(0.3, 8, 6); }); });
  var jointF = mesh(new THREE.SphereGeometry(1.1, 12, 10), M.solder, spin, RR, 0, ZF);
  var jointC = mesh(new THREE.SphereGeometry(1.1, 12, 10), M.solder, spin, RR, 0, ZC);
  // spacer rings (Delrin, OD = shield bore - 0.5); the cable-end ring has a notch for the leads, both have a flat for the D4 bundle
  var SP_RO = Math.min(P.boreMin / 2 - 0.25, 22.75);
  var spacers = [-1, 1].map(function (s) {
    var g = group(spin, 0, 0, s * 75);
    mesh(shellGeo(RO, SP_RO, 6), M.spacer, g);
    if (s < 0) box(1.6, 2.6, 6.2, M.notch, g, RO + 0.7, 0, 0);
    return g;
  });

  /* former ghost for the fit check */
  var ghost = group(root);
  mesh(shellGeo(RI, RO + 2 * P.wireOD / 2 + 0.05, P.formerL), M.ghost, ghost);

  /* cell stack (D2) */
  var stack = group(root);
  var cellG = group(stack);
  var CR = P.cellD / 2;
  mesh(shellGeo(CR - 1.0, CR, P.cellL), M.quartz, cellG);
  [-1, 1].forEach(function (s) { var w = mesh(new THREE.CircleGeometry(CR, 48), M.quartz, cellG, 0, 0, s * P.cellL / 2); });
  /* torch-sealed stem (tip-off) at mid-length, pointing up; the Rb droplet sits at its base, the cold spot */
  var stemG = new THREE.CylinderGeometry(0.7, P.stemD / 2, P.stemH, 24); mesh(stemG, M.quartz, cellG, 0, CR + P.stemH / 2 - 0.3, 0);
  mesh(new THREE.SphereGeometry(1.0, 12, 10), M.rb, cellG, 0, CR + 0.6, 0);
  var heaterTex = (function () {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; var c = cv.getContext('2d');
    c.fillStyle = '#d4861a'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#5a3208'; c.lineWidth = 2;
    for (var i = 0; i < 15; i++) { var x = 512 * (i + 0.5) / 15; [-3, 3].forEach(function (d) { c.beginPath(); c.moveTo(x + d, 6); c.lineTo(x + d, 122); c.stroke(); }); }
    var tx = new THREE.CanvasTexture(cv); return tx;
  })();
  M.hot.map = heaterTex; M.hot.needsUpdate = true;
  var heater = mesh(new THREE.BufferGeometry(), M.hot, stack); var heaterLast = -1;
  function setHeater(p) {
    var q = Math.round(p * 50) / 50; if (q === heaterLast) return; heaterLast = q;
    heater.geometry.dispose();
    if (q <= 0) { heater.geometry = new THREE.BufferGeometry(); return; }
    var gapA = TAU * (1 - P.foilW / P.circ);   /* the film leaves a strip free under the stem (+y) */
    var g = new THREE.CylinderGeometry(CR + 0.2, CR + 0.2, 25, 64, 1, true, Math.PI + gapA / 2, (TAU - gapA) * q); g.rotateX(Math.PI / 2); heater.geometry = g;
  }
  var ntc = mesh(new THREE.SphereGeometry(1.2, 12, 10), M.ntc, stack, 0, -CR - 0.6, P.cellL / 2 - 5);   /* under the heater, opposite the stem */
  var foam = mesh(shellGeo(12.8, 15.8, 34), M.foam, stack);
  var tubeA = group(stack), tubeB = group(stack);
  mesh(shellGeo(13.25, 16.85, 63), M.delrin, tubeA); box(2.2, 2.2, 63.2, M.notch, tubeA, 0, 16.0, 0);
  mesh(shellGeo(13.25, 16.85, 63), M.delrin, tubeB);
  var stackLeads = group(stack);
  segLine(V(0.6, 16.0, -12), V(0.6, 16.0, -80), 0.45, M.red, stackLeads);
  segLine(V(-0.6, 16.0, -6), V(-0.6, 16.0, -80), 0.45, M.blue, stackLeads);
  segLine(V(0, 16.0, -80), V(0, 16.0, -170), 0.6, M.black, stackLeads);
  var cradle = group(scene);
  [-45, 45].forEach(function (dx) { box(12, 83, 30, M.delrin, cradle, 330 + dx, -58.5, 160); });

  /* fluxgate plate (D7): Delrin plate with the FLC100 board at the centre */
  var plate = group(root);
  box(28, 3, 150, M.delrin, plate);
  box(14, 5.5, 44.5, M.pcb, plate, 0, 4.2, 0);
  segLine(V(0, 2.5, -22), V(0, 2.5, -75), 0.5, M.black, plate);
  segLine(V(0, 2.5, -75), V(0, 16, -92), 0.5, M.black, plate);
  segLine(V(0, 16, -92), V(0, 16, -170), 0.5, M.black, plate);

  /* the three shield layers (assumed sizes, see the page note); each end cap has a beam hole on the axis and a cable hole 16 mm above it */
  var LAYERS = [[23, 24, 250], [28, 29, 266], [33, 34, 282]];
  var layers = LAYERS.map(function (L) {
    var g = group(root);
    var tube = mesh(shellGeo(L[0], L[1], L[2]), M.shield, g);
    var caps = [-1, 1].map(function (s) {
      var c = group(root);
      var sh = new THREE.Shape(); sh.absarc(0, 0, L[1] + 0.6, 0, TAU, false);
      var hb = new THREE.Path(); hb.absarc(0, 0, P.beamHole / 2, 0, TAU, true); sh.holes.push(hb);
      var hc = new THREE.Path(); hc.absarc(0, P.cableR, P.cableHole / 2, 0, TAU, true); sh.holes.push(hc);
      var dg = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false, curveSegments: 48 }); dg.translate(0, 0, -0.5);
      mesh(dg, M.cap, c, 0, 0, s * 0.5);
      mesh(shellGeo(L[1] + 0.0, L[1] + 0.6, 10), M.cap, c, 0, 0, -s * 4);
      c.userData.home = s * (L[2] / 2);
      c.userData.s = s;
      return c;
    });
    return { g: g, tube: tube, caps: caps, L: L };
  });

  /* degaussing coil (D4): flat bundle in the bore, out through the cable holes, three return groups outside */
  var dcoil = group(root);
  (function () {
    var phc = 0, w = 39 / 21.9;                       // inner flat bundle at the side of the bore (90 deg from the cable hole)
    var sheet = new THREE.CylinderGeometry(21.9, 21.9, 236, 24, 1, true, phc + Math.PI / 2 - w / 2, w);
    sheet.rotateX(Math.PI / 2);
    mesh(sheet, M.orange, dcoil);
    function pt(r, ph, z) { return V(r * Math.cos(ph), r * Math.sin(ph), z); }
    var top = Math.PI / 2, groups = [top, top + TAU / 3, top + 2 * TAU / 3];
    [-1, 1].forEach(function (s) {
      segLine(pt(21.9, phc, s * 118), pt(19.5, Math.PI / 4, s * 118), 1.6, M.orange, dcoil);
      segLine(pt(19.5, Math.PI / 4, s * 118), pt(P.cableR, top, s * 118), 1.6, M.orange, dcoil);
      segLine(pt(P.cableR, top, s * 118), pt(P.cableR, top, s * 152), 3.0, M.orange, dcoil);     // round bundle through the cable holes
      segLine(pt(P.cableR, top, s * 152), pt(37, top, s * 152), 2.0, M.orange, dcoil);
      groups.forEach(function (ph) {                                                         // round the end, outside the cap, to each group
        var n = 8, prev = pt(37, top, s * 152);
        for (var i = 1; i <= n; i++) { var a = top + (ph - top) * i / n, q = pt(37, a, s * 152); segLine(prev, q, 1.4, M.orange, dcoil); prev = q; }
      });
    });
    groups.forEach(function (ph) { segLine(pt(37, ph, -152), pt(37, ph, 152), 1.4, M.orange, dcoil); });
  })();
  /* printed shield cradle (BOM M06): two saddles on a base, the shield axis at the 100 mm beam height */
  var shCradle = group(scene);
  box(210, 8, 90, M.delrin, shCradle, 0, -96, 0);
  [-85, 85].forEach(function (x) { box(16, 65, 52, M.delrin, shCradle, x, -67.5, 0); box(16, 1, 40, M.felt, shCradle, x, -34.6, 0); });

  /* ---------------- leads, plug and instruments (world) ---------------- */
  function twisted(pts, pitch, sep, colA, colB) {
    var path = new THREE.CatmullRomCurve3(pts.map(function (p) { return V(p[0], p[1], p[2]); }), false, 'catmullrom', 0.2);
    var L = path.getLength(), n = Math.max(40, Math.ceil(L / 1.5));
    var fr = path.computeFrenetFrames(n, false), A = [], B = [];
    for (var i = 0; i <= n; i++) {
      var u = i / n, Pt = path.getPointAt(u), N = fr.normals[i], Bn = fr.binormals[i], ph = TAU * u * L / pitch;
      var off = N.clone().multiplyScalar(Math.cos(ph) * sep / 2).addScaledVector(Bn, Math.sin(ph) * sep / 2);
      A.push(Pt.clone().add(off)); B.push(Pt.clone().sub(off));
    }
    var g = group(scene);
    var ta = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(A), n, 0.33, 5, false);
    var tb = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(B), n, 0.33, 5, false);
    mesh(ta, colA, g); mesh(tb, colB, g);
    return { g: g, geos: [ta, tb], n: n, set: function (frac) { var c = Math.floor(clamp(frac) * n) * 5 * 6; ta.setDrawRange(0, c); tb.setDrawRange(0, c); } };
  }
  var X0 = P.starts[0];
  var leads = twisted([[X0, RO + 0.3, 0], [-80, RO + 0.3, 0], [-92, 17, 0], [-110, 16, 0], [-165, 16, 0], [-185, 0, 15], [-203, -45, 42], [-213, -70, 53]], 20, 1.1, M.red, M.copper);
  var plug = group(scene, -219, -76, 56);
  box(26, 12, 36, M.plastic, plug); box(31, 4, 18, M.steel, plug, -15, 0, 0);
  var plugTxt = Display(24, 8, '#3a4048', '#ffffff'); plugTxt.set('LD OUT'); plugTxt.mesh.rotation.x = -Math.PI / 2; add(plugTxt.mesh, plug, 0, 6.2, 0);

  /* lathe (for the former and the groove) */
  var lathe = group(scene);
  box(400, 24, 80, M.lathe, lathe, 0, -48, -15);
  box(380, 40, 70, M.dgrey, lathe, 0, -80, -15);
  box(70, 120, 90, M.lathe, lathe, -165, 0, -15);
  cyl(30, 30, 26, 'x', M.steel, lathe, -110, 0, 0);
  [0, 1, 2].forEach(function (i) { var j = box(8, 8, 14, M.steel, lathe, -94, 0, 0); var a = i * TAU / 3; j.position.y = 22 * Math.cos(a); j.position.z = 22 * Math.sin(a); j.rotation.x = -a; });
  box(60, 85, 70, M.lathe, lathe, 175, -17, -15);
  cyl(9, 9, 50, 'x', M.steel, lathe, 128, 0, 0);
  (function () { var g = new THREE.ConeGeometry(12, 20, 24); g.rotateZ(Math.PI / 2); mesh(g, M.steel, lathe, 93, 0, 0); })();
  var carriage = group(lathe);
  box(46, 18, 60, M.lathe, carriage, 0, -27, 34);
  box(16, 26, 16, M.dgrey, carriage, 0, -10, 34);
  box(3, 3, 13, M.steel, carriage, 0, 0, 25.5);

  /* winding rig */
  var rig = group(scene);
  [-1, 1].forEach(function (s) { box(14, 100, 50, M.wood, rig, s * 122, -50, 0); });
  cyl(3, 3, 310, 'x', M.brass, rig, 0, 0, 0);
  [-1, 1].forEach(function (s) { var g = new THREE.CylinderGeometry(6, RI, 12, 32); g.rotateZ(s * Math.PI / 2); mesh(g, M.delrin, rig, s * 86, 0, 0); });
  var crank = group(rig, -145, 0, 0);
  box(5, 42, 7, M.steel, crank, 0, 21, 0); cyl(4, 4, 26, 'x', M.wood, crank, -14, 40, 0);
  var spool = group(rig, 0, 140, -95);
  cyl(15, 15, 30, 'x', M.copper, spool); [-1, 1].forEach(function (s) { cyl(23, 23, 3, 'x', M.plastic, spool, s * 16.5, 0, 0); });
  box(10, 7, 20, M.felt, spool, 0, 18.5, 0);
  box(8, 240, 8, M.wood, rig, 0, 17, -95);
  var weight = box(12, 16, 12, M.steel, rig, 9, 2, -95); weight.visible = false;
  var feed = rod(0.3, M.copper, scene);

  /* calliper */
  var cal = group(scene);
  box(220, 16, 3.5, M.alu, cal, 90, 0, 0);
  box(6, 42, 3.5, M.alu, cal, -3, -21, 0);
  var calSlide = group(cal);
  box(40, 26, 9, M.alu, calSlide, 20, 0, 1);
  box(6, 42, 3.5, M.alu, calSlide, 3, -21, 0);
  var calDisp = Display(30, 12, '#c9d6c3', '#111'); add(calDisp.mesh, calSlide, 22, 3, 5.6);

  /* compass and the tray of items for the magnetic test */
  var tray = group(scene);
  var compass = group(tray, 0, -95, 300);
  cyl(24, 24, 6, null, M.white, compass); cyl(25, 25, 2, null, M.dgrey, compass, 0, -2, 0);
  var needle = group(compass, 0, 4, 0);
  box(18, 1.5, 3, M.red, needle, 9, 0, 0); box(18, 1.5, 3, M.white, needle, -9, 0, 0);
  var ITEMS = [
    { id: 'screwdriver', name: 'Steel screwdriver', mag: true, x: -240, z: 140 },
    { id: 'brassTw', name: 'Brass tweezers', mag: false, x: -110, z: 140 },
    { id: 'plasticTw', name: 'Plastic tweezers', mag: false, x: 0, z: 140 },
    { id: 'rule', name: 'Steel rule', mag: true, x: 120, z: 140 },
    { id: 'rod', name: 'Delrin bar for the former', mag: false, x: 250, z: 140 },
    { id: 'reel', name: 'Enamelled copper wire', mag: false, x: -200, z: 215 },
    { id: 'hoodNi', name: 'D-sub hood, nickel-plated', mag: true, x: -80, z: 215 },
    { id: 'hoodPl', name: 'D-sub hood, plastic', mag: false, x: 40, z: 215 },
    { id: 'screws', name: 'Steel M3 screws', mag: true, x: 160, z: 215 }];
  ITEMS.forEach(function (it) {
    var g = group(tray, it.x, -100, it.z); g.userData.item = it; it.g = g;
    switch (it.id) {
      case 'screwdriver': cyl(8, 8, 55, 'x', M.red, g, -30, 8, 0); cyl(2.5, 2.5, 70, 'x', M.steel, g, 32, 8, 0); break;
      case 'brassTw': box(70, 2, 5, M.brass, g, 0, 2, -3).rotation.y = 0.06; box(70, 2, 5, M.brass, g, 0, 2, 3).rotation.y = -0.06; break;
      case 'plasticTw': box(65, 2.5, 5, M.blue, g, 0, 2, -3).rotation.y = 0.06; box(65, 2.5, 5, M.blue, g, 0, 2, 3).rotation.y = -0.06; break;
      case 'rule': box(150, 1, 18, M.steel, g, 0, 1, 0); break;
      case 'rod': cyl(20, 20, 70, 'x', M.delrin, g, 0, 20, 0); break;
      case 'reel': cyl(18, 18, 26, 'x', M.copper, g, 0, 24, 0); [-1, 1].forEach(function (s) { cyl(24, 24, 3, 'x', M.plastic, g, s * 14, 24, 0); }); break;
      case 'hoodNi': box(31, 12, 40, M.steel, g, 0, 6, 0); break;
      case 'hoodPl': box(31, 12, 40, M.plastic, g, 0, 6, 0); break;
      case 'screws': for (var i = 0; i < 6; i++) cyl(1.5, 1.5, 10, 'x', M.steel, g, (i % 3) * 7 - 7, 2, (i < 3 ? -4 : 4)); break;
    }
  });
  var bin = group(tray, 260, -100, 300); box(70, 4, 60, M.dgrey, bin, 0, 2, 0);

  /* soldering iron, marker, glue bottle, tape */
  var iron = group(scene);
  cyl(6, 6, 80, 'x', M.blue, iron, 48, 0, 0); cyl(1.2, 0.4, 28, 'x', M.steel, iron, 0, 0, 0);
  var marker = group(scene);
  cyl(4, 4, 70, null, M.black, marker, 0, 38, 0); cyl(1.5, 0.5, 6, null, M.black, marker, 0, 1, 0);
  var bottle = group(scene);
  cyl(6, 6, 20, null, M.white, bottle, 0, 18, 0); (function () { var g = new THREE.ConeGeometry(6, 9, 16); g.rotateX(Math.PI); mesh(g, M.white, bottle, 0, 4, 0); })();
  var tapeRoll = mesh(new THREE.TorusGeometry(14, 4, 10, 32), M.tape, scene, 60, -93, 120); tapeRoll.rotation.x = Math.PI / 2;

  /* multimeter, ITC502, fluxgate meter, stand, B arrows */
  var dmm = group(scene, -280, -35, 120);
  box(75, 130, 32, M.yellow, dmm); var dmmDisp = Display(56, 22, '#bfcbb5', '#111'); add(dmmDisp.mesh, dmm, 0, 35, 16.2);
  var probeR = rod(0.8, M.red, scene), probeB = rod(0.8, M.black, scene);
  var itc = group(scene, -360, -55, -110);
  box(220, 90, 250, M.grey, itc); var itcDisp = Display(110, 26, '#101418', '#ffb347'); add(itcDisp.mesh, itc, -25, 15, 125.2);
  var itcName = Display(60, 12, '#7d858d', '#ffffff'); itcName.set('ITC502'); add(itcName.mesh, itc, 60, 28, 125.2);
  var itcCable = rod(1.2, M.black, scene);
  var fgm = group(scene, -205, -80, 140);
  box(80, 40, 46, M.black, fgm); var fgDisp = Display(64, 18, '#bfcbb5', '#111'); add(fgDisp.mesh, fgm, 0, 4, 23.2);
  var fgName = Display(64, 8, '#202428', '#ffffff'); fgName.set('fluxgate (D7)'); add(fgName.mesh, fgm, 0, -12, 23.2);
  var stand = group(scene);
  [-58, 58].forEach(function (x) { box(26, 81, 44, M.delrin, stand, x, -59.5, 0); });
  var arrows = group(scene);
  [-7, 0, 7].forEach(function (y) { var a = new THREE.ArrowHelper(V(1, 0, 0), V(-45, y, 0), 90, 0xc0392b, 14, 7); arrows.add(a); });
  var bplus = group(scene, 0, RO + 3, 0);
  cyl(0.9, 0.9, 50, 'x', M.red, bplus); (function () { var g = new THREE.ConeGeometry(2.6, 8, 16); g.rotateZ(-Math.PI / 2); mesh(g, M.red, bplus, 29, 0, 0); })();

  /* ---------------- build state ---------------- */
  var STACK_REST = 330, SZ = 160;
  function base() {
    return {
      former: false, formerLen: 0, groove: 0, mid: false, cableMark: false, spin: Math.PI / 2, spinRun: false,
      lathe: false, toolX: null, rig: false, feed: false, wound: 0, glue: 0, ret: 0, tapes: 0, jF: false, jC: false,
      leads: 0, plug: false, spacers: 0, stand: false, plate: null, field: 0, bplus: false,
      cell: false, stack: STACK_REST, stackX: -SZ, heater: 0, ntc: false, foam: 0, tubes: 0, glow: 0,
      lay: [{ z: null, a: 0, b: 0 }, { z: null, a: 0, b: 0 }, { z: null, a: 0, b: 0 }], dcoil: false, dpulse: 0, shCradle: false,
      ghost: false, cal: null, tray: false, iron: null, marker: null, bottle: null, tape: false,
      dmm: null, itc: null, fg: null, cut: false, crank: 0
    };
  }

  /* ---------------- the steps ---------------- */
  var unpaired = P.unpaired, kF = P.kFree;
  var EARTH = 284.6;                          // example axial Earth component on the bench, mG
  var K_SHIELD = +(kF * 1.035).toFixed(3);    // example: the shield pulls the flux in a little
  var B_RES = 0.6;                            // example residual field after degaussing, mG
  var STEPS = [
    { ch: 'Before you start', t: 'Confirm the shield size',
      what: 'Ask the maker, or read the drawing, for the <b>innermost bore</b>, the <b>inner length</b> and the <b>end-cap holes</b>: a Ø14 mm beam hole on the axis and a Ø12 mm cable hole 16 mm above it, lined up in all three caps at both ends. The former with its winding is Ø' + f(P.formerOD + 2 * P.wireOD, 1) + ' mm; in a Ø' + f(P.boreMin, 0) + ' mm bore that leaves ' + f(P.clearRadial) + ' mm all round. The layers here are drawn with assumed sizes.',
      check: 'Bore ≥ Ø' + f(P.boreMin, 0) + ' mm, inner length ≥ 250 mm, beam hole Ø14 and cable hole Ø12, in writing.',
      mistake: 'A smaller bore needs a thinner former and a new field calculation: the winding radius enters the field directly.',
      parts: ['Shield drawing'], tools: ['Calliper'],
      act: { type: 'auto', label: 'Show the fit', dur: 3 }, cut: true, cam: [-200, 170, 360, 0, 0, 0],
      scene: function (S, p) { S.ghost = true; S.cut = true; for (var k = 0; k < 3; k++) { var q = seg(p, k * 0.3, k * 0.3 + 0.3); if (q > 0) { S.lay[k].z = 0; S.lay[k].a = S.lay[k].b = q; } } },
      labels: function (S, p) { return [{ t: 'bore ≥ Ø46 (inner layer)', p: [60, -23, 0] }, { t: 'inner length ≥ 250', p: [125, 30, 0] }, { t: 'beam hole Ø14 + cable hole Ø12', p: [-141, 24, 0] }, { t: 'former + winding Ø' + f(P.formerOD + 2 * P.wireOD, 1), p: [0, 22, 0], c: 'hot' }, { t: 'clearance ' + f(P.clearRadial) + ' mm', p: [-30, -21, 0] }]; },
      quiz: { q: 'The maker says the innermost bore is Ø44 mm. What do you do?', o: ['Wind the coil anyway: 1 mm less clearance is fine', 'Make a thinner former and recalculate the field before cutting', 'Sand the spacer rings down until it fits'], a: 1, why: 'Ø' + f(P.formerOD + 2 * P.wireOD, 1) + ' mm of winding plus the spacer rings do not fit in Ø44, and a smaller winding radius changes the field per mA and the uniformity: the design must be recalculated.' } },

    { ch: 'Before you start', t: 'Test every part and tool with a compass',
      what: 'Anything magnetic near the former or the shield magnetises it and shifts the field by far more than 0.1 mG. Bring each item close to the compass. <b>Click every item that moves the needle</b> to set it aside.',
      check: 'Only non-magnetic items are left: plastic, brass, copper, Delrin.',
      mistake: 'Steel tools, steel screws or nickel-plated connector shells near the former or the shield.',
      parts: ['All parts of D1 and D2'], tools: ['Compass'],
      act: { type: 'pick' }, cam: [0, 420, 600, 10, -50, 210],
      scene: function (S, p) { S.tray = true; },
      labels: function () { return ITEMS.map(function (it) { var picked = ui[1].picked && ui[1].picked[it.id]; return { t: picked ? it.name + ': magnetic' : it.name, p: [it.g.position.x, it.z < 200 ? -18 : -28, it.g.position.z + (it.z < 200 ? -22 : 26)], c: picked ? 'hot' : 'dim' }; }); } },

    { ch: 'The former', t: 'Turn the former tube',
      what: 'Turn a bar of PEEK, Delrin (acetal) or PETG to <b>Ø' + f(P.formerOD, 1) + ' outside, Ø' + f(P.formerID, 1) + ' bore, ' + f(P.formerL, 0) + ' long</b> (wall 2.0). No metal inserts, no steel pins left in it. A 3D print in PETG is also allowed if the workshop can hold the groove tolerance.',
      check: 'Wall 2.0 ± 0.1 mm all round; ends square.',
      parts: ['PEEK / Delrin / PETG bar'], tools: ['Lathe (or CNC / 3D printer)', 'Calliper'],
      act: { type: 'auto', label: 'Turn the tube', dur: 3 }, cam: [-90, 140, 330, 0, 0, 0],
      apply: function (S, p) { S.former = true; S.formerLen = P.formerL * Math.max(0.05, ease(p)); },
      scene: function (S, p) { S.lathe = true; S.spinRun = p < 1; },
      labels: function () { return [{ t: 'Ø' + f(P.formerOD, 1) + ' / Ø' + f(P.formerID, 1) + ' × ' + f(P.formerL, 0), p: [0, 24, 0] }]; } },

    { ch: 'The former', t: 'Cut the helical groove',
      what: 'One right-hand helix, <b>' + f(P.grooveW, 2) + ' wide × ' + f(P.grooveDepth, 2) + ' deep</b>, edges rounded (a sharp edge cuts the enamel). From the cable end: <b>3 turns at 1.8 mm, 36 turns at 3.6 mm, 3 turns at 1.8 mm</b>, starting ' + f(-P.starts[0], 1) + ' mm before the mid-plane and ending ' + f(-P.starts[0], 1) + ' mm after it (' + f(P.grooveLen, 1) + ' mm in all). The closer end turns make up for the field that falls off at the ends of a finite coil.',
      check: 'Groove from z = ' + f(P.starts[0], 1) + ' to +' + f(-P.starts[0], 1) + ' mm; no burrs.',
      parts: [], tools: ['Lathe with thread cutting (or CNC)'],
      act: { type: 'auto', label: 'Cut the groove', dur: 7 }, cam: [-40, 110, 260, 0, 0, 0],
      apply: function (S, p) { S.groove = NT * p; S.spin = Math.PI - TAU * NT * p; },
      scene: function (S, p) { S.lathe = true; S.toolX = helixZ(NT * p); },
      labels: function () { return [{ t: '3 × 1.8 mm', p: [-67, 24, 0] }, { t: '36 × 3.6 mm', p: [0, 26, 0] }, { t: '3 × 1.8 mm', p: [67, 24, 0] }, { t: 'cable end', p: [-84, -16, 0], c: 'hot' }]; },
      quiz: { q: 'Why are the three end turns at each end closer together (1.8 mm instead of 3.6 mm)?', o: ['To use up the wire', 'To make up for the field that falls off near the ends: the error over the cell drops from ' + f(P.devCell36, 2) + ' % to ' + f(P.devCell, 2) + ' %', 'So the coil is easier to wind'], a: 1, why: 'A finite coil has a weaker field near its ends; extra current density there flattens the field over the 25 mm cell.' } },

    { ch: 'The former', t: 'Scribe the mid-plane and mark the cable end',
      what: 'Scribe a light ring at the mid-plane (z = 0) and mark the cable end, where the leads will leave (z = −' + f(P.formerL / 2, 0) + '). Pencil or a plastic scriber: no metal ink.',
      check: 'Mid-plane ring at 80.0 mm from each end; cable end marked.',
      parts: [], tools: ['Pencil or plastic scriber', 'Marker'],
      act: { type: 'auto', label: 'Mark it', dur: 2.5 }, cam: [-60, 120, 240, -20, 0, 0],
      apply: function (S, p) { S.mid = p > 0.45; S.cableMark = p > 0.85; S.spin = Math.PI; },
      scene: function (S, p) { S.lathe = true; S.marker = p < 0.5 ? [lerp(-30, 0, seg(p, 0, 0.4)), RO + 1, 0] : [lerp(0, -77, seg(p, 0.5, 0.9)), RO + 1, 0]; },
      labels: function (S) { var a = []; if (S.mid) a.push({ t: 'mid-plane z = 0', p: [0, 26, 0] }); if (S.cableMark) a.push({ t: 'cable end', p: [-78, 26, 0], c: 'hot' }); return a; } },

    { ch: 'The former', t: 'Check the groove with the calliper',
      what: 'Measure across <b>ten main pitches</b> (eleven grooves) and the wall at the end of the tube.',
      check: 'Ten pitches: 36.0 ± 0.2 mm; wall 2.0 ± 0.1 mm.',
      parts: [], tools: ['Digital calliper 0.01 mm'],
      act: { type: 'auto', label: 'Measure', dur: 4.5 }, cam: [-60, 90, 170, -45, 10, 0],
      apply: function (S) { S.spin = Math.PI; },
      scene: function (S, p) {
        S.lathe = true;
        if (p < 0.6) { var q = seg(p, 0.05, 0.5); S.cal = { x: STARTS[3], y: RO + 42, z: 0, open: 36 * q, text: f(36 * q, 2) + ' mm' }; }
        else { var q2 = seg(p, 0.65, 0.95); S.cal = { x: P.formerL / 2 + 34, y: RO, z: 0, open: 2 * q2, text: f(2 * q2, 2) + ' mm', rz: -Math.PI / 2 }; }
      } },

    { ch: 'Winding', t: 'Set up the winding rig',
      what: 'Put the former on a rod between two supports, centred by two Delrin bushings, with a crank. Cut <b>5.9 m</b> of Ø' + f(P.wireBare, 2) + ' enamelled copper for the helix and its start lead (0.8 m lead + ' + f(P.helixLen, 2) + ' m helix + spare). The spool runs on a <b>friction brake: 50 to 100 g of pull</b>. Plastic or brass tools only.',
      check: 'The wire runs without kinks; the enamel is not scraped.',
      parts: ['Enamelled copper wire Ø0.50 (10 m)'], tools: ['Winding rig, crank', 'Spool on a friction brake', 'Brass or plastic tweezers'],
      act: { type: 'auto', label: 'Mount the former', dur: 2.5 }, cam: [-170, 170, 360, 0, 30, 0],
      apply: function (S, p) { S.rig = true; S.spin = lerp(Math.PI, Math.PI / 2, ease(p)); },
      labels: function () { return [{ t: 'brake: 50–100 g pull', p: [0, 165, -95], c: 'hot' }, { t: 'crank', p: [-160, 45, 0] }, { t: 'Delrin bushing', p: [-86, -16, 0] }]; },
      quiz: { q: 'How hard should the wire be pulled while winding?', o: ['About 10 g: it must not move the groove', '50 to 100 g: tight in the groove', 'About 500 g: as tight as possible'], a: 1, why: 'Too little and the wire sits loose; too much and the groove edge cuts the enamel, so two turns can short together.' } },

    { ch: 'Winding', t: 'Wind the first 3 end turns (1.8 mm pitch)',
      what: 'Leave 0.8 m of start lead (mark it red), then lay the wire into the groove at the cable end, z = ' + f(P.starts[0], 1) + '. <b>Hold the button</b> (or the space bar) to turn the crank. Count aloud.',
      check: '3 turns at 1.8 mm, each one seated in the groove.',
      parts: [], tools: ['Winding rig'],
      act: { type: 'hold', label: 'Hold to turn the crank', rate: 0.8 }, cam: [-110, 70, 150, -60, 5, 0],
      apply: function (S, p) { S.wound = 3 * p; S.spin = Math.PI / 2 - TAU * S.wound; S.crank = S.wound; },
      scene: function (S) { S.feed = true; } },

    { ch: 'Winding', t: 'Wind the 36 main turns (3.6 mm pitch)',
      what: 'Keep the pull constant and guide the wire with a plastic tool. Put a dot of marker on the former after every tenth turn.',
      check: 'Turns 4 to 39 in the 3.6 mm groove; dots at turns 10, 20 and 30.',
      parts: [], tools: ['Winding rig', 'Marker'],
      act: { type: 'hold', label: 'Hold to turn the crank', rate: 2.6 }, cam: [-20, 100, 260, 0, 0, 0],
      apply: function (S, p) { S.wound = 3 + 36 * p; S.spin = Math.PI / 2 - TAU * S.wound; S.crank = S.wound; },
      scene: function (S) { S.feed = true; } },

    { ch: 'Winding', t: 'Wind the last 3 end turns (1.8 mm pitch)',
      what: 'The finish is at z = +' + f(-P.starts[0], 1) + ' mm. Hold the wire there; do not cut it yet.',
      check: 'Exactly ' + NT + ' turns. The helix alone is ' + f(P.helixLen, 2) + ' m, about ' + f(P.helixLen * P.Rpm, 2) + ' Ω.',
      parts: [], tools: ['Winding rig'],
      act: { type: 'hold', label: 'Hold to turn the crank', rate: 0.8 }, cam: [110, 70, 150, 60, 5, 0],
      apply: function (S, p) { S.wound = 39 + 3 * p; S.spin = Math.PI / 2 - TAU * S.wound; S.crank = S.wound; },
      scene: function (S) { S.feed = true; } },

    { ch: 'Winding', t: 'Fix the end turns',
      what: 'A drop of cyanoacrylate or epoxy (no metal filler) on the first and last 3 turns and on every tenth turn. <b>Do not glue the other turns.</b>',
      check: 'No turn moves when you push it with a plastic tool.',
      parts: ['Epoxy or cyanoacrylate'], tools: ['Glue bottle'],
      act: { type: 'auto', label: 'Glue', dur: 3 }, cam: [-30, 110, 250, 0, 0, 0],
      apply: function (S, p) { S.glue = Math.ceil(glueTurns.length * p - 1e-9); },
      scene: function (S, p) { var i = Math.min(glueTurns.length - 1, Math.floor(glueTurns.length * p)); var th = 3 * Math.PI / 4 + Math.PI / 2, k = glueTurns[i]; S.bottle = [helixZ(k - 1 + 3 / 8), P.a * Math.sin(th) + 4, -P.a * Math.cos(th)]; },
      quiz: { q: 'Why not glue every turn?', o: ['Glue is expensive', 'Glue stress on the wire shifts it in the groove and changes the pitch', 'The coil would get too warm'], a: 1, why: 'The field uniformity depends on the pitch; a few anchor points are enough.' } },

    { ch: 'Winding', t: 'Lay the two return wires',
      what: 'At the far end, scrape the enamel from the helix end and from one end of each return wire, twist the three and solder: <b>one joint</b>. Lay the returns along the axis at <b>90° and 270°</b>, tape them every 40 mm with polyimide tape, and at the cable end solder them together into the finish lead.',
      check: 'Two returns, 180° apart, flat on the former; one joint at each end.',
      mistake: 'A single return wire: ' + f(P.retOne, 2) + ' mG per mA across the axis, ' + f(P.retOne * P.I50, 1) + ' mG at ' + f(P.I50, 1) + ' mA.',
      parts: ['Wire for 2 returns (0.15 m each)', 'Polyimide tape 6 mm', 'Heat-shrink'], tools: ['Soldering iron 25–40 W'],
      act: { type: 'auto', label: 'Lay and solder', dur: 5 }, cam: [-40, 80, 230, 0, 0, 0],
      apply: function (S, p) { S.jF = p > 0.08; S.ret = seg(p, 0.12, 0.7); S.tapes = Math.floor(seg(p, 0.7, 0.9) * 4.999); S.jC = p > 0.95; },
      scene: function (S, p) { if (p < 0.12) S.iron = [ZF + 2, RO + 5, 14]; else if (p > 0.9) S.iron = [ZC - 2, RO + 5, 14]; else S.tape = true; },
      labels: function () { return [{ t: 'return 90°', p: [20, 0, 22] }, { t: 'return 270°', p: [20, 0, -22] }, { t: 'joint: helix end + 2 returns', p: [ZF, 10, 24] }, { t: 'tape every 40 mm', p: [-20, -12, 22] }]; },
      quiz: { q: 'Why two return wires 180° apart instead of one?', o: ['To halve the resistance', 'The helix carries a net axial current; two returns at 180° cancel its transverse field', 'They hold the winding in place'], a: 1, why: 'One return wire alone gives ' + f(P.retOne, 2) + ' mG per mA across the axis; the pair at 180° cancels it.' } },

    { ch: 'Winding', t: 'Twist the leads and fit the plug',
      what: 'Twist the start lead (red) and the finish lead together, <b>one twist per 20 mm</b>, through the notch of the cable-end spacer ring and along the axis, and solder the 9-pin plug of D3 (LD OUT), with a plastic hood.',
      check: 'No loop of area: the leads run as one twisted pair to the plug.',
      mistake: 'Loose, untwisted leads that move: the loop area changes and the field at the cell follows.',
      parts: ['D-sub 9 plug, plastic hood (D3)'], tools: ['Soldering iron'],
      act: { type: 'auto', label: 'Twist and solder', dur: 3.5 }, cam: [-200, 70, 210, -150, -10, 25],
      apply: function (S, p) { S.leads = seg(p, 0, 0.8); S.plug = p > 0.8; },
      scene: function (S, p) { if (p > 0.8) S.iron = [-232, -20, 60]; } },

    { ch: 'Winding', t: 'Measure the coil resistance at the plug',
      what: 'Start lead to finish lead, at the plug, with a 4-wire range if you have one.',
      check: f(P.Rcoil, 2) + ' Ω ± 0.03 (the two returns in parallel add only ' + f(P.retLen / 2 * P.Rpm, 3) + ' Ω).',
      parts: [], tools: ['Multimeter'],
      act: { type: 'auto', label: 'Measure', dur: 2.5 }, cam: [-260, 60, 280, -230, -10, 80],
      scene: function (S, p) { S.dmm = p < 0.2 ? '--.--- Ω' : f(P.Rcoil * lerp(1.4, 1, seg(p, 0.2, 0.7)), 3) + ' Ω'; } },

    { ch: 'Winding', t: 'Glue the two spacer rings',
      what: 'Delrin rings <b>Ø' + f(SP_RO * 2, 1) + ' × Ø' + f(P.formerOD, 1) + ' × 6</b> (outside = real shield bore − 0.5 mm) on the unwound ends, centred 75 mm from the mid-plane, outside the groove (it ends at ' + f(-P.starts[0], 1) + '). Turn the former so its 0° slot points up (towards the cable holes of the caps); the notch goes over the slot and the recesses then face sideways. The cable-end ring needs a <b>notch 2.5 × 1.5 mm</b> in its bore for the twisted leads, and both rings a <b>recess 1.5 mm deep over 40 mm of the circumference</b> on the outside for the degaussing bundle of D4.',
      check: 'Both rings square and at ±75 mm; the leads pass the notch without being pinched.',
      parts: ['2 spacer rings (Delrin)'], tools: ['Epoxy'],
      act: { type: 'auto', label: 'Fit the rings', dur: 2.5 }, cam: [-150, 90, 220, -40, 0, 0],
      apply: function (S, p) { S.spacers = p; },
      labels: function () { return [{ t: 'spacer ring at −75', p: [-75, 26, 0] }, { t: 'notch for the leads', p: [-75, 30, -10], c: 'hot' }, { t: 'spacer ring at +75', p: [75, 26, 0] }]; } },

    { ch: 'Test outside the shield', t: 'Check the field in free space',
      what: 'Take the former off the rig onto a <b>plastic stand, a metre from any steel</b>. Slide the fluxgate plate (D7) into the bore with the sensor at the centre. Drive the coil from the ITC502 laser output at <b>+10.00 mA</b>, read, then <b>−10.00 mA</b>, read. The difference removes the Earth field and the sensor offset.',
      check: 'B(+10 mA) − B(−10 mA) = ' + f(kF * 20, 1) + ' mG ± 5 % (' + f(kF, 2) + ' mG/mA × 20 mA).',
      parts: ['Fluxgate plate (D7)'], tools: ['ITC502 (second unit)', 'Fluxgate read-out', 'Plastic stand'],
      act: { type: 'measure', set: [10, -10] }, cam: [-300, 170, 420, -120, -10, 30],
      apply: function (S) { S.rig = false; S.stand = true; S.plate = { x: 0, y: 0, z: 0 }; },
      scene: function (S, p, ui) { var I = ui.cur || 0; S.itc = 'LD ' + (I >= 0 ? '+' : '') + f(I, 2) + ' mA'; S.fg = ui.cur === undefined ? '-- mG' : f(EARTH + kF * I, 1) + ' mG'; S.field = I; },
      measure: function (I) { return EARTH + kF * I; } },

    { ch: 'Test outside the shield', t: 'Mark the field direction (B+)',
      what: 'From the same measurement, note which current polarity gives a field along the beam direction (+z, away from the laser) and label “B+” on the former.',
      check: 'The label agrees with the fluxgate sign.',
      parts: [], tools: ['Marker'],
      act: { type: 'auto', label: 'Label B+', dur: 2 }, cam: [-120, 120, 260, 0, 0, 0],
      apply: function (S, p) { S.bplus = p > 0.5; },
      scene: function (S, p) { S.field = 10; S.marker = [lerp(-30, 25, seg(p, 0, 0.5)), RO + 4, 0]; },
      labels: function (S) { return S.bplus ? [{ t: 'B+ (positive current)', p: [0, RO + 12, 0], c: 'hot' }] : []; } },

    { ch: 'Cell stack (D2)', t: 'Measure the cell',
      what: 'Keep the cell in its box until the heater is ready and never touch the windows. Measure the diameter, the length, and the position and length of any stem.',
      check: 'Ø' + f(P.cellD, 1) + ' ± 0.3 mm, length ' + f(P.cellL, 0) + ' ± 0.5 mm; the stem at mid-length, at most ' + f(P.stemH, 1) + ' mm above the glass (it must fit the Ø' + f(P.formerID, 0) + ' bore of the wound former).',
      parts: ['Rb vapour cell (C01)'], tools: ['Calliper', 'Gloves'],
      act: { type: 'auto', label: 'Measure', dur: 4 }, cam: [330, 70, 300, 330, 0, 160],
      apply: function (S) { S.cell = true; },
      scene: function (S, p) {
        if (p < 0.5) { var q = seg(p, 0.05, 0.45); S.cal = { x: 330 - P.cellL / 2, y: CR + 20, z: SZ, open: P.cellL * q, text: f(P.cellL * q, 2) + ' mm', rz: 0 }; }
        else { var q2 = seg(p, 0.55, 0.95); S.cal = { x: 300, y: -CR, z: SZ, open: P.cellD * q2, text: f(P.cellD * q2, 2) + ' mm', rz: Math.PI / 2 }; }
      } },

    { ch: 'Cell stack (D2)', t: 'Wrap the bifilar heater and glue the thermistor',
      what: 'The heater is a <b>bifilar pair</b> of Ø0.20 constantan (12 Ω) between two Kapton films, ' + f(P.foilW, 0) + ' × 25 mm, 15 paired runs. Wrap it round the barrel (circumference ' + f(P.circ, 1) + ' mm) so that the ' + f(P.circ - P.foilW, 1) + ' mm free strip is centred under the stem, tails towards the cable end, two turns of polyimide tape. Glue the <b>10 kΩ NTC</b> to the glass 5 mm from one window with thermally conductive epoxy, and a second NTC at the stem base (the cold spot that sets the Rb density).',
      check: 'Heater 12 ± 1 Ω; NTC ≈ 10 kΩ at 25 °C; heater to NTC > 10 MΩ; no wire crosses a window.',
      mistake: 'A heater wound as one coil: one unpaired turn of 0.54 A gives about ' + f(unpaired, 0) + ' mG at the cell.',
      parts: ['Bifilar heater (Kapton + constantan)', 'NTC 10 kΩ', 'Conductive epoxy'], tools: ['Plastic tweezers'],
      act: { type: 'auto', label: 'Wrap and glue', dur: 3.5 }, cam: [330, 70, 300, 330, 0, 160],
      apply: function (S, p) { S.heater = seg(p, 0, 0.8); S.ntc = p > 0.85; },
      labels: function (S) { var a = [{ t: 'bifilar heater ' + f(P.foilW, 0) + ' × 25, 12 Ω', p: [330, -CR - 8, SZ] }, { t: 'stem ≤ ' + f(P.stemH, 0) + ' mm, no heater under it', p: [330, CR + P.stemH + 8, SZ] }]; if (S.ntc) a.push({ t: 'NTC 5 mm from the window', p: [330 + 9, -CR - 16, SZ], c: 'hot' }); return a; },
      quiz: { q: 'Why is the heater wire laid as a bifilar pair (go and return side by side)?', o: ['It heats more evenly', 'The two currents are opposite, so their magnetic fields cancel', 'It needs less wire'], a: 1, why: 'Any unpaired loop of heater current is a coil next to the cell; ours must stay below 0.1 mG.' } },

    { ch: 'Cell stack (D2)', t: 'Slide on the foam sleeve',
      what: 'Foam sleeve <b>ID 25.6, OD 31.6, 34 long</b>, rated to 100 °C, wrapped on with the stem through its Ø10 hole. Run the heater tails and the NTC pairs in the clearance towards the cable end. Then push the stack, stem up, through the 50 mm test coupon of the former: it must pass without touching the stem.',
      check: 'Sleeve ends 3 mm beyond each window; leads not pinched.',
      parts: ['Foam sleeve'], tools: [],
      act: { type: 'auto', label: 'Slide it on', dur: 2.5 }, cam: [330, 70, 300, 330, 0, 160],
      apply: function (S, p) { S.foam = p; } },

    { ch: 'Cell stack (D2)', t: 'Push on the two Delrin tubes',
      what: 'Two tubes <b>OD 33.7, ID 26.5, 63 long</b>, one on each side: 63 + 34 + 63 = 160 mm, the length of the former. The groove of the cable-side tube carries the leads.',
      check: 'The stack is centred; the tubes do not touch the glass.',
      parts: ['2 Delrin tubes'], tools: [],
      act: { type: 'auto', label: 'Push them on', dur: 2.5 }, cam: [330, 120, 400, 330, 0, 160],
      apply: function (S, p) { S.tubes = p; },
      labels: function () { return [{ t: 'cable side, groove for the leads', p: [330 - 48, 22, SZ] }, { t: '63 + 34 + 63 = 160', p: [330, 30, SZ] }]; } },

    { ch: 'Cell stack (D2)', t: 'Bench-test the heater',
      what: 'Heater and NTC on the second ITC502 (TEC OUT, through the diode of D3): I TEC LIM 0.50 A on the open bench (0.33 A once it is inside the shield), T SET <b>2.100 kΩ</b> (about 65 °C for this NTC). Watch the NTC reading fall and settle. Before the real cell is used, run the magnetic test of D2 once: heater on a dummy tube in the closed shield, current on and off.',
      check: 'Settles in about 15 minutes at ' + f(Math.sqrt(P.PlossClosed / 12), 2) + ' to ' + f(Math.sqrt(P.Ploss / 12), 2) + ' A; the magnetic test changes the field by less than 0.1 mG.',
      parts: [], tools: ['ITC502 (second unit)'],
      act: { type: 'auto', label: 'Heat up', dur: 4 }, cam: [-10, 200, 620, 0, -10, 60],
      scene: function (S, p) { S.glow = ease(p); S.itc = 'TEC ' + f(lerp(10.0, 2.1, ease(p)), 3) + ' kΩ'; } },

    { ch: 'Into the shield', t: 'Slide the inner layer over the former',
      what: 'For the calibration the fluxgate plate stays in the former; the cell stack goes in later. Slide the <b>innermost layer</b> over the former from the far end. The spacer rings centre the former; keep the twisted leads and the plate cable along the top, towards the cable hole. The shield rests on its printed cradle (BOM M06) with its axis at the 100 mm beam height.',
      check: 'The former is centred; the mid-plane ring is at the middle of the layer (± 1 mm).',
      parts: ['Shield, inner layer'], tools: [],
      act: { type: 'auto', label: 'Slide it on', dur: 3 }, cut: true, cam: [-160, 170, 380, 0, 0, 0],
      apply: function (S, p) { S.stand = false; S.shCradle = true; S.lay[0].z = lerp(430, 0, ease(p)); },
      labels: function () { return [{ t: 'inner layer, bore Ø46 (assumed)', p: [40, 30, 0] }, { t: 'spacer rings centre the former', p: [75, -28, 0] }]; } },

    { ch: 'Into the shield', t: 'Fit the inner end caps',
      what: 'Close both ends. All cables leave through the <b>Ø12 mm cable hole</b>, 16 mm above the axis, as twisted pairs, never as loops. The Ø14 mm hole on the axis is for the beam only.',
      check: 'Caps seated all round; no cable pinched under a cap.',
      parts: ['Inner end caps'], tools: [],
      act: { type: 'auto', label: 'Fit the caps', dur: 2.5 }, cut: true, cam: [-240, 140, 330, -60, 0, 0],
      apply: function (S, p) { S.lay[0].a = S.lay[0].b = ease(p); },
      quiz: { q: 'How do the coil leads leave the shield?', o: ['As a twisted pair through the cable hole', 'Spread apart, so they do not touch', 'Under the edge of the cap'], a: 0, why: 'A twisted pair has no loop area: it neither picks up nor makes a field.' } },

    { ch: 'Into the shield', t: 'Middle layer and its caps',
      what: 'Slide the middle layer over the inner one and close it. The layers must not touch each other.',
      check: 'Gap of about 4 mm all round (assumed sizes).',
      parts: ['Shield, middle layer + caps'], tools: [],
      act: { type: 'auto', label: 'Fit the middle layer', dur: 3 }, cut: true, cam: [-200, 170, 400, 0, 0, 0],
      apply: function (S, p) { S.lay[1].z = lerp(450, 0, ease(seg(p, 0, 0.65))); S.lay[1].a = S.lay[1].b = ease(seg(p, 0.7, 1)); } },

    { ch: 'Into the shield', t: 'Outer layer and its caps',
      what: 'Slide the outer layer on and close it. The shield is now complete; from here on keep steel tools and magnets at least a metre away.',
      check: 'Outer diameter ≤ Ø' + f(P.shieldOD, 0) + ' mm; all six caps seated; the axis at the 100 mm beam height on the cradle.',
      parts: ['Shield, outer layer + caps'], tools: [],
      act: { type: 'auto', label: 'Fit the outer layer', dur: 3 }, cut: true, cam: [-220, 190, 440, 0, 0, 0],
      apply: function (S, p) { S.lay[2].z = lerp(470, 0, ease(seg(p, 0, 0.65))); S.lay[2].a = S.lay[2].b = ease(seg(p, 0.7, 1)); } },

    { ch: 'Into the shield', t: 'Degauss the shield (D4)',
      what: 'The D4 coil: a flat bundle of 30 wires in the bore (it passes the recesses of the spacer rings), out through the cable holes and back outside in three groups at 120° (one at the top, none at the bottom where the cradle is). Raise the 50 Hz drive slowly until the current rises sharply (the knee), go to about 1.5 times the knee (at most 2 A rms), hold 5 s, then ramp down to zero <b>steadily in 100 to 300 s</b>. Unplug the coil afterwards.',
      check: 'Two runs in a row give the same field to ± 0.1 mG.',
      mistake: 'Stopping or jerking the ramp leaves magnetisation behind.',
      parts: ['Degaussing coil (D4)'], tools: ['Variac + isolating transformer (D4)', 'Ammeter'],
      act: { type: 'auto', label: 'Degauss', dur: 7 }, cut: true, cam: [-240, 210, 430, 0, 0, 0],
      apply: function (S) { S.dcoil = true; },
      scene: function (S, p) { S.dpulse = p < 0.12 ? seg(p, 0, 0.12) : p < 0.2 ? 1 : 1 - seg(p, 0.2, 1); },
      plot: 'ramp' },

    { ch: 'Into the shield', t: 'Calibrate B against the current',
      what: 'Read the field with the fluxgate plate at <b>±5, ±10 and ±15 mA</b>. The shield pulls the flux in, so k is a few per cent above the free-space ' + f(kF, 2) + ' mG/mA. Use the measured k in every later experiment, not the formula, and confirm it with the atoms (the EIT line moves 1.4 kHz per mG).',
      check: 'A straight line B = k·I to 1 %; k written in the log. (Values here are an example.)',
      parts: [], tools: ['ITC502', 'Fluxgate read-out'],
      act: { type: 'measure', set: [5, -5, 10, -10, 15, -15] }, cut: true, cam: [-300, 170, 420, -120, -10, 30],
      scene: function (S, p, ui) { var I = ui.cur || 0; S.itc = 'LD ' + (I >= 0 ? '+' : '') + f(I, 2) + ' mA'; S.fg = ui.cur === undefined ? '-- mG' : f(B_RES + K_SHIELD * I, 2) + ' mG'; S.field = I; },
      measure: function (I) { return B_RES + K_SHIELD * I; }, plot: 'cal' },

    { ch: 'Into the shield', t: 'Swap the plate for the cell stack',
      what: 'Open the far-end caps (outer, middle, inner), draw the plate out, push the cell stack in until its centre ring is at the mid-plane, and close the caps again (inner, middle, outer).',
      check: 'Cell centre at the mid-plane of the former (± 1 mm).',
      mistake: 'Opening the shield magnetises it again: degauss again after closing it.',
      parts: ['Cell stack'], tools: [],
      act: { type: 'auto', label: 'Swap', dur: 6 }, cut: true, cam: [60, 170, 420, 120, 0, 0],
      apply: function (S, p) {
        for (var k = 0; k < 3; k++) { var o = seg(p, 0.02 + (2 - k) * 0.06, 0.08 + (2 - k) * 0.06), c = seg(p, 0.78 + k * 0.07, 0.84 + k * 0.07); S.lay[k].b = 1 - o + c; }
        var pz = lerp(0, 260, ease(seg(p, 0.22, 0.42)));
        S.plate = p < 0.45 ? { x: 0, y: 0, z: pz } : null;
        S.stackX = lerp(-SZ, 0, ease(seg(p, 0.45, 0.55))); S.stack = lerp(STACK_REST, 0, ease(seg(p, 0.56, 0.78)));
      } },

    { ch: 'Finish', t: 'Degauss again and heat the cell',
      what: 'Degauss once more (the shield was opened), unplug the degaussing coil, then heat the cell to 55–65 °C. Set the solenoid current with your measured k: I = 50 mG / k.',
      check: 'Cell at 55–65 °C; with the example k = ' + f(K_SHIELD, 3) + ' mG/mA, 50 mG needs ' + f(50 / K_SHIELD, 2) + ' mA (free-space value ' + f(P.I50, 2) + ' mA).',
      parts: [], tools: ['ITC502 ×2', 'Degauss drive (D4)'],
      act: { type: 'auto', label: 'Finish', dur: 6 }, cut: true, cam: [-120, 150, 330, 0, 0, 0],
      scene: function (S, p) { S.dpulse = p < 0.45 ? (p < 0.05 ? seg(p, 0, 0.05) : 1 - seg(p, 0.05, 0.45)) : 0; S.glow = ease(seg(p, 0.5, 1)); S.field = p > 0.5 ? 50 / K_SHIELD : 0; S.itc = p > 0.5 ? 'LD +' + f(50 / K_SHIELD, 2) + ' mA' : null; },
      labels: function () { return [{ t: 'Rb cell at the centre', p: [0, 6, 0], c: 'hot' }, { t: '3-layer shield', p: [0, 40, 0] }, { t: 'solenoid ' + NT + ' turns', p: [40, 24, 0] }]; } }
  ];

  /* ---------------- state composition ---------------- */
  var cur = 0, prog = 0, running = false, holding = false, done = [], firstTry = {}, quizOk = {}, ui = {};
  STEPS.forEach(function (s, i) { done[i] = false; ui[i] = { vals: {} }; });
  function compose(i, p) {
    var S = base();
    for (var k = 0; k < i; k++) if (STEPS[k].apply) STEPS[k].apply(S, 1);
    if (STEPS[i].apply) STEPS[i].apply(S, p);
    S.cut = !!STEPS[i].cut;
    if (STEPS[i].scene) STEPS[i].scene(S, p, ui[i]);
    return S;
  }

  /* ---------------- sync the 3D scene with a state ---------------- */
  var tNow = 0;
  function sync(S) {
    former.visible = S.former; former.scale.z = Math.max(0.01, S.formerLen / P.formerL);
    groove.visible = S.former && S.groove > 0; grooveGeo.setDrawRange(0, Math.floor(S.groove * SEG) * PER_SEG);
    wire.visible = S.wound > 0; wireGeo.setDrawRange(0, Math.floor(S.wound * SEG) * PER_SEG);
    midRing.visible = S.mid; cableBand.visible = S.cableMark;
    startStub.visible = S.wound > 0 && S.leads <= 0;
    dots.forEach(function (d, i) { d.visible = S.wound >= (i + 1) * 10; });
    glues.forEach(function (g, i) { g.visible = i < S.glue; });
    returns.forEach(function (r) {
      var L = (ZF - ZC) * S.ret; r.straight.visible = S.ret > 0;
      if (S.ret > 0) stretch(r.straight, V(RR, 0, ZF), V(RR, 0, ZF - Math.max(L, 0.01)));
      r.arcF.visible = S.jF; r.arcC.visible = S.jC;
      r.tapes.forEach(function (t, i) { t.visible = i < S.tapes; });
    });
    jointF.visible = S.jF; jointC.visible = S.jC;
    spacers.forEach(function (g, i) { var s = i === 0 ? -1 : 1; g.visible = S.spacers > 0; g.position.z = s * lerp(120, 75, ease(S.spacers)); });
    spin.rotation.z = S.spinRun ? -tNow * 4 : S.spin;
    leads.g.visible = S.leads > 0; leads.set(S.leads); plug.visible = S.plug;
    ghost.visible = S.ghost;
    // cell stack
    stack.visible = S.cell; stack.position.set(S.stackX, 0, S.stack); cradle.visible = S.cell && S.stackX < -100;
    setHeater(S.heater); heater.visible = S.heater > 0; ntc.visible = S.ntc;
    foam.visible = S.foam > 0; foam.position.z = lerp(70, 0, ease(S.foam));
    tubeA.visible = tubeB.visible = S.tubes > 0; tubeA.position.z = -lerp(130, 48.5, ease(S.tubes)); tubeB.position.z = lerp(130, 48.5, ease(S.tubes));
    stackLeads.visible = S.tubes >= 1;
    M.hot.emissive.setRGB(0.55 * S.glow, 0.18 * S.glow, 0);
    // fluxgate plate
    plate.visible = !!S.plate; if (S.plate) plate.position.set(S.plate.x, S.plate.y, S.plate.z);
    // shield
    layers.forEach(function (l, k) {
      var st = S.lay[k]; l.g.visible = st.z !== null; if (st.z !== null) l.g.position.z = st.z;
      l.caps.forEach(function (c) { var q = c.userData.s < 0 ? st.a : st.b; c.visible = st.z !== null && q > 0.001; c.position.z = c.userData.home + (st.z || 0) + c.userData.s * (1 - ease(q)) * 70; });
    });
    dcoil.visible = S.dcoil || S.dpulse > 0;
    shCradle.visible = S.shCradle;
    var amp = S.dpulse * (0.5 + 0.5 * Math.sin(tNow * 2 * Math.PI * 3));
    M.orange.emissive.setRGB(0.8 * amp, 0.25 * amp, 0);
    // tools
    lathe.visible = S.lathe; carriage.visible = S.toolX !== null; if (S.toolX !== null) carriage.position.x = S.toolX;
    rig.visible = S.rig; crank.rotation.x = -TAU * S.crank;
    spool.rotation.x = TAU * S.crank * 0.8;
    feed.visible = S.feed && S.wound < NT;
    if (feed.visible) stretch(feed, V(0, 125, -95), V(helixZ(S.wound), P.a + 0.3, 0));
    cal.visible = !!S.cal;
    if (S.cal) { cal.position.set(S.cal.x, S.cal.y, S.cal.z); calSlide.position.x = S.cal.open; calDisp.set(S.cal.text); cal.rotation.set(0, 0, S.cal.rz || 0); }
    tray.visible = S.tray;
    iron.visible = !!S.iron; if (S.iron) { iron.position.set(S.iron[0], S.iron[1], S.iron[2]); iron.rotation.set(0, 0.6, -0.5); }
    marker.visible = !!S.marker; if (S.marker) marker.position.set(S.marker[0], S.marker[1], S.marker[2]);
    bottle.visible = !!S.bottle; if (S.bottle) bottle.position.set(S.bottle[0], S.bottle[1], S.bottle[2]);
    tapeRoll.visible = !!S.tape;
    dmm.visible = !!S.dmm; probeR.visible = probeB.visible = !!S.dmm;
    if (S.dmm) { dmmDisp.set(S.dmm); stretch(probeR, V(-270, -80, 136), V(-226, -72, 58)); stretch(probeB, V(-290, -80, 136), V(-226, -78, 52)); }
    itc.visible = !!S.itc || S.glow > 0; itcCable.visible = itc.visible; if (S.itc) itcDisp.set(S.itc); else if (S.glow > 0) itcDisp.set('TEC 2.100 kΩ');
    if (itc.visible) stretch(itcCable, V(-250, -80, 0), V(-226, -74, 52));
    fgm.visible = !!S.fg; if (S.fg) fgDisp.set(S.fg);
    stand.visible = S.stand;
    arrows.visible = Math.abs(S.field) > 0.01;
    arrows.children.forEach(function (a) { a.setDirection(V(S.field >= 0 ? 1 : -1, 0, 0)); a.position.x = S.field >= 0 ? -45 : 45; });
    bplus.visible = S.bplus;
    setCut(cutUser === null ? S.cut : cutUser);
  }

  /* ---------------- labels in 3D ---------------- */
  var showLabels = true, lblEls = [];
  function drawLabels(list) {
    while (lblEls.length < list.length) { var e = document.createElement('div'); e.className = 'lbl3'; labelsEl.appendChild(e); lblEls.push(e); }
    var w = view.clientWidth, h = view.clientHeight, v = new THREE.Vector3();
    lblEls.forEach(function (e, i) {
      var L = list[i];
      if (!L || !showLabels) { e.style.display = 'none'; return; }
      v.set(L.p[0], L.p[1], L.p[2]).project(cam);
      if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) { e.style.display = 'none'; return; }
      e.style.display = ''; e.textContent = L.t; e.className = 'lbl3' + (L.c ? ' ' + L.c : '');
      e.style.transform = 'translate(' + ((v.x + 1) / 2 * w) + 'px,' + ((1 - v.y) / 2 * h) + 'px) translate(-50%,-50%)';
    });
  }

  /* ---------------- camera tween ---------------- */
  var tween = null;
  function goCam(c, dur) {
    tween = { t: 0, d: dur || 1.1, p0: cam.position.clone(), t0: ctr.target.clone(), p1: V(c[0], c[1], c[2]), t1: V(c[3], c[4], c[5]) };
  }

  /* ---------------- panel (step text, action, quiz) ---------------- */
  var cutUser = null;
  var btnCut = document.getElementById('btnCut'), btnLabels = document.getElementById('btnLabels');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function buildSteps() {
    var h = [], ch = null;
    STEPS.forEach(function (s, i) {
      if (s.ch !== ch) { if (ch !== null) h.push('</ol>'); ch = s.ch; h.push('<h2>' + esc(ch) + '</h2><ol>'); }
      h.push('<li data-i="' + i + '"><button type="button"><span class="n">' + (i + 1) + '</span><span>' + esc(s.t) + '</span></button></li>');
    });
    h.push('</ol>');
    stepsEl.innerHTML = h.join('');
    Array.prototype.forEach.call(stepsEl.querySelectorAll('li'), function (li) {
      li.querySelector('button').addEventListener('click', function () { go(+li.dataset.i); });
    });
  }
  function markSteps() {
    Array.prototype.forEach.call(stepsEl.querySelectorAll('li'), function (li) {
      var i = +li.dataset.i; li.classList.toggle('cur', i === cur); li.classList.toggle('done', !!done[i]);
      if (i === cur) { var r = li.getBoundingClientRect(), pr = stepsEl.getBoundingClientRect(); if (r.top < pr.top) stepsEl.scrollTop += r.top - pr.top - 30; else if (r.bottom > pr.bottom) stepsEl.scrollTop += r.bottom - pr.bottom + 30; }
    });
  }
  function score() {
    var n = 0, ok = 0; STEPS.forEach(function (s, i) { if (s.quiz) { n++; if (firstTry[i] === true) ok++; } });
    return 'Questions right first time: ' + ok + ' / ' + n + ' · steps done: ' + done.filter(Boolean).length + ' / ' + STEPS.length;
  }
  function chips(list, cls) { return list.map(function (x) { return '<span class="' + cls + '">' + esc(x) + '</span>'; }).join(''); }

  function renderPanel() {
    var s = STEPS[cur], a = s.act, u = ui[cur];
    var h = '<div class="ch">' + esc(s.ch) + ' · step ' + (cur + 1) + ' of ' + STEPS.length + '</div><h2>' + esc(s.t) + '</h2>';
    h += '<p>' + s.what + '</p>';
    if ((s.parts && s.parts.length) || (s.tools && s.tools.length)) h += '<h3>Parts and tools</h3><div class="chips">' + chips(s.parts || [], 'part') + chips(s.tools || [], 'tool') + '</div>';
    h += '<div class="act" id="actArea">';
    if (a.type === 'auto') h += '<button type="button" class="sbtn pri" id="actBtn">' + esc(a.label) + ' ▶</button>';
    else if (a.type === 'hold') h += '<button type="button" class="sbtn pri" id="actBtn">' + esc(a.label) + '</button>';
    else if (a.type === 'pick') h += '<span>Magnetic items found: <b id="pickN">' + (u.found || 0) + '</b> / 4</span>';
    else if (a.type === 'measure') a.set.forEach(function (I) { h += '<button type="button" class="sbtn" data-i="' + I + '">' + (I > 0 ? '+' : '−') + f(Math.abs(I), 2) + ' mA</button>'; });
    h += '</div><div class="bar"><i id="actBar"></i></div>';
    if (a.type === 'measure') h += '<div id="measTbl"></div>';
    if (s.plot) h += '<canvas class="plot" id="plot" width="640" height="300"></canvas>';
    if (a.type === 'pick') h += '<p class="mini" id="pickMsg">Click an item on the bench.</p>';
    h += '<div class="chk"><b>Check.</b> ' + s.check + '</div>';
    if (s.mistake) h += '<div class="mis"><b>Mistake to avoid.</b> ' + s.mistake + '</div>';
    h += '<div id="quizArea"></div>';
    h += '<div class="navrow"><button type="button" class="sbtn" id="prevBtn"' + (cur === 0 ? ' disabled' : '') + '>◀ Back</button><span class="score" id="scoreTxt">' + score() + '</span><button type="button" class="sbtn pri" id="nextBtn">' + (cur === STEPS.length - 1 ? 'Finish' : 'Next ▶') + '</button></div>';
    panel.innerHTML = h;
    document.getElementById('prevBtn').addEventListener('click', function () { go(cur - 1); });
    document.getElementById('nextBtn').addEventListener('click', function () { if (cur < STEPS.length - 1) go(cur + 1); else finish(); });
    var b = document.getElementById('actBtn');
    if (b && a.type === 'auto') b.addEventListener('click', function () { if (prog >= 1) prog = 0; running = true; });
    if (b && a.type === 'hold') {
      var on = function (e) { e.preventDefault(); holding = true; b.classList.add('on'); }, off = function () { holding = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
    if (a.type === 'measure') {
      Array.prototype.forEach.call(document.querySelectorAll('#actArea [data-i]'), function (bt) {
        bt.addEventListener('click', function () { var I = +bt.dataset.i; u.cur = I; u.vals[I] = s.measure(I); prog = Object.keys(u.vals).length / a.set.length; updMeasure(); if (prog >= 1) complete(); });
      });
      updMeasure();
    }
    renderQuiz(); updNext();
  }
  function updMeasure() {
    var s = STEPS[cur], u = ui[cur], el = document.getElementById('measTbl'); if (!el) return;
    var rows = s.act.set.map(function (I) { var v = u.vals[I]; return '<tr><td>' + (I > 0 ? '+' : '−') + f(Math.abs(I), 2) + ' mA</td><td>' + (v === undefined ? '—' : f(v, 2) + ' mG') + '</td></tr>'; }).join('');
    var extra = '';
    if (cur === stepIndex('Check the field in free space') && u.vals[10] !== undefined && u.vals[-10] !== undefined) extra = '<p><b>Difference: ' + f(u.vals[10] - u.vals[-10], 2) + ' mG</b> → ' + f((u.vals[10] - u.vals[-10]) / 20, 3) + ' mG/mA. (The Earth value ' + f(EARTH, 1) + ' mG is an example; yours depends on the orientation.)</p>';
    if (s.plot === 'cal') { var k = fitK(u.vals); if (k) extra = '<p><b>Fitted k = ' + f(k, 3) + ' mG/mA</b> (example).</p>'; }
    el.innerHTML = '<table class="dtbl"><thead><tr><th>Current</th><th>Fluxgate</th></tr></thead><tbody>' + rows + '</tbody></table>' + extra;
    if (s.plot === 'cal') drawPlot();
  }
  function fitK(vals) {
    var xs = Object.keys(vals).map(Number); if (xs.length < 2) return null;
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    xs.forEach(function (x) { var y = vals[x]; sx += x; sy += y; sxx += x * x; sxy += x * y; });
    var d = n * sxx - sx * sx; return d ? (n * sxy - sx * sy) / d : null;
  }
  function stepIndex(title) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].t === title) return i; return -1; }
  function drawPlot() {
    var cv = document.getElementById('plot'); if (!cv) return;
    var c = cv.getContext('2d'), W = cv.width, H = cv.height, s = STEPS[cur];
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.strokeStyle = '#9aa4ae'; c.lineWidth = 1; c.font = '20px monospace'; c.fillStyle = '#333';
    c.beginPath(); c.moveTo(50, 20); c.lineTo(50, H - 40); c.lineTo(W - 20, H - 40); c.stroke();
    if (s.plot === 'ramp') {
      c.fillText('coil current (rms)', 60, 22); c.fillText('time: knee search, hold, ramp 100–300 s', 60, H - 10);
      c.strokeStyle = '#e8742b'; c.lineWidth = 3; c.beginPath();
      for (var i = 0; i <= 200; i++) { var p = i / 200, a = p < 0.12 ? p / 0.12 : p < 0.2 ? 1 : 1 - (p - 0.2) / 0.8, x = 50 + p * (W - 80), y = H - 40 - a * (H - 70); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      var px = 50 + prog * (W - 80); c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 20); c.lineTo(px, H - 40); c.stroke();
    } else {
      var u = ui[cur], xs = Object.keys(u.vals).map(Number), x0 = 50 + (W - 70) / 2, y0 = 20 + (H - 60) / 2;
      c.beginPath(); c.moveTo(x0, 20); c.lineTo(x0, H - 40); c.moveTo(50, y0); c.lineTo(W - 20, y0); c.stroke();
      c.fillText('B (mG)', x0 + 6, 38); c.fillText('I (mA)', W - 100, y0 - 8);
      function X(I) { return x0 + I / 16 * (W - 70) / 2; } function Y(B) { return y0 - B / 60 * (H - 60) / 2; }
      var k = fitK(u.vals);
      if (k) { c.strokeStyle = '#2f6db3'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(-16), Y(B_RES + k * -16)); c.lineTo(X(16), Y(B_RES + k * 16)); c.stroke(); }
      c.fillStyle = '#c0392b'; xs.forEach(function (I) { c.beginPath(); c.arc(X(I), Y(u.vals[I]), 6, 0, TAU); c.fill(); });
    }
  }
  function renderQuiz() {
    var s = STEPS[cur], el = document.getElementById('quizArea'); if (!el) return;
    if (!s.quiz || prog < 1) { el.innerHTML = ''; return; }
    var q = s.quiz, h = '<div class="quiz"><p>' + esc(q.q) + '</p>';
    q.o.forEach(function (o, i) { var cls = quizOk[cur] ? (i === q.a ? ' class="ok"' : '') : ''; h += '<button type="button" data-o="' + i + '"' + cls + '>' + esc(o) + '</button>'; });
    h += '<p class="why" id="why">' + (quizOk[cur] ? esc(q.why) : '') + '</p></div>';
    el.innerHTML = h;
    Array.prototype.forEach.call(el.querySelectorAll('button'), function (bt) {
      bt.addEventListener('click', function () {
        var i = +bt.dataset.o;
        if (firstTry[cur] === undefined) firstTry[cur] = (i === q.a);
        if (i === q.a) { quizOk[cur] = true; bt.className = 'ok'; document.getElementById('why').textContent = q.why; markDone(); }
        else { bt.className = 'no'; document.getElementById('why').textContent = 'Not quite. Try again.'; }
        document.getElementById('scoreTxt').textContent = score();
      });
    });
  }
  function updNext() {
    var n = document.getElementById('nextBtn'); if (!n) return;
    var ok = done[cur]; n.disabled = !ok && cur < STEPS.length; n.title = ok ? '' : 'Do the step first (or pick any step on the left)';
  }
  function markDone() { done[cur] = true; markSteps(); updNext(); var t = document.getElementById('scoreTxt'); if (t) t.textContent = score(); }
  function complete() {
    prog = 1; running = false; holding = false;
    var s = STEPS[cur];
    if (!s.quiz || quizOk[cur]) markDone(); else renderQuiz();
  }
  function finish() {
    panel.innerHTML = '<div class="ch">Finished</div><h2>The solenoid is built, shielded and calibrated</h2><p>' + score() + '.</p><p>Next: the EIT line itself is the final check of k (1.4 kHz per mG). Keep the log of k, the coil resistance and the degauss runs with the build.</p><div class="navrow"><button type="button" class="sbtn" id="againBtn">Start again</button><a class="sbtn pri" href="diy.html#d1">Back to D1</a></div>';
    document.getElementById('againBtn').addEventListener('click', function () { done = done.map(function () { return false; }); firstTry = {}; quizOk = {}; STEPS.forEach(function (s, i) { ui[i] = { vals: {} }; }); go(0); });
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    cur = i; running = false; holding = false; cutUser = null;
    prog = done[i] ? 1 : 0;
    var s = STEPS[i];
    if (s.act.type === 'measure' && done[i]) prog = 1;
    goCam(s.cam);
    document.getElementById('hudStep').textContent = 'Step ' + (i + 1) + ' / ' + STEPS.length + ' · ' + s.ch;
    renderPanel(); markSteps();
    try { localStorage.setItem('rb87-d1sim-step', String(i)); } catch (e) { }
  }

  /* ---------------- picking (compass test) ---------------- */
  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), downAt = null, needleTarget = 0;
  canvas.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', function (e) {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    if (STEPS[cur].act.type !== 'pick') return;
    var r = canvas.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(mouse, cam);
    var hits = ray.intersectObjects(ITEMS.map(function (it) { return it.g; }), true);
    if (!hits.length) return;
    var o = hits[0].object; while (o && !o.userData.item) o = o.parent;
    if (!o) return;
    var it = o.userData.item, u = ui[cur]; u.picked = u.picked || {};
    var msg = document.getElementById('pickMsg');
    var dx = it.g.position.x - compass.position.x, dz = it.g.position.z - compass.position.z;
    if (it.mag) {
      needleTarget = Math.atan2(-dz, dx);
      if (!u.picked[it.id]) { u.picked[it.id] = true; u.found = (u.found || 0) + 1; }
      it.g.position.set(bin.position.x + ((u.found - 1) % 2) * 30 - 15, -100, bin.position.z + (u.found > 2 ? 18 : -18));
      if (msg) msg.innerHTML = '<b>' + esc(it.name) + '</b>: the needle swings. Magnetic: set aside.';
    } else {
      needleTarget = 0;
      if (msg) msg.innerHTML = '<b>' + esc(it.name) + '</b>: the needle does not move. Not magnetic: keep it.';
    }
    var n = document.getElementById('pickN'); if (n) n.textContent = u.found || 0;
    prog = (u.found || 0) / 4;
    if (prog >= 1) complete();
  });

  /* ---------------- buttons, keys ---------------- */
  btnCut.addEventListener('click', function () { cutUser = !cutOn; });
  btnLabels.addEventListener('click', function () { showLabels = !showLabels; btnLabels.setAttribute('aria-pressed', String(showLabels)); });
  document.getElementById('btnView').addEventListener('click', function () { goCam(STEPS[cur].cam); });
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.code === 'Space' && STEPS[cur].act.type === 'hold') { e.preventDefault(); holding = true; }
    if (e.key === 'ArrowRight' && done[cur]) go(cur + 1);
    if (e.key === 'ArrowLeft') go(cur - 1);
  });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space') holding = false; });

  /* ---------------- resize and loop ---------------- */
  function resize() {
    var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  var last = performance.now(), bgTick = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt);
  }
  function frame(dt) {
    tNow += dt;
    if ((bgTick += dt) > 1) { bgTick = 0; paintBg(); }
    if (view.clientWidth && (renderer.domElement.width !== Math.round(view.clientWidth * renderer.getPixelRatio()))) resize();
    var s = STEPS[cur], a = s.act;
    if (a.type === 'auto' && running) { prog += dt / a.dur; if (prog >= 1) complete(); }
    if (a.type === 'hold' && holding && prog < 1) {
      var span = cur === stepIndex('Wind the 36 main turns (3.6 mm pitch)') ? 36 : 3;
      prog += dt * a.rate / span; if (prog >= 1) complete();
    }
    var S = compose(cur, prog);
    sync(S);
    var hud = document.getElementById('hudTurns');
    var wind = /^Wind the/.test(s.t);
    hud.hidden = !wind; if (wind) hud.innerHTML = 'Turns <b>' + Math.floor(S.wound + 1e-6) + '</b> / ' + NT + ' · z = ' + f(helixZ(S.wound), 1) + ' mm';
    var bar = document.getElementById('actBar'); if (bar) bar.style.width = (clamp(prog) * 100) + '%';
    if (s.plot === 'ramp') drawPlot();
    // compass needle
    var nt = s.act.type === 'pick' ? needleTarget + 0.15 * Math.sin(tNow * 3) * Math.exp(-((tNow * 1) % 4)) : 0;
    needle.rotation.y += (nt - needle.rotation.y) * Math.min(1, dt * 6);
    btnCut.setAttribute('aria-pressed', String(cutOn));
    if (tween) {
      tween.t += dt / tween.d; var e = ease(tween.t);
      cam.position.lerpVectors(tween.p0, tween.p1, e); ctr.target.lerpVectors(tween.t0, tween.t1, e);
      if (tween.t >= 1) tween = null;
    }
    ctr.update();
    renderer.render(scene, cam);
    drawLabels(s.labels ? s.labels(S, prog) : []);
  }

  window.D1SIM = { go: function (i) { go(i); }, setProgress: function (p) { prog = clamp(p); if (prog >= 1) complete(); }, frame: function (dt) { frame(dt || 0); }, steps: STEPS.length, state: function () { return compose(cur, prog); } };
  buildSteps();
  var startAt = 0; try { var sv = +localStorage.getItem('rb87-d1sim-step'); if (sv > 0 && sv < STEPS.length) startAt = sv; } catch (e) { }
  for (var i = 0; i < startAt; i++) done[i] = true;
  resize(); go(startAt);
  cam.position.set(STEPS[startAt].cam[0], STEPS[startAt].cam[1], STEPS[startAt].cam[2]); ctr.target.set(STEPS[startAt].cam[3], STEPS[startAt].cam[4], STEPS[startAt].cam[5]); tween = null;
  requestAnimationFrame(loop);
})();
