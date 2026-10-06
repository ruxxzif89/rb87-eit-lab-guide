# Rb-87 EIT Lab Guide

Reading material and interactive 3D optical-bench simulators for building a room-temperature **electromagnetically induced transparency (EIT)** testbed in a rubidium-87 vapour cell at 795 nm (D1 line). The platform is the atomic reference for later quantum-memory work.

**Live site:** https://ruxxzif89.github.io/rb87-eit-lab-guide/

## Pages

| Page | File | What it covers |
|---|---|---|
| Zeeman EIT (AOM) | `index.html` | The primary configuration. One DFB laser locked by saturated absorption spectroscopy (SAS) with a full servo loop. Control and probe arms each pass a double-pass AOM, with orthogonal circular polarizations. The cell sits in a solenoid inside a mu-metal shield, and a Glan-Taylor separates the probe before detection. |
| 3D Bench | `bench.html` | The same 3D optical-bench simulator on a full page, with a large view of the table, a toggle to hide the side panels, and all the simulator features (tour, views, cables, scope, objectives). |
| Equipment | `equipment.html` | The equipment list on its own page: 56 line items with quantity, suggested brand and part number, why each is needed, a vendor link and a **3D picture** of every item (click to rotate). Group members can unlock a costed version with ticks and a "cheaper alternative found" field. |
| Quantum Optics Lectures | `quantum.html` | Six primers (how to use the notes, history, motivation, maths toolkit, basic quantum mechanics, basic quantum optics) and thirteen lectures, from photons and the two-level atom up to EIT, slow and stored light, quantum memories, single photons, strong coupling and the bench itself (polarization, Gaussian beams, AOMs, locking, cells and shielding, detectors, laser safety). |

The four pages share a sticky top navigation bar. The guide includes a **"Why Zeeman EIT?"** decision record.

### Zeeman EIT guide sections
Project at a glance · Glossary (searchable, about 100 terms) · Physics from scratch · Zeeman EIT experimental architecture (including the SAS → lock box → laser controller → DFB frequency lock) · Why Zeeman EIT? · 3D optical-bench simulator · Bring-up & audit protocol · Equipment list · Recommended reading

### Lectures
P0 Start here · P1 History · P2 Motivation · P3 Maths toolkit · P4 Basic quantum mechanics · P5 Basic quantum optics · L1 Light as waves and photons · L2 Quantum states and measurement · L3 Two-level atom, Rabi oscillations, Bloch sphere · L4 Density matrix, decay and dephasing · L5 Atomic structure for alkalis · L6 Susceptibility, absorption, dispersion · L7 Dark states, CPT, EIT, Autler–Townes · L8 Slow and stopped light · L9 Thermal vapour effects · L10 Quantum memories · L11 Quantum states of light · L12 Strong coupling and polaritons in solids · L13 Lab fundamentals for the project · Appendices (symbols, constants and ⁸⁷Rb data, record of checks and corrections) and a bibliography.

## Features

- **Analogy boxes on every equation:** each one gives a plain-language reading of the symbols, an everyday analogy, and where the analogy breaks down.
- **Interactive charts:** EIT transmission and dispersion, Zeeman shifts, linewidth vs control intensity, and a Rabi/Bloch-sphere widget.
- **3D bench simulator (three.js):**
  - You drag optical and electronic components onto a breadboard, and the beam is traced through them, keeping track of polarization (Jones calculus), power and frequency shifts.
  - A complete reference bench of 73 parts on a 2.4 m × 1.6 m table, spaced so that every part can be seen, laid out as you would build it and with painted, named **zones** on the table (source, SAS reference, control arm, probe arm, cell and detection, RF chain, field/heater/scope; the **Zones** button hides them): master-axis mirrors and irises, a full SAS arm (pump and probe counter-propagating through a Rb reference cell), both double-pass AOM assemblies built from separate PBS, AOM, λ/4, cat's-eye lens, retro mirror and beam dumps, a control beam expander, the recombiner, shielded cell, analyser and detector, and the RF chain, coil/temperature controllers, function generator and oscilloscope with their cables.
  - **Reset bench & view** restores the full reference bench and the default camera; all cables are drawn and colour-keyed (BNC, SMA RF, trigger, power, coil, heater), including the oscilloscope inputs.
  - Detailed component models (mounted mirrors, PBS cubes, graduated waveplates, double-pass AOM modules, shielded cell with solenoid and heater glow, instruments with screens and LEDs) lit with shadows on a dark-lab table.
  - The light reacts live: rotating, moving, adding or removing a part re-traces the beams, which cross-fade to the new path. Beams glow where they land on an optic and flag stray light leaving the table. A **Beam info** toggle labels each beam with its power and polarization.
  - Camera views (3D, Top, Front, Source, Cell), a Focus button, a "Show" filter for subsystems, a µ-metal shield cutaway, a cable toggle, a pause for the moving light, and a PNG screenshot.
  - A 12-step **guided tour** walks along the beam path from the laser to the function generator.
  - The inspector gives each component's role in Zeeman EIT, its place on the reference bench, and an experiment to try.
  - The laser frequency lock (SAS, lock box, laser controller) and its error signal are modelled.
  - A scope shows the EIT sweep, the SAS error signal and the pulsed-storage view.
  - Game-style objectives tick off automatically as the setup is built correctly.
- **Wiring diagram and cable schedule** (Part 07): every electrical connection, with cable type and purpose.
- **Equipment list** (Part 07 and the Equipment tab): 56 line items with quantity, suggested brand and part number, why each is needed, a vendor link and a three.js picture of the item (`parts3d.js`, the same models as the simulator plus cables, tools and safety gear; click a picture for an interactive viewer). Quantities for optics and instruments are checked against the 3D bench. A costed version on the Equipment tab is available to project members: owned / borrowed and remove ticks, and a "cheaper alternative found" tick that reveals an estimated-price field and a product link.
- **Lecture notes (quantum.html):**
  - Eleven interactive three.js illustrations next to the equations they explain (electromagnetic wave and polarization, Bloch sphere in three modes, Zeeman sublevels, absorption and dispersion, dark and bright states, slow and stored light, Wigner functions, avoided crossing, Poincaré sphere, Gaussian beam).
  - Hover, focus or tap any symbol, in the text or inside an equation, for its name, meaning and units; each equation also has a chip bar listing its symbols.
  - "Go deeper" boxes with derivations, pitfalls and sources, and a bibliography of 130+ entries whose article metadata was checked against the DOI registration records (books against library records).
  - Atomic data come from Steck's ⁸⁷Rb D line data, revision 2.3.4 (August 2025).
- Light and dark themes; works on phones.

## Run locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

An internet connection is needed for the libraries and fonts, which load from CDNs:
- [three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) (both pages)
- OrbitControls (three@0.128.0)
- [MathJax 3.2.2](https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js) (SVG output)
- Google Fonts

## Accuracy notes

- The main technical reference is R. Finkelstein, S. Bali, O. Firstenberg and I. Novikova, *A practical guide to electromagnetically induced transparency in atomic vapor*, arXiv:2205.10959v2 (2022).
- Rb-87 constants follow D. A. Steck, *Rubidium 87 D Line Data*. The pages mark them "verify before citing".
- Design estimates and illustrative simulator values are tagged on the pages. Examples are drift rates, coherence times, storage efficiency and transit/Doppler estimates.
- The simulator is a teaching model, not a quantitative prediction of a real apparatus.
- The 795 nm beam is near-infrared and invisible; it is drawn red. Follow your institution's laser-safety rules.

---
IMEN quantum photonics programme · October 2026
