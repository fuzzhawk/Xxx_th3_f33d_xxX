# Integration notes (lead)

Running list of wiring the lead must do before the final push.

## Done
- Hints: merge, tetris, starfox, dice, platformer (games/all.js).
- Video year in the card header (`p.date`), "Classic erotica" kicker in reads.js, tap-to-zoom for classic comic pages (`.zoomview` in style.css).
- Builder CI: video upload dates now come from the watch page's meta tags even behind YouTube's bot check (run 4: 46/46 dated, all 5–20 years old); short-form search ages ("15y ago") parsed; erotica works pinned to known Gutenberg ids.
- Builder CI run 6 (memes/power/products): 5 strips + 21 remixes in a quick build, power facts present, 24 background groups / 570 images; memes fall back to any topic for related facts (quick builds crashed). Product `imgs` are now indexes into sprites.json (`propSrc(i)` in assets.js) instead of copied data URIs.
- Package backgrounds → Skin (`skin.bgSet`, 50% of games), loading animation, wiki topic colours.

## Notes from finished packages
- Characters: persona.js shared spec; MARROW VER m5, Crystal VER c2 (caches refresh); brawler roster from the persona pool; saved hero fights every other match; hero = { name, seed, persona, dnd, crystal, marrow } (old saves upgrade).
- Merge + Tetris: done; stacker.js deleted.
- Creatures: spirits.js done; monster() returns it (square frames facing right; walk/attack/hurt/dead/big/anatomy lazy); beasts.js now unused (delete at the end if nothing imports it).
- Images: background groups + sprite tags; CI fixes done (Commons vetting loosened + diagnostics, Met v1.1, AIC chunked) — needs CI re-run together with the builder fixes.
- Sky Fox: done (three.js SNES polygons, 7 environments, 3 bosses); hint set.
- Grave Merge: done (spirit chains, graveyard scene, merge/evolve moments); `trails` mutator excluded.
- Feed content: psych 8 physics generators, products with 2–4 matched PNGs (`imgs`), power scale facts + `why` lines; no CSS.
- Road Racer: done (instant steering, never stuck, explosions/chain blasts, 6 biomes × 5 stages, checkpoints); billboards/signs no longer mirrored (lead); hint updated.
- Haruspicy: done (burst sacrifice, physics gore, spirit ichor, landing-position readings); liver house names drawn along the spokes (lead).
- Downhill: done (late-press backflip only, landing tolerance, smooth hill, gap wall fix, parallax/time-of-day); hint updated.
- Memes: 8 new formats (venn, nobody, placard, wanted, align, flow, graph, triptych), subject-coherent remixes, conversation strips ("A and B on <subject>"); strip volume online depends on Wikiquote subject matches.

## To do
- cards.js studio `rhyme` routing and oracle captions: delegated to the Oracle + Rhymes agent (check its report).
- Link any `www/css/<package>.css` files agents create.
- Final: full harness pass over every game type, app smoke test, merge into claude/repo-access-mobile-a25dht, bump packages/request.json.
