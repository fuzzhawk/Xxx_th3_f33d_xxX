// Tables for the oracle posts. Hexagram names are the usual Wilhelm-style
// translations; every gloss and reading here is our own short wording.

// King Wen number for [lower trigram][upper trigram]; trigrams indexed by
// lines bottom→top as bits (yang = 1): see TRI below.
export const TRI = [
  { bits: 0b111, name: 'Heaven', glyph: '☰' }, { bits: 0b001, name: 'Thunder', glyph: '☳' }, { bits: 0b010, name: 'Water', glyph: '☵' }, { bits: 0b100, name: 'Mountain', glyph: '☶' },
  { bits: 0b000, name: 'Earth', glyph: '☷' }, { bits: 0b110, name: 'Wind', glyph: '☴' }, { bits: 0b101, name: 'Fire', glyph: '☲' }, { bits: 0b011, name: 'Lake', glyph: '☱' }
];
const KW = [
  [1, 34, 5, 26, 11, 9, 14, 43], [25, 51, 3, 27, 24, 42, 21, 17], [6, 40, 29, 4, 7, 59, 64, 47], [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45], [44, 32, 48, 18, 46, 57, 50, 28], [13, 55, 63, 22, 36, 37, 30, 49], [10, 54, 60, 41, 19, 61, 38, 58]
];
// lines: array of 6 booleans (yang), bottom first. Bit k of a trigram = line k from the bottom.
export function hexNumber(lines) {
  const tri = (a) => TRI.findIndex((t) => t.bits === (a[0] ? 1 : 0) + (a[1] ? 2 : 0) + (a[2] ? 4 : 0));
  return KW[tri(lines.slice(0, 3))][tri(lines.slice(3, 6))];
}
export const HEX = [null,
  ['Qián', 'The Creative', 'Pure momentum. Start the thing; the sky is on your side, briefly.'],
  ['Kūn', 'The Receptive', 'Yield like soil. Let something grow in you instead of forcing it.'],
  ['Zhūn', 'Difficulty at the Beginning', 'Messy starts are still starts. Get help, don’t get out.'],
  ['Méng', 'Youthful Folly', 'You don’t know yet. Ask once, sincerely, then listen.'],
  ['Xū', 'Waiting', 'The rain comes when it comes. Eat, drink, stay ready.'],
  ['Sòng', 'Conflict', 'Winning this argument costs more than it pays. Stop halfway.'],
  ['Shī', 'The Army', 'Organise. Discipline beats enthusiasm on a long march.'],
  ['Bǐ', 'Holding Together', 'Join the group now, not after the door has closed.'],
  ['Xiǎo Chù', 'Small Taming', 'Clouds without rain. Small restraints, small gains — enough.'],
  ['Lǚ', 'Treading', 'You are stepping on the tiger’s tail. Politely.'],
  ['Tài', 'Peace', 'Heaven and earth trade places and everything flows. Enjoy it, don’t hoard it.'],
  ['Pǐ', 'Standstill', 'Nothing connects. Keep your own counsel and wait out the stuck season.'],
  ['Tóng Rén', 'Fellowship', 'Find your people in the open, not in a back room.'],
  ['Dà Yǒu', 'Great Possession', 'Plenty. Share it in daylight and it stays.'],
  ['Qiān', 'Modesty', 'The mountain hides under the earth. Understatement wins.'],
  ['Yù', 'Enthusiasm', 'Thunder over the earth: rouse people with music, not orders.'],
  ['Suí', 'Following', 'To lead, follow for a while. Rest when evening comes.'],
  ['Gǔ', 'Work on the Decayed', 'Something rotted under your care. Fix it; three days before, three after.'],
  ['Lín', 'Approach', 'Good things draw near. Meet them warmly but know summer ends.'],
  ['Guān', 'Contemplation', 'Look before acting, and know that you are being looked at too.'],
  ['Shì Hé', 'Biting Through', 'An obstacle between the teeth. Bite, decisively and fairly.'],
  ['Bì', 'Grace', 'Beauty helps small matters. It won’t carry the big ones.'],
  ['Bō', 'Splitting Apart', 'The roof is peeling. Don’t climb on it; strengthen the floor.'],
  ['Fù', 'Return', 'The light comes back after the darkest point. Turn around gently.'],
  ['Wú Wàng', 'Innocence', 'Act without scheming. Unplanned trouble is not your fault.'],
  ['Dà Chù', 'Great Taming', 'Store up strength. Eating away from home is fortunate.'],
  ['Yí', 'Nourishment', 'Watch what you feed, in your mouth and in your head.'],
  ['Dà Guò', 'Great Exceeding', 'The ridgepole sags. Carry less, or move somewhere else.'],
  ['Kǎn', 'The Abysmal (Water)', 'Danger upon danger. Be like water: keep flowing, keep faith.'],
  ['Lí', 'The Clinging (Fire)', 'Fire needs something to cling to. Choose it well.'],
  ['Xián', 'Influence', 'Attraction moves things. Be receptive, not grabby.'],
  ['Héng', 'Duration', 'Stay the course. Endurance is not the same as stubbornness.'],
  ['Dùn', 'Retreat', 'Withdraw in good order. It isn’t defeat if you choose it.'],
  ['Dà Zhuàng', 'Great Power', 'You’re strong right now. That is exactly when to be careful.'],
  ['Jìn', 'Progress', 'The sun rises over the earth. Advance, and be seen doing it.'],
  ['Míng Yí', 'Darkening of the Light', 'Hide your brightness for a while. Keep it lit inside.'],
  ['Jiā Rén', 'The Family', 'Order begins at home. Words with substance, habits with duration.'],
  ['Kuí', 'Opposition', 'Fire up, lake down. Small things succeed even among strangers.'],
  ['Jiǎn', 'Obstruction', 'A mountain ahead and water behind. Go around, ask for help.'],
  ['Xiè', 'Deliverance', 'The storm breaks. Forgive, untangle, go home early.'],
  ['Sǔn', 'Decrease', 'Lose something on purpose. Two small bowls can be an offering.'],
  ['Yì', 'Increase', 'Wind and thunder feed each other. Give, and it comes back.'],
  ['Guài', 'Breakthrough', 'Resolve it openly. Announce it at the king’s court.'],
  ['Gòu', 'Coming to Meet', 'Something tempting arrives uninvited. Don’t marry it.'],
  ['Cuì', 'Gathering Together', 'Crowds form around a centre. Bring an offering.'],
  ['Shēng', 'Pushing Upward', 'Grow like a sapling: steadily, toward the south.'],
  ['Kùn', 'Oppression', 'Exhausted, unheard. Words won’t help; character will.'],
  ['Jǐng', 'The Well', 'The town can move, the well cannot. Clean the rope.'],
  ['Gé', 'Revolution', 'Molting season. Change when the time is ripe, not before.'],
  ['Dǐng', 'The Cauldron', 'Something is cooking that will feed many. Tend the fire.'],
  ['Zhèn', 'The Arousing (Thunder)', 'A shock. Laugh afterwards, but don’t spill the sacred wine.'],
  ['Gèn', 'Keeping Still', 'Stillness like a mountain. Stop your back; stop the chatter.'],
  ['Jiàn', 'Gradual Development', 'A wild goose lands, step by step. Slow is fine.'],
  ['Guī Mèi', 'The Marrying Maiden', 'You are not in charge here. Act from the side, with tact.'],
  ['Fēng', 'Abundance', 'Noon. Be like the sun at its height — and remember the afternoon.'],
  ['Lǚ', 'The Wanderer', 'A traveller. Be courteous, keep moving, don’t start fires.'],
  ['Xùn', 'The Gentle (Wind)', 'Penetrate like wind: small, persistent, from every side.'],
  ['Duì', 'The Joyous (Lake)', 'Joy shared doubles. Talk with friends.'],
  ['Huàn', 'Dispersion', 'Ice melts. Dissolve the rigid thing; cross the great water.'],
  ['Jié', 'Limitation', 'Limits give shape. Bitter limits break; choose sweet ones.'],
  ['Zhōng Fú', 'Inner Truth', 'Even pigs and fishes can be persuaded by sincerity.'],
  ['Xiǎo Guò', 'Small Exceeding', 'The bird should not fly too high. Do small things extra well.'],
  ['Jì Jì', 'After Completion', 'It is done. That is when disorder creeps back in.'],
  ['Wèi Jì', 'Before Completion', 'Almost across. The little fox gets its tail wet. Keep going.']
];

