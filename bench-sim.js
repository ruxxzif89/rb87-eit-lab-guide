/* ==========================================================================
   3D optical-bench simulator (three.js r128 + OrbitControls)
   ========================================================================== */
(function () {
  'use strict';
  var P = window.EITPhys, K = P.K;
  var CFG = window.BENCH_CFG || {};   // optional variant bench (see toni-layout.js): table, layout(), zones(), views, trays, storeKey, notes
  if (CFG.table) K.table = Object.assign({}, K.table, CFG.table);
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  function css(n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
  var reduceMotion = false;
  try { var mq = window.matchMedia('(prefers-reduced-motion: reduce)'); reduceMotion = mq.matches; mq.addEventListener('change', function (e) { reduceMotion = e.matches; }); } catch (e) { }

  var MODE = 'A';
  function refLayout() { return CFG.layout ? CFG.layout() : P.referenceLayout(); }
  function refZones() { return CFG.zones ? CFG.zones() : P.referenceZones(); }
  var STORE_KEY = CFG.storeKey || 'rb87-eit-bench-v1';
  var S = { layout: refLayout(), sel: null, labels: true, scope: 'sweep', ev: null, store: null, incident: {} };
  var idn = 1000;

  var INFO = {
    laser: 'PM-fibre-pigtailed distributed-feedback diode laser at the Rb D1 line (≈795 nm) with a micro-isolator inside the module (planned: Eagleyard EYP-DFB-0795-00015-1500-BFY12-0005, up to 15 mW). The collimator is not on the laser: it follows the fibre isolator. It emits a horizontally polarized single-frequency beam. A DFB has no piezo: its frequency is tuned by injection current (fast) and chip temperature (slow), both set by the laser controller, which the lock box steers. The ~1–2 MHz DFB linewidth (paper) is common to probe and control, so it largely cancels in the two-photon detuning.',
    isolator: 'Fibre-based dual-stage Faraday isolator with PM fibre and FC/APC connectors, followed by the FC/APC collimator (planned: a 780–1100 nm TGG dual-stage isolator such as DK Photonics, or Agiltron PM780; confirm 795 nm and PM-key alignment with the vendor). Catalogue figures: isolation at least 40 dB (typically 50–55 dB), insertion loss about 1–1.5 dB. Simulated: 80 % transmission, output linear at 45° (the PM slow axis fixes the polarization: clock the connector or use the first half-wave plate to get it), backward light blocked by 10⁻⁴ (40 dB). The arrow marks the forward direction.',
    mirror: 'Protected-silver mirror (simulated R = 98 %). Reflects by the law of reflection. Circular handedness flips on reflection. Rotate in 45° steps.',
    pbs: 'Polarizing beamsplitter cube. It transmits horizontal (p) light and reflects vertical (s) light through 90°, and mixed polarization splits by projection. Simulated extinction 10⁻³ in the transmitted port (paper: typical PBS ~10³). The drawn diagonal is the reflecting surface.',
    npbs: 'Non-polarizing 50:50 cube. Splits power equally whatever the polarization.',
    pickoff: 'Uncoated glass plate at an angle. Reflects ~4 % (Fresnel) and transmits the rest. The paper picks off SAS light this way; the project plan uses λ/2 + PBS instead.',
    hwp: 'Half-wave plate. Jones matrix [[cos2θ, sin2θ], [sin2θ, −cos2θ]]: it rotates linear polarization by twice the angle to the fast axis (the line drawn on its face). Before a PBS it sets the split ratio.',
    qwp: 'Quarter-wave plate. At 45° to a linear polarization it produces circular light, and back again. Two orthogonal linear inputs become opposite circular polarizations: the σ⁺/σ⁻ pair Zeeman EIT needs.',
    aom: 'Acousto-optic modulator with one RF-driver channel (planned: G&H, TeO₂, 80–110 MHz, 1.5 mm aperture). Single pass: the 0th order goes straight; the +1st order is deflected (angle exaggerated to 8° here) and shifted by +f_RF. Built from separate parts, a double pass is: PBS → AOM → λ/4 → cat’s-eye lens → retro mirror on the +1 order. The mirror sends the +1 order straight back; it diffracts a second time back onto the input axis, shifted by 2f_RF, with polarization rotated 90° (two passes of the λ/4) so the PBS routes it out. The undiffracted light of both passes goes to beam dumps. The inspector also offers a compact double-pass module as a shortcut. RF off: no output.',
    lens: 'Lens (cosmetic: the tracer keeps beams collimated). On a real bench: cat’s-eye lenses in the AOM double passes and a telescope to expand the control beam.',
    iris: 'Iris. Passes light within its aperture radius of the axis. Use it to select one AOM order.',
    nd: 'Neutral-density filter, transmission 10^−OD. Keeps the probe weak (Ω_p ≪ Ω_c).',
    cell: 'EIT vapour cell: quartz, Ø25 mm × 25 mm vapour path (about 28 mm long with two 1.6 mm windows), isotopically enriched ⁸⁷Rb with 10 Torr Ne buffer gas, uncoated windows: the geometry and fill of the cell in the published DeRose et al. Zeeman-EIT experiment (that cell is Pyrex; we ask the supplier for quartz). Custom-made by Precision Glassblowing, with accessories: foil heater under a TC300B (planned; foil rated to 70 °C), solenoid (B along the cell axis, i.e. the beam) and triple-layer µ-metal shield. Probe and control must co-propagate with opposite circular polarizations.',
    sas: 'Reference photodiode at the end of the SAS probe path. The probe, after crossing the Rb reference cell against the counter-propagating pump, shows sub-Doppler features on this photodiode; that signal is the “sensor” of the frequency lock. Its output goes by cable to the lock box, which turns it into an error signal. The photodiode alone cannot lock anything.',
    refcell: 'Rb reference cell for saturated-absorption spectroscopy: natural-abundance rubidium vapour with no buffer gas at room temperature, quartz Ø19 × 75 mm (planned: Precision Glassblowing stock cell AB-RB-Q-UV-19X75-AW). A strong pump and a weak probe cross it in opposite directions: atoms near zero velocity see both beams, the pump saturates the transition, and a narrow transparency appears inside the Doppler-broadened absorption. Pump and probe have orthogonal polarizations so PBSs can inject the pump and extract it afterwards.',
    rfgen: 'Dual-channel RF source. Both channels share one clock so the two AOM drive signals stay phase-related, which keeps the probe-control beat stable. Channel A drives the control AOM (80.000 MHz), channel B the probe AOM (79.965 MHz).',
    rfatt: 'Digital attenuator / RF switch in one RF chain. Sets the RF power (and thus the diffraction efficiency) and can gate the channel for pulses. Driven by the function generator for the storage sequence.',
    rfamp: 'RF power amplifier lifting the synthesiser level to the +30 dBm-class an AOM needs. Cabled from the attenuator and out to the AOM’s RF input. Needs a heat sink and a 50 Ω load at all times.',
    csrc: 'Low-noise current source for the solenoid. The field along the beams sets the Zeeman splitting (1.4 kHz per mG for the m_F=+2 ↔ 0 pair), so its noise appears directly as two-photon detuning noise.',
    tctrl: 'PID temperature controller for the cell heater, with a sensor on the cell. The Rb number density, and so the optical depth, rises steeply with temperature (OD ≈ 10 near 60 °C).',
    pwrmeter: 'Optical power meter with a silicon sensor head (795 nm). Used on a flip mount or by hand to measure the beam power after the isolator, at the pick-off, in each arm and in front of the cell, so the split ratios and the control intensity are known rather than assumed. It is also the calibration reference for the photodiode signal.',
    psu: 'Low-noise dual linear supply (±12 V) for the photodiodes and any bias electronics. Supply noise appears directly on the detected probe signal, so a linear supply (not a switching adapter) is used. Cabled to both photodiodes.',
    scope: 'Oscilloscope / acquisition system on the probe photodiode. Used to record the EIT transmission peak while the two-photon detuning is scanned, and the retrieved pulse in the storage sequence.',
    lctrl: 'Laser controller: a low-noise current source plus a TEC temperature controller for the DFB. Typical connections: the current output and TEC lines to the laser mount, plus a front-panel BNC modulation input that adds a small voltage-controlled current. The lock box drives that input for fast correction; slow drifts are handled by retuning the TEC setpoint, since a DFB has no piezo. Here it also supplies the small current dither used by the lock-in method.',
    lockbox: 'Lock box (servo): demodulates the SAS photodiode signal (lock-in at the dither frequency) to make a dispersive error signal that crosses zero at the chosen line, then applies PI/PID feedback to the laser controller’s modulation input. Typical connections: signal input from the SAS photodiode, reference from the dither oscillator, output to the controller’s BNC modulation input, plus monitor outputs for a scope. Settings: slope sign, gain, integrator. A modulation-free alternative (e.g. DAVLL) can be selected.',
    glan: 'Glan–Taylor calcite polariser. It transmits linear polarization along its axis and rejects the orthogonal one sideways. Extinction ~10⁵ (paper), the right tool to keep the strong control off the detector.',
    pd: 'Photodiode detector feeding the scope. Shows the probe and control power reaching it.',
    dump: 'Beam dump: safely absorbs stray beams.',
    fgen: 'Dual-channel function generator in burst mode (project plan). It gates both AOM RF channels to slice probe pulses and switch the control off and on. Required for the pulsed-storage sequence. Off-beam: place it anywhere.'
  };
  var INFO2 = {
    laser: ['Single source for the whole experiment: the control, the probe and the SAS reference are all cut from this one beam.', 'The reference bench uses 10 mW. The practical limit is the AOM efficiencies and the control intensity you want in the cell (about 1–6 mW/cm² in the paper).', 'Raise the power and watch the control intensity and EIT width in the cell readout. Remove the isolator and read the warning.'],
    isolator: ['Stops light coming back from the AOM double-passes and cell windows from re-entering the DFB, where it would cause mode hops and break the lock. It adds to the micro-isolator already inside the laser module.', 'First element after the laser: laser fibre → isolator → collimator, arrow pointing away from the laser.', 'Rotate it 180° and the forward beam is blocked.'],
    mirror: ['Folds the beam to fit the table. Each mirror adds two adjustment axes, which is why steering is done with a pair.', 'Eleven on the bench: two set the master axis, three fold the SAS arm, two fold the control arm, two fold the probe arm, and two are the retro mirrors of the double-passes.', 'Rotate in 45° steps: the beam turns 90° and everything downstream loses it. Rotating a retro mirror breaks that double pass: the AOM output disappears.'],
    pbs: ['Seven on the bench: the SAS pick-off, the control/probe splitter, the two SAS injection/extraction cubes, the two double-pass separators and the recombiner.', 'Horizontal light transmits, vertical turns 90°. Extinction 10³ is typical, so ~0.1 % leaks into the wrong port; the leak is caught by a dump.', 'Rotate a separator and see the AOM output stop leaving through the right port.'],
    npbs: ['Divides the SAS beam into a strong pump and a weak probe regardless of polarization.', 'One on the bench, at the start of the SAS arm.', 'Swap it for a PBS and the split now depends on polarization.'],
    pickoff: ['Samples a few percent of the beam (about 4 % per surface).', 'Not on the reference bench: it uses λ/2 + PBS, which is adjustable.', 'Place one after the laser and compare the SAS power with the λ/2 + PBS version.'],
    hwp: ['Four on the bench: the first (θ ≈ 29°) sends about 5 % of the light to the SAS; the second (θ ≈ 10°) sets the probe/control split, about 12 % to the probe; one in the SAS probe path (45°) turns V into H so it crosses the PBSs; one trims the control polarization before the combiner.', 'A rotation of θ turns the polarization by 2θ. Setting a split by plate angle is far finer than swapping optics.', 'Select the second one and drag its angle slider: the two arms trade brightness through the PBS.'],
    qwp: ['Four on the bench: one in each double-pass (so the returning beam is polarized 90° from the input) and one each side of the cell (linear → σ⁺/σ⁻ going in, back to linear going out).', 'The double-pass plates sit on the deflected 1st order, 45° to the input polarization.', 'Set one of the cell plates to 0° and the cell sees linear light: the EIT objective drops out. Rotate a double-pass plate and the return polarization stops matching the PBS.'],
    aom: ['Two on the bench, one per arm, each in a double pass: PBS → AOM → λ/4 → lens → retro mirror. The beam direction on the way out does not change with RF frequency, and the shift doubles.', 'Control AOM at 80.000 MHz, probe AOM at 79.965 MHz: a 35 kHz RF difference gives 70 kHz at the atoms, which matches 50 mG. The undiffracted 0th orders go to four dumps.', 'Change the probe AOM frequency by a few kHz and the scope shows the EIT peak moving. Turn the RF off and the arm goes dark.'],
    lens: ['Five on the bench: two cat’s-eye lenses (one per double-pass, between the AOM and the retro mirror), two forming the control-beam expander, and one collecting the probe onto the photodiode.', 'The cat’s-eye lens focuses the diffracted beam onto the mirror, so small angle changes (from changing the RF frequency) do not walk the returning beam.', 'No effect on the trace (the tracer keeps beams collimated), but each one belongs where it is on a real bench.'],
    iris: ['Five on the bench: two on the master axis, one in the SAS probe path, one before the cell and one after it. Use them to align: centre the beam on two irises and every optic between them is on axis.', 'Aperture 3 mm.', 'Close one below the beam diameter and the beam disappears.'],
    nd: ['Keeps the probe weak (Ω_p ≪ Ω_c) so the EIT window is not power-broadened. The SAS probe also gets one so the pump saturates.', 'OD 2 on the probe arm (1 % transmission) and OD 0.3 on the SAS probe.', 'Change the OD and watch the probe power at the detector.'],
    cell: ['The heart of the experiment: ⁸⁷Rb vapour in a quartz cell with a heater, a solenoid along the beams and a three-layer µ-metal shield.', 'Reference values: 60 °C (OD ≈ 10), buffer gas, solenoid on, |B| ≈ 50 mG. The cell absorbs unless the control is on and the two-photon detuning is within the EIT width.', 'Turn the shield off: residual field jumps to hundreds of mG and the resonance moves out of the scan. Reverse B and watch δ₀ flip sign.'],
    refcell: ['The SAS reference vapour: it produces the narrow sub-Doppler lines the laser is locked to.', 'Between the two SAS PBS cubes, with the pump entering from one side and the probe from the other.', 'Block the pump route (rotate its mirror) and the saturation feature would vanish on a real bench.'],
    sas: ['The sensor of the frequency lock: its signal has sub-Doppler lines narrow enough to hold the DFB near F=2→F′=1.', 'Fed by the SAS probe after the reference cell. Its output goes to the lock box.', 'Block the SAS light (rotate the pick-off PBS) and the error signal vanishes; the laser then drifts.'],
    lctrl: ['Low-noise current source and temperature controller for the DFB. Temperature sets the coarse wavelength, current the fine one. It also adds a small current dither for the lock-in method.', 'Its BNC modulation input is driven by the lock box.', 'Turn the dither off and see the error signal disappear (lock-in method).'],
    lockbox: ['The servo: it turns the SAS signal into a zero-crossing error signal and feeds the controller. Slope sign, gain and integrator are the three settings.', 'Locked, gain about 1, slope sign +.', 'Flip the sign: the loop pushes the laser away instead of back. Raise the gain too far: oscillation.'],
    glan: ['Rejects the control beam after the cell. The paper quotes ~10⁵ extinction, far better than a PBS (~10³).', 'Follows the second quarter-wave plate. Transmission axis set to pass the probe; the rejected beam goes to a dump.', 'Replace it by a PBS and the control leaks onto the detector at a hundred times higher level.'],
    pd: ['Measures the probe power after the cell. The EIT peak is a small rise in this signal as the two-photon detuning is scanned.', 'Preceded by a collection lens; cabled to the oscilloscope.', 'Block the probe arm and the signal drops to the control leakage.'],
    dump: ['Safely absorbs beams you do not want: unused diffraction orders, the rejected control, and the ~0.1 % PBS leakage.', 'Twelve on the bench: four for the AOM 0th orders, one for the Glan–Taylor, one for the SAS pump after the cell and six for PBS leakage.', 'Remove one and that beam runs on to the table edge (orange glow): a stray-light hazard.'],
    fgen: ['Dual-channel burst generator that gates both RF chains: it slices the probe pulse and switches the control off for storage and on for retrieval.', 'Off the beam path, cabled to the two RF attenuator/switches. Needed for the pulsed-storage scope mode.', 'Open the Pulsed storage scope and change τ to see the retrieved pulse shrink with the coherence time.'],
    rfgen: ['One clock for both AOM drives keeps the two RF phases related, so the probe-control beat is stable.', 'Feeds both attenuator/switches.', 'On a real bench check the two channels on the scope: a drifting phase shows up as noise in the two-photon resonance.'],
    rfatt: ['Sets the RF level for one AOM and acts as its on/off switch for pulses.', 'One in each RF chain, between the source and the amplifier.', 'Lower the RF level and the diffraction efficiency, and so the arm power, falls.'],
    rfamp: ['Lifts the RF to the power the AOM needs.', 'One in each RF chain, cabled to its AOM.', 'Never run it without the AOM or a 50 Ω load attached.'],
    csrc: ['Provides the solenoid current, so it sets B along the cell axis.', 'Cabled to the cell’s solenoid.', 'Change B on the cell and watch the two-photon resonance move at 1.4 kHz per mG.'],
    tctrl: ['Holds the cell at the set temperature with a heater and a sensor.', 'Cabled to the cell’s heater.', 'Change the cell temperature and watch OD in the readout.'],
    pwrmeter: ['Gives the absolute power at every stage so the control intensity (mW/cm²) and the probe level are measured, not guessed.', 'Sensor on a flip mount or hand-held; no cable to the bench.', 'Measure before and after the λ/2 + PBS and check the split matches the plate angle.'],
    psu: ['Powers the photodiodes with low noise so the EIT signal is not buried in supply ripple.', 'Cabled to the SAS photodiode and the probe photodiode.', 'On a real bench check the rails with the scope before connecting the detectors.'],
    scope: ['Records the probe photodiode while the two-photon detuning is scanned.', 'Cabled to the probe photodiode.', 'This is the real-bench counterpart of the scope panel below the 3D view.']
  };
  var GROUPS = [
    ['Source & lock', ['laser', 'isolator', 'sas', 'lockbox', 'lctrl']],
    ['Steering', ['mirror', 'pbs', 'npbs', 'pickoff']],
    ['Polarization', ['hwp', 'qwp', 'glan']],
    ['Modulation', ['aom']],
    ['Conditioning', ['lens', 'iris', 'nd']],
    ['Atoms', ['cell', 'refcell']],
    ['Detection', ['pd', 'dump']],
    ['Electronics', ['fgen', 'rfgen', 'rfatt', 'rfamp', 'csrc', 'tctrl', 'psu', 'scope', 'pwrmeter']]
  ];
  var OBJ_A = [
    ['Laser protected by an isolator', 'Put the fibre isolator directly after the laser, arrow pointing away from the laser, so the first thing the beam meets is the isolator going forward.'],
    ['SAS signal and closed lock loop', 'Pick off a few percent (λ/2 + PBS, or a glass pick-off) into the SAS module; place a lock box and a laser controller (cables connect SAS → lock box → controller → DFB automatically); press “Lock laser” with a positive slope sign and moderate gain.'],
    ['Beam split into control & probe at a PBS', 'After the pick-off, a λ/2 then a PBS splits the beam. Both outputs must eventually reach the cell.'],
    ['Each arm passes its own AOM with RF on', 'Build a double pass in each arm: PBS → AOM → λ/4 (45°) → lens → retro mirror on the deflected +1 order, with a dump for the 0th order. The returning beam, rotated by 90°, leaves through the PBS. (Or set the AOM to the compact double-pass module.)'],
    ['Beams recombined and overlapped in the cell', 'Use a PBS to merge the arms onto one line through the cell (co-propagating, same axis).'],
    ['Orthogonal circular polarizations in the cell', 'A λ/4 at 45° between combiner and cell turns the H probe and V control into opposite circular polarizations.'],
    ['Cell heated (≥40 °C), shielded, solenoid on', 'Select the cell: heater on (e.g. 60 °C), µ-metal shield on, solenoid on with |B| ≥ 5 mG.'],
    ['Control blocked; probe reaches detector', 'After the cell: λ/4 at −45° (back to linear), then a Glan–Taylor passing the probe to the photodiode. Dump the rejected control.'],
    ['EIT peak observed', 'Everything above, plus two-photon resonance: 2(f_C − f_P) ≈ 1.40 kHz/mG × B. For B = 50 mG, set AOM-P 35 kHz below AOM-C.'],
    ['Light stored and retrieved', 'Place the function generator, open “Pulsed storage” in the scope, choose τ and run the sequence. Efficiency must exceed 1 %.']
  ];
  var OBJ = OBJ_A;

  /* ---------------- persistence ---------------- */
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S.layout)); } catch (e) { } }
  function loadSaved() { try { var s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  var saveT; function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }

  /* ---------------- layout helpers ---------------- */
  function comp(id) { for (var i = 0; i < S.layout.components.length; i++) if (S.layout.components[i].id === id) return S.layout.components[i]; return null; }
  function occupied(x, z, exceptId) { return S.layout.components.some(function (c) { return c.id !== exceptId && Math.abs(c.x - x) < 1 && Math.abs(c.z - z) < 1; }); }
  function snap(v, max) { var p = K.table.pitch; return Math.min(max - p, Math.max(p, Math.round(v / p) * p)); }
  function freeSpotNear(x, z) {
    x = snap(x, K.table.w); z = snap(z, K.table.d);
    for (var r = 0; r < 20; r++) for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      var xx = x + dx * 25, zz = z + dz * 25;
      if (xx < 25 || xx > K.table.w - 25 || zz < 25 || zz > K.table.d - 25) continue;
      if (!occupied(xx, zz)) return [xx, zz];
    }
    return null;
  }
  function addComp(kind, x, z) {
    var spot = freeSpotNear(x, z); if (!spot) return null;
    var c = { id: kind + '-' + Date.now().toString(36) + '-' + (++idn), kind: kind, x: spot[0], z: spot[1], rot: 0, params: P.defaultParams(kind) };
    S.layout.components.push(c); S.sel = c.id; changed(true); return c;
  }
  function delComp(id) { S.layout.components = S.layout.components.filter(function (c) { return c.id !== id; }); if (S.sel === id) S.sel = null; changed(true); }
  function rotate(id, dir) { var c = comp(id); if (!c) return; var st = c.kind === 'pbs' || c.kind === 'mirror' || c.kind === 'pickoff' || c.kind === 'npbs' ? 45 : 90; c.rot = (((c.rot + dir * st) % 360) + 360) % 360; changed(true); }

  /* ---------------- evaluation ---------------- */
  function recompute() {
    S.ev = P.evaluate(S.layout);
    if (S.layout.state.locked && !S.ev.lock.errAvail) { S.layout.state.locked = false; S.ev = P.evaluate(S.layout); }
    S.incident = {};
    S.ev.trace.segments.forEach(function (s) {
      if (s.toEdge) return;
      S.layout.components.forEach(function (c) {
        if (Math.abs(s.b[0] - c.x) < 0.6 * 25 && Math.abs(s.b[1] - c.z) < 0.6 * 25 && Math.hypot(s.b[0] - c.x, s.b[1] - c.z) < 14) {
          var o = S.incident[c.id] || (S.incident[c.id] = { P: 0, maxP: 0, J: null, f: 0 });
          o.P += s.P; if (s.P > o.maxP) { o.maxP = s.P; o.J = s.J; o.f = s.f; }
        }
      });
    });
  }
  var pendingBeams = false;
  function changed(structural, keepInspector) {
    recompute();
    updateUI();
    if (G.ok) { if (structural) syncMeshes(); pendingBeams = true; requestRender(); }
    if (structural && !keepInspector) renderInspector(); else updateInspectorLive();
    saveSoon();
  }

  /* ---------------- palette ---------------- */
  var ghost = null;
  function buildPalette() {
    var pal = $('palette'); pal.innerHTML = '';
    GROUPS.forEach(function (g) {
      var h = document.createElement('h4'); h.textContent = g[0]; pal.appendChild(h);
      g[1].forEach(function (k) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pal-item'; b.id = 'pal-' + k;
        b.innerHTML = '<span class="ic">' + P.KINDS[k].short + '</span><span>' + P.KINDS[k].name + '</span>';
        b.setAttribute('aria-label', 'Add ' + P.KINDS[k].name);
        palDrag(b, k);
        pal.appendChild(b);
      });
    });
  }
  function palDrag(btn, kind) {
    var st = null;
    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      st = { x: e.clientX, y: e.clientY, drag: false, id: e.pointerId };
      try { btn.setPointerCapture(e.pointerId); } catch (er) { }
    });
    btn.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      if (!st.drag && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) st.drag = true;
      if (st.drag && G.ok) { var t = tableAt(e.clientX, e.clientY); showGhost(t); }
    });
    function end(e, cancel) {
      if (!st) return; var s0 = st; st = null; showGhost(null);
      if (cancel) return;
      if (s0.drag) { if (G.ok) { var t = tableAt(e.clientX, e.clientY); if (t) addComp(kind, t[0], t[1]); } }
      else addComp(kind, K.table.w / 2, K.table.d / 2);
      btn._handled = true;
    }
    btn.addEventListener('pointerup', function (e) { end(e, false); });
    btn.addEventListener('pointercancel', function (e) { end(e, true); });
    btn.addEventListener('click', function (e) { if (btn._handled) { btn._handled = false; return; } addComp(kind, K.table.w / 2, K.table.d / 2); });
  }

  /* ---------------- inspector ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rng(id, label, min, max, step, val, unit) {
    return '<label for="' + id + '"><span class="lt" style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:.74rem">' + label + ' <output id="' + id + 'o" for="' + id + '">' + val + (unit || '') + '</output></span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';
  }
  function chk(id, label, on) { return '<label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
  function renderInspector() {
    var box = $('inspector'), c = comp(S.sel);
    if (!c) {
      box.innerHTML = '<h4>Bench</h4><p class="what">Select a component to see what it does and adjust it. Drag parts from the palette, or click one to drop it near the centre.</p>' +
        '<div class="kv"><span>components</span><span>' + S.layout.components.length + '</span><span>rays traced</span><span>' + (S.ev ? S.ev.trace.rays : 0) + '</span><span>grid</span><span>25 mm, ' + K.table.w + '×' + K.table.d + ' mm</span></div>' +
        '<p class="what" style="margin-top:10px">Keys (table focused): <kbd>R</kbd> rotate, <kbd>Shift</kbd>+<kbd>R</kbd> back, <kbd>Del</kbd> delete, arrows move, <kbd>Esc</kbd> deselect.</p>';
      return;
    }
    var k = c.kind, p = c.params, h = '';
    h += '<h4>' + esc(c.nm || P.KINDS[k].name) + '</h4>' + (c.photo ? '<p class="what"><b>In the photo:</b> ' + esc(c.photo) + '</p>' : '') + '<p class="what">' + esc(INFO[k]) + '</p>';
    if (INFO2[k]) h += '<div class="rich"><b>Role in the Zeeman EIT bench</b><p>' + esc(INFO2[k][0]) + '</p><b>On the reference bench</b><p>' + esc(INFO2[k][1]) + '</p><b>Try this</b><p>' + esc(INFO2[k][2]) + '</p></div>';
    h += '<div class="row"><button type="button" class="btn" id="inRotL" aria-label="Rotate counter-clockwise">⟲ Rotate</button><button type="button" class="btn" id="inRotR" aria-label="Rotate clockwise">Rotate ⟳</button><button type="button" class="btn danger" id="inDel">Delete</button></div>';
    if (k === 'laser') h += rng('inPow', 'Power', 1, 40, 0.5, p.power, ' mW');
    if (k === 'hwp' || k === 'qwp' || k === 'glan') h += rng('inAxis', (k === 'glan' ? 'Transmission axis' : 'Fast-axis angle') + ' θ', -90, 90, 0.5, p.axis, '°');
    if (k === 'aom') {
      h += chk('inRF', 'RF on', p.rf);
      h += '<label for="inF">RF frequency (MHz, 80–110)<input type="number" id="inF" min="80" max="110" step="0.001" value="' + p.fMHz.toFixed(3) + '"></label>';
      h += rng('inEff', 'Diffraction efficiency', 0, 0.9, 0.01, p.eff, '');
      h += '<label for="inMode">Configuration<select id="inMode"><option value="double"' + (p.mode === 'double' ? ' selected' : '') + '>Double pass (compact module, shortcut)</option><option value="single"' + (p.mode === 'single' ? ' selected' : '') + '>Single pass (with separate λ/4, lens, mirror)</option></select></label>';
      h += '<label for="inOrd">Order<select id="inOrd"><option value="1"' + (p.order === 1 ? ' selected' : '') + '>+1</option><option value="-1"' + (p.order === -1 ? ' selected' : '') + '>−1</option></select></label>';
    }
    if (k === 'iris') h += rng('inAp', 'Aperture diameter', 0.5, 10, 0.5, p.ap, ' mm');
    if (k === 'nd') h += '<label for="inOD">Optical density<select id="inOD">' + [0.3, 0.5, 1, 2, 3, 4].map(function (v) { return '<option value="' + v + '"' + (v === p.od ? ' selected' : '') + '>OD ' + v + ' (T = ' + Math.pow(10, -v).toPrecision(2) + ')</option>'; }).join('') + '</select></label>';
    if (k === 'cell') {
      h += chk('inHeat', 'Heater on', p.heater) + rng('inT', 'Cell temperature', 20, 70, 1, p.T_C, ' °C');
      h += chk('inSol', 'Solenoid on', p.solenoid) + rng('inB', 'Field B (along cell axis)', -200, 200, 1, p.B_mG, ' mG');
      h += chk('inSh', 'µ-metal shield (3 layers, degaussed)', p.shield) + chk('inBuf', 'Buffer gas (~10 Torr Ne, paper)', p.buffer);
    }
    if (k === 'sas' || k === 'lockbox') h += '<div class="row"><button type="button" class="btn primary" id="inLock"></button><button type="button" class="btn" id="inErr">Show error signal</button></div>';
    if (k === 'lockbox') {
      h += '<label for="inMeth">Error-signal method<select id="inMeth"><option value="lockin"' + (p.method === 'lockin' ? ' selected' : '') + '>Current dither + lock-in (derivative)</option><option value="davll"' + (p.method === 'davll' ? ' selected' : '') + '>Modulation-free (DAVLL-type)</option></select></label>';
      h += '<label for="inSign">Error-signal slope sign<select id="inSign"><option value="1"' + (p.sign > 0 ? ' selected' : '') + '>+ (correct for this line)</option><option value="-1"' + (p.sign < 0 ? ' selected' : '') + '>− (inverted)</option></select></label>';
      h += rng('inGain', 'Loop gain (relative)', 0, 2.5, 0.05, p.gain, '');
    }
    if (k === 'lctrl') { h += chk('inDith', 'Current dither on (tens of kHz, for lock-in)', p.dither) + rng('inDithA', 'Dither depth (optical, illustrative)', 0.1, 3, 0.1, p.ditherMHz, ' MHz'); }
    if (k === 'fgen') h += chk('inFg', 'Burst output enabled (gates both AOMs)', p.on);
    h += '<div id="inspLive"></div>';
    box.innerHTML = h;
    bindInspector(c);
    updateInspectorLive();
  }
  function bindInspector(c) {
    var p = c.params;
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    on('inRotL', 'click', function () { rotate(c.id, -1); });
    on('inRotR', 'click', function () { rotate(c.id, 1); });
    on('inDel', 'click', function () { delComp(c.id); });
    function slider(id, key, unit, conv) { on(id, 'input', function (e) { p[key] = conv ? conv(e.target.value) : +e.target.value; var o = $(id + 'o'); if (o) o.textContent = p[key] + (unit || ''); changed(key === 'axis', true); }); }
    slider('inPow', 'power', ' mW'); slider('inAxis', 'axis', '°'); slider('inEff', 'eff', ''); slider('inAp', 'ap', ' mm');
    slider('inT', 'T_C', ' °C'); slider('inB', 'B_mG', ' mG');
    on('inF', 'change', function (e) { var v = Math.min(110, Math.max(80, +e.target.value || 80)); p.fMHz = Math.round(v * 1000) / 1000; e.target.value = p.fMHz.toFixed(3); changed(true, true); });
    on('inRF', 'change', function (e) { p.rf = e.target.checked; changed(true); });
    on('inMode', 'change', function (e) { p.mode = e.target.value; changed(true); });
    on('inOrd', 'change', function (e) { p.order = +e.target.value; changed(false); });
    on('inOD', 'change', function (e) { p.od = +e.target.value; changed(false); });
    on('inHeat', 'change', function (e) { p.heater = e.target.checked; changed(true); });
    on('inSol', 'change', function (e) { p.solenoid = e.target.checked; changed(true); });
    on('inSh', 'change', function (e) { p.shield = e.target.checked; changed(true); });
    on('inBuf', 'change', function (e) { p.buffer = e.target.checked; changed(false); });
    on('inFg', 'change', function (e) { p.on = e.target.checked; changed(true); });
    on('inLock', 'click', function () { if (S.layout.state.locked) S.layout.state.locked = false; else if (S.ev.lock.errAvail) S.layout.state.locked = true; changed(true, true); renderInspector(); });
    on('inErr', 'click', function () { setScope('err'); });
    on('inMeth', 'change', function (e) { p.method = e.target.value; changed(false); });
    on('inSign', 'change', function (e) { p.sign = +e.target.value; changed(false); });
    on('inGain', 'input', function (e) { p.gain = +e.target.value; var o = $('inGaino'); if (o) o.textContent = p.gain; changed(false); });
    on('inDith', 'change', function (e) { p.dither = e.target.checked; changed(false); });
    on('inDithA', 'input', function (e) { p.ditherMHz = +e.target.value; var o = $('inDithAo'); if (o) o.textContent = p.ditherMHz + ' MHz'; changed(false); });
  }
  function kv(rows) { return '<div class="kv">' + rows.map(function (r) { return '<span>' + r[0] + '</span><span>' + r[1] + '</span>'; }).join('') + '</div>'; }
  function fmtF(kHz) { if (Math.abs(kHz) >= 1000) return (kHz / 1000).toFixed(3) + ' MHz'; return kHz.toFixed(1) + ' kHz'; }
  function updateInspectorLive() {
    var live = $('inspLive'), c = comp(S.sel); if (!live || !c || !S.ev) return;
    var inc = S.incident[c.id], rows = [['position', c.x + ', ' + c.z + ' mm'], ['rotation', c.rot + '°']];
    if (inc) { rows.push(['light in', P.fmtP(inc.P)]); if (inc.J) rows.push(['polarization', P.polLabel(inc.J)]); rows.push(['freq. offset', fmtF(inc.f)]); }
    else if (c.kind !== 'laser' && c.kind !== 'fgen') rows.push(['light in', 'none']);
    var ev = S.ev, cl = ev.cell;
    if (c.kind === 'aom') rows.push(['shift', (c.params.mode === 'double' ? '2 × ' : '') + (c.params.order > 0 ? '+' : '−') + c.params.fMHz.toFixed(3) + ' MHz']);
    if (c.kind === 'sas') {
      rows.push(['SAS power', P.fmtP(ev.sasP)]);
    }
    if (c.kind === 'sas' || c.kind === 'lockbox' || c.kind === 'lctrl' || c.kind === 'laser') {
      var lk = ev.lock;
      rows.push(['lock chain', lk.chain ? 'SAS → lock box → controller → DFB connected' : 'incomplete'], ['error signal', lk.errAvail ? 'available' : 'not available'], ['loop', lk.note], ['laser Δ (one-photon)', (S.layout.state.drift_MHz || 0).toFixed(2) + ' MHz']);
      if (lk.dither_MHz) rows.push(['dither on light', '±' + lk.dither_MHz + ' MHz FM (also on the EIT beams)']);
      var lb = $('inLock'); if (lb) { lb.textContent = S.layout.state.locked ? 'Unlock laser (open loop)' : 'Lock laser (close loop)'; lb.disabled = !S.layout.state.locked && !lk.errAvail; }
    }
    if (c.kind === 'cell' && cl.model) {
      var m = cl.model;
      rows.push(['T (cell)', m.Tc.toFixed(0) + ' °C'], ['n (est.)', m.n.toExponential(1) + ' cm⁻³'], ['OD (est.)', m.OD.toFixed(2)]);
      if (cl.control) rows.push(['control', P.fmtP(cl.control.P) + ', ' + (cl.hc > 0.9 ? 'σ⁺' : cl.hc < -0.9 ? 'σ⁻' : 'not circular')]);
      if (cl.probe) rows.push(['probe', P.fmtP(cl.probe.P) + ', ' + (cl.hp > 0.9 ? 'σ⁺' : cl.hp < -0.9 ? 'σ⁻' : 'not circular')]);
      rows.push(['I_c', cl.Ic.toFixed(2) + ' mW/cm²'], ['EIT FWHM', m.fwhm.toFixed(1) + ' kHz'], ['contrast', cl.ok ? cl.eff.contrast.toFixed(2) : '— (conditions unmet)']);
      if (cl.delta0 !== undefined) rows.push(['δ₀ (two-photon)', cl.delta0.toFixed(1) + ' kHz'], ['Λ split 1.4·B', (1.4 * m.Beff).toFixed(1) + ' kHz']);
      rows.push(['probe T at δ₀', cl.probeT0 != null ? cl.probeT0.toExponential(2) : '—']);
      if (!c.params.shield) rows.push(['note', 'unshielded: ~' + K.earthResidual_mG + ' mG residual assumed']);
    }
    if (c.kind === 'pd') { var d = ev.det; rows.push(['probe', P.fmtP(d.probe)], ['control leak', P.fmtP(d.control)], ['other', P.fmtP(d.other)], ['total', P.fmtP(d.total)]); }
    live.innerHTML = kv(rows);
  }

  /* ---------------- objectives, status, HUD ---------------- */
  function updateUI() {
    var ev = S.ev, ol = $('objList'); if (!ev) return;
    var html = '', n = 0;
    OBJ.forEach(function (o, i) { var d = ev.objectives[i]; if (d) n++; html += '<li class="' + (d ? 'done' : '') + '"><span class="bx" aria-hidden="true"></span><span>' + o[0] + '<span class="sr">' + (d ? ' (done)' : ' (not yet)') + '</span></span></li>'; });
    ol.innerHTML = html; $('objScore').textContent = n + ' / 10';
    var wl = $('warnList'); wl.innerHTML = ev.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
    var sl = $('stLock'), lst = ev.lock.status;
    sl.className = 'pill ' + (lst === 'locked' ? 'on' : (lst === 'open' && ev.lock.errAvail) ? 'mid' : 'off');
    sl.textContent = lst === 'locked' ? 'Laser: closed loop (locked)' : lst === 'oscillating' ? 'Laser: loop oscillating' : lst === 'runaway' ? 'Laser: loop ran away' : lst === 'weak' ? 'Laser: loop too weak' : ev.lock.errAvail ? 'Laser: open loop (error signal ready)' : 'Laser: open loop, drifting';
    var se = $('stEIT');
    se.className = 'pill ' + (ev.objectives[8] ? 'on' : ev.cell.probe ? 'mid' : 'off');
    se.textContent = ev.objectives[8] ? 'EIT: window open' : ev.cell.probe ? 'EIT: not yet' : 'EIT: no probe in cell';
    var hud = [];
    if (ev.cell.model) hud.push('OD ' + ev.cell.model.OD.toFixed(1));
    if (ev.cell.delta0 !== undefined) hud.push('δ₀ ' + ev.cell.delta0.toFixed(1) + ' kHz');
    hud.push('PD probe ' + P.fmtP(ev.det.probe));
    $('stageHud').innerHTML = hud.map(function (t) { return '<span class="h">' + t + '</span>'; }).join('') + ev.warnings.slice(0, 2).map(function (w) { return '<span class="h w">' + esc(w) + '</span>'; }).join('');
    drawScope();
  }
  function showMsg(t) { var hb = $('hintBox'); hb.hidden = false; hb.textContent = t; }
  function showHint() {
    var hb = $('hintBox'), i = S.ev.objectives.indexOf(false);
    hb.hidden = false;
    hb.innerHTML = i < 0 ? '<b>All ten objectives complete.</b> Try breaking the bench: swap the Glan–Taylor for a PBS, reverse B, or turn the shield off, and watch the scope.' : '<b>Next: ' + OBJ[i][0] + '.</b> ' + OBJ[i][1];
  }

  /* ---------------- scope ---------------- */
  var scopePhase = 0;
  function drawScope() {
    var cv = $('scopeCanvas'); if (!cv || !S.ev) return;
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(240, r.width), h = Math.max(160, r.height);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var GR = '#1d3a2b', TX = '#8fd4ad', CH1 = '#ffd54a', CH2 = '#5ec8ff', CH3 = '#ff6b7d';
    c.fillStyle = '#06100c'; c.fillRect(0, 0, w, h);
    var L = 46, R = 10, T = 10, B = 30, pw = w - L - R, ph = h - T - B;
    c.strokeStyle = GR; c.lineWidth = 1;
    for (var i = 0; i <= 10; i++) { var x = L + pw * i / 10; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); }
    for (i = 0; i <= 8; i++) { var y = T + ph * i / 8; c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); }
    c.font = '11px ' + (css('--font-mono') || 'monospace'); c.fillStyle = TX;
    var ev = S.ev, cl = ev.cell, read = $('scopeRead');
    function msg(t) { c.fillStyle = TX; c.textAlign = 'center'; c.fillText(t, L + pw / 2, T + ph / 2); c.textAlign = 'left'; }
    if (S.scope === 'err') { drawErr(c, L, T, pw, ph, w, h, TX, CH1, CH3, msg, read); return; }
    if (S.scope === 'sweep') {
      if (!cl.probe || ev.det.total <= 0) { msg('No probe on the detector'); read.innerHTML = 'Build a path so the weak beam reaches the photodiode through the cell.'; return; }
      var k, half = ev.sweepHalf, m = cl.eff, pin = cl.probe.P, T0 = cl.probeT0 || 1e-12;
      var kf = ev.det.probe / (pin * T0 || 1e-12); if (!isFinite(kf)) kf = 0;
      var leak = ev.det.control + ev.det.other, pts = [], ymax = 1e-9;
      for (k = 0; k <= 300; k++) { var s = -half + 2 * half * k / 300, v = (kf * pin * P.probeT(cl.delta0 + s, m) + leak) * 1000; pts.push([s, v]); ymax = Math.max(ymax, v); }
      ymax *= 1.15;
      c.strokeStyle = CH1; c.lineWidth = 1.8; c.beginPath();
      pts.forEach(function (q, j) { var X = L + (q[0] + half) / (2 * half) * pw, Y = T + ph - q[1] / ymax * ph; if (j) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke();
      var cur = reduceMotion ? 0.5 : (scopePhase % 1);
      c.strokeStyle = 'rgba(144,212,173,.45)'; c.beginPath(); c.moveTo(L + cur * pw, T); c.lineTo(L + cur * pw, T + ph); c.stroke();
      var xr = L + (-cl.delta0 + half) / (2 * half) * pw;
      if (xr >= L && xr <= L + pw) { c.setLineDash([3, 3]); c.strokeStyle = CH3; c.beginPath(); c.moveTo(xr, T); c.lineTo(xr, T + ph); c.stroke(); c.setLineDash([]); }
      c.fillStyle = TX; c.textAlign = 'center';
      [-1, -0.5, 0, 0.5, 1].forEach(function (f) { c.fillText((f * half).toFixed(0), L + (f + 1) / 2 * pw, T + ph + 14); });
      c.fillText('probe scan offset (kHz, optical)', L + pw / 2, h - 3);
      c.textAlign = 'right'; c.fillText(ymax.toPrecision(2), L - 4, T + 10); c.fillText('0', L - 4, T + ph); c.textAlign = 'left';
      c.save(); c.translate(11, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('PD (µW)', 0, 0); c.restore();
      read.innerHTML = (ev.lock.status !== 'locked' ? '<b style="color:var(--bad)">' + esc(ev.lock.note) + ' · laser Δ = ' + (S.layout.state.drift_MHz || 0).toFixed(1) + ' MHz: the spectrum changes as the laser drifts.</b><br>' : '') + (ev.objectives[8] ? '<b style="color:var(--ok)">EIT peak visible.</b> ' : '') + 'FWHM ≈ ' + m.fwhm.toFixed(1) + ' kHz · contrast ' + (cl.ok ? m.contrast.toFixed(2) : '0') + ' · OD ' + m.OD.toFixed(1) +
        ' · resonance at scan = ' + (-cl.delta0).toFixed(1) + ' kHz (red dashed) · control leak ' + P.fmtP(ev.det.control) + (cl.ok ? '' : '<br>EIT conditions unmet: ' + [cl.overlap ? null : 'beams not overlapped', cl.orth ? null : 'polarizations not opposite circular'].filter(Boolean).join(', '));
      return;
    }
    // storage mode
    var ready = ev.objectives[8] && ev.fgen;
    if (!ready) { msg(!ev.fgen ? 'Add the function generator to pulse the AOMs' : 'Get an EIT peak first (objective 9)'); read.innerHTML = 'Storage needs objectives 1–9 and a function generator on the bench.'; return; }
    var st = S.store || P.storageModel(cl.eff, S.layout.state.tau_us);
    var tau = S.layout.state.tau_us, Tp = st.Tp_us, toff = 0.6 * Tp, ton = toff + tau, tret = ton + 0.5 * Math.min(st.delay_us, Tp);
    var tmin = -1.8 * Tp, tmax = Math.max(tret + 2.2 * Tp, toff + 2 * Tp);
    function X(t) { return L + (t - tmin) / (tmax - tmin) * pw; }
    function Y(v) { return T + ph - v / 1.15 * ph; }
    function g(t, c0, A) { var s = Tp / 2.355; return A * Math.exp(-0.5 * (t - c0) * (t - c0) / (s * s)); }
    c.fillStyle = 'rgba(255,107,125,.10)'; c.fillRect(X(toff), T, X(ton) - X(toff), ph);
    c.strokeStyle = CH3; c.lineWidth = 1.4; c.beginPath(); c.moveTo(X(tmin), Y(1.08)); c.lineTo(X(toff), Y(1.08)); c.lineTo(X(toff), Y(0.98)); c.lineTo(X(ton), Y(0.98)); c.lineTo(X(ton), Y(1.08)); c.lineTo(X(tmax), Y(1.08)); c.stroke();
    c.setLineDash([4, 4]); c.strokeStyle = CH2; c.beginPath();
    for (k = 0; k <= 300; k++) { var t = tmin + (tmax - tmin) * k / 300, v2 = g(t, 0, 1); if (k) c.lineTo(X(t), Y(v2)); else c.moveTo(X(t), Y(v2)); } c.stroke(); c.setLineDash([]);
    c.strokeStyle = CH1; c.lineWidth = 2; c.beginPath();
    for (k = 0; k <= 400; k++) {
      t = tmin + (tmax - tmin) * k / 400;
      var v3 = (t < toff ? g(t, toff - 0.4 * Tp, st.leak) : 0) + (S.store ? g(t, tret, st.eta) : 0);
      if (k) c.lineTo(X(t), Y(v3)); else c.moveTo(X(t), Y(v3));
    }
    c.stroke();
    c.fillStyle = TX; c.textAlign = 'center';
    niceT(tmin, tmax).forEach(function (tt) { c.fillText(tt.toFixed(0), X(tt), T + ph + 14); });
    c.fillText('time (µs) · red: control on/off · blue dashed: input pulse · yellow: detector', L + pw / 2, h - 3);
    c.textAlign = 'left';
    read.innerHTML = S.store ? ('Retrieved efficiency η = <b>' + (st.eta * 100).toFixed(1) + ' %</b> at τ = ' + tau + ' µs (η₀ ' + (st.eta0 * 100).toFixed(0) + ' %, T₂ ' + st.T2_us.toFixed(0) + ' µs, delay ' + st.delay_us.toFixed(0) + ' µs, pulse ' + Tp.toFixed(0) + ' µs FWHM). <span class="tag est">illustrative model</span>') : 'Set τ and press “Run storage sequence”.';
  }
  function drawErr(c, L, T, pw, ph, w, h, TX, CH1, CH3, msg, read) {
    var lk = S.ev.lock, box = comp(lk.ids.box);
    if (!lk.chain) { msg('Lock chain incomplete'); read.innerHTML = 'Place a SAS module, a lock box and a laser controller: cables connect SAS photodiode → lock box → controller → DFB.'; return; }
    if (!lk.light) { msg('No light on the SAS photodiode'); read.innerHTML = 'Pick off a few percent of the laser into the SAS module.'; return; }
    if (!lk.modOK) { msg('No error signal: switch on the current dither'); read.innerHTML = 'The lock-in method needs a small current dither from the laser controller, or choose a modulation-free method.'; return; }
    var wid = K.sasWidth_MHz * (box.params.method === 'davll' ? 3 : 1), sg = box.params.sign, R = 4 * wid, d0 = S.layout.state.drift_MHz || 0;
    function e(x) { var u = 2 * x / wid; return -sg * u / ((1 + u * u) * (1 + u * u)); }
    var ymax = 0.75;
    function X(x) { return L + (x + R) / (2 * R) * pw; } function Y(v) { return T + ph / 2 - v / ymax * ph / 2; }
    c.strokeStyle = 'rgba(144,212,173,.5)'; c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(L + pw, Y(0)); c.stroke();
    c.strokeStyle = CH1; c.lineWidth = 2; c.beginPath();
    for (var i = 0; i <= 300; i++) { var x = -R + 2 * R * i / 300; if (i) c.lineTo(X(x), Y(e(x))); else c.moveTo(X(x), Y(e(x))); } c.stroke();
    c.setLineDash([3, 3]); c.strokeStyle = CH3; c.beginPath(); c.moveTo(X(0), T); c.lineTo(X(0), T + ph); c.stroke(); c.setLineDash([]);
    var xd = Math.max(-R, Math.min(R, d0)); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(X(xd), Y(e(xd)), 4.5, 0, 7); c.fill();
    c.fillStyle = TX; c.textAlign = 'center';
    [-1, -0.5, 0, 0.5, 1].forEach(function (f) { c.fillText((f * R).toFixed(0), L + (f + 1) / 2 * pw, T + ph + 14); });
    c.fillText('laser detuning from the SAS lock feature (MHz)', L + pw / 2, h - 3); c.textAlign = 'left';
    c.save(); c.translate(11, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('error signal (a.u.)', 0, 0); c.restore();
    read.innerHTML = '<b>' + esc(lk.note) + '</b> · white dot: current laser detuning ' + d0.toFixed(2) + ' MHz · lock point = zero crossing (red dashed). Slope sign ' + (sg > 0 ? '+' : '−') + ', gain ' + box.params.gain + ', method ' + (box.params.method === 'davll' ? 'modulation-free (DAVLL-type)' : 'current dither + lock-in') + '. Feature width ' + wid + ' MHz is <span class="tag est">illustrative</span>.';
  }
  function setScope(mode) {
    S.scope = mode;
    $('scSweep').setAttribute('aria-pressed', mode === 'sweep' ? 'true' : 'false'); $('scStore').setAttribute('aria-pressed', mode === 'store' ? 'true' : 'false'); $('scErr').setAttribute('aria-pressed', mode === 'err' ? 'true' : 'false');
    $('storeCtrls').hidden = !(mode === 'store'); drawScope();
  }
  function niceT(a, b) { var span = b - a, st = Math.pow(10, Math.floor(Math.log10(span / 6))); if (span / st > 30) st *= 5; else if (span / st > 12) st *= 2; var o = []; for (var v = Math.ceil(a / st) * st; v <= b; v += st) o.push(v); return o; }

  /* ======================= THREE.js part ======================= */
  var G = { ok: false, opt: { cutaway: true, cables: true, zones: true, info: false, flow: true, filter: 'all' }, prevRot: {}, known: {}, tween: null, fade: 1, old: null };
  var FILTERS = {
    source: ['laser', 'isolator', 'sas', 'refcell', 'lockbox', 'lctrl'],
    electronics: ['fgen', 'rfgen', 'rfatt', 'rfamp', 'csrc', 'tctrl', 'psu', 'scope', 'pwrmeter', 'lctrl', 'lockbox'],
    path: ['mirror', 'pbs', 'npbs', 'pickoff', 'hwp', 'qwp', 'aom', 'lens', 'iris', 'nd', 'glan'],
    cell: ['cell'],
    detect: ['pd', 'dump']
  };
  function initThree() {
    var msgEl = $('stageMsg');
    if (!window.THREE || !THREE.OrbitControls) {
      msgEl.classList.add('show'); msgEl.innerHTML = '<div><b>3D view unavailable.</b><br>three.js could not be loaded (offline, or blocked). The rest of the page works, and the reference layout is still evaluated: see the objectives and scope below.</div>';
      return;
    }
    var canvas = $('simCanvas'), stage = $('stage');
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true }); }
    catch (e) { msgEl.classList.add('show'); msgEl.innerHTML = '<div><b>WebGL is not available</b> in this browser, so the 3D bench cannot be drawn. The objectives and scope below still evaluate the reference layout.</div>'; return; }
    G.ok = true; G.renderer = renderer; G.canvas = canvas; G.stage = stage;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene(); G.scene = scene;
    var cam = new THREE.PerspectiveCamera(38, 1, 5, 9000); G.cam = cam;
    setView('3d', true);
    bindPointer();
    var ctr = new THREE.OrbitControls(cam, canvas); G.ctr = ctr;
    ctr.enableDamping = !reduceMotion; ctr.dampingFactor = 0.12; ctr.maxPolarAngle = Math.PI * 0.47; ctr.minDistance = 90; ctr.maxDistance = 6400; ctr.target.set(0, 0, 0); ctr.screenSpacePanning = true;
    ctr.addEventListener('change', requestRender);
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x40454a, 0.85));
    var key = new THREE.DirectionalLight(0xfff1dc, 0.85); key.position.set(-1000, 2200, 1100); key.castShadow = true;
    key.shadow.mapSize.set(3072, 3072); key.shadow.bias = -0.0006;
    var sc = key.shadow.camera; sc.left = -1550; sc.right = 1550; sc.top = 1100; sc.bottom = -1100; sc.near = 100; sc.far = 5200; scene.add(key);
    var fill = new THREE.DirectionalLight(0x7fb4e6, 0.35); fill.position.set(1300, 1000, -1200); scene.add(fill);
    G.compGroup = new THREE.Group(); G.beamGroup = new THREE.Group(); G.cableGroup = new THREE.Group();
    scene.add(G.compGroup); scene.add(G.beamGroup); scene.add(G.cableGroup);
    G.layer = document.createElement('div'); G.layer.className = 'optic-layer'; stage.appendChild(G.layer);
    G.tip = document.createElement('div'); G.tip.className = 'optic-tip'; G.tip.hidden = true; stage.appendChild(G.tip);
    G.labels = {}; G.chips = []; G.flow = [];
    buildTheme();
    var ro = new ResizeObserver(resize); ro.observe(stage); resize(); setView('3d', true);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { G.visible = es[0].isIntersecting; if (G.visible) loop(); }, { threshold: 0.01 }).observe(stage);
    } else G.visible = true;
    document.addEventListener('visibilitychange', function () { if (!document.hidden) loop(); });
    window.onThemeChange(function () { buildTheme(); syncMeshes(); pendingBeams = true; requestRender(); drawScope(); });
    syncMeshes(); pendingBeams = true; loop();
  }
  function wp(c) { return new THREE.Vector3(c.x - K.table.w / 2, K.beamHeight, c.z - K.table.d / 2); }
  function setView(v, instant) {
    if (!G.cam) return;
    var pos, tgt = new THREE.Vector3(0, 0, 0);
    var TW = K.table.w, TD = K.table.d, ks = TW / 1800;
    function tw(x, z) { return new THREE.Vector3(x * ks - TW / 2, 0, z * ks - TD / 2); }   // x, z given on the 1800 mm layout   // table (mm) -> world
    var asp = Math.max(0.5, G.cam.aspect || 1.6), tf = Math.tan(G.cam.fov * Math.PI / 360);
    var fit = Math.max(TD / 2 / tf, TW / 2 / (tf * asp)) * 1.06;   // distance at which the whole table fits the view
    if (v === 'top') { pos = new THREE.Vector3(0, fit, 1); tgt.set(0, 0, 0); }
    else if (v === 'front') { pos = new THREE.Vector3(0, fit * 0.2, fit * 0.95); tgt.set(0, 30, 70); }
    else if (CFG.views && CFG.views[v]) { var vw = CFG.views[v]; tgt = new THREE.Vector3(vw.at[0] - TW / 2, vw.at[2] || 20, vw.at[1] - TD / 2); pos = tgt.clone().add(new THREE.Vector3(vw.off[0], vw.off[1], vw.off[2])); }
    else if (v === 'source') { tgt = tw(250, 270); tgt.y = 20; pos = tgt.clone().add(new THREE.Vector3(-150, 520, 330)); }
    else if (v === 'sas') { tgt = tw(850, 215); tgt.y = 20; pos = tgt.clone().add(new THREE.Vector3(-120, 640, 420)); }
    else if (v === 'cell') { tgt = tw(1230, 780); tgt.y = 30; pos = tgt.clone().add(new THREE.Vector3(300, 380, 480)); }
    else { var d3 = Math.max(1, fit * 1.15); pos = new THREE.Vector3(-0.03 * d3, d3 * 0.62, d3 * 0.72); tgt.set(0, 0, 30); }
    flyTo(pos, tgt, instant);
  }
  function flyTo(pos, tgt, instant) {
    if (instant || reduceMotion) { G.cam.position.copy(pos); G.cam.lookAt(tgt); if (G.ctr) { G.ctr.target.copy(tgt); G.ctr.update(); } G.tween = null; requestRender(); return; }
    G.tween = { pos: pos, tgt: tgt }; requestRender();
  }
  function focusComp(id) {
    var c = comp(id); if (!c || !G.ok) return;
    var t = wp(c), big = c.kind === 'cell' ? 1.5 : /^(fgen|lctrl|lockbox|rfgen|rfatt|rfamp|csrc|tctrl|scope|psu|pwrmeter)$/.test(c.kind) ? 1.2 : 1;
    flyTo(t.clone().add(new THREE.Vector3(120 * big, 150 * big, 190 * big)), t.clone().setY(15));
  }
  function resize() {
    if (!G.ok) return;
    var r = G.stage.getBoundingClientRect();
    G.renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    G.cam.aspect = r.width / Math.max(1, r.height); G.cam.updateProjectionMatrix(); requestRender();
  }
  var needRender = true; function requestRender() { needRender = true; if (G.ok && G.visible) loop(); }

  /* ---- theme / materials ---- */
  function col(n) { var v = css(n); try { return new THREE.Color(v.length === 9 && v[0] === '#' ? v.slice(0, 7) : v); } catch (e) { return new THREE.Color(0x888888); } }
  function std(color, metal, rough, extra) { var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, metalness: metal, roughness: rough }, extra || {})); return m; }
  function buildTheme() {
    var M = G.M = {};
    G.scene.background = new THREE.Color(0x0e1a21);
    M.metal = std(0xa9b2b8, 0.3, 0.38);
    M.alu = std(0xc9d0d4, 0.3, 0.38);
    M.dark = std(col('--sim-dark'), 0.35, 0.55);
    M.black = std(0x0d0f12, 0.5, 0.55);
    M.matte = std(0x07080a, 0.1, 0.95);
    M.mirror = std(0xf2f6f8, 0.45, 0.1);
    M.brass = std(0xd1a94d, 0.4, 0.35);
    M.glass = std(col('--sim-glass'), 0.05, 0.08, { transparent: true, opacity: 0.38, depthWrite: false });
    M.glassDiag = new THREE.MeshBasicMaterial({ color: col('--sim-glass'), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    M.accent = std(col('--sim-accent'), 0.3, 0.45);
    M.laser = std(col('--laser'), 0.2, 0.5);
    M.hwp = std(0x5b8bde, 0.1, 0.12, { transparent: true, opacity: 0.7, depthWrite: false });
    M.qwp = std(0x3fbf96, 0.1, 0.12, { transparent: true, opacity: 0.7, depthWrite: false });
    M.copper = std(0xc17a3d, 0.4, 0.35);
    M.mumetal = std(0x9aa5ad, 0.35, 0.4, { side: THREE.DoubleSide });
    M.nd = std(0x2a2d33, 0.2, 0.3, { transparent: true, opacity: 0.82 });
    M.on = new THREE.MeshBasicMaterial({ color: 0x39d36b }); M.off = new THREE.MeshBasicMaterial({ color: 0xd33a3a });
    M.select = new THREE.MeshBasicMaterial({ color: col('--sim-select'), side: THREE.DoubleSide });
    M.screen = std(0x0b2a1f, 0.1, 0.4, { emissive: 0x1c9a68, emissiveIntensity: 0.55 });
    M.knob = std(0xd9dde0, 0.8, 0.25);
    M.fibre = std(0xe8c33a, 0.1, 0.5); M.fcboot = std(0x3a8f4f, 0.1, 0.5);
    if (G.table) { G.scene.remove(G.table); G.table.geometry.dispose(); }
    if (G.under) { G.scene.remove(G.under); }
    var tc = document.createElement('canvas'); tc.width = tc.height = 64; var x = tc.getContext('2d');
    x.fillStyle = '#46555b'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    x.fillStyle = '#1b272c'; x.beginPath(); x.arc(32, 32, 9, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1.2; x.beginPath(); x.arc(32, 32, 9, 0.2, 2.6); x.stroke();
    var tex = new THREE.CanvasTexture(tc); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(K.table.w / 25, K.table.d / 25); tex.anisotropy = 8;
    var top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.35 });
    var side = new THREE.MeshStandardMaterial({ color: 0x2c3a40, roughness: 0.7, metalness: 0.3 });
    G.table = new THREE.Mesh(new THREE.BoxGeometry(K.table.w, 24, K.table.d), [side, side, top, side, side, side]);
    G.table.position.y = -12; G.table.receiveShadow = true; G.table.castShadow = true; G.scene.add(G.table);
    G.under = new THREE.Group();
    var legM = std(0x2a3238, 0.3, 0.55);
    [[-(K.table.w / 2 - 40), -(K.table.d / 2 - 40)], [K.table.w / 2 - 40, -(K.table.d / 2 - 40)], [-(K.table.w / 2 - 40), K.table.d / 2 - 40], [K.table.w / 2 - 40, K.table.d / 2 - 40]].forEach(function (p) { var l = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 330, 16), legM); l.position.set(p[0], -24 - 165, p[1]); l.castShadow = true; G.under.add(l); });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.ShadowMaterial({ opacity: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -360; floor.receiveShadow = true; G.under.add(floor);
    G.scene.add(G.under);
    buildZones();
    G.texCW = flowTex(false); G.texPulse = flowTex(true); G.texSpot = spotTex();
    G.beamColor = col('--sim-beam');
    if (!G.ghost) { G.ghost = new THREE.Mesh(new THREE.RingGeometry(14, 19, 32), M.select); G.ghost.rotation.x = -Math.PI / 2; G.ghost.visible = false; G.scene.add(G.ghost); }
    else G.ghost.material = M.select;
  }
  /* ---- painted zones on the table: tinted, outlined areas with a name, so each part of the experiment can be found ---- */
  function buildZones() {
    if (G.zoneGroup) { G.scene.remove(G.zoneGroup); G.zoneGroup.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    var grp = G.zoneGroup = new THREE.Group(), PPM = 0.8, TW = K.table.w, TD = K.table.d;
    function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    refZones().forEach(function (z) {
      z.rects.forEach(function (r, ri) {
        var w = r[2] - r[0], h = r[3] - r[1], cw = Math.max(8, Math.round(w * PPM)), ch = Math.max(8, Math.round(h * PPM));
        var c = document.createElement('canvas'); c.width = cw; c.height = ch; var x = c.getContext('2d');
        x.fillStyle = rgba(z.color, 0.11); x.fillRect(0, 0, cw, ch);
        x.strokeStyle = rgba(z.color, 0.8); x.lineWidth = 5; x.setLineDash([22, 10]); x.strokeRect(2.5, 2.5, cw - 5, ch - 5);
        x.setLineDash([]);
        var tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set((r[0] + r[2]) / 2 - TW / 2, 0.45, (r[1] + r[3]) / 2 - TD / 2); m.renderOrder = -1; m.userData.noPick = true;
        grp.add(m);
      });
    });
    grp.visible = !!G.opt.zones; G.scene.add(grp);
    // name chips (HTML, always readable) at the corner of each zone
    if (!document.getElementById('zone-css')) { var st = document.createElement('style'); st.id = 'zone-css'; st.textContent = '.zone-label{position:absolute;left:0;top:0;pointer-events:none;font:700 .72rem/1.1 var(--font-display,system-ui);letter-spacing:.05em;text-transform:uppercase;color:#fff;padding:3px 8px 3px 6px;border-radius:2px;white-space:nowrap;text-shadow:0 1px 1px rgba(0,0,0,.5);box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:.93}'; document.head.appendChild(st); }
    (G.zoneLabels || []).forEach(function (L) { L.el.remove(); });
    G.zoneLabels = refZones().map(function (z) {
      var el = document.createElement('div'); el.className = 'zone-label'; el.textContent = z.name; el.title = z.sub || z.name;
      el.style.background = z.color; el.style.color = '#10161a'; el.style.textShadow = 'none'; el.hidden = !G.opt.zones;
      G.layer.insertBefore(el, G.layer.firstChild);
      return { el: el, align: z.lab[2], pos: new THREE.Vector3(z.lab[0] - TW / 2, 1.5, z.lab[1] - TD / 2) };
    });
  }
  function projectZone(L, w, h) {
    if (!G.opt.zones) { L.el.style.display = 'none'; return; }
    tmpV = tmpV || new THREE.Vector3(); tmpV.copy(L.pos).project(G.cam);
    var hide = tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05;
    L.el.style.display = hide ? 'none' : '';
    if (!hide) L.el.style.transform = 'translate(' + (L.align === 'l' ? '-100%' : '0') + ',' + (L.align === 'bl' ? '-100%' : (L.align === 'l' || L.align === 'r') ? '-50%' : '0') + ') translate(' + ((tmpV.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
  }
  function flowTex(pulsed) {
    var c = document.createElement('canvas'); c.width = 4; c.height = 128; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 128);
    if (pulsed) { g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.42, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.58, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0.08)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0.6)'); }
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function spotTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,.75)'); g.addColorStop(0.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }

  /* ---- component meshes (local +x = forward, y up, group origin on the beam axis) ---- */
  var geoCache = {};
  function geo(key, mk) { return geoCache[key] || (geoCache[key] = mk()); }
  function bx(w, h, d, m, x, y, z) { var o = new THREE.Mesh(geo('b' + w + '_' + h + '_' + d, function () { return new THREE.BoxGeometry(w, h, d); }), m); o.position.set(x || 0, y || 0, z || 0); return o; }
  function cy(r, len, m, x, y, z, ax, seg) { // cylinder with its axis along ax ('x' default, 'y', 'z')
    var o = new THREE.Mesh(geo('c' + r + '_' + len + '_' + (seg || 24), function () { return new THREE.CylinderGeometry(r, r, len, seg || 24, 1, false); }), m);
    if (ax === 'y') { } else if (ax === 'z') o.rotation.x = Math.PI / 2; else o.rotation.z = Math.PI / 2;
    o.position.set(x || 0, y || 0, z || 0); return o;
  }
  function tr(R, t, m, x, y, z, ry) { var o = new THREE.Mesh(geo('t' + R + '_' + t, function () { return new THREE.TorusGeometry(R, t, 10, 36); }), m); o.rotation.y = ry === undefined ? Math.PI / 2 : ry; o.position.set(x || 0, y || 0, z || 0); return o; }
  function sp(r, m, x, y, z, sx) { var o = new THREE.Mesh(geo('s' + r, function () { return new THREE.SphereGeometry(r, 20, 14); }), m); o.position.set(x || 0, y || 0, z || 0); if (sx) o.scale.set(sx, 1, 1); return o; }
  function pm100(g) {
    var M = G.M;
        var y0 = 15 - K.beamHeight, ext = new THREE.MeshStandardMaterial({ color: 0xc8202a, metalness: 0.4, roughness: 0.42 });
    g.add(bx(76, 30, 50, ext, 0, y0, 0));
    for (var rb = -5; rb <= 5; rb++) { g.add(bx(74, 1, 1.2, M.dark, 0, y0 - 15.2 + 0.4, rb * 4.2)); }
    for (var sd = -1; sd <= 1; sd += 2) for (var rg = -3; rg <= 3; rg++) g.add(bx(74, 1.2, 1, M.dark, 0, y0 + rg * 3.6, sd * 25.2));
    g.add(bx(4, 31, 51, M.black, -40, y0, 0)); g.add(bx(4, 31, 51, M.black, 40, y0, 0));
    g.add(bx(1.4, 3, 36, M.black, 0, y0 + 15.4, 0)); g.add(bx(0.6, 1.6, 22, M.laser, -3, y0 + 15.8, 0)); g.add(bx(0.6, 1, 14, M.alu, 6, y0 + 15.8, 0));
    g.add(bx(2, 9, 18, M.alu, -42.4, y0 + 1, 0)); g.add(bx(1.4, 5, 12, M.black, -43.6, y0 + 1, 0)); g.add(cy(1.4, 1, M.on, -42.4, y0 + 10, 18, 'x', 10));
    g.add(bx(2, 8, 12, M.alu, 41.6, y0 - 1, 6)); g.add(bx(1.2, 5, 8, M.black, 42.8, y0 - 1, 6)); g.add(cy(2, 2, M.alu, 42.4, y0 + 7, -14, 'x', 12));
    g.add(cy(1.1, 14, M.black, -50, y0 + 1, -9, 'x', 8)); g.add(cy(1.1, 36, M.black, -55, y0 + 4, -28, 'z', 8)); g.add(cy(1.1, 12, M.black, -55, y0 + 8.5, -40, 'z', 8));
    g.add(cy(22.5, 30.5, M.black, -70, y0 + 8.5, -46, 'x', 36)); g.add(cy(23, 2, M.alu, -84, y0 + 8.5, -46, 'x', 36)); g.add(cy(12.7, 5, M.alu, -87, y0 + 8.5, -46, 'x', 28)); g.add(cy(8, 1, M.black, -89.6, y0 + 8.5, -46, 'x', 24)); g.add(cy(5.2, 1, M.glass, -90.2, y0 + 8.5, -46, 'x', 20));
  }
  function pda(g) {
    var M = G.M;
    g.add(bx(25, 52.5, 59.3, M.dark, 0, 1.2, 0));
    g.add(bx(1, 50, 57, M.black, 12.7, 1.2, 0));
    g.add(cy(12.7, 10.7, M.black, 18.4, 0, 0, 'x', 28));
    g.add(cy(13.4, 1.6, M.alu, 23.4, 0, 0, 'x', 28));
    g.add(cy(8.4, 1.2, M.black, 23.9, 0, 0, 'x', 24));
    g.add(bx(0.8, 3.6, 3.6, M.accent, 24.3, 0, 0));
    g.add(cy(7.5, 6, M.alu, -2, 29.6, 14, 'y', 24)); g.add(cy(6.2, 1.2, M.black, -2, 33, 14, 'y', 24)); g.add(bx(1.4, 1.4, 6, M.laser, -2, 33.8, 14));
    g.add(bx(8, 4, 5, M.alu, 2, 28.4, -14)); g.add(cy(1.6, 1.4, M.on, 8, 28.6, -22, 'y', 10));
    g.add(cy(4.6, 8, M.alu, -16.5, 6, 0, 'x', 14)); g.add(cy(3, 3, M.alu, -21.5, 6, 0, 'x', 14));
    g.add(cy(3.2, 6, M.black, -15.5, -12, 18, 'x', 12));
  }
  function stand(g, kind) { // base plate, post and clamp
    var H = K.beamHeight, M = G.M;
    g.add(bx(30, 3, 22, M.black, 0, -H + 1.5, 0));
    var h = H - 14; g.add(cy(4.5, h, M.alu, 0, -H + 3 + h / 2, 0, 'y', 14));
    g.add(cy(7.5, 9, M.black, 0, -15.5, 0, 'y', 16));
    g.add(cy(2.2, 8, M.brass, 8, -15.5, 0, 'x', 10));
  }
  function scopeTex() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 80; var x = c.getContext('2d');
    x.fillStyle = '#05140e'; x.fillRect(0, 0, 128, 80); x.strokeStyle = '#124a32'; x.lineWidth = 1;
    for (var i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 80); x.stroke(); } for (i = 1; i < 5; i++) { x.beginPath(); x.moveTo(0, i * 16); x.lineTo(128, i * 16); x.stroke(); }
    x.strokeStyle = '#ffd54a'; x.lineWidth = 2; x.beginPath();
    for (i = 0; i <= 128; i++) { var u = (i - 64) / 7, y = 52 - 8 - 22 / (1 + u * u * 0.5) + 18 * (1 - 1 / (1 + (u * 0.3) * (u * 0.3))); if (i) x.lineTo(i, y); else x.moveTo(i, y); } x.stroke();
    return new THREE.CanvasTexture(c);
  }
  // generic bench instrument; front panel faces local -x. variant picks the panel details.
  function instrument(g, w, h, d, variant, own) {
    var M = G.M, H = K.beamHeight, y0 = h / 2 - H, fx = -w / 2;
    var body = variant === 'rfamp' ? std(0x23292f, 0.4, 0.5) : M.dark;
    g.add(bx(w, h, d, body, 0, y0, 0));
    g.add(bx(w + 2, 3, d + 2, M.black, 0, y0 + h / 2, 0));
    if (variant === 'rfamp') { for (var f = -3; f <= 3; f++) g.add(bx(w - 6, 6, 1.6, M.alu, 0, y0 + h / 2 + 4.5, f * d * 0.13)); }
    if (variant === 'scope') {
      var tex = scopeTex(); var scr = own(new THREE.MeshBasicMaterial({ map: tex })); var sc = new THREE.Mesh(geo('scr', function () { return new THREE.PlaneGeometry(d * 0.7, h * 0.62); }), scr); sc.rotation.y = -Math.PI / 2; sc.position.set(fx - 0.9, y0 + h * 0.08, 0); sc.userData.noShadow = true; g.add(sc);
      for (var kn = 0; kn < 4; kn++) g.add(cy(2.6, 3, M.knob, fx - 1.4, y0 - h * 0.34, -d * 0.3 + kn * 9, 'x', 14));
    } else if (variant === 'rfatt') {
      g.add(cy(2.2, 6, M.brass, fx - 3, y0, d * 0.25, 'x', 10)); g.add(cy(2.2, 6, M.brass, fx - 3, y0, -d * 0.25, 'x', 10)); g.add(cy(4, 3, M.knob, fx - 1.4, y0 + h * 0.2, 0, 'x', 14)); g.add(bx(2, 4, 8, M.knob, fx - 1.2, y0 - h * 0.25, 0));
    } else if (variant === 'rfamp') {
      g.add(cy(2.2, 6, M.brass, fx - 3, y0, d * 0.25, 'x', 10)); g.add(cy(2.2, 6, M.brass, fx - 3, y0, -d * 0.25, 'x', 10)); g.add(bx(1.4, 5, 8, M.on, fx - 0.5, y0 + h * 0.25, 0));
    } else if (variant === 'rfgen') {
      g.add(bx(1.4, h * 0.38, d * 0.42, M.screen, fx - 0.4, y0 + h * 0.18, -d * 0.2));
      for (var c1 = 0; c1 < 2; c1++) g.add(cy(2.6, 6, M.brass, fx - 3, y0 - h * 0.3, d * 0.12 + c1 * 12, 'x', 10)); for (var k2 = 0; k2 < 3; k2++) g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.3 + k2 * 9, 'x', 14));
    } else if (variant === 'psu') {
      g.add(bx(1.4, h * 0.3, d * 0.34, M.screen, fx - 0.4, y0 + h * 0.2, -d * 0.18)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.25, -d * 0.25, 'x', 14)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.25, d * 0.05, 'x', 14)); for (var t2 = 0; t2 < 3; t2++) g.add(cy(2.2, 5, t2 === 1 ? M.alu : (t2 ? M.black : M.laser), fx - 3, y0 - h * 0.25, d * 0.22 + t2 * 6, 'x', 10));
    } else if (variant === 'pwrmeter') {
      g.add(bx(1.4, h * 0.4, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.15, 0)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.2, 'x', 14)); g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, d * 0.2, 'x', 14));
    } else if (variant === 'csrc') {
      g.add(cy(7, 4, M.knob, fx - 2, y0 + h * 0.05, -d * 0.12, 'x', 20)); g.add(bx(1.4, h * 0.3, d * 0.3, M.screen, fx - 0.4, y0 + h * 0.2, d * 0.2)); g.add(cy(2.6, 6, M.copper, fx - 3, y0 - h * 0.28, d * 0.25, 'x', 10));
    } else if (variant === 'tctrl') {
      g.add(bx(1.4, h * 0.34, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.18, -d * 0.1)); for (var k3 = 0; k3 < 3; k3++) g.add(cy(3, 3, M.knob, fx - 1.4, y0 - h * 0.28, -d * 0.3 + k3 * 9, 'x', 14));
    } else {
      g.add(bx(1.4, h * 0.42, d * 0.5, M.screen, fx - 0.4, y0 + h * 0.12, -d * 0.12));
      for (var i = 0; i < 3; i++) g.add(cy(3, 3, M.knob, fx - 1, y0 - h * 0.28, d * 0.28 - i * 9, 'x', 14));
    }
    return y0;
  }
  function buildMesh(c) {
    var g = new THREE.Group(), M = G.M, H = K.beamHeight, p = c.params, k = c.kind, ownMats = [];
    function own(m) { ownMats.push(m); return m; }
    var needsStand = !(k === 'fgen' || k === 'lctrl' || k === 'lockbox' || k === 'rfgen' || k === 'rfatt' || k === 'rfamp' || k === 'csrc' || k === 'tctrl' || k === 'scope' || k === 'psu' || k === 'pwrmeter');
    if (needsStand && k !== 'cell' && k !== 'sas' && k !== 'refcell') stand(g, k);
    switch (k) {
      case 'laser':
        g.add(bx(46, 28, 32, M.alu, -18, 0, 0)); g.add(bx(46, 4, 33, M.laser, -18, 15, 0));
        for (var f = 0; f < 6; f++) g.add(bx(2.2, 8, 34, M.black, -34 + f * 6, 19, 0));
        g.add(cy(3.6, 12, M.fcboot, 12, 0, 0, 'x', 14)); g.add(cy(4.8, 3, M.knob, 19, 0, 0, 'x', 14)); g.add(cy(1.5, 12, M.fibre, 26, 0, 0, 'x', 8));  // PM fibre pigtail with FC/APC (no collimator on the laser)
        g.add(bx(8, 3, 6, M.accent, -34, -13, 0));
        var led = sp(1.9, M.on, -38, 13, 17); g.add(led); break;
      case 'isolator':
        // fibre-inline dual-stage isolator (two Faraday stages in one tube, FC/APC boots) followed by the FC/APC collimator
        g.add(cy(1.5, 14, M.fibre, -33, 0, 0, 'x', 8)); g.add(cy(3.6, 9, M.fcboot, -24, 0, 0, 'x', 14)); g.add(cy(4.8, 3, M.knob, -18, 0, 0, 'x', 14));
        g.add(cy(5.6, 11, M.accent, -10, 0, 0, 'x', 20)); g.add(cy(6.2, 2, M.black, -3.5, 0, 0, 'x', 20)); g.add(cy(5.6, 11, M.accent, 3, 0, 0, 'x', 20));
        g.add(cy(4.8, 3, M.knob, 10, 0, 0, 'x', 14)); g.add(cy(8, 18, M.black, 20, 0, 0, 'x', 20)); g.add(cy(4.2, 4, M.brass, 31, 0, 0, 'x', 14)); g.add(cy(3.2, 1.2, M.glass, 33.4, 0, 0, 'x', 14));
        var cone = new THREE.Mesh(geo('cone', function () { return new THREE.ConeGeometry(3.4, 9, 12); }), M.laser); cone.rotation.z = -Math.PI / 2; cone.position.set(-2, 10, 0); g.add(cone); g.add(bx(12, 1.8, 1.8, M.laser, -10, 10, 0)); break;
      case 'mirror':
        g.add(bx(8, 30, 30, M.black, -6, 0, 0)); g.add(cy(13.5, 3, M.mirror, 0, 0, 0)); g.add(cy(14.5, 2, M.alu, -2.5, 0, 0));
        g.add(cy(2.6, 9, M.knob, -12, 11, 10)); g.add(cy(2.6, 9, M.knob, -12, -11, 10)); g.add(cy(2.6, 9, M.knob, -12, 11, -10)); break;
      case 'pickoff':
        g.add(bx(2, 22, 22, M.glass, 0, 0, 0)); g.add(bx(6, 3, 26, M.black, -2, -13, 0)); g.add(bx(2.5, 24, 2, M.alu, -1, 0, 12)); g.add(bx(2.5, 24, 2, M.alu, -1, 0, -12)); break;
      case 'pbs': case 'npbs': {
        g.add(bx(20, 20, 20, M.glass)); g.add(bx(22, 2, 22, M.alu, 0, -11, 0));
        var pl = new THREE.Mesh(geo('diag', function () { return new THREE.PlaneGeometry(28, 20); }), M.glassDiag); pl.rotation.y = -Math.PI / 4; g.add(pl);
        if (k === 'npbs') g.add(bx(20, 2, 20, M.accent, 0, 11, 0)); else { g.add(bx(4, 1, 4, M.accent, 8, 10.6, 8)); }
        break; }
      case 'hwp': case 'qwp': {
        g.add(tr(13.2, 2.2, M.black, -2, 0, 0)); g.add(cy(12, 2.6, k === 'hwp' ? M.hwp : M.qwp, 0, 0, 0));
        g.add(tr(14.4, 1.4, M.knob, 0, 0, 0));
        for (var t = 0; t < 12; t++) { var a = t * Math.PI / 6, tk = bx(0.8, t % 3 ? 1.6 : 3, 0.8, M.knob, 1.2, Math.sin(a) * 14.6, Math.cos(a) * 14.6); g.add(tk); }
        var ax = bx(1.2, 1.4, 22, M.black, 1.6, 0, 0); ax.rotation.x = (p.axis || 0) * Math.PI / 180; g.add(ax);
        var tab = bx(1.6, 4, 2.4, M.laser, 1.8, 0, 0); tab.position.set(1.8, -Math.sin((p.axis || 0) * Math.PI / 180) * 11, Math.cos((p.axis || 0) * Math.PI / 180) * 11); g.add(tab); break; }
      case 'aom':
        g.add(bx(28, 20, 24, M.alu)); g.add(bx(28, 6, 24, M.accent, 0, 12, 0)); g.add(bx(30, 2, 26, M.black, 0, -11, 0));
        g.add(cy(4, 2, M.black, -14.4, 0, 0)); g.add(cy(4, 2, M.black, 14.4, 0, 0));
        g.add(cy(2.6, 9, M.brass, 6, 18, 0, 'y', 10));
        g.add(sp(2.4, p.rf ? M.on : M.off, -9, 15.5, 8));
        if (p.mode === 'double') {
          g.add(cy(9, 2, M.glass, 32, 0, 0)); g.add(tr(10, 1.4, M.black, 32, 0, 0)); g.add(cy(8.5, 2, M.qwp, 42, 0, 0)); g.add(tr(9.5, 1.2, M.black, 42, 0, 0));
          g.add(cy(10, 3, M.mirror, 54, 0, 0)); g.add(bx(4, 22, 22, M.black, 58, 0, 0)); g.add(bx(62, 3, 28, M.black, 25, -14, 0)); g.add(cy(3.5, 24, M.alu, 54, -14, 0, 'y', 10));
        }
        break;
      case 'lens':
        g.add(tr(13.5, 2, M.black, 0, 0, 0)); g.add(sp(12, M.glass, 0, 0, 0, 0.24)); break;
      case 'iris': {
        g.add(tr(11, 3, M.black, 0, 0, 0)); g.add(tr(6, 3.2, M.dark, 0, 0, 0)); g.add(bx(2, 2, 12, M.knob, 0, 13, 5)); break; }
      case 'nd':
        g.add(bx(2.5, 24, 24, M.nd)); g.add(bx(5, 3, 26, M.black, 0, -13, 0)); g.add(bx(3, 26, 2, M.black, 0, 0, 13)); g.add(bx(3, 26, 2, M.black, 0, 0, -13)); break;
      case 'cell': {
        var hot = p.heater ? Math.min(1, Math.max(0, (p.T_C - 20) / 50)) : 0;
        var heaterM = own(std(0xd88a1d, 0.3, 0.55, { emissive: 0xff6a00, emissiveIntensity: 0.1 + 0.8 * hot, transparent: true, opacity: 0.9 }));
        var vaporM = own(new THREE.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.05 + 0.2 * Math.min(1, (p.T_C - 20) / 50), depthWrite: false }));
        stand(g, k);
        g.add(cy(12.5, 25, M.glass)); g.add(cy(11, 22, vaporM)); g.add(cy(13.1, 2, M.glass, -13, 0, 0)); g.add(cy(13.1, 2, M.glass, 13, 0, 0));   // Ø25 mm cell, 25 mm vapour path (as the published EIT cell)
        g.add(tr(12.9, 1.1, M.alu, -12, 0, 0)); g.add(tr(12.9, 1.1, M.alu, 12, 0, 0));
        g.add(cy(3, 14, M.glass, 0, 19, 0, 'y', 10)); g.add(sp(2.4, std(0xa08060, 0.8, 0.3), 0, 26, 0));
        if (p.heater) g.add(cy(13.9, 22, heaterM));
        if (p.solenoid) for (var i = -4; i <= 4; i++) g.add(tr(17.5, 1.5, M.copper, i * 8.5, 0, 0));
        if (p.shield) {
          var layers = [[21, 108], [24.5, 114], [28, 120]];
          layers.forEach(function (L) {
            var geoS = G.opt.cutaway ? new THREE.CylinderGeometry(L[0], L[0], L[1], 44, 1, true, Math.PI * 0.75, Math.PI * 1.5) : new THREE.CylinderGeometry(L[0], L[0], L[1], 44, 1, true);
            var sh = new THREE.Mesh(geoS, M.mumetal); sh.rotation.z = Math.PI / 2; sh.userData.ownGeo = true; sh.userData.noPick = false; g.add(sh);
            [-1, 1].forEach(function (s) { var cap = new THREE.Mesh(new THREE.RingGeometry(6, L[0], 36), M.mumetal); cap.rotation.y = Math.PI / 2; cap.position.x = s * L[1] / 2; cap.userData.ownGeo = true; g.add(cap); });
          });
          g.add(bx(100, 3, 70, M.black, 0, -H + 1.5, 0));
        } else g.add(bx(70, 3, 40, M.black, 0, -H + 1.5, 0));
        break; }
      case 'sas':
        stand(g, k); pda(g); break;
      case 'refcell': {
        stand(g, k);
        g.add(cy(9.5, 75, M.glass)); g.add(cy(7.8, 70, own(new THREE.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.14, depthWrite: false })))); g.add(cy(10.1, 2, M.glass, -37.5, 0, 0)); g.add(cy(10.1, 2, M.glass, 37.5, 0, 0));   // Ø19 x 75 mm reference cell
        g.add(tr(9.9, 1, M.alu, -36.5, 0, 0)); g.add(tr(9.9, 1, M.alu, 36.5, 0, 0)); g.add(cy(2.4, 10, M.glass, 0, 14, 0, 'y', 10));
        break; }
      case 'glan':
        g.add(bx(22, 22, 30, M.glass)); g.add(bx(24, 4, 32, M.alu, 0, -12, 0)); g.add(bx(24, 4, 32, M.alu, 0, 12, 0)); g.add(cy(3, 12, M.black, 0, 0, 18, 'z', 10)); break;
      case 'pd':
        pda(g); break;
      case 'dump': {
        g.add(bx(20, 30, 26, M.matte));
        for (var q = -2; q <= 2; q++) g.add(bx(2, 28, 28, M.black, -4 + q * 3.2, 0, 0));
        g.add(bx(2, 18, 16, M.black, 10.5, 0, 0)); break; }
      case 'rfgen': instrument(g, 84, 36, 56, 'rfgen', own); g.add(bx(1.4, 5, 5, M.on, -42.6, -K.beamHeight + 7, 22)); break;
      case 'rfatt': instrument(g, 56, 24, 40, 'rfatt', own); break;
      case 'rfamp': instrument(g, 64, 28, 44, 'rfamp', own); break;
      case 'csrc': instrument(g, 70, 32, 48, 'csrc', own); break;
      case 'tctrl': instrument(g, 70, 32, 48, 'tctrl', own); break;
      case 'scope': instrument(g, 70, 56, 74, 'scope', own); break;
      case 'psu': instrument(g, 60, 30, 44, 'psu', own); break;
      case 'pwrmeter': pm100(g); break;
      case 'fgen': instrument(g, 92, 46, 62); g.add(bx(1.4, 8, 8, p.on ? M.on : M.off, -46.6, -K.beamHeight + 10, 20)); break;
      case 'lctrl': instrument(g, 58, 36, 46); g.add(bx(1.4, 6, 6, M.on, -29.6, -K.beamHeight + 10, 16)); break;
      case 'lockbox': {
        instrument(g, 52, 30, 42);
        g.add(bx(1.4, 6, 6, S.ev && S.ev.lock && S.ev.lock.status === 'locked' ? M.on : M.off, -26.6, -K.beamHeight + 8, 16)); break; }
      default: break;
    }
    g.position.set(c.x - K.table.w / 2, H, c.z - K.table.d / 2);
    g.rotation.y = -c.rot * Math.PI / 180;
    g.userData.rot = c.rot;
    g.traverse(function (o) {
      o.userData.compId = c.id;
      if (o.isMesh) {
        var m = o.material; o.castShadow = !(m && m.transparent) && !o.userData.noShadow; o.receiveShadow = true;
      }
    });
    if (ownMats.length) g.userData.ownMats = ownMats;
    if (c.id === S.sel) {
      var sr = new THREE.Mesh(geo('selring', function () { return new THREE.RingGeometry(21, 25, 48); }), M.select); sr.rotation.x = -Math.PI / 2; sr.position.y = -H + 0.8; sr.userData.noPick = true; sr.castShadow = false; g.add(sr);
      var pole = new THREE.Mesh(geo('selpole', function () { return new THREE.CylinderGeometry(0.7, 0.7, 70, 6); }), M.select); pole.position.y = 38; pole.userData.noPick = true; g.add(pole);
    }
    return g;
  }
  function dimGroup(g) {
    g.traverse(function (o) {
      if (!o.isMesh || o.userData.noPick) return;
      var m = o.material; if (!m || m.userData && m.userData.dim) return;
      var key = m.uuid; G.dimCache = G.dimCache || {};
      var d = G.dimCache[key];
      if (!d) { d = m.clone(); d.transparent = true; d.opacity = 0.1; d.depthWrite = false; d.userData = { dim: true }; G.dimCache[key] = d; }
      o.material = d; o.castShadow = false;
    });
  }
  function compFilterOK(kind) { var f = G.opt.filter; return f === 'all' || (FILTERS[f] || []).indexOf(kind) >= 0; }
  function labelText(c) {
    var t = c.tag || P.KINDS[c.kind].short; if (c.kind === 'aom') t += ' ' + c.params.fMHz.toFixed(3);
    if (c.kind === 'hwp' || c.kind === 'qwp' || c.kind === 'glan') t += ' ' + c.params.axis + '°';
    return t;
  }
  function disposeGroup(gr) {
    while (gr.children.length) {
      var o = gr.children.pop();
      if (o.userData && o.userData.ownMats) o.userData.ownMats.forEach(function (m) { m.dispose(); });
      o.traverse(function (q) { if (q.isSprite) { q.material.dispose(); } if (q.userData && q.userData.ownGeo && q.geometry) q.geometry.dispose(); if (q.userData && q.userData.ownMat && q.material) { if (q.material.map && !q.userData.sharedMap) q.material.map.dispose(); q.material.dispose(); } });
    }
  }
  function syncMeshes() {
    if (!G.ok) return;
    disposeGroup(G.compGroup); buildCables();
    var alive = {};
    S.layout.components.forEach(function (c) {
      var g = buildMesh(c); alive[c.id] = 1;
      if (!compFilterOK(c.kind) && c.id !== S.sel) dimGroup(g);
      var prev = G.prevRot[c.id];
      if (prev !== undefined && prev !== c.rot && !reduceMotion) {
        var d = ((c.rot - prev + 540) % 360) - 180;
        g.userData.anim = { from: -(c.rot - d) * Math.PI / 180, to: -c.rot * Math.PI / 180, t: 0 };
        g.rotation.y = g.userData.anim.from;
      } else if (!G.known[c.id] && Object.keys(G.known).length && !reduceMotion) {
        g.userData.pop = 0; g.scale.setScalar(0.05);
      }
      G.prevRot[c.id] = c.rot; G.known[c.id] = 1;
      G.compGroup.add(g);
    });
    Object.keys(G.known).forEach(function (id) { if (!alive[id]) { delete G.known[id]; delete G.prevRot[id]; } });
    buildLabels();
    requestRender();
  }
  function buildLabels() {
    G.layer.querySelectorAll('.optic-label').forEach(function (e) { e.remove(); }); G.labels = {};
    if (!S.labels) return;
    S.layout.components.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'optic-label' + (c.id === S.sel ? ' sel' : '') + (compFilterOK(c.kind) ? '' : ' dim'); b.textContent = labelText(c); b.tabIndex = -1;
      b.setAttribute('aria-label', c.nm || P.KINDS[c.kind].name);
      b.addEventListener('click', function () { selectComp(c.id, true); });
      G.layer.appendChild(b); G.labels[c.id] = { minor: /^(mirror|iris|dump|lens)$/.test(c.kind), el: b, pos: wp(c).add(new THREE.Vector3(0, ({ fgen: 20, rfgen: 6, rfatt: 6, rfamp: 10, csrc: 8, tctrl: 8, lctrl: 8, lockbox: 8, scope: 30, psu: 8, pwrmeter: 8 })[c.kind] || 34, 0)) };
    });
  }
  function selectComp(id, fly) {
    S.sel = id; syncMeshes(); renderInspector(); if (fly) focusComp(id);
  }
  function buildCables() {
    disposeGroup(G.cableGroup); G.dots = [];
    var comps = S.layout.components, lk = S.ev ? S.ev.lock : null, links = [], cc = col('--sim-accent').getHex();
    function of(k) { return comps.filter(function (c) { return c.kind === k; }); }
    function near(c, list) { var best = null, bd = 1e9; list.forEach(function (o) { var d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; best = o; } }); return best; }
    function add(a, b, color, tray) { if (a && b && a !== b && !a.nocable && !b.nocable) links.push({ a: a, b: b, color: color, tray: tray }); }
    if (lk) { var chain = [lk.ids.sas, lk.ids.box, lk.ids.ctrl, lk.ids.laser]; for (var i = 0; i < 3; i++) add(comp(chain[i]), comp(chain[i + 1]), i === 2 ? 0xd9a441 : cc, 'top'); }
    of('rfatt').forEach(function (att) { add(near(att, of('rfgen')), att, 0x4f86c6, 'bottom'); of('fgen').forEach(function (f) { add(f, att, 0x9a8fd0, 'bottom'); }); });
    of('rfamp').forEach(function (amp) { add(near(amp, of('rfatt')), amp, 0x4f86c6, 'bottom'); add(amp, near(amp, of('aom')), 0x4f86c6, 'bottom'); });
    of('csrc').forEach(function (s) { add(s, near(s, of('cell')), 0xc17a3d, 'bottom'); });
    of('tctrl').forEach(function (s) { add(s, near(s, of('cell')), 0xb5533c, 'bottom'); });
    of('pd').forEach(function (pd) { add(pd, near(pd, of('scope')), 0x6fae7a, 'bottom'); });
    of('sas').forEach(function (sd) { of('psu').forEach(function (u) { add(u, sd, 0xe0b030, 'top'); }); });
    of('pd').forEach(function (pd) { of('psu').forEach(function (u) { add(u, pd, 0xe0b030, 'top'); }); });
    of('scope').forEach(function (sc) { if (lk && lk.ids.box) add(comp(lk.ids.box), sc, 0x6fae7a, 'top'); of('fgen').forEach(function (f) { add(f, sc, 0x9a8fd0, 'bottom'); }); });
    comps.forEach(function (c) { (c.cableTo || []).forEach(function (t) { var o = comp(t.to); if (o && o !== c) links.push({ a: c, b: o, color: t.color || cc, tray: t.tray || 'top' }); }); });
    var tw = K.table.w / 2, td = K.table.d / 2, trays = CFG.trays ? { top: CFG.trays.top - td, bottom: CFG.trays.bottom - td } : { top: 22 - td, bottom: td - 100 + 0 };
    links.forEach(function (l, li) {
      var a = new THREE.Vector3(l.a.x - tw, 3, l.a.z - td), b = new THREE.Vector3(l.b.x - tw, 3, l.b.z - td), tz = l.tray === 'top' ? trays.top : trays.bottom + (li % 5) * 7;
      var pts = [a, new THREE.Vector3(a.x, 2.2, tz), new THREE.Vector3(b.x, 2.2, tz), new THREE.Vector3(b.x, 2.2, b.z), b];
      var mat = new THREE.MeshStandardMaterial({ color: l.color, roughness: 0.6 }), len = 0, segs = [];
      for (var i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i], d = p1.clone().sub(p0), L = d.length(); if (L < 0.5) continue;
        var t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, L, 6), mat); t.position.copy(p0).addScaledVector(d, 0.5); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        t.userData.ownGeo = true; t.userData.noPick = true; t.castShadow = true; G.cableGroup.add(t);
        var j = new THREE.Mesh(geo('cj', function () { return new THREE.SphereGeometry(1.1, 6, 5); }), mat); j.position.copy(p1); j.userData.noPick = true; G.cableGroup.add(j);
        segs.push({ p0: p0, p1: p1, L: L }); len += L;
      }
      var dot = new THREE.Mesh(geo('cdot', function () { return new THREE.SphereGeometry(2.4, 10, 8); }), new THREE.MeshBasicMaterial({ color: 0xffffff })); dot.userData.ownMat = true; dot.userData.noPick = true; G.cableGroup.add(dot);
      G.dots.push({ m: dot, segs: segs, len: len, ph: (li * 0.37) % 1 });
    });
    G.cableGroup.visible = G.opt.cables;
  }
  function beamMats(group, k) { group.traverse(function (o) { if (o.material && o.userData.baseOp !== undefined) o.material.opacity = o.userData.baseOp * k; }); }
  function buildBeams() {
    if (G.old) { disposeGroup(G.old); G.scene.remove(G.old); G.old = null; }
    if (G.beamGroup.children.length) { G.old = G.beamGroup; G.beamGroup = new THREE.Group(); G.scene.add(G.beamGroup); }
    G.fade = G.old && !reduceMotion ? 0 : 1; G.flow = [];
    G.chips.forEach(function (c) { c.el.remove(); }); G.chips = [];
    if (!S.ev) return;
    var H = K.beamHeight, up = new THREE.Vector3(0, 1, 0), segs = S.ev.trace.segments.filter(function (s) { return s.P >= 1e-5; });
    var core = new THREE.Color(G.beamColor).lerp(new THREE.Color(0xffffff), 0.45);
    segs.forEach(function (s) {
      var a = new THREE.Vector3(s.a[0] - K.table.w / 2, H, s.a[1] - K.table.d / 2), b = new THREE.Vector3(s.b[0] - K.table.w / 2, H, s.b[1] - K.table.d / 2);
      var d = b.clone().sub(a), L = d.length(); if (L < 0.5) return;
      var k = Math.min(1, Math.max(0, (Math.log10(s.P) + 5) / 6));
      var r = 0.45 + 1.25 * k;
      var tex = (s.pulsed ? G.texPulse : G.texCW).clone(); tex.needsUpdate = true; tex.repeat.set(1, L / (s.pulsed ? 90 : 40));
      var o1 = 0.4 + 0.6 * k, o2 = 0.06 + 0.2 * k;
      var cm = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10, 1, true), new THREE.MeshBasicMaterial({ color: core, map: tex, transparent: true, opacity: o1, depthWrite: false }));
      var hm = new THREE.Mesh(new THREE.CylinderGeometry(r * 3, r * 3, L, 12, 1, true), new THREE.MeshBasicMaterial({ color: G.beamColor, transparent: true, opacity: o2, blending: THREE.AdditiveBlending, depthWrite: false }));
      cm.userData.baseOp = o1; hm.userData.baseOp = o2;
      [cm, hm].forEach(function (m) { m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(up, d.clone().normalize()); m.userData.ownGeo = true; m.userData.ownMat = true; m.userData.noPick = true; G.beamGroup.add(m); });
      G.flow.push({ tex: tex, speed: s.pulsed ? 0.8 : 1.4 });
      // glow where the beam lands on an optic, or leaves the table (stray light)
      var sprMat = new THREE.SpriteMaterial({ map: G.texSpot, color: s.toEdge ? 0xff9a3c : G.beamColor, transparent: true, opacity: (s.toEdge ? 0.1 + 0.75 * k : 0.25 + 0.6 * k), blending: THREE.AdditiveBlending, depthWrite: false });
      var spr = new THREE.Sprite(sprMat); spr.position.copy(b); var ss = (s.toEdge ? 8 + 30 * k : 9 + 22 * k); spr.scale.set(ss, ss, 1);
      spr.userData.baseOp = sprMat.opacity; spr.userData.ownMat = true; spr.userData.sharedMap = true; spr.userData.noPick = true; G.beamGroup.add(spr);
      if (G.opt.info && L > 60 && s.P > 0.02 && G.chips.length < 16) {
        var el = document.createElement('div'); el.className = 'beam-chip'; el.textContent = P.fmtP(s.P) + ' · ' + P.polLabel(s.J);
        G.layer.appendChild(el); G.chips.push({ el: el, pos: a.clone().addScaledVector(d, 0.5).add(new THREE.Vector3(0, 12, 0)) });
      }
    });
    beamMats(G.beamGroup, G.fade); if (G.old) beamMats(G.old, 1 - G.fade);
  }

  /* ---- picking & dragging ---- */
  var ray = null, plane = null;
  function ndc(cx, cy) { var r = G.canvas.getBoundingClientRect(); return new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); }
  function overCanvas(cx, cy) { var r = G.canvas.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; }
  function tableAt(cx, cy) {
    if (!G.ok || !overCanvas(cx, cy)) return null;
    ray = ray || new THREE.Raycaster(); plane = plane || new THREE.Plane(new THREE.Vector3(0, 1, 0), -K.beamHeight);
    ray.setFromCamera(ndc(cx, cy), G.cam); var hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    var x = hit.x + K.table.w / 2, z = hit.z + K.table.d / 2;
    if (x < 0 || x > K.table.w || z < 0 || z > K.table.d) return null;
    return [snap(x, K.table.w), snap(z, K.table.d)];
  }
  function pickComp(cx, cy) {
    ray = ray || new THREE.Raycaster(); G.cam.updateMatrixWorld(); G.compGroup.updateMatrixWorld(true); ray.setFromCamera(ndc(cx, cy), G.cam);
    var hits = ray.intersectObjects(G.compGroup.children, true);
    for (var i = 0; i < hits.length; i++) { var o = hits[i].object; if (o.userData.noPick || !o.visible) continue; if (o.userData.compId) { var c = comp(o.userData.compId); if (c && !compFilterOK(c.kind) && c.id !== S.sel) continue; return o.userData.compId; } }
    return null;
  }
  function showGhost(t) { if (!G.ok) return; if (!t) { G.ghost.visible = false; requestRender(); return; } G.ghost.visible = true; G.ghost.position.set(t[0] - K.table.w / 2, 1, t[1] - K.table.d / 2); requestRender(); }
  function bindPointer() {
    var cv = $('simCanvas'), drag = null, down = null;
    cv.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY }; G.tween = null;
      if (e.button !== 0) return;
      var id = pickComp(e.clientX, e.clientY);
      if (id) {
        if (G.ctr) G.ctr.enabled = false;
        if (S.sel !== id) { S.sel = id; syncMeshes(); renderInspector(); }
        drag = { id: id, moved: false, pid: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (er) { }
        cv.style.cursor = 'grabbing'; G.tip.hidden = true;
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (drag && e.pointerId === drag.pid) {
        var t = tableAt(e.clientX, e.clientY), c = comp(drag.id);
        if (t && c && (t[0] !== c.x || t[1] !== c.z) && !occupied(t[0], t[1], c.id)) { c.x = t[0]; c.z = t[1]; drag.moved = true; S.layout.state.storageRan = false; changed(true); }
        return;
      }
      if (e.pointerType === 'mouse' && !e.buttons) {
        var id = pickComp(e.clientX, e.clientY); cv.style.cursor = id ? 'grab' : '';
        var c2 = id && comp(id), r = G.stage.getBoundingClientRect();
        if (c2) { G.tip.hidden = false; G.tip.textContent = (c2.nm || P.KINDS[c2.kind].name) + ' · ' + labelText(c2); G.tip.style.left = (e.clientX - r.left + 14) + 'px'; G.tip.style.top = (e.clientY - r.top + 12) + 'px'; } else G.tip.hidden = true;
      }
    });
    cv.addEventListener('pointerleave', function () { G.tip.hidden = true; });
    function up(e) {
      if (drag) { drag = null; if (G.ctr) G.ctr.enabled = true; cv.style.cursor = ''; try { cv.releasePointerCapture(e.pointerId); } catch (er) { } return; }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4 && e.button === 0) { if (S.sel) { S.sel = null; syncMeshes(); renderInspector(); } }
      down = null;
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function () { G.tween = null; }, { passive: true });
  }

  /* ---- guided tour ---- */
  var TOUR = [
    { kind: 'laser', title: 'One laser feeds everything', text: 'A single PM-fibre-pigtailed DFB laser at 795 nm (Rb D1) is the source for the control, the probe and the lock reference. Because both EIT fields share this laser, its ~MHz linewidth is common to both and largely cancels in the two-photon detuning.' },
    { kind: 'isolator', title: 'Protect the diode', text: 'The fibre Faraday isolator (dual-stage) passes light forward and blocks the reflections coming back from the AOM double-passes and cell windows. Without it the DFB can mode-hop and the lock fail.' },
    { kind: 'mirror', nth: 0, title: 'Set the master axis', text: 'Two kinematic steering mirrors and two irises define one repeatable beam axis. Each mirror has two adjustment axes; a small tilt θ moves the beam by 2θ. Centre the beam on both irises before adding any other optic.' },
    { kind: 'pbs', nth: 0, title: 'Pick off the SAS reference', text: 'The first half-wave plate turns the polarization by a small angle, and this PBS reflects the vertical part (about 5 % of the light) north to the SAS arm. The rest, horizontally polarized, carries on along the master axis.' },
    { kind: 'npbs', nth: 0, title: 'SAS: pump and probe', text: 'After one mirror, a non-polarizing cube divides the reference light into a stronger pump (reflected) and a weaker probe (transmitted, further attenuated by an ND filter). A half-wave plate turns the probe’s polarization to horizontal.' },
    { kind: 'refcell', nth: 0, title: 'SAS: counter-propagating beams', text: 'The probe crosses the Rb reference cell from the left; the pump, routed round two mirrors, is injected from the right by a PBS and extracted again after the cell. Where they overlap, atoms near zero velocity see both beams and the probe shows a narrow sub-Doppler feature.' },
    { kind: 'sas', title: 'The lock photodiode', text: 'The probe lands on this photodiode, whose signal has the sub-Doppler lines. It is the sensor of the frequency lock; its cable goes to the lock box.' },
    { kind: 'lockbox', title: 'Close the loop', text: 'The lock box turns the SAS signal into an error signal and feeds the laser controller, which trims the DFB current. SAS photodiode → lock box → controller → DFB: the cables are drawn automatically. Open any link and the laser drifts.' },
    { kind: 'pbs', nth: 1, title: 'Split into control and probe', text: 'The second half-wave plate sets the power ratio. This PBS sends horizontal light (control, strong) east and vertical light (probe, weak) south. Rotate that plate and watch the two arms trade brightness.' },
    { kind: 'pbs', nth: 4, title: 'Control arm: double-pass input', text: 'Two mirrors fold the control to this PBS, which transmits it horizontally into the AOM assembly. On the way back the beam is vertically polarized, so the same cube reflects it out sideways: that is how a double pass separates the output from the input.' },
    { kind: 'aom', nth: 0, title: 'Control AOM', text: 'The AOM diffracts a fraction of the light into the +1 order, deflected by an angle (exaggerated here) and shifted by +80 MHz. The undiffracted 0th order carries straight on to a beam dump.' },
    { kind: 'qwp', nth: 0, title: 'Quarter-wave plate: turn the polarization', text: 'This plate sits on the deflected beam at 45° to its polarization. The beam passes it twice (out and back), which together turn horizontal into vertical, so the PBS can pick it out.' },
    { kind: 'lens', nth: 0, title: 'Cat’s-eye lens', text: 'The lens focuses the diffracted beam onto the retro mirror. Because the beam is focused onto the mirror, a change of RF frequency (which changes the deflection angle) does not walk the returning beam.' },
    { kind: 'mirror', nth: 7, title: 'Retro mirror: second pass', text: 'The mirror sends the +1 order straight back. It diffracts again in the AOM, shifted by another +80 MHz, back onto the input axis: 160 MHz in total. Its own 0th order goes to a second dump.' },
    { kind: 'lens', nth: 1, title: 'Control beam expander', text: 'Two lenses after the double-pass expand the control so it overfills the probe in the cell. The control intensity (mW/cm²) sets the EIT linewidth, so beam size matters as much as power. A half-wave plate trims its polarization before the combiner.' },
    { kind: 'aom', nth: 1, title: 'Probe arm: its own double pass', text: 'The probe leaves the splitter heading south and meets an identical assembly with the RF frequency 35 kHz lower, so the probe sits 70 kHz below the control at the atoms: the Zeeman splitting at 50 mG. After the AOM two mirrors fold it to meet the control.' },
    { kind: 'nd', nth: 1, title: 'Keep the probe weak', text: 'An OD 2 filter cuts the probe to 1 % so Ω_p ≪ Ω_c and the EIT window is not power-broadened.' },
    { kind: 'pbs', nth: 6, title: 'Recombine on one axis', text: 'The recombiner transmits the probe (H) and reflects the control (V), so the two overlap on a single line toward the cell. Overlap must be good to a fraction of a milliradian.' },
    { kind: 'qwp', nth: 2, title: 'Opposite circular polarizations', text: 'The quarter-wave plate at 45° turns the horizontal probe and vertical control into σ⁻ and σ⁺, the pair that drives the Λ system.' },
    { kind: 'cell', title: 'Shielded vapour cell', text: 'The ⁸⁷Rb cell sits in a heater, a solenoid (the bias field along the beams) and three layers of µ-metal. Use the shield cutaway button to look inside. The field sets the two-photon resonance, 1.4 kHz per mG.' },
    { kind: 'glan', title: 'Throw the control away', text: 'A second quarter-wave plate undoes the circular polarization and the Glan–Taylor (extinction ~10⁵) transmits only the probe. The rejected control goes to a beam dump.' },
    { kind: 'pd', title: 'Detect the transparency window', text: 'A lens collects the probe onto the photodiode. Sweep the two-photon detuning on the scope and the EIT peak appears when everything upstream is right.' },
    { kind: 'rfgen', title: 'RF chain', text: 'One dual-channel source feeds two chains, each an attenuator/switch and an amplifier, that drive the AOMs. Sharing the clock keeps the two phases related, which keeps the probe-control beat stable. The cables are drawn automatically.' },
    { kind: 'csrc', title: 'Field and temperature', text: 'The coil current source sets B along the cell axis; the temperature controller sets the heater. Their cables run to the cell: B sets the two-photon resonance, temperature sets the optical depth.' },
    { kind: 'fgen', title: 'Timing for stored light', text: 'The function generator gates both RF chains: it slices a probe pulse, switches the control off to store it and on again to retrieve it. Open “Pulsed storage” on the scope to run the sequence.' },
    { kind: 'psu', title: 'Quiet power for the detectors', text: 'A linear ±12 V supply feeds the probe and SAS photodiodes (amber cables). Switching supplies add ripple that lands straight on the EIT signal, so a linear one is used.' },
    { kind: 'pwrmeter', title: 'Know your powers', text: 'The optical power meter measures the beam after the isolator, at the pick-off, in each arm and before the cell. The split ratios and the control intensity are then measured, not assumed.' },
    { kind: 'scope', title: 'Record it', text: 'The oscilloscope has three inputs: CH1 the probe photodiode (BNC), CH2 the lock-box monitor, and EXT TRIG the function-generator sync. This is the real-bench counterpart of the scope panel under the 3D view.' }
  ];
  var tourI = -1;
  function tourComp(st) { var list = S.layout.components.filter(function (c) { return c.kind === st.kind; }); return list[st.nth || 0] || list[0] || null; }
  function tourShow(i) {
    var box = $('tour'); if (!box) return;
    if (i < 0 || i >= TOUR.length) { tourI = -1; box.hidden = true; return; }
    tourI = i; var st = TOUR[i], c = tourComp(st);
    box.hidden = false;
    box.innerHTML = '<div class="tour-h"><b>Tour ' + (i + 1) + ' / ' + TOUR.length + '</b><button type="button" class="btn" id="tourX" aria-label="Close tour">×</button></div><h5>' + esc(st.title) + '</h5><p>' + esc(st.text) + (c ? '' : ' <em>(this part is not on your bench right now)</em>') + '</p><div class="row"><button type="button" class="btn" id="tourP"' + (i === 0 ? ' disabled' : '') + '>← Back</button><button type="button" class="btn primary" id="tourN">' + (i === TOUR.length - 1 ? 'Finish' : 'Next →') + '</button></div>';
    $('tourX').onclick = function () { tourShow(-1); }; $('tourP').onclick = function () { tourShow(tourI - 1); }; $('tourN').onclick = function () { tourShow(tourI + 1); };
    if (c) { S.sel = c.id; syncMeshes(); renderInspector(); focusComp(c.id); }
  }

  /* ---- render loop ---- */
  var last = 0, raf = 0, drift = { v: 0, acc: 0, t: 0 };
  function stepDrift(dt) {
    if (!S.ev || !dt) return;
    var st = S.layout.state, d = st.drift_MHz || 0, lk = S.ev.lock.status, prev = d;
    drift.t += dt;
    if (lk === 'locked') d = d * Math.exp(-dt / 0.25);
    else if (lk === 'oscillating') d = 4 * Math.sin(2 * Math.PI * 2.5 * drift.t);
    else if (lk === 'runaway') d = d + (d >= 0 ? 1 : -1) * 40 * dt;
    else { drift.v += (Math.random() - 0.5) * 3 * Math.sqrt(dt) - drift.v * 0.2 * dt; d += drift.v * dt * (lk === 'weak' ? 0.3 : 1); if (lk === 'weak') d *= Math.exp(-dt / 6); }
    d = Math.max(-300, Math.min(300, d)); st.drift_MHz = d;
    drift.acc += Math.abs(d - prev);
    if (drift.acc > 0.15 || (lk === 'locked' && Math.abs(d) < 0.01 && Math.abs(prev) >= 0.01)) { drift.acc = 0; recompute(); updateUI(); updateInspectorLive(); pendingBeams = true; }
  }
  function loop() {
    if (raf || !G.ok) return;
    raf = requestAnimationFrame(frame);
  }
  var tmpV = null;
  function project(pos, el, w, h) {
    tmpV = tmpV || new THREE.Vector3(); tmpV.copy(pos).project(G.cam);
    var hide = tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05;
    el.style.display = hide ? 'none' : '';
    if (!hide) { el.style.transform = 'translate(-50%,-100%) translate(' + ((tmpV.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * h).toFixed(1) + 'px)'; }
  }
  function frame(t) {
    raf = 0;
    if (!G.visible || document.hidden) return;
    var dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    if (pendingBeams) { buildBeams(); pendingBeams = false; needRender = true; }
    if (G.fade < 1) { G.fade = Math.min(1, G.fade + dt / 0.28); beamMats(G.beamGroup, G.fade); if (G.old) { beamMats(G.old, 1 - G.fade); if (G.fade >= 1) { disposeGroup(G.old); G.scene.remove(G.old); G.old = null; } } needRender = true; }
    if (G.tween) {
      var k = 1 - Math.exp(-dt * 6.5);
      G.cam.position.lerp(G.tween.pos, k); G.ctr.target.lerp(G.tween.tgt, k); G.ctr.update();
      if (G.cam.position.distanceTo(G.tween.pos) < 1.5 && G.ctr.target.distanceTo(G.tween.tgt) < 1.5) G.tween = null;
      needRender = true;
    }
    G.compGroup.children.forEach(function (g) {
      var an = g.userData.anim;
      if (an) { an.t = Math.min(1, an.t + dt / 0.3); var e = 1 - Math.pow(1 - an.t, 3); g.rotation.y = an.from + (an.to - an.from) * e; if (an.t >= 1) g.userData.anim = null; needRender = true; }
      if (g.userData.pop !== undefined) { g.userData.pop = Math.min(1, g.userData.pop + dt / 0.28); var s = 1 - Math.pow(1 - g.userData.pop, 3); g.scale.setScalar(Math.max(0.05, s)); if (g.userData.pop >= 1) { delete g.userData.pop; g.scale.setScalar(1); } needRender = true; }
    });
    if (G.dots && G.dots.length && !reduceMotion && G.opt.cables) { var tt = t / 1000; G.dots.forEach(function (d) { var s = ((tt * 0.12 + d.ph) % 1) * d.len, i = 0; while (i < d.segs.length - 1 && s > d.segs[i].L) s -= d.segs[i++].L; var q = d.segs[i]; d.m.position.lerpVectors(q.p0, q.p1, Math.min(1, s / q.L)); }); needRender = true; }
    stepDrift(dt);
    if (!reduceMotion && G.opt.flow) { for (var i = 0; i < G.flow.length; i++) G.flow[i].tex.offset.y -= G.flow[i].speed * dt; if (G.flow.length) needRender = true; }
    if (G.ctr && G.ctr.enableDamping) G.ctr.update();
    if (needRender) {
      G.renderer.render(G.scene, G.cam); needRender = false;
      var r = G.stage.getBoundingClientRect(); G.cam.updateMatrixWorld();
      var far = G.cam.position.distanceTo(G.ctr.target) > 1700;
      for (var id in G.labels) { var Lb = G.labels[id]; if (Lb.minor && far && id !== S.sel) Lb.el.style.display = 'none'; else project(Lb.pos, Lb.el, r.width, r.height); }
      G.chips.forEach(function (c) { project(c.pos, c.el, r.width, r.height); });
      (G.zoneLabels || []).forEach(function (L) { projectZone(L, r.width, r.height); });
    }
    scopePhase += dt * 0.25; if ((S.scope === 'sweep' || S.scope === 'err') && !reduceMotion && Math.floor(t / 100) !== Math.floor((t - dt * 1000) / 100)) drawScope();
    loop();
  }
  function screenshot() {
    if (!G.ok) return;
    G.renderer.render(G.scene, G.cam);
    var a = document.createElement('a'); a.href = G.canvas.toDataURL('image/png'); a.download = 'rb87-eit-bench.png'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------------- toolbar, keys, scope controls ---------------- */
  function bind() {
    $('simReset').addEventListener('click', function () {
      S.layout = refLayout(); S.sel = null; S.store = null; S.scope = S.scope === 'store' ? 'sweep' : S.scope;
      if (G.ok) { G.prevRot = {}; G.known = {}; G.opt.filter = 'all'; $('simFilter').value = 'all'; tourShow(-1); }
      var hb = $('hintBox'); if (hb) hb.hidden = true;
      changed(true); renderInspector(); setView('3d');
    });
    $('simClear').addEventListener('click', function () { S.layout = { mode: 'A', components: [], state: { locked: false, tau_us: 20, storageRan: false } }; S.sel = null; S.store = null; changed(true); });
    $('simHint').addEventListener('click', showHint);
    var rb = $('simRestore'), sv = loadSaved();
    if (sv && sv.components && sv.components.length) { rb.hidden = false; rb.addEventListener('click', function () { var s2 = loadSaved(); if (s2 && s2.components) { S.layout = s2; S.layout.mode = 'A'; S.layout.state = S.layout.state || { locked: false, tau_us: 20 }; S.sel = null; S.store = null; changed(true); } }); }
    $('simLabels').addEventListener('click', function (e) { S.labels = !S.labels; e.currentTarget.setAttribute('aria-pressed', S.labels ? 'true' : 'false'); syncMeshes(); });
    $('simTop').addEventListener('click', function () { setView('top'); });
    $('simPersp').addEventListener('click', function () { setView('3d'); });
    $('simFront').addEventListener('click', function () { setView('front'); });
    $('simSource').addEventListener('click', function () { setView('source'); });
    $('simSas').addEventListener('click', function () { setView('sas'); });
    $('simCellV').addEventListener('click', function () { setView('cell'); });
    $('simFocus').addEventListener('click', function () { if (S.sel) focusComp(S.sel); else showMsg('Select a component first'); });
    $('simFilter').addEventListener('change', function (e) { G.opt.filter = e.target.value; syncMeshes(); });
    $('simTour').addEventListener('click', function () { if (!G.ok) return; if (tourI >= 0) tourShow(-1); else tourShow(0); });
    function toggle(id, key, after) { $(id).addEventListener('click', function (e) { G.opt[key] = !G.opt[key]; e.currentTarget.setAttribute('aria-pressed', G.opt[key] ? 'true' : 'false'); if (after) after(); requestRender(); }); }
    toggle('simCut', 'cutaway', function () { syncMeshes(); });
    toggle('simZones', 'zones', function () { if (G.zoneGroup) G.zoneGroup.visible = G.opt.zones; (G.zoneLabels || []).forEach(function (L) { L.el.hidden = !G.opt.zones; }); });
    toggle('simCables', 'cables', function () { if (G.cableGroup) G.cableGroup.visible = G.opt.cables; $('cableLegend').hidden = !G.opt.cables; });
    toggle('simInfo', 'info', function () { pendingBeams = true; });
    toggle('simFlow', 'flow');
    $('simShot').addEventListener('click', screenshot);
    $('scSweep').addEventListener('click', function () { setScope('sweep'); });
    $('scStore').addEventListener('click', function () { setScope('store'); });
    $('scErr').addEventListener('click', function () { setScope('err'); });
    $('scTau').addEventListener('input', function (e) { S.layout.state.tau_us = +e.target.value; $('scTauO').textContent = e.target.value + ' µs'; S.store = null; drawScope(); });
    $('scRun').addEventListener('click', function () {
      var ev = S.ev; if (!(ev.objectives[8] && ev.fgen)) { S.store = null; drawScope(); return; }
      S.store = P.storageModel(ev.cell.eff, S.layout.state.tau_us);
      S.layout.state.storageRan = S.store.eta > 0.01;
      recompute(); updateUI(); saveSoon();
    });
    var simRoot = $('sim');
    simRoot.addEventListener('keydown', function (e) {
      var tg = e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (e.target !== $('simCanvas') && !$('inspector').contains(e.target)) return;
      if (!S.sel) return;
      var c = comp(S.sel); if (!c) return;
      if (e.key === 'r' || e.key === 'R') { rotate(c.id, e.shiftKey ? -1 : 1); e.preventDefault(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { delComp(c.id); e.preventDefault(); }
      else if (e.key === 'Escape') { S.sel = null; syncMeshes(); renderInspector(); }
      else if (e.target === $('simCanvas') && /^Arrow/.test(e.key)) {
        var dx = e.key === 'ArrowLeft' ? -25 : e.key === 'ArrowRight' ? 25 : 0, dz = e.key === 'ArrowUp' ? -25 : e.key === 'ArrowDown' ? 25 : 0;
        var nx = c.x + dx, nz = c.z + dz;
        if (nx >= 25 && nx <= K.table.w - 25 && nz >= 25 && nz <= K.table.d - 25 && !occupied(nx, nz, c.id)) { c.x = nx; c.z = nz; changed(true); }
        e.preventDefault();
      }
    });
    window.addEventListener('resize', function () { drawScope(); });
  }

  function applyModeUI() {
    $('simNote').innerHTML = CFG.note || 'Zeeman EIT (Zeeman Λ, two double-pass AOMs). Guide: <a href="index.html#p4">architecture</a> · <a href="index.html#p3">physics</a>.';
    buildPalette();
    var hb = $('hintBox'); if (hb) hb.hidden = true;
  }

  function start() {
    buildPalette(); bind(); applyModeUI();
    recompute(); renderInspector(); updateUI();
    try { initThree(); } catch (e) { console.error(e); var m = $('stageMsg'); m.classList.add('show'); m.textContent = '3D view failed to start: ' + e.message; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

