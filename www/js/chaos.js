// Chaos magic oracles: a sigil maker (type an intent; vowels and repeated letters come out, the rest is drawn as a line
// on a rose, a grid or a circle, then charged by holding it), a paradigm shift (a belief, god or persona to wear for the
// day, with a rite) and a random ritual (a generated gnosis or banishing exercise). Used by oracle.js.
import { el, mulberry32, hashStr, toast } from './util.js';
import { LENS, qKind } from './oracle-data.js';

const W = 360, H = 300, AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CHAOS = ['sigil', 'paradigm', 'ritual'];
export const CTA = { sigil: ['Draw sigil', 'Draw again'], paradigm: ['Shift my paradigm', 'Shift again'], ritual: ['Give me a rite', 'Another rite'] };
const METHODS = ['rose', 'grid', 'circle'];
const NOTE = {
  rose: 'the letters sit on three rings of petals (5, 8 and 13), like the layout of a rose, and the line runs from petal to petal',
  grid: 'the alphabet fills a five-by-five square (I and J share a cell) and the line wanders from cell to cell',
  circle: 'the alphabet runs around a ring and the line leaps from letter to letter'
};
const INTENTS = ['I find what I lost', 'My next message lands softly', 'I sleep deeply and wake rested', 'The meeting goes well', 'I finish what I start', 'Luck finds me in small ways', 'I speak calmly when it matters',
  'I notice the good opportunity', 'Money arrives from an unexpected direction', 'I am brave on the phone call', 'The week goes lightly', 'I hear what I need to hear', 'Old worries lose their grip', 'I make something strange and good',
  'The right person answers', 'My plans survive contact with reality', 'I forgive myself quickly', 'The road opens', 'I am easy to love and hard to rattle', 'Tomorrow is kinder than today'];
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];