// ---------------------------------------------------------------- tarot
export const MAJORS = [
  ['The Fool', 'a leap, beginnings, holy ignorance', 'recklessness, a step taken without looking'],
  ['The Magician', 'skill, willpower, all tools on the table', 'manipulation, talent left unused'],
  ['The High Priestess', 'intuition, secrets, the unsaid', 'hidden agendas, ignoring your gut'],
  ['The Empress', 'abundance, care, creativity', 'smothering, creative block'],
  ['The Emperor', 'structure, authority, a firm hand', 'rigidity, control for its own sake'],
  ['The Hierophant', 'tradition, teachers, institutions', 'rebellion, questioning the rules'],
  ['The Lovers', 'union, a choice of the heart', 'disharmony, values out of line'],
  ['The Chariot', 'drive, victory through focus', 'scattered effort, losing the reins'],
  ['Strength', 'gentle courage, patience with the beast', 'self-doubt, raw force'],
  ['The Hermit', 'solitude, a lamp in the dark', 'isolation, hiding from help'],
  ['Wheel of Fortune', 'cycles, luck turning', 'a bad spin, resisting change'],
  ['Justice', 'fairness, cause and effect', 'unfairness, avoiding accountability'],
  ['The Hanged Man', 'surrender, a new angle', 'stalling, pointless sacrifice'],
  ['Death', 'endings that clear the ground', 'clinging to what is already over'],
  ['Temperance', 'balance, mixing, moderation', 'excess, impatience'],
  ['The Devil', 'attachment, temptation, chains you could slip', 'release, seeing the trap'],
  ['The Tower', 'sudden upheaval, truth breaking through', 'disaster narrowly avoided, fear of change'],
  ['The Star', 'hope, healing, a clear sky', 'despair, disconnection'],
  ['The Moon', 'illusion, dreams, the uncanny', 'confusion lifting, secrets surfacing'],
  ['The Sun', 'joy, success, warmth', 'a cloud over the fun, temporary gloom'],
  ['Judgement', 'reckoning, a calling, rebirth', 'self-doubt, refusing the call'],
  ['The World', 'completion, wholeness, arrival', 'loose ends, a shortcut not taken']
];
export const SUITS = [
  { id: 'W', name: 'Wands', file: 'Wands', of: 'will and ambition', thing: 'spark', bad: 'burnout' },
  { id: 'C', name: 'Cups', file: 'Cups', of: 'feelings and friendship', thing: 'feeling', bad: 'sulking' },
  { id: 'S', name: 'Swords', file: 'Swords', of: 'thought and conflict', thing: 'idea', bad: 'cruelty' },
  { id: 'P', name: 'Pentacles', file: 'Pents', of: 'money, body and work', thing: 'opportunity', bad: 'greed' }
];
const RANKS = [
  ['Ace', (s) => `a new ${s.thing} in ${s.of}`, (s) => `a ${s.thing} that won’t catch`],
  ['Two', (s) => `a choice or a balance in ${s.of}`, (s) => 'indecision'],
  ['Three', (s) => `early growth and collaboration in ${s.of}`, (s) => 'a plan pulling apart'],
  ['Four', (s) => `rest and stability in ${s.of}`, (s) => 'stagnation'],
  ['Five', (s) => `loss or a scrap over ${s.of}`, (s) => 'recovery after the fight'],
  ['Six', (s) => `generosity and passage in ${s.of}`, (s) => 'strings attached'],
  ['Seven', (s) => `testing your position in ${s.of}`, (s) => 'second-guessing'],
  ['Eight', (s) => `movement and craft in ${s.of}`, (s) => 'spinning your wheels'],
  ['Nine', (s) => `nearly there in ${s.of}`, (s) => 'anxiety at the finish'],
  ['Ten', (s) => `the full weight of ${s.of}`, (s) => `${s.bad} under too much load`],
  ['Page', (s) => `curiosity, a message about ${s.of}`, (s) => 'news delayed'],
  ['Knight', (s) => `bold pursuit of ${s.of}`, (s) => 'charging the wrong way'],
  ['Queen', (s) => `quiet mastery of ${s.of}`, (s) => `${s.bad} turned inward`],
  ['King', (s) => `command of ${s.of}`, (s) => `${s.bad} wearing a crown`]
];
// every card: { id, name, up, rev, rws } (rws = the Commons file name of the 1909 deck)
const RWS = ['00 Fool', '01 Magician', '02 High Priestess', '03 Empress', '04 Emperor', '05 Hierophant', '06 Lovers', '07 Chariot', '08 Strength', '09 Hermit', '10 Wheel of Fortune', '11 Justice', '12 Hanged Man', '13 Death', '14 Temperance', '15 Devil', '16 Tower', '17 Star', '18 Moon', '19 Sun', '20 Judgement', '21 World'];
export const DECK = [
  ...MAJORS.map(([name, up, rev], i) => ({ id: `M${String(i).padStart(2, '0')}`, name, up, rev, major: true, num: i, rws: `RWS Tarot ${RWS[i]}.jpg` })),
  ...SUITS.flatMap((s) => RANKS.map(([r, up, rev], k) => ({ id: `${s.id}${String(k + 1).padStart(2, '0')}`, name: `${r} of ${s.name}`, up: up(s), rev: rev(s), suit: s.id, num: k + 1, rws: `${s.file}${String(k + 1).padStart(2, '0')}.jpg` })))
];

