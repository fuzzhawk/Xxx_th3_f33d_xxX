# Brief for rebuild agents

You are one of several agents rebuilding parts of **The Feed** in parallel. Read `docs/rebuild-plan.md` for the
owner's requests and decisions. Your prompt names your work package and the files you own.

## Rules
- Edit **only the files your package owns** (plus new files you create for it). Other agents are editing other
  files at the same time. If you need a change elsewhere (registry, shared CSS, cards.js, assets.js, config), do not
  make it: describe it in your final report and the lead will make it.
- Do **not** commit, push, or run git commands that change the working tree (no checkout/stash/reset). Read-only
  git (diff, log, show) is fine.
- Do not edit `www/css/style.css`. If you need CSS, create `www/css/<your-package>.css` and say so in your report.
- Match the surrounding code: vanilla ES modules, no build step, compact style, sparse comments, names like the
  neighbours. No new npm runtime dependencies; three.js is vendored at `www/js/vendor/three.module.min.js` and must be
  loaded with a dynamic `import()` (see `www/js/games/outland.js`, `loadThree`).
- Everything must work offline on a phone (Android WebView via Capacitor, and mobile browsers). Keep per-frame work
  light; prefer low internal resolutions for heavy rendering.
- Finish with a short report: what you built, files changed/created, anything the lead must wire up, what you
  could not verify.

## Game framework (www/js/games/engine.js)
- `class X extends Game` with hooks `setup()`, `step(dt)` (fixed 1/120 s), `draw(ctx)`, `autopilot(dt)`,
  `down(x,y,id)`, `move(x,y,id)`, `up(x,y,id)`, `tap(x,y)`, `hud()` (string for the score pill). Logical canvas
  `W=360`, `H=420`. `this.rng()`, `this.r(a,b)`, `this.ri(a,b)` are seeded; `this.post.seed` is the post seed.
- Games self-play on autopilot until tapped (`this.auto`); `static noAuto = true` makes a game wait for a tap.
  Autopilot must keep working and must look like competent play.
- Mutators: `this.mods`, `this.G` (gravity ×), `this.T` (time ×), `this.S` (size ×); `static noMods = [...]` bans some.
- Theme art: `this.skin` (www/js/games/assets.js): `skin.pal` palette, `skin.col(i)`, `skin.pick(key, ...roles)`,
  `skin.list(key, n, ...roles)` for PNGs/canvases by role (`hero`, `enemy`, `item`, `tile`, `bg`…), `skin.bg`,
  `skin.texFor(k)` weathered photo textures, `skin.creatures` (6 generated creatures: `.frames[0..1]`, `.walk[4]`,
  `.attack[3]`, `.hurt`, `.dead`), `skin.crystal(k, era, dirs)` Crystal Sprite sheets, `skin.vehicle(key)` random PNG.
  Helpers: `drawFit(c, img, x, y, w, h, rot, flip)`, `ready(img)`.
- Characters: Crystal Sprite Engine — `www/js/crystal/README.md` and `www/js/crystal/sprites.js`
  (`Actor` with `update(dt,{vx,vy,grounded,airVy,lowHealth})`, verbs `jump/attack/shoot/cast/hurt/ko/revive/emote/face`).
  MARROW (`www/js/marrow/`) is used by the brawler and the creator.

## Testing
- Static server: `node tools/serve.mjs 8181` from the repo root (run it in the background if
  `curl -s localhost:8181/` fails). The page `http://localhost:8181/_test.html?s=<seed>&only=<gameType>` renders one game card.
  The full app is `http://localhost:8181/index.html`.
- Screenshots: `node /tmp/claude-0/-home-user-Xxx-th3-f33d-xxX/ff675552-0095-5b16-9e26-b27f50426709/scratchpad/tools/shots.mjs <outdir> <gameType> <seeds> <times-ms> ["probe expr using g"]`
  writes `<outdir>/<type>-<seed>-<t>.png` and prints the HUD, the probe value and page/console errors. Contact sheet:
  `python3 /tmp/claude-0/-home-user-Xxx-th3-f33d-xxX/ff675552-0095-5b16-9e26-b27f50426709/scratchpad/tools/grid.py out.png a.png b.png …`.
  Use your own outdir under `/tmp/claude-0/-home-user-Xxx-th3-f33d-xxX/ff675552-0095-5b16-9e26-b27f50426709/scratchpad/<package>/`.
  Look at the screenshots — at several times and seeds — before you report. `node --check` every file you edit.
- A new game type that is not registered yet can be tested by temporarily importing it in a scratch HTML page of your
  own under `www/_<name>.html` (files matching `www/_*.html` are git-ignored); the lead registers it in `games/all.js`.
