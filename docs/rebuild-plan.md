# Feed rebuild — requests, decisions and ownership

Source: the owner's filled-in `feed-change-requests.docx` (31 Oct 2026) plus follow-up answers.
Work happens on branch `claude/feed-rebuild` and ships in one push to `claude/repo-access-mobile-a25dht`
(Netlify deploys that branch; the APK and package builds run from it).

## Decisions (from the owner)

| Topic | Decision |
| --- | --- |
| New creature engine | Folk-tale spirits crossed with cute animal chimeras (Ghibli-style spirits + owl-cat/fox-fish mash-ups). Built at high resolution, resampled to several pixel scales, outline and dithering on some. Replaces BEASTS everywhere. |
| MARROW posture | Fix hunched/slouched spine, stiff/robotic motion (no weight shift or follow-through) and proportions. |
| Hell Maze | Build-engine style (Duke 3D): polygon sectors, varied floor/ceiling heights, slopes, rooms over rooms. |
| Rollout | All at once: one push and one package rebuild at the end. |
| Manor Mystery | Becomes **Expeditions**: each post is one mission to a different place with one clear goal. |
| Monster Battle | Catch-and-collect overworld (Pokémon-style: tall grass, wild encounters, catch, build a team). |
| Tetris (replaces Stacker) | Words in the blocks (cleared lines form aphorisms/quotes) + thinkers react with quotes. |
| Sky Fox | SNES Star Fox flat-shaded polygons; the player flies a low-poly polygon ship. |
| Outland | All eight new environments: snow tundra, desert dunes, swamp/bayou, jungle, alien crystal fields, volcanic wasteland, moon base, mushroom forest. |
| Plinko flippers | Automatic; a tap still drops a ball. |
| Classic erotica (Long reads) | Always shown, mixed into Long reads. |
| Oracle chaos magic | Sigil maker, paradigm shift, random ritual. |
| Rhyming dictionary | Studio tool: type any word → rhymes and near-rhymes, writing pad, ✈ downloads .txt, works offline. |
| D&D + creator | One creator with a full D&D sheet and more traits; D&D oracle posts are random adventurers you can save as your hero; stats are flavour only. |
| Comics | Add surreal/absurd, philosophy/science, public-domain classic strips, and more adult (adult behind the existing toggle). |
| WIP | Pushed to `claude/feed-rebuild` with `[skip ci]`, merged at the end. |

## Requests by item

### Games
- **Plinko**: materials — falling sand, water drops, exploding animals, firecrackers, tracer tails; automatic pinball flippers and bouncers; much more variation between posts.
- **Breakout**: brick sizes vary from current size down to much smaller; power-ups drop from broken bricks (multiball etc.).
- **Merge**: objects rotate as they roll; alternate modes with differently shaped environments.
- **Dash**: more obstacle types, power-ups, particles and special effects.
- **Flap**: more intricate, interesting levels.
- **Stacker → Tetris** (new key `tetris`, `stacker` removed): Tetris-style with words in blocks and thinkers reacting.
- **Pong**: more special effects and power-ups.
- **Peg Shot**: more physics, falling sand and other materials, effects, explosions.
- **Bounce Golf**: removed.
- **Juggle**: multi-layer parallax background.
- **Slingshot**: full rework — horizontal (Angry Birds-like), intricate castles, camera scrolls so levels extend past the screen.
- **Crokinole**: autopilot scores 20 every time — balance it (miss sometimes, human-like).
- **Platformer**: BUG: the cheer emote stops the hero so it falls. Advanced level generation: more platforms and areas, a floor in most parts, bounce pads, ladders, environmental features, power-ups, a beatability check; keep one-tap controls.
- **Road Racer**: more explosions, richer scenery; too easy to get stuck at the roadside; controls feel sluggish.
- **Rocks**: psychedelic effects; less chaotic — start easy and ramp up.
- **Sky Fox**: rebuild with SNES Star Fox polygons, less screen rotation, tighter controls, environments (city, desert, forest…), polygon ship.
- **Downhill**: too hard — backflip starts instantly after jumping, player lands on their back after small jumps; longer slopes and smoother curves; cliff-edge glitch pops the player to the top; smoother, relaxing, gentle gradients, pretty parallax scenery.
- **Robo Arena**: cluttered — fewer entities at the start, build up.
- **Cave Horde**: destructible terrain weaker so it opens up faster; autopilot jitters back and forth.
- **Hell Maze**: Build-engine-style levels (not blocks), more blood, new creature engine monsters, weirder weapons.
- **Outland**: more atmospheric, rolling hills, fewer enemies, more spaced-out scenery, eight new environments, more random images in the textures.
- **Street Brawl**: snappier controls; better MARROW posture.
- **Necromancer**: removed.
- **Grave Merge**: rework with the new creature engine and a better-looking UI.
- **Monster Battle**: catch-and-collect overworld, anime-style effects, more attack types.
- **Chess**: keep. **Joker Hands**: keep.
- **Yacht Dice**: a cup hides the dice before they are rolled.
- **Manor Mystery → Expeditions** (new key `expedition`, `mystery` removed): plot easy to follow, more interesting environments, missions.
- **Crystal Quest**: deeper story, plot points, shops, bosses, character recruitment.
- **Crypt Hack**: more open levels with more space; an elegant fog of war instead of blocks popping into view.
- **Word games, 2048**: keep.
- **Arrow Escape**: crooked (bent, snake-like) arrows.