// ---------------------------------------------------------------- haruspicy: regions of a bronze liver
// (names after the Etruscan Piacenza liver; domains simplified)
export const LIVER = [
  ['Tin', 'the sky-father: authority, big decisions'], ['Uni', 'the queen: partnerships, loyalty'], ['Menrva', 'wisdom and craft'], ['Nethuns', 'water, travel, journeys'],
  ['Fufluns', 'wine, growth, parties'], ['Cath', 'the sun-daughter: clarity, mornings'], ['Selvans', 'woods and boundaries'], ['Tluscv', 'the underworld pair: endings, old debts'],
  ['Lethns', 'harvest and fields'], ['Usil', 'the sun: fame, being seen'], ['Tiv', 'the moon: sleep, dreams, cycles'], ['Satre', 'time, patience'],
  ['Cel', 'the earth-mother: home, food'], ['Vetisl', 'the dark one: what you avoid'], ['Mar', 'war, arguments, ambition'], ['Herc', 'heavy lifting, strength']
];
export const MARKS = [
  ['a pale spot', 'a small warning, easily heeded'], ['a dark blot', 'resistance — expect a no before a yes'], ['a swelling', 'abundance, maybe too much'], ['a fine crack', 'something is already giving way'],
  ['a perfect sheen', 'favour; proceed'], ['a curious fold', 'a hidden option you haven’t seen'], ['a double vein', 'two paths, both open'], ['a tiny worm', 'gossip; keep it to yourself']
];
export const CAPUT = [
  ['present and plump', 'The head of the liver is present and plump: the gods accept the sacrifice.', 1],
  ['doubled', 'The head of the liver is doubled — very rare, very good. Act boldly.', 2],
  ['small and shrivelled', 'The head of the liver is small and shrivelled: lukewarm approval. Proceed with care.', 0],
  ['missing', 'There is no head on the liver at all. This is what the priest found for Caesar on the Ides of March. Maybe stay in today.', -2]
];

