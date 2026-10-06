/* lecture-symbols.js
   Hover / tap explanations for symbols in the lecture notes.
   1. Before MathJax runs, equations get \class{sym s-KEY}{...} wrappers around known symbols.
   2. A tooltip shows the definition when you hover, focus or tap a symbol (in equations and in text).
   3. Each equation gets a "Symbols in this equation" bar of chips with the same tooltips.
   4. Prose: Greek letters and a few acronyms are wrapped too (acronyms only on first use per lecture).
   The dictionary below is the single source for all of it. Values quoted come from CODATA 2018 (via Steck, rev. 2.3.4) and the references listed in the notes. */
(function () {
  'use strict';

  /* ---------------- dictionary ---------------- */
  // s: how the symbol looks in the tooltip, n: name, t: meaning, u: units / typical value, l: lecture where it matters
  var D = {
    hbar:   { s: 'ħ', n: 'Reduced Planck constant', t: 'ħ = h/2π. Converts angular frequency to energy: E = ħω.', u: '1.054 571 817… × 10⁻³⁴ J·s', l: 'P4' },
    h:      { s: 'h', n: 'Planck constant', t: 'Energy of a photon of frequency ν is E = hν.', u: '6.626 070 15 × 10⁻³⁴ J·s (exact)', l: 'L1' },
    nu:     { s: 'ν', n: 'Frequency', t: 'Cycles per second of the light (or of a transition). ν = c/λ, and ω = 2πν.', u: 'Hz. Rb D1: 377.107 THz', l: 'L1' },
    omega:  { s: 'ω', n: 'Angular frequency', t: 'ω = 2πν, radians per second. Phase advances by ωt. Beware: a frequency "in MHz" is usually ν; the same number in rad/s is 2π larger.', u: 'rad/s', l: 'L1' },
    omega0: { s: 'ω₀', n: 'Transition (resonance) angular frequency', t: 'Angular frequency that matches the energy gap of the atomic transition: ħω₀ = E_e − E_g.', u: 'rad/s. Rb D1: 2π × 377.107 THz', l: 'L3' },
    lambda: { s: 'λ', n: 'Wavelength', t: 'Distance over which the wave repeats. λ = c/ν. In vacuum for the Rb D1 line λ = 794.979 nm.', u: 'm', l: 'L1' },
    kwave:  { s: 'k', n: 'Wavenumber', t: 'k = 2π/λ: radians of phase per metre along the beam. The wavevector points along the propagation direction.', u: 'rad/m', l: 'L1' },
    kvec:   { s: 'k', n: 'Wavevector', t: 'A vector pointing along the beam with magnitude 2π/λ. The subscripts p and c mark probe and control. An atom with velocity v sees the light Doppler-shifted by −k·v (dot product).', u: 'rad/m', l: 'L9' },
    kB:     { s: 'k_B', n: 'Boltzmann constant', t: 'Links temperature to energy: thermal energy per degree of freedom is ½k_BT.', u: '1.380 649 × 10⁻²³ J/K (exact)', l: 'L9' },
    Efield: { s: 'E(z,t)', n: 'Electric field', t: 'The oscillating electric field of the light at position z and time t.', u: 'V/m', l: 'L1' },
    E0:     { s: 'E₀', n: 'Field amplitude', t: 'Peak electric field of the wave. Intensity is I = ½cε₀E₀².', u: 'V/m', l: 'L1' },
    Eph:    { s: 'E_photon', n: 'Photon energy', t: 'Energy carried by one photon: hν = hc/λ. At 795 nm it is 1.56 eV = 2.50 × 10⁻¹⁹ J.', u: 'J or eV', l: 'L1' },
    Phi:    { s: 'Φ', n: 'Photon flux', t: 'Photons per second in a beam of power P: Φ = P/hν. A 1 µW beam at 795 nm is about 4 × 10¹² photons/s.', u: 'photons/s', l: 'L1' },
    eps0:   { s: 'ε₀', n: 'Vacuum permittivity', t: 'Sets the strength of electric forces in vacuum; appears in I = ½cε₀E₀² and in dipole and decay formulas.', u: '8.854 187 817… × 10⁻¹² F/m', l: 'P5' },
    psi:    { s: '|ψ⟩', n: 'Quantum state', t: 'A vector that holds everything that can be known about the system. Written with kets |…⟩; a "bra" ⟨…| is its conjugate transpose.', u: 'dimensionless (normalised)', l: 'L2' },
    cj:     { s: 'c_j', n: 'Probability amplitude', t: 'Complex number multiplying basis state j. The probability of finding the system in j is |c_j|². The phase of c_j matters when amplitudes interfere.', u: 'complex number', l: 'L2' },
    Ej:     { s: 'E_j', n: 'Energy of level j', t: 'Each energy eigenstate evolves with phase e^(−iE_jt/ħ), so relative phases between levels rotate at (E_i − E_j)/ħ.', u: 'J', l: 'L2' },
    Omega:  { s: 'Ω', n: 'Rabi frequency', t: 'How strongly the light drives a transition: Ω = d·E₀/ħ (here the coupling term in the Hamiltonian is ħΩ/2). On resonance the population oscillates at Ω. Some books (including the EIT tutorial) use the coupling ħΩ instead, which differs by a factor 2.', u: 'rad/s', l: 'L3' },
    Omegap: { s: 'Ω_p', n: 'Probe Rabi frequency', t: 'Coupling strength of the weak probe beam on the |1⟩–|3⟩ transition. Kept small (Ω_p ≪ Ω_c) so EIT measures the medium without disturbing it.', u: 'rad/s', l: 'L7' },
    Omegac: { s: 'Ω_c', n: 'Control Rabi frequency', t: 'Coupling strength of the strong control beam on |2⟩–|3⟩. It sets the transparency window width (∝ Ω_c²) and the group velocity.', u: 'rad/s. Paper: Ω_c/2π = 1.9 MHz at 1.3 mW/cm²', l: 'L7' },
    OmegaR: { s: 'Ω_R', n: 'Vacuum Rabi splitting (frequency)', t: 'Splitting between the two polariton peaks when emitters and a cavity mode are strongly coupled; 2g√N for N emitters.', u: 'rad/s', l: 'L12' },
    OmegaEff: { s: 'Ω_eff', n: 'Torque vector of the drive', t: 'On the Bloch sphere the laser makes the state rotate about the axis Ω_eff = (Ω, 0, −Δ) at angular speed √(Ω² + Δ²).', u: 'rad/s', l: 'L3' },
    Delta:  { s: 'Δ', n: 'Detuning', t: 'Laser frequency minus atomic resonance frequency: Δ = ω − ω₀. Δ = 0 is exact resonance.', u: 'rad/s or Hz', l: 'L3' },
    delta:  { s: 'δ', n: 'Two-photon detuning', t: 'Difference between the probe-control frequency difference and the ground-state splitting. EIT appears at δ = 0 (Raman resonance).', u: 'Hz or rad/s', l: 'L7' },
    deltaDop: { s: 'δ_Dop', n: 'Residual (two-photon) Doppler shift', t: 'For an atom with velocity v the two-photon resonance shifts by (k_p − k_c)·v. Nearly co-propagating beams make this tiny.', u: 'Hz', l: 'L9' },
    H:      { s: 'Ĥ', n: 'Hamiltonian', t: 'The operator for the total energy. It sets how the state evolves: iħ d|ψ⟩/dt = Ĥ|ψ⟩. The RWA version is written in a frame rotating with the laser.', u: 'J', l: 'P4' },
    Pe:     { s: 'P_e', n: 'Excited-state population', t: 'Probability of finding the atom in |e⟩. In Rabi flopping it oscillates between 0 and Ω²/(Ω² + Δ²).', u: 'dimensionless, 0 to 1', l: 'L3' },
    rho:    { s: 'ρ̂', n: 'Density matrix', t: 'Describes a statistical mixture of states. Diagonal elements are populations, off-diagonal elements are coherences.', u: 'dimensionless', l: 'L4' },
    rhoee:  { s: 'ρ_ee', n: 'Excited-state population', t: 'Fraction of atoms in |e⟩ (diagonal element of the density matrix).', u: '0 to 1', l: 'L4' },
    rhogg:  { s: 'ρ_gg', n: 'Ground-state population', t: 'Fraction of atoms in |g⟩.', u: '0 to 1', l: 'L4' },
    rhoeg:  { s: 'ρ_eg', n: 'Optical coherence', t: 'Off-diagonal element that measures how well-defined the relative phase between |e⟩ and |g⟩ is. It decays at Γ/2 from spontaneous emission alone.', u: 'complex number', l: 'L4' },
    rho12:  { s: 'ρ₁₂', n: 'Ground-state (spin) coherence', t: 'Coherence between the two lower states |1⟩ and |2⟩. It is the quantity EIT and memories store; its decay rate γ₁₂ sets storage time.', u: 'complex number', l: 'L7' },
    sigmahat: { s: 'σ̂', n: 'Lowering operator |g⟩⟨e|', t: 'Takes the atom from |e⟩ to |g⟩. Its Lindblad term describes spontaneous emission at rate Γ.', u: 'operator', l: 'L4' },
    Gamma:  { s: 'Γ', n: 'Spontaneous decay rate', t: 'Rate at which the excited-state population decays (natural linewidth, FWHM, is Γ/2π in Hz). Rb D1: Γ = 36.129 × 10⁶ s⁻¹, Γ/2π = 5.750 MHz (Steck).', u: 's⁻¹', l: 'L4' },
    Gammatt:{ s: 'Γ_tt', n: 'Transit-time broadening', t: 'Atoms leave the beam after about w₀/v_th (ballistic) or w₀²/D (diffusive with buffer gas), which limits the coherence time.', u: 'Hz', l: 'L9' },
    gamma:  { s: 'γ', n: 'Decoherence rate', t: 'Rate at which a coherence decays. Subscripts name the pair of states: γ₁₂ (ground states) is tiny, γ₁₃ (optical) is of order MHz or more.', u: 's⁻¹ or Hz', l: 'L4' },
    gamma12:{ s: 'γ₁₂', n: 'Ground-state decoherence rate', t: 'Decay rate of the coherence between the two ground states. It sets the narrowest EIT line and the storage time. Typically kHz or less.', u: 'Hz', l: 'L7' },
    gamma13:{ s: 'γ₁₃', n: 'Optical decoherence rate', t: 'Decay rate of the coherence between a ground state and the excited state: Γ/2 plus collisional broadening.', u: 'Hz', l: 'L7' },
    gammaEIT:{ s: 'γ_EIT', n: 'EIT linewidth (HWHM)', t: 'Half width of the transparency window: γ₁₂ plus power broadening |Ω_c|²/γ₁₃ (or / σ_Dop in a Doppler-broadened vapour).', u: 'Hz', l: 'L7' },
    chi:    { s: 'χ', n: 'Electric susceptibility', t: 'How strongly the medium polarizes: P = ε₀χE. The real part χ′ changes the phase velocity (refractive index n ≈ 1 + χ′/2), the imaginary part χ″ gives absorption.', u: 'dimensionless', l: 'L6' },
    nat:    { s: 'n_at', n: 'Atom number density', t: 'Number of atoms per unit volume. It rises steeply with cell temperature.', u: 'm⁻³ or cm⁻³', l: 'L6' },
    OD:     { s: 'OD', n: 'Optical depth', t: 'Natural-log absorption exponent: transmission = e^(−OD). Not the same as a filter "OD" (base 10): OD(e) = 2.303 × OD(10), and 1 OD(e) = 4.34 dB.', u: 'dimensionless', l: 'L6' },
    I0:     { s: 'I₀', n: 'Incident intensity', t: 'Power per unit area entering the medium.', u: 'W/m² or mW/cm²', l: 'L6' },
    ng:     { s: 'n_g', n: 'Group index', t: 'Ratio c/v_g. Steep dispersion inside the EIT window makes it enormous.', u: 'dimensionless', l: 'L8' },
    vg:     { s: 'v_g', n: 'Group velocity', t: 'Speed of the pulse envelope: v_g = c/n_g. Inside the EIT window v_g = c cos²θ for the polariton picture.', u: 'm/s', l: 'L8' },
    tauDelay: { s: 'τ_delay', n: 'Group delay', t: 'Extra time the pulse spends in the medium: about OD_EIT/γ_EIT.', u: 's', l: 'L8' },
    theta:  { s: 'θ', n: 'Mixing angle', t: 'Sets how much of the polariton is light (cos θ) and how much is atomic spin wave (sin θ). Turning the control off drives θ to 90°.', u: 'rad', l: 'L8' },
    Psi:    { s: 'Ψ̂', n: 'Dark-state polariton', t: 'Mixture of the probe field and the collective ground-state coherence: Ψ̂ = cos θ Ê − sin θ √N ρ̂₁₂.', u: 'field operator', l: 'L8' },
    Ehat:   { s: 'Ê', n: 'Probe field operator', t: 'Quantum field amplitude of the probe, normalised to photons per unit length.', u: 'operator', l: 'L8' },
    gF:     { s: 'g_F', n: 'Hyperfine Landé g-factor', t: 'Sets the magnetic response of level F. ⁸⁷Rb 5S₁/₂: g_F = +½ for F = 2 and −½ for F = 1, i.e. ±0.70 MHz/G (Steck).', u: 'dimensionless', l: 'L5' },
    mF:     { s: 'm_F', n: 'Magnetic quantum number', t: 'Projection of the total angular momentum F on the field axis, one of 2F + 1 values from −F to +F.', u: 'dimensionless', l: 'L5' },
    muB:    { s: 'µ_B', n: 'Bohr magneton', t: 'Natural unit of magnetic moment of the electron: µ_B/h = 1.399 624 49 MHz/G.', u: '9.274 010 078 × 10⁻²⁴ J/T', l: 'L5' },
    EZ:     { s: 'ΔE_Z', n: 'Zeeman shift', t: 'Energy shift of sublevel m_F in a field B (weak-field regime): g_Fµ_Bm_FB.', u: 'J, or MHz via /h', l: 'L5' },
    sigmaPol: { s: 'σ±', n: 'Circular polarization / photon helicity', t: 'σ⁺ photons carry +ħ angular momentum along the quantization axis (raise m_F by 1), σ⁻ carry −ħ (lower m_F by 1). π light (linear along the field) leaves m_F unchanged.', u: '—', l: 'L5' },
    sigmaxs:{ s: 'σ', n: 'Absorption cross-section', t: 'Effective area an atom presents to resonant light. Optical depth is OD = ∫ n_at σ dz.', u: 'm² or cm²', l: 'L6' },
    sigmaDop:{ s: 'σ_Dop', n: 'Doppler width', t: 'One-photon Doppler broadening in angular frequency units: σ_Dop = v_th k. About 2π × 225 MHz for ⁸⁷Rb at 60 °C.', u: 'rad/s', l: 'L9' },
    vth:    { s: 'v_th', n: 'Thermal speed', t: 'One-dimensional rms velocity √(k_BT/m) of the atoms. About 179 m/s for ⁸⁷Rb at 333 K.', u: 'm/s', l: 'L9' },
    w0:     { s: 'w₀', n: 'Beam waist radius', t: 'Radius at which the intensity falls to 1/e² of its peak, at the beam focus. It sets the transit time and the beam intensity.', u: 'm or mm', l: 'L13' },
    Dcoef:  { s: 'D', n: 'Diffusion coefficient', t: 'Describes how fast atoms diffuse through buffer gas. About 10 cm²/s for Rb in 10 Torr of Ne (EIT tutorial).', u: 'cm²/s', l: 'L9' },
    eta:    { s: 'η', n: 'Memory efficiency', t: 'Fraction of the input energy (or photons) retrieved. η₀ is the efficiency at zero storage time.', u: '0 to 1', l: 'L10' },
    Tmem:   { s: 'T_mem', n: 'Memory lifetime', t: 'Time constant of the decay of retrieval efficiency with storage time.', u: 's', l: 'L10' },
    fidel:  { s: 'ℱ', n: 'Fidelity', t: 'Overlap |⟨ψ_in|ψ_out⟩|² between the state stored and the state retrieved (for pure states).', u: '0 to 1', l: 'L10' },
    tau:    { s: 'τ', n: 'Time', t: 'Storage time or lifetime, depending on context (the equation says which).', u: 's', l: 'L8' },
    nbar:   { s: 'n̄', n: 'Mean photon number', t: 'Average number of photons per pulse or mode. A Poissonian (coherent) source with n̄ = 1 still sometimes gives 0 or 2+ photons.', u: 'dimensionless', l: 'L11' },
    g2:     { s: 'g⁽²⁾(0)', n: 'Second-order correlation at zero delay', t: 'Compares the chance of two photons at the same time with independent arrivals. Coherent light: 1; thermal: 2; ideal single photon: 0.', u: 'dimensionless', l: 'L11' },
    adag:   { s: 'â, â†', n: 'Annihilation and creation operators', t: 'â removes a photon from a mode, â† adds one. [â, â†] = 1. The photon number operator is â†â.', u: 'operators', l: 'P5' },
    alphaC: { s: 'α', n: 'Coherent-state amplitude', t: 'Complex number labelling a coherent state |α⟩. The mean photon number is |α|², and the photon number is Poisson-distributed.', u: 'dimensionless', l: 'P5' },
    kappa:  { s: 'κ', n: 'Cavity loss rate', t: 'Rate at which photons leak out of the cavity.', u: 's⁻¹', l: 'L12' },
    gcoup:  { s: 'g', n: 'Light-matter coupling strength', t: 'Rate of coherent energy exchange between one emitter and the light mode. N emitters coupled to one mode give g√N.', u: 's⁻¹', l: 'L12' },
    coop:   { s: 'C', n: 'Cooperativity', t: 'C = 4g²/(κγ). C > 1 means the coherent coupling beats the loss channels.', u: 'dimensionless', l: 'L12' },
    Wig:    { s: 'W(x,p)', n: 'Wigner function', t: 'Quasi-probability distribution of a field mode over the quadratures x and p. It can go negative, which signals non-classical states.', u: '—', l: 'L11' },
    Stokes: { s: 'S₀…S₃', n: 'Stokes parameters', t: 'Four real numbers that describe polarization: S₀ = total intensity, S₁ = H−V, S₂ = D−A, S₃ = right−left circular. S₁² + S₂² + S₃² = S₀² for fully polarized light.', u: 'W or normalised', l: 'L13' },
    zR:     { s: 'z_R', n: 'Rayleigh range', t: 'Distance from the waist over which a Gaussian beam stays roughly collimated (its area doubles at z_R): z_R = πw₀²/λ.', u: 'm', l: 'L13' },
    alphaAbs: { s: 'α_abs', n: 'Absorption coefficient', t: 'Intensity falls as e^(−α_abs z). Optical depth is OD = α_abs L.', u: 'm⁻¹', l: 'L6' },
    // acronyms (used in prose)
    EIT:    { s: 'EIT', n: 'Electromagnetically induced transparency', t: 'A strong control beam makes an otherwise opaque medium transparent to a weak probe in a narrow window, by quantum interference.', u: '', l: 'L7' },
    CPT:    { s: 'CPT', n: 'Coherent population trapping', t: 'Atoms driven by two fields fall into a dark superposition that cannot absorb light and stay there.', u: '', l: 'L7' },
    RWA:    { s: 'RWA', n: 'Rotating-wave approximation', t: 'Drop terms that oscillate at about 2ω in a frame rotating with the laser; valid when Ω, Δ ≪ ω.', u: '', l: 'L3' },
    DFB:    { s: 'DFB', n: 'Distributed-feedback laser', t: 'Diode laser with a grating built into the chip, giving a single narrow line that tunes with current and temperature (no piezo).', u: '', l: 'L13' },
    SAS:    { s: 'SAS', n: 'Saturated-absorption spectroscopy', t: 'A strong pump saturates atoms near zero velocity so a counter-propagating probe sees narrow Doppler-free dips; used as the frequency reference.', u: '', l: 'L13' },
    AOM:    { s: 'AOM', n: 'Acousto-optic modulator', t: 'A crystal in which sound diffracts light and shifts its frequency by the sound frequency; used to switch and shift beams.', u: '', l: 'L13' },
    PBS:    { s: 'PBS', n: 'Polarizing beamsplitter', t: 'Transmits horizontal polarization and reflects vertical.', u: '', l: 'L13' }
  };

  /* ---------------- patterns: LaTeX token -> key (most specific first) ---------------- */
  var TP = [
    [/\\mathrm\{OD\}(?:_\{[^}]*\})?/, 'OD'],
    [/g\^\{\(2\)\}\(0\)/, 'g2'],
    [/\\vec\\Omega_\{\\rm eff\}|\\Omega_\{\\rm eff\}/, 'OmegaEff'],
    [/\\Omega_p/, 'Omegap'], [/\\Omega_c/, 'Omegac'], [/\\Omega_R/, 'OmegaR'], [/\\Omega(?![A-Za-z_])/, 'Omega'],
    [/\\delta_\{\\rm Dop\}\^\{\(2\)\}/, 'deltaDop'],
    [/\\hat\\rho/, 'rho'], [/\\rho_\{ee\}/, 'rhoee'], [/\\rho_\{gg\}/, 'rhogg'], [/\\rho_\{eg\}|\\rho_\{ge\}/, 'rhoeg'], [/\\hat\\rho_\{12\}|\\rho_\{12\}/, 'rho12'], [/\\rho(?![A-Za-z_])/, 'rho'],
    [/\\hat\\sigma\^\\dagger|\\sigma\^\\dagger\\hat\\sigma|\\hat\\sigma/, 'sigmahat'],
    [/\\sigma\^\\pm/, 'sigmaPol'],
    [/\\sigma_\{\\rm Dop\}/, 'sigmaDop'], [/\\sigma(?![A-Za-z_^])/, 'sigmaxs'],
    [/\\hat H_\{\\rm RWA\}|\\hat H/, 'H'], [/H_\{\\rm RWA\}/, 'H'],
    [/\\gamma_\{\\rm EIT\}/, 'gammaEIT'], [/\\gamma_\{12\}/, 'gamma12'], [/\\gamma_\{13\}/, 'gamma13'], [/\\gamma(?![A-Za-z_])/, 'gamma'],
    [/\\Gamma_\{tt\}/, 'Gammatt'], [/\\Gamma(?![A-Za-z_])/, 'Gamma'],
    [/\\tau_\{\\rm delay\}/, 'tauDelay'], [/\\tau(?![A-Za-z_])/, 'tau'],
    [/\\eta_0|\\eta(?![A-Za-z_])/, 'eta'],
    [/T_\{\\rm mem\}/, 'Tmem'],
    [/\\mathcal\{F\}|\\mathcal F/, 'fidel'],
    [/\\hat\{\\mathcal E\}|\\hat\\mathcal\{E\}/, 'Ehat'],
    [/\\hat\\Psi|\\Psi/, 'Psi'],
    [/\\hat a\^\\dagger|\\hat a/, 'adag'],
    [/\\bar n|\\bar\{n\}/, 'nbar'],
    [/\\alpha_\{\\rm abs\}/, 'alphaAbs'], [/\\alpha(?![A-Za-z_])/, 'alphaC'],
    [/\\kappa/, 'kappa'],
    [/\\chi'{0,2}/, 'chi'],
    [/\\mu_B/, 'muB'], [/E_\{\\rm Z\}/, 'EZ'], [/g_F/, 'gF'], [/m_F/, 'mF'],
    [/\\theta(?![A-Za-z_])/, 'theta'],
    [/\\Delta(?![A-Za-z_])/, 'Delta'], [/\\delta(?![A-Za-z_])/, 'delta'],
    [/\\omega_0|\\omega_\{0\}/, 'omega0'], [/\\omega(?![A-Za-z_])/, 'omega'],
    [/\\nu(?![A-Za-z_])/, 'nu'], [/\\lambda(?![A-Za-z_])/, 'lambda'],
    [/\\hbar/, 'hbar'],
    [/\\Phi(?![A-Za-z_])/, 'Phi'],
    [/\\epsilon_0|\\varepsilon_0/, 'eps0'],
    [/\\psi(?:_\{\\rm [a-z]+\})?|\\Psi/, 'psi'],
    [/E_\{\\rm photon\}/, 'Eph'], [/E_0/, 'E0'], [/E_j/, 'Ej'], [/c_[gej]/, 'cj'],
    [/v_\{\\rm th\}/, 'vth'], [/v_g/, 'vg'], [/n_g/, 'ng'], [/n_\{\\rm at\}/, 'nat'],
    [/k_B/, 'kB'], [/k_[pc]/, 'kvec'], [/\\vec k/, 'kvec'],
    [/w_0/, 'w0'], [/I_0/, 'I0'], [/z_R/, 'zR'],
    [/W\(x,p\)/, 'Wig'],
    [/C(?==\\frac)/, 'coop'],
    [/(?<![\\A-Za-z_{}])g(?=\^2N|\\gg|\\sqrt)/, 'gcoup'],
    [/(?<![\\A-Za-z_{}])D(?=\/w_0)/, 'Dcoef'],
    [/(?<![\\A-Za-z_{}])h(?=\\nu)/, 'h'],
    [/(?<![\\A-Za-z_{}])k(?=\s*=|z\b)/, 'kwave']
  ];
  var ALT = new RegExp(TP.map(function (p) { return '(' + p[0].source + ')'; }).join('|'), 'g');   // one capture group per pattern
  function keyFromGroups(args) { for (var i = 1; i <= TP.length; i++) if (args[i] !== undefined) return TP[i - 1][1]; return null; }

  /* ---------------- 1. equations: wrap symbols before MathJax ---------------- */
  var ARGPOS = /\\(?:(?:[td]?frac|binom)\s*(?:\{[^{}]*\}|\\[A-Za-z]+|[^\\\s{])?|mathcal|mathbf|mathrm|mathbb|hat|vec|bar|dot|ddot|tilde|overline|underline|sqrt)\s*$/;
  var MASK = [];
  function maskText(s) { return s.replace(/\\(?:text|mathrm|rm)\s*\{[^{}]*\}/g, function (m) { MASK.push(m); return '\u0001' + (MASK.length - 1) + '\u0002'; }); }
  function unmask(s) { return s.replace(/\u0001(\d+)\u0002/g, function (_, i) { return MASK[+i]; }); }
  function wrapEq(tex, found) {
    // OD is written \mathrm{OD}: handle it before masking text
    var parts = [], out = '', last = 0;
    var odRe = /\\mathrm\{OD\}(?:_\{[^}]*\})?/g, m;
    var pieces = [], idx = 0;
    while ((m = odRe.exec(tex))) { pieces.push([false, tex.slice(idx, m.index)]); pieces.push([true, m[0]]); idx = m.index + m[0].length; }
    pieces.push([false, tex.slice(idx)]);
    return pieces.map(function (p) {
      if (p[0]) { found['OD'] = 1; return '\\class{sym s-OD}{' + p[1] + '}'; }
      var s = maskText(p[1]);
      s = s.replace(ALT, function () {
        var tok = arguments[0], k = keyFromGroups(arguments), off = arguments[TP.length + 1], str = arguments[TP.length + 2];
        if (!k) return tok;
        found[k] = 1;
        var w = '\\class{sym s-' + k + '}{' + tok + '}';
        // a bare macro argument (\frac\Gamma2, \mathcal E_0, \hat x ...) must stay one group: wrap in braces
        return ARGPOS.test(str.slice(0, off)) ? '{' + w + '}' : w;
      });
      return unmask(s);
    }).join('');
  }
  function processEquations() {
    document.querySelectorAll('.eq').forEach(function (eq) {
      var html = eq.innerHTML, a = html.indexOf('\\['), b = html.lastIndexOf('\\]');
      if (a < 0 || b < 0) return;
      var found = {}, body = html.slice(a + 2, b);
      MASK = [];
      var wrapped = wrapEq(body, found);
      eq.innerHTML = html.slice(0, a + 2) + wrapped + html.slice(b);
      var keys = Object.keys(found).filter(function (k) { return D[k]; });
      if (keys.length) {
        var bar = document.createElement('div'); bar.className = 'symbar';
        bar.innerHTML = '<span class="symbar-l">Symbols (hover, focus or tap):</span>' + keys.map(function (k) {
          return '<button type="button" class="symchip sym s-' + k + '" aria-label="' + D[k].n + '">' + D[k].s + '</button>';
        }).join('');
        eq.insertAdjacentElement('afterend', bar);
      }
    });
  }

  /* ---------------- 2. prose: wrap Greek letters and first-use acronyms ---------------- */
  var GREEK = [
    [/Ω/g, 'Omega'], [/Δ/g, 'Delta'], [/Γ/g, 'Gamma'], [/γ/g, 'gamma'], [/χ/g, 'chi'], [/ρ/g, 'rho'], [/κ/g, 'kappa'], [/ħ/g, 'hbar'],
    [/ν/g, 'nu'], [/ω/g, 'omega'], [/λ/g, 'lambda'], [/τ/g, 'tau'], [/θ/g, 'theta'], [/δ/g, 'delta'], [/η/g, 'eta'], [/Φ/g, 'Phi'], [/Ψ/g, 'Psi'],
    [/σ(?![⁺⁻±])/g, 'sigmaxs'], [/σ(?=[⁺⁻±])/g, 'sigmaPol']
  ];
  var ACR = [[/\bEIT\b/, 'EIT'], [/\bCPT\b/, 'CPT'], [/\bRWA\b/, 'RWA'], [/\bDFB\b/, 'DFB'], [/\bSAS\b/, 'SAS'], [/\bAOM\b/, 'AOM'], [/\bPBS\b/, 'PBS'], [/\bOD\b/, 'OD']];
  var SKIP = 'A,SUMMARY,BUTTON,SCRIPT,STYLE,MJX-CONTAINER,CANVAS,INPUT,SELECT,OUTPUT,LABEL,KBD,TEXTAREA,H1,H2,H3,H4,.sym,.tag,.lab,.symbar,.viz3d,.src,.lec-num,.toc,.hero,.docbar,.spec,.bib,.cite'.split(',');
  function skipNode(n) {
    for (var e = n.parentNode; e && e !== document.body; e = e.parentNode) {
      if (e.nodeType !== 1) continue;
      if (SKIP.indexOf(e.tagName) >= 0) return true;
      for (var i = 0; i < SKIP.length; i++) if (SKIP[i][0] === '.' && e.classList.contains(SKIP[i].slice(1))) return true;
    }
    return false;
  }
  function processProse() {
    var roots = document.querySelectorAll('.prose, .worked, .ana, .goals, .note, .deeper, details.q .ans');
    roots.forEach(function (root) {
      var lec = root.closest('.lec'); var seen = lec ? (lec._seen = lec._seen || {}) : {};
      var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = tw.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        if (skipNode(node)) return;
        var txt = node.nodeValue;
        if (!/[ΩΔΓγχρκħνωλτθδηΦΨσEITCPRWADFBSOMOD]/.test(txt)) return;
        var spans = [];
        GREEK.forEach(function (g) { var m; g[0].lastIndex = 0; while ((m = g[0].exec(txt))) spans.push({ i: m.index, e: m.index + m[0].length, k: g[1] }); });
        ACR.forEach(function (a) { var m = a[0].exec(txt); if (m && !seen[a[1]]) { seen[a[1]] = 1; spans.push({ i: m.index, e: m.index + m[0].length, k: a[1] }); } });
        if (!spans.length) return;
        spans.sort(function (x, y) { return x.i - y.i; });
        var frag = document.createDocumentFragment(), pos = 0;
        spans.forEach(function (sp) {
          if (sp.i < pos) return;
          frag.appendChild(document.createTextNode(txt.slice(pos, sp.i)));
          var s = document.createElement('span'); s.className = 'sym s-' + sp.k + ' symtxt'; s.tabIndex = 0; s.textContent = txt.slice(sp.i, sp.e); frag.appendChild(s); pos = sp.e;
        });
        frag.appendChild(document.createTextNode(txt.slice(pos)));
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  /* ---------------- 3. tooltip ---------------- */
  var tip;
  function build() {
    tip = document.createElement('div'); tip.id = 'symtip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  }
  function keyFromEl(el) {
    var c = el.getAttribute && el.getAttribute('class') || ''; var m = c.match(/(?:^|\s)s-([A-Za-z0-9]+)/); return m ? m[1] : null;
  }
  function show(el) {
    var k = keyFromEl(el); if (!k || !D[k]) return;
    var d = D[k], r = el.getBoundingClientRect();
    tip.innerHTML = '<div class="st-h"><span class="st-s">' + d.s + '</span> <b>' + d.n + '</b></div><p>' + d.t + '</p>' + (d.u ? '<div class="st-u">' + d.u + '</div>' : '') + (d.l ? '<div class="st-l">Learn more: <a href="#' + d.l + '">' + (d.l[0] === 'P' ? 'Primer ' : 'Lecture ') + d.l + '</a></div>' : '');
    tip.hidden = false;
    var tw = tip.offsetWidth, th = tip.offsetHeight, x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    var y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  var hideT;
  function hide() { clearTimeout(hideT); hideT = setTimeout(function () { tip.hidden = true; }, 120); }
  function wire() {
    document.addEventListener('mouseover', function (e) { var el = e.target.closest ? e.target.closest('.sym') : null; if (el) { clearTimeout(hideT); show(el); } });
    document.addEventListener('mouseout', function (e) { var el = e.target.closest ? e.target.closest('.sym') : null; if (el) hide(); });
    document.addEventListener('focusin', function (e) { var el = e.target.closest ? e.target.closest('.sym') : null; if (el) show(el); });
    document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.sym')) hide(); });
    document.addEventListener('click', function (e) { var el = e.target.closest ? e.target.closest('.sym') : null; if (el) { show(el); e.stopPropagation(); } else if (!e.target.closest('#symtip')) tip.hidden = true; });
    tip.addEventListener('mouseenter', function () { clearTimeout(hideT); }); tip.addEventListener('mouseleave', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tip.hidden = true; });
    window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });
  }

  /* ---------------- 4. appendix table ---------------- */
  function table() {
    var host = document.getElementById('symTable'); if (!host) return;
    var order = Object.keys(D);
    host.innerHTML = '<div class="scroll-x"><table class="symtbl"><thead><tr><th>Symbol</th><th>Name</th><th>Meaning</th><th>Units / value</th><th>Where</th></tr></thead><tbody>' +
      order.map(function (k) { var d = D[k]; return '<tr><td class="sm">' + d.s + '</td><td>' + d.n + '</td><td>' + d.t + '</td><td>' + (d.u || '') + '</td><td>' + (d.l ? '<a href="#' + d.l + '">' + d.l + '</a>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  window.LectureSymbols = { dict: D, table: table, _wrap: function (t) { MASK = []; var f = {}; return { tex: wrapEq(t, f), keys: Object.keys(f) }; } };
  function init() { build(); wire(); processEquations(); processProse(); table(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
