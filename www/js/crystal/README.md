# Crystal Sprite Engine — game integration guide

`crystal-sprite-engine.js` generates FF5-style characters: 21 animations × 8 directions, in fantasy, present-day and sci-fi wardrobes. It has no dependencies and runs in the browser, in a Web Worker, or in Node. It exposes one global, `FF5Sprites`, or a CommonJS export.

The engine gives you two things:

1. **Pixels:** `generate()` bakes a sprite sheet for one character.
2. **Behaviour:** `createAnimator()` turns your game's movement and actions into *which frame to draw*, plus gameplay events.

Use both. A game that only plays idle and walk is using about a tenth of each character.

---

## 1. Bake a character

```js
const S = FF5Sprites;
const sheet = S.generate({ job: 'Netrunner', hairColor: 'Rose' }, { seed: 7 });
// sheet.width, sheet.height, sheet.data (RGBA Uint8ClampedArray), sheet.meta

// Browser: turn it into an image once, at load.
const cv = document.createElement('canvas');
cv.width = sheet.width; cv.height = sheet.height;
cv.getContext('2d').putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0);
```

- A full character takes about 0.3 s. Bake while loading or in a Worker, never per frame.
- To bake fewer animations: `S.generate(char, { anims: ['idle', 'run', 'attack'], dirs: ['W', 'E'] })`. Rows only exist for the animations and directions you asked for.
- Save `{ character, seed }`, not pixels. The same input always produces the same sprite.
- `S.frame(dir, anim, k)` returns a single 40×40 RGBA frame for the current character, if you'd rather not use a sheet.

**Sheet layout.** Frames are 40×40, and the feet sit at (20, 37). Rows run animation × direction; columns are frames. `sheet.meta.animations[anim].rows[dir]` gives the row.

## 2. Draw a frame

```js
const r = S.sheetRect(sheet.meta, anim, dir, frame);
ctx.drawImage(cv, r.sx, r.sy, r.w, r.h, x - r.anchor.x, y - r.anchor.y, r.w, r.h);
```

Here `(x, y)` is the entity's **feet** in world pixels. Draw at integer positions with `imageSmoothingEnabled = false`. Sort by `y` in top-down games.

## 3. Drive it with the animator

```js
const anim = S.createAnimator({ mode: 'eight', walkSpeed: 4, runSpeed: 50 });

function tick(dt) {
  // your physics first
  const s = anim.update(dt, {
    vx, vy,                 // world units per second (screen space: +y is down)
    grounded,               // false while airborne
    airVy,                  // vertical speed while airborne (negative = rising)
    lowHealth: hp < maxHp * 0.25
  });
  for (const e of s.events) handleEvent(e, s);
  draw(s.anim, s.dir, s.frame);
}
```

**Modes**

| Mode | Directions | Use for |
| --- | --- | --- |
| `'eight'` | all 8 | top-down action RPG |
| `'four'` | S, W, N, E | grid RPG |
| `'side'` | W, E | platformer |

**Verbs.** Call these from game logic; they return `false` when a higher-priority animation is playing.

| Call | What it does |
| --- | --- |
| `anim.jump()` | Plays the crouch, then emits `takeoff`. Apply the jump impulse on `takeoff`, not on the button press. |
| `anim.attack()` | Melee swing. Open the hitbox on `hit`. |
| `anim.shoot()` | Ranged attack. Spawn the projectile on `fire`. Guns get a muzzle flash. |
| `anim.cast()` / `anim.stopCast()` | Channelled spell. Release on `cast`, or on `stopCast()`. |
| `anim.hurt()` | Flinch. Use for damage that doesn't kill. |
| `anim.ko()` / `anim.revive()` | Knockdown, which ends prone and holds until revived. Check `anim.isKO`. |
| `anim.emote('wave', 2)` | Plays a physical emote for N seconds. |
| `anim.face('SW')` | Sets facing directly, for cutscenes, turn-based battle and dialogue. |

**Priority.** Higher interrupts lower:

> locomotion 0 < land 1 < emote 2 < attack / shoot / cast 3 < flinch 4 < knockdown 5

**Locks.** `lock: true` animations (attack, flinch, knockdown) mean "don't steer during this". Read `S.animations[anim.action]?.lock` to freeze input. Shoot does not lock, so strafing works.

**Events**

| Event | Fired | Do this |
| --- | --- | --- |
| `footstep` | walk/run frames 0 and 3 | step sound, dust puff, noise radius for stealth AI |
| `crouch` / `takeoff` | jump anticipation | jump sound / apply impulse |
| `land` | first Land frame | thud sound, dust ring, fall damage, camera shake |
| `swing` / `hit` | attack frames 1 / 2 | whoosh sound / enable melee hitbox for this frame |
| `fire` | shoot frame 1 | spawn projectile at the weapon tip, recoil |
| `cast` | cast frame 2 | release the spell |
| `hurt` | flinch / knockdown frame 0 | hit flash, invulnerability window, knockback |
| `thud` | knockdown frame 4 (hits the ground) | body-fall sound, drop loot, start the game-over timer |
| `done:<anim>` | a one-shot finished | chain combos, return AI to its previous state |

