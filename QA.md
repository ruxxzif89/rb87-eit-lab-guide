# Questions and answers
Working notes from the project, written 9 Oct 2026. Numbers come from datasheets, the cited papers and this guide's simulator; check them against the vendor documents before ordering or building. No prices on this page. This file is generated from `private/build_qa.py` and mirrors section 09 of the guide.

## The laser

### Q1. Is our 795 nm DFB laser the right specification?

*Added 9 Oct 2026*

**Yes. It is the manufacturer's Rb D1 spectroscopy part** (Toptica Eagleyard EYP-DFB-0795-00015-1500-BFY12-0005, datasheet revision 0.93, 5 Feb 2025). Nothing in the datasheet rules it out.

| Our need | Datasheet | Fit |
|---|---|---|
| Rb-87 D1 line, 794.978 nm | target 794.98 nm reachable at 10–45 °C chip temperature at 15 mW; 0.06 nm/K | yes |
| About 1 mW at the cell | 5–15 mW out of the fibre; 160 mA typical for 15 mW | yes, about 5× margin |
| Linewidth well below about 100 MHz | 0.6 typical, 1.0 MHz at 15 mW | yes |
| Lock range | mode-hop-free over more than 10 GHz; current tuning about 1.4 GHz/mA | yes |
| Single mode | side-mode suppression 30 dB minimum, 45 typical | yes |
| Clean polarization | 20 dB extinction, PM fibre, FC/APC narrow key | yes |
| Protection | built-in micro-isolator (no figure given) plus our fibre isolator | yes |

**What keeps it from perfect**
- Thin current margin: 15 mW needs 160 mA and the absolute maximum is 170 mA. Set the controller limit to 165–170 mA and run near 10–12 mW for lifetime.
- The ITC502 thermistor input reads up to 19.9 kΩ and this thermistor is about 20 kΩ at 10 °C: keep the chip at 15 °C or warmer.
- Toptica Eagleyard lists the part as about to become obsolete (replacement "on request"): consider a spare.
- The datasheet is a preliminary revision (below 1.0), all figures at beginning of life; the individual test protocol that ships with each laser is what counts.
- The label says Class 4 (20 mW, IEC 60825-1).
- Not stated: isolation of the micro-isolator in dB, the fibre type, how the linewidth was measured.

**On arrival check:** the test protocol (wavelength against temperature at 15 mW, operating current, extinction ratio), single-mode operation on the spectrum analyser, that the wavelength lands on the Rb D1 line on the SAS signal, and the fibre key alignment.

