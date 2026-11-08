// Morning and evening cards made on the phone: body-and-breath reminders with a breathing pacer,
// short gratitude and noticing prompts, greetings, dream guides, dream scenes and imagined worlds.
// Also the quote card for the package's morning and night quotes.
import { el, mulberry32 } from './util.js';

const pick = (R, a) => a[Math.floor(R() * a.length)];
export const MORNING_KINDS = { body: 2.2, affirm: 1.8 };
export const EVENING_KINDS = { guide: 1.2, scene: 1.5, world: 1.4 };
export function mindPost(kind, mode, seed = Math.floor(Math.random() * 2 ** 31)) {
  return { id: `m-${kind}-${seed.toString(36)}`, cat: 'mind', sub: kind, mode, seed };
}
export const MIND_HANDLE = { body: ['body.breath', 'Feel it · breathe into it'], affirm: ['good.morning', 'A small reminder'], hello: ['the.feed', 'Today'], guide: ['dream.guide', 'Tonight’s practice'], scene: ['dream.scene', 'Rehearse this dream'], world: ['other.worlds', 'A world to dream of'] };

// ------------------------------------------------ body and breath
// [key, line, [points on the figure], radius]
const BODY = [
  ['jaw', 'Your jaw. Let your teeth part a little.', [[180, 66]], 16],
  ['shoulders', 'Your shoulders. Let them drop as you breathe out.', [[140, 100], [220, 100]], 18],
  ['hands', 'Your hands. Feel the air on your palms.', [[112, 198], [248, 198]], 15],
  ['feet', 'Your feet. Notice the ground holding you up.', [[158, 284], [202, 284]], 15],
  ['belly', 'Your belly. Let it soften and rise as you breathe in.', [[180, 156]], 24],
  ['heart', 'Your heart. It kept time all night without being asked.', [[168, 122]], 16],
  ['lungs', 'Your lungs. Fill them slowly, from the bottom up.', [[160, 124], [200, 124]], 19],
  ['eyes', 'Your eyes. Let them rest on something far away.', [[171, 47], [189, 47]], 9],
  ['forehead', 'Your forehead. Smooth it, as if someone brushed it with a thumb.', [[180, 35]], 15],
  ['tongue', 'Your tongue. Let it rest on the floor of your mouth.', [[180, 62]], 10],
  ['throat', 'Your throat. Swallow once and feel it open.', [[180, 86]], 12],
  ['spine', 'Your spine. Grow a little taller, like a stem toward light.', [[180, 110], [180, 140], [180, 170]], 12],
  ['hips', 'Your hips. Let your weight settle into them.', [[180, 188]], 24],
  ['knees', 'Your knees. Unlock them, just slightly.', [[163, 236], [197, 236]], 12],
  ['fingers', 'Your fingers. Spread them wide, then let them curl.', [[110, 212], [250, 212]], 12],
  ['scalp', 'Your scalp. Feel where your hair begins.', [[180, 28]], 18],
  ['ears', 'Your ears. Find the farthest sound you can hear.', [[155, 50], [205, 50]], 9],
  ['face', 'Your face. Let it be still for three breaths.', [[180, 52]], 22],
  ['chest', 'Your chest. Let it widen on the in-breath.', [[180, 122]], 24],
  ['arms', 'Your arms. Let them hang heavy.', [[124, 150], [236, 150]], 14],
  ['toes', 'Your toes. Wiggle them, then let them rest.', [[154, 292], [206, 292]], 10],
  ['back', 'Your lower back. Breathe into it as if it had lungs.', [[180, 172]], 22],
  ['calves', 'Your calves. Let them be soft.', [[162, 260], [198, 260]], 12],
  ['neck', 'The back of your neck. Let your head float.', [[180, 82]], 13]
];
const BREATH = [['breathe in', 4], ['hold', 2], ['breathe out', 6]];
const CYCLE = BREATH.reduce((s, [, t]) => s + t, 0);

