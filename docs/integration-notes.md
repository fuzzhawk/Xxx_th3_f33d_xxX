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
- Creatures: spirits.js done; monster() returns it (square frames facing right; walk/attack/hurt/dead/big/anatomy lazy); beasts.js deleted (lead).
- Images: background groups + sprite tags; CI fixes done (Commons vetting loosened + diagnostics, Met v1.1, AIC chunked) — needs CI re-run together with the builder fixes.
- Sky Fox: done (three.js SNES polygons, 7 environments, 3 bosses); hint set.
- Grave Merge: done (spirit chains, graveyard scene, merge/evolve moments); `trails` mutator excluded.
- Feed content: psych 8 physics generators, products with 2–4 matched PNGs (`imgs`), power scale facts + `why` lines; no CSS.
- Road Racer: done (instant steering, never stuck, explosions/chain blasts, 6 biomes × 5 stages, checkpoints); billboards/signs no longer mirrored (lead); hint updated.
- Haruspicy: done (burst sacrifice, physics gore, spirit ichor, landing-position readings); liver house names drawn along the spokes (lead).
- Downhill: done (late-press backflip only, landing tolerance, smooth hill, gap wall fix, parallax/time-of-day); hint updated.
- Hell Maze: done (three.js Build-style sectors, slopes, room-over-room bridge halls, 7 weird weapons, gibs/decals/pools, spirit monsters + boss); doom.js deleted; hint updated.
- Crystal Quest: done (seeded 5-chapter story with twists, shops/gear, 3-phase bosses with telegraphed attacks, 6-class recruits, Book II).
- Crystal sheets: PNG for the IndexedDB cache is now encoded in the worker (OffscreenCanvas.convertToBlob); main-thread toBlob only as an idle-time fallback (lead).
- Expeditions: done (9 places × 8 mission types, goal panel + arrow, Crystal friends, spirit foes); mystery.js deleted; hint set. Old game keys in older packages (mystery, stacker, necro, golf) are upgraded on load (`upgradeGamePost` in all.js, called from feed.load).
- Action four: done (Slingshot horizontal rework on new rigid.js; Rocks gentle waves + psychedelic backdrop; Robo Arena sparse start + ramp; Cave Horde weaker rock + calm autopilot); physics.js deleted; sling hint updated.
- Outland: done (12 biomes incl. the 8 new ones, rolling terrain, water/ice/lava, time of day, fog/mist/weather, spaced scenery, theme pictures painted into 8 texture tiles + bgSet sky panorama, about a quarter of the enemies); fixed `best` shadowing crash and single-shot autopilot.
- Monster Battle: done (overworld region per post with tall grass, village shrine, trainers; 8-element type chart, 55 moves, status/weather, SP 必殺 BURST; catch orbs, dex, team of 6, evolution; anime FX); hint updated.
- Memes: 8 new formats (venn, nobody, placard, wanted, align, flow, graph, triptych), subject-coherent remixes, conversation strips ("A and B on <subject>"); strip volume online depends on Wikiquote subject matches.

## To do
- Service worker cache bumped to feed-shell-v4 (lead).
- Link any further `www/css/<package>.css` files (only oracle-rhymes.css so far: linked + in sw.js SHELL).
- Final (done 2026-11-07): harness pass over all 38 game types with no errors; app smoke test clean; offline full build 4,205 posts with every game key registered; merged into claude/repo-access-mobile-a25dht in one push with packages/request.json → 2026-W45.