// ---------------------------------------------------------------- the techniques
const GNOSIS = [
  ['Death posture', 'in', 'Lie flat on your back, arms crossed over your chest, and stay as still as a carving. Let your breath go shallow and your thoughts thin out until the intent is the only thing left in the room.'],
  ['Sigil staring', 'in', 'Hold the sigil (or the intent, written large) at arm’s length and stare at it with soft, unfocused eyes until its edges swim and your inner chatter goes quiet. Blink when you need to; never strain.'],
  ['Candle gaze', 'in', 'Sit in a dim room with a candle or a lamp in front of you and gaze at the brightest point without moving. When your mind wanders, bring it back to the flame; when your eyes sting, close them and watch the afterimage.'],
  ['Empty lungs', 'in', 'Breathe out slowly and completely, hold the empty feeling for as long as is comfortable, then breathe in. Repeat. Never push to dizziness; the point is the strange hush, not a struggle.'],
  ['Backwards count', 'in', 'Count backwards from 111 in sevens, aloud, and start again from the top whenever you slip. The effort of counting crowds out ordinary thought, and the intent slips in underneath.'],
  ['Dark room', 'in', 'Sit in the dark with your eyes covered and your ears plugged, or as near to it as you can get, and let the hush stretch. Hold your single sentence of intent like a coin in a closed fist.'],
  ['Mantra melt', 'in', 'Repeat the mantra aloud until it stops being a word and becomes only a sound, then keep going until the sound stops being yours.'],
  ['Slow walk', 'in', 'Walk very slowly in a small circle, one syllable of the mantra to each step, and feel every part of the foot arrive. Do not hurry the circle.'],
  ['Wild shaking', 'ex', 'Put on something loud and shake every limb at random, head to heels, until your breath is ragged and your mind is simply tired of arguing.'],
  ['Slow spin', 'ex', 'Standing in a clear space, turn slowly on the spot with your arms out and your eyes soft, chanting the mantra, until you are pleasantly dizzy. Sit down before you fall.'],
  ['Accelerating clap', 'ex', 'Clap a slow beat and speed it up, chanting the mantra on every clap, faster and faster until it breaks into a roar or a laugh.'],
  ['Forced laughter', 'ex', 'Start laughing on purpose, fake and loud, and keep going until it becomes real. Laughter is gnosis with the lid off; the wish rides out on the last wave of it.'],
  ['Cold shock', 'ex', 'Splash cold water on your face and wrists, then stand dripping and shout the mantra once with everything you have. The shock is the doorway.'],
  ['Hypnagogic nap', 'in', 'Lie down holding a key or a spoon over a tin tray, with the intent in mind. As you drift, the dropped key wakes you at the edge of sleep, the moment when the mind is most open.'],
  ['Stomp and chant', 'ex', 'March on the spot, knees high, chanting the mantra in time with your feet. Quicken until you are out of breath, then stop dead and hold the silence.']
];
const BANISH = [
  ['Pentagram sweep', 'Face east, and with two fingers trace a bright pentagram in the air in front of you while saying the mantra. Turn a quarter and repeat to the south, west and north, then to the centre.'],
  ['Laughter banishing', 'Name the thing you want gone, then laugh at it, loudly and at length, until it looks small and a little silly. Whatever cannot survive being laughed at was not holding much.'],
  ['Salt door', 'Put a pinch of salt on your palm, scatter it across the doorstep or windowsill and say, “Not through here.” Wash your hands.'],
  ['Cold water', 'Run cold water over your wrists, flick the drops towards the floor and say the mantra as they fall. Dry your hands on something clean.'],
  ['Widdershins walk', 'Walk three times round the room against the sun, unwinding as you go, and say what you are releasing at each corner. Stop facing the door.'],
  ['Corner clap', 'Clap sharply in each corner of the room, one after another, to break up stale air, and say “clear” after each clap.'],
  ['Open window', 'Open a window, say the unwanted thing aloud into the open air, and breathe out until you have nothing left to say. Close the window gently.'],
  ['Paper dump', 'Write everything crowding your head onto paper without stopping for a minute, tear it into pieces and bin them. Wash your hands after.'],
  ['Bell tone', 'Strike a glass, a bell or a pan and listen to the sound until it has gone completely. The silence afterwards is the clean room.'],
  ['Four bows', 'Bow to each of the four directions in turn, saying thank you and goodbye to whatever came with you, then stand straight and say the mantra once.']
];
const ADJ = ['Spinning', 'Silent', 'Salted', 'Backwards', 'Hollow', 'Laughing', 'Iron', 'Paper', 'Midnight', 'Borrowed', 'Humming', 'Cold', 'Glass', 'Lopsided'];
const NOUN = ['Vigil', 'Door', 'Knot', 'Mirror', 'Drum', 'Broom', 'Threshold', 'Lantern', 'Key', 'Bell', 'Spiral', 'Ladder'];
const SYL = ['za', 'ra', 'ko', 'mi', 'thu', 'bel', 'ok', 'na', 'ex', 'ia', 'phe', 'lor', 'qua', 'dre', 'um', 'ti', 'vo', 'ha', 'el', 'zo'];
const PRINCIPLES = ['Chaos magic treats belief as a tool, not a creed: pick it up, use it, put it down.', '“Nothing is true, everything is permitted” is not a licence; it is an invitation to test things for yourself.', 'Gnosis is only a state in which the chattering mind goes quiet, so that a single intent can slip in underneath it.',
  'Results matter more than doctrine. If it works, it works; if it doesn’t, change it.', 'Ritual is a technology for switching attention. The costume is optional; the switch is the point.', 'Act first, explain later: chaos magicians trust the experiment more than the theory.'];
const FORGET = ['Now forget it. Do something dull for ten minutes, such as the dishes or a long email.', 'Then go and eat something. Forgetting is part of the spell.', 'Hide the paper somewhere you will not look, and think about something else entirely.', 'Fire it, then change the subject. Anyone who asks, you were thinking about toast.'];
const mantra = (rnd) => Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => pick(rnd, SYL)).join('')).join(' ').toUpperCase();
const mins = (s) => (s % 60 ? `${Math.floor(s / 60) ? `${Math.floor(s / 60)} min ` : ''}${s % 60} sec` : `${s / 60} min`);

