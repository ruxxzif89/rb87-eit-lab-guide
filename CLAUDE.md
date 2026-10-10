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
- equipment.html: the equipment table on its own tab, a no-cost "Already owned by the lab" table built in the browser from the Lab Inventory items with status use (inventory-data.js + the same localStorage list), plus the password-gated costed BOM (ticks: have it / remove / cheaper alternative found with price and link; saved in the browser and in a Google Sheet through an Apps Script).
- lab-cover.js: shared by equipment.html (costed BOM) and qs-bench.html (cost box): main switch "Count what the lab already owns" (localStorage `rb87-use-inventory`); matches Lab Inventory items (status use, `bom` ids, qty) to BOM rows, green rows, totals reduced. No prices in it. The Spain-style box needs the Apps Script `qsest` that returns `parts` and `oursRows` (redeploy).
- quantum.html: Reading Section (renamed from "Quantum Optics Lectures" on 10 Oct 2026; primers P0-P5, L1-L13, appendices, bibliography).
- diy.html + 23 drawings `diy-*.svg`: DIY Section (parts D1 to D10, each with parts list, tools, drawings, numbered steps with checks, tests, mistakes, open items; no prices). Generated: `python3 private/diy/build_diy.py` writes diy.html (content in `private/diy/diy_c1.py`, `diy_c2.py`, `diy_c3.py`; every number comes from `private/diy/params.py`); the drawings come from `private/diy/figs_d1.py` ... `figs_d9.py` (run each; `drawlib.py` refuses overlapping or out-of-canvas labels); `private/diy/audit.py` re-derives the numbers independently (brute-force Biot-Savart on the true helix, plain formulas) and checks links, ids, files and forbidden words (expects RESULT ... 0 failed); `private/diy/update_nav.py` writes the top bar on every page. Facts checked against the Twinleaf degaussing guide, the ITC500 manual and the Mini-Circuits, Stefan Mayer and Gooch & Housego data (listed in Part 12 of the page).
- parts3d.js: three.js models for the equipment pictures (ported from the simulator plus extra items). `Parts3D.scan(root)` renders `.p3d` elements; clicking opens a viewer.
- lecture-3d.js, lecture-symbols.js: lecture illustrations and the symbol hover help.
- qs-bench.html + qs-layout.js: "Spain-style Bench" tab. A second bench for the same simulator, reconstructed from one photograph of a Quantum Spain-style EIT bench: two 450 x 450 mm breadboards (left = laser input and SAS lock, right = EIT with two AOMs and the cell) and an instrument shelf; identified-equipment and probable-BOM tables; a collapsible cost box whose RM figures come only from the Apps Script action `qsest` after the group password (the page itself has no prices). It plugs into bench-sim.js through `window.BENCH_CFG` (table, layout(), zones(), views, trays, storeKey, note); components may carry `tag`, `nm`, `photo`, `cableTo`, `nocable`. `EITPhys.referenceLayout(opts)` / `referenceZones(opts)` take optional variant options (defaults unchanged). The page has an "Equipment & cost" jump button because the mouse wheel zooms the 3D view.
- fig-itc502-rear.svg, fig-itc502-heater.svg, fig-itc502-solenoid.svg: wiring drawings of the second ITC502 (heater on the TEC OUT jack, solenoid on the LD OUT jack), drawn from the real rear-panel and connector layout of the ITC500 manual (looking into the jack, wide row on top). Generated by a Python script (kept outside the repo); embedded in section 09 with the Q&A image syntax `![alt](file)`. Every Q&A entry also shows the 3D equipment pictures it refers to: `REFS` in `private/build_qa.py` (a new question without an entry stops the build).
- Section 09 of index.html ("Questions and answers", collapsible and searchable) and QA.md are generated from one list in `private/build_qa.py` (markers `<!--QA-START-->` / `<!--QA-END-->`). Add a question: append it to the list (or, if a related entry exists, extend that entry: related answers are merged, 17 entries after the audit of 10 Oct 2026), run `python3 private/build_qa.py`, commit index.html and QA.md. No prices, no grant details.
- Top bar (all pages, one markup written by `diy_lib.nav_html`): Reading Section, Zeeman EIT, 3D Bench, Spain-style Bench, Equipment, Lab Inventory, DIY Section; secondary words are hidden below 1080 px, a small-phone rule below 400 px keeps it on one row down to 320 px.

