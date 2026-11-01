# Integration notes (lead)

Running list of wiring the lead must do before the final push.

## Done
- Hints: merge, tetris (games/all.js).
- Package backgrounds → Skin (`skin.bgSet`, 50% of games), loading animation, wiki topic colours.

## To do
- cards.js: studio `sub: 'rhyme'` routing + caption; oracle labels for `sigil`, `paradigm`, `ritual` (check the Oracle agent's report).
- psych.js must implement `sand`, `fluid`, `boids`, `orbits`, `pendulum`, `reaction`, `magnet`, `cloth` (Feed content agent) — the package emits them.
- Optional: video year from `p.date`; "Classic erotica" kicker in reads.js when `p.erotica`; zoom view for classic Sunday comic pages (`p.classic`).
- Link any `www/css/<package>.css` files agents create.
- Builder CI re-run after the builder and images fixes (set tools/builder-test.args).
- Final: full harness pass over every game type, app smoke test, merge into claude/repo-access-mobile-a25dht, bump packages/request.json.