// ---------------------------------------------------------------- paradigms: [name, kind, essence, wear, rite]
const PARADIGMS = [
  ['Eris', 'goddess', 'The Greek goddess of strife, who threw the golden apple “to the fairest” and watched the party go wrong; patron of Discordians.', 'Stir one small, harmless bit of mischief. Ask the question nobody asked. Treat order as a rumour.', 'Put an apple on a table. Before you eat it, say, “For the most interesting.” Then give half away.'],
  ['Hermes', 'god', 'Messenger, thief, guide of travellers and patron of crossroads, who invented the lyre on his first afternoon of life.', 'Be quick, charming and a little unreliable. Carry a message today, even a small one, and take a different route.', 'Stand at the nearest crossroads or doorway, say the name of where you are going, and take the first step with your left foot.'],
  ['Loki', 'trickster', 'Norse shape-shifter who talks the gods out of every trap he sets for them and into every one they set for him.', 'Change your mind out loud once. Point out the thing everyone is pretending not to notice, kindly if you can.', 'Tie a knot in a piece of string, say what you are tangled in, then undo it with a flourish.'],
  ['Thoth', 'god', 'Egyptian scribe of the gods, keeper of language, measure and the calendar, moon-headed and meticulous.', 'Write everything down. Name things precisely. Correct nothing aloud unless someone asks.', 'Write one true sentence about today on paper and sign it with a title you invent.'],
  ['Baba Yaga', 'witch', 'Slavic witch in a hut on chicken legs: she helps those who are polite and bold, and eats those who are neither.', 'Be blunt, be useful and ask for nothing twice. Judge people by their manners to the weak.', 'Sweep a threshold backwards, saying, “Hut, hut, turn your back to the woods and your face to me.”'],
  ['Janus', 'god', 'Roman god of doorways, beginnings and endings, with two faces that look both ways at once.', 'Finish one thing and begin one thing. Look back before you look forward, and be kind to both views.', 'Stand in a doorway, say one thing you are leaving behind and one you are walking towards, then walk through.'],
  ['Hecate', 'goddess', 'Torch-bearing goddess of crossroads, thresholds and the dark of the moon, who knows the way when the road forks.', 'Walk in the dark, or in twilight if the dark is not safe, with a small light. Trust what you notice at the edge of things.', 'Leave a small offering, such as bread, a coin or a kind word, at a place where paths meet.'],
  ['Dionysus', 'god', 'Greek god of wine, theatre and ecstatic madness, the one who dissolves the self for an evening and puts it back mended.', 'Say yes to joy. Sing badly in public. Wear something you are slightly too shy for.', 'Raise a glass of anything and toast the part of you that you keep hidden at work.'],
  ['Pan', 'god', 'Goat-footed god of the wild and of sudden terror, whose pipes make a field feel alive.', 'Go outside. Notice every sound for five minutes. Let a little panic through, and then a little laughter.', 'Whistle three notes out of a window and wait to see what answers.'],
  ['Inanna', 'goddess', 'Sumerian queen of heaven who went down through seven gates, giving up a garment at each, and came back changed.', 'Give something up at every threshold: a habit, a grudge, an object. Walk through lighter.', 'Take off seven small things (a ring, a scarf, a worry) one by one and put them down, then put on only what you need.'],
  ['Odin', 'god', 'One-eyed Norse wanderer who hung nine nights from a tree to learn the runes and traded an eye for a drink of wisdom.', 'Ask more than you say. Pay a price for knowledge and do not haggle. Wear something that covers one eye of your attention.', 'Hold a stick, name nine things you do not know, and write the first on the stick.'],
  ['The Morrigan', 'goddess', 'Irish battle-goddess of crows and fate, who appears at fords and tells warriors how the day will end.', 'Be fierce but fair. Notice omens. Do not fight today’s battle for yesterday’s reasons.', 'Stand at running water, say what you are ready to face, and wait until you feel the crow of the answer.'],
  ['Maat', 'goddess', 'Egyptian principle of truth, balance and right order, whose feather weighs the heart.', 'Say only what is true, in proportion. Put one thing back in its place before noon.', 'Place a feather or a leaf in one palm and a small worry in the other, and breathe until they feel the same weight.'],
  ['Fortuna', 'goddess', 'Roman goddess of luck, with her wheel and her blindfold, who raises and lowers anyone without explaining.', 'Take one small, harmless gamble and accept whatever comes. Be gracious about both outcomes.', 'Spin a coin on a table and watch it until it falls. Call it before it lands.'],
  ['Nyx', 'goddess', 'Primordial night, so old that Zeus himself kept away from her, who birthed sleep and dreams.', 'Do your thinking after dark. Let things stay unfinished until morning. Be gentle with the tired.', 'Close the curtains an hour early, say “Goodnight” to the day and thank it once.'],
  ['The Stoic', 'belief', 'Roman and Greek practice of dividing life into what is up to you and what is not, and spending your energy only on the first.', 'Sort every worry into “mine” or “not mine”. Do the first, and let the second pass like weather.', 'Each time you are annoyed today, ask, “Is this up to me?” If not, breathe out and say, “So be it.”'],
  ['The Absurdist', 'belief', 'The conviction that the universe offers no meaning and you are free to make cheerful use of that.', 'Do something pointless with total commitment: polish a stone, count the pigeons. Smile at the cosmos.', 'Push a small stone up a small slope, then stop, shrug and say, “One must imagine me happy.”'],
  ['The Animist', 'belief', 'The view that everything has a spirit, from rivers to doorknobs, and manners apply to all of them.', 'Say thank you to objects. Ask the kettle how it is. Apologise to the chair you bumped.', 'Pick one object you use every day and thank it aloud by name.'],
  ['The Dadaist', 'belief', 'Art that insists nonsense is the only honest reply to a world that has already lost its mind.', 'Make something with no purpose. Cut words from a page and rearrange them. Refuse one expectation.', 'Take a page of any text, cut it into words, shuffle them and read the new poem aloud with a straight face.'],
  ['The Cynic', 'belief', 'Diogenes, who lived in a jar, told Alexander to get out of his sunlight, and walked the market with a lamp “looking for an honest man”.', 'Want less than you think you need. Say the obvious thing plainly. Be rude to nobody who has not earned it.', 'Take one item you own and give it away today, saying, “I have no use for this and a great deal for the room.”'],
  ['The Epicurean', 'belief', 'The ancient garden-school which held that the best life is simple pleasures, good friends and freedom from fear.', 'Make one small thing delicious. Spend time with someone you like. Do not chase the grand.', 'Eat a single piece of fruit slowly, paying attention to every part of it.'],
  ['The Detective', 'persona', 'A mind that notices everything and apologises for none of it, certain that the smallest odd detail is the key to the whole case.', 'Look at ordinary things as clues: who left the cup there, why the door is ajar. Ask three questions before drawing a conclusion.', 'Make a list of five details you usually ignore on your route today, and decide what each is evidence of.'],
  ['The Lighthouse Keeper', 'persona', 'Someone patient and solitary whose entire job is to keep one light burning for strangers they will never meet.', 'Be steady, be useful, and be unembarrassed about routine. Keep one small thing running well.', 'Light a lamp at dusk and say, “Let somebody find their way tonight.”'],
  ['The Court Jester', 'persona', 'The only person in the palace permitted to tell the king the truth, provided the truth wears bells.', 'Say the hard thing as a joke. Take yourself lightly and other people seriously.', 'Tell someone a true thing wrapped in a joke, and notice whether they heard the true thing.'],
  ['The Alien Anthropologist', 'persona', 'A visitor studying humans with fascinated, affectionate confusion, taking notes on handshakes and queues.', 'Narrate ordinary customs to yourself as though you had just arrived. Ask “why do they do this?” and answer kindly.', 'Write three field notes about humans you saw today. Include one thing you admire.'],
  ['The Cartographer of Nowhere', 'persona', 'A mapmaker who draws places that have not been visited yet, trusting that the territory will catch up.', 'Sketch a map of anything: your week, your feelings, your street. Leave blank areas and label them “here be possibilities”.', 'Draw a map of tomorrow with three landmarks and one dotted road you have never taken.'],
  ['The Retired God', 'persona', 'A deity on a long sabbatical who has stopped smiting and taken up gardening, and finds mortals delightful.', 'Do not smite. Be generous with attention and stingy with opinions. Water something.', 'Plant, water or tidy a living thing, and bless it by name.'],
  ['The Bureaucrat of Heaven', 'persona', 'A tireless clerk in the celestial offices who knows every form, every stamp and exactly which window is open.', 'Be thorough and polite. Finish the paperwork you have been avoiding. Be gentle with anyone who is lost in a queue.', 'Fill in one form, answer one email or sort one pile, and stamp it “APPROVED” in your head.'],
  ['The Raven', 'persona', 'A clever, scavenging, glossy-black thinker who collects bright things and remembers every face.', 'Collect small shiny details. Remember who was kind. Solve a puzzle sideways.', 'Pick up one small bright thing (a bottle cap, a button) and keep it in a pocket as an omen.'],
  ['The Weather', 'persona', 'You are not a person today but a front moving through: light, shifting and not to be argued with.', 'Change mood without apology. Arrive, rain, pass. Leave things a little cleaner than you found them.', 'Look at the sky, name today’s weather for you, and behave exactly like it until lunchtime.']
];
const KIND = { goddess: 'Goddess', god: 'God', trickster: 'Trickster', witch: 'Witch', belief: 'Belief', persona: 'Persona' };

