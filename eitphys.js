/* ==========================================================================
   EITPhys — pure logic (no DOM, no THREE). Jones calculus, Λ-EIT
   susceptibility, illustrative cell model, 2-D beam tracer, objectives.
   Units: lengths mm (table), powers mW, frequencies kHz unless stated.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------- constants ---------------- */
  var K = {
    zeeman_kHz_per_mG: 0.70,       // |g_F| mu_B / h for 5S1/2 F=2 (and F=1): 0.70 MHz/G = 0.70 kHz/mG
    lambdaShift_kHz_per_mG: 1.40,  // m_F=2 <-> m_F=0 splitting = 2 x 0.70 kHz/mG
    pbsLeak: 1e-3,                 // typical PBS extinction (paper Sec. V B)
    glanLeak: 1e-5,                // Glan-Taylor extinction (paper Sec. V B)
    isolatorBack: 1e-4,            // dual-stage fibre isolator, 40 dB = catalogue minimum (typical 50-55 dB), illustrative
    isolatorFwd: 0.80,             // about 1 dB isolator loss plus connectors, illustrative
    mirrorR: 0.98,                 // illustrative protected-silver reflectance
    pickoffR: 0.04,                // ~4 % Fresnel reflection, uncoated glass
    controlWaist_cm: 0.255,        // 1/e^2 radius 2.55 mm (paper Fig. 10c control beam)
    probeWaist_mm: 0.75,           // illustrative (planned collimator gives a ~1.5 mm waist)
    vth_ms_60C: 178,               // 1-D rms thermal speed of 87Rb at 333 K, sqrt(kT/m)
    earthResidual_mG: 450,         // illustrative unshielded residual field along the axis
    fitW0_kHz: 1.5,                // empirical intercept, linear fit to paper's two points
    fitSlope_kHz_per_mWcm2: 4.452, // (26-7.3)/(5.5-1.3)
    od_ref: 10, T_ref_C: 60,       // OD ~10 at ~60 C (paper, Fig. 10c conditions)
    hfs_kHz: 6834682.61,           // 87Rb ground hyperfine splitting (Steck: 6.834 682 610 904 GHz)
    clockQuad_kHz_per_mG2: 5.75e-7,// ~575 Hz/G^2 clock-transition quadratic Zeeman shift (verify vs Steck)
    lineWindow_kHz: 300000,        // a spectral component within ±300 MHz of a D1 line counts as "on the line"
    eomLoss: 0.8,                  // illustrative EOM insertion transmission
    eomVpi_V: 3.0,                 // illustrative Vπ at 6.8 GHz (read your EOM datasheet)
    dopplerSigma_MHz: 224,         // 1-D Doppler width sigma/2pi at 60 C (design estimate)
    eitDetuneScale_MHz: 50,        // ILLUSTRATIVE: EIT contrast fades as the one-photon detuning grows
    sasWidth_MHz: 12,              // ILLUSTRATIVE width of a sub-Doppler SAS feature (error-signal plot only)
    beamHeight: 40,
    aomAngle_deg: 8,               // ILLUSTRATIVE: exaggerated 1st-order deflection so the orders separate on screen (real: tens of mrad)
    table: { w: 2400, d: 1600, pitch: 25 }   // 2.4 m x 1.6 m optical table (drawn generously, for illustration)
  };

  /* ---------------- complex helpers ---------------- */
  function C(re, im) { return { re: re, im: im || 0 }; }
  function cadd(a, b) { return C(a.re + b.re, a.im + b.im); }
  function csub(a, b) { return C(a.re - b.re, a.im - b.im); }
  function cmul(a, b) { return C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cdiv(a, b) { var d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); }
  function cconj(a) { return C(a.re, -a.im); }
  function cabs2(a) { return a.re * a.re + a.im * a.im; }
  function cscale(a, s) { return C(a.re * s, a.im * s); }

  /* ---------------- Jones calculus ----------------
     Basis for a ray travelling along d (in table plane): h = y x d (horizontal, in plane),
     v = y (vertical). Waveplate axis angle theta measured from h toward v.            */
  function J(h, v) { return { h: h, v: v }; }
  var H = function () { return J(C(1), C(0)); };
  var V = function () { return J(C(0), C(1)); };
  function jPower(j) { return cabs2(j.h) + cabs2(j.v); }
  function jNorm(j) { var p = jPower(j); if (p <= 0) return H(); var s = 1 / Math.sqrt(p); return J(cscale(j.h, s), cscale(j.v, s)); }
  function mApply(M, j) { return J(cadd(cmul(M[0][0], j.h), cmul(M[0][1], j.v)), cadd(cmul(M[1][0], j.h), cmul(M[1][1], j.v))); }
  function rad(d) { return d * Math.PI / 180; }
  function hwpMatrix(thetaDeg) { var t = 2 * rad(thetaDeg); return [[C(Math.cos(t)), C(Math.sin(t))], [C(Math.sin(t)), C(-Math.cos(t))]]; }
  function qwpMatrix(thetaDeg) {
    var c = Math.cos(rad(thetaDeg)), s = Math.sin(rad(thetaDeg));
    // R(-t) diag(1, i) R(t)
    return [[C(c * c, s * s), C(c * s, -c * s)], [C(c * s, -c * s), C(s * s, c * c)]];
  }
  function stokes(j) {
    var p = jPower(j) || 1;
    var hv = cmul(cconj(j.h), j.v);
    return { s1: (cabs2(j.h) - cabs2(j.v)) / p, s2: 2 * hv.re / p, s3: 2 * hv.im / p };
  }
  function polLabel(j) {
    var s = stokes(j);
    if (Math.abs(s.s3) > 0.9) return s.s3 > 0 ? 'circular (+)' : 'circular (−)';
    if (Math.abs(s.s3) < 0.1) {
      var ang = 0.5 * Math.atan2(s.s2, s.s1) * 180 / Math.PI;
      if (Math.abs(ang) < 3) return 'linear H';
      if (Math.abs(Math.abs(ang) - 90) < 3) return 'linear V';
      return 'linear ' + ang.toFixed(0) + '°';
    }
    return 'elliptical (S3=' + s.s3.toFixed(2) + ')';
  }

  /* ---------------- Λ-EIT susceptibility (Finkelstein et al., Eq. 13) -------------
     f(δ) = W Γ12 / (Γ12 Γ13 + |Ωc|²), Γ12 = γ12 − iδ, Γ13 = W − iΔ1, control on resonance
     so Δ1 = δ. All quantities in the same (kHz, "/2π") units. Intensity transmission
     T = exp(−OD Re f); probe phase φ = −(OD/2) Im f.  W = effective optical width.      */
  function eitResponse(delta, p) {
    var g12 = C(p.gamma12, -delta);
    var g13 = C(p.W, -delta);
    var den = cadd(cmul(g12, g13), C(p.omega * p.omega));
    var f = cdiv(cmul(C(p.W), g12), den);
    return { T: Math.exp(-p.OD * f.re), phase: -0.5 * p.OD * f.im, absorb: f.re }; // field factor exp[-(OD/2) f]
  }
  function gammaEIT(p) { return p.gamma12 + p.omega * p.omega / p.W; } // HWHM, kHz

  /* ---------------- vapour (design estimate) ----------------
     Vapour-pressure fit as commonly quoted in Steck's data sheets (Nesmeyanov):
     solid  log10 P[Torr] = 2.881 + 4.857 − 4215/T ; liquid 2.881 + 4.312 − 4040/T
     (melting point 312.46 K). OD is scaled from OD≈10 at 60 °C (paper Fig. 10c).      */
  function rbPressureTorr(Tc) {
    var T = Tc + 273.15;
    var l = T < 312.46 ? (2.881 + 4.857 - 4215 / T) : (2.881 + 4.312 - 4040 / T);
    return Math.pow(10, l);
  }
  function numberDensity_cm3(Tc) { var T = Tc + 273.15; return rbPressureTorr(Tc) * 133.322 / (1.380649e-23 * T) * 1e-6; }
  function odFromTemp(Tc) { return K.od_ref * numberDensity_cm3(Tc) / numberDensity_cm3(K.T_ref_C); }

  /* ---------------- illustrative cell model ---------------- */
  function cellModel(o) {
    // o: {Ic (mW/cm2), buffer, shield, heater, T_C, solenoid, B_mG}
    var Tc = o.heater ? o.T_C : 22;
    var OD = odFromTemp(Tc);
    var transitFWHM = 2 * (K.vth_ms_60C / (K.probeWaist_mm * 1e-3)) * Math.LN2 / (2 * Math.PI) / 1e3; // kHz, paper eq.(38) text
    var floor = K.fitW0_kHz + (o.buffer ? 0 : transitFWHM) + (o.shield ? 0 : 40);
    var fwhm = floor + K.fitSlope_kHz_per_mWcm2 * Math.max(0, o.Ic);
    var contrast = 1 - floor / fwhm;
    if (!o.shield) contrast *= 0.5; // transverse residual fields mix sublevels (illustrative)
    var Beff = (o.solenoid ? o.B_mG : 0) + (o.shield ? 0 : K.earthResidual_mG);
    var T2_us = o.buffer ? (o.shield ? 200 : 20) : (K.probeWaist_mm * 1e-3 / K.vth_ms_60C) * 1e6;
    return { OD: OD, Tc: Tc, n: numberDensity_cm3(Tc), fwhm: fwhm, floor: floor, contrast: contrast, Beff: Beff, T2_us: T2_us, transitFWHM: transitFWHM };
  }
  function lorentz(d, fwhm) { var x = 2 * d / fwhm; return 1 / (1 + x * x); }
  function probeT(delta, m) { return Math.exp(-m.OD * (1 - m.contrast * lorentz(delta, m.fwhm))); }
  function storageModel(m, tau_us) {
    var odE = m.OD * m.contrast;
    var g = 2 * Math.PI * (m.fwhm / 2) * 1e3;                 // rad/s
    var delay_us = odE / g * 1e6;                             // paper: τ = OD_EIT / γ_EIT
    var bw = g / Math.sqrt(Math.max(odE, 1));                 // rad/s, B ~ γ_EIT/√OD_EIT
    var Tp_us = Math.max(2, 2 / bw * 1e6);
    var eta0 = 0.5 * (1 - 1 / (1 + 0.2 * odE));               // ILLUSTRATIVE ONLY
    var eta = eta0 * Math.exp(-tau_us / m.T2_us);
    var leak = Math.min(0.6, 0.15 * Tp_us / Math.max(delay_us, 1e-3));
    return { odE: odE, delay_us: delay_us, Tp_us: Tp_us, eta0: eta0, eta: eta, leak: leak, T2_us: m.T2_us };
  }

  /* ---------------- component catalogue ---------------- */
  var KINDS = {
    laser:   { name: 'DFB laser 795 nm (PM-fibre pigtail)', short: 'DFB', cap: 14, rotStep: 90 },
    isolator:{ name: 'Fibre isolator + collimator (dual-stage, PM)', short: 'ISO', cap: 12, rotStep: 90 },
    mirror:  { name: 'Mirror', short: 'M', cap: 12, rotStep: 45 },
    pbs:     { name: 'PBS cube', short: 'PBS', cap: 12, rotStep: 90 },
    npbs:    { name: 'NPBS 50:50 cube', short: 'BS', cap: 12, rotStep: 90 },
    pickoff: { name: 'Glass pick-off window', short: 'PO', cap: 12, rotStep: 45 },
    hwp:     { name: 'Half-wave plate', short: 'λ/2', cap: 12, rotStep: 90 },
    qwp:     { name: 'Quarter-wave plate', short: 'λ/4', cap: 12, rotStep: 90 },
    aom:     { name: 'AOM (+RF driver)', short: 'AOM', cap: 12, rotStep: 90 },
    lens:    { name: 'Lens', short: 'L', cap: 12, rotStep: 90 },
    iris:    { name: 'Iris', short: 'IR', cap: 12, rotStep: 90 },
    nd:      { name: 'ND filter', short: 'ND', cap: 12, rotStep: 90 },
    cell:    { name: 'Rb-87 vapour cell', short: 'Rb', cap: 12, rotStep: 90 },
    sas:     { name: 'SAS photodiode (reference PD)', short: 'SPD', cap: 12, rotStep: 90 },
    refcell: { name: 'Rb reference cell (SAS)', short: 'RC', cap: 12, rotStep: 90 },
    glan:    { name: 'Glan-Taylor polariser', short: 'GT', cap: 12, rotStep: 90 },
    pd:      { name: 'Photodiode detector', short: 'PD', cap: 12, rotStep: 90 },
    dump:    { name: 'Beam dump', short: 'BD', cap: 12, rotStep: 90 },
    eom:     { name: 'Fibre EOM (~6.834 GHz)', short: 'EOM', cap: 12, rotStep: 90 },
    fp:      { name: 'Scanning Fabry–Pérot', short: 'FP', cap: 14, rotStep: 90 },
    lctrl:   { name: 'Laser controller (current + TEC)', short: 'LDC', cap: 0, rotStep: 90 },
    lockbox: { name: 'Lock box (lock-in + PID)', short: 'PID', cap: 0, rotStep: 90 },
    fgen:    { name: 'Dual-ch. function generator', short: 'FG', cap: 0, rotStep: 90 },
    rfgen:   { name: 'Dual-ch. RF source (phase-locked)', short: 'RFG', cap: 0, rotStep: 90 },
    rfatt:   { name: 'RF attenuator / switch', short: 'ATT', cap: 0, rotStep: 90 },
    rfamp:   { name: 'RF power amplifier', short: 'AMP', cap: 0, rotStep: 90 },
    csrc:    { name: 'Coil current source', short: 'CSR', cap: 0, rotStep: 90 },
    tctrl:   { name: 'Cell temperature controller', short: 'TC', cap: 0, rotStep: 90 },
    scope:   { name: 'Oscilloscope / DAQ', short: 'DAQ', cap: 0, rotStep: 90 },
    pwrmeter:{ name: 'Optical power meter', short: 'PWR', cap: 0, rotStep: 90 },
    psu:     { name: 'Low-noise power supply (±12 V)', short: 'PSU', cap: 0, rotStep: 90 }
  };
  function defaultParams(kind) {
    switch (kind) {
      case 'laser': return { power: 10 };
      case 'hwp': return { axis: 0 };
      case 'qwp': return { axis: 45 };
      case 'aom': return { rf: true, fMHz: 80, eff: 0.6, mode: 'single', order: 1 };
      case 'iris': return { ap: 2 };
      case 'nd': return { od: 1 };
      case 'cell': return { heater: true, T_C: 60, solenoid: true, B_mG: 50, shield: true, buffer: true };
      case 'glan': return { axis: 0 };
      case 'fgen': return { on: true };
      case 'eom': return { rf: true, fMHz: 6834.683, dBm: 5 };
      case 'lctrl': return { dither: true, ditherMHz: 0.5 };
      case 'lockbox': return { method: 'lockin', sign: 1, gain: 1 };
      default: return {};
    }
  }

  /* ---------------- geometry helpers ---------------- */
  function dirOf(deg) { var r = rad(deg); var x = Math.cos(r), z = Math.sin(r); if (Math.abs(x) < 1e-12) x = 0; if (Math.abs(z) < 1e-12) z = 0; return [x, z]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function norm2(a) { var l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }
  function rot2(a, deg) { var r = rad(deg), c = Math.cos(r), s = Math.sin(r); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; }
  function reflect(d, n) { var k = 2 * dot(d, n); return norm2([d[0] - k * n[0], d[1] - k * n[1]]); }
  function effAxis(comp, d, axis) { return dot(d, dirOf(comp.rot)) >= 0 ? axis : -axis; }

  /* ---------------- phase modulation (EOM) ----------------
     E0 exp[i(ωt + β sin Ωt)] = E0 Σ_n J_n(β) exp[i(ω + nΩ)t]  → sideband n carries J_n(β)² of the power */
  function besselJ(n, x) {
    var an = Math.abs(n), sum = 0, fact = function (k) { var f = 1; for (var i = 2; i <= k; i++) f *= i; return f; };
    for (var k = 0; k < 40; k++) { var t = Math.pow(-1, k) / (fact(k) * fact(k + an)) * Math.pow(x / 2, 2 * k + an); sum += t; if (k > 4 && Math.abs(t) < 1e-16) break; }
    return (n < 0 && an % 2) ? -sum : sum;
  }
  function betaFromDbm(dBm, vpi) { var Pw = Math.pow(10, dBm / 10) / 1000; return Math.PI * Math.sqrt(2 * 50 * Pw) / (vpi || K.eomVpi_V); }
  function modulateSpec(spec, beta, fmod_kHz, mfrac) {
    var map = {};
    function add(df, w) { var k = Math.round(df * 1000) / 1000; map[k] = (map[k] || 0) + w; }
    spec.forEach(function (sc) {
      for (var n = -3; n <= 3; n++) { var Jn = besselJ(n, beta); add(sc.df + n * fmod_kHz, sc.w * mfrac * Jn * Jn); }
      add(sc.df, sc.w * (1 - mfrac));
    });
    var out = [], tot = 0;
    Object.keys(map).forEach(function (k) { if (map[k] > 1e-7) { out.push({ df: +k, w: map[k] }); tot += map[k]; } });
    out.forEach(function (q) { q.w /= tot; });
    return out.sort(function (a, b) { return a.df - b.df; });
  }
  function specT(list, fabs) { for (var i = 0; i < list.length; i++) if (Math.abs(list[i].f - fabs) < 1) return list[i].T; return 1; }

  /* ---------------- tracer ---------------- */
  var uid = 0;
  function newRay(o, d, j, P, f, extra) {
    var r = { o: o, d: norm2(d), J: jNorm(j), P: P, f: f, spec: [{ df: 0, w: 1 }], aoms: [], pbs: [], pulsed: false, depth: 0, lastId: null, path: [], first: null, id: ++uid };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function child(ray, d, j, P, df, comp) {
    var r = newRay(null, d, j, P, ray.f + (df || 0));
    r.spec = ray.spec; r.aoms = ray.aoms.slice(); r.pbs = ray.pbs.slice(); r.pulsed = ray.pulsed; r.depth = ray.depth + 1;
    r.lastId = comp ? comp.id : null; r.path = ray.path.concat(comp ? [comp.id] : []); r.fromLaser = ray.fromLaser;
    return r;
  }

  function findHit(ray, comps) {
    var best = null, bestT = Infinity;
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i]; var cap = KINDS[c.kind].cap; if (!cap) continue;
      if (c.id === ray.lastId) continue;
      var rel = [c.x - ray.o[0], c.z - ray.o[1]];
      var t = dot(rel, ray.d); if (t < 0.5) continue;
      var perp = Math.abs(rel[0] * ray.d[1] - rel[1] * ray.d[0]);
      if (perp > cap) continue;
      if (t < bestT) { bestT = t; best = c; best._perp = perp; }
    }
    return best ? { comp: best, t: bestT, perp: best._perp } : null;
  }
  function edgeT(ray) {
    var W = K.table.w, D = K.table.d, t = Infinity, o = ray.o, d = ray.d;
    if (d[0] > 1e-9) t = Math.min(t, (W - o[0]) / d[0]); else if (d[0] < -1e-9) t = Math.min(t, (0 - o[0]) / d[0]);
    if (d[1] > 1e-9) t = Math.min(t, (D - o[1]) / d[1]); else if (d[1] < -1e-9) t = Math.min(t, (0 - o[1]) / d[1]);
    return Math.max(0, t);
  }
  function groupKey(ray) { return ray.aoms.length ? ray.aoms.slice().sort().join('+') : 'direct'; }

  function trace(layout, opts) {
    opts = opts || {};
    var comps = layout.components, st = layout.state || {};
    var cellT = opts.cellT || {};           // groupKey -> transmission factor
    var fgen = comps.filter(function (c) { return c.kind === 'fgen' && c.params.on; })[0];
    var res = { segments: [], cellHits: {}, pd: {}, pdSpec: {}, fp: {}, eomIn: null, sas: {}, warnings: [], laserFirst: null, backToLaser: 0, edgeExits: 0, rays: 0 };
    var queue = [];
    comps.forEach(function (c) {
      if (c.kind !== 'laser') return;
      var d = dirOf(c.rot);
      var r = newRay([c.x + d[0] * 15, c.z + d[1] * 15], d, H(), c.params.power, 0);
      r.lastId = c.id; r.fromLaser = c.id; r.isPrimary = true;
      queue.push(r);
    });
    var MIN_P = 1e-7, MAX_DEPTH = 40, MAX_SEG = 900;
    while (queue.length && res.segments.length < MAX_SEG) {
      var ray = queue.shift(); res.rays++;
      if (ray.P < MIN_P || ray.depth > MAX_DEPTH) continue;
      var hit = findHit(ray, comps);
      var te = edgeT(ray);
      if (!hit || hit.t > te) {
        var e = [ray.o[0] + ray.d[0] * te, ray.o[1] + ray.d[1] * te];
        res.segments.push(seg(ray, ray.o, e, true)); res.edgeExits++;
        if (ray.isPrimary && !res.laserFirst) res.laserFirst = { kind: null };
        continue;
      }
      var hp = [ray.o[0] + ray.d[0] * hit.t, ray.o[1] + ray.d[1] * hit.t];
      res.segments.push(seg(ray, ray.o, hp, false));
      var c = hit.comp;
      if (ray.isPrimary && !res.laserFirst) res.laserFirst = { kind: c.kind, forward: c.kind === 'isolator' ? dot(ray.d, dirOf(c.rot)) > 0.5 : false, id: c.id };
      var outs = interact(c, ray, hit, res, cellT, fgen);
      for (var i = 0; i < outs.length; i++) { outs[i].o = hp; if (outs[i].P >= MIN_P) queue.push(outs[i]); }
    }
    if (res.backToLaser > 1e-3) res.warnings.push('Back-reflection into laser (' + fmtP(res.backToLaser) + ') — add an isolator');
    return res;
  }
  function seg(ray, a, b, toEdge) {
    return { a: a.slice(), b: b.slice(), P: ray.P, f: ray.f, spec: ray.spec, J: ray.J, key: groupKey(ray), pulsed: ray.pulsed, toEdge: toEdge, d: ray.d.slice() };
  }

  function interact(c, ray, hit, res, cellT, fgen) {
    var d = ray.d, f = dirOf(c.rot), p = c.params, out = [], fd = dot(d, f), j = ray.J;
    switch (c.kind) {
      case 'laser':
        if (fd < -0.5) res.backToLaser += ray.P;
        return out;
      case 'isolator':
        if (fd > 0.5) { var ph = cabs2(j.h); out.push(child(ray, d, J(C(Math.SQRT1_2), C(Math.SQRT1_2)), ray.P * ph * K.isolatorFwd, 0, c)); }
        else if (fd < -0.5) { out.push(child(ray, d, j, ray.P * K.isolatorBack, 0, c)); }
        return out;
      case 'mirror': {
        var n = f; if (Math.abs(dot(d, n)) < 0.05) return out;
        out.push(child(ray, reflect(d, n), J(j.h, cscale(j.v, -1)), ray.P * K.mirrorR, 0, c));
        return out;
      }
      case 'pickoff': {
        var n2 = f; if (Math.abs(dot(d, n2)) < 0.05) return out;
        out.push(child(ray, d, j, ray.P * (1 - K.pickoffR), 0, c));
        out.push(child(ray, reflect(d, n2), J(j.h, cscale(j.v, -1)), ray.P * K.pickoffR, 0, c));
        return out;
      }
      case 'pbs': case 'npbs': {
        var s = dirOf(c.rot + 45), nn = [-s[1], s[0]];
        var dr = reflect(d, nn);
        if (c.kind === 'npbs') {
          out.push(child(ray, d, j, ray.P * 0.5, 0, c));
          out.push(child(ray, dr, J(j.h, cscale(j.v, -1)), ray.P * 0.5, 0, c));
          return out;
        }
        var eps = Math.sqrt(K.pbsLeak);
        var jt = J(j.h, cscale(j.v, eps)), pt = ray.P * jPower(jt);
        var pr = ray.P * cabs2(j.v);
        var rt = child(ray, d, jt, pt, 0, c); rt.pbs.push({ id: c.id, port: 'T' });
        var rr = child(ray, dr, V(), pr, 0, c); rr.pbs.push({ id: c.id, port: 'R' });
        out.push(rt, rr);
        return out;
      }
      case 'hwp': out.push(child(ray, d, mApply(hwpMatrix(effAxis(c, d, p.axis)), j), ray.P, 0, c)); return out;
      case 'qwp': out.push(child(ray, d, mApply(qwpMatrix(effAxis(c, d, p.axis)), j), ray.P, 0, c)); return out;
      case 'aom': {
        if (p.mode !== 'double' && fd < -0.7) { // returning pass of a double-pass built from separate parts
          var onR = !!p.rf, etaR = onR ? p.eff : 0, d1 = rot2(f, -K.aomAngle_deg * p.order);
          if (dot(d, [-d1[0], -d1[1]]) > 0.9995) { // anti-parallel to the deflected order: diffracts back onto the input axis
            out.push(child(ray, d, j, ray.P * (1 - etaR), 0, c));
            if (onR) { var rr = child(ray, [-f[0], -f[1]], j, ray.P * etaR, p.order * p.fMHz * 1000, c); rr.aoms.push(c.id); if (fgen) rr.pulsed = true; out.push(rr); }
          }
          return out;
        }
        if (fd < 0.7) return out; // only accepts light entering along its axis
        var on = !!p.rf, eta = on ? p.eff : 0, fs = p.order * p.fMHz * 1000;
        if (p.mode === 'double') {
          if (!on) return out; // 0th order is blocked inside the cat's-eye module
          var r = child(ray, [-d[0], -d[1]], J(j.v, j.h), ray.P * eta * eta, 2 * fs, c);
          r.aoms.push(c.id); if (fgen) r.pulsed = true; out.push(r);
          return out;
        }
        out.push(child(ray, d, j, ray.P * (1 - eta), 0, c));
        if (on) { var r1 = child(ray, rot2(d, -K.aomAngle_deg * p.order), j, ray.P * eta, fs, c); r1.aoms.push(c.id); if (fgen) r1.pulsed = true; out.push(r1); }
        return out;
      }
      case 'lens': out.push(child(ray, d, j, ray.P * 0.99, 0, c)); return out;
      case 'refcell': out.push(child(ray, d, j, ray.P * 0.9, 0, c)); return out;
      case 'iris': if (hit.perp <= p.ap / 2) out.push(child(ray, d, j, ray.P, 0, c)); return out;
      case 'nd': out.push(child(ray, d, j, ray.P * Math.pow(10, -p.od), 0, c)); return out;
      case 'eom': {
        if (Math.abs(fd) < 0.7) return out;
        var beta = p.rf ? betaFromDbm(p.dBm) : 0, mfrac = cabs2(j.h); // only the field along the crystal axis (H) is modulated
        if (!res.eomIn || ray.P > res.eomIn.P) res.eomIn = { P: ray.P, hFrac: mfrac, beta: beta, id: c.id };
        var re = child(ray, d, j, ray.P * K.eomLoss, 0, c);
        if (beta > 0) re.spec = modulateSpec(ray.spec, beta, p.fMHz * 1000, mfrac);
        out.push(re); return out;
      }
      case 'fp': {
        var rec = res.fp[c.id] || (res.fp[c.id] = { P: 0, comps: {} });
        rec.P += ray.P;
        ray.spec.forEach(function (sc) { var key = Math.round(ray.f + sc.df); rec.comps[key] = (rec.comps[key] || 0) + ray.P * sc.w; });
        return out;
      }
      case 'cell': {
        var key = groupKey(ray);
        var h = res.cellHits[key] || (res.cellHits[key] = { P: 0, J: ray.J, f: ray.f, d: d.slice(), o: ray.o.slice(), maxP: 0, pbs: ray.pbs, aoms: ray.aoms, pulsed: ray.pulsed });
        h.P += ray.P; if (ray.P > h.maxP) { h.maxP = ray.P; h.J = ray.J; h.f = ray.f; h.d = d.slice(); h.o = ray.o.slice(); h.pbs = ray.pbs; h.aoms = ray.aoms; }
        if (!h.spec || ray.P >= h.maxP) h.spec = ray.spec;
        if (cellT.spec) {
          var tot = 0, ns = ray.spec.map(function (sc) { var T1 = specT(cellT.spec, ray.f + sc.df); tot += sc.w * T1; return { df: sc.df, w: sc.w * T1 }; });
          var rc = child(ray, d, j, ray.P * tot, 0, c); rc.spec = tot > 0 ? ns.map(function (q) { return { df: q.df, w: q.w / tot }; }) : ray.spec; out.push(rc);
          return out;
        }
        var T = (key in cellT) ? cellT[key] : 1;
        out.push(child(ray, d, j, ray.P * T, 0, c));
        return out;
      }
      case 'glan': {
        var a = effAxis(c, d, p.axis), ea = [Math.cos(rad(a)), Math.sin(rad(a))];
        var A = cadd(cscale(j.h, ea[0]), cscale(j.v, ea[1]));
        var B = cadd(cscale(j.h, -ea[1]), cscale(j.v, ea[0]));
        var pa = cabs2(A), pb = cabs2(B);
        out.push(child(ray, d, J(C(ea[0]), C(ea[1])), ray.P * (pa + K.glanLeak * pb), 0, c));
        out.push(child(ray, rot2(d, 90), J(C(-ea[1]), C(ea[0])), ray.P * pb * (1 - K.glanLeak), 0, c));
        return out;
      }
      case 'pd': {
        var k2 = groupKey(ray); res.pd[c.id] = res.pd[c.id] || {}; res.pd[c.id][k2] = (res.pd[c.id][k2] || 0) + ray.P;
        var ps = res.pdSpec[c.id] || (res.pdSpec[c.id] = {});
        ray.spec.forEach(function (sc) { var kk = Math.round(ray.f + sc.df); ps[kk] = (ps[kk] || 0) + ray.P * sc.w; });
        return out;
      }
      case 'sas': res.sas[c.id] = (res.sas[c.id] || 0) + ray.P; return out;
      default: return out; // dump, fgen
    }
  }
  function fmtP(mW) {
    if (mW >= 1) return mW.toFixed(2) + ' mW';
    if (mW >= 1e-3) return (mW * 1e3).toFixed(1) + ' µW';
    return (mW * 1e6).toFixed(1) + ' nW';
  }

  /* ---------------- cell physics from a trace ---------------- */
  function analyseCell(layout, tr) {
    var cell = layout.components.filter(function (c) { return c.kind === 'cell'; })[0];
    var st = layout.state || {};
    var out = { cell: cell, groups: [], control: null, probe: null, overlap: false, orth: false, ok: false, cellT: {} };
    if (!cell) return out;
    var axis = dirOf(cell.rot);
    var keys = Object.keys(tr.cellHits);
    var gs = keys.map(function (k) { var h = tr.cellHits[k]; return { key: k, P: h.P, J: h.J, f: h.f, d: h.d, o: h.o, pbs: h.pbs, aoms: h.aoms, pulsed: h.pulsed }; })
      .filter(function (g) { return g.P > 1e-6; })
      .sort(function (a, b) { return b.P - a.P; });
    out.groups = gs;
    var p = cell.params;
    var ctrl = gs[0] || null, prb = gs[1] || null;
    var Ic = ctrl ? 2 * ctrl.P / (Math.PI * K.controlWaist_cm * K.controlWaist_cm) : 0;
    var m = cellModel({ Ic: Ic, buffer: p.buffer, shield: p.shield, heater: p.heater, T_C: p.T_C, solenoid: p.solenoid, B_mG: p.B_mG });
    var df = detuneFactors(st.drift_MHz); m.OD *= df.od; m.contrast *= df.c; out.drift = st.drift_MHz || 0;
    out.model = m; out.Ic = Ic;
    var locked = !!st.locked;
    if (ctrl && prb) {
      var co = dot(ctrl.d, prb.d) > 0.999;
      var dperp = Math.abs((prb.o[0] - ctrl.o[0]) * ctrl.d[1] - (prb.o[1] - ctrl.o[1]) * ctrl.d[0]);
      out.overlap = co && dperp < 1.0;
      var hc = stokes(ctrl.J).s3 * Math.sign(dot(ctrl.d, axis) || 1);
      var hp = stokes(prb.J).s3 * Math.sign(dot(prb.d, axis) || 1);
      out.hc = hc; out.hp = hp;
      out.orth = Math.abs(hc) > 0.9 && Math.abs(hp) > 0.9 && hc * hp < 0;
      out.control = ctrl; out.probe = prb;
      // two-photon detuning: δ = (ν_p − ν_c) + 1.40 kHz/mG · B · sgn(h_c)
      out.delta0 = (prb.f - ctrl.f) + K.lambdaShift_kHz_per_mG * m.Beff * (hc >= 0 ? 1 : -1);
      out.ok = out.overlap && out.orth;
    }
    var mm = Object.assign({}, m); if (!out.ok) mm.contrast = 0;
    out.eff = mm;
    gs.forEach(function (g, i) {
      var T;
      if (i === 0 && g.P > 0.05) T = Math.exp(-m.OD * 0.03); // strong control: optically pumped, mostly transmitted
      else if (g === prb) T = probeT(out.delta0 || 0, mm);
      else T = Math.exp(-m.OD);
      out.cellT[g.key] = T;
    });
    out.probeT0 = prb ? out.cellT[prb.key] : null;
    return out;
  }

  /* ---------------- full evaluation & objectives ---------------- */
  /* ---------------- frequency-lock chain: SAS PD → lock box → laser controller → DFB ---------------- */
  function first(comps, kind) { for (var i = 0; i < comps.length; i++) if (comps[i].kind === kind) return comps[i]; return null; }
  function lockChain(layout, sasP) {
    var c = layout.components, st = layout.state || {};
    var laser = first(c, 'laser'), sas = first(c, 'sas'), box = first(c, 'lockbox'), ctrl = first(c, 'lctrl');
    var chain = !!(laser && sas && box && ctrl);
    var light = sasP > 0.05;
    var modOK = !!(box && (box.params.method === 'davll' || (ctrl && ctrl.params.dither)));
    var errAvail = chain && light && modOK;
    var status = 'open', note = '';
    if (!chain) note = 'Open loop: lock chain incomplete (needs SAS, lock box, laser controller)';
    else if (!light) note = 'Open loop: no light on the SAS photodiode';
    else if (!modOK) note = 'No error signal: lock-in method needs current dither on the laser controller';
    else if (!st.locked) note = 'Open loop: error signal available, loop not closed';
    if (st.locked && errAvail) {
      if (box.params.sign < 0) { status = 'runaway'; note = 'Loop ran away: error-signal slope has the wrong sign (flip the sign)'; }
      else if (box.params.gain > 1.6) { status = 'oscillating'; note = 'Loop oscillating: gain too high'; }
      else if (box.params.gain < 0.2) { status = 'weak'; note = 'Loop too weak: laser still drifts (raise gain)'; }
      else { status = 'locked'; note = 'Closed loop: locked to the SAS feature'; }
    }
    return { chain: chain, light: light, modOK: modOK, errAvail: errAvail, status: status, note: note, ids: { laser: laser && laser.id, sas: sas && sas.id, box: box && box.id, ctrl: ctrl && ctrl.id },
      dither_MHz: (ctrl && ctrl.params.dither && box && box.params.method === 'lockin') ? ctrl.params.ditherMHz : 0 };
  }
  function detuneFactors(drift_MHz) {
    var d = drift_MHz || 0;
    return { od: Math.exp(-0.5 * Math.pow(d / K.dopplerSigma_MHz, 2)), c: Math.exp(-Math.pow(d / K.eitDetuneScale_MHz, 2)) };
  }

  function evaluate(layout) {
    var tr1 = trace(layout, {});
    var cell1 = analyseCell(layout, tr1);
    var tr = trace(layout, { cellT: cell1.cellT });
    var cell = analyseCell(layout, tr);
    cell.cellT = cell1.cellT; cell.probeT0 = cell1.probeT0;
    var st = layout.state || {};
    var comps = layout.components;
    var sasP = 0; for (var k in tr.sas) sasP += tr.sas[k];
    var lockAvailable = sasP > 0.05, lock = lockChain(layout, sasP);
    var pdIds = Object.keys(tr.pd);
    var det = { probe: 0, control: 0, other: 0, total: 0 };
    pdIds.forEach(function (id) { var g = tr.pd[id]; for (var key in g) { det.total += g[key]; if (cell.probe && key === cell.probe.key) det.probe += g[key]; else if (cell.control && key === cell.control.key) det.control += g[key]; else det.other += g[key]; } });
    var cellComp = cell.cell, fgen = comps.filter(function (c) { return c.kind === 'fgen' && c.params.on; })[0];
    var o = [];
    o[0] = !!(tr.laserFirst && tr.laserFirst.kind === 'isolator' && tr.laserFirst.forward) && tr.backToLaser <= 1e-3;
    o[1] = lock.status === 'locked';
    var shared = false;
    if (cell.control && cell.probe) {
      cell.control.pbs.forEach(function (a) { cell.probe.pbs.forEach(function (b) { if (a.id === b.id && a.port !== b.port) shared = true; }); });
    }
    o[2] = shared && cell.probe.P > 1e-6;
    o[3] = !!(cell.control && cell.probe && cell.control.aoms.length && cell.probe.aoms.length &&
      cell.control.aoms.every(function (a) { return cell.probe.aoms.indexOf(a) < 0; }));
    o[4] = !!cell.overlap;
    o[5] = !!cell.orth;
    o[6] = !!(cellComp && cellComp.params.heater && cellComp.params.T_C >= 40 && cellComp.params.shield && cellComp.params.solenoid && Math.abs(cellComp.params.B_mG) >= 5);
    // probe power the detector would see with the cell transparent (removes EIT/absorption dependence)
    det.probeRef = (cell.probeT0 && cell.probeT0 > 1e-12) ? det.probe / cell.probeT0 : det.probe;
    o[7] = det.probeRef > 1e-5 && det.control < 0.1 * det.probeRef;
    var sweepHalf = Math.max(150, 3 * (cell.model ? cell.model.fwhm : 0));
    o[8] = o[1] && o[2] && o[3] && o[4] && o[5] && o[7] && cell.ok && cell.eff.contrast > 0.3 && Math.abs(cell.delta0) < sweepHalf;
    var stor = null;
    if (cell.ok) stor = storageModel(cell.eff, st.tau_us || 20);
    o[9] = !!(o[8] && fgen && st.storageRan && stor && stor.eta > 0.01);
    var warnings = tr.warnings.slice();
    if (cellComp && cellComp.params.heater && cell.model && cell.model.n > 5e11) warnings.push('n ≈ ' + cell.model.n.toExponential(1) + ' cm⁻³: radiation trapping becomes significant above ~5×10¹¹ cm⁻³');
    if (lock.status !== 'locked') warnings.push(lock.note + (Math.abs(st.drift_MHz || 0) > 0.5 ? ' (laser Δ ≈ ' + (st.drift_MHz).toFixed(1) + ' MHz)' : ''));
    if (cell.probe && det.total > 0 && det.control > 0.1 * Math.max(det.probeRef, 1e-9)) warnings.push('Control leaks onto the detector (' + fmtP(det.control) + ') — use a Glan-Taylor');
    return { trace: tr, cell: cell, sasP: sasP, lockAvailable: lockAvailable, lock: lock, det: det, objectives: o, storage: stor, sweepHalf: sweepHalf, warnings: warnings, fgen: !!fgen };
  }

  /* ---------------- reference layout (Zeeman EIT) ---------------- */
  function rotMirror(din, dout) { var n = norm2([dout[0] - din[0], dout[1] - din[1]]); return Math.round(Math.atan2(n[1], n[0]) * 180 / Math.PI); }
  function rotPBS(din, dout) { var s = norm2([din[0] + dout[0], din[1] + dout[1]]); var r = Math.round(Math.atan2(s[1], s[0]) * 180 / Math.PI) - 45; return ((r % 360) + 360) % 360; }
  var E = [1, 0], Wd = [-1, 0], S = [0, 1], N = [0, -1];
  function referenceLayout() {
    var n = 0, A = K.aomAngle_deg * Math.PI / 180;
    var DP = 1.5 / LAYOUT_SCALE;   // keeps the double-pass arm (lens ~ one focal length from its mirror) the same physical size when the layout is spread out
    function mk(kind, x, z, rot, params) { var p = defaultParams(kind); if (params) for (var k in params) p[k] = params[k]; return { id: kind + (++n), kind: kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rot: rot, params: p }; }
    function M(x, z, din, dout) { return mk('mirror', x, z, rotMirror(din, dout)); }
    function B(x, z, din, dout, kind) { return mk(kind || 'pbs', x, z, rotPBS(din, dout)); }
    // Double-pass AOM built from parts: AOM, λ/4, cat's-eye lens and retro mirror on the deflected 1st order, plus a dump for the 0th order.
    function dp(x, z, east, fMHz, eff) {
      var sg = east ? 1 : -1, d1 = [sg * Math.cos(A), east ? -Math.sin(A) : Math.sin(A)], r1 = Math.round(Math.atan2(d1[1], d1[0]) * 1800 / Math.PI) / 10;
      function at(L) { return [x + L * d1[0], z + L * d1[1]]; }
      var q = at(40 * DP), l = at(80 * DP), m = at(150 * DP);
      return [mk('aom', x, z, east ? 0 : 180, { fMHz: fMHz, eff: eff, mode: 'single', order: 1 }),
        mk('qwp', q[0], q[1], r1, { axis: 45 }), mk('lens', l[0], l[1], r1), mk('mirror', m[0], m[1], r1),
        mk('dump', x + sg * 180 * DP, z, east ? 180 : 0),
        mk('dump', x - sg * 160 * DP * Math.cos(A), z + (east ? 1 : -1) * 160 * DP * Math.sin(A), east ? 90 : 270)]; // 0th order of the returning pass
    }
    var comps = [];
    function add() { for (var i = 0; i < arguments.length; i++) { if (Array.isArray(arguments[i])) comps.push.apply(comps, arguments[i]); else comps.push(arguments[i]); } }
    // --- source, isolation and master axis ---
    add(mk('laser', 50, 150, 0, { power: 10 }), mk('isolator', 110, 150, 0),
      M(170, 150, E, S), M(170, 225, S, E),            // two steering mirrors set the master axis
      mk('iris', 230, 225, 0, { ap: 3 }),
      mk('hwp', 290, 225, 0, { axis: 29 }),            // ~5 % to the SAS reference
      B(350, 225, E, N),                               // pick-off: V reflected north to the SAS arm
      mk('iris', 410, 225, 0, { ap: 3 }),
      mk('hwp', 460, 225, 0, { axis: 10 }),            // sets the probe/control split (~12 % probe)
      B(520, 225, E, S));                              // splitter: H -> control (east), V -> probe (south)
    // --- SAS reference: counter-propagating pump and probe through a Rb reference cell ---
    add(M(350, 150, N, E),
      B(420, 150, E, N, 'npbs'),                       // pump / probe division
      M(420, 95, N, E), M(700, 95, E, S),              // pump route, injected from the north
      mk('hwp', 460, 150, 0, { axis: 45 }),            // probe polarization: V -> H so it crosses the PBSs
      mk('nd', 500, 150, 0, { od: 0.3 }), mk('iris', 540, 150, 0, { ap: 3 }),
      B(590, 150, Wd, S),                              // extracts the pump after the cell
      mk('dump', 590, 200, 270),
      mk('refcell', 650, 150, 0),
      B(700, 150, S, Wd),                              // injects the pump against the probe
      mk('sas', 760, 150, 0),
      mk('dump', 700, 200, 270));
    // --- control arm: double-pass AOM, expander ---
    add(M(570, 225, E, S), M(570, 300, S, E),
      B(630, 300, Wd, S),                              // double-pass input / return separator
      dp(730, 300, true, 80.000, 0.35),
      mk('hwp', 630, 350, 0, { axis: 0 }),             // control output polarization trim
      mk('lens', 630, 400, 0), mk('lens', 630, 450, 0), // beam expander
      mk('dump', 630, 255, 90));
    // --- probe arm: double-pass AOM, folds, attenuator ---
    add(B(520, 380, S, Wd),                            // double-pass separator
      dp(420, 380, false, 79.965, 0.5),
      M(570, 380, E, S), M(570, 520, S, E),
      mk('nd', 600, 520, 0, { od: 2 }),
      mk('dump', 520, 190, 90), mk('dump', 520, 430, 270), mk('dump', 350, 280, 90));
    // --- recombine, cell, analyser, detector ---
    add(B(630, 520, S, E),                             // recombiner: probe (H) transmits, control (V) reflects
      mk('iris', 680, 520, 0, { ap: 3 }),
      mk('qwp', 720, 520, 0, { axis: 45 }),
      mk('cell', 820, 520, 0),
      mk('iris', 905, 520, 0, { ap: 3 }),
      mk('qwp', 935, 520, 0, { axis: -45 }),
      mk('glan', 985, 520, 0, { axis: 0 }),
      mk('lens', 1020, 520, 0),
      mk('pd', 1060, 520, 0),
      mk('dump', 985, 590, 270), mk('dump', 630, 570, 270));
    // --- electronics ---
    add(mk('lctrl', 50, 60, 270), mk('lockbox', 125, 60, 270),
      mk('rfgen', 90, 720, 270), mk('rfatt', 210, 720, 270), mk('rfamp', 310, 720, 270), mk('rfatt', 430, 720, 270), mk('rfamp', 530, 720, 270),
      mk('psu', 240, 60, 270), mk('pwrmeter', 350, 60, 270),
      mk('csrc', 690, 720, 270), mk('tctrl', 800, 720, 270), mk('fgen', 930, 720, 270), mk('scope', 1080, 720, 270));
    // The layout above is drawn on a compact 1200 x 750 grid; spread it out so every part has room (and the cat's-eye lenses sit one focal length from their mirrors).
    comps.forEach(function (c) { c.x = Math.round(c.x * LAYOUT_SCALE * 10) / 10; c.z = Math.round(c.z * LAYOUT_SCALE * 10) / 10; });
    return { mode: 'A', components: comps, state: { locked: true, tau_us: 20, storageRan: false } };
  }
  var LAYOUT_SCALE = 2.0;
  // Painted zones on the table, in the compact layout's coordinates (scaled on the way out). rects: [x0, z0, x1, z1]; lab: [x, z, align] places the name chip: 'tl' = hangs below-right of the point, 'bl' = sits above-right of it, 'l' / 'r' = beside it.
  var ZONES = [
    { id: 'source', name: 'SOURCE & MASTER AXIS', sub: 'fibre laser, fibre isolator, mirrors, pick-off, splitter', color: '#f29a38', lab: [20, 266, 'tl'], rects: [[20, 105, 325, 262], [325, 212, 545, 300]] },
    { id: 'sas', name: 'SAS REFERENCE (LASER LOCK)', sub: 'pump + probe through the Rb reference cell', color: '#b58cf0', lab: [806, 152, 'r'], rects: [[330, 94, 800, 210]] },
    { id: 'control', name: 'CONTROL ARM', sub: 'double-pass AOM, beam expander', color: '#ff6b6b', lab: [946, 275, 'r'], rects: [[548, 212, 940, 338], [612, 338, 668, 480]] },
    { id: 'probe', name: 'PROBE ARM', sub: 'double-pass AOM, attenuator', color: '#5aa9f2', lab: [219, 441, 'l'], rects: [[225, 335, 610, 548]] },
    { id: 'cell', name: 'RECOMBINE, CELL & DETECTION', sub: 'QWP, Rb cell in shield + solenoid, Glan-Taylor, photodiode', color: '#4cc98a', lab: [640, 615, 'tl'], rects: [[612, 488, 1105, 612]] },
    { id: 'lockel', name: 'LASER CONTROL, LOCK & POWER', sub: '', color: '#d8c04a', lab: [20, 8, 'tl'], rects: [[20, 10, 385, 92]] },
    { id: 'rf', name: 'RF CHAIN FOR THE AOMs', sub: 'dual RF source, attenuators, amplifiers', color: '#e58fd0', lab: [40, 786, 'bl'], rects: [[40, 680, 565, 790]] },
    { id: 'field', name: 'FIELD, HEATER, TIMING & SCOPE', sub: '', color: '#6fd0d6', lab: [640, 786, 'bl'], rects: [[640, 680, 1135, 790]] }
  ];
  function referenceZones() {
    return ZONES.map(function (z) {
      return { id: z.id, name: z.name, sub: z.sub, color: z.color, lab: [z.lab[0] * LAYOUT_SCALE, z.lab[1] * LAYOUT_SCALE, z.lab[2]], rects: z.rects.map(function (r) { return [r[0] * LAYOUT_SCALE, r[1] * LAYOUT_SCALE, r[2] * LAYOUT_SCALE, r[3] * LAYOUT_SCALE]; }) };
    });
  }

  var api = {
    K: K, C: C, J: J, H: H, V: V, jPower: jPower, jNorm: jNorm, mApply: mApply, hwpMatrix: hwpMatrix, qwpMatrix: qwpMatrix,
    stokes: stokes, polLabel: polLabel, eitResponse: eitResponse, gammaEIT: gammaEIT,
    rbPressureTorr: rbPressureTorr, numberDensity_cm3: numberDensity_cm3, odFromTemp: odFromTemp,
    cellModel: cellModel, probeT: probeT, lorentz: lorentz, storageModel: storageModel,
    KINDS: KINDS, defaultParams: defaultParams, dirOf: dirOf, trace: trace, analyseCell: analyseCell, evaluate: evaluate,
    referenceLayout: referenceLayout, referenceZones: referenceZones, lockChain: lockChain, detuneFactors: detuneFactors, besselJ: besselJ, betaFromDbm: betaFromDbm, modulateSpec: modulateSpec, fmtP: fmtP, groupKey: groupKey, rotPBS: rotPBS, rotMirror: rotMirror
  };
  root.EITPhys = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);

