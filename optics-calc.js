/* optics-calc.js (v1): beam and distance calculators for the Rb-87 Zeeman EIT bench.
   The maths is in window.OptCalc (pure functions, also checked by private/optcalc_test.js in node);
   the page code below it only runs in a browser. Units: mm, nm for wavelengths, MHz, kHz, µs. */
(function () {
  'use strict';
  var PI = Math.PI;
  var C_MM_PER_S = 2.99792458e11;

  // ---------- maths ----------
  function erf(x) { // Abramowitz and Stegun 7.1.26, |error| < 1.5e-7
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function erfc(x) { return 1 - erf(x); }
  function cdiv(a, b) { var d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
  // q -> (A q + B) / (C q + D), M = [A, B, C, D]
  function qABCD(q, M) { return cdiv([M[0] * q[0] + M[1], M[0] * q[1]], [M[2] * q[0] + M[3], M[2] * q[1]]); }
  function mmul(X, Y) { // X·Y (Y acts first)
    return [X[0] * Y[0] + X[1] * Y[2], X[0] * Y[1] + X[1] * Y[3], X[2] * Y[0] + X[3] * Y[2], X[2] * Y[1] + X[3] * Y[3]];
  }
  function P(L) { return [1, L, 0, 1]; }
  function Lens(f) { return [1, 0, -1 / f, 1]; }
  function qWaist(w0, lam) { return [0, PI * w0 * w0 / lam]; }
  function wOf(q, lam) { var inv = cdiv([1, 0], q); return Math.sqrt(-lam / (PI * inv[1])); }
  function ROf(q) { var inv = cdiv([1, 0], q); return Math.abs(inv[0]) < 1e-15 ? Infinity : 1 / inv[0]; }
  function waistOf(q, lam) { return { ahead: -q[0], w0: Math.sqrt(lam * q[1] / PI) }; } // waist is 'ahead' mm downstream (negative: behind)

  /** power fraction of a centred Gaussian (1/e² radius w) passing an aperture */
  function apT(shape, x, y, w) {
    if (shape === 'round') { var a = x / 2; return 1 - Math.exp(-2 * a * a / (w * w)); }
    if (shape === 'rect') return erf(Math.SQRT2 * (x / 2) / w) * erf(Math.SQRT2 * (y / 2) / w);
    return NaN; // 'max': a maximum beam diameter given by the maker, not an aperture
  }

  /** fibre collimator (Thorlabs formula D = 4 λ f / (π MFD), waist at the lens) */
  function collimator(lamNm, mfdUm, fMm) {
    var lam = lamNm * 1e-6, wf = mfdUm * 1e-3 / 2;
    var w0 = lam * fMm / (PI * wf);
    var zRin = PI * wf * wf / lam;
    return { w0: w0, D: 2 * w0, thetaHalf: wf / fMm, zR: PI * w0 * w0 / lam, zRin: zRin, zMaxWaist: fMm + fMm * fMm / (2 * zRin) };
  }
  function fForDiameter(lamNm, mfdUm, Dmm) { return PI * mfdUm * 1e-3 * Dmm / (4 * lamNm * 1e-6); }

  /** Gaussian beam along a list of rows: {k:'s', L} space, {k:'l', f} thin lens, {k:'a', shape, x, y, label} aperture */
  function beamPath(lamNm, w0, rows) {
    var lam = lamNm * 1e-6, q = qWaist(w0, lam), z = 0, pts = [{ z: 0, w: w0 }], marks = [], Ttot = 1;
    rows.forEach(function (r, i) {
      if (r.k === 's') {
        var n = Math.max(2, Math.ceil(r.L / 5));
        for (var j = 1; j <= n; j++) { var qq = qABCD(q, P(r.L * j / n)); pts.push({ z: z + r.L * j / n, w: wOf(qq, lam) }); }
        q = qABCD(q, P(r.L)); z += r.L;
      } else if (r.k === 'l') {
        q = qABCD(q, Lens(r.f));
        marks.push({ i: i, k: 'l', z: z, f: r.f, label: r.label || ('lens f = ' + r.f + ' mm'), w: wOf(q, lam) });
      } else if (r.k === 'a') {
        var w = wOf(q, lam), T = apT(r.shape, r.x, r.y, w);
        if (!isNaN(T)) Ttot *= T;
        marks.push({ i: i, k: 'a', z: z, shape: r.shape, x: r.x, y: r.y, label: r.label || 'aperture', w: w, T: T, ok: r.shape === 'max' ? (2 * w <= r.x) : T >= 0.989 });
      }
    });
    var wa = waistOf(q, lam);
    return { pts: pts, marks: marks, zEnd: z, wEnd: wOf(q, lam), REnd: ROf(q), waistAhead: wa.ahead, waistW0: wa.w0, zREnd: q[1], Ttot: Ttot };
  }

  /** double-pass AOM in a cat's eye: AOM -d- lens(f) -(f+δ)- mirror, unfolded */
  function catseye(p) {
    var lam = p.lamNm * 1e-6, f = p.f, d = p.d, del = p.delta, win = p.Din / 2;
    var thSep = lam * p.fRF / p.v;                  // rad, λ f_RF / v (MHz × µs/mm... λ[mm] f[1/µs] / v[mm/µs])
    var M = mmul(P(d), mmul(Lens(f), mmul(P(f + del), mmul(P(f + del), mmul(Lens(f), P(d))))));
    var thScan = lam * (p.scanKHz / 1000) / p.v;    // first-pass angle change for the RF scan
    var wf = lam * f / (PI * win);                    // spot at the focus
    var s = f * thSep;                                // order spacing at the mirror
    var qIn = qWaist(win, lam), qRet = qABCD(qIn, M), qOut = qABCD(qRet, P(p.Lout));
    var qRef = qABCD(qABCD(qIn, mmul(P(d), mmul(Lens(f), mmul(P(2 * f), mmul(Lens(f), P(d)))))), P(p.Lout));
    return {
      thetaB: thSep / 2, thetaSep: thSep, spacing: s, spot: 2 * wf, zRfocus: PI * wf * wf / lam,
      knifeLoss: 0.5 * erfc(Math.SQRT2 * (s / 2) / wf),
      M: M, lensPower: M[2], Fequiv: Math.abs(M[2]) < 1e-15 ? Infinity : -M[3] / M[2], // 1/q' = 1/q - 1/F for A = D = -1: F > 0 converging
      shiftAtAOM: M[1] * thScan, angleErr: (M[3] + 1) * thScan, thScan: thScan,
      Dout: 2 * wOf(qOut, lam), DoutRef: 2 * wOf(qRef, lam),
      rise: 0.64 * p.Din / p.v, riseGH: 0.1625 * p.Din,
      armOneWay: p.pbsToAom + d + f + del
    };
  }

  /** relative phase noise between control and probe for a path difference (Lorentzian laser, white frequency noise) */
  function armDiff(dnuMHz, Lc, Lp) {
    var tau = Math.abs(Lc - Lp) / C_MM_PER_S, var2 = 2 * PI * dnuMHz * 1e6 * tau;
    return { dL: Math.abs(Lc - Lp), tau: tau, var2: var2, rms: Math.sqrt(var2), narrow: Math.exp(-var2),
             Lcoh: C_MM_PER_S / (PI * dnuMHz * 1e6), dL99: -Math.log(0.99) * C_MM_PER_S / (2 * PI * dnuMHz * 1e6) };
  }

  /** two-iris alignment: worst-case angle from the centring error e on each iris */
  function align(e, L, Lb, Lbr) {
    var th = 2 * e / L;
    return { theta: th, errAtLb: th * Lb, backRefl: e / (2 * Lbr) };
  }

  var OC = { erf: erf, erfc: erfc, qABCD: qABCD, mmul: mmul, P: P, Lens: Lens, wOf: wOf, apT: apT, collimator: collimator,
             fForDiameter: fForDiameter, beamPath: beamPath, catseye: catseye, armDiff: armDiff, align: align };
  if (typeof window !== 'undefined') window.OptCalc = OC;
  if (typeof module !== 'undefined' && module.exports) module.exports = OC;
  if (typeof document === 'undefined') return;

  // ---------- page ----------
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, a, txt) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }
  function clear(svg) { while (svg.childNodes.length > 2) svg.removeChild(svg.lastChild); }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
  function fx(x, d) { if (!isFinite(x)) return '∞'; return x.toFixed(d); }
  var SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function sig(x, n) {
    if (!isFinite(x)) return '∞'; if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) { var e = Math.floor(Math.log10(a)); return (x / Math.pow(10, e)).toFixed(n - 1) + ' × 10' + String(e).split('').map(function (c) { return SUP[c]; }).join(''); }
    return String(+x.toPrecision(n));
  }
  function pct(x) { return (100 * x).toFixed(x > 0.9995 ? 2 : 1) + ' %'; }
  function rowsOut(id, rows) {
    $(id).innerHTML = rows.map(function (r) {
      return '<tr' + (r[3] ? ' class="' + r[3] + '"' : '') + '><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="src">' + (r[2] || '') + '</td></tr>';
    }).join('');
  }

  // 1. collimator
  function calcCol() {
    var lam = num('cLam'), mfd = num('cMfd'), f = num('cF'), tgt = num('cTgt');
    var c = collimator(lam, mfd, f);
    var w = function (z) { return 2 * c.w0 * Math.sqrt(1 + Math.pow(z / c.zR, 2)); };
    rowsOut('cOut', [
      ['Beam diameter (1/e²) after the collimator', fx(c.D, 2) + ' mm', 'D = 4 λ f / (π MFD) (Thorlabs)', 'key'],
      ['Divergence (half angle)', fx(c.thetaHalf * 1e3, 3) + ' mrad', 'θ = (MFD/2) / f = λ / (π w₀)'],
      ['Rayleigh range of the collimated beam', fx(c.zR / 1000, 2) + ' m', 'z_R = π w₀² / λ'],
      ['Diameter 0.5 m / 1 m / 2 m from the collimator', fx(w(500), 2) + ' / ' + fx(w(1000), 2) + ' / ' + fx(w(2000), 2) + ' mm', 'w(z) = w₀ √(1 + (z/z_R)²)'],
      ['Farthest place the waist can be put', fx(c.zMaxWaist / 1000, 2) + ' m', 'f + f² / (2 z_R,fibre) (Thorlabs)'],
      ['Collimator focal length for a ' + fx(tgt, 2) + ' mm beam', fx(fForDiameter(lam, mfd, tgt), 2) + ' mm', 'f = π MFD D / (4 λ)']
    ]);
    $('cNote').textContent = c.zR > 2000
      ? 'The beam stays collimated over the whole bench (z_R = ' + fx(c.zR / 1000, 1) + ' m), so the distances between flat optics do not change its size.'
      : 'Short Rayleigh range (' + fx(c.zR / 1000, 2) + ' m): the beam grows noticeably over the bench; distances start to matter.';
    return c;
  }

  // 2. beam path
  var PRESETS = {
    aom: { name: 'Collimator → isolator → PBS → AOM (first pass)', rows: [
      { k: 's', L: 40 }, { k: 'a', shape: 'max', x: 2.7, label: 'isolator I795P3D (max beam Ø2.7)' },
      { k: 's', L: 120 }, { k: 'a', shape: 'round', x: 10, label: 'half-wave plate Ø½″ (clear Ø10, assumed)' },
      { k: 's', L: 80 }, { k: 'a', shape: 'round', x: 20, label: 'PBS cube 1″ (clear ≈ Ø20, assumed)' },
      { k: 's', L: 120 }, { k: 'a', shape: 'rect', x: 2.5, y: 2.0, label: 'AOM 3080-125 active aperture 2.5 × 2.0' }] },
    exp: { name: 'Control: ×2 expander (f = 50 + f = 100) → shield → cell → Glan-Taylor', rows: [
      { k: 's', L: 600 }, { k: 'l', f: 50, label: 'expander lens f = 50' }, { k: 's', L: 150 }, { k: 'l', f: 100, label: 'expander lens f = 100' },
      { k: 's', L: 300 }, { k: 'a', shape: 'round', x: 14, label: 'shield end cap, beam hole Ø14' },
      { k: 's', L: 140 }, { k: 'a', shape: 'round', x: 20, label: 'cell window (clear ≈ Ø20, assumed)' },
      { k: 's', L: 140 }, { k: 'a', shape: 'round', x: 14, label: 'shield end cap, beam hole Ø14' },
      { k: 's', L: 150 }, { k: 'a', shape: 'round', x: 10, label: 'Glan-Taylor GT10-B (clear Ø10)' }] },
    det: { name: 'Probe: Glan-Taylor → collection lens f = 50 → photodiode', rows: [
      { k: 's', L: 1400 }, { k: 'a', shape: 'round', x: 10, label: 'Glan-Taylor GT10-B (clear Ø10)' },
      { k: 's', L: 80 }, { k: 'l', f: 50, label: 'collection lens f = 50' },
      { k: 's', L: 40 }, { k: 'a', shape: 'rect', x: 3.6, y: 3.6, label: 'PDA36A2 chip 3.6 × 3.6' }] }
  };
  var rows = [];
  function loadPreset(key) { rows = JSON.parse(JSON.stringify(PRESETS[key].rows)); drawRows(); calcPath(); }
  function drawRows() {
    var h = '';
    rows.forEach(function (r, i) {
      h += '<tr><td><select data-i="' + i + '" data-f="k" aria-label="row type">' +
        [['s', 'distance'], ['l', 'thin lens'], ['a', 'aperture']].map(function (o) { return '<option value="' + o[0] + '"' + (r.k === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>';
      if (r.k === 's') h += '<td><input type="number" step="1" min="0" value="' + r.L + '" data-i="' + i + '" data-f="L" aria-label="distance in mm"> mm</td><td></td>';
      else if (r.k === 'l') h += '<td>f <input type="number" step="1" value="' + r.f + '" data-i="' + i + '" data-f="f" aria-label="focal length in mm"> mm</td><td><input type="text" value="' + (r.label || '') + '" data-i="' + i + '" data-f="label" aria-label="label"></td>';
      else h += '<td><select data-i="' + i + '" data-f="shape" aria-label="aperture shape">' +
        [['round', 'round Ø'], ['rect', 'rectangle'], ['max', 'maker\'s max beam Ø']].map(function (o) { return '<option value="' + o[0] + '"' + (r.shape === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select> <input type="number" step="0.1" min="0" value="' + r.x + '" data-i="' + i + '" data-f="x" aria-label="width in mm">' +
        (r.shape === 'rect' ? ' × <input type="number" step="0.1" min="0" value="' + (r.y || r.x) + '" data-i="' + i + '" data-f="y" aria-label="height in mm">' : '') + ' mm</td>' +
        '<td><input type="text" value="' + (r.label || '') + '" data-i="' + i + '" data-f="label" aria-label="label"></td>';
      h += '<td><button type="button" class="oc-x" data-del="' + i + '" aria-label="remove row">×</button></td></tr>';
    });
    $('pRows').innerHTML = h;
  }
  function onRowEdit(e) {
    var t = e.target, i = +t.getAttribute('data-i'), f = t.getAttribute('data-f');
    if (t.hasAttribute('data-del')) { rows.splice(+t.getAttribute('data-del'), 1); drawRows(); calcPath(); return; }
    if (isNaN(i) || !f) return;
    var r = rows[i];
    if (f === 'k') { var k = t.value; rows[i] = k === 's' ? { k: 's', L: 100 } : k === 'l' ? { k: 'l', f: 100 } : { k: 'a', shape: 'round', x: 10, label: 'aperture' }; drawRows(); }
    else if (f === 'label') r.label = t.value;
    else if (f === 'shape') { r.shape = t.value; if (r.shape === 'rect' && !r.y) r.y = r.x; drawRows(); }
    else r[f] = parseFloat(t.value) || 0;
    calcPath();
  }
  function calcPath() {
    var lam = num('cLam');
    var w0 = $('pFromCol').checked ? collimator(lam, num('cMfd'), num('cF')).w0 : num('pD') / 2;
    $('pD').disabled = $('pFromCol').checked;
    if ($('pFromCol').checked) $('pD').value = fx(2 * w0, 2);
    var r = beamPath(lam, w0, rows);
    // table
    var h = '';
    r.marks.forEach(function (m) {
      if (m.k === 'l') { h += '<tr><td>' + esc(m.label) + '</td><td class="n">z = ' + fx(m.z, 0) + ' mm</td><td class="n">Ø ' + fx(2 * m.w, 2) + ' mm</td><td>lens</td></tr>'; return; }
      var verdict = m.shape === 'max' ? (m.ok ? 'fits (≤ Ø' + m.x + ')' : 'too big for Ø' + m.x) : pct(m.T) + ' passes' + (m.ok ? '' : ' (clips)');
      h += '<tr class="' + (m.ok ? 'ok' : 'bad') + '"><td>' + esc(m.label) + '</td><td class="n">z = ' + fx(m.z, 0) + ' mm</td><td class="n">Ø ' + fx(2 * m.w, 2) + ' mm</td><td>' + verdict + '</td></tr>';
    });
    $('pOut').innerHTML = h;
    var wa = r.waistAhead;
    $('pEnd').innerHTML = 'At the end (z = ' + fx(r.zEnd, 0) + ' mm): beam Ø ' + fx(2 * r.wEnd, 2) + ' mm; ' +
      (Math.abs(wa) > 1e6 ? 'collimated.' : 'its waist (Ø ' + fx(2 * r.waistW0, 3) + ' mm) is ' + fx(Math.abs(wa), 0) + ' mm ' + (wa >= 0 ? 'further on' : 'behind this point') + ', Rayleigh range ' + fx(r.zREnd, 0) + ' mm.') +
      ' Product of the aperture transmissions: ' + pct(r.Ttot) + ' (first-order estimate; a clipped beam also spreads).';
    plotPath(r);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plotPath(r) {
    var svg = $('pPlot'); clear(svg);
    var x0 = 54, x1 = 700, yc = 150, H = 110;
    var wmax = 0; r.pts.forEach(function (p) { wmax = Math.max(wmax, p.w); });
    var ymax = wmax * 1.7;
    var X = function (z) { return x0 + (x1 - x0) * z / Math.max(r.zEnd, 1); };
    var Y = function (v) { return yc - H * v / ymax; };
    var g = el('g', {});
    g.appendChild(el('line', { x1: x0, x2: x1, y1: yc, y2: yc, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }));
    var up = '', dn = '';
    r.pts.forEach(function (p, i) { up += (i ? 'L' : 'M') + fx(X(p.z), 1) + ' ' + fx(Y(p.w), 1); });
    for (var i = r.pts.length - 1; i >= 0; i--) dn += 'L' + fx(X(r.pts[i].z), 1) + ' ' + fx(Y(-r.pts[i].w), 1);
    g.appendChild(el('path', { d: up + dn + 'Z', fill: 'var(--oc-beam-fill)', stroke: 'var(--oc-beam)', 'stroke-width': 1.6 }));
    var lab = 0;
    r.marks.forEach(function (m) {
      var x = X(m.z);
      if (m.k === 'l') {
        g.appendChild(el('line', { x1: x, x2: x, y1: yc - H - 6, y2: yc + H + 6, stroke: 'var(--accent)', 'stroke-width': 2.4 }));
      } else {
        var a = m.shape === 'rect' ? Math.min(m.x, m.y) / 2 : m.x / 2, col = m.ok ? 'var(--ink)' : 'var(--oc-bad)';
        if (a < ymax) {
          g.appendChild(el('rect', { x: x - 3, y: Y(ymax), width: 6, height: Y(a) - Y(ymax), fill: col }));
          g.appendChild(el('rect', { x: x - 3, y: Y(-a), width: 6, height: Y(-ymax) - Y(-a), fill: col }));
        } else {
          g.appendChild(el('path', { d: 'M' + (x - 5) + ' ' + Y(ymax) + ' L' + x + ' ' + (Y(ymax) + 8) + ' L' + (x + 5) + ' ' + Y(ymax) + 'Z', fill: 'var(--muted)' }));
        }
      }
      var ty = 18 + (lab++ % 2) * 14;
      g.appendChild(el('text', { x: Math.min(Math.max(x, x0 + 20), x1 - 20), y: ty, 'text-anchor': 'middle', 'font-size': 11, fill: m.k === 'l' ? 'var(--accent)' : (m.ok ? 'var(--ink)' : 'var(--oc-bad)') }, String(lab)));
    });
    // axes
    g.appendChild(el('line', { x1: x0, x2: x1, y1: yc + H + 14, y2: yc + H + 14, stroke: 'var(--ink)' }));
    var step = niceStep(r.zEnd / 6);
    for (var z = 0; z <= r.zEnd + 1e-6; z += step) {
      g.appendChild(el('line', { x1: X(z), x2: X(z), y1: yc + H + 14, y2: yc + H + 19, stroke: 'var(--ink)' }));
      g.appendChild(el('text', { x: X(z), y: yc + H + 32, 'text-anchor': 'middle', 'font-size': 11, 'class': 'mono' }, fx(z, 0)));
    }
    g.appendChild(el('text', { x: (x0 + x1) / 2, y: yc + H + 48, 'text-anchor': 'middle', 'font-size': 12 }, 'distance along the beam (mm); numbers on top = rows with a lens (blue) or an aperture'));
    g.appendChild(el('text', { x: 10, y: yc - H, 'font-size': 11, 'class': 'mono' }, '+' + fx(ymax, 2)));
    g.appendChild(el('text', { x: 10, y: yc + H + 4, 'font-size': 11, 'class': 'mono' }, '−' + fx(ymax, 2)));
    g.appendChild(el('text', { x: 10, y: yc + 4, 'font-size': 11, 'class': 'mono' }, '0 mm'));
    svg.appendChild(g);
    // number the table rows the same way
    var trs = $('pOut').querySelectorAll('tr');
    for (var k = 0; k < trs.length; k++) trs[k].firstChild.innerHTML = '<b>' + (k + 1) + '</b> ' + trs[k].firstChild.innerHTML;
  }
  function niceStep(x) { var p = Math.pow(10, Math.floor(Math.log10(x))); var m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

  // 3. cat's eye
  function calcCat() {
    var p = { lamNm: num('cLam'), fRF: num('kRF'), v: num('kV'), f: num('kF'), Din: num('kD'), d: num('kd'), delta: num('kDel'),
              scanKHz: num('kScan'), Lout: num('kL'), pbsToAom: num('kPbs') };
    var r = catseye(p);
    $('kDelO').textContent = (p.delta >= 0 ? '+' : '') + fx(p.delta, 2) + ' mm';
    $('kdO').textContent = fx(p.d, 0) + ' mm';
    rowsOut('kOut', [
      ['Bragg angle (tilt of the AOM to the beam)', fx(r.thetaB * 1e3, 3) + ' mrad = ' + fx(r.thetaB * 180 / PI, 3) + '°', 'θ_B = λ f_RF / (2 v)'],
      ['Angle between 0th and 1st order', fx(r.thetaSep * 1e3, 2) + ' mrad', 'λ f_RF / v'],
      ['Distance AOM → lens and lens → mirror', fx(p.f, 0) + ' mm and ' + fx(p.f, 0) + ' mm', 'cat\'s eye: both equal to f', 'key'],
      ['Orders at the mirror: spacing', fx(r.spacing, 2) + ' mm', 's = f × λ f_RF / v', 'key'],
      ['Focused spot at the mirror (1/e² Ø)', fx(r.spot * 1e3, 0) + ' µm', '2 w_f, w_f = λ f / (π w_in)'],
      ['0th-order light past a razor blade halfway (and 1st-order loss)', r.knifeLoss < 1e-9 ? '< 10⁻⁹' : sig(r.knifeLoss, 2), '½ erfc(√2 (s/2) / w_f)'],
      ['Depth of focus at the mirror (Rayleigh range)', '± ' + fx(r.zRfocus, 1) + ' mm', 'π w_f² / λ'],
      ['Mirror ' + fx(p.delta, 2) + ' mm off focus: extra lens power of the return', isFinite(r.Fequiv) ? (r.Fequiv > 0 ? 'converging, ' : 'diverging, ') + 'like a lens of f = ' + fx(Math.abs(r.Fequiv) / 1000, 2) + ' m' : 'none', 'F = f² / (2δ) (ABCD)', Math.abs(p.delta) > 0 ? 'warn' : ''],
      ['Returned beam Ø at ' + fx(p.Lout, 0) + ' mm (perfect focus: ' + fx(r.DoutRef, 2) + ' mm)', fx(r.Dout, 2) + ' mm', 'Gaussian q through the ABCD chain', Math.abs(r.Dout / r.DoutRef - 1) > 0.1 ? 'bad' : ''],
      ['Return-beam walk at the AOM for an RF scan of ±' + fx(p.scanKHz, 0) + ' kHz', fx(Math.abs(r.shiftAtAOM) * 1e3, 3) + ' µm, angle ' + sig(Math.abs(r.angleErr) * 1e6, 2) + ' µrad', 'B × θ_scan, (D+1) × θ_scan; zero when d = f'],
      ['Rise time (10–90 %) for a ' + fx(p.Din, 2) + ' mm beam', fx(r.rise * 1e3, 0) + ' ns (theory), ' + fx(r.riseGH * 1e3, 0) + ' ns (G&H scaling)', '0.64 D / v; 3080-125 drawing: 65 ns at 0.4 mm'],
      ['One-way arm length PBS → mirror (for the arm-length check)', fx(r.armOneWay, 0) + ' mm (double pass: ' + fx(2 * r.armOneWay, 0) + ' mm)', 'PBS→AOM + d + f + δ']
    ]);
    drawCat(p, r);
  }
  function drawCat(p, r) {
    var svg = $('kSvg'); clear(svg);
    var g = el('g', {}), y = 110, xP = 40, xA = 190, xL = 420, xM = 650;
    function t(x, yy, s, o) { var a = { x: x, y: yy, 'font-size': 14, 'text-anchor': 'middle' }; for (var k in o) a[k] = o[k]; g.appendChild(el('text', a, s)); }
    g.appendChild(el('rect', { x: xP - 18, y: y - 18, width: 36, height: 36, fill: 'var(--oc-glass)', stroke: 'var(--ink)' }));
    g.appendChild(el('line', { x1: xP - 18, y1: y + 18, x2: xP + 18, y2: y - 18, stroke: 'var(--ink)' }));
    t(xP, y + 38, 'PBS');
    g.appendChild(el('rect', { x: xA - 30, y: y - 22, width: 60, height: 44, fill: 'var(--surface-2)', stroke: 'var(--ink)', transform: 'rotate(-4 ' + xA + ' ' + y + ')' }));
    t(xA, y + 42, 'AOM (tilted θ_B)');
    g.appendChild(el('ellipse', { cx: xL, cy: y, rx: 7, ry: 44, fill: 'var(--oc-glass)', stroke: 'var(--accent)', 'stroke-width': 2 }));
    t(xL, y + 60, 'lens f = ' + fx(p.f, 0));
    var dm = p.delta * 6;
    g.appendChild(el('rect', { x: xM + dm, y: y - 46, width: 8, height: 92, fill: 'var(--ink)' }));
    t(xM + dm + 4, y + 62, 'mirror (+ λ/4)');
    // beams: 0th (dashed) and 1st order
    g.appendChild(el('line', { x1: xP + 18, y1: y, x2: xA, y2: y, stroke: 'var(--oc-beam)', 'stroke-width': 3 }));
    g.appendChild(el('line', { x1: xA, y1: y, x2: xL, y2: y, stroke: 'var(--oc-beam)', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.6 }));
    g.appendChild(el('line', { x1: xA, y1: y, x2: xL, y2: y - 22, stroke: 'var(--oc-beam)', 'stroke-width': 3 }));
    g.appendChild(el('line', { x1: xL, y1: y - 22, x2: xM + dm, y2: y - 4, stroke: 'var(--oc-beam)', 'stroke-width': 3 }));
    g.appendChild(el('line', { x1: xL, y1: y, x2: xM + dm, y2: y + 4, stroke: 'var(--oc-beam)', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0.6 }));
    g.appendChild(el('rect', { x: xM + dm - 14, y: y + 2, width: 10, height: 16, fill: 'var(--muted)' }));
    t(xM + dm - 22, y + 30, 'block 0th', { 'text-anchor': 'end', 'font-size': 13 });
    // dimensions
    function dim(xa, xb, yy, s) {
      g.appendChild(el('line', { x1: xa, x2: xb, y1: yy, y2: yy, stroke: 'var(--muted)', 'marker-start': 'url(#ocA)', 'marker-end': 'url(#ocA)' }));
      t((xa + xb) / 2, yy - 6, s, { 'font-weight': 700 });
    }
    var defs = el('defs', {}), mk = el('marker', { id: 'ocA', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    mk.appendChild(el('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--muted)' })); defs.appendChild(mk); g.appendChild(defs);
    dim(xA, xL, 30, 'd = ' + fx(p.d, 0) + ' mm' + (Math.abs(p.d - p.f) < 0.5 ? ' (= f)' : ''));
    dim(xL, xM + dm, 30, 'f + δ = ' + fx(p.f + p.delta, 1) + ' mm');
    t(xM + dm + 30, y - 10, 's = ' + fx(r.spacing, 2) + ' mm', { 'text-anchor': 'start', 'font-size': 13.5 });
    t(xM + dm + 30, y + 6, 'spot Ø ' + fx(r.spot * 1e3, 0) + ' µm', { 'text-anchor': 'start', 'font-size': 13.5 });
    t(xA, y - 34, fx(r.thetaSep * 1e3, 1) + ' mrad', { 'font-size': 13 });
    t(380, 200, 'not to scale: angles and the mirror offset are exaggerated', { 'font-size': 11, fill: 'var(--muted)' });
    svg.appendChild(g);
  }

  // 4. arm-length difference
  function calcArm() {
    var r = armDiff(num('aNu'), num('aLc'), num('aLp'));
    rowsOut('aOut', [
      ['Path difference control − probe (split point → cell)', fx(r.dL, 0) + ' mm', ''],
      ['Delay τ', fx(r.tau * 1e9, 2) + ' ns', 'τ = ΔL / c'],
      ['Relative phase variance', sig(r.var2, 3) + ' rad² (rms ' + sig(r.rms, 2) + ' rad)', 'σ² = 2π Δν τ'],
      ['Share of the two-photon drive that stays narrow', pct(r.narrow), 'exp(−2π Δν τ)', r.narrow > 0.99 ? 'ok' : r.narrow > 0.95 ? 'warn' : 'bad'],
      ['Path difference allowed for 99 %', fx(r.dL99, 0) + ' mm', '−ln 0.99 × c / (2π Δν)', 'key'],
      ['Coherence length of the laser', fx(r.Lcoh / 1000, 1) + ' m', 'c / (π Δν)']
    ]);
  }

  // 5. alignment accuracy
  function calcAlign() {
    var r = align(num('iE'), num('iL'), num('iB'), num('iR'));
    rowsOut('iOut', [
      ['Worst-case beam angle after walking through two irises', fx(r.theta * 1e3, 3) + ' mrad (' + fx(r.theta * 180 / PI, 4) + '°)', 'θ ≈ 2e / L'],
      ['Height or side error at the end of the bench', fx(r.errAtLb, 2) + ' mm', 'θ × bench length'],
      ['Smallest tilt seen with the back-reflection check', fx(r.backRefl * 1e3, 3) + ' mrad', 'e / (2 L_back)']
    ]);
  }

  function all() { calcCol(); calcPath(); calcCat(); calcArm(); calcAlign(); }
  document.addEventListener('DOMContentLoaded', function () {
    var sel = $('pPreset');
    Object.keys(PRESETS).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = PRESETS[k].name; sel.appendChild(o); });
    sel.addEventListener('change', function () { loadPreset(sel.value); });
    $('pRows').addEventListener('change', onRowEdit);
    $('pRows').addEventListener('click', function (e) { if (e.target.hasAttribute('data-del')) onRowEdit(e); });
    $('pAdd').addEventListener('click', function () { rows.push({ k: 's', L: 100 }); drawRows(); calcPath(); });
    ['cLam', 'cMfd', 'cF', 'cTgt'].forEach(function (id) { $(id).addEventListener('input', all); });
    ['pD', 'pFromCol'].forEach(function (id) { $(id).addEventListener('input', calcPath); $(id).addEventListener('change', calcPath); });
    ['kRF', 'kV', 'kF', 'kD', 'kd', 'kDel', 'kScan', 'kL', 'kPbs'].forEach(function (id) { $(id).addEventListener('input', calcCat); });
    $('kUseCol').addEventListener('click', function () { $('kD').value = fx(collimator(num('cLam'), num('cMfd'), num('cF')).D, 2); calcCat(); });
    ['aNu', 'aLc', 'aLp'].forEach(function (id) { $(id).addEventListener('input', calcArm); });
    ['iE', 'iL', 'iB', 'iR'].forEach(function (id) { $(id).addEventListener('input', calcAlign); });
    rows = JSON.parse(JSON.stringify(PRESETS.aom.rows)); drawRows();
    all();
  });
})();