// ---------------------------------------------------------------- sigils
export function sigilOf(text) {
  const raw = (text || '').toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
  const noV = raw.replace(/[AEIOU\s]/g, '');
  let letters = [...new Set(noV)], kept = false;
  if (letters.length < 2) { letters = [...new Set(raw.replace(/\s/g, ''))]; kept = true; }
  return { raw, noV, letters, kept };
}
// unit-circle position of a letter on each layout
function place(method, ch) {
  const i = AZ.indexOf(ch === 'J' && method === 'grid' ? 'I' : ch);
  if (method === 'circle') { const an = -Math.PI / 2 + i / 26 * Math.PI * 2; return [Math.cos(an), Math.sin(an)]; }
  if (method === 'grid') { const k = ch === 'J' ? 8 : i > 9 ? i - 1 : i; return [((k % 5) - 2) * 0.42, (Math.floor(k / 5) - 2) * 0.42]; }
  const ring = i < 5 ? 0 : i < 13 ? 1 : 2, n = [5, 8, 13][ring], idx = i - [0, 5, 13][ring], an = -Math.PI / 2 + idx / n * Math.PI * 2 + ring * 0.25, r = [0.36, 0.66, 0.96][ring];
  return [Math.cos(an) * r, Math.sin(an) * r];
}

