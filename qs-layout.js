/* ==========================================================================
   "Quantum Spain-style bench": a second configuration for the 3D bench simulator (bench-sim.js reads window.BENCH_CFG).
   Arrangement taken from ONE photograph of a Quantum Spain-style EIT bench: two Thorlabs MB4545/M breadboards (450 x 450 mm) side by side,
   an instrument shelf behind them and a Rigol oscilloscope at each end. Left board = laser input and the saturated-absorption (SAS)
   lock; right board = the EIT board with two AOMs, the cell and the detector. The optical chain is the guide's own Zeeman-EIT chain
   (same physics as eitphys.js), re-laid on the two boards. Parts marked "assumed" are not visible in the photo.
   Coordinates are table millimetres: x to the right, z towards the front. Board 1 = x 100..550, board 2 = x 550..1000, z 250..700.
   ========================================================================== */
(function () {
  'use strict';
  var P = window.EITPhys, K = P.K;
  var TABLE = { w: 1100, d: 780, pitch: 25 };
  var SHELF_Z = 70, E = [1, 0], W = [-1, 0], S = [0, 1], N = [0, -1];

  /* what the photograph shows for each kind of part (shown in the inspector as "In the photo") */
  var PHOTO = {
    laser: 'The laser itself is not clearly visible. Blue polarization-maintaining fibre patch cables with green FC/APC connectors lie in front of board 1, so the source is fibre-coupled.',
    isolator: 'A tall cylindrical part at the back of board 1 may be the isolator or a collimator tube; not certain.',
    mirror: 'Black two-axis kinematic mounts on silver posts, with grey or red clamping forks and white asset labels on top (Thorlabs KM100 / Polaris class).',
    pbs: 'Small clear cubes on kinematic cube mounts with white tags, several on each board.',
    npbs: 'Small clear cubes on kinematic cube mounts with white tags, several on each board.',
    hwp: 'Waveplates in black rotation mounts with a white angle scale (RSP1 type).',
    qwp: 'Waveplates in black rotation mounts with a white angle scale (RSP1 type).',
    lens: 'Lenses in black lens mounts and tubes, some with a blue anti-reflection tint.',
    aom: 'Red-housed modules with a gold SMA connector on top and a white label, two on board 2. They are the two AOMs; the maker is not readable (possibly Thorlabs).',
    cell: 'White 3D-printed enclosure with red heater and coil leads on board 2: the EIT vapour cell module.',
    refcell: 'White 3D-printed enclosure with banana jacks and a small board on board 1: the SAS reference cell module.',
    pd: 'A black box with a round aperture at the right end of board 2 (a detector or a camera) and another beside board 1 with an orange cable.',
    sas: 'A black box with a round aperture at the left end of board 1 with an orange cable to the scope (probably the SAS photodiode).',
    dump: 'Beam dumps are not visible in the photo.',
    glan: 'A polarizer in a rotation mount near the detector; not certain.'
  };

  function layout() {
    var n = 0, A = K.aomAngle_deg * Math.PI / 180, DPM = 1.0, comps = [];
    var HEAD = { E: 0, S: 90, W: 180, N: 270 };
    function mk(kind, x, z, rot, params) {
      var p = P.defaultParams(kind); if (params) for (var k in params) p[k] = params[k];
      var c = { id: kind + (++n), kind: kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rot: rot, params: p };
      if (PHOTO[kind]) c.photo = PHOTO[kind];
      comps.push(c); return c;
    }
    function M(x, z, din, dout) { return mk('mirror', x, z, P.rotMirror(din, dout)); }
    function B(x, z, din, dout, kind) { return mk(kind || 'pbs', x, z, P.rotPBS(din, dout)); }
    /* double-pass AOM: AOM, lambda/4, cat's-eye lens, retro mirror on the deflected first order, dumps for both zeroth orders */
    function dp(x, z, east, fMHz, eff, d0, d2) {
      var sg = east ? 1 : -1, d1 = [sg * Math.cos(A), east ? -Math.sin(A) : Math.sin(A)], r1 = Math.round(Math.atan2(d1[1], d1[0]) * 1800 / Math.PI) / 10;
      function at(L) { return [x + L * d1[0], z + L * d1[1]]; }
      var q = at(40 * DPM), l = at(80 * DPM), m = at(150 * DPM);
      mk('aom', x, z, east ? 0 : 180, { fMHz: fMHz, eff: eff, mode: 'single', order: 1 });
      mk('qwp', q[0], q[1], r1, { axis: 45 }); mk('lens', l[0], l[1], r1); mk('mirror', m[0], m[1], r1);
      mk('dump', x + sg * d0, z, east ? 180 : 0);
      mk('dump', x - sg * d2 * Math.cos(A), z + (east ? 1 : -1) * d2 * Math.sin(A), east ? 90 : 270);
    }
    var ZM = 330;                                                    // height of the master axis on both boards

    /* ---------- board 1: fibre laser, isolator, steering, SAS reference (the lock) ---------- */
    mk('laser', 150, 285, 0, { power: 10 }); mk('isolator', 205, 285, 0);
    M(260, 285, E, S); M(260, ZM, S, E);                           // two steering mirrors set the master axis
    mk('iris', 315, ZM, 0, { ap: 3 }); mk('hwp', 400, ZM, 0, { axis: 29 });
    B(500, ZM, E, S);                                               // pick-off: V reflected south into the SAS arm
    var ZS = 430, ZP = 520;                                         // SAS row (heading west) and pump return row
    M(500, ZS, S, W);
    B(460, ZS, W, S, 'npbs');                                       // pump / probe division
    mk('hwp', 425, ZS, 180, { axis: 45 }); mk('nd', 395, ZS, 180, { od: 0.3 }); mk('iris', 365, ZS, 180, { ap: 3 });
    B(325, ZS, W, N);                                               // extracts the pump after the cell
    mk('dump', 325, ZS - 40, 90);
    mk('refcell', 250, ZS, 180);
    B(175, ZS, N, E);                                               // injects the pump against the probe
    mk('dump', 175, ZS - 40, 90);
    mk('sas', 132, ZS, 180);
    M(460, ZP, S, W); M(175, ZP, W, N);                             // pump route

    /* ---------- board 2: probe/control split, two double-pass AOMs, recombiner, cell, detector ---------- */
    // The exaggerated 8 degree AOM tilt needs about 160 mm between a separator cube and its AOM, otherwise the returning zeroth order hits the cube.
    mk('hwp', 575, ZM, 0, { axis: 10 });                            // sets the probe/control split
    B(615, ZM, E, S);                                               // H -> control (east), V -> probe (south)
    // control arm (east, top row)
    B(665, ZM, W, S);                                               // double-pass separator
    dp(825, ZM, true, 80.000, 0.35, 110, 130);
    mk('dump', 665, ZM - 40, 90);
    mk('hwp', 665, 385, 90, { axis: 0 });                           // control polarization trim
    mk('lens', 665, 495, 90); mk('lens', 665, 535, 90);             // beam expander
    // probe arm (east, lower row)
    var ZPB = 440;
    B(615, ZPB, S, E);
    dp(775, ZPB, true, 79.965, 0.5, 110, 130);
    mk('dump', 615, ZPB + 40, 270);
    M(575, ZPB, W, S); M(575, 575, S, E);                           // probe return folded down and east
    mk('nd', 610, 575, 0, { od: 2 });
    // recombine, cell, analyser, detector
    B(665, 575, S, E);                                              // control (V) reflects, probe (H) transmits
    mk('iris', 710, 575, 0, { ap: 3 }); mk('qwp', 745, 575, 0, { axis: 45 });
    mk('cell', 805, 575, 0);
    mk('qwp', 865, 575, 0, { axis: -45 }); mk('glan', 905, 575, 0, { axis: 0 }); mk('lens', 940, 575, 0); mk('pd', 975, 575, 0);
    mk('dump', 665, 617, 270); mk('dump', 905, 617, 270);

    /* ---------- instrument shelf (as in the photo) ---------- */
    function inst(kind, x, tag, nm, photo, extra) {
      var c = { id: kind + '_t' + (++n), kind: kind, x: x, z: SHELF_Z, rot: 270, params: P.defaultParams(kind), tag: tag, nm: nm, photo: photo };
      if (extra) for (var k in extra) c[k] = extra[k];
      comps.push(c); return c;
    }
    var laser = comps.filter(function (c) { return c.kind === 'laser'; })[0];
    inst('scope', 70, 'DSO1', 'Rigol oscilloscope', 'Blue-grey Rigol digital oscilloscope with a colour screen at the left end of the boards. The model is not readable.');
    inst('lctrl', 190, 'LDC', 'Thorlabs laser diode current controller (LDC200C-series look)', 'Thorlabs benchtop unit whose display reads 146.88, taken to be the laser current in mA. The exact model is not readable.');
    inst('psu', 290, 'TED', 'Thorlabs TEC temperature controller (TED200C-series look)', 'Thorlabs benchtop unit beside it, display 9.021: probably the thermistor reading in kΩ. The exact model is not readable.', { cableTo: [{ to: laser.id, color: 0xd9a441, tray: 'top' }], nocable: true });
    inst('lockbox', 390, 'LOCK?', 'Laser-lock electronics (assumed)', 'Not visible in the photo. Added so the simulator can close the lock loop: a lock-in or scope-based lock fed from the SAS photodiode.');
    inst('fgen', 500, 'FG', 'Rigol function generator', 'Small Rigol generator with a colour screen and three BNC outputs (DG800 look): pulse, burst or dither source.');
    inst('rfgen', 640, 'RFG', 'Rigol dual-channel arbitrary generator (DG4000 look)', 'Larger Rigol generator showing two channels on one screen, two yellow and two blue BNC outputs: the two-channel source for the AOM drive. RF amplifiers are not visible and are assumed to be hidden.');
    inst('tctrl', 770, 'HEAT', 'TENMA DC supply labelled HEATER', 'TENMA linear supply labelled HEATER; the display reads 02.40 and 0.500 (volts and amps, my reading). Plain DC heating, no temperature loop visible.');
    inst('csrc', 880, 'COIL', 'TENMA DC supply labelled COILS', 'TENMA linear supply labelled COILS; the display reads 01.00 and 0.080 (about 80 mA through the solenoid, my reading).');
    inst('scope', 1020, 'DSO2', 'Rigol oscilloscope', 'Second Rigol oscilloscope at the right end of the boards.');
    return { mode: 'A', components: comps, state: { locked: true, tau_us: 20, storageRan: false } };
  }

  function zones() {
    return [
      { id: 'board1', name: 'BREADBOARD 1 · SAS and laser input', sub: 'Thorlabs MB4545/M, 450 × 450 mm', color: '#7d8a96', lab: [100, 706, 'tl'], rects: [[100, 250, 550, 700]] },
      { id: 'board2', name: 'BREADBOARD 2 · EIT, two AOMs and the cell', sub: 'Thorlabs MB4545/M, 450 × 450 mm', color: '#7d8a96', lab: [550, 706, 'tl'], rects: [[550, 250, 1000, 700]] },
      { id: 'shelf', name: 'INSTRUMENT SHELF', sub: 'Thorlabs controllers, Rigol generators, TENMA supplies, Rigol scopes', color: '#8fa3b5', lab: [40, 150, 'tl'], rects: [[40, 25, 1060, 130]] }
    ];
  }

  window.BENCH_CFG = {
    table: TABLE, layout: layout, zones: zones, storeKey: 'rb87-qs-bench-v1',
    trays: { top: 22, bottom: 150 },
    views: {
      source: { at: [330, 400, 20], off: [-90, 430, 340] },
      sas: { at: [300, 430, 20], off: [-40, 380, 300] },
      cell: { at: [800, 520, 30], off: [210, 300, 360] }
    },
    note: 'Quantum Spain-style bench, reconstructed from one photograph: two 450 × 450 mm breadboards (left: laser input and SAS lock, right: EIT with two AOMs and the cell) and an instrument shelf. Parts marked “assumed” are not visible in it. Back to the <a href="bench.html">reference bench</a> · <a href="#qsInfo">identified equipment and BOM</a>.'
  };
  window.QS_LAYOUT = layout;
})();
