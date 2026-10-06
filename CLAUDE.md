# Rb-87 EIT: Method A decision and Lab Guide (Oct 2026)

(Earlier notes called these "Mod A / Mod B". They were renamed Method A / Method B on 6 Oct 2026.)

**Public-safe session notes. The repo is public: never add grant details here (scheme, amounts, vote numbers, PI name, budget findings). Those live in the git-ignored `CLAUDE.local.md`.**

## Where the site lives

- Live site (GitHub Pages, public): https://ruxxzif89.github.io/rb87-eit-lab-guide/
- GitHub repo: https://github.com/ruxxzif89/rb87-eit-lab-guide (public, branch main, Pages serves from / (root)). Files in the repo: index.html, mod-b.html, quantum.html, README.md.
- Private Claude artifact (same content): https://claude.ai/artifact/CHC9atNpJNtgjyomZFBKnw
- Local copy: GUT_Claude/Rb87_EIT_Lab_Guide/ (index.html, mod-b.html, quantum.html, README.md).
- The local folder is a git repo with `origin` set to the GitHub repo. Workflow: edit, `git commit`, `git push`, and Pages updates the live site. `website_from_chatgpt/` is git-ignored and will be dealt with later.

## Publishing rules

- The public pages must not disclose any grant details: no scheme name, amounts, vote numbers or PI name.
- To push from Claude, start a session with the repo ruxxzif89/rb87-eit-lab-guide attached as a session repository. Sessions without it cannot git push (updates then go through the GitHub web upload page).
- The repo's index.html is a full HTML document (doctype/head). The artifact's index.html has no wrapper, because the artifact platform adds its own skeleton.

## Pages

- index.html: Method A, Zeeman EIT with AOMs.
- mod-b.html: Method B, hyperfine EIT with an EOM.
- quantum.html: Quantum Optics Lectures L1–L12.

Each equation on the pages carries an analogy box.
Both guides include a 3D bench simulator. Each simulator has a "Load reference: Method A | Method B" switch and models the SAS → lock box → laser controller → DFB feedback loop.

## Decision

Configuration chosen: Method A. This is Zeeman Λ-EIT on the Rb-87 D1 line (795 nm), the primary path.

- One DFB laser, locked by SAS near F=2→F'=1.
- The beam is split at a PBS into control and probe.
- Each arm passes its own AOM, in double-pass, with phase-locked dual RF.
- Orthogonal circular polarizations are made with a QWP.
- The cell sits inside a solenoid and a 3-layer mu-metal shield.
- A Glan-Taylor separates the control from the probe before the photodetector.
- The reference layout is Fig. 10 of arXiv:2205.10959v2 (Finkelstein, Bali, Firstenberg, Novikova 2022).

Plan: buy 2 AOMs plus an EOM.
Method B is hyperfine Λ-EIT driven by an EOM at 6.834 GHz. It is complementary, for CW hyperfine characterisation. Its storage options are still marked "to verify". It needs these extra items:

- EOM
- microwave synthesizer
- microwave amplifier
- Fabry-Pérot