## Where we left off (public-safe summary, 10 Oct 2026; the private details are in the git-ignored `CLAUDE.local.md`)

State: seven tabs are live (Reading Section, Zeeman EIT, 3D Bench, Spain-style Bench, Equipment, Lab Inventory, DIY Section). Section 09 of index.html has 18 merged Q&A entries; every answer shows 3D equipment pictures. The DIY Section (parts D1 to D10) was audited: 46 independent numeric checks, datasheet checks (Twinleaf, ITC500 manual, Mini-Circuits, Stefan Mayer, Gooch & Housego, AeroDIODE), every drawing checked for overlapping labels under two font metrics.

Design questions still open (none involves money):
- Laser: AeroDIODE 795LD-1-SM/PM-NI (30 mW, 200 kHz, no internal isolator) against the Eagleyard BFY12 in the equipment list. The Q&A entry says AeroDIODE is better on paper if the vendor commits in writing to 794.98 nm at 25 to 30 degrees C chip temperature and the PM fibre option; the Eagleyard stays the fallback. Not applied to the equipment list yet. With the AeroDIODE the fibre isolator is mandatory and the lock-box divider changes (33 kohm instead of 91 kohm, DIY part D6).
- Shield: innermost bore at least 46 mm, inner length at least 250 mm, end-cap feed-through 20 mm; the equipment list gives only "O70 x 250 mm, 3 layers".
- Lock offset: the double-pass AOMs add 160 MHz but the SAS arm has no AOM, so the laser must be locked 160 MHz away from the line the cell sees; the guide does not yet show how.
- Cell: stem position and exact size; ITC502 jack gender and TEC polarity (dummy-load test in D3); AOM model, housing size, RF connector and maximum RF power; DC on the RF lines (synthesizer, AOM input).
- The RF bias and control box (DIY D8) is not an equipment-list row.

How to continue on another machine:
1. `git pull`; the git-ignored `private/` and `CLAUDE.local.md` arrive through Google Drive: wait until Drive has finished syncing, then read `CLAUDE.local.md` first.
2. Tools: git, node (v24 used), python 3 (3.14 used) with `pip install pillow numpy scipy pymupdf openpyxl`, Google Chrome (set `CHROME` if it is not in the usual place), a TrueType font for the label check (Segoe UI, Arial or DejaVu Sans is found automatically; `DRAW_FONT_FILE` overrides). Local server: `python3 -m http.server 4180 --bind 127.0.0.1`.
3. Rebuild the DIY Section: edit numbers in `private/diy/params.py`, run `python3 private/diy/figs_d1.py` ... `figs_d9.py` (d6 and d7 are inside `figs_d5.py`, d10 inside `figs_d9.py`), then `python3 private/diy/build_diy.py`, then `python3 private/diy/audit.py` (expects `0 failed`). `DRAW_FONT=arial` runs the label check with the narrower Arial metrics as a second opinion.
4. Rebuild Q&A: `python3 private/build_qa.py`. Equipment tables: `python3 private/build_bom.py` and `node private/gs_test.js` (expects ALL PASS).
5. Before every push: `git ls-files | grep -c private` prints 0; no prices (`grep -c "RM [0-9]"` and `grep -ci ringgit` on edited pages print 0; loose wording such as "a few tens of ringgit" counts as a price); no grant details; commit messages end with the Co-Authored-By line given by the session.

## Resuming on another machine

The folder is on Google Drive and also a git repo (public parts via GitHub). One machine at a time: commit and push before leaving, let Drive finish syncing, then `git pull` on the next machine. Needed: git, node, python3 (`pip install openpyxl` for the xlsx), a static server (`python3 -m http.server 4180 --bind 127.0.0.1`). Bump the `?v=` query on script tags when editing `eitphys.js`, `bench-sim.js`, `parts3d.js` or `inventory*.js` (current: eitphys 6, bench-sim 18, parts3d 13, inventory-data 14, qs-layout 1). Before every push check `git ls-files | grep -c private` prints 0. Private notes for the owner's sessions are in the git-ignored `CLAUDE.local.md` and `private/`.

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
