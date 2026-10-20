/* laser-source-3d.js (v1); mirror normals bisect the incoming and outgoing beams: 3D view of the free-space Yanban laser source, direct to the bench or through a PM fibre.
   Numbers: window.LS (injected by private/diy/build_lsrc.py). Units mm, y up, beam along +x at 100 mm above the plate.
   The part shapes are the symbolic models of the equipment list (parts3d.js); the sizes that matter optically are computed. */
(function () {
  'use strict';
  var T = window.THREE, L = window.LS;
  if (!T || !L) return;
  var $ = function (id) { return document.getElementById(id); };
  var H = L.beamH;                       // beam height above the plate
  var EX = 3;                            // beam drawn wider than life
  var state = { mode: 'direct', half: false, step: -1, eta: L.etaDefault, labels: true };

  // ---------------- renderer, scene, camera ----------------
  var cv = $('lscv'), wrap = $('ls3d');
  var R = new T.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new T.Scene(); scene.background = new T.Color(0xe9edf1);
  var cam = new T.PerspectiveCamera(38, 1, 1, 6000);
  cam.position.set(150, 380, 520);
  var ctl = new T.OrbitControls(cam, cv); ctl.target.set(170, H, 0); ctl.enableDamping = true;
  scene.add(new T.HemisphereLight(0xe6f0f7, 0x1a2228, 0.95));
  var d1 = new T.DirectionalLight(0xffffff, 0.9); d1.position.set(-200, 400, 300); scene.add(d1);
  var d2 = new T.DirectionalLight(0xbcd6ff, 0.35); d2.position.set(300, 150, -300); scene.add(d2);

  var MAT = {
    plate: new T.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.45 }),
    post: new T.MeshStandardMaterial({ color: 0xc9d0d6, metalness: 0.7, roughness: 0.35 }),
    holder: new T.MeshStandardMaterial({ color: 0x23272b, metalness: 0.3, roughness: 0.6 }),
    beam: new T.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.55, depthWrite: false }),
    fibre: new T.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }),
    hole: new T.MeshStandardMaterial({ color: 0x5d666e, roughness: 0.8 }),
    hi: new T.MeshBasicMaterial({ color: 0x1f8fff, transparent: true, opacity: 0.18, depthWrite: false })
  };

  // breadboard section with an M6 grid every 25 mm
  var plate = new T.Mesh(new T.BoxGeometry(560, 12, 260), MAT.plate); plate.position.set(200, -6, 0); scene.add(plate);
  var holeGeo = new T.CylinderGeometry(1.6, 1.6, 0.6, 10);
  for (var gx = -75; gx <= 475; gx += 25) for (var gz = -125; gz <= 125; gz += 25) { var hm = new T.Mesh(holeGeo, MAT.hole); hm.position.set(gx, 0.31, gz); scene.add(hm); }

  // ---------------- parts ----------------
  var parts = {};                        // id -> {group, x, z, label}
  function post(group) {                 // the models stand 40 mm high; a 1/2-inch post and holder lift them to 100 mm
    var h = H - 40;
    var p = new T.Mesh(new T.CylinderGeometry(6.35, 6.35, h, 20), MAT.post); p.position.y = -40 - h / 2; group.add(p);
    var ph = new T.Mesh(new T.CylinderGeometry(9, 9, Math.min(h, 40), 20), MAT.holder); ph.position.y = -40 - h + Math.min(h, 40) / 2; group.add(ph);
  }
  function part(id, model, params, x, z, rotY, label, modes) {
    var g = new T.Group();
    var m = window.Parts3D ? window.Parts3D.build(model, params) : new T.Mesh(new T.BoxGeometry(20, 20, 20), MAT.post);
    g.add(m); post(g);
    if (id === 'ld') m.traverse(function (o) { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xf2c230) o.visible = false; });   /* free-space laser: no fibre stub */
    var hl = new T.Mesh(new T.SphereGeometry(32, 20, 14), MAT.hi); hl.visible = false; g.add(hl);
    g.position.set(x, H, z); g.rotation.y = rotY || 0; scene.add(g);
    parts[id] = { g: g, hl: hl, x: x, z: z, label: label, modes: modes };
    return g;
  }
  // common to both: laser in its butterfly mount, two isolators, half-wave plate
  part('ld', 'mount14', {}, 0, 0, 0, 'laser (Yanban, free space)', 'both');
  part('iso1', 'isolator', {}, L.x.iso1, 0, 0, 'isolator 1', 'both');
  part('iso2', 'isolator', {}, L.x.iso2, 0, 0, 'isolator 2', 'both');
  part('hwpD', 'wp', { axis: 22.5 }, L.x.hwp, 0, 0, 'λ/2 plate', 'direct');
  // direct: the bench starts at the PBS
  part('pbsD', 'pbs', {}, L.x.pbsD, 0, 0, 'PBS: bench starts', 'direct');
  // fibre: two mirrors, coupler, fibre, output collimator, then the bench PBS
  part('m1', 'mirror', {}, L.x.m1, 0, -Math.PI * 3 / 4, 'mirror 1', 'fibre');
  part('m2', 'mirror', {}, L.x.m1, L.z.m2, Math.PI / 4, 'mirror 2', 'fibre');
  part('hwpF', 'wp', { axis: 22.5 }, L.x.m1 + 38, L.z.m2, 0, 'λ/2 plate (after the mirrors)', 'fibre');
  part('cpl', 'fibcol', {}, L.x.cpl, L.z.m2, Math.PI, 'coupler PAF2-5B', 'fibre');
  part('col', 'fibcol', {}, L.x.col, L.z.out, 0, 'output collimator', 'fibre');
  part('pbsF', 'pbs', {}, L.x.pbsF, L.z.out, 0, 'PBS: bench starts', 'fibre');

  // the fibre: from the back of the coupler round a loose loop to the back of the collimator
  var fibrePts = [], cx0 = L.x.cpl + 34, cz0 = L.z.m2;
  fibrePts.push(new T.Vector3(cx0, H, cz0), new T.Vector3(cx0 + 40, H - 30, cz0 + 10));
  for (var k = 0; k <= 24; k++) { var a = Math.PI / 2 - k / 24 * 2 * Math.PI; fibrePts.push(new T.Vector3(L.x.loop + 45 * Math.cos(a), 6 + 0.9 * k, L.z.loop + 45 * Math.sin(a))); }
  fibrePts.push(new T.Vector3(L.x.col - 70, H - 40, L.z.out - 20), new T.Vector3(L.x.col - 34, H, L.z.out));
  var fibre = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(fibrePts), 160, 1.5, 8, false), MAT.fibre); scene.add(fibre);

  // ---------------- beam (Gaussian sizes from the data sheets) ----------------
  // direct beam: 1.0 x 0.8 mm at the laser; the data-sheet divergence 0.1 deg read as the full angle (or the half angle)
  function dDirect(s) {                  // beam diameter (mm), larger axis, at distance s (mm) from the laser window
    var th = L.divDeg * Math.PI / 180 * (state.half ? 2 : 1);   // full angle
    return Math.sqrt(L.d0 * L.d0 + Math.pow(th * s, 2));
  }
  function dFibre(s) { return Math.sqrt(L.dCol * L.dCol + Math.pow(L.divCol * 1e-3 * s, 2)); }
  var beamGroup = new T.Group(); scene.add(beamGroup);
  function seg(a, b, ra, rb) {
    var v = new T.Vector3().subVectors(b, a), len = v.length();
    var m = new T.Mesh(new T.CylinderGeometry(rb, ra, len, 18, 1, true), MAT.beam);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    beamGroup.add(m);
  }
  function path(pts, dfun, s0) {         // pts: [x, z] at beam height; dfun(s) diameter at path length s
    var s = s0 || 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = new T.Vector3(pts[i][0], H, pts[i][1]), b = new T.Vector3(pts[i + 1][0], H, pts[i + 1][1]);
      var n = Math.max(1, Math.round(a.distanceTo(b) / 20));
      for (var j = 0; j < n; j++) {
        var p = a.clone().lerp(b, j / n), q = a.clone().lerp(b, (j + 1) / n);
        var sa = s + a.distanceTo(b) * j / n, sb = s + a.distanceTo(b) * (j + 1) / n;
        seg(p, q, dfun(sa) / 2 * EX, dfun(sb) / 2 * EX);
      }
      s += a.distanceTo(b);
    }
    return s;
  }
  function drawBeam() {
    while (beamGroup.children.length) { var c = beamGroup.children.pop(); c.geometry.dispose(); }
    if (state.mode === 'direct') {
      path([[L.x.win, 0], [L.x.pbsD + 160, 0]], dDirect);
    } else {
      path([[L.x.win, 0], [L.x.m1, 0], [L.x.m1, L.z.m2], [L.x.cpl - 18, L.z.m2]], dDirect);
      path([[L.x.col + 30, L.z.out], [L.x.pbsF + 160, L.z.out]], dFibre);
    }
  }

  // ---------------- labels ----------------
  var lab = $('lslabels');
  function labels() {
    lab.innerHTML = '';
    if (!state.labels) return;
    var w = cv.clientWidth, h = cv.clientHeight;
    var n = 0;
    Object.keys(parts).forEach(function (id) {
      var P = parts[id]; if (!P.g.visible) return;
      var v = new T.Vector3(P.x, H + (n++ % 2 ? 62 : 34), P.z).project(cam);
      if (v.z > 1) return;
      var d = document.createElement('div'); d.className = 'ls-lbl' + (state.step >= 0 && STEPS[state.mode][state.step].on.indexOf(id) >= 0 ? ' hot' : '');
      d.textContent = P.label; d.style.left = ((v.x + 1) / 2 * w) + 'px'; d.style.top = ((1 - v.y) / 2 * h) + 'px';
      lab.appendChild(d);
    });
  }

  // ---------------- specs, budgets, steps ----------------
  function fx(x, n) { return isFinite(x) ? x.toFixed(n) : '–'; }
  function specRows() {
    var rows = [
      ['Laser', 'Yanban RB-795-DFB-BFW, free space', '100 mW min, 120 typ; 794.97 nm target; 200 kHz typ; SMSR ≥ 40 dB; PER 20 dB; 150 mA typ, 175 max; beam about 1.0 × 0.8 mm, divergence 0.1° (full or half angle not stated); window centre 5.1–5.45 mm above the package base; no isolator inside', 'vendor data sheet'],
      ['Mount', 'ILX LDM-4980 (lab, 2 units)', '14-pin butterfly, metal, heat-sinked; check its pin table against the laser (anode 10, cathode 11, TEC 1/14, NTC 2/5, PD 3/4)', 'lab inventory, data sheet'],
      ['Isolators', '2 × Thorlabs I795P3D', 'each ≥ 34 dB, 90 % at 795 nm (775–815 nm), max beam Ø2.7 mm, 0.7 W; output polarization at 45° to the input. Alternative: one IOT-5-780-VLP, 55 dB, Ø4.7 mm', 'Thorlabs specifications'],
      ['Half-wave plate', 'zero-order, Ø½″, 780 nm design', 'sets the polarization for the PBS (direct), or for the fibre slow axis (fibre: placed after the two mirrors, right before the coupler)', 'equipment list O05']
    ];
    if (state.mode === 'fibre') rows = rows.concat([
      ['Mirrors', '2 × Ø1″ silver mirror in a KM100 mount (counted in equipment rows O01 and O02)', 'OQAg-25.4: Ø25.4 mm, 5 mm thick, 450–2000 nm, reflectivity > 95 %, clear aperture > 90 % (or Thorlabs PF10-03-P01: > 97.5 %, λ/10). Beam walking into the coupler: the first sets the position, the second the angle', 'vendor catalogue table; Thorlabs drawing'],
      ['Coupler', 'Thorlabs PAF2-5B FiberPort (lab)', 'f 4.6 mm, NA 0.53, clear aperture 4.9 mm, made for a Ø1 mm beam and a 5 µm mode; tip, tilt and focus adjustable', 'Thorlabs specifications'],
      ['Fibre', 'PM780 patch cable, FC/APC both ends, 2 m (e.g. P5-780PM-FC-2)', 'PM780-HP: mode field 5.3 ± 1.0 µm at 850 nm, 770–1100 nm', 'Thorlabs fibre table'],
      ['Output', 'second FiberPort (PAF2-5B type)', 'output beam Ø1 mm, divergence 1.087 mrad', 'Thorlabs specifications']
    ]);
    $('lsSpec').innerHTML = rows.map(function (r) { return '<tr><td><b>' + r[0] + '</b><br><span class="mini">' + r[1] + '</span></td><td>' + r[2] + '</td><td class="src">' + r[3] + '</td></tr>'; }).join('');
  }
  function budgets() {
    var P0 = L.Pmin, iso = L.isoT * L.isoT, out, rows = [];
    rows.push(['Laser output (data-sheet minimum)', fx(P0, 0) + ' mW']);
    rows.push(['After two isolators (90 % each)', fx(P0 * iso, 0) + ' mW']);
    if (state.mode === 'fibre') {
      out = P0 * iso * state.eta;
      rows.push(['After the fibre (coupling ' + fx(state.eta * 100, 0) + ' %, your measured value)', fx(out, 0) + ' mW']);
    } else out = P0 * iso;
    rows.push(['Needed at the bench', '5–15 mW: turn the current down or dump the rest']);
    var ret = L.returnDb, stage = L.isoDb;
    rows.push(['Light returning from the bench (estimate)', ret + ' dB']);
    rows.push(['At the chip with one / two stages (minimum isolation)', (ret - stage) + ' / ' + (ret - 2 * stage) + ' dB']);
    rows.push(['Mode hopping begins near (Tkach and Chraplyvy)', '−70 dB: two stages needed']);
    var sB = state.mode === 'direct' ? (L.x.pbsD - L.x.win) : (L.x.pbsF - L.x.col - 30);
    var dB = state.mode === 'direct' ? dDirect(sB) : dFibre(sB);
    rows.push(['Beam at the bench PBS', 'Ø' + fx(dB, 2) + ' mm (' + (state.mode === 'direct' ? (state.half ? 'divergence read as half angle' : 'divergence read as full angle') : 'fibre output') + ')']);
    rows.push(['Beam 1 m further (at the AOMs, roughly)', 'Ø' + fx(state.mode === 'direct' ? dDirect(sB + 1000) : dFibre(sB + 1000), 2) + ' mm (AOM aperture 2.5 × 2.0 mm)']);
    if (state.mode === 'direct') {
      var thHalf = L.divDeg * Math.PI / 180 * (state.half ? 1 : 0.5), thG = L.lam * 1e-6 / (Math.PI * L.d0 / 2);
      rows.push(['Beam quality implied by the data sheet', 'M² ≈ ' + fx(thHalf / thG, 1) + ' (1.0 for an ideal Gaussian; the fibre output is ≈ 1)']);
    }
    $('lsBud').innerHTML = rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join('');
  }
  var STEPS = {
    direct: [
      { t: 'Mount and power', on: ['ld'], d: 'Laser in the metal butterfly mount on the aluminium plate (not PETG: the chip cooler dumps its heat into the mount). ITC502: current limit 170 mA and the TEC first, then the current. Check the Rb absorption and saturated-absorption features in the reference cell.' },
      { t: 'Isolator 1 at the window', on: ['iso1'], d: 'First element after the laser, nothing reflective before it. Turn it about the beam for maximum transmission: its input polarizer then lies along the laser polarization. Keep the beam centred in the Ø2.7 mm aperture.' },
      { t: 'Isolator 2', on: ['iso2'], d: 'Same procedure. Its input must take the 45° output of stage 1: turn it to maximum transmission. Two stages give about −100 dB at the chip.' },
      { t: 'Half-wave plate', on: ['hwpD'], d: 'Turns the 45° output polarization so that the PBS splits the power as wanted between control and probe.' },
      { t: 'Into the bench', on: ['pbsD'], d: 'The PBS is the first part of the bench. Walk the beam onto the bench irises with the mounts (two-iris method). From here the bench is built as designed.' }
    ],
    fibre: [
      { t: 'Mount and power', on: ['ld'], d: 'As in the direct version: metal mount, current limit 170 mA, TEC first, check the Rb lines.' },
      { t: 'Two isolators', on: ['iso1', 'iso2'], d: 'Both right after the window, each turned for maximum transmission. Returns from the bench now come back through the fibre and are stopped here.' },
      { t: 'Beam walking into the coupler', on: ['m1', 'm2', 'cpl'], d: 'Read the power at the fibre output. Mirror 1 sets the position on the coupler, mirror 2 the angle: alternate, then optimise the coupler focus and repeat. Measure the coupling efficiency and enter it in the slider.' },
      { t: 'Half-wave plate to the slow axis', on: ['hwpF'], d: 'Placed after the mirrors on purpose: a silver mirror at 45° keeps only a horizontal or vertical polarization clean, so nothing may turn the polarization before the last mirror. Set the plate roughly now; it is fixed in the next step.' },
      { t: 'Polarization launch', on: ['hwpF', 'col'], d: 'Polarizer and power meter after the output collimator. Turn the half-wave plate for the deepest minimum, then warm or gently bend the fibre: turn the plate until warming and bending change nothing.' },
      { t: 'Lock down', on: ['cpl', 'm1', 'm2'], d: 'Tighten all locking screws, write down the coupled power, check it the next day. A later touch-up of the coupler changes the power only, never the beam on the bench.' },
      { t: 'Into the bench', on: ['col', 'pbsF'], d: 'The output collimator is the start of the bench, at 100 mm. Everything after it is aligned once and stays aligned.' }
    ]
  };
  function stepsUI() {
    var ul = $('lsSteps'); ul.innerHTML = '';
    STEPS[state.mode].forEach(function (s, i) {
      var li = document.createElement('li'); if (i === state.step) li.className = 'cur';
      var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<b>' + (i + 1) + '</b> ' + s.t;
      b.addEventListener('click', function () { setStep(i); }); li.appendChild(b); ul.appendChild(li);
    });
    $('lsStepText').textContent = state.step >= 0 ? STEPS[state.mode][state.step].d : 'Choose a step to see what to do and where.';
  }
  function setStep(i) {
    state.step = i;
    Object.keys(parts).forEach(function (id) { parts[id].hl.visible = i >= 0 && STEPS[state.mode][i].on.indexOf(id) >= 0; });
    if (i >= 0) { var on = STEPS[state.mode][i].on, x = 0, z = 0; on.forEach(function (id) { x += parts[id].x; z += parts[id].z; }); ctl.target.set(x / on.length, H, z / on.length); }
    stepsUI(); labels();
  }
  function setMode(m) {
    state.mode = m; state.step = -1;
    Object.keys(parts).forEach(function (id) { var P = parts[id]; P.g.visible = P.modes === 'both' || P.modes === m; P.hl.visible = false; });
    fibre.visible = m === 'fibre';
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m ? 'true' : 'false'); });
    $('lsEtaRow').hidden = m !== 'fibre'; $('lsDivRow').hidden = m !== 'direct';
    ctl.target.set(m === 'fibre' ? 250 : 170, H, m === 'fibre' ? 0 : 0);
    drawBeam(); specRows(); budgets(); stepsUI();
  }

  // ---------------- UI wiring ----------------
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
  $('lsEta').value = Math.round(state.eta * 100);
  $('lsEta').addEventListener('input', function () { state.eta = +this.value / 100; $('lsEtaO').textContent = this.value + ' %'; budgets(); });
  $('lsEtaO').textContent = Math.round(state.eta * 100) + ' %';
  $('lsHalf').addEventListener('change', function () { state.half = this.checked; drawBeam(); budgets(); });
  $('lsLab').addEventListener('click', function () { state.labels = !state.labels; this.setAttribute('aria-pressed', state.labels ? 'true' : 'false'); labels(); });
  $('lsReset').addEventListener('click', function () { cam.position.set(150, 380, 520); setStep(-1); ctl.target.set(state.mode === 'fibre' ? 250 : 170, H, 0); });

  function resize() { var w = wrap.clientWidth, h = wrap.clientHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();
  var last = 0;
  function frame(t) { ctl.update(); R.render(scene, cam); if (t - last > 60) { labels(); last = t; } requestAnimationFrame(frame); }
  setMode('fibre'); requestAnimationFrame(frame);   /* our setup (19 Oct 2026): through the PM fibre */
  window.LSIM = { setMode: setMode, setStep: setStep, state: state, dDirect: dDirect, dFibre: dFibre };
})();
