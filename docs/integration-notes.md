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

## Garden: real taps, trails, fog that parts, photo ground, layered caves, other gardeners (2026-11-08, night)
- **The movement bug:** once you were playing, the card sends `down`/`up` (not `tap`), and the garden only had `tap()`, so only the first tap of a session did anything. The garden now has `down`/`move`/`up`: a short press is a tap, and a drag steers the hero toward your finger, sliding along obstacles.
- **Trails:** tall grass, rubble and mist no longer block walking (`walkable()`; paths go straight through). Each footstep flattens two levels (`underfoot()`/`trample()`), so one walk through leaves a clear trail. Grass walked over nine times wears into a dirt path (`Rm.wear`, not saved; the path is).
- **Weather:** the wind is gentler and changes slowly. The full-screen mist layers are gone. Fog now comes in world-anchored patches (`stepFog`/`drawFog`): clusters of dithered puffs on springs that drift a few px/s downwind and part around the hero, animals and gardeners. They're denser over water and in forest, and are clouds in the sky. The amounts per light are in `ATMOS`.
- **Kenney flora removed:** the procedural plants are the garden's own again (`www/assets/plants`, the plants workflow and its fetcher are deleted).
- **Plant opacity:** Settings → Morning & evening → "Garden plant opacity" (80–95%, `settings.gardenPlantAlpha`). Flowers, shrubs and grass draw at that alpha ±3% per plant; trees stay solid.
- **Layered cave automaton** (`caField`): the classic cave automaton run at three scales and sampled as smooth fields.
  - `soilOf(Rm)` gives every tile 3 bits: dry/lush drifts, mossy hollows, and clover/pebble/crystal-sand clumps. It's derived from the seed and never saved; the painter tints and decorates by it in every realm.
  - Caves are now the blend of the three fields, cut at 46% floor, with separate halls joined by wandering tunnels. A garden whose cave hasn't been entered yet gets the new cave on load (`regenCave`, `G.caveGen = 2`).
- **Photo ground textures:** `tools/fetch-textures.mjs` (config `tools/data/textures.json`, workflow `.github/workflows/textures.yml`) pulls CC0 textures from Poly Haven, with ambientCG as the fallback. Each becomes a seamless 64 px greyscale detail tile centred on mid-grey in `www/assets/textures/` (`index.json` lists sets and credits). `texture()` lays them over the painted ground with `overlay`, so palette and light still decide the colour. With no textures, the ground is simply painted. `tone()`/`mixHex()` now return hex and accept rgb(), so tints chain (chaining was silently producing invalid colours).
- **Other gardeners** (`spawnNPCs`/`stepNPC`/`npcThink`/`npcAct`): three in the meadows, one in the caves (with a lamp) and one in the sky. They wander (sometimes through tall grass, making trails), sow (at most 24 a day, `G.npcSown`; plants marked `by: 'npc'`), water young plants, pet animals and wave when you pass. They respawn with each visit; their plants stay.

## Vitriol, Cave Crawler, Seed & Sage walking, a fifty-times world (2026-11-09)
- **Whole games in the feed** (`cards.js` `EXT_GAMES`/`extGame`, `feed.js`): Vitriol (vendored from fuzzhawk/-vitriol, branch `claude/procedural-shooter-game-hp5wkx`, GPL-3.0, in `www/ext/vitriol`) and Cave Crawler (`www/ext/cave-crawler.html`, from your upload). They alternate in the day feed every ~17 posts. Each runs in an iframe loaded on activate and dropped on deactivate.
  - `www/ext/vitriol/embed.js` (only with `?embed`) starts STORY on autopilot and adds a portrait camera that follows the operative and zooms with the action. Vitriol is watch-only: no touch controls.
  - Cave Crawler's appended embed script picks a delver, plays itself (digs, loots, plays cards with targets, answers chests and waystones) and zooms on the delver. A tap on the card hands it over.
- **Seed & Sage movement** (from fuzzhawk/weird_game `js/surface.js`), and nothing else from it:
  - A floating stick: drag anywhere, speed scales with the pull, and the anchor trails your finger past a 40-unit radius. `HERO_SPEED` 112.
  - The hero moves in sub-steps with a four-corner footing check (`standable`/`moveHero`).
  - Taps act only within reach (`reach()`). Portals are taken by walking onto them (`portalUnderfoot`).
- **World v3** (`garden-world.js`): realms surface 900², canyon 384², mountain 384², cave 192², deep 256², sky 192², canopy 192² (`SIZE`/`KIND`).
  - Behaviour follows `Rm.kind` (surface / cave / sky); palettes follow the name, with the new levels derived by `shiftPal`.
  - Nine surface biomes from coarse noise (`biomeAt`, `BIOME_TINT`) shape the ground and what grows.
  - Wild plants and animals are made per 16×16 chunk the first time you come near (`populate`, `Rm.pop`). Saves are run-length binary (`rle`); a 900² world saves to about 0.7 MB.
  - Giant trees (`PLANTS.giant`, `giantSprites`): trunks block three tiles, and crowns draw on top, thinning to a veil when you're beneath.
  - Lifts (`link`, `liftSprite`, portal kind `lift`): hills to the mountains, canyon rims down, mountain summits to the sky, cave shafts to the deep, giant trees to the canopy.
  - Upgrade (`upgrade3`, `fromV1`): an older garden is embedded in the middle of the new meadows. Its cave and sky are kept if visited; otherwise the new ones are linked to its mouths and stair.