// ---------------------------------------------------------------- casting
// returns { anim, delay, title, lines }; o is the Oracle (o.rnd, o.p, o.question, o.intent(), o.chaos.method)
export function castChaos(sub, o) {
  const rnd = o.rnd, q = o.question || '', kind = qKind(q);
  if (sub === 'sigil') {
    const method = o.chaos.method, intent = (o.intent?.() || '').trim() || pick(rnd, INTENTS), sg = sigilOf(intent), pts = sg.letters.map((ch) => place(method, ch));
    const lines = [`Your intent: “${intent}”.`];
    if (sg.letters.length < 1) return { anim: null, delay: 0, title: 'Nothing to draw', lines: ['Type a few words first: a wish, in the present tense, as if it had already happened.'] };
    lines.push(sg.kept ? `Too few consonants to work with, so the vowels stay: ${sg.letters.join(' ')}.` : `Vowels out: ${sg.noV}. Repeated letters out: ${sg.letters.join(' ')}.`);
    lines.push(`Drawn on the ${method}: ${NOTE[method]}. The small ring is where the wish begins and the short bar is where it closes.`);
    const g = pick(rnd, GNOSIS);
    lines.push(`Charge it. Hold your finger on the sigil, or the button, until the glow is full. Then reach for gnosis: ${g[0].toLowerCase()}. ${g[2]}`);
    lines.push(`Fire it by letting go at the peak of the feeling. ${pick(rnd, FORGET)}`);
    return { anim: { kind: 'sigil', t: 0, method, pts, letters: sg.letters, charge: 0, fired: null }, delay: 0.6 + Math.min(3, 0.4 * sg.letters.length), title: `Sigil · ${sg.letters.join('')}`, lines };
  }
  if (sub === 'paradigm') {
    const P = o.last && PARADIGMS.length > 1 ? PARADIGMS.filter((x) => x[0] !== o.last) : PARADIGMS, x = pick(rnd, P); o.last = x[0];
    const lens = `${LENS[kind]}, ask your question the way ${x[0]} would: “${q}”. The answer you give will be different, and some of the difference is the point.`;
    return {
      anim: { kind: 'paradigm', t: 0, pick: x, seed: hashStr(x[0]), names: Array.from({ length: 12 }, () => pick(rnd, PARADIGMS)) }, delay: 1.7, title: `${x[0]} · ${KIND[x[1]]}`,
      lines: [x[2], `Wear it today: ${x[3]}`, lens, `The rite: ${x[4]}`, `Take it off at midnight and thank it. ${pick(rnd, PRINCIPLES)}`]
    };
  }
  // ritual
  const banish = rnd() < 0.4, g = pick(rnd, GNOSIS), b = pick(rnd, BANISH), b2 = pick(rnd, BANISH.filter((x) => x !== b)), m = mantra(rnd), dur = 60 + 30 * Math.floor(rnd() * 3), title = `${banish ? 'Banishing' : 'Gnosis'}: The ${pick(rnd, ADJ)} ${pick(rnd, NOUN)}`;
  const lines = banish ? [
    `1. Name it. Say what you want cleared in one sentence. Your question, “${q}”, has been crowding the room; set it down for now.`,
    `2. ${b[0]}. ${b[1].replace(/the mantra/g, `the mantra (${m})`)}`,
    `3. Seal. ${b2[0]}: ${b2[1].replace(/the mantra/g, 'the mantra')}`,
    `4. Aftercare. Drink a glass of water and do something ordinary for ten minutes. ${pick(rnd, PRINCIPLES)}`
  ] : [
    `1. Open. ${b[0]}: ${b[1].replace(/the mantra/g, `the mantra (${m})`)}`,
    `2. Aim. Hold the question, “${q}”, in mind as one short sentence you could say aloud, and say it once.`,
    `3. ${g[0]} for ${mins(dur)}, with the mantra ${m}. ${g[2].replace(/the mantra/g, 'the mantra')}`,
    `4. Release. At the peak, or when the time is up, breathe out, drop the question completely and say, “It is done.”`,
    `5. Close. ${b2[0]}: ${b2[1]} Then go and do something dull. ${pick(rnd, PRINCIPLES)} Stop at once if you feel faint or unwell.`
  ];
  return { anim: { kind: 'ritual', t: 0, banish, fast: !banish && g[1] === 'ex', mantra: m, dur, go: null, done: false, title }, delay: 0.8, title, lines };
}

