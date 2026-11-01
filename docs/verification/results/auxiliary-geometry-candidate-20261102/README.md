# Auxiliary geometry — rebased candidate only

Rebased from CURRENT `styles.css` / `agent.css`, not copied from the old candidate snapshots. All nine approved old auxiliary hunks matched the current text exactly once; only those edits were replayed. New functional styles elsewhere in both files are retained.

Scope: allocate the existing 12px right gutter outside the configured auxiliary content width; remove the extra 6px desktop top offset and outer border; auxiliary-only 53px header / 36px heading buttons; mode/intro 17px horizontal insets and 25px segmented buttons; compact straight border, expressive complete 28px corners with 10px bottom gap, dock 22px corners. Compact keeps its unguttered width. The existing <=1240px overlay retains its prior 1px border.

No general Modal/F05/F06 changes, no dock navigation 48px→50px, no TS/Rust or canonical changes. Existing native before evidence and design sources remain in `.work/auxiliary-geometry-20261101/source-sha.json` / `before-manifest-snapshot.jsonl`; root independently confirmed Mist's narrow-by-about-12px / low-by-6px difference. The frozen eight D01 image/AX pairs remain historical before evidence, not after-fix passes.

Prepared only. No tests, CSS parser, build, native app, GUI or appdata work was run. Root reviews and integrates; actual native after screenshots remain pending. Full current before/after hashes are in `source-sha.json`; `source.patch` includes both product-file deltas.
