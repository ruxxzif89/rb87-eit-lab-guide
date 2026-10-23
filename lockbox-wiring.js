/* lockbox-wiring.js (v1): 3D wiring guide of the laser lock: SAS photodiode PDA36A2 -> Red Pitaya STEMlab 125-14 (Linien) -> divider box (DIY D6) -> ITC502 MOD IN -> laser mount.
   Numbers: window.LW (injected by private/diy/build_lockwire.py from params.py). Units mm, y up.
   Connector positions on the ITC502 come from the Thorlabs ITC500 manual (front panel: MOD IN and ANALOG OUT BNC; rear panel: LD OUT 9-pin and TEC OUT 15-pin D-SUB, TUNE IN and TEMP OUT BNC);
   the PDA36A2 outline from the Thorlabs CAD drawing; the Red Pitaya board is drawn from its data sheet and the 3Dfindit view (connector positions approximate: use the printed labels on the board). */
(function () {
  'use strict';
  var T = window.THREE, LW = window.LW;
  if (!T || !LW) return;
  var $ = function (id) { return document.getElementById(id); };
  var HB = 112;                                   // beam height above the table (12 mm plate + 100 mm)
  var state = { step: 0, labels: true, flow: true, lock: false, tNow: 0 };

  // ---------------- renderer, scene, camera ----------------
  var cv = $('lwcv'), wrap = $('lw3d');
  var R = new T.WebGLRenderer({ canvas: cv, antialias: true });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new T.Scene(); scene.background = new T.Color(0xe9edf1);
  var cam = new T.PerspectiveCamera(36, 1, 5, 9000);
  var ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.495;
  scene.add(new T.HemisphereLight(0xeef4f9, 0x2a3238, 0.95));
  var dl = new T.DirectionalLight(0xffffff, 0.85); dl.position.set(-300, 700, 500); scene.add(dl);
  var dl2 = new T.DirectionalLight(0xbcd6ff, 0.35); dl2.position.set(600, 300, -400); scene.add(dl2);

  function std(c, m, r, extra) { var o = { color: c, metalness: m, roughness: r }; if (extra) for (var k in extra) o[k] = extra[k]; return new T.MeshStandardMaterial(o); }
  var M = {
    table: std(0xdfe3e7, 0.0, 0.95), plate: std(0x9aa3ab, 0.6, 0.45), post: std(0xc9d0d6, 0.7, 0.35), holder: std(0x23272b, 0.3, 0.6),
    black: std(0x14171a, 0.3, 0.6), dark: std(0x2b3036, 0.3, 0.6), alu: std(0xc4ccd2, 0.65, 0.35), steel: std(0xd7dde2, 0.8, 0.3), gold: std(0xd9b04a, 0.8, 0.3),
    pcb: std(0x1e6b3b, 0.1, 0.6), white: std(0xf1f2f3, 0.05, 0.6), rubber: std(0x14171a, 0.0, 0.9), panel: std(0xd9d6cc, 0.2, 0.6),
    glass: std(0x6fb7d6, 0.05, 0.08, { transparent: true, opacity: 0.4, depthWrite: false }), red: std(0xc23a2e, 0.1, 0.5), green: std(0x2f9a52, 0.1, 0.5),
    beam: new T.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.55, depthWrite: false }),
    hi: new T.MeshBasicMaterial({ color: 0x1f8fff, transparent: true, opacity: 0.16, depthWrite: false }),
    ring: new T.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95, depthWrite: false }),
    yellow: std(0xf2c200, 0.05, 0.55), blue: std(0x2563d6, 0.1, 0.5)
  };
  function B(w, h, d, mat, x, y, z, parent) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }
  function C(r, len, mat, x, y, z, axis, parent, seg) {
    var m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg || 24), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m;
  }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.anisotropy = 4; return t; }
  function texPlane(w, h, tex, parent, x, y, z, ry, rx) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx; parent.add(m); return m;
  }

  // ---------------- table and plates ----------------
  var table = B(1300, 20, 760, M.table, 110, -10, -20, scene);
  function plate(w, d, x, z) {
    var p = B(w, 12, d, M.plate, x, 6, z, scene), gx, gz, hole = new T.CylinderGeometry(1.6, 1.6, 0.6, 8), hm = std(0x5d666e, 0.1, 0.8);
    for (gx = -w / 2 + 12.5; gx < w / 2; gx += 25) for (gz = -d / 2 + 12.5; gz < d / 2; gz += 25) { var h = new T.Mesh(hole, hm); h.position.set(x + gx, 12.3, z + gz); scene.add(h); }
    return p;
  }
  plate(340, 200, -330, -200);        // source plate
  plate(360, 180, -310, 120);         // SAS plate

  // ---------------- anchors (connector positions) and plugs ----------------
  var anchors = {}, devices = {}, cables = {}, rings = [];
  function anchor(name, obj, p, n, label) { anchors[name] = { obj: obj, p: new T.Vector3(p[0], p[1], p[2]), n: new T.Vector3(n[0], n[1], n[2]), label: label || name }; }
  function wp(name) {
    var a = anchors[name]; a.obj.updateWorldMatrix(true, false);
    var p = a.p.clone(); a.obj.localToWorld(p); var n = a.n.clone().transformDirection(a.obj.matrixWorld); return { p: p, n: n.normalize() };
  }
  function bnc(parent, x, y, z, axis, sign) {     // BNC jack: nut, barrel and two bayonet pins
    var g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    C(6.2, 5, M.steel, 0, 0, 0, 'y', g, 20); C(4.8, 12, M.gold, 0, 7, 0, 'y', g, 20); C(1.4, 12, M.black, 0, 8, 0, 'y', g, 10);
    B(1.5, 1.5, 11, M.steel, 0, 11, 0, g); B(11, 1.5, 1.5, M.steel, 0, 11, 0, g);
    if (axis === 'z') g.rotation.x = sign * Math.PI / 2; else if (axis === 'x') g.rotation.z = -sign * Math.PI / 2;
    return g;
  }
  function plugMesh(type, p, n, col) {
    var g = new T.Group(), len = 18, m = std(col || 0x222, 0.4, 0.5), r;
    if (type === 'bnc') { C(7.2, 24, M.steel, 0, 12, 0, 'y', g, 20); C(5.6, 8, m, 0, 28, 0, 'y', g, 16); len = 32; }
    else if (type === 'sma') { C(4.6, 15, M.gold, 0, 7.5, 0, 'y', g, 16); C(3.4, 8, m, 0, 19, 0, 'y', g, 14); len = 23; }
    else if (type === 'adp') { C(7.0, 22, M.steel, 0, 11, 0, 'y', g, 20); C(4.6, 15, M.gold, 0, 29, 0, 'y', g, 16); len = 40; }   // BNC(f)-SMA(m) adapter
    else if (type === 'dsub9') { B(34, 13, 18, M.steel, 0, 9, 0, g); B(30, 10, 14, m, 0, 21, 0, g); len = 30; }
    else if (type === 'dsub15') { B(43, 13, 18, M.steel, 0, 9, 0, g); B(39, 10, 14, m, 0, 21, 0, g); len = 30; }
    else if (type === 'rj45') { B(12, 20, 15, std(0xdfe6ea, 0.1, 0.3, { transparent: true, opacity: 0.85 }), 0, 10, 0, g); B(11, 14, 10, m, 0, 26, 0, g); len = 34; }
    else if (type === 'usb') { B(8, 11, 3, M.steel, 0, 5.5, 0, g); B(14, 14, 9, m, 0, 16, 0, g); len = 24; }
    else if (type === 'din3') { C(6.5, 20, M.steel, 0, 10, 0, 'y', g, 20); C(8, 14, m, 0, 27, 0, 'y', g, 20); len = 34; }
    g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n); g.position.copy(p); scene.add(g);
    return { g: g, len: len };
  }

  // ---------------- devices ----------------
  // ITC502 (Thorlabs laser diode combi controller): front panel redrawn from the manual photo
  function front502(w, h) {
    return canvasTex(1024, Math.round(1024 * h / w), function (x, cw, ch) {
      x.fillStyle = '#d9d6cc'; x.fillRect(0, 0, cw, ch);
      function disp(x0, y0, w0, h0, txt, col) { x.fillStyle = '#1a1210'; x.fillRect(x0, y0, w0, h0); x.fillStyle = col; x.font = 'bold ' + Math.round(h0 * 0.78) + 'px monospace'; x.textAlign = 'right'; x.fillText(txt, x0 + w0 - 10, y0 + h0 * 0.82); }
      x.fillStyle = '#243b63'; x.font = 'bold 22px Arial'; x.textAlign = 'left'; x.fillText('THORLABS', 26, 40);
      x.fillStyle = '#333'; x.font = 'bold 20px Arial'; x.textAlign = 'center'; x.fillText('LASER DIODE COMBI CONTROLLER   ITC 502', cw * 0.52, 40);
      x.font = '14px Arial'; x.fillStyle = '#444'; x.fillText('TEMP CONTROLLER', cw * 0.19, 66); x.fillText('CURRENT SOURCE', cw * 0.57, 66);
      disp(cw * 0.04, 74, cw * 0.33, 78, '25.00', '#ffd21a'); disp(cw * 0.40, 74, cw * 0.34, 78, '150.0', '#ff7a1a');
      x.fillStyle = '#555'; x.font = '12px Arial'; x.textAlign = 'left';
      [['SENSOR', 0.04, 0.2], ['DISPLAY', 0.15, 0.3], ['ADJUST', 0.28, 0.2], ['DISPLAY', 0.4, 0.3], ['SETUP', 0.55, 0.3], ['ADJUST', 0.80, 0.2]].forEach(function (b) { x.strokeStyle = '#777'; x.strokeRect(cw * b[1], ch * 0.50, cw * (b[0] === 'SENSOR' ? 0.10 : 0.12), ch * 0.40); x.fillText(b[0], cw * b[1] + 6, ch * 0.50 + 14); });
      [cw * 0.33, cw * 0.88].forEach(function (cx) { x.fillStyle = '#e8e8e8'; x.beginPath(); x.arc(cx, ch * 0.72, 40, 0, 7); x.fill(); x.strokeStyle = '#666'; x.lineWidth = 3; x.stroke(); x.beginPath(); x.moveTo(cx, ch * 0.72); x.lineTo(cx + 22, ch * 0.72 - 24); x.stroke(); });
      x.fillStyle = '#222'; x.beginPath(); x.arc(cw * 0.08, ch * 0.80, 26, 0, 7); x.fill(); x.fillStyle = '#555'; x.font = '12px Arial'; x.fillText('PID', cw * 0.13, ch * 0.64); x.fillText('P    I    D', cw * 0.13, ch * 0.74);
      x.fillStyle = '#222'; x.font = 'bold 15px Arial'; x.textAlign = 'center'; x.fillText('CONTROL', cw * 0.545, ch * 0.64);
      x.fillStyle = '#c0392b'; x.fillRect(cw * 0.49, ch * 0.66, cw * 0.11, 3);
      x.fillStyle = '#111'; x.font = 'bold 15px Arial'; x.fillText('MOD IN', cw * 0.5165 + 0, ch * 0.945); x.fillText('ANALOG OUT', cw * 0.63, ch * 0.945);
    });
  }
  function rear502(w, h) {
    return canvasTex(1024, Math.round(1024 * h / w), function (x, cw, ch) {
      x.fillStyle = '#c9ccce'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#333'; x.font = 'bold 15px Arial'; x.textAlign = 'center';
      x.fillText('TUNE IN', cw * 0.104, ch * 0.34); x.fillText('TEMP OUT', cw * 0.485, ch * 0.34); x.fillText('LD OUT', cw * 0.088, ch * 0.98); x.fillText('TEC OUT', cw * 0.374, ch * 0.98); x.fillText('INTERFACE', cw * 0.66, ch * 0.2);
      x.fillStyle = '#555'; x.beginPath(); x.arc(cw * 0.30, ch * 0.5, ch * 0.28, 0, 7); x.fill(); x.strokeStyle = '#999'; x.lineWidth = 3;
      for (var r = 1; r < 5; r++) { x.beginPath(); x.arc(cw * 0.30, ch * 0.5, r * ch * 0.06, 0, 7); x.stroke(); }
      x.fillStyle = '#222'; x.fillRect(cw * 0.80, ch * 0.5, cw * 0.14, ch * 0.3); x.fillStyle = '#ddd'; x.font = '13px Arial'; x.fillText('MAINS', cw * 0.87, ch * 0.9);
    });
  }
  var itc = new T.Group(); itc.position.set(580, 0, 30); scene.add(itc); devices.itc = itc;
  (function () {
    var W = 215, H = 115, D = 300, y0 = H / 2 + 4;
    B(W, H, D, M.panel, 0, y0, 0, itc); B(W + 2, 6, D - 20, M.black, 0, 3, 0, itc);
    texPlane(W - 2, H - 2, front502(W, H), itc, 0, y0, D / 2 + 0.3);
    texPlane(W - 2, H - 2, rear502(W, H), itc, 0, y0, -D / 2 - 0.3, Math.PI);
    // front BNC jacks: MOD IN (54.3 % across, 83 % down the photo) and ANALOG OUT (63 %)
    var fx = function (u) { return (u - 0.5) * W; }, fy = function (v) { return y0 + (0.5 - v) * H; };
    bnc(itc, fx(0.5165), fy(0.83), D / 2, 'z', 1); anchor('itc.mod', itc, [fx(0.5165), fy(0.83), D / 2 + 12], [0, 0, 1], 'MOD IN (front)');
    bnc(itc, fx(0.63), fy(0.83), D / 2, 'z', 1);
    // rear: positions from the rear-panel figure, seen from behind (u grows to the viewer's right = world -x)
    var rx = function (u) { return -(u - 0.5) * W; }, ry = function (v) { return y0 + (0.5 - v) * H; };
    bnc(itc, rx(0.104), ry(0.27), -D / 2, 'z', -1); bnc(itc, rx(0.485), ry(0.27), -D / 2, 'z', -1);
    var ld = B(31, 12.5, 6, M.steel, rx(0.088), ry(0.84), -D / 2 - 3, itc); for (var i = 0; i < 9; i++) C(0.8, 1, M.black, rx(0.088) + (i - 4) * 3, ry(0.84) + (i % 2 ? 2 : -2), -D / 2 - 6.1, 'z', itc, 6);
    var tc = B(39, 12.5, 6, M.steel, rx(0.374), ry(0.84), -D / 2 - 3, itc);
    anchor('itc.ld', itc, [rx(0.088), ry(0.84), -D / 2 - 6], [0, 0, -1], 'LD OUT (rear, 9-pin)');
    anchor('itc.tec', itc, [rx(0.374), ry(0.84), -D / 2 - 6], [0, 0, -1], 'TEC OUT (rear, 15-pin)');
  })();

  // Red Pitaya STEMlab 125-14: board 100 x 60 mm; SMA edge toward +z, Ethernet edge toward -z
  var rp = new T.Group(); rp.position.set(90, 8, 150); scene.add(rp); devices.rp = rp;
  (function () {
    var pcbT = 1.6;
    B(60, pcbT, 100, M.pcb, 0, 0, 0, rp);
    [[-26, -44], [26, -44], [-26, 44], [26, 44]].forEach(function (f) { C(3, 7, M.rubber, f[0], -4.2, f[1], 'y', rp, 12); });
    B(34, 14, 36, M.black, 2, 8, -4, rp); for (var i = 0; i < 7; i++) B(34, 6, 1.4, M.black, 2, 17, -20 + i * 5.5, rp);
    B(14, 4, 16, std(0x30363b, 0.3, 0.5), -14, 3, 26, rp);
    // Ethernet RJ45 and USB-A at the back (-z) edge
    B(21, 14, 22, M.steel, 8, 8, -44, rp); B(14, 12, 18, std(0xb7bdc2, 0.5, 0.4), -18, 7, -44, rp);
    anchor('rp.eth', rp, [8, 8, -56], [0, 0, -1], 'Ethernet');
    // micro-USB power and console on the -x long edge; microSD slot at the +x edge
    B(8, 3, 6, M.steel, -31, 2.5, -30, rp); anchor('rp.pwr', rp, [-34, 2.5, -30], [-1, 0, 0], 'micro-USB PWR (5 V, 2 A)');
    B(8, 3, 6, M.steel, -31, 2.5, -14, rp);
    var sd = B(12, 1.2, 14, std(0x111418, 0.2, 0.5), 33, -1, -10, rp); B(11, 0.8, 11, std(0xb3262a, 0.2, 0.5), 38, -1, -10, rp);
    anchor('rp.sd', rp, [38, 0, -10], [1, 0, 0], 'microSD card');
    // four SMA connectors on the +z edge: IN1, IN2, OUT1, OUT2 (labels printed on the board)
    var names = ['IN1', 'IN2', 'OUT1', 'OUT2'], sx = [-21, -7, 7, 21];
    for (var k = 0; k < 4; k++) {
      C(4.6, 11, M.gold, sx[k], 5, 50, 'z', rp, 16); C(1.2, 11, M.black, sx[k], 5, 51, 'z', rp, 8);
      anchor('rp.' + names[k], rp, [sx[k], 5, 56], [0, 0, 1], names[k]);
    }
    // LV/HV jumper blocks of the two inputs (small blue blocks)
    B(6, 4, 6, M.blue, -21, 3.5, 36, rp); B(6, 4, 6, M.blue, -7, 3.5, 36, rp);
    texPlane(56, 6, canvasTex(512, 54, function (x, cw, ch) { x.fillStyle = '#1e6b3b'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.textAlign = 'center'; [['IN1', -21], ['IN2', -7], ['OUT1', 7], ['OUT2', 21]].forEach(function (a) { x.fillText(a[0], cw / 2 + a[1] * (cw / 60) * 0.94, 40); }); }), rp, 0, pcbT / 2 + 0.2, 39, 0, -Math.PI / 2);
  })();

  // PDA36A2 on a post: 52.5 x 27.7 x 59.3 mm body (+ SM1 adapter to 70.9 mm), detector 3.6 x 3.6 mm facing -x
  var pda = new T.Group(); pda.position.set(-190, HB, 120); scene.add(pda); devices.pda = pda;
  (function () {
    B(59.3, 52.5, 27.7, std(0x23282d, 0.3, 0.5), 0, 0, 0, pda);       // x = beam, y up (52.5), z across (27.7)
    C(13, 11.6, M.alu, -29.65 - 5.8, 0, 0, 'x', pda, 28); C(10.5, 12, std(0x070809, 0.1, 0.9), -29.65 - 6.2, 0, 0, 'x', pda, 28);
    B(1, 3.6, 3.6, std(0x3a3f45, 0.6, 0.3), -29.65 - 11.6, 0, 0, pda);
    C(11, 3, M.alu, -14, 26.7, 0, 'y', pda, 20);                       // gain switch (top)
    B(2, 3, 9, M.black, -14, 29, 0, pda); C(2.2, 3, std(0x39d36b, 0.0, 0.2, { emissive: 0x39d36b, emissiveIntensity: 0.8 }), 10, 26.5, 8, 'y', pda, 12); B(6, 3, 4, M.red, 10, 26.5, -7, pda);
    bnc(pda, 29.65, 8, 0, 'x', 1); anchor('pda.out', pda, [41.65, 8, 0], [1, 0, 0], 'OUTPUT (BNC, 0 to 10 V max)');
    C(5.5, 10, M.steel, 29.65 + 5, -12, 0, 'x', pda, 18); anchor('pda.pwr', pda, [39.65, -12, 0], [1, 0, 0], 'power connector (±12 V)');
    C(5, 40, M.post, 0, -26.5 - 20, 0, 'y', pda, 18);                  // post
    C(9, 36, M.holder, 0, -26.5 - 18 - 20, 0, 'y', pda, 18);
    anchor('pda.det', pda, [-41.25, 0, 0], [-1, 0, 0], 'detector 3.6 x 3.6 mm');
  })();
  function postUnder(obj, x, z, topY) { var h = topY; var p = C(6.35, h, M.post, x, h / 2, z, 'y', scene, 18); return p; }
  // simple post under the PDA down to the plate (plate top is y = 12)
  (function () { var h = HB - 26.5 - 12 - 40 - 36 + 0; })();

  // 5 V power supply, LDS12B supply, divider box, laptop
  var psu = new T.Group(); psu.position.set(30, 0, 30); scene.add(psu); devices.psu = psu;
  (function () {
    B(45, 30, 62, M.white, 0, 15, 0, psu); B(14, 3, 20, M.steel, 0, 31, -10, psu); B(6, 1, 12, M.steel, -4, 31.5, -10, psu);
    B(10, 10, 6, M.white, 0, 15, 33, psu); anchor('psu.out', psu, [0, 15, 38], [0, 0, 1], '5 V / 2 A output');
    texPlane(40, 10, canvasTex(256, 64, function (x, cw, ch) { x.fillStyle = '#f1f2f3'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#222'; x.font = 'bold 26px Arial'; x.textAlign = 'center'; x.fillText('5 V  2 A', cw / 2, 40); }), psu, 0, 29, 8, 0, -Math.PI / 2);
  })();
  var lds = new T.Group(); lds.position.set(-70, 0, -10); scene.add(lds); devices.lds = lds;
  (function () {
    B(150, 52, 100, std(0x30363b, 0.3, 0.55), 0, 26, 0, lds); B(150, 3, 100, M.black, 0, 52, 0, lds);
    texPlane(60, 16, canvasTex(256, 64, function (x, cw, ch) { x.fillStyle = '#30363b'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#fff'; x.font = 'bold 30px Arial'; x.textAlign = 'center'; x.fillText('LDS12B  ±12 V', cw / 2, 42); }), lds, 0, 30, 50.4);
    C(5.5, 8, M.steel, 40, 26, 50, 'z', lds, 18); anchor('lds.out', lds, [40, 26, 54], [0, 0, 1], '±12 V output');
    B(22, 14, 8, M.black, -50, 40, -50, lds);
  })();
  var div = new T.Group(); div.position.set(290, 0, 175); scene.add(div); devices.div = div;
  (function () {
    B(50, 27, 50, std(0x9ea6ad, 0.7, 0.4), 0, 13.5, 0, div);
    bnc(div, -19, 13.5, 25, 'z', 1); bnc(div, 19, 13.5, 25, 'z', 1);
    anchor('div.in', div, [-19, 13.5, 37], [0, 0, 1], 'IN'); anchor('div.out', div, [19, 13.5, 37], [0, 0, 1], 'OUT');
    texPlane(46, 12, canvasTex(256, 64, function (x, cw, ch) { x.fillStyle = '#9ea6ad'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#111'; x.font = 'bold 30px Arial'; x.textAlign = 'center'; x.fillText('1 / ' + LW.ratio + '   D6', cw / 2, 42); }), div, 0, 27.3, 4, 0, -Math.PI / 2);
  })();
  var lap = new T.Group(); lap.position.set(190, 0, -135); scene.add(lap); devices.lap = lap;
  var lapScreen;
  (function () {
    B(300, 14, 210, std(0x3b4248, 0.5, 0.45), 0, 7, 0, lap);
    var scr = new T.Group(); scr.position.set(0, 14, -105); scr.rotation.x = -0.2; lap.add(scr);
    B(300, 190, 7, std(0x1d2227, 0.4, 0.5), 0, 95, 0, scr);
    lapScreen = canvasTex(1024, 640, function () { });
    var sc = document.createElement('canvas'); sc.width = 1024; sc.height = 640; lapScreen = new T.CanvasTexture(sc); lapScreen.userData = sc;
    texPlane(284, 177, lapScreen, scr, 0, 95, 3.6);
    B(8, 8, 18, M.steel, -150, 12, -60, lap); anchor('lap.eth', lap, [-154, 12, -60], [-1, 0, 0], 'Ethernet (laptop)');
    B(100, 2, 70, std(0x2a3036, 0.4, 0.5), 0, 15.2, 40, lap);
  })();

  // optical items on the plates, built from the shared symbolic models (parts3d.js)
  function opt(model, params, x, z, ry, plateTop) {
    var g = new T.Group(); var m = window.Parts3D ? window.Parts3D.build(model, params || {}) : B(20, 20, 20, M.post);
    g.add(m); var h = HB - 12 - 40; if (h > 0) { C(6.35, h, M.post, 0, -40 - h / 2, 0, 'y', g, 18); C(9, 36, M.holder, 0, -40 - h + 18, 0, 'y', g, 18); }
    g.position.set(x, HB, z); g.rotation.y = ry || 0; scene.add(g); return g;
  }
  devices.laser = opt('mount14', {}, -440, -200, 0);
  var coupler = opt('fibcol', {}, -330, -200, Math.PI);
  var colOut = opt('fibcol', {}, -450, 120, 0); devices.colOut = colOut;
  var cellG = opt('refcell', {}, -350, 120, 0); devices.cell = cellG;
  // anchors on the laser mount: LD (9-pin) and TEC (15-pin) cables leave at the back (-x side, +z side)
  var lm = devices.laser;
  anchor('laser.ld', lm, [-14, 14, 18], [0, 0, 1], 'butterfly mount: LD connector');
  anchor('laser.tec', lm, [-26, 8, 18], [0, 0, 1], 'butterfly mount: TEC connector');
  // pda post (to the plate)
  (function () { var h = HB - 26.5 - 12; C(5, h - 8, M.post, -190, 12 + (h - 8) / 2, 120, 'y', scene, 18); })();
  // fibre from the source plate to the SAS plate (decorative)
  (function () {
    var pts = [[-298, HB, -200], [-250, HB - 30, -170], [-250, 40, -60], [-380, 24, 20], [-470, 40, 80], [-482, HB - 12, 110], [-474, HB, 120]];
    var c = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    scene.add(new T.Mesh(new T.TubeGeometry(c, 90, 1.6, 8, false), M.yellow));
  })();
  // beams
  function beamSeg(a, b, r) { var v = new T.Vector3().subVectors(b, a), len = v.length(); var m = new T.Mesh(new T.CylinderGeometry(r, r, len, 12, 1, true), M.beam); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()); scene.add(m); return m; }
  var beam1 = beamSeg(new T.Vector3(-420, HB, 120), new T.Vector3(-232, HB, 120), 2.2);
  var beam0 = beamSeg(new T.Vector3(-420, HB, -200), new T.Vector3(-348, HB, -200), 2.2);

  // ---------------- cables ----------------
  function cable(id, from, to, o) {
    var A = wp(from), Bp = wp(to), pa = plugMesh(o.plugA, A.p, A.n, o.col), pb = plugMesh(o.plugB, Bp.p, Bp.n, o.col);
    var pts = [A.p.clone().addScaledVector(A.n, pa.len - 2), A.p.clone().addScaledVector(A.n, pa.len + (o.k1 || 22))];
    (o.via || []).forEach(function (v) { pts.push(new T.Vector3(v[0], v[1], v[2])); });
    pts.push(Bp.p.clone().addScaledVector(Bp.n, pb.len + (o.k2 || 22)), Bp.p.clone().addScaledVector(Bp.n, pb.len - 2));
    var cur = new T.CatmullRomCurve3(pts, false, 'centripetal');
    var mat = std(o.col, 0.1, 0.55, { emissive: 0x000000 });
    var mesh = new T.Mesh(new T.TubeGeometry(cur, 140, o.r || 2.4, 10, false), mat); scene.add(mesh);
    var dots = []; for (var i = 0; i < 4; i++) { var d = new T.Mesh(new T.SphereGeometry((o.r || 2.4) * 1.9, 12, 8), new T.MeshBasicMaterial({ color: o.flowCol || 0xffffff })); d.visible = false; scene.add(d); dots.push(d); }
    cables[id] = { id: id, mesh: mesh, mat: mat, curve: cur, plugs: [pa.g, pb.g], dots: dots, col: o.col, from: from, to: to, mid: cur.getPoint(0.5) };
  }
  var BLU = 0x1f6fd1, GRN = 0x2c9a4f, ORG = 0xe0791a, GRY = 0x444a50, YEL = 0xd4a800, RED = 0xc23a2e, WHT = 0xe9edf0, PUR = 0x7b4bc2;
  // numbering as in the step list
  cable('pwrPDA', 'lds.out', 'pda.pwr', { plugA: 'din3', plugB: 'din3', col: 0x2b2b2b, r: 2.6, via: [[-100, 12, 60], [-120, 14, 120]], flowCol: 0xffe066 });
  cable('sig', 'pda.out', 'rp.IN1', { plugA: 'bnc', plugB: 'adp', col: BLU, r: 2.4, via: [[-40, 40, 215], [20, 30, 225]], k1: 30, k2: 30, flowCol: 0x9cc8ff });
  cable('usb5v', 'psu.out', 'rp.pwr', { plugA: 'usb', plugB: 'usb', col: RED, r: 2.2, via: [[-40, 14, 60]], k1: 15, k2: 15, flowCol: 0xffb3a8 });
  cable('eth', 'rp.eth', 'lap.eth', { plugA: 'rj45', plugB: 'rj45', col: 0xf0f0e0, r: 2.6, via: [[40, 12, -90]], k1: 18, k2: 18, flowCol: 0xffffff });
  cable('out1', 'rp.OUT1', 'div.in', { plugA: 'adp', plugB: 'bnc', col: GRN, r: 2.4, via: [[110, 60, 235], [250, 50, 245]], k1: 30, k2: 30, flowCol: 0xa8f0c0 });
  cable('mod', 'div.out', 'itc.mod', { plugA: 'bnc', plugB: 'bnc', col: ORG, r: 2.4, via: [[420, 40, 260]], k1: 30, k2: 30, flowCol: 0xffd0a0 });
  cable('ld', 'itc.ld', 'laser.ld', { plugA: 'dsub9', plugB: 'dsub9', col: GRY, r: 3.4, via: [[360, 40, -300], [-200, 40, -330], [-400, 40, -250]], k1: 30, k2: 30, flowCol: 0xff6a6a });
  cable('tec', 'itc.tec', 'laser.tec', { plugA: 'dsub15', plugB: 'dsub15', col: PUR, r: 3.4, via: [[380, 20, -320], [-190, 20, -345], [-410, 20, -260]], k1: 40, k2: 40, flowCol: 0xdcc2ff });

  // connector rings (pulse when a step uses them)
  Object.keys(anchors).forEach(function (n) {
    var a = anchors[n], r = new T.Mesh(new T.TorusGeometry(10, 1.1, 8, 28), M.ring); r.visible = false; scene.add(r); rings.push({ name: n, mesh: r });
  });

  // ---------------- highlight boxes ----------------
  var hl = {};
  Object.keys(devices).forEach(function (k) {
    devices[k].updateWorldMatrix(true, true);
    var bb = new T.Box3().setFromObject(devices[k]), s = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
    var m = new T.Mesh(new T.BoxGeometry(s.x + 10, s.y + 10, s.z + 10), M.hi); m.position.copy(c); m.visible = false; scene.add(m); hl[k] = m;
  });

  // ---------------- laptop screen (Linien-like window) ----------------
  function drawScreen(t) {
    var cvs = lapScreen.userData, x = cvs.getContext('2d'), w = cvs.width, h = cvs.height;
    x.fillStyle = '#0e1a24'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#17324a'; x.fillRect(0, 0, w, 54); x.fillStyle = '#e8f1f8'; x.font = 'bold 28px Arial'; x.textAlign = 'left'; x.fillText('Linien (laser lock)   Red Pitaya connected', 18, 36);
    x.fillStyle = '#0a1219'; x.fillRect(18, 74, w - 36, 330); x.strokeStyle = '#27475f'; x.lineWidth = 1;
    for (var i = 1; i < 6; i++) { x.beginPath(); x.moveTo(18, 74 + i * 55); x.lineTo(w - 18, 74 + i * 55); x.stroke(); }
    var wLine = 0.06, c0 = 0.5 + (state.lock ? 0 : 0.06 * Math.sin(t * 0.6));
    x.lineWidth = 3; x.strokeStyle = '#4aa8ff'; x.beginPath();
    for (var px = 0; px <= 1; px += 0.004) { var d = (px - 0.5), dop = Math.exp(-d * d / 0.08), dip = 0.5 * dop / (1 + (d / wLine) * (d / wLine)); var y = 74 + 330 - (80 + 170 * dop - 0 * dip - 190 * dip * 0.9); x.lineTo(18 + px * (w - 36), y - 0); }
    x.stroke(); x.strokeStyle = '#35e07a'; x.beginPath();
    for (px = 0; px <= 1; px += 0.004) { d = px - 0.5; var e = -d / Math.pow(1 + (d / wLine) * (d / wLine), 2) * 1.6; x.lineTo(18 + px * (w - 36), 74 + 165 - e * 340); } x.stroke();
    x.strokeStyle = '#ff5a4a'; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(18 + c0 * (w - 36), 74); x.lineTo(18 + c0 * (w - 36), 404); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#9fb7c9'; x.font = '22px Arial'; x.fillText('blue: SAS signal (IN1)    green: error signal    red: laser position', 24, 436);
    x.fillStyle = state.lock ? '#35e07a' : '#ff9a2a'; x.font = 'bold 34px Arial'; x.fillText(state.lock ? 'LOCKED' : 'scanning', 24, 500);
    x.fillStyle = '#cfe0ec'; x.font = '24px Arial'; x.fillText('modulation: 20 kHz   amplitude: ' + LW.dither_mV.toFixed(1) + ' mV   PID: on', 24, 548);
    x.fillText('IN1 +0.31 V    OUT1 ' + (state.lock ? '+0.04' : '0.00') + ' V', 24, 590);
    lapScreen.needsUpdate = true;
  }

  // ---------------- labels ----------------
  var labBox = $('lwlabels'), labs = [];
  function addLab(text, getPos, cls, only) { var d = document.createElement('div'); d.className = 'lw-lbl' + (cls ? ' ' + cls : ''); d.textContent = text; labBox.appendChild(d); labs.push({ el: d, pos: getPos, cls: cls, only: only }); return d; }
  function atObj(o, x, y, z) { return function () { return o.localToWorld(new T.Vector3(x, y, z)); }; }
  var devLabels = {
    itc: ['Thorlabs ITC502 (laser controller)', atObj(itc, 0, 150, 0)], rp: ['Red Pitaya STEMlab 125-14 (Linien)', atObj(rp, 0, 40, 40)], pda: ['PDA36A2 photodiode (SAS)', atObj(pda, 0, 52, 0)],
    psu: ['5 V / 2 A supply', atObj(psu, 0, 52, 0)], lds: ['LDS12B ±12 V supply', atObj(lds, 0, 72, 0)], div: ['divider box D6 (1/' + LW.ratio + ')', atObj(div, 0, 46, 0)],
    lap: ['laptop with Linien', atObj(lap, 0, 220, -105)], laser: ['laser mount (butterfly, source plate)', atObj(devices.laser, 0, 36, 0)], cell: ['SAS reference cell (S01)', atObj(cellG, 0, 34, 0)], colOut: ['fibre output collimator', atObj(colOut, 0, 34, 0)]
  };
  Object.keys(devLabels).forEach(function (k) { devLabels[k].el = addLab(devLabels[k][0], devLabels[k][1], 'dev', (k === 'cell' || k === 'colOut') ? [1] : (k === 'laser' ? [0, 6, 7, 9] : null)); });
  var connLabels = {};
  Object.keys(anchors).forEach(function (n) { if (/^(rp\.(IN1|OUT1|eth|pwr|sd)|itc\.(mod|ld|tec)|pda\.(out|pwr)|div\.(in|out)|lds\.out|psu\.out|lap\.eth|laser\.(ld|tec))$/.test(n)) { connLabels[n] = addLab(anchors[n].label, function () { var w = wp(n); return w.p.clone().addScaledVector(w.n, 40).add(new T.Vector3(0, 14 + (connLabels[n].off || 0) * 17, 0)); }, 'conn'); connLabels[n].style.display = 'none'; } });
  var cabLabels = {}, cabNo = { pwrPDA: 2, sig: 3, usb5v: 4, eth: 4, out1: 5, mod: 5, ld: 6, tec: 6 };
  Object.keys(cables).forEach(function (k) { cabLabels[k] = addLab(String(cabNo[k]), function () { return cables[k].mid.clone(); }, 'num'); });
  addLab('light 795 nm (SAS probe)', function () { return new T.Vector3(-300, HB + 36, 120); }, 'dev', [1]);
  addLab('isolators, mirrors, λ/2 not drawn (see Laser source 3D)', function () { return new T.Vector3(-380, 60, -200); }, 'note', [1, 6]);
  addLab('PM fibre to the bench', function () { return new T.Vector3(-300, 34, -40); }, 'note', [1, 6]);

  // ---------------- steps ----------------
  var STEPS = window.LW_STEPS = [
    { t: 'Overview', dev: [], cab: [], conn: [], dir: [0.3, 0.7, 1], flowAll: true,
      h: '<p>The lock closes a loop: <b>laser → SAS cell → photodiode → Red Pitaya (Linien) → divider → ITC502 MOD IN → laser current</b>. Press a step to see its cables; the moving dots show the signal direction.</p><p class="lw-leg"><span style="background:#1f6fd1"></span>signal from the photodiode <span style="background:#2c9a4f"></span>correction from the Red Pitaya <span style="background:#e0791a"></span>into the ITC502 <span style="background:#444a50"></span>laser current <span style="background:#7b4bc2"></span>laser TEC <span style="background:#c23a2e"></span>5 V <span style="background:#2b2b2b"></span>±12 V</p><p>Not drawn: mains cables, the pump beam, the isolators, mirrors and wave plates.</p>' },
    { t: '1 · Light onto the photodiode', dev: ['colOut', 'cell', 'pda'], cab: [], conn: ['pda.det'], dir: [0.15, 0.45, 1], beam: true,
      h: '<p>The 795 nm SAS probe beam comes from the fibre output, goes through the <b>Rb reference cell</b> (S01, natural Rb, room temperature) and onto the <b>PDA36A2</b>. The pump beam (not drawn) crosses it in the opposite direction.</p><ul><li>Silicon detector 3.6 × 3.6 mm: centre the spot on it.</li><li>Cover the cell and the detector (cell holder cover S02) so room light does not reach the detector.</li></ul><p class="lw-chk"><b>Check:</b> with the beam blocked the signal is near 0 V; with it open the signal rises and is smooth, with no spikes.</p>' },
    { t: '2 · Power the PDA36A2 (±12 V)', dev: ['lds', 'pda'], cab: ['pwrPDA'], conn: ['lds.out', 'pda.pwr'], dir: [0.1, 0.55, 1],
      h: '<p>The <b>LDS12B</b> linear supply (BOM E04) gives ±12 V to the <b>power connector</b> at the back of the PDA36A2 (cable ②). Use the linear supply, not a switching one: supply ripple lands directly on the signal.</p><p class="lw-chk"><b>Check:</b> switch the PDA36A2 on: the green LED lights. Gain switch in the middle (about 30 dB) for the first test.</p>' },
    { t: '3 · Photodiode signal into Red Pitaya IN1', dev: ['pda', 'rp'], cab: ['sig'], conn: ['pda.out', 'rp.IN1'], dir: [0.12, 0.5, 1],
      h: '<p>The <b>BNC output</b> of the PDA36A2 goes with a BNC cable (BOM K01) to <b>IN1</b> of the Red Pitaya through a BNC–SMA adapter (K03) (cable ③).</p><ul><li>The PDA output is 0 to 10 V; the Red Pitaya input is <b>±1 V</b> (low-voltage jumper, the board default), 1 MΩ, with 30 V absolute maximum.</li><li>Set the PDA gain so the signal, with its Doppler background, stays <b>below +1 V</b>. Use the calculator below.</li></ul><p class="lw-chk"><b>Check:</b> Linien shows the SAS trace on IN1 without a flat top. A flat top means the input is clipped: lower the gain.</p>' },
    { t: '4 · Power and network for the Red Pitaya', dev: ['psu', 'rp', 'lap'], cab: ['usb5v', 'eth'], conn: ['rp.pwr', 'rp.eth', 'rp.sd', 'lap.eth'], dir: [-0.9, 0.75, 0.25],
      h: '<p><b>microSD</b> card (with the Red Pitaya system) in its slot. <b>5 V / 2 A</b> supply to the micro-USB marked PWR (cable ④, red). <b>Ethernet</b> from the Red Pitaya to the laptop (cable ④, white), directly or through a router.</p><p class="lw-chk"><b>Check:</b> the LEDs on the board light and the laptop finds the Red Pitaya on the network; start Linien and connect to it (its name rp-xxxxxx.local, or its IP address).</p>' },
    { t: '5 · Correction signal: OUT1 → divider → MOD IN', dev: ['rp', 'div', 'itc'], cab: ['out1', 'mod'], conn: ['rp.OUT1', 'div.in', 'div.out', 'itc.mod'], dir: [0.15, 0.55, 1],
      h: '<p><b>OUT1</b> of the Red Pitaya (SMA, ±1 V into 50 Ω, 14-bit) goes through a BNC–SMA adapter and a BNC cable to the <b>IN</b> jack of the divider box D6 (cable ⑤ green); the <b>OUT</b> jack goes to <b>MOD IN on the FRONT panel</b> of the ITC502 (cable ⑤ orange).</p><ul><li>Divider: <span id="lwR1"></span> in series and 1 kΩ to ground, ratio 1 / <span id="lwRat"></span>.</li><li>The ITC502 adds the modulation to the dial current (20 mA per volt), so the signal must have no DC part; set the current with the dial.</li><li><b>1 V</b> at the divider input tunes the laser by about <span id="lwGV"></span> MHz; one step of the 14-bit output moves it by <span id="lwLSB"></span> MHz.</li></ul><p class="lw-chk"><b>Check:</b> with a 100 mV step on OUT1 the laser frequency moves about <span id="lw100"></span> MHz (see it as a shift of the SAS line on the scope).</p>' },
    { t: '6 · ITC502 rear: LD OUT and TEC OUT', dev: ['itc', 'laser'], fdev: ['itc'], cab: ['ld', 'tec'], conn: ['itc.ld', 'itc.tec'], dir: [0.15, 0.4, -1],
      h: '<p>On the <b>rear</b> of the ITC502, <b>LD OUT</b> (9-pin D-SUB, left) carries the laser current and <b>TEC OUT</b> (15-pin D-SUB, next to it) the Peltier and the thermistor (cables ⑥, grey and purple). Do not use <b>TUNE IN</b> or <b>TEMP OUT</b> (BNC jacks).</p><ul><li>Set the current limit ILD LIM to <b>175 mA or less</b> before connecting the laser.</li><li>The cable set of the mount (inventory I05) may not match the ITC502 pins: <b>measure the pin-out first</b> (open item).</li></ul><p class="lw-chk"><b>Check:</b> with a dummy load first (DIY D3), the laser after that.</p>' },
    { t: '7 · The other end: the laser mount', dev: ['itc', 'laser'], fdev: ['laser'], cab: ['ld', 'tec'], conn: ['laser.ld', 'laser.tec'], dir: [0.2, 0.55, 1],
      h: '<p>The two cables run behind the plates to the <b>butterfly laser mount</b> on the source plate (the laser, its isolators and the PM fibre are described on the Laser source 3D page). One connector carries the laser diode (anode, cathode, photodiode), the other the Peltier and the 10 kΩ thermistor.</p><ul><li>Keep the chip warmer than about 11 °C (the thermistor limit of the ITC502).</li><li>Switch on the temperature control first, wait until it settles, then the laser current.</li></ul><p class="lw-chk"><b>Check:</b> the temperature display reaches the set value; only then press the laser ON key.</p>' },
    { t: '8 · Linien on the laptop', dev: ['lap', 'rp'], fdev: ['lap'], cab: ['eth'], conn: ['lap.eth'], dir: [0.05, 0.3, 1], lock: true,
      h: '<p>In Linien: choose the SAS signal on IN1, set the <b>modulation</b> (dither) frequency 10 to 100 kHz with an amplitude of about <span id="lwDith"></span> mV at the Red Pitaya output (about 5 MHz at the laser), scan across the Doppler profile, find the sub-Doppler dip, set the demodulation phase so the error signal is clean, then press <b>lock</b>.</p><p class="lw-chk"><b>Check:</b> the error signal is zero at the dip centre and has opposite signs on both sides; after the lock the SAS signal stays at the dip. Try the lock model below.</p>' },
    { t: '9 · Checks before the first lock', dev: ['pda', 'rp', 'div', 'itc'], cab: ['sig', 'out1', 'mod'], conn: [], dir: [0.3, 0.62, 1],
      h: '<ol class="lw-ol"><li>PDA36A2: LED on, signal under +1 V at the chosen gain.</li><li>Divider (DMM): 1 V in, about 7.5 mV out with a 10 kΩ load.</li><li>ITC502: ILD LIM set, MOD IN jack on the front (not ANALOG OUT next to it).</li><li>Ground: no ground loop; look at the SAS signal on the scope for 50 Hz hum.</li><li>Lock range: ±2 V at the divider input is about ±<span id="lwSw"></span> MHz at the laser; if the drift is larger, nudge the laser temperature by hand.</li></ol>' }
  ];
  function fillNumbers() {
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('lwR1', (LW.R1 / 1e3).toFixed(0) + ' kΩ'); set('lwRat', LW.ratio); set('lwGV', (LW.GHz_per_V * 1000).toFixed(0)); set('lwLSB', LW.lsb_MHz.toFixed(3)); set('lw100', (LW.GHz_per_V * 1000 * 0.1).toFixed(0));
    set('lwDith', LW.dither_mV.toFixed(1)); set('lwSw', (LW.swing_GHz * 1000).toFixed(0));
  }

  // ---------------- camera moves and step selection ----------------
  var camGoal = null, camFrom = null, camT = 1;
  function stepBox(s) {
    var bb = new T.Box3();
    var add = function (o) { o.updateWorldMatrix(true, true); bb.expandByObject(o); };
    if (s.flowAll) { Object.keys(devices).forEach(function (k) { add(devices[k]); }); bb.expandByPoint(new T.Vector3(-500, 0, -380)); bb.expandByPoint(new T.Vector3(720, 160, 330)); return bb; }
    if (s.fdev) bb.fd = true;
    (s.fdev || s.dev).forEach(function (k) { add(devices[k]); });
    if (!s.fdev) s.cab.forEach(function (id) { for (var i = 0; i <= 12; i++) bb.expandByPoint(cables[id].curve.getPoint(i / 12)); });
    s.conn.forEach(function (n) { bb.expandByPoint(wp(n).p); });
    return bb;
  }
  function frameBox(bb, dir) {
    var c = bb.getCenter(new T.Vector3()), asp = Math.max(0.5, wrap.clientWidth / Math.max(1, wrap.clientHeight));
    var fv = cam.fov * Math.PI / 180, tv = Math.tan(fv / 2), th = tv * asp;
    var d = new T.Vector3(dir[0], dir[1], dir[2]).normalize(), up = new T.Vector3(0, 1, 0), right = new T.Vector3().crossVectors(up, d).normalize(), up2 = new T.Vector3().crossVectors(d, right).normalize();
    var dist = 220;
    for (var i = 0; i < 8; i++) {
      var q = new T.Vector3((i & 1) ? bb.max.x : bb.min.x, (i & 2) ? bb.max.y : bb.min.y, (i & 4) ? bb.max.z : bb.min.z).sub(c);
      dist = Math.max(dist, q.dot(d) + Math.max(Math.abs(q.dot(right)) / th, Math.abs(q.dot(up2)) / tv));
    }
    dist *= bb.fd ? 1.5 : 1.18;
    camFrom = { p: cam.position.clone(), t: ctl.target.clone() }; camGoal = { p: c.clone().addScaledVector(d, dist), t: c }; camT = 0;
  }
  function selectStep(i) {
    state.step = i; var s = STEPS[i];
    var ol = $('lwSteps').children; for (var k = 0; k < ol.length; k++) ol[k].className = k === i ? 'cur' : '';
    $('lwStepText').innerHTML = '<h3>' + s.t + '</h3>' + s.h; fillNumbers();
    Object.keys(hl).forEach(function (k) { hl[k].visible = s.dev.indexOf(k) >= 0; });
    Object.keys(cables).forEach(function (id) { var on = s.flowAll || s.cab.indexOf(id) >= 0; cables[id].on = on; cables[id].mat.emissive.setHex(on && !s.flowAll ? 0x333333 : 0x000000); cables[id].mat.opacity = 1; cables[id].mat.transparent = !on && !s.flowAll; cables[id].mat.opacity = (!on && !s.flowAll) ? 0.35 : 1; cabLabels[id].style.display = (on || s.flowAll) ? '' : 'none'; cables[id].plugs.forEach(function (p) { p.visible = true; }); });
    rings.forEach(function (r) { r.mesh.visible = s.conn.indexOf(r.name) >= 0; });
    Object.keys(connLabels).forEach(function (n) { var ix = s.conn.indexOf(n); connLabels[n].style.display = ix >= 0 ? '' : 'none'; connLabels[n].off = ix < 0 ? 0 : ix; });
    beam1.visible = true; beam0.visible = true;
    if (s.lock) { state.lockShow = true; } else state.lockShow = false;
    frameBox(stepBox(s), s.dir);
  }
  var ol = $('lwSteps');
  STEPS.forEach(function (s, i) { var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span class="n">' + (i === 0 ? '·' : i) + '</span><span>' + s.t.replace(/^\d · /, '') + '</span>'; b.addEventListener('click', function () { selectStep(i); }); li.appendChild(b); ol.appendChild(li); });

  // ---------------- toy lock model and the photodiode calculator ----------------
  var lk = { d: 12, t: 0, hist: [], on: false, corr: 0, drift: 40, bw: 30, noise: 0.6, w: 10 };
  function errFn(d) { var u = 1 + Math.pow(2 * d / lk.w, 2); return d / (u * u); }
  function lockStep(dt) {
    var g = 2 * Math.PI * lk.bw, n = (Math.random() - 0.5) * lk.noise * 2 * Math.sqrt(dt * 60) * 0.4;
    lk.t += dt;
    var drift = lk.drift * Math.sin(lk.t * 0.35) * 0.5 + lk.drift * 0.15;   // MHz/s, slow wander
    if (lk.on) { var corr = -g * errFn(lk.d) * dt; lk.corr += corr; lk.d += corr; }
    lk.d += drift * dt + n;
    if (lk.on) { var limit = LW.swing_GHz * 1000; if (Math.abs(lk.corr) > limit) { lk.on = false; lk.lost = 'the correction reached the output limit of the Red Pitaya'; setLockUI(); } else if (Math.abs(lk.d) > 2.5 * lk.w) { lk.on = false; lk.lost = 'the drift is faster than the loop can follow'; setLockUI(); } }
    lk.hist.push(lk.d); if (lk.hist.length > 400) lk.hist.shift();
  }
  function setLockUI() { var b = $('lwLockBtn'); if (b) { b.textContent = lk.on ? 'Lock ON (press to release)' : 'Lock OFF (press to lock)'; b.setAttribute('aria-pressed', lk.on ? 'true' : 'false'); } state.lock = lk.on; }
  function drawLock() {
    var c = $('lwLockCv'); if (!c) return; var x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#0e1a24'; x.fillRect(0, 0, w, h);
    var top = 8, th = 98, mid = top + th / 2, wr = 40;                    // top plot: detuning from -wr..+wr MHz
    x.strokeStyle = '#27475f'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, mid); x.lineTo(w, mid); x.stroke();
    x.lineWidth = 2; x.strokeStyle = '#4aa8ff'; x.beginPath();
    for (var px = 0; px <= w; px += 2) { var d = (px / w - 0.5) * 2 * wr, y = top + th - 8 - (th - 24) * (0.55 + 0.35 * Math.exp(-d * d / 1800) - 0.5 * Math.exp(-d * d / 1800) / (1 + Math.pow(2 * d / lk.w, 2))); x.lineTo(px, y); } x.stroke();
    x.strokeStyle = '#35e07a'; x.beginPath(); for (px = 0; px <= w; px += 2) { d = (px / w - 0.5) * 2 * wr; x.lineTo(px, mid - errFn(d) * 12); } x.stroke();
    var lx = (lk.d / (2 * wr) + 0.5) * w; x.strokeStyle = '#ff5a4a'; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(lx, top); x.lineTo(lx, top + th); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#9fb7c9'; x.font = '11px Arial'; x.fillText('SAS dip (blue), error signal (green), laser (red)   ±' + wr + ' MHz', 6, h - 100 + 4);
    var ty = h - 88, tH = 80; x.fillStyle = '#0a1219'; x.fillRect(0, ty, w, tH); x.strokeStyle = '#27475f'; x.beginPath(); x.moveTo(0, ty + tH / 2); x.lineTo(w, ty + tH / 2); x.stroke();
    x.strokeStyle = lk.on ? '#35e07a' : '#ff9a2a'; x.lineWidth = 1.6; x.beginPath();
    for (var i = 0; i < lk.hist.length; i++) { var yy = ty + tH / 2 - Math.max(-1, Math.min(1, lk.hist[i] / 60)) * (tH / 2 - 3); if (i === 0) x.moveTo(i * w / 400, yy); else x.lineTo(i * w / 400, yy); } x.stroke();
    x.fillStyle = '#9fb7c9'; x.fillText('laser detuning over time (±60 MHz)', 6, ty + 12);
    var out = lk.corr / (LW.GHz_per_V * 1000);
    var o = $('lwLockOut'); if (o) o.innerHTML = 'detuning <b>' + lk.d.toFixed(1) + ' MHz</b> · correction ' + lk.corr.toFixed(1) + ' MHz = Red Pitaya OUT1 <b>' + out.toFixed(2) + ' V</b> (limit ±' + LW.swing_V + ' V)' + (lk.lost ? ' <span style="color:#ff7a6a"><b>lock lost: ' + lk.lost + '</b></span>' : '');
  }
  function calc() {
    var P = +$('lwP').value, gi = +$('lwG').value, gains = [1.5e3, 4.75e3, 1.5e4, 4.75e4, 1.5e5, 4.75e5, 1.5e6, 4.75e6], resp = 0.5;
    var V = P * 1e-6 * resp * gains[gi]; $('lwPo').textContent = P + ' µW'; $('lwGo').textContent = gi * 10 + ' dB';
    var out = $('lwVo'); out.innerHTML = 'signal at IN1 about <b>' + V.toFixed(V < 0.1 ? 3 : 2) + ' V</b>' + (V > 1 ? ' <span class="bad">clipped: above +1 V, lower the gain</span>' : V < 0.02 ? ' <span class="warn">small: raise the gain (bandwidth falls as the gain rises: keep it well above the dither frequency)</span>' : ' <span class="ok">fits the ±1 V input</span>');
  }

  // ---------------- labels projection, resize, loop ----------------
  var tmp = new T.Vector3();
  function placeLabels() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    labs.forEach(function (l) {
      var show = state.labels; if (l.cls === 'conn' || l.cls === 'num') show = show && l.el.style.display !== 'none';
      if (l.only && l.only.indexOf(state.step) < 0) { l.el.style.visibility = 'hidden'; return; }
      if (!show && l.cls !== 'conn' && l.cls !== 'num') { l.el.style.visibility = 'hidden'; return; }
      if (l.el.style.display === 'none') return;
      var p = l.pos(); tmp.copy(p).project(cam);
      if (tmp.z > 1 || tmp.z < -1) { l.el.style.visibility = 'hidden'; return; }
      l.el.style.visibility = 'visible'; l.el.style.left = ((tmp.x * 0.5 + 0.5) * w) + 'px'; l.el.style.top = ((-tmp.y * 0.5 + 0.5) * h) + 'px';
    });
  }
  function resize() { var w = wrap.clientWidth, h = wrap.clientHeight; if (w < 10 || h < 10) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

  var clock = new T.Clock(), tAcc = 0;
  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05); tAcc += dt;
    if (camGoal && camT < 1) { camT = Math.min(1, camT + dt / 1.1); var e = camT * camT * (3 - 2 * camT); cam.position.lerpVectors(camFrom.p, camGoal.p, e); ctl.target.lerpVectors(camFrom.t, camGoal.t, e); }
    ctl.update();
    var s = STEPS[state.step];
    Object.keys(cables).forEach(function (id) {
      var c = cables[id], show = state.flow && (c.on || s.flowAll);
      for (var i = 0; i < c.dots.length; i++) { c.dots[i].visible = show; if (show) c.dots[i].position.copy(c.curve.getPoint(((tAcc * 0.18 + i / c.dots.length) % 1))); }
    });
    rings.forEach(function (r) { if (!r.mesh.visible) return; var w = wp(r.name); r.mesh.position.copy(w.p).addScaledVector(w.n, 14); r.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), w.n); var k = 1 + 0.25 * Math.sin(tAcc * 5); r.mesh.scale.set(k, k, k); });
    drawScreen(tAcc); lockStep(dt); drawLock();
    R.render(scene, cam); placeLabels();
    requestAnimationFrame(frame);
  }

  // ---------------- UI ----------------
  $('lwLab').addEventListener('click', function () { state.labels = !state.labels; this.setAttribute('aria-pressed', state.labels); });
  $('lwFlow').addEventListener('click', function () { state.flow = !state.flow; this.setAttribute('aria-pressed', state.flow); });
  $('lwReset').addEventListener('click', function () { selectStep(0); });
  $('lwPrev').addEventListener('click', function () { selectStep((state.step + STEPS.length - 1) % STEPS.length); });
  $('lwNext').addEventListener('click', function () { selectStep((state.step + 1) % STEPS.length); });
  $('lwLockBtn').addEventListener('click', function () { lk.on = !lk.on; lk.lost = ''; if (lk.on) { lk.corr = 0; if (Math.abs(lk.d) > 2.5 * lk.w) lk.d = 0; } setLockUI(); });
  $('lwDrift').addEventListener('input', function () { lk.drift = +this.value; $('lwDriftO').textContent = this.value + ' MHz/s'; });
  $('lwBw').addEventListener('input', function () { lk.bw = +this.value; $('lwBwO').textContent = this.value + ' Hz'; });
  ['lwP', 'lwG'].forEach(function (id) { $(id).addEventListener('input', calc); });
  window.LWSIM = { go: selectStep, state: state, cam: cam, anchors: anchors, cables: cables, wp: wp, lk: lk, step: lockStep, setLock: setLockUI };

  resize(); fillNumbers(); calc(); setLockUI(); cam.position.set(260, 620, 1400); ctl.target.set(120, 40, 0); selectStep(0);
  requestAnimationFrame(frame);
})();