// ---------------------------------------------------------------- drawing
function mandala(c, seed, R, t, p) {
  const r = mulberry32(seed), n = 5 + Math.floor(r() * 5);
  c.save(); c.lineWidth = 1.6;
  for (let ring = 0; ring < 3; ring++) {
    const m = n + ring * (1 + Math.floor(r() * 3)), step = 1 + Math.floor(r() * (m / 2 - 1)), rr = R * (1 - ring * 0.28);
    c.save(); c.rotate((ring % 2 ? -1 : 1) * t * 0.15 + r() * 6); c.strokeStyle = p.c[ring]; c.globalAlpha = 0.9; c.beginPath();
    for (let i = 0; i <= m; i++) { const an = ((i * step) % m) / m * Math.PI * 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    c.stroke(); c.beginPath(); c.arc(0, 0, rr, 0, 7); c.globalAlpha = 0.25; c.stroke(); c.restore();
  }
  c.fillStyle = p.ink; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.restore();
}
function drawParadigm(c, a, o) {
  const p = o.pal, spin = a.t < 1.5, cur = spin ? a.names[Math.floor(a.t * 14) % a.names.length] : a.pick;
  c.save(); c.translate(W / 2, 128); mandala(c, hashStr(cur[0]), 96, a.t, p); c.restore();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = p.ink; c.globalAlpha = spin ? 0.6 : 1;
  c.font = '700 26px Georgia, serif'; c.fillText(cur[0], W / 2, H - 56);
  c.font = '600 11px ui-monospace, monospace'; c.fillStyle = p.c[1]; c.fillText(KIND[cur[1]].toUpperCase(), W / 2, H - 30); c.globalAlpha = 1;
}
function drawRitual(c, a, o) {
  const p = o.pal, t = a.t, cx = W / 2, cy = 128;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (a.banish) {
    const u = Math.min(1, (t % 8) / 5), R = 86, v = [0, 2, 4, 1, 3, 0].map((k) => { const an = -Math.PI / 2 + k / 5 * Math.PI * 2; return [cx + Math.cos(an) * R, cy + Math.sin(an) * R]; });
    c.strokeStyle = p.c[0]; c.lineWidth = 3; c.lineCap = 'round'; c.shadowColor = p.c[0]; c.shadowBlur = 10 + Math.sin(t * 5) * 4;
    c.beginPath(); c.arc(cx, cy, R + 10, 0, 7); c.globalAlpha = 0.35; c.stroke(); c.globalAlpha = 1;
    c.setLineDash([u * R * 5.5, 999]); c.beginPath(); v.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
  } else {
    c.fillStyle = p.c[0];
    for (let i = 0; i < 150; i++) { const r = 4 + i * 0.62, an = i * 0.23 - t * (a.fast ? 3.2 : 0.7); c.globalAlpha = 0.25 + 0.75 * (1 - i / 150); c.fillRect(cx + Math.cos(an) * r - 1.5, cy + Math.sin(an) * r * 0.95 - 1.5, 3, 3); }
    c.globalAlpha = 1;
  }
  c.fillStyle = p.ink; c.font = '700 15px Georgia, serif'; c.fillText(a.title, cx, 22);
  c.font = `700 ${14 + Math.sin(t * 3) * 1.5}px ui-monospace, monospace`; c.fillStyle = p.c[1]; c.fillText(a.mantra, cx, H - 52);
  c.font = '600 12px ui-monospace, monospace'; c.fillStyle = p.ink;
  if (a.go != null) {
    const left = Math.max(0, a.dur - (t - a.go));
    c.strokeStyle = p.c[2]; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, 108, -Math.PI / 2, -Math.PI / 2 + (1 - left / a.dur) * Math.PI * 2); c.stroke();
    c.fillText(left > 0 ? `${Math.ceil(left)}s` : 'IT IS DONE', cx, H - 26);
    if (left <= 0 && !a.done) { a.done = true; toast('It is done.'); }
  } else c.fillText(a.banish ? 'press Begin and follow the steps' : `press Begin to start the ${mins(a.dur)} timer`, cx, H - 26);
}
function drawSigil(c, a, o) {
  const p = o.pal, t = a.t, cx = W / 2, cy = H / 2 + 6, R = 108, hi = new Set(a.letters), pts = a.pts.map(([x, y]) => [x * R, y * R]);
  const k = a.fired == null ? 0 : Math.min(1, (t - a.fired) / 2.2), prog = Math.min(1, t / Math.max(0.8, 0.4 * pts.length));
  c.save(); c.translate(cx, cy);
  // the layout, faintly
  c.globalAlpha = 0.28 * (1 - k); c.strokeStyle = p.ink; c.fillStyle = p.ink; c.lineWidth = 1; c.font = '9px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (a.method !== 'grid') { for (const r of a.method === 'circle' ? [1] : [0.36, 0.66, 0.96]) { c.beginPath(); c.arc(0, 0, r * R, 0, 7); c.stroke(); } }
  for (const ch of AZ) {
    if (a.method === 'grid' && ch === 'J') continue;
    const [x, y] = place(a.method, ch), px = x * R, py = y * R, on = hi.has(ch);
    c.globalAlpha = (on ? 0.9 : 0.3) * (1 - k); c.fillText(ch, a.method === 'circle' ? px * 1.1 : px, a.method === 'circle' ? py * 1.1 : py);
  }
  // the sigil
  const grow = 1 + k * 0.7, glow = 6 + a.charge * 26 + Math.sin(t * 7) * 3 * a.charge;
  c.scale(grow, grow); c.globalAlpha = 1 - k; c.strokeStyle = a.charge > 0.98 ? '#fff4c8' : p.c[0]; c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = p.c[0]; c.shadowBlur = glow;
  const path = new Path2D(), N = pts.length;
  if (N > 1) {
    if (a.method === 'rose') { path.moveTo(...pts[0]); for (let i = 1; i < N - 1; i++) path.quadraticCurveTo(...pts[i], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); path.lineTo(...pts[N - 1]); }
    else { path.moveTo(...pts[0]); for (let i = 1; i < N; i++) path.lineTo(...pts[i]); }
    let len = 0; for (let i = 1; i < N; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    c.setLineDash([len * 1.3 * prog + 0.1, len * 3 + 50]); c.stroke(path); c.setLineDash([]);
  }
  // start ring and end bar
  c.beginPath(); c.arc(pts[0][0], pts[0][1], 7, 0, 7); c.globalAlpha = (1 - k) * Math.min(1, prog * 6); c.stroke();
  if (N > 1 && prog >= 1) { const [x, y] = pts[N - 1], [px, py] = pts[N - 2], an = Math.atan2(y - py, x - px) + Math.PI / 2; c.beginPath(); c.moveTo(x - Math.cos(an) * 8, y - Math.sin(an) * 8); c.lineTo(x + Math.cos(an) * 8, y + Math.sin(an) * 8); c.stroke(); }
  c.restore();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowBlur = 0; c.fillStyle = p.ink; c.font = '600 12px ui-monospace, monospace'; c.globalAlpha = 0.8;
  c.fillText(a.letters.join(' '), cx, 18);
  c.fillText(a.fired != null ? (k >= 1 ? 'Fired. Now forget it.' : 'releasing…') : a.charge >= 0.98 ? 'CHARGED · let go to fire' : a.charge > 0 ? `charging ${Math.round(a.charge * 100)}%` : prog >= 1 ? 'hold the sigil to charge it' : 'drawing…', cx, H - 16);
  if (a.fired == null && a.charge > 0) { c.strokeStyle = p.c[2]; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, R + 24, -Math.PI / 2, -Math.PI / 2 + a.charge * Math.PI * 2); c.stroke(); }
  c.globalAlpha = 1;
}
export function drawChaos(c, a, o) {
  if (a.kind === 'sigil') {
    if (a.holding) a.charge = Math.min(1, a.charge + o.dt / 3.2); else if (a.fired == null) a.charge = Math.max(0, a.charge - o.dt / 6);
    drawSigil(c, a, o);
  } else if (a.kind === 'paradigm') drawParadigm(c, a, o); else drawRitual(c, a, o);
}