Walk and run frames advance by **distance**, so feet don't slide. If they do slide at your scale, tune `walkStride` and `runStride`; they are world units per frame, defaulting to 5 and 6.5.

---

## 4. Use the full range — checklist per game type

**Platformer** (`mode: 'side'`)
- [ ] `idle` / `walk` / `run`: walk for slow or careful movement, run otherwise.
- [ ] `jump`: frames 1, 2 and 3 are chosen automatically from `airVy`. Call `jump()` for the crouch.
- [ ] `land` on every touch-down, including walking off a ledge (`grounded` going false, then true).
- [ ] `attack` for melee and `shoot` for ranged, chosen by the equipped weapon.
- [ ] `flinch` on damage, with knockback opposite `anim.dir`.
- [ ] `knockdown` on death. Hold the prone frame and fade out, or `revive()` at a checkpoint.
- [ ] `kneel` when `lowHealth` is set, so the player can see danger without a HUD.
- [ ] `cheer` at level end, `surprise` when a boss appears, `sad` on game over.

**Top-down action RPG** (`mode: 'eight'`)
- [ ] All locomotion in 8 directions. Keep the last facing when stopped (the animator does this).
- [ ] `jump()` for hops and dodges; the airborne frames come from your z-velocity as `airVy`.
- [ ] `attack` with a melee hitbox on `hit`; `shoot` and `cast` for ranged builds.
- [ ] `flinch` and `knockdown` for both player and enemies. Prone faces the direction they were facing.
- [ ] NPCs: idle plus emotes on interaction. `wave` to greet, `nod` or `shake` for yes and no, `think` in shops, `angry` before a fight, `love` on gifts, `laugh` on taunts.
- [ ] `kneel` for wounded NPCs and quest-givers.

**Turn-based (FF-style) battle**
- [ ] Party faces `W`, enemies face `E` (or `SW` and `SE` for a ¾ battle line). Set facing with `anim.face()`.
- [ ] Waiting turn: `idle`. Low HP: `kneel`.
- [ ] Acting: step forward with `run`, then `attack`, `shoot` or `cast`; spawn effects on `hit`, `fire` or `cast`.
- [ ] Taking damage: `flinch`. Defeated: `knockdown`, holding prone. Raise or Phoenix Down: `revive()`.
- [ ] Victory: `cheer` for the whole party.

**Dialogue and cutscenes**
- [ ] Map dialogue tags to emotes: `[yes]` nod, `[no]` shake, `[!]` surprise, `[?]` think, `[happy]` laugh, `[sad]` sad, `[mad]` angry, `[love]` love, `[hi]` wave.

---

## 5. Characters

```js
S.jobs                 // presets with an era: 'Fantasy', 'Present day', 'Sci-fi'
S.options              // every valid value for each field
S.randomCharacter(seed, 'Sci-fi')   // random remix of a preset, optionally limited to one era
S.setCharacter({ job: 'Detective', weapon: 'rifle', trimColor: 'Scarlet' }, seed)
```

**Presets**

| Era | Presets |
| --- | --- |
| Fantasy | Freelancer, Knight, Monk, Thief, White Mage, Black Mage, Ranger |
| Present day | Office Worker, Police Officer, Medic, Construction Worker, Detective, Athlete, Punk |
| Sci-fi | Space Marine, Pilot, Android, Netrunner, Scientist, Alien Envoy, Bounty Hunter, Star Knight |
| Base | Mannequin |

**Parts**

| Part | Options |
| --- | --- |
| Headwear | bandana, hood, helm, wizard hat, cap, hard hat, fedora, space helmet, visor |
| Tops | vest, short sleeve, long sleeve, long tunic, robe, open jacket, suit and tie, long coat, armour |
| Weapons | sword, dagger, staff, pistol, rifle, energy saber, wrench |

`trimColor` colours ties, coat linings and hat bands. `weaponColor` colours hilts, staff wood and the saber's beam.

**Weapons and animations:** swing weapons pair with `attack`; `pistol` and `rifle` pair with `shoot`. Any character can play any animation.

## 6. Extending

- **New animation:** add an entry to `ANIMS` (fps, frame count, and a pose per frame; see `pose()` and `REST` for the rig parameters), then add a matching `ANIM_DOC` entry (priority, events, use). It appears in sheets, meta and the animator automatically.
- **New preset:** add it to `JOBS` with an `era`.
- **Rig parameters per pose:**

| Parameter | Effect |
| --- | --- |
| `lean` | upper-body pitch |
| `drop` | upper body down, in pixels |
| `air` | height off the ground |
| `head:[x,y,z]` | head offset |
| `aP` / `aN` | arms: `sw` swing forward, `ab` raise sideways, `el` elbow bend, `eab` forearm raise |
| `lP` / `lN` | legs: `sw` hip swing, `kn` knee bend, `ab` spread |
| `wpn:[x,y,z]` | weapon direction |
| `trail` / `lift` | hair and hem follow-through |
| `eyes:'closed'` | closes the eyes |
| `flash` | muzzle flash |
| `prone` | lies the body on the ground |

All angles are in degrees.
