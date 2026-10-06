# Rb-87 EIT: Zeeman EIT lab guide (Oct 2026)

(Earlier notes called the two schemes "Mod A / Mod B", then "Method A / Method B". Method B (hyperfine EIT with an EOM) was removed; the remaining scheme is simply called **Zeeman EIT**.)

**Public-safe session notes. The repo is public: never add grant details here (scheme, amounts, vote numbers, PI name, budget findings). Those live in the git-ignored `CLAUDE.local.md`. Costed figures live only in the git-ignored `private/` folder and the Apps Script.**

## Where the site lives

- Live site (GitHub Pages, public): https://ruxxzif89.github.io/rb87-eit-lab-guide/
- GitHub repo: https://github.com/ruxxzif89/rb87-eit-lab-guide (public, branch main, Pages serves from / (root)).
- Local copy: GUT_Claude/Rb87_EIT_Lab_Guide/. It is a git repo with `origin` set to the GitHub repo. Workflow: edit, `git commit`, `git push`, and Pages updates the live site. `website_from_chatgpt/`, `private/` and `CLAUDE.local.md` are git-ignored.

## Pages and files

- index.html: Zeeman EIT guide with the 3D bench simulator, wiring diagram, and the (price-free) equipment table.
- equipment.html: the equipment table on its own tab, plus the password-gated costed BOM (ticks: have it / remove / cheaper alternative found with price and link; saved in the browser and in a Google Sheet through an Apps Script).
- quantum.html: Quantum Optics Lectures (primers P0-P5, L1-L13, appendices, bibliography).
- parts3d.js: three.js models for the equipment pictures (ported from the simulator plus extra items). `Parts3D.scan(root)` renders `.p3d` elements; clicking opens a viewer.
- lecture-3d.js, lecture-symbols.js: lecture illustrations and the symbol hover help.

## BOM pipeline (private)

`private/bom_data.py` (rows + `PREVIEW` map row id -> 3D model) -> `private/build_bom.py` (checks quantities against the 3D bench counts, writes the public table into index.html and equipment.html between `<!--BOM-START-->` and `<!--BOM-END-->`, writes the xlsx/json and `private/apps-script/code.gs`). After changing `code.gs` the user must paste it into Apps Script and redeploy a new version. Public pages must contain no prices.

## Decision

Configuration chosen: Zeeman EIT, Zeeman Λ-EIT on the Rb-87 D1 line (795 nm).

- One DFB laser, locked by SAS near F=2→F'=1.
- The beam is split at a PBS into control and probe.
- Each arm passes its own AOM, in double-pass, with phase-locked dual RF.
- Orthogonal circular polarizations are made with a QWP.
- The cell sits inside a solenoid and a 3-layer mu-metal shield.
- A Glan-Taylor separates the control from the probe before the photodetector.
- The reference layout is Fig. 10 of arXiv:2205.10959v2 (Finkelstein, Bali, Firstenberg, Novikova 2022).
