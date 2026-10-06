# Rb-87 EIT Lab Guide

Reading material and interactive 3D optical-bench simulators for building a room-temperature **electromagnetically induced transparency (EIT)** testbed in a rubidium-87 vapour cell at 795 nm (D1 line). The platform is the atomic reference for later quantum-memory work.

**Live site:** https://ruxxzif89.github.io/rb87-eit-lab-guide/

## Pages

| Page | File | What it covers |
|---|---|---|
| Method A · Zeeman EIT (AOM) | `index.html` | The primary configuration. One DFB laser locked by saturated absorption spectroscopy (SAS) with a full servo loop. Control and probe arms each pass a double-pass AOM, with orthogonal circular polarizations. The cell sits in a solenoid inside a mu-metal shield, and a Glan-Taylor separates the probe before detection. |
| Quantum Optics Lectures | `quantum.html` | Twelve lectures, from photons and the two-level atom up to EIT, slow and stored light, quantum memories, single photons and strong coupling. |

Both pages share a top navigation bar. The guide includes a **"Why Method A?"** decision record.

### Method A guide sections
Project at a glance · Glossary (searchable, about 100 terms) · Physics from scratch · Method A experimental architecture (including the SAS → lock box → laser controller → DFB frequency lock) · Why Method A? · 3D optical-bench simulator · Bring-up & audit protocol · Equipment list · Recommended reading

### Lectures
L1 Light as waves and photons · L2 Quantum states and measurement · L3 Two-level atom, Rabi oscillations, Bloch sphere · L4 Density matrix, decay and dephasing · L5 Atomic structure for alkalis · L6 Susceptibility, absorption, dispersion · L7 Dark states, CPT, EIT, Autler–Townes · L8 Slow and stopped light · L9 Thermal vapour effects · L10 Quantum memories · L11 Quantum states of light · L12 Strong coupling and polaritons in solids

## Features

- **Analogy boxes on every equation:** each one gives a plain-language reading of the symbols, an everyday analogy, and where the analogy breaks down.
- **Interactive charts:** EIT transmission and dispersion, Zeeman shifts, linewidth vs control intensity, and a Rabi/Bloch-sphere widget.
- **3D bench simulator (three.js):**
  - You drag optical and electronic components onto a breadboard, and the beam is traced through them, keeping track of polarization (Jones calculus), power and frequency shifts.
  - A complete reference bench of 71 parts on a 1200×750 mm table, laid out as you would build it: master-axis mirrors and irises, a full SAS arm (pump and probe counter-propagating through a Rb reference cell), both double-pass AOM assemblies built from separate PBS, AOM, λ/4, cat's-eye lens, retro mirror and beam dumps, a control beam expander, the recombiner, shielded cell, analyser and detector, and the RF chain, coil/temperature controllers, function generator and oscilloscope with their cables.
  - Detailed component models (mounted mirrors, PBS cubes, graduated waveplates, double-pass AOM modules, shielded cell with solenoid and heater glow, instruments with screens and LEDs) lit with shadows on a dark-lab table.
  - The light reacts live: rotating, moving, adding or removing a part re-traces the beams, which cross-fade to the new path. Beams glow where they land on an optic and flag stray light leaving the table. A **Beam info** toggle labels each beam with its power and polarization.
  - Camera views (3D, Top, Front, Source, Cell), a Focus button, a "Show" filter for subsystems, a µ-metal shield cutaway, a cable toggle, a pause for the moving light, and a PNG screenshot.
  - A 12-step **guided tour** walks along the beam path from the laser to the function generator.
  - The inspector gives each component's role in Method A, its place on the reference bench, and an experiment to try.
  - The laser frequency lock (SAS, lock box, laser controller) and its error signal are modelled.
  - A scope shows the EIT sweep, the SAS error signal and the pulsed-storage view.
  - Game-style objectives tick off automatically as the setup is built correctly.
- Light and dark themes; works on phones.

## Run locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

An internet connection is needed for the libraries and fonts, which load from CDNs:
- [three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js)
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