// ---------------------------------------------------------------- the card's extra controls
export function chaosUI(o, p) {
  const sub = p.sub, S = (o.chaos = { method: METHODS[(p.seed >>> 3) % 3] }), stop = (e) => e.stopPropagation(), btns = [];
  let top = null;
  if (sub === 'sigil') {
    const input = el('input.sigil-input', { type: 'text', value: INTENTS[(p.seed >>> 0) % INTENTS.length], maxlength: 80, placeholder: 'I find what I lost', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your intent' });
    for (const ev of ['pointerdown', 'click', 'touchstart', 'keydown']) input.addEventListener(ev, stop, { passive: true });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); o.cast(); o.onCast?.(); } });
    o.intent = () => input.value;
    top = el('div.sigil-row', el('small', 'State your intent: a wish in the present tense'), input);
    const m = el('button.btn', { onclick: (e) => { stop(e); S.method = METHODS[(METHODS.indexOf(S.method) + 1) % 3]; m.textContent = `Layout: ${S.method}`; o.cast(); o.onCast?.(); } }, `Layout: ${S.method}`);
    const hold = (on) => { const a = o.anim; if (a?.kind !== 'sigil' || a.fired != null) return; if (!on && a.holding && a.charge >= 0.98) { a.fired = a.t; toast('Fired. Now forget it.'); } a.holding = on; };
    const ch = el('button.btn.charge', 'Hold to charge');
    ch.addEventListener('pointerdown', (e) => { stop(e); hold(true); }); ch.addEventListener('pointerup', () => hold(false)); ch.addEventListener('pointerleave', () => hold(false)); ch.addEventListener('pointercancel', () => { if (o.anim) o.anim.holding = false; });
    ch.addEventListener('contextmenu', (e) => e.preventDefault());
    o.c.addEventListener('pointerdown', (e) => { if (o.anim?.kind === 'sigil') { stop(e); hold(true); } });
    for (const ev of ['pointerup', 'pointerleave']) o.c.addEventListener(ev, () => hold(false));
    o.c.addEventListener('pointercancel', () => { if (o.anim) o.anim.holding = false; });
    btns.push(m, ch);
  } else if (sub === 'ritual') {
    btns.push(el('button.btn', { onclick: (e) => { stop(e); const a = o.anim; if (a?.kind === 'ritual') { a.go = a.go == null ? a.t : null; a.done = false; } } }, 'Begin / stop'));
  }
  return { top, btns };
}
