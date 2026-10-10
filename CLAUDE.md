# Rb-87 EIT: Zeeman EIT lab guide (Oct 2026)

(Earlier notes called the two schemes "Mod A / Mod B", then "Method A / Method B". Method B (hyperfine EIT with an EOM) was removed; the remaining scheme is simply called **Zeeman EIT**.)

**Public-safe session notes. The repo is public: never add grant details here (scheme, amounts, vote numbers, PI name, budget findings). Those live in the git-ignored `CLAUDE.local.md`. Costed figures live only in the git-ignored `private/` folder and the Apps Script.**

## Where the site lives

- Live site (GitHub Pages, public): https://ruxxzif89.github.io/rb87-eit-lab-guide/
- GitHub repo: https://github.com/ruxxzif89/rb87-eit-lab-guide (public, branch main, Pages serves from / (root)).
- Local copy: GUT_Claude/Rb87_EIT_Lab_Guide/. It is a git repo with `origin` set to the GitHub repo. Workflow: edit, `git commit`, `git push`, and Pages updates the live site. `website_from_chatgpt/`, `private/` and `CLAUDE.local.md` are git-ignored.

## Pages and files

- index.html: Zeeman EIT guide with the 3D bench simulator, wiring diagram, and the (price-free) equipment table.
- bench.html: the 3D bench simulator on a full page (same markup and scripts as index.html Part 05).
- eitphys.js: the physics engine and the reference layout (73 parts, scaled by LAYOUT_SCALE onto a 2400x1600 mm table) plus the zone rectangles; bench-sim.js: the three.js simulator UI. Both are shared by index.html and bench.html (bump the ?v= query when editing). quantum.html keeps its own embedded copy of the physics.
- inventory.html + inventory.js + inventory-data.js: editable Lab Inventory tab (what the lab owns, 3D pictures via parts3d.js, status use/check/no, BOM ids it covers). Edits live in localStorage; the group password lets the page save/load the shared list through the Apps Script actions `invget` / `invset` (second sheet `inventory`). After changing the Apps Script template the user must redeploy.
- equipment.html: the equipment table on its own tab, plus the password-gated costed BOM (ticks: have it / remove / cheaper alternative found with price and link; saved in the browser and in a Google Sheet through an Apps Script).
- quantum.html: Quantum Optics Lectures (primers P0-P5, L1-L13, appendices, bibliography).
- parts3d.js: three.js models for the equipment pictures (ported from the simulator plus extra items). `Parts3D.scan(root)` renders `.p3d` elements; clicking opens a viewer.
- lecture-3d.js, lecture-symbols.js: lecture illustrations and the symbol hover help.
- qs-bench.html + qs-layout.js: "Spain-style Bench" tab. A second bench for the same simulator, reconstructed from one photograph of a Quantum Spain-style EIT bench: two 450 x 450 mm breadboards (left = laser input and SAS lock, right = EIT with two AOMs and the cell) and an instrument shelf; identified-equipment and probable-BOM tables; a collapsible cost box whose RM figures come only from the Apps Script action `qsest` after the group password (the page itself has no prices). It plugs into bench-sim.js through `window.BENCH_CFG` (table, layout(), zones(), views, trays, storeKey, note); components may carry `tag`, `nm`, `photo`, `cableTo`, `nocable`. `EITPhys.referenceLayout(opts)` / `referenceZones(opts)` take optional variant options (defaults unchanged). The page has an "Equipment & cost" jump button because the mouse wheel zooms the 3D view.
- Section 09 of index.html ("Questions and answers", collapsible and searchable) and QA.md are generated from one list in `private/build_qa.py` (markers `<!--QA-START-->` / `<!--QA-END-->`). Add a question: append it to the list, run `python3 private/build_qa.py`, commit index.html and QA.md. No prices, no grant details.
- Top bar (all pages): Zeeman EIT, 3D Bench, Spain-style Bench, Equipment, Lab Inventory, Quantum Optics Lectures; secondary words are hidden below 1080 px so it stays on one row.

## Resuming on another machine

The folder is on Google Drive and also a git repo (public parts via GitHub). One machine at a time: commit and push before leaving, let Drive finish syncing, then `git pull` on the next machine. Needed: git, node, python3 (`pip install openpyxl` for the xlsx), a static server (`python3 -m http.server 4180 --bind 127.0.0.1`). Bump the `?v=` query on script tags when editing `eitphys.js`, `bench-sim.js`, `parts3d.js` or `inventory*.js` (current: eitphys 6, bench-sim 16, parts3d 12, inventory-data 10, qs-layout 1). Before every push check `git ls-files | grep -c private` prints 0. Private notes for the owner's sessions are in the git-ignored `CLAUDE.local.md` and `private/`.

## BOM pipeline (private)

`private/bom_data.py` (rows, `PREVIEW` map row id -> 3D model, `OWNED` set) -> `python3 private/build_bom.py` (checks quantities against the 3D bench part counts read from `eitphys.js` with node, writes the public table into index.html and equipment.html between `<!--BOM-START-->` and `<!--BOM-END-->`, writes the xlsx/json and `private/apps-script/code.gs`). After changing `code.gs` the user must paste it into Apps Script and redeploy a new version. Public pages must contain no prices.

## Testing notes

Local server: `python3 -m http.server 4180 --bind 127.0.0.1`. Checks: `node private/gs_test.js` (Apps Script logic, expects ALL PASS), `python3 private/build_bom.py` (quantities vs the 3D bench), a node harness that loads `eitphys.js` + `qs-layout.js` and calls `EITPhys.evaluate(layout)` (lock, orthogonal polarizations, overlap, no parts closer than 30 mm). In the Claude Browser pane keep the page tab fronted, otherwise requestAnimationFrame is throttled and the 3D view stays black.

## Decision

Configuration chosen: Zeeman EIT, Zeeman Λ-EIT on the Rb-87 D1 line (795 nm).

- One DFB laser, locked by SAS near F=2→F'=1.
- The beam is split at a PBS into control and probe.
- Each arm passes its own AOM, in double-pass, with phase-locked dual RF.
- Orthogonal circular polarizations are made with a QWP.
- The cell sits inside a solenoid and a 3-layer mu-metal shield.
- A Glan-Taylor separates the control from the probe before the photodetector.
- The reference layout is Fig. 10 of arXiv:2205.10959v2 (Finkelstein, Bali, Firstenberg, Novikova 2022).