Sources: [Eagleyard datasheet](https://global-topticaeagleyard.b-cdn.net/wp-content/uploads/data_sheets/EYP-DFB-0795-00015-1500-BFY12-0005.pdf) · [Steck, Rb-87 D line data](https://steck.us/alkalidata/rubidium87numbers.pdf)

### Q2. What laser power do we actually need?

*Added 9 Oct 2026*

**About 1 mW of control light at the cell and under 1 µW of probe, which means 5–15 mW at the laser fibre.** The 15 mW part is the right size and a 40 mW laser would be wasted.

| Beam | Intensity in the papers | Power needed at the cell |
|---|---|---|
| Control (1/e² radius 2.55 mm) | 1.3–5.5 mW/cm² | 0.13–0.56 mW if that is the peak intensity, 0.27–1.1 mW if it is power over area (the paper does not say) |
| Probe (radius 0.47 mm) | about 0.12 mW/cm² | under 1 µW |
| SAS lock | the simulator gets 0.09 mW on the photodiode | about 0.2–0.5 mW picked off |

More control power only broadens the line: the EIT width grows by about 4.5 kHz per extra mW/cm². The DeRose experiment ran with about 7 mW out of its fibre.

**Where the light goes** (10 mW laser): fibre isolator and connectors ×0.8, 5 % pick-off to the SAS, about 88 % to the control arm, then the double-pass AOM and optics. With realistic AOMs (about 70 % per pass) the control at the cell is about 3 mW, so even a 5 mW laser gives about 1.6 mW. The simulator is pessimistic (35 % per pass): 10 mW gives 0.75 mW and 15 mW gives about 1.1 mW, still enough.

**So:** minimum about 5 mW, comfortable 10–15 mW, not needed 20–40 mW. Measure the double-pass AOM efficiency (the biggest unknown) and the power at the cell with the power meter; turn the control down with the half-wave plate or the AOM RF level if it exceeds about 1 mW.

### Q3. Why not an ECDL?

*Added 9 Oct 2026*

**A DFB is good enough for this experiment and much cheaper and simpler. An ECDL would be a luxury, not a requirement.**

| | DFB (our choice) | ECDL |
|---|---|---|
| Linewidth | 0.6–1 MHz | a few hundred kHz |
| Tuning | mode-hop-free over more than 10 GHz by current and temperature | wide, but piezo and grating alignment |
| Build | one sealed, fibre-pigtailed butterfly with isolator | open cavity, more sensitive to vibration, mode hops |
| Lock actuator | laser current (fast and simple) | piezo plus current feed-forward |
| Cost | the lower one | typically several times more |

**Why a DFB is enough:**
- The papers only ask for a linewidth far below the Doppler width (about 500 MHz), and 1 MHz passes easily.
- The 10 Torr Ne buffer gas makes the optical line wider still (order 100 MHz).
- The narrow 7–26 kHz EIT line depends on the control–probe phase relation, not on the laser's own linewidth; both beams share the laser's noise (my reasoning, not quoted from a paper).
- We need only about 1 mW at the cell.

**When an ECDL would be better:** driver current noise turning into linewidth (1 µA is about 1.4 MHz), scanning several GHz or other lines, a replacement if the DFB is no longer available, or an ECDL already in the building.

### Q4. Why do the reference papers use ECDLs and not DFB lasers?

*Added 9 Oct 2026*

**No sentence in either paper says why, so this is partly inference.** What they do say: ECDLs have a linewidth of a few hundred kHz, DFBs about 1–2 MHz, and either is fine for EIT.

Likely reasons (my judgment):
- **Installed base:** atomic-physics labs have used ECDLs for decades and these groups already own several.
- **Reuse:** an ECDL covers other wavelengths and atoms and scans over several GHz.
- **Narrower line:** more margin for sub-Doppler spectroscopy, not needed for EIT.
- **Wavelength availability:** DFB diodes exactly on the Rb D1 line used to be less common.
- **Teaching setup:** the DeRose paper is an undergraduate set-up where students scan the laser by hand.

None applies strongly to us: one fixed target line, no existing ECDL, and a budget. For a real answer, ask the authors.

### Q5. Is a narrow laser linewidth crucial for EIT?

*Added 9 Oct 2026*

**No, not the laser's own linewidth.** Two different linewidths get mixed up:
- **The EIT linewidth** is the narrow one (7.3 kHz at 1.3 mW/cm², 26 kHz at 5.5 mW/cm²). It is set by control intensity, magnetic field, buffer-gas diffusion and coherence time, not by the laser.
- **The laser linewidth** only has to be well below the optical width of the atoms (Doppler about 500 MHz, wider with buffer gas). Our 0.6–1 MHz is 100× below.

What matters more (my reasoning):
- **Relative phase of control and probe.** Both come from the same laser through phase-locked RF, so the laser's phase noise is common to both and cancels. A 1 m path difference (about 3 ns) at 1 MHz linewidth gives only about 0.02 rad. What reaches the atoms is noise from the RF source and drift in the arm lengths.
- **Lock stability.** The laser must stay within a fraction of the optical width; the DeRose paper reports drift of about 10 MHz per hour and negligible drift during data taking.

A narrower laser helps only with a very noisy driver or sub-Doppler spectroscopy at the few-MHz level; the SAS features are 6–12 MHz wide (the D1 natural width is 5.75 MHz), which a 1–2 MHz laser resolves.

### Q6. What linewidths and frequencies do we have to set?

*Added 9 Oct 2026*

| Item | Value |
|---|---|
| Rb-87 D1 line | 794.978851 nm in vacuum (about 377.107 THz) |
| Control AOM | 80.000 MHz, double pass, so +160.000 MHz |
| Probe AOM | 79.965 MHz, double pass, so +159.930 MHz |
| Control–probe difference | 70 kHz, the ground-state splitting at 50 mG (1.4 kHz per mG) |
| Solenoid field | about 50 mG (the photographed COILS supply showed about 80 mA) |
| Lock dither | about 10–100 kHz on the laser current (the ITC502 modulation covers 0–500 kHz) |
| Excited-state splitting | 814.5 MHz (F′=1 to F′=2) |
| Ground-state splitting | 6.8347 GHz, never needed by the AOMs |
| EIT linewidth target | 30 kHz or narrower, approaching 10 kHz at low power |
| Laser linewidth | 0.6–1.0 MHz (needs only to be below about 100 MHz) |
| SAS feature width | about 6–12 MHz |

Because the offset between the two beams is only kHz, a generator with 1 Hz resolution is far more than precise enough. The control–probe difference must stay steady to well under the EIT width (a few kHz): use one two-channel source, or sources sharing a clock.

## Laser controller

### Q7. Is a DFB with a TEC and laser controller good enough? Which controller?

*Added 9 Oct 2026*

**Yes, if the current noise is low.** The rule: the laser tunes at about 1.4 GHz per mA, so every 1 µA rms of driver noise can become about 1.4 MHz of linewidth.

| Controller | Noise | Verdict |
|---|---|---|
| G&H EM595 | 5 µA rms (10 Hz–10 MHz) | usable, up to about 7 MHz worst case, the noisiest |
| Thorlabs ITC502 | under 1.5 µA rms | about 2 MHz worst case: best match |
| ILX LDX-3220 | not found | current source only, needs a separate TEC controller |
| Thorlabs ITC4001 | not found | no proven advantage |

A 5 µA driver does not harm EIT (the optical line is about 100 MHz wide and both beams share the noise) but it blurs the 6–12 MHz SAS features and makes the lock noisier. Ask vendors for "rms current noise, 10 Hz to 10 MHz" (target about 1 µA or better) and "temperature stability over 24 h"; also check the modulation bandwidth against the lock dither. The laser's temperature tuning is about 28 GHz per kelvin, so the temperature must be stable to a few mK; the lock removes the slow remainder.

### Q8. Is the Thorlabs ITC502 suitable for our laser?

*Added 9 Oct 2026*

**Yes, and it is better than the EM595.**

| Spec | ITC502 | Our laser needs | Verdict |
|---|---|---|---|
| Laser current | 0–200 mA | 160 mA (absolute maximum 170 mA) | fits |
| Compliance voltage | above 6 V | about 2 V | fits |
| Noise (10 Hz–10 MHz) | under 1.5 µA rms | as low as possible | about 2 MHz worst case |
| 24 h drift | under 10 µA (about 14 MHz) | within lock range | fine, the lock removes it |
| Modulation | 0–500 kHz | lock dither 10–100 kHz | fits |
| TEC | ±2 A, 16 W | about 0.4 A | plenty |
| Thermistor | 10 Ω–19.9 kΩ | 10 kΩ NTC | fits, chip at 15 °C or warmer |

**Four things to design for**
- The modulation input is 20 mA/V, about 28 GHz per volt. Put roughly a 100:1 divider (about 1 MΩ in series into the 10 kΩ input) between the lock box and the controller, otherwise lock steps are about 3 MHz and the DAC noise adds linewidth.
- Front-panel steps are coarse (10 µA is about 14 MHz, 1 Ω is about 2 mK or 65 MHz): tune coarsely by hand and let the lock do the fine tuning.
- Set the current limit to 170 mA or below before connecting the laser.
- Check the output polarity (anode ground) and the cable to the butterfly mount.

## Equipment found in the lab

### Q9. Are the extra lab items useful? (second ITC502, LDM-4980 mounts, TCLDM9 mounts)

*Added 9 Oct 2026*

| Item | Useful? | Why |
|---|---|---|
| 2 × ITC502 | yes, both | one drives the laser and its TEC; the second can run a second laser or take over two other jobs (below) |
| 2 × LDM-4980 (14-pin butterfly mount) | yes, likely | ILX's 14-pin telecom mount family fits a 14-pin butterfly like our DFB and can replace the Thorlabs LM14S2; check the pinout first |
| 2 × TCLDM9 | not for the DFB | a mount for 5.6 and 9 mm TO-can diodes, not butterfly packages; useful for a home-built ECDL or a practice diode |
| Cable set label LCM-39425 | unknown | no listing found; read the label |

**Before connecting:** the mounts are ILX wiring (9-pin D-sub, configurable pins; ILX cables are DB9–DB9 for the laser and DB15–DB9 for an ILX temperature controller) and the ITC502 is Thorlabs, so compare the ITC502 laser and TEC pinout with the mount's pin table; the cables may need rewiring. Our laser: anode pin 10, cathode 11, TEC 1 and 14, thermistor 2 and 5, monitor diode 3 and 4.

**Better uses for the second ITC502 (ideas, not bench-tested):** its TEC section (±2 A, 16 W, thermistor input) can drive and regulate the foil heater (needs a 10 kΩ thermistor on the cell), and its laser section (0–200 mA, under 1.5 µA noise) can be a very quiet solenoid supply (1.5 µA is far too small to matter against a 7–26 kHz line); use a resistive coil and check the current limit first.

Sources: [ILX LDM-4984](https://www.newport.com/p/LDM-4984) · [Thorlabs TCLDM9 catalogue](https://www.thorlabs.com/catalogPages/460.pdf)

### Q10. Is the Credix SG-1710 signal generator useful?

*Added 9 Oct 2026*

**Yes, as an AOM driver.** It is a single-channel synthesizer, 200 kHz to 1000 MHz, 1 Hz resolution, 0.5 ppm accuracy, up to +13 dBm, with AM, FM and GPIB (figures from a third-party listing, not a Credix datasheet).
- It can drive one AOM at 80 MHz through an RF amplifier (+13 dBm alone is not enough), for example the AOM in the SAS arm that moves the lock by 160 MHz.
- Two independent generators share no phase, which is acceptable for CW EIT because the offset stays within a few Hz, far below the 7–26 kHz EIT width.
- It is not a gate: switch the RF with a proper RF switch (AM is not a clean off).
- It cannot reach 6.8 GHz.

Source: [SG-1710 listing](https://www.radiolocman.com/op/device.html?di=63870)

### Q11. Can the Aditeg PS-3030DD dual power supply be used as a main supply?

*Added 9 Oct 2026*

**Yes, as the main supply of the RF chain and, if you wish, of the cell heater. Not for the solenoid or the photodiodes.** From the front panel: two adjustable channels with a tracking switch (independent, series, parallel) and a fixed 5 V / 3 A output; the model name suggests 0–30 V and 0–3 A per channel. No datasheet was found, so the ripple is unverified (similar linear supplies quote about 0.5–1 mV rms in voltage mode and about 3 mA rms in current mode).

| Job | Use it? | Why |
|---|---|---|
| RF amplifiers (+24 V) and RF switches (±5 V) | **yes, primary** | channel 1 at +24 V; the fixed 5 V and channel 2 give the two rails; millivolts of ripple do not matter for RF parts; check that the outputs are isolated first |
| Cell heater | yes | constant-current mode, about 0.3–0.5 A, but no temperature loop: add a thermistor and adjust by hand, or let the second ITC502 regulate the heater and keep this supply for the RF parts |
| Solenoid | no | a few mA of ripple is too much against a 7–26 kHz EIT line; use the ITC502 laser section |
| Photodiodes, lock electronics | no | millivolts of ripple |

It is in the lab inventory with a 3D picture.

### Q12. Are the ILX OMM-6810B optical multimeter and the OMH-6745B head useful?

*Added 9 Oct 2026*

**Not with this head. The meter is useful only if a silicon head is found.** The OMM-6810B is ILX's optical power and wavelength meter for the OMH-6700B heads (5-digit LED display, GPIB, no longer sold); its power range, wavelength range and accuracy come from the head.

The head in the lab, the OMH-6745B, reads **950 to 1650 nm** (confirmed from its label), so it cannot measure our 795 nm laser. It is not in the silicon-head brochure I could read, which lists:

| Head | Covers |
|---|---|
| OMH-6703B | power only, 400–1100 nm |
| OMH-6742B | power and wavelength, 350–1100 nm |
| OMH-6790B | 830–1100 nm only (does not cover 795 nm) |

**What a silicon head (OMH-6703B or OMH-6742B) would give:**
- **Power budget:** 100 nW to 1 W, spanning the fibre output (about 5–15 mW), the control (about 1 mW) and the probe (about 2 µW); the integrating sphere makes the reading independent of polarization.
- **Wavelength:** a power/wavelength head reads a power-averaged wavelength to about 1 nm with at least 10 µW. That only confirms the diode is near 795 nm; it cannot find the Rb line or resolve MHz shifts.
- **Cautions:** the detectors are temperature controlled (about one hour of warm-up), accuracy is about 3.5–5 %, the calibration date matters, and the readout is GPIB only.

Until a silicon head turns up, use another power sensor for the power budget. Check whether the lab has other OMH heads.

Source: [ILX 6700B silicon heads brochure](https://www.newport.com/medias/sys_master/images/images/he7/had/9260480790558/6700B-brochure-silicon-REV11.pdf)

### Q13. Can the Thorlabs PM100USB with the S140C and S144C sensors be used?

*Added 10 Oct 2026*

**Yes for the PM100USB and the S140C; no for the S144C.** Figures are from the Thorlabs spec sheets.

| Item | Use? | Why |
|---|---|---|
| PM100USB console | **yes** | reads any C-series head; no display, so it needs a PC with the Thorlabs Optical Power Monitor software |
| S140C (silicon, 350–1100 nm, 1 µW–500 mW) | **yes** | covers 795 nm; reads the fibre output (5–15 mW) and the control (about 1 mW); polarization and beam shape do not matter |
| S144C (InGaAs, 800–1700 nm) | **no** | 795 nm is below its 800 nm limit, so the calibration is not valid; keep it for infrared work |

**Limit:** the S140C floor is 1 µW (1 nW resolution), so the probe at about 2 µW is read poorly. Measure the probe before the attenuating optics, or add a low-floor photodiode sensor such as the S120C (50 nW).

### Q14. Which instruments record the result: the power meter or the oscilloscope?

*Added 10 Oct 2026*

**The result comes from a photodetector read on the oscilloscope. The power meter is a setup tool.** The EIT signal is the probe transmission while the two-photon detuning is scanned, and the window is only about 7–30 kHz wide. A USB or benchtop power meter updates far too slowly to follow a scan, shows only a number, and the S140C floor (1 µW) is close to the probe power (about 2 µW).

| Instrument | Job |
|---|---|
| Signal photodetector + oscilloscope | EIT transmission: the result |
| SAS photodiode (+ ITC502) | laser lock signal |
| Power meter (PM100USB + S140C) | fibre, control and AOM-efficiency checks before the run |
| Fabry-Perot or wavemeter | single-mode and mode-hop check (missing from the budget) |
| Fluxgate or gaussmeter | shield and 50 mG field check (missing) |
| Beam profiler or camera, IR card | beam size (sets the intensity) and alignment |
| Fast detector (AD-300/DC) | control and probe beat note, AOM pulse shapes |

### Q15. Is the signal detector the Thorlabs PDA36A2, and how many are needed?

*Added 10 Oct 2026*

**Yes: a Thorlabs PDA36A2, an amplified silicon detector (350–1100 nm, 8 switchable gain steps, 0–70 dB, 3.6 × 3.6 mm chip). Two are needed, a third is optional.**
- One for the probe signal after the Glan-Taylor (the EIT result).
- One for the SAS lock signal.
- Optional third: the control beam monitor or a reference channel. The AD-300/DC we own can serve as a diagnostic channel.

**Gain:** the probe is only about 2 µW, so use about 50–60 dB. At 70 dB the bandwidth falls to a few kHz, which is marginal for a 7–30 kHz window. The SAS detector can use a lower gain. The PDA36A2 normally ships with its ±12 V supply; check before buying a separate LDS12B.

The 3D bench, the Spain-style bench and the equipment table now show the PDA36A2 drawn from the Thorlabs outline drawing (approximate dimensions).

### Q16. Is the Thorlabs PDB210A balanced detector needed?

*Added 10 Oct 2026*

**No, it is overkill.** A balanced detector subtracts the laser intensity noise with a second reference beam. The reference papers do without it:
- Finkelstein et al. 2022: the probe passes a Glan-Taylor and is focused on "a fast photodiode"; the probe is scanned and the EIT spectrum is recorded.
- DeRose et al.: one New Focus 1621 photodiode on a digital oscilloscope (low detector impedance to avoid cable reflections); the pump leakage was reduced with a Glan polariser, not a better detector.

The EIT window is slow (7–30 kHz), so averaging on the oscilloscope recovers any noise. Use the two PDA36A2 detectors. Try balanced detection only if the probe is still too noisy after the Glan-Taylor, scope averaging and a lock-in. The PDB210A datasheet could not be retrieved, so its price and bandwidth are unverified.

Sources: [Finkelstein et al. 2022](https://arxiv.org/abs/2205.10959), [DeRose et al.](https://arxiv.org/abs/2011.09229)

### Q17. Can the SolidWorks file of the PM100USB be used for the 3D pictures?

*Added 10 Oct 2026*

**Not directly.** A SolidWorks part file (.sldprt) is a closed format that only SolidWorks, eDrawings or FreeCAD-class CAD can open, and none of those is installed here, so its true shape could not be read. The PM100USB and the S140C head are drawn in the guide's own three.js style from their known layout (compact console with the sensor connector on the front, USB at the back, a status LED, the sphere head on its cable); the dimensions are approximate.

**To use the real CAD shape:** export it from SolidWorks as an STL or glTF file and add it to the project; it can then be loaded as the 3D model of the PM100USB. The picture appears in the Lab Inventory (item I12), the equipment pictures and the power meter in the 3D benches.

### Q18. Is the Newport AD-300/DC fast detector useful?

*Added 9 Oct 2026*

**A good diagnostic, not the main probe detector.** No datasheet was found for this number; the closest Newport parts are the 818-BB amplified detectors (rise time under 400 ps).
- Use it to watch AOM switching and pulse shapes on the oscilloscope, the control–probe beat note, or the strong SAS beam.
- For the weak probe (about 2 µW at the cell) a gain-adjustable low-noise detector such as the Thorlabs PDA36A2 is better: EIT pulses last microseconds, so 300 ps speed only adds noise.
- Check the responsivity at 795 nm, the supply it needs and its output into 50 Ω before use.

## The Quantum Spain-style bench

### Q19. Is the Spain-style arrangement correct, in theory and in practice?

*Added 9 Oct 2026*

**It is a correct Zeeman EIT chain, with three drawing faults (fixed) and several practical cautions.** Everything rests on one photograph, so the real bench may differ.

**What checks out** (simulator run): control and probe orthogonal and co-propagating (opposite circular after the quarter-wave plates); 160.000 and 159.930 MHz after the double pass, so a 70 kHz difference equal to the ground-state splitting at 50 mG; the SAS lock closes; no light returns to the laser; control 0.75 mW (7.3 mW/cm², the paper used 1.3–5.5), probe about 2 µW; predicted optical depth 10 at 60 °C, linewidth about 34 kHz, contrast 0.96; no parts closer than 30 mm.

**Three faults, now fixed**
- The control beam expander had two lenses 40 mm apart: not a telescope. It is now f = 30 mm plus f = 100 mm, 130 mm apart (×3.3).
- The cat's-eye lenses in the AOM arms need f of about 75 mm (80 mm after the AOM, 70 mm to the mirror); the guide's parts list has only 100 and 50 mm lenses.
- The simulator hides a lock offset: the double-pass AOMs add +160 MHz and the SAS arm has no AOM. A real bench needs the lock moved by about 160 MHz (for example an AOM in the SAS arm); the photo does not show how.

**Practical cautions**
- Heater: 2.4 V at 0.5 A is about 1.2 W through a 3D-printed housing; reaching 60 °C is doubtful (PLA softens near 60 °C), and a plain DC heater wire makes a magnetic field that shifts the Zeeman line (use bifilar, or switch it off while measuring). No temperature sensor or controller is visible.
- AOM drive: Rigol generators give about +10 to +20 dBm, typical AOMs need about +27 to +33 dBm: amplifiers must exist off-camera.
- No lock box is visible; without a real lock the laser drifts and EIT disappears.
- A white plastic box is not a magnetic shield; Zeeman EIT is first-order field sensitive, so a µ-metal shield is probably inside.
- The blue PM fibres suggest fibre between the boards (about half the power lost, axis alignment needed); the simulator draws free space.
- No beam dumps or tubes are visible (laser safety).
- The AOM tilt is exaggerated to 8° in the drawing, hence the 160 mm from separator cube to AOM; a real build can be tighter but needs an iris or block for the zeroth order. Do not use the drawing as a build recipe.
