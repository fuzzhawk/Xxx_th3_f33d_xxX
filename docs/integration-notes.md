# Integration notes (lead)

Running list of wiring the lead must do before the final push.

## Done
- Hints: merge, tetris (games/all.js).
- Package backgrounds → Skin (`skin.bgSet`, 50% of games), loading animation, wiki topic colours.

## Notes from finished packages
- Characters: persona.js shared spec; MARROW VER m5, Crystal VER c2 (caches refresh); brawler roster from the persona pool; saved hero fights every other match; hero = { name, seed, persona, dnd, crystal, marrow } (old saves upgrade).
- Merge + Tetris: done; stacker.js deleted.
- Creatures: spirits.js done; monster() returns it (square frames facing right; walk/attack/hurt/dead/big/anatomy lazy); beasts.js now unused (delete at the end if nothing imports it).
- Images: background groups + sprite tags; CI showed Commons groups empty, Met 410 — fix in progress.

## To do
- cards.js studio `rhyme` routing and oracle captions: delegated to the Oracle + Rhymes agent (check its report).
- psych.js must implement `sand`, `fluid`, `boids`, `orbits`, `pendulum`, `reaction`, `magnet`, `cloth` (Feed content agent) — the package emits them.
- Optional: video year from `p.date`; "Classic erotica" kicker in reads.js when `p.erotica`; zoom view for classic Sunday comic pages (`p.classic`).
- Link any `www/css/<package>.css` files agents create.
- Builder CI re-run after the builder and images fixes (set tools/builder-test.args).
- Final: full harness pass over every game type, app smoke test, merge into claude/repo-access-mobile-a25dht, bump packages/request.json.