// ---------------------------------------------------------------- augury with the sacred chickens
export const AUGURY = [
  { key: 'solistimum', eat: 1, drop: true, title: 'Tripudium solistimum', text: 'The chickens fall on the grain so greedily that it tumbles from their beaks. The best omen there is. Begin the battle, send the email.' },
  { key: 'eat', eat: 0.7, title: 'They eat', text: 'The chickens eat steadily. A favourable sign; the gods are neither thrilled nor bored.' },
  { key: 'peck', eat: 0.3, title: 'Hesitant pecking', text: 'The chickens peck, look around, peck again. Uncertain. Ask again tomorrow, with better grain.' },
  { key: 'refuse', eat: 0, title: 'They refuse to eat', text: 'The chickens will not eat. Unfavourable. (In 249 BC the consul Claudius Pulcher threw them overboard — “let them drink, then” — and lost his fleet.)' },
  { key: 'flee', eat: 0, flee: true, title: 'They flee the coop', text: 'The chickens flap out of the coop and away. The worst sign. Whatever it is, not today.' }
];

// ---------------------------------------------------------------- dice
export const DICE3 = {
  3: 'Snake eyes and then some. Lie down and wait for the weather to change.', 4: 'Low ebb. Do the smallest version of the task.', 5: 'A detour is the road this time.', 6: 'Quiet luck. Don’t announce it.',
  7: 'Ask someone older.', 8: 'Fix one broken thing before starting a new one.', 9: 'Yes, but slower than you want.', 10: 'Even odds. Flip it again in your heart.',
  11: 'Good timing. Move before lunch.', 12: 'The answer is in a drawer you never open.', 13: 'Unlucky number, lucky outcome.', 14: 'Strong yes, if you bring snacks.',
  15: 'Someone is about to help you without being asked.', 16: 'Fortune favours the slightly ridiculous.', 17: 'Very nearly perfect. Accept nearly.', 18: 'Triple sixes: maximum fate. Do it now.'
};
export const QUESTIONS = [
  'Should I text them back?', 'Is today a good day to start something?', 'Will the plan work?', 'Should I go out tonight?', 'Is it time to quit?', 'What should I pay attention to this week?',
  'Will I find what I lost?', 'Should I say yes?', 'Is this a sign?', 'Should I buy the thing?', 'What is blocking me?', 'Will it rain on my parade?', 'Should I trust my gut on this?',
  'What does the cat know that I don’t?', 'Should I rearrange the furniture?', 'Am I on the right path?', 'Will the meeting go well?', 'Should I learn the accordion?'
];