### Shared
- New creature engine (see decisions).
- MARROW and Crystal characters must match: one character design renders consistently in both styles.
- More image sources, vetted for coherence in themed groups; clouds, landscapes and paintings used for 50% of backgrounds.

### Other post types
- **Wikipedia**: add music theory, mathematics, biology, offbeat history.
- **Videos**: avoid AI-generated videos; prefer videos 5–20 years old.
- **Memes (remix)**: more meme formats; more coherent while staying surreal.
- **Memes (strips)**: a real conversation between authors — quotes on a chosen subject, juxtaposed.
- **Comics**: more comics (see decisions).
- **Psychedelic**: more generator types, with more physics.
- **Made-up products**: more random, with semi-informed (theme-matched) random PNGs.
- **Long reads**: more classic erotica.
- **Oracle**: more questions, more detailed answers; chaos magic mode.
- **Haruspicy**: new creature engine, more exploding guts.
- **D&D**: merged with the character creator; more traits.
- **Power scale**: better informed, still absurd.
- **Studio**: new rhyming dictionary post.
- **Web app**: a loading animation.

## Work packages (one owner per file)
| Package | Owns |
| --- | --- |
| Creatures | `www/js/spirits.js` (new), `monster()` in `www/js/games/creature.js` |
| Characters | `www/js/marrow/*`, `www/js/crystal/sprites.js`, `www/js/hero.js`, `www/js/studio.js`, `www/js/dnd.js`, `www/js/games/brawl.js` |
| Package builder | `tools/*`, `packages/` data, `tools/data/*` |
| Plinko + Peg Shot | `plinko.js`, `peggle.js`, `materials.js` (new) |
| Arcade five | `breakout.js`, `pong.js`, `juggle.js`, `dash.js`, `flap.js` |
| Merge + Tetris | `merge.js`, `tetris.js` (new), `stacker.js` (delete) |
| Table games | `crokinole.js`, `board.js` (Dice only), `puzzles.js` (Arrows only) |
| Action four | `sling.js`, `rocks.js`, `robotron.js`, `survivors.js` |
| Platformer | `platformer.js` |
| Downhill | `ski.js` |
| Racer | `racer.js` |
| Sky Fox | `flight.js` |
| Outland | `outland.js` |
| Expeditions | `expedition.js` (new), `mystery.js` (delete) |
| Crystal Quest | `jrpg.js` |
| Crypt Hack | `hack.js` |
| Oracle + Rhymes | `oracle.js`, `oracle-data.js`, `chaos.js` (new), `rhymes.js` (new), `www/data/rhymes*` |
| Feed content | `psych.js`, `memes.js`, `productart.js`, `power.js`, loading animation (`index.html`, `www/index.html`, `css`) |
| Monster Battle | `battle.js` (+ new overworld file) |
| Grave Merge | `graves.js` |
| Hell Maze | `hellmaze.js` (new), `doom.js` (delete) |
| Haruspicy | `haruspex.js` |
| Integration (lead) | `games/all.js`, `games/assets.js`, `cards.js`, `feed.js`, `settingsview.js`, harness pages |