- Fixed on the way: `genCave` computed a quantile per tile (a full sort each time): fine at 64², about a minute at 256².
- **People**: gardeners plus philosophers (2 in meadow-like realms, 1 elsewhere). Tapping a philosopher within reach shows a quote from `QUOTES` (public domain) in a bubble: the only text in the garden. People sometimes walk along with you after a greeting, and animals follow after a pat or a snack (`follow`).
- Plants are looked up by 16-tile cells (`plantIndex`/`plantsIn`) instead of scanning every plant.
- **Cell life** (`www/js/cells.js`, mind kind `cells`, morning and evening): a procedural microscope view. A vessel swells with each beat; red cells tumble through it and white cells roll along its wall. Oxygen and glucose drift out to hungry cells, which glow, grow and divide (toward the wound if they're near it). The wound starts with a gap and debris, and mends. Morning: 54→72 bpm and a waking brightness. Evening: 60→48 bpm, violet light and faster repair.
- **Dreamscape** (`www/js/dreamscape.js`): the other.worlds card's 3D background. It flies a looping path past floating islands (ruins, braziers with flickering flames) and through stone-ring tunnels, with far giant creatures and a curious swarm. It uses the vendored three.js and one shared 280×224 renderer; the scene is built on activate and disposed on deactivate. Without WebGL it falls back to the painted world.
- **App icon:** a brain with an eye (`www/icon.svg`, `www/icons/*`, `assets/icon-*.png`, `assets/splash*.png`). The APK build regenerates the launcher icons from `assets/`.

## Garden: framerate, swimming, ten kinds of country, findable ways up and down (2026-11-09)
- **Framerate** (headless profile, walking: draw 6.8 → 3.7 ms a frame):
  - Tall grass no longer sways. It's painted into the map chunks with a static fringe of blades (`paintWild`).
  - Short grass is one cached sprite per tile at one of 7 lean angles (`clumpAt`/`clumpSprite`), instead of ~12 rects per tile.
  - The colour grade is one cached multiply layer (time of day, sunset wash, rain dimness and vignette) plus one screen layer (`drawGrade`/`makeGrade`). It replaces several full-screen passes a frame.
  - The film grain is gone. Ripples skip when no water is in view.
  - The chunk ahead of you is painted one frame early, so walking on never waits for a repaint.
  - Quality steps down by itself when frames run slow (`this.q`): bloom goes first, then the colour drain.
- **Walking:**
  - Tall grass, rubble and mist never block or slow you; they still wear into trails.
  - Water is swum: 72% speed, a new `swim` crawl in the crystal sprite engine (`ANIMS.swim`, animator input `swim: true`, `'stroke'` events), and the sprite cut at the waterline with ripple rings (`drawWalker`).
  - Bridge building is removed.
  - Sprite sheets are re-baked once for the new rows (`VER` c3).
- **Hero animation as in Cave Crawler:**
  - Its animator settings (walk from 7.5 px/s, run from 55, a frame every 5 / 6.5 px) and pace (90 px/s).
  - The animator gets the velocity you ask for, with the facing eased slightly.
  - A footstep dust puff and its soft pixel shadow.
  - The camera snaps so the hero and ground move by whole pixels together; this was the 1-px shiver.
  - The old glitch: tall grass slowed you to 69 px/s, just under the 70 run threshold, so walk and run swapped each time you crossed a tall-grass tile.
- **No overlay animations:** fireflies, morning sparkles, gust streaks, cave dust motes, drifting cloud shadows, the rainbow and the grain are removed. Rain falls in the world; snow falls over the frost country and the mountains; both scroll with the camera. Lights (spire beams, dusk glows, the cave lantern) are world-anchored.
- **Ten kinds of country** (`BIOMES`, `biomePal`, `biomeMap`): meadow, old woods, flower downs, marsh, heath, autumn wood, dunes, ancient grove, frost fields, fungal glade.
  - Each has its own day palette (morning and evening are derived), its own texture set (`tex`; six new sets in `tools/data/textures.json`, with fallbacks until the textures workflow fetches them), its own mist colour and thickness, short-grass density, and wild plants and animals.
  - Borders are noise-warped and dithered.
  - New wild plants: maple, snow pine, giant mushroom, cactus, heather.
  - New ground: `ICE` (frozen water, walkable) and `CHASM` (gorges, painted with red strata and rope bridges).
- **The meadows v4** (`genSurface4`):
  - Three rivers.
  - Marsh pools.
  - Seven gorges, each with a lift down to the canyons at its rim.
  - Sky spires: tall stone horns with a crystal and a column of light visible from far off. Eleven go up to the mountains and two up to the sky.
  - Baskets up four ancient trees into the canopy (`liftSprite('spire'|'shaft'|'vine')`).
  - One gorge, one cave mouth, one spire and one giant tree are always within about 20–45 tiles of the start.
  - Old roads (a spanning tree of all the ways out) join them, with plank bridges over water and gorges.
  - Tall grass covers about 8% of the land instead of more than half; rubble and mist are also thinner in the other realms.
- **Upgrade** (`upgrade4`): a v3 world is rebuilt from its own seed. Sown plants and arrived animals move to the nearest good spot to where they were. Seeds, food and the garden's age carry over.

## Calmer embeds, the horror forge, Hell Maze in Quake's colours (2026-11-13)
- **Vitriol and Cave Crawler cards:**
  - The camera is pulled out: Vitriol's frame fills most of the card's width; Cave Crawler shows the whole cave.
  - The clock runs slower in the card (`window.__TIMESCALE`, 0.72–0.74), and the autopilots react later and play steadier.
  - Vitriol draws its HUD on a canvas the shape of the card (`RENDER.layout`, `window.__HUDCTX`), so every element sits whole in the card.
- **Horror forge** (`www/js/horror.js`):
  - Kinds: zombies, demons, imps, wraiths, abominations, hounds and spiders, at any size (`horror(seed, size, { kind, tier })`).
  - Each monster is built as 3D solids and drawn from 8 angles like Doom's enemies: 5 are painted and 3 mirrored. Pick a view with `viewDir`.
  - The light, cavity, palette snap and ink outline come from Vitriol's crawlerforge pipeline.
  - Animations: idle, walk, attack, hurt and dead.
- **Hell Maze:**
  - Look and feel: Quake/Heretic moods (`MOODS`), torchlight pools, grime and fog.
  - Weapons: a rolled arsenal with affixes (`rollArm`).
  - Destruction: a voxel skin on the walls (`cladWalls`), plus voxel crates that shots chip and blasts crater. Barrels explode, with gibs and burning.
  - Levels: the grid grows with depth and has more loops. New rooms: galleries (a walkway on three sides and a stair up the fourth; the nav grid's second layer) and broken partition walls (`baffles`).
  - Checks: every room, walkway and exit was reachable on 12 seeds × 4 depths.
- **Crypt Hack:**
  - Every monster comes from the forge, themed by zone (`HORDE`) and seen from 8 angles on the isometric screen (`mobDir`, `mobFrame`).
  - Bodies stay where they fall.
  - Views are drawn 2 a frame (`warm`).
- **Crystal Quest:**
  - Horror monsters mix in with the cute ones: about 1 in 5 foes in the world and over half in dungeons (`foeArt`). They lunge, flinch and fall in their own poses.
  - About half the dungeon bosses come from the forge, and so does the villain's Unbound form.
  - Their elements map to the game's (`HEL`): undead → shadow, fire → fire, poison → beast.

## Living cells, worlds built from their words, more erotica, no chickens (2026-11-13, later)
- **cell.life** (`www/js/cells.js`): each card is one of five tissues, with a real capillary bed. An arteriole branches into single-file capillaries, with cross-links between them, and they join a venule. Red cells darken as they unload oxygen; in the lung they brighten.
  - **muscle:** a motor nerve fires; a calcium wave sweeps the fibre and the striations bunch as it contracts; ATP sparks.
  - **brain:** spikes leap node to node along myelinated axons to synapses that release transmitter; astrocytes carry glucose from their endfeet; microglia probe with fine arms.
  - **wound:** bacteria swim and divide; neutrophils squeeze out through the venule wall to hunt them; platelets and fibrin plug a leak; a macrophage clears debris; fibroblasts lay collagen.
  - **lung:** alveoli fill the gaps between capillaries and swell with each breath; O₂ crosses in and CO₂ crosses out; type II cells release surfactant; a macrophage cleans up dust.
  - **gut:** a villus with a brush border; sugars and amino acids go to the capillaries and fats to the lacteal; goblet cells release mucus; the lining migrates up and sheds at the tip.
  - A live caption names each process and the microscope drifts over to look.
  - `p.tissue` forces a tissue; `www/_cells.html` (gitignored) shows all five.
- **other.worlds** (`www/js/dreamscape.js`): the 3D world is built from the card's own words (`WORLD_KEYS`; mindful.js draws them in the same order as before).
  - **star:** red dwarf, twin suns, white dwarf, orange sun, pulsar with sweeping beams, or a blue star in dust.
  - **sky:** violet, a green aurora, the ring of a broken moon, drifting islands, a sun on the horizon, or three moons.
  - **land** (a terrain heightfield): mushroom spires, a crystal canyon that the camera flies down, a waving shallow sea with sun glitter, terraced mesas with long shadows, coral cities with lit windows, or glass dunes.
  - **people:** colour-speech rings, sky whales singing, light waves through moss, breathing sleeper pods, book towers with books circling, robots in gardens, a lantern caravan with tents, or glowing children on the peaks.
  - **custom:** groves, dream bubbles, rising lanterns, song ribbons, a timed eclipse, gates to fly through, or silence.
  - The camera swoops, banks and turns to look at points of interest.
  - `www/_worlds.html` (gitignored) previews it.
- **Erotica** (`tools/data/erotica.mjs`, `buildErotica`/`eroTales`/`buildContemporary` in the builder):
  - More public-domain works, now including:
    - Recently public-domain modern novels: *Lady Chatterley's Lover* and *Women in Love*.
    - *Teleny*, Louÿs' *Aphrodite*, *Lysistrata*, *Venus and Adonis*, Donne, Baudelaire and Rochester.
    - Whole bawdy tales from the Decameron, the Heptameron, Balzac's *Droll Stories* and La Fontaine.
  - Auto excerpts keep the most sensual candidates. Works marked `light` use a ban that still excludes youth, family, captivity, violence and animals but allows feelings.
  - Tales must pass the hard ban plus a tale ban (no girls, maids, virgins, lads or daughters anywhere in the tale).
  - The hard ban now also covers animals.
  - **Contemporary:** explicit, complete, English Original Work stories on Archive of Our Own marked "No Archive Warnings Apply" and clear of `ao3Ban` (minors, school and college, family, force and coercion, animals).
    - Only AO3's own listing is used (title, author, the author's summary, tags, length and kudos), with a link to read the story there. The repo is public, so modern copyrighted stories are never copied into packages.
  - Shares: `reads.erotica` 44 and `reads.contemporary` 16.
- **Oracle:** the chicken augury is removed (builder subs, client, data). Old packages' augury posts render as dice.

## Garden: the dream world (2026-11-15)
The garden is rebuilt as a wordless dream to walk through. Same world sizes; old gardens are upgraded in place (v4 → v5, `dreamify`) and keep everything sown, found and carried.
- **Modules:** `garden-kit.js` (pixel helpers, `glowSprite`, `vivid`), `garden-art.js` (all new sprites), `garden-dream.js` (world additions, `populateDream`), `garden-live.js` (interactions, whales, giants, motes, lights; installed onto `Garden`). `garden-world.js` and `garden.js` call into them.
- **Look:**
  - Palettes are pushed toward richer colour (`vibrant`); the full-screen saturation pass is gone (it was the slowest thing in the frame).
  - Tile edges are soft: higher ground spills a ragged fringe into lower, with rounded corners and a dithered blend between countries (`paintEdges`, skipped for interior tiles).
  - Trees are drawn by `treeSprite`: leaf-puff crowns, tapered trunks, four variants each, a shadow under each. New kinds: cypress, redwood, palm, ginkgo, wisteria, jacaranda, acacia, baobab, mangrove, crystal tree. Some standing trees are re-speciesed so old woods vary too.
  - Lights are cached glow sprites (lamps, windows, neon, treasure, glowing plants and creatures, wisps); caves cut their darkness with cached discs. Forest light shafts, water glints and an aurora (frost dusk, mountains, high sky, star sea) are world-anchored.
  - Motes blow through each country: petals, leaves, dust, spores, embers, stardust (`MOTES`, `REALM_MOTES`). Chimneys smoke.
- **World additions:**
  - **Villages:** 12 on the surface (one within about 60 tiles of the start), two each in the mountains and canyons, cloud houses in the sky and high sky. Houses in the country's style (cottage, timber, stone, igloo, adobe, mushroom, stilt, treehouse, cloud) round a well, with lamps, flower beds, fruit trees, sometimes a windmill, stall or field; joined to the old roads. Villagers live in the houses and go indoors at dusk.
  - **Neon city** (`S.city`, ground `STREET`): about 150 towers on a street grid with a canal, a holo-plaza, signs and lamps. It has its own dusk and drizzle. Lifts: three hatches down to the undercity (`under`, a neon night market), three tubes up to the rooftops (`roofs`, gardens and skywalks over the lights).
  - **Depths:** canyon → `gorge` (violet, glowing river, crystal flora) → `abyss` (lakes of fire that cannot be crossed, embers).
  - **Heights:** sky → `high` → `stars` (always night).
  - **Forest paths:** 46 winding trails with lanterns, a gate where they leave a road, plank bridges, and a place at the end: chest, fairy ring, spirit pond, ribbon tree, lantern shrine or crystal garden.
  - **Treasure:** chests, urns, geodes, capsules and star chests in every realm, glints in the grass. Each chest gives rare seeds, food and a wisp that follows you (up to 12).
- **Living things:**
  - 20 strange creatures by country and realm (kirin, spirit fox, moth deer, mossling, jellies, garden snail, island tortoise, white stag, moon hare, axolotl, crystal crab, kodama, ember bird, angler, manta, flying koi, phoenix, drone, city cat, gecko).
  - **Sky whales** in the sky, high sky and star sea, on rounds set by the clock, some below the islands; tap one and it sings, the others answer, and it comes over.
  - **Giant gardeners** (five, saved in `G.giants`): each footfall sows flowers, shrubs and quick-growing saplings and turns the ground to forest. Tap one and it follows you for a while. What they grow is capped.
- **Interactions (walking and tapping only):** houses, lamps, wells, stalls, windmills, gates, signs, towers, crystals, chests, glints, fairy rings, ruins, creatures, whales, giants; a tap on water skips a stone. People answer with pictogram bubbles (`iconSprite`). There is no text anywhere: `say()` is a no-op and the philosophers' quotes are gone.
- **Performance** (headless, CPU throttled 4×): about 50–58 fps in every realm; the dream layer costs under 1 ms a frame; a chunk repaint with edges is a few ms once a realm's maps exist.
- **Tested:** fresh world (2.4 s to ready), v4 save upgraded with its own plants and seeds kept, all 13 realms entered, taps on chest, house, lamp and giant, giants sowing while walking. Preview pages (gitignored): `www/_gart.html`.

## Garden: menu button and map (2026-11-15)
- **Menu button** (`garden-map.js`, installed onto `Garden`): a small round button in the card's top-right corner. It shows only while you are in control and standing still, and fades the moment you walk. It opens a menu; entries live in `MENU` (only "Map" for now). Adding one is a row there plus a case in `menuDo`.
- **Map:** fills the card and shows the realm you are in at one pixel per tile.
  - Explored ground is drawn in the realm's own palette for the current mode. Unexplored ground lies under soft cloud with the land faint beneath it.
  - Names:
    - Countries on the meadows are always shown; they are named per patch, for example "Whispering Woods", with "Home Meadow" at the start, and are faint where you haven't been.
    - Villages (generated names), Neon City, the ways up and down (coloured by where they lead, labelled with the destination), found ruins and the places at the ends of forest paths are named once you have come near them.
    - Labels never overlap and stay inside the card.
  - **You:** a pulsing marker pointing the way you face; when you are off the card, an arrow at its edge.
  - **Controls:**
    - Pinch to zoom; drag to pan.
    - Double-tap zooms in there; at full zoom it goes back to the whole realm.
    - ‹ › walk through the realms you have visited, each centred on where you last stood.
    - The target button comes back to you; × closes.
  - **The image** is `Wd.minimap(Rm, mode)` in `garden-world.js`, replacing the old unused explored-only minimap. It is built once per realm (meadows: 17 ms, 67 ms at 4× CPU throttle) and kept current a tile at a time by `miniPaint` from `markSeen` and `invalidate`. It is never saved.
  - While the map covers the card, only the map is drawn (under 3 ms a frame throttled).
- **Card:** while the menu or map is open, the 25-second idle timer in `cards.js` doesn't hand the card back to autopilot (`g.holdPlay()`). Going back to autopilot or scrolling the card away closes them.
- **Tested** (Playwright, touch events): button fades in when still and out while walking. Menu opens, and a tap outside closes it without planting. Map: pinch in and out, drag, double-tap, recentre, cycling realms, close. Evening palettes and the night realms render. No errors.

## Hell Maze: grime, sky, horror, a surviving autopilot (2026-11-16)
- **Autopilot:**
  - **Stuck at spawn (about 9% of levels):** a gallery start room could get a central column, pool island or pit, and the player spawned inside it.
    - The start room now never gets a centre feature.
    - The spawn moves to the nearest open floor if the centre is ever blocked.
  - **Sealed rooms (about 9% of levels):** crates and barrels could land in a doorway and wall off the rest of the level.
    - They now keep 3 m (crates) or 2.2 m (barrels) from every doorway.
    - After furnishing, if any room became unreachable, furniture is removed, nearest a doorway first, until it isn't.
    - Measured over 160 levels: 0 bad starts, 0 unreachable exits, 0 cut-off rooms.
  - **Combat:**
    - Movement is now independent of aim (`go()` turns a world direction into forward and strafe input).
    - It steps out of the line of incoming spit (`dodgeDir`).
    - It keeps biters at 4–5 m and spitters at middle range.
    - Below 40% health it backs toward the nearest health (`planHeal`) while still shooting.
    - It never backs into a wall or off a ledge (`canGo`) and flips its strafe when blocked.
  - **Simulated, headless:**
    - Before: 4 deaths in 40 minutes, two seeds frozen at spawn.
    - After: 1 death in 100 minutes across 20 seeds (levels 1, 5 and 7), never stuck, about 5 levels per 10 minutes from level 1.
- **Weapons:**
  - Drawn part by part in a 180×120 buffer: shaded cylinders with a specular line, bevelled boxes, worn wood grain, rivets, bores, gloved hands (and a left hand on the fore-end of long guns). The metals and woods are darker.
  - Then `grimeGun`: a per-weapon field of grit, rust, scratches and old-blood spatter, soot round the silhouette, a dark outline, colours dulled and dithered to 16 steps.
  - Rebuilt only when the weapon's look changes (the strange ones at 12 fps).
  - On the card it takes the light of the sector you stand in, flickers, warms near a torch, and is lit by its own muzzle flash (a ragged pixel star).
- **Monsters:** `grimeSprite` grits every sheet frame once (grit, filth, dried blood thicker toward the feet, duller colours, dither); eyes and glowing parts stay lit. Pre-warmed one frame per display frame.
- **Sky:** three layers over open yards and halls, living between about 25° and 60° (yards are walled about 6 m up).
  - **Far:** gradient, stars, and a moon, blood moon or black sun.
  - **Clouds:** lit from below, drifting.
  - **Near:** giant spires and a hooded colossus with lit windows and red eyes. It is centred 0.82 × your position, so it shifts as you walk.
  - **Lightning:** every 7–19 s a bolt, the sky flaring, and a white flash when you are under the open sky.
  - Hidden when no open sector is within 22 m.
- **Atmosphere:**
  - Darker rooms (sector light × 0.72) and closer fog (1.5–22).
  - Stronger torch pools; about 28% of torches are dying and gutter.
  - Grain and vignette baked into four small frames (one plain draw a frame).
  - A heartbeat pulse under 35% health.
  - Carcasses on hooks dripping into pools, old blood smeared on walls and dragged across floors, and pairs of eyes in dark corners that blink and vanish when you come within 6.5 m.
  - Ash and embers under the sky, dust indoors.
- **Performance:** swiftshader, view frozen: 41–43 fps with everything on (overlays now cost about 1 fps, the gun about 5). Warm-up is the slow part: reading back each new sheet frame costs about 4 ms, so it is spread one frame at a time.

## Hell Maze: the second wave (2026-11-16)
- **Ten new enemies** (`horror.js` kinds plus Hell Maze `ROLES` 6–15). Each level casts the old garrison plus 3–4 of the new ones (more from level 3), chosen by seed. Sheets are built only for the roles a level uses (`this.cast`; crew sprites are lazy).

  | Enemy | Look | Behaviour |
  |---|---|---|
  | Butcher | sack-hooded, leather apron, cleaver and hook | 30% armour, knocks you back |
  | Stalker | tall, faceless, vertical mouth | almost invisible (flickering opacity) until within 4 m, fast |
  | Bloater | swollen, glowing pustules | swells and bursts in acid near you or when killed; hurts you and its own kind |
  | Skitter | flayed head on six finger-legs | packs of 3–5 |
  | Watcher | floating eye trailing nerves | a red aiming thread, then a beam along it: step out of the line |
  | Priest | robe, bone mask, skull staff | raises a nearby corpse or summons two skitters; summoned foes don't count toward the exit |
  | Charger | horned, tusked, plated | wind-up, straight charge (34 damage and knockback), stunned by walls (takes 1.5× damage) |
  | Leaper | crouched, frog-mouthed | pounces in an arc from 3.5–9.5 m |
  | Worm | segmented, ring-maw of teeth | travels hidden under the floor as a dust trail, bursts up within 2.3 m, untargetable while under |
  | Gunner | flesh and iron, cannon arm, fuel tank | lobs mortar shells that lead you and burst on landing |

  - The autopilot sidesteps beam lines, charges and where shells will land.
- **More detail in the models (all games):** veins, spine ridges, six upper and five lower teeth, shackles and stitches on zombies, exposed ribs. Sprites are bigger in Hell Maze (56–72 px). The old kinds keep their names (detail is rolled after the name; checked on 1,592 names).
- **Meltdown** (`melt`, in `grimeSprite`): in about a third of the columns, the lower part of each body run is pixel-sorted by brightness (light sinks), sometimes with a 1–4 px drip below. Glowing pixels are untouched.
- **Levels:**
  - Rooms can now be **wild**: open-sky canyons or caves with cliff walls, dirt floors, rock shelves 0.45 and 0.9 up, boulders, ponds, dead trees (trunks block), heads on stakes and stone heaps.
  - Yards and wild areas spread into an empty neighbour cell (`rm.ext`). A double courtyard gets a railed rampart with a stair at its far end (`rm.walk`).
  - Corridors between two open areas run under the sky with canyon walls. About 60% of windows are wide lookouts (sill 0.95, opening 2.1).
  - New textures: `cliff`, `dirt`.
  - Per 120 levels: 214 wild areas, 73 courtyards (every rampart reachable), 153 open corridors. Over 160 levels, 0 bad starts, 0 unreachable exits, 0 cut-off rooms.
- **Ten new weapons:**

  | Weapon | Kind | What it does |
  |---|---|---|
  | Chaingun | gritty | spinning barrels |
  | Flamethrower | gritty | passes through, sets alight |
  | Railgun | gritty | instant, pierces everything to the wall |
  | Stake gun | gritty | pierces 3 |
  | Saw launcher | gritty | ricochets, cuts through |
  | Chainsaw | gritty | melee, infinite |
  | Mine layer | gritty | proximity mines that arm after 0.6 s |
  | Bile spewer | strange | acid pools that eat feet for 4.5 s |
  | Soul cannon | strange | slow orb zapping everything within 5.5 m, then a 4 m blast |
  | Harpoon | strange | chains a foe and drags it in, ripping it at the end |

  - Each has a view model, pickup art, rounds, and an autopilot score in `bestWeapon`.
- **Perspective view model:** the weapon is still drawn upright in 180×120 and grimed, then laid onto a receding plane (`warpGun`, `gunWarp`). Rows compress toward the muzzle, and the far end is `GUN_FAR` (0.5) as wide as the near end. Result: 180×60 shown at 360×120, half the old height, pointing ahead.
  - The warp is cached per look. Lighting, the flash and glows are applied after it (glows mapped through `gunWarp`).
- **Corner map:** cached and redrawn only when more of the level has been seen.
- **Tested:**
  - **Autopilot (headless):** from level 1, 1 death in 24 min and about 5.4 levels per 10 min; from level 4 with the new cast, 2 deaths in 24 min. Never stuck.
  - **Frame rate** (swiftshader, view frozen): 49–55 fps with everything on.
  - Crypt Hack, Crystal Quest and Hell Maze run without errors.

## Hell Maze: frame rate with monsters, and a standalone page (2026-11-16, later)

- **Frame drops with monsters on screen.** The cause was the sprite pipeline, not the AI. Each monster's look (8 views × poses) was drawn, grimed and melted on the main thread the first time it was seen, and each grimed sprite was read back with `getImageData`.
  - Measured with 14 awake monsters at 4× CPU throttle: 31 fps before, with drawing sprites costing 12.9 ms a frame and the monster AI 2.6 ms.
  - **Fixes:**
    - **Grime in the bake:** the grime pass (`grime.js`, `grimePixels`) now runs on the raw pixels inside the bake, so there is no second readback. `registerPost('hm', grimePixels)` names it, so the bake can run anywhere.
    - **Worker drawing:** a module worker (`horror-worker.js`) draws frames off the main thread. It rebuilds the genome from the seed and posts the pixels back as a transferable. In `horror.js`:
      - `bakePixels` and `canvasOf` split the bake.
      - `framePixels` gives a frame's pixels by seed.
      - `prefetch(anim, k, dir, urgent)` queues a frame; `has(...)` asks whether it is ready.
      - Without a worker, everything falls back to drawing in place, as before.
    - **Half the views:** views 5–7 are mirrors of 3–1, flipped at draw time (`flipV`).
    - **Warm-up per level:** each level warms its whole cast in the background. Up to 2 frames a frame are drawn in place when a needed view has not arrived yet.
    - **Monster AI at 60 Hz:** it now steps at about 60 Hz (`foeAcc`) instead of every 120 Hz physics step.
    - **Texture refresh:** the 3D textures behind sprites refresh once a second instead of every frame.
  - **After:** 42 fps (52 with no monsters). Sprite drawing is down to 0.2 ms a frame, the monster AI to 1.5 ms, and a cold start costs 7 ms a frame instead of 33.
- **Any width:** Hell Maze no longer assumes a 360-wide screen.
  - **Render width:** the 3D picture is ⅔ of the logical width (`RW`).
  - **Centring:** the weapon, its flash and the status bar are centred (`GXO`). The tap-to-switch weapon zones follow the bar.
  - **Film:** the grain and vignette film is half the logical width.
  - **Field of view:** a screen wider than it is tall uses a 64° vertical field of view (about 96° across) instead of 72°.
  - **In the app nothing changes:** at 360×420, `GXO` is 0, `RW` is 240 and the field of view is 72°.
- **Jumping and mouse aim (used by the standalone):**
  - `movePlayer` no longer snaps a rising player back to the floor (only the player's own jump rises), and the head stops at the ceiling.
  - With nothing to lock on to, shots follow the view's pitch.
  - `aimCone` narrows the sideways lock-on.
- **Standalone page:** `node tools/build-hellmaze.mjs` writes `standalone/hellmaze/index.html`, one self-contained file of about 1.4 MB. Netlify's drop deploy takes the `standalone/hellmaze` folder as it is.
  - **Build:** it needs esbuild (`npm i --no-save esbuild@0.24.2`), which the app does not.
  - **Inlined:**
    - The game and three.js, as one module.
    - The monster worker, as a blob (`HORROR_WORKER_URL`).
    - The W46 wall photos, as data URIs.
  - **Screen:** the engine's 360×420 is swapped for a screen 400 high and 480–720 wide, fitted to the window when the page opens (`HM_W`, `HM_H`).
  - **Controls** (`tools/hellmaze/main.js`):

    | Input | Action |
    |---|---|
    | WASD or arrows | move |
    | Mouse (pointer lock) | look; sensitivity and invert Y are saved |
    | Left button | fire; hold for automatic weapons |
    | 1–5, wheel, E, `[`, `]` | weapons |
    | Q | last weapon |
    | Shift | sprint |
    | Space | jump |
    | P | autopilot |
    | F | fullscreen |
    | Esc | pause |
    | New maze | a new seed; `?seed=N` replays one |

  - **Attract mode:** the autopilot plays behind the title card.
  - **Tested (headless):**
    - Pointer lock, walking, strafing, jumping, firing, weapon keys and wheel, the autopilot toggle, pause and resume, a level change, and no errors.
    - Headless Chromium's pointer-locked mouse moves cancel out, so mouse look was checked with real `movementX` events.

## Garden: the metropolis, the works under it, the railway (2026-11-21)
World v6 (`garden-metro.js`, run by `loadGarden` on a v5 save and by `newGarden`). Older gardens are upgraded in place and keep everything sown, found and carried. Each part runs in its own `try`, so one that fails is logged and the rest still happen.
- **Five new kinds of country** (`BIOMES` 10–14, `B_JUNGLE … B_LAGOON`, only on worlds with `S.bv = 2`):

  | Country | Look | Grows |
  |---|---|---|
  | Jungle | steaming green | kapok hung with vines, monstera, orchids |
  | Bamboo grove | jade green | bamboo clumps |
  | Salt flats | white crust round pink brine | saltbush, salt crystals |
  | Ash fields | cinders with glowing cracks, hot springs | ember trees, fire lilies |
  | Lagoon | turquoise water, white sand | coral, palms |

  - **Older worlds:** the patches that become a new country lose their wild plants and animals, and their chunks are grown again as you come near.
  - Each country also has its village style, motes and map names.
- **The metropolis** (`S.metro`; `districtAt(Rm, x, y)` in `garden-world.js`): about 160×136 tiles round the old city's centre.
  - **Districts:**

    | District | Paving | What stands there |
    |---|---|---|
    | High-tech centre | pale stone with seams of light | glass towers and needle spires round the hologram plaza, sky gardens |
    | Neon quarter | (the old city's style) | the old neon city |
    | Old town | cobbles | brick rowhouses, shops, a clock tower and market in its square |
    | Ironworks | concrete | factories, warehouses, gasometers, silos, smokestacks, cranes, cooling towers, coal and carts |
    | Suburbs | asphalt with kerbs | little houses with gardens and trees, parks with ponds |

  - Rivers through it become canals; streets bridge them, except where a street runs along one.
  - **Buildings** are `{t: 'bldg', k, x, y, w, d, h, v}`, drawn by `garden-metro-art.js` `bldgSprite`. They walk, tap, veil and light like towers. Chimneys, factories and cooling towers smoke.
  - **People:** the centre and neon quarter have Sci-fi citizens; the old town, ironworks and suburbs have present-day ones.
  - **Creatures:** each district has its own (`CITY_FAUNA`).
  - **Air:** each district has its own dusk (`metK`): the neon quarter has its drizzle, the centre a little dusk, the ironworks haze.
- **The works under the city** (`genWorks`): three cave-kind realms built on a lattice of corridors and halls.

  | Realm | Built of | Water | Machinery |
  |---|---|---|---|
  | Steam tunnels (`steam`, 192²) | brick, copper pipes, valves, gauges | murky canals | boilers, tanks, pistons |
  | Clockworks (`gears`, 160²) | brass plate and grates | oil pits with catwalks | turning gears, a clock face |
  | Boiler heart (`furnace`, 160²) | basalt | molten iron, not crossable | furnaces |

  - **Drawing:** painted by `paintWorks` (palettes with `steam: 1|2|3`) with no soft edges. Gas lamps light them and vents puff steam.
  - **Treasure:** brass safes, the chest kind `safe`.
  - **Way down:** lift cages (style `cage`) link the undercity, two street corners in the ironworks, and each level to the next.
- **Railway:**
  - **Stops:** a central station in the centre, five towns, and two country halts by ways up or down or forest-path places, chosen to spread round the map.
  - **Towns:** villages the line serves gain a ring of houses and a footpath to their station.
  - **Routing:** A* on 3-tile cells with a turn cost, avoiding water, gorges, rock and protected places. Buildings and portals are never crossed.
  - **Track:** ground `RAIL`, painted by `paintRail`: ballast and sleepers, curves in quarter circles, trestles over water and gorges (`S.railBrW`/`railBrC`). It shows on the map.
  - **Trains** (`garden-rail.js`): two steam trains half a lap apart, to a timetable from `Date.now()`. They ease in and out and wait 9 s at each platform.
    - **Riding:** tap a train standing at a platform near you to get on, and tap again to get off at the next stop.
    - **Autopilot:** it sometimes rides one to three stops.
- **Twenty new creatures** (`garden-fauna.js`):

  | Where | Creatures |
  |---|---|
  | The new countries | parrot, jaguar, tree frog, red panda, crane, panda, flamingo, fennec, fire newt, ash moth, turtle, dolphin, seal |
  | The city | pigeon, dog, raccoon |
  | The works | clockwork beetle, brass rat, cog owl, steam golem |

- **Twelve treasures:** once all 12 wisps are found, a prompt offers a new world (also a menu entry, "New world").
  - **New world:** `renew()` grows a fresh garden from a new seed. Seeds, food and gems come along; the wisps reset.
  - **Stay:** sets `G.offered`, so the prompt doesn't ask again.
- **Map:** names the districts (`districtSpots`), stations (train glyph, "Central Station", "… Halt") and the new realms.
- **Tested (headless):**
  - **Fresh world:** ready in 2.6 s.
  - **v5 save upgraded:** made with the previous commit's code, then loaded: v6, sown plants, inventory and visited realms kept, metropolis and railway built, 16 realms. 1.6 s.
  - Every district, the train passing and ridden, the three works levels, the map, and the prompt (accepting it grows a new seed).
  - **Frame rate** at 4× CPU throttle: 52–60 fps in the city and the works.
  - No errors.

## Rail Raider (in the road racer's place, 2026-11-21)
`railraider.js` and `railraider-art.js`. The `racer` key is kept, so old packages show it; their "Road Racer" titles read "Rail Raider" (`cards.js`), and the builder names it so from now on. `racer.js` is gone.
- **The game:** an original steampunk shooter on rails, in the spirit of the early-90s arcade rail shooters. The cart drives itself; you drag to aim and hold to fire. The twin repeaters overheat.
  - **Stages:** five, in a seeded order:

    | Stage | Setting | Boss |
    |---|---|---|
    | Coal seams | tunnel arch with timber frames and lanterns | armoured locomotive |
    | Foundry | hall with a molten channel | spider tank |
    | Smog line | viaduct over a city of chimneys and airships | airship |
    | Clockworks | brass hall with turning gears | spider tank |
    | Deadwood trestle | canyon, mesas | armoured locomotive |

  - **Enemies:** troopers, bombers lobbing dynamite, drones, bat swarms, turrets, and goons on handcars along the next track. Incoming bolts and dynamite can be shot down.
  - **Junction:** one per stage, with two arrows. Both branches are built and visible until you pick.
  - **Crates:** steam (health), spread shot, rapid fire, explosive rounds.
  - **Boss:** at each stage's end; shoot out its glowing cores.
- **Drawing:** like Hell Maze: three.js at 240×280, nearest filtering, unlit materials with lamplight baked into vertex colours.
  - **Track:** streamed in 40-unit chunks ahead of the cart (rails, sleepers, ballast, tunnel tube or hall walls, viaduct or trestle posts, billboards).
  - **Billboards:** props and foes are sprites painted in code and sooted (`soot`: grit, rust and soot blotches, sepia, Bayer-dithered palette, an ink outline). Foes, shots, crates and effects share a pool of 140 sprites.
  - **Far layers:** panorama rings that turn slower than you do, under film grain, a vignette and the stage's tint.
  - **Mutators:** the colour mutators (acid, negative, mono, party, trails) are off for this game.
- **Tested** (autopilot at 3× speed): coal seams with its boss, then the foundry with its boss, then the smog line. JavaScript costs under 1 ms a frame; the rest is the GPU (swiftshader 24–34 fps at 4× throttle).

## The Author Pit (a new card, 2026-11-21)
`authorpit.js` (the scene) and `authorpit-script.js` (the cast and the script); `cat: 'pit'` in `cards.js`, with its own header and face.
- **In the feed:** shelved since 2026-11-22: it shows only if `settings.authorPit === true`. When on, it comes about the 8th post and then every 29, in every mode (`feed.js`).
- **The cast:** fourteen writers as Crystal Sprite characters, each dressed in colours that suggest them, with name tags: Wilson, Burroughs, Lovecraft, Colin Wilson, Le Guin, Butler, Sartre, Reich, Joyce, Tolkien, Nietzsche, Hesse, Dick and Atwood.
- **The place:** a sunken garden. At its middle is a table with a blank book. Round it: a café, a crypt door, a cut-up table, an old oak, an orgone box, the river with a bench, a chalkboard, and a fire pit.
- **The script:** 154 beats, about 13½ minutes of real time. Each beat is a line of dialogue with an emote, a walk, an act, a door or a stage note.
  - **The six acts:**
    1. The summons.
    2. What shall it be?
    3. Quarrels in pairs (each pair in its corner).
    4. The hinge, where they settle on a book of doors.
    5. The making: fourteen doors, one per writer, shown as pages of *The Book of Doors*.
    6. By the fire.
  - **Light:** it changes with each act, from dusk to night.
  - **The lines** are written for the card in the spirit of each writer's ideas, with a few words of theirs at most.
- **Playing:** it runs while the card is on screen and keeps its place (`localStorage` `pit.beat`). A tap moves it on, and it loops.
- **Tested:** it plays through, all 14 characters bake, the camera follows each pair, and the card shows and plays in the feed. No errors.

## Bladeview (a new card, 2026-11-22)
`bladeview.js` (the scene, the camera, the post pass) and `bladeview-art.js` (the bakes, the sprites, the billboards); `cat: 'blade'` in `cards.js`, with its own header (`blade.view`) and face.
- **In the feed:** the 4th post and then every 19, in every mode (`feed.js`). It is on unless `settings.bladeview === false`.
- **What it is:** a slow 3D view of a rain-soaked noir city. Each card, and each tap, picks a new place, hour, weather and camera move. The new view comes in on a pixel-sort column wipe.
- **The ten levels**, from the bottom up:

  | # | Level | The view |
  |---|---|---|
  | 1 | The Sewers | a brick barrel vault over black water |
  | 2 | The Works | a machine hall |
  | 3 | Undercity | streets under a concrete slab |
  | 4 | Street Level | wet asphalt, raised pavements |
  | 5 | Lower Walkways | a walkway down the canyon |
  | 6 | The Stacks | walkways higher up the canyon |
  | 7 | Sky Lanes | open air between towers, with traffic |
  | 8 | High Gantries | a gantry high over the street lights |
  | 9 | The Spires | a ledge on a spire |
  | 10 | Rooftop Gardens | planters and tanks over a sea of cloud |

  The blocks are brutalist and Kowloon-stacked. Hanging wires, walkways and bridges cross between them.
- **Weather and light:**
  - Weather: acid rain, drizzle, storm (with lightning), fog, smog, clear, or ash.
  - The hour is night, dusk or dawn; the fog takes its colour from the sky.
  - Light comes from searchlights, refinery flares and steam.
  - The picture is rendered at 192×224 and graded per hour. It is quantised to 18 levels with Bayer dither and grain, from one lookup table, then vignetted.
- **Textures:**
  - Facades, platforms and skies come from Vitriol's Greebleworks, baked in small slices over several frames.
  - They go through the Hell Maze grime pass (`grimePixels` with its new options: gore 0, melt 0) and a pixel-sort streak pass.
- **People:**
  - People are small Mercforge sprites in civilian kit, with a cop now and then. They carry lit umbrellas in the rain.
  - They walk the decks and pavements, kept at least 12 m from the camera.
- **Vehicles:** spinners fly their lanes with lights and beacons, and cars run on the street. A blimp carries a rule-110 screen.
- **Signs and screens:**
  - Neon signs are glyph shapes, not real brands, and they flicker.
  - Billboards run small simulations: Conway's Life, Brian's Brain, rule 110 and Langton's ant.
  - Ad strips scroll short poems from an order-1 Markov chain over an original corpus.
- **Cost:**
  - At 4× CPU throttle in software GL, the post pass takes about 1.5 ms of JS per frame. The rest of each frame is the GPU readback.
  - A view takes about 1.5–1.8 s to bake and build. A tap transition takes about 2.5 s.
  - It renders at about 30 fps and stops when the card leaves the screen.
- **Tested:** all ten levels go live with no errors. Eight taps in a row each build a new view, and the heap stays flat. The card shows, plays and changes on a tap in the feed.