function drawFigure(c, w, h) {
  const k = h / 300;
  c.save(); c.translate(w / 2 - 180 * k, 0); c.scale(k, k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.fillStyle = 'rgba(255,255,255,.28)';
  // limbs as soft thick strokes
  c.lineWidth = 15;
  for (const [x0, y0, x1, y1, x2, y2] of [[136, 104, 122, 150, 112, 198], [224, 104, 238, 150, 248, 198]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke(); }
  c.lineWidth = 20;
  for (const [x0, x1] of [[166, 158], [194, 202]]) { c.beginPath(); c.moveTo(x0, 192); c.quadraticCurveTo(x0 - 3, 240, x1, 284); c.stroke(); }
  // torso
  c.beginPath(); c.moveTo(134, 98); c.quadraticCurveTo(180, 90, 226, 98); c.quadraticCurveTo(214, 140, 210, 172); c.quadraticCurveTo(216, 190, 212, 200);
  c.lineTo(148, 200); c.quadraticCurveTo(144, 190, 150, 172); c.quadraticCurveTo(146, 140, 134, 98); c.closePath(); c.fill(); c.lineWidth = 2; c.stroke();
  // neck and head
  c.fillRect(172, 70, 16, 24);
  c.beginPath(); c.ellipse(180, 48, 23, 27, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

function bodyView(p) {
  const R = mulberry32(p.seed), [key, line, pts, rad] = pick(R, BODY), hue = Math.floor(R() * 360);
  const cv = el('canvas.mind-canvas'), phase = el('span.pace', 'breathe in · 4');
  const box = el('div.mind.bodycard', { style: { '--h': hue } }, el('div.media-in', cv),
    el('div.mind-text', el('div.kicker', 'Body · breath'), el('p.line', line), el('div.pacer', phase, el('small', ' · in 4 · hold 2 · out 6'))));
  let raf = 0, t0 = 0;
  const frame = (now) => {
    const t = ((now - t0) / 1000) % CYCLE;
    let acc = 0, ph = 0, f = 0;
    for (const [i, [, d]] of BREATH.entries()) { if (t < acc + d) { ph = i; f = (t - acc) / d; break; } acc += d; }
    const [name, dur] = BREATH[ph], left = Math.ceil(dur - f * dur);
    const s = ph === 0 ? 0.25 + 0.75 * Math.sin((f * Math.PI) / 2) : ph === 1 ? 1 : 0.25 + 0.75 * Math.cos((f * Math.PI) / 2);
    const txt = `${name} · ${left}`;
    if (phase.textContent !== txt) phase.textContent = txt;
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = Math.round(w * 0.78);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${hue},38%,82%)`); g.addColorStop(1, `hsl(${(hue + 50) % 360},32%,76%)`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // breathing ring behind the figure
    const k = h / 300, cx = w / 2;
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, h * 0.52, (60 + 70 * s) * k, 0, Math.PI * 2); c.stroke();
    drawFigure(c, w, h);
    // the part glows and swells with the breath
    for (const [x, y] of pts) {
      const X = cx + (x - 180) * k, Y = y * k, r = rad * k * (1.2 + 1.4 * s);
      const rg = c.createRadialGradient(X, Y, 0, X, Y, r);
      rg.addColorStop(0, `hsla(${(hue + 180) % 360},90%,70%,${0.55 + 0.35 * s})`); rg.addColorStop(1, `hsla(${(hue + 180) % 360},90%,70%,0)`);
      c.fillStyle = rg; c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  return { body: box, label: key, activate: () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); } }, deactivate: () => { cancelAnimationFrame(raf); raf = 0; } };
}

// ------------------------------------------------ morning prompts (short, plain, not preachy)
const AFFIRM = {
  Notice: ['Find three colours in the room you hadn’t noticed.', 'Listen for the quietest sound you can hear.', 'Feel the temperature of the air on your skin.', 'Notice where your body touches something solid.', 'Look out of a window for one whole minute.', 'Smell something on purpose today: coffee, soap, rain.', 'Notice your next sip of water all the way down.', 'Watch one breath leave you.', 'Find something alive within arm’s reach.', 'Notice the light. Where is it coming from?'],
  Gratitude: ['Name one person you’re glad exists.', 'Think of a meal that made you happy.', 'Remember a stranger who was kind to you once.', 'Something you own was made by many hands. Pick one thing.', 'Think of a place you love. You can go there later.', 'Name one thing your body did for you yesterday.', 'Recall a song that always lifts you.', 'Someone taught you to read. Thank them, quietly.', 'One small thing went right yesterday. What was it?', 'Think of an animal that made you smile.'],
  Today: ['One kind thing today. Small counts.', 'Do one thing slowly, on purpose.', 'Drink a glass of water before anything else.', 'Step outside for two minutes.', 'Leave one thing better than you found it.', 'Ask someone a question and really listen.', 'Learn one new word today.', 'Stretch toward the ceiling, then the floor.', 'Let one thing be good enough.', 'Make something, even something tiny.'],
  'Did you know': ['Your brain rewires a little every time you learn something. Practice is literally physical.', 'You make millions of new cells every second.', 'The light reaching your eyes left the sun about eight minutes ago.', 'Your lungs’ inner surface is roughly the size of a tennis court.', 'Your heart beats about 100,000 times a day.', 'The lining of your gut renews itself every few days.', 'Your bones are living tissue, rebuilt continuously over your life.', 'Slow breathing out tells your vagus nerve to calm your heart.', 'Your body is home to trillions of microbes, most of them helpful.', 'A good stretch sends fresh blood to tired muscles.'],
  Breathe: ['Breathe in for four. Out for six. Again.', 'Let your next out-breath be a sigh.', 'Breathe in through your nose, as if smelling a flower.', 'Three slow breaths before you check anything.', 'Breathe into your back, between your shoulder blades.'],
  'You get to': ['You get to begin again, every morning.', 'You don’t have to earn rest.', 'Nobody has lived today before. You get to.', 'You are allowed to go slowly.', 'You are made of old starlight and new breakfast.']
};
function affirmView(p) {
  const R = mulberry32(p.seed), kind = pick(R, Object.keys(AFFIRM)), line = pick(R, AFFIRM[kind]), hue = Math.floor(R() * 360);
  return { body: el('div.mind.affirm', { style: { '--h': hue } }, el('div.kicker', kind), el('p.line', line)), label: line };
}

// ------------------------------------------------ greetings
export function greetingPost(mode) { return { id: `m-hello-${mode}-${new Date().toDateString()}`, cat: 'mind', sub: 'hello', mode, seed: Date.now() % 1e9 }; }
function helloView(p) {
  const d = new Date(), day = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const M = p.mode === 'evening'
    ? ['Good evening', 'The day is done. Warm light is on. Tonight’s feed is poems, night thoughts, other worlds and a guide for dreaming.', 'Before sleep, decide one place you would like to dream of.']
    : ['Good morning', 'Start slowly: one breath, one sip of water, one thing you are glad about.', 'Your garden grew a little while you slept.'];
  return { body: el(`div.mind.hello.${p.mode}`, el('div.kicker', day), el('h2', M[0]), el('p.line', M[1]), el('p.small', M[2])), label: M[0] };
}

// ------------------------------------------------ dream guides (text only)
const TECH = [
  ['Reality check: your hands', 'Several times tonight and tomorrow, look at your hands and ask, “Am I dreaming?” In dreams fingers blur, bend or multiply.'],
  ['Reality check: breathe through a pinched nose', 'Pinch your nose shut and try to breathe through it. If air still flows, you are dreaming.'],
  ['Reality check: read it twice', 'Read a line of text, look away, read it again. Dream text rarely stays the same.'],
  ['MILD', 'As you fall asleep, replay a recent dream, imagine noticing something odd in it, and repeat: “Next time I’m dreaming, I’ll remember I’m dreaming.”'],
  ['Wake back to bed', 'Set a gentle alarm about five hours after you fall asleep. Stay up quietly for 15–20 minutes, then go back to sleep holding your intention.'],
  ['SSILD', 'Lying down, cycle your attention through sight (the dark behind your eyelids), hearing, then body sensations: a few seconds each, four quick rounds, then slow rounds until you drift.'],
  ['Dream journal', 'Keep something to write with in reach. On waking, stay still and recall the dream backwards from the last scene before you move.'],
  ['Reality check: light switch', 'Flip a light switch and watch closely. In dreams lights often refuse to change, or change slowly.'],
  ['Reality check: clocks', 'Look at a clock, look away, look back. Dream clocks drift, melt or show impossible times.'],
  ['Hypnagogic drift', 'As you fall asleep, watch the shapes and colours behind your eyelids without chasing them. Let them become a scene and step inside.']
];
const SIGNS = ['doors that open onto water', 'a clock with too many hands', 'your childhood home', 'being late for something that no longer exists', 'animals that speak', 'stairs that keep going', 'a phone that won’t dial', 'flying, or nearly flying', 'an old friend you haven’t seen in years', 'the sea where the sea shouldn’t be', 'a room you didn’t know your house had', 'teeth, keys or shoes going missing', 'writing that changes as you read it', 'trains, stations and tickets', 'weather happening indoors'];
const STABLE = ['Rub your hands together and feel the warmth.', 'Spin slowly on the spot until the scene settles.', 'Touch the ground or a wall and notice its texture.', 'Say out loud: “Clarity now.”', 'Look at one small detail until it sharpens.'];
const QUEST = ['ask the dream to show you something you need to see', 'fly toward the brightest point in the sky', 'find a door and open it slowly, expecting something wonderful', 'ask a dream character what they represent', 'go to the sea and breathe underwater', 'find a library and open a book at random', 'visit the garden and plant something impossible', 'look for the moon and ask it a question', 'find someone you love and thank them', 'turn around and let the whole scene change'];
function guideView(p) {
  const R = mulberry32(p.seed), [tech, how] = pick(R, TECH);
  const sec = (h, ...t) => el('div.g-sec', el('h4', h), ...t);
  return {
    body: el('div.mind.guide', el('div.kicker', 'Tonight’s dream guide'), el('h3', tech),
      sec('Practice', el('p', how)),
      sec('Watch for this dream sign', el('p', `${pick(R, SIGNS).replace(/^./, (c) => c.toUpperCase())}. When it appears, ask: am I dreaming?`)),
      sec('Intention', el('p.intent', '“Tonight, when I’m dreaming, I will know I’m dreaming.”')),
      sec('If you become lucid', el('p', `${pick(R, STABLE)} Then ${pick(R, QUEST)}.`))),
    label: tech
  };
}

// ------------------------------------------------ dream scenes
const PLACES = ['an orchard under a green moon', 'a night train that runs along the floor of a warm sea', 'a library whose windows open onto other centuries', 'a city of paper lanterns floating over a lake', 'a staircase that spirals down into clouds', 'an observatory on the back of a sleeping whale', 'your childhood street, but the houses are hollow and full of stars', 'a greenhouse the size of a cathedral', 'a market where people trade memories in glass jars', 'a desert of white sand that hums when you walk', 'a forest where the trees ring softly like bells', 'a house with one more room than you remember', 'a lighthouse whose beam is made of music', 'a bridge made of birds holding hands', 'a quiet planet where two suns are setting', 'a hotel corridor that curves back to where it began', 'an underground river lit by glowing fish', 'a field of snow that is warm to the touch', 'a tea house on a cliff above an ocean of mist', 'a museum of every thing you ever lost', 'a garden at the top of a very tall tree', 'a moonlit beach where the waves come in slowly, like breathing'];
const GUIDE = ['an old woman with moth-wing eyebrows', 'a fox carrying a lantern', 'a version of you, ten years older', 'a child who speaks only in questions', 'a tall, gentle figure made of rain', 'a cat that knows your name', 'a librarian with no face and a kind voice', 'a deer whose antlers are full of sleeping birds', 'a lighthouse keeper who has been expecting you', 'a small robot tending moss', 'a musician playing an instrument you’ve never seen', 'a heron that walks beside you like a friend'];
const OFFER = ['hands you a key that is still warm', 'points to a door you hadn’t noticed', 'asks what you came here to remember', 'offers you a cup that tastes like your favourite season', 'shows you how to breathe underwater', 'teaches you to step off the ground and stay there', 'gives you a map that redraws itself as you walk', 'leans close and whispers that you are dreaming, and smiles', 'shows you a window onto the night you were born', 'walks with you without saying anything, and it is enough'];
const THEN = ['Follow.', 'Look at your hands. Ask: am I dreaming?', 'Notice what the air smells like.', 'Ask the dream to show you something you need.', 'Rise slowly toward the brightest point in the sky.', 'Turn around and let the scene change.', 'Thank them, and step through.'];
function sceneView(p) {
  const R = mulberry32(p.seed), place = pick(R, PLACES), who = pick(R, GUIDE), what = pick(R, OFFER), then = pick(R, THEN), hue = Math.floor(R() * 360);
  return { body: el('div.mind.scene', { style: { '--h': hue } }, el('div.kicker', 'Dream scene'), el('p.line', `You are in ${place}. ${who.replace(/^./, (c) => c.toUpperCase())} ${what}.`), el('p.then', then)), label: `A dream of ${place}` };
}

// ------------------------------------------------ imagined worlds (a painted postcard and a short entry)
const SYL = ['ka', 'lo', 'ri', 'tha', 'mei', 'su', 'vor', 'el', 'an', 'quo', 'zi', 'ny', 'ore', 'lu', 'sa', 'mir', 'tal', 've', 'ash', 'oon'];
const STAR = ['a red dwarf', 'twin suns, one gold and one blue', 'a white dwarf no bigger than a moon', 'a calm orange star', 'a pulsar that ticks like a clock', 'a young blue star wrapped in dust'];
const SKY = ['violet all day long', 'green at the horizon and black overhead', 'crossed by the ring of a broken moon', 'full of slowly drifting islands', 'stuck forever at twilight', 'busy with three moons'];
const LAND = [['spires', 'forests of mushroom spires'], ['crystal', 'canyons of singing crystal'], ['sea', 'one endless shallow ocean'], ['mesas', 'red mesas and long shadows'], ['domes', 'cities grown like coral'], ['dunes', 'dunes of glass that chime in the wind']];
const PEOPLE = ['gentle beings who speak in colours', 'whale-sized drifters who sing to the tides', 'a single mind spread through the moss', 'people who sleep for a year and wake for a day', 'librarians of a vanished species', 'robots who garden the ruins of their makers', 'travellers who never stay longer than one night', 'children who are older than the mountains'];
const CUSTOM = ['every child plants a tree that will outlive them', 'nobody says goodbye; they say “see you in the dream”', 'the longest night is a holiday', 'songs are used instead of maps', 'time is counted in eclipses', 'guests are given a new name at the door', 'silence is the most polite thing you can offer'];
function worldName(R) { const n = 2 + Math.floor(R() * 2); let s = ''; for (let i = 0; i < n; i++) s += pick(R, SYL); return s[0].toUpperCase() + s.slice(1); }
function paintWorld(cv, R, land) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = Math.round(w * 0.62);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hue = Math.floor(R() * 360), g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${hue},45%,10%)`); g.addColorStop(0.65, `hsl(${(hue + 40) % 360},55%,32%)`); g.addColorStop(1, `hsl(${(hue + 70) % 360},60%,58%)`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { c.globalAlpha = R() * 0.8; c.fillStyle = '#fff'; c.fillRect(R() * w, R() * h * 0.6, 1.2, 1.2); }
  c.globalAlpha = 1;
  // a big planet or moons
  const px = w * (0.2 + R() * 0.6), py = h * (0.15 + R() * 0.25), pr = h * (0.12 + R() * 0.22);
  const pg = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  pg.addColorStop(0, `hsl(${(hue + 200) % 360},60%,80%)`); pg.addColorStop(1, `hsl(${(hue + 230) % 360},50%,35%)`);
  c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
  if (R() < 0.55) { c.strokeStyle = `hsla(${(hue + 160) % 360},70%,85%,.6)`; c.lineWidth = 3; c.beginPath(); c.ellipse(px, py, pr * 1.8, pr * 0.45, -0.3, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < Math.floor(R() * 3); i++) { c.fillStyle = `hsla(${(hue + 120 * i) % 360},40%,85%,.9)`; c.beginPath(); c.arc(R() * w, R() * h * 0.4, 4 + R() * 9, 0, Math.PI * 2); c.fill(); }
  // three layers of land, nearer ones darker
  for (let L = 0; L < 3; L++) {
    const base = h * (0.62 + L * 0.13), col = `hsl(${(hue + 260 + L * 10) % 360},${35 - L * 8}%,${30 - L * 9}%)`;
    c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const n = Math.sin(x * 0.02 + L * 3 + R() * 0.04) * 8 + Math.sin(x * 0.007 + L) * 14;
      let y = base + n;
      if (land === 'mesas') y = base + (Math.sin(x * 0.012 + L * 2) > 0.3 ? -26 + L * 4 : 8);
      if (land === 'dunes' || land === 'sea') y = base + Math.sin(x * 0.03 + L) * 5;
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.closePath(); c.fill();
    if (land === 'spires' || land === 'crystal' || land === 'domes') {
      const n = 4 + Math.floor(R() * 6);
      for (let i = 0; i < n; i++) {
        const x = R() * w, s = (14 + R() * 30) * (1 + L * 0.5);
        if (land === 'spires') { c.fillRect(x - 2, base - s, 4, s); c.beginPath(); c.ellipse(x, base - s, s * 0.45, s * 0.2, 0, Math.PI, 0); c.fill(); }
        else if (land === 'crystal') { c.beginPath(); c.moveTo(x - s * 0.2, base + 4); c.lineTo(x, base - s); c.lineTo(x + s * 0.2, base + 4); c.fill(); }
        else { c.beginPath(); c.arc(x, base, s * 0.5, Math.PI, 0); c.fill(); }
      }
    }
  }
  if (land === 'sea') { c.fillStyle = 'rgba(255,255,255,.25)'; for (let y = h * 0.8; y < h; y += 5) c.fillRect(px - pr * 0.6 + Math.sin(y) * 6, y, pr * 1.2, 1); }
}
function worldView(p) {
  const R = mulberry32(p.seed), name = worldName(R), [land, landText] = pick(R, LAND);
  const cv = el('canvas.mind-canvas.world-canvas');
  const box = el('div.mind.world', el('div.media-in', cv), el('div.mind-text', el('div.kicker', 'Other worlds'), el('h3', name),
    el('p', `A world around ${pick(R, STAR)}. The sky is ${pick(R, SKY)}, over ${landText}.`),
    el('p', `It is home to ${pick(R, PEOPLE)}. Here ${pick(R, CUSTOM)}.`),
    el('p.then', `Tonight, imagine arriving on ${name} as you fall asleep.`)));
  let painted = false;
  return { body: box, label: name, activate: () => { if (!painted) { painted = true; paintWorld(cv, mulberry32(p.seed ^ 0x9e3779b9), land); } } };
}

// ------------------------------------------------ the card body for a mind post
const VIEWS = { body: bodyView, affirm: affirmView, hello: helloView, guide: guideView, scene: sceneView, world: worldView };
export function mindView(p) { return (VIEWS[p.sub] || affirmView)(p); }

// quotes from the package (Wikiquote)
export function quoteView(p) {
  return el(`div.mind.quote.${p.mode || 'morning'}`, el('div.kicker', p.mode === 'evening' ? 'Night thought' : 'Morning'),
    el('blockquote', `“${p.text.replace(/^["“]|["”]$/g, '')}”`), el('div.by', `— ${p.author}`));
}
