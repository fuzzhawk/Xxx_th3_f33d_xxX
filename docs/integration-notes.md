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

## Morning & evening modes (2026-11-08)
- `www/js/modes.js`: morning / day / evening. The clock picks one when the app opens and after 45+ minutes away (evening 23:00–05:00, morning 05:00–11:00, day otherwise; Settings → Morning & evening turns this off). Top-bar switch and picker; evening adds a blue-light filter (`#bluelight`, amber multiply) with a slider in the top bar.
- `www/css/modes.css`: light pastel morning theme, earth-tone evening theme, mind cards.
- `www/js/mindful.js`: cards made on the phone — morning: greeting, body + breathing pacer (glowing body part, in 4 · hold 2 · out 6), short prompts; evening: greeting, dream guides (text), dream scenes, imagined worlds with a painted postcard. Also the quote card.
- `www/js/feed.js`: mode feeds show only mode content: package posts from `morning.json` / `evening.json` (wiki, video, quote, poem) mixed with mind cards and the garden (third card, then every 5+). The day feed gets a garden card every ~22 posts (`settings.gardenInFeed`).
- `www/js/games/garden.js` (type `garden`): one shared garden in IndexedDB (`garden-v1`), real-time growth and catch-up between visits, planting / watering / seed gathering / harvest, animals that move in and breed when fed in pairs, clearing tall grass to expand, ponds and 11 ruins with rare seeds. Light follows the card's mode; day has gusts, showers and rainbows. Autopilot only tends.
- Builder: `tools/modes.mjs` + `topics.json → modes` (morning: human biology, neuroplasticity, nootropics, breathwork articles; miraculous life, wildlife, vistas, kindness videos; uplifting quotes. Evening: mysticism, dreams, sci-fi worlds articles; introspective quotes; night poems from PoetryDB). CI builder test run 7 passed (`--quick --only morning,evening`).

## Garden world + sage mornings (2026-11-08, later)
- Morning theme is a dimmed, desaturated sage green (`www/css/modes.css`, theme-color `#bfcbbb`; first `#dce5d8`, darkened on request). The body card canvas and the garden's morning light are dimmed to match.
- The garden is now a world (`www/js/games/garden-world.js` + `garden.js`), saved as `garden-v2` (a `garden-v1` save moves into the middle of the new meadows, ruins/plants/animals/inventory kept):
  - The meadows (128×128): meadow, forests (pine/oak/birch, ferns), flower fields, lakes with a small island (tap water beside the shore to build plank bridges), rocky hills with 3–4 cave mouths, 12 ruins including the Cloud Stair.
  - The caverns (64×64, cellular caves): lantern-lit darkness, rubble to clear, pools, glowshrooms (cave-only seeds), crystals, 3 ruins, bats/glowworms/salamanders/cave fish; ladders back up to each mouth.
  - The sky islands (64×64): islands over a cloud sea joined by cloud paths, mist to clear, cloud steps (tap the cloud sea beside an island), 3 ruins, sky orchids, cloud sheep/swallows/dragonflies; reached by the Cloud Stair once uncovered.
  - Map chunks are painted on demand (16×16 tiles, LRU of 54) and a minimap shows explored tiles; draw cost ~0.5 ms/frame in the test browser, save ≈200 KB.

## Garden: lo-fi pixels and live terrain (2026-11-08, later still)
- Bug fix: after planting (or watering, feeding, clearing) the hero stayed in the cast pose. Crystal's `cast()` loops until `stopCast()`, so `garden.js` now stops the cast when the task timer runs out and whenever a new walk starts.
- The world is drawn into a 240×280 buffer at one pixel per world pixel and scaled up without smoothing, with film grain and a soft vignette; the UI stays sharp on top.
- Live terrain, stepped at 60 Hz inside `step()`:
  - Grass is no longer baked into the chunks. `bladesFor()` gives each tile its blades: tall wild grass, or small clumps on meadow/forest/flower tiles. Each tile is a spring pushed by a travelling wind wave and by anyone walking past (hero and animals).
  - Plants sway on springs too; trees shake and drop leaves when brushed. Leaves and petals fall, rest, fade and get kicked up again.
  - Water is a 2-px height field over the view (`Ripples`): rain, wind, swimming animals and new bridges send rings across lakes and cave pools.
  - Footprints show on sand and paths.
- Sprites (plants, animals, ruins, crystals) are alpha-thresholded and get a selective 1-px outline: a deep shade of the colour they border.
- Cost in the test browser: about 1.3 ms per draw plus 0.3 ms of physics per frame.

## Garden: dreamier, wordless controls, daily wild flora (2026-11-08, evening)
- Actions never hold the hero still. Crystal's animator gained `cancel()`, and `Actor.cancel()` wraps it. The garden cancels any pose the moment the hero walks, and every new walk drops the current action (its effect still lands). Emotes are shorter.
- No UI on the card at all: no minimap, seed, food or compass buttons. `seedFor()` picks the seed for a tile: reeds by water, ferns and trees in forest, sky orchids in the sky, never the same kind twice in a row. With no fitting seed the hero shakes their head. Every 45 s a wisp of light drifts toward the nearest hidden ruin. The first-visit tap ripples stay.
- `drawAtmos()` runs after the lighting. It applies a darker, cooler grade (multiply plus a little desaturation), then two banks of tileable, posterised, Bayer-dithered pixel mist that drift at different depths and slowly breathe, then a highlight-only bloom (a quarter-size copy squared and screened back). The values per light are in `ATMOS`.
- Daily wild flora: `tools/fetch-plants.mjs` (config `tools/data/plants.json`) downloads Kenney CC0 packs in CI via `.github/workflows/plants.yml`. It keeps plant sprites (by name, or by colour for numbered tile packs), trims them and shrinks them to garden sizes, then writes `www/assets/plants/` with `index.json` (kinds: tree, bush, flower, grass, crop, mushroom, cactus). `Wd.floraToday()` picks a dated handful (about 2–3 per kind) and `Wd.floraAt()` scatters them by a per-day tile hash over open meadow, forest and cave floor. They sway with the grass springs and don't block walking. The local test is `node tools/fetch-plants.mjs --local <dir>`; `tools/png.mjs` gained RGBA decoding and a PNG encoder.
- Morning mode is one step darker again (`--bg #a3af9f`), with deeper text and topic labels.
- Videos (`cards.js` `video()`): the YouTube embed uses `controls=0`, no annotations, no keyboard and no fullscreen. It always starts muted so autoplay is allowed, and unmutes once playing when your sound setting asks for it (always allowed in the app; on the web only after you've interacted with the page). The thumbnail stays over the player until it reports playing, plus about a second for YouTube's title flash. If it never starts, the thumbnail stays with a small corner triangle. The player itself never gets taps: one tap toggles sound (or starts a refused video), two taps like. `MainActivity` turns off the WebView's "media needs a user gesture" rule.
- Plants fetcher, round 2: kenney.nl gave no zip link to CI on the first run, so the fetcher now also finds escaped, relative and `/download` links, logs the page title and candidate links when it fails, then falls back to OpenGameArt (CC0 entries only). It also splits sheets into single plants, and each sprite's source is in `index.json` (`src`).
