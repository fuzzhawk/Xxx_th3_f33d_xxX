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
  ['missing', 'There is no head on the liver at all — the omen the consul Marcellus received before he rode into an ambush. Maybe stay in today.', -2]
];

// the other exta, each with a few possible states (w = how often) and a reading
export const EXTA = {
  heart: { name: 'Cor — the heart', states: [
    { k: 'normal', w: 50, s: 'firm and still twitching', r: 'Courage is with you. Say the thing.' },
    { k: 'small', w: 15, s: 'small and pale', r: 'Your nerve is low. Pick a smaller battle.' },
    { k: 'huge', w: 12, s: 'enormous', r: 'Too much feeling for one body. Share some of it.' },
    { k: 'two', w: 8, s: 'doubled — two hearts', r: 'Two loyalties pull at you. Both can be kept, briefly.' },
    { k: 'stone', w: 5, s: 'cold as stone', r: 'Someone has stopped caring. Possibly you.' },
    { k: 'none', w: 10, s: 'missing entirely', r: 'No heart in the beast: the omen Spurinna read for Caesar before the Ides of March. Beware the next big meeting.' }] },
  lungs: { name: 'Pulmo — the lungs', states: [
    { k: 'normal', w: 55, s: 'pink and full', r: 'Breathe; there is room. Good for travel and speaking.' },
    { k: 'spotted', w: 15, s: 'spotted', r: 'Something small is wearing you down. Rest before it grows.' },
    { k: 'one', w: 10, s: 'only one', r: 'Half your strength is elsewhere. Call in a friend.' },
    { k: 'black', w: 8, s: 'black as soot', r: 'Bad air around you — a room, a job, a group chat.' },
    { k: 'gills', w: 12, s: 'gills, not lungs', r: 'This beast belonged to the water. So, perhaps, do you. Go swimming.' }] },
  gall: { name: 'Fel — the gall bladder', states: [
    { k: 'normal', w: 55, s: 'green and calm', r: 'Your anger is where it belongs.' },
    { k: 'swollen', w: 20, s: 'swollen with bile', r: 'Bitterness is building. Let it out somewhere harmless.' },
    { k: 'tiny', w: 15, s: 'tiny', r: 'You are too forgiving this week. Charge the fee.' },
    { k: 'burst', w: 10, s: 'burst', r: 'A quarrel is about to spill over. Mop up early.' }] },
  stomach: { name: 'Venter — the stomach', states: [
    { k: 'normal', w: 40, s: 'ordinary', r: 'Nothing to digest. Carry on.' },
    { k: 'grain', w: 25, s: 'full of grain', r: 'Plenty is coming. Make room in the cupboards.' },
    { k: 'empty', w: 20, s: 'empty', r: 'You are hungry for something that isn’t food.' },
    { k: 'trinket', w: 15, s: 'holding something it swallowed', r: 'A small, odd gift is on its way. Accept it without asking where it’s been.' }] },
  gut: { name: 'Intestina — the coils', states: [
    { k: 'normal', w: 55, s: 'long and neatly coiled', r: 'A long road, but a tidy one.' },
    { k: 'knot', w: 25, s: 'tied in a knot', r: 'Things are more tangled than they look. Untie, don’t cut.' },
    { k: 'black', w: 10, s: 'dark and twisted', r: 'Something you swallowed recently disagrees with you. Spit it out.' },
    { k: 'none', w: 10, s: 'absent — just empty space', r: 'No gut, no instinct. Do not trust your hunches today.' }] }
};

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
  'What does the cat know that I don’t?', 'Should I rearrange the furniture?', 'Am I on the right path?', 'Will the meeting go well?', 'Should I learn the accordion?',
  'Should I send the email I wrote at 2 a.m.?', 'Is it okay to leave the party early?', 'Will this phase pass?', 'Should I forgive them?', 'Do I need a haircut or a new life?', 'What am I pretending not to know?',
  'Is the thing I’m avoiding as bad as I think?', 'Should I move to the other city?', 'Will I ever finish this project?', 'Who should I call today?', 'What is the next small right thing?',
  'Is it time to clean out the closet, the inbox or the friendship?', 'Should I adopt the dog?', 'Does the stranger on the bus matter?', 'Am I being too hard on myself?', 'What should I stop doing?',
  'Will they say yes?', 'Should I ask for the raise?', 'What is my houseplant trying to tell me?', 'Is this the week to start over?', 'Should I tell the truth or the funny version?', 'What would I do if I weren’t afraid?',
  'Is my gut right or just hungry?', 'Should I stay in tonight?', 'Will the weather hold?', 'What am I overlooking?', 'Should I take the long way home?', 'What does the next chapter want from me?',
  'Is it time to say goodbye to the old phone, the old plan, the old name?', 'Will I get what I’m hoping for?', 'Should I buy the plane ticket?', 'What do I owe myself?', 'Which of my two options is the lie?',
  'Am I ready?', 'Should I keep the secret?', 'Will I get back what I lent?', 'What is hiding in plain sight?', 'Should I paint the door red?', 'Is it too late, or only late?',
  'What should I cook for someone I like?', 'Will I sleep tonight?', 'Should I start the novel, the band or the garden?', 'Is the universe nudging me or just noisy?', 'What do I need to hear?', 'Should I delete the app?',
  'Will it be worth it?', 'What would my future self say?', 'Should I put my phone in a drawer for a day?', 'Is it safe to be happy about this?', 'Who am I when no one is watching?', 'Should I trust the new person?',
  'What is the most useful thing I could do in the next hour?', 'Will I regret this tattoo?', 'Should I go back to school?', 'What is the lesson in this mess?', 'Should I make the first move?',
  'Is there a better word for what I’m feeling?', 'Does last night’s dream mean something?', 'Should I give them another chance?', 'Where should I look for what I lost?', 'Should I ignore the noise?', 'What do my hands want to make?',
  'Am I the villain in someone else’s story?', 'Should I learn to juggle?', 'Will today be strange in a good way?', 'Should I water the plant I’ve been neglecting?', 'What am I waiting for permission to do?',
  'Is the answer yes and I’m afraid of it?', 'Should I sell it, keep it or give it away?', 'What does the river know about patience?', 'Should I stay up and watch the sunrise?', 'Do I trust the plan or the improvisation?',
  'Is it time to ask for help?', 'What should I forget on purpose?', 'Will this old song help?', 'Should I speak up in the meeting?', 'What would make tomorrow lighter?', 'Should I get a second opinion?',
  'Is it a coincidence?', 'What is the pigeon on my windowsill doing there?', 'Should I follow the strange map?', 'How do I make peace with Monday?', 'Will the sourdough rise?', 'Is it wise to say what I really think?',
  'Should I be doing something else right now?', 'What is the best use of a free afternoon?', 'Should I paint over the old mural?', 'Is my luck turning?', 'Who is thinking about me right now?', 'Should I plant something?',
  'What is this restlessness for?', 'What do I do with the extra key?', 'Will I make it on time?', 'Should I believe the horoscope or the coin?', 'What does my shadow want?', 'Should I give the speech?',
  'Am I the one who is lost?', 'Should I take the strange job offer?', 'Is it time to forgive the past me?', 'Should I buy the ridiculous hat?', 'What do I need to say out loud?', 'Will the last piece of cake still be there?',
  'Should I try the thing I’m bad at?', 'What would a stranger notice about my day?', 'Is it okay to be unreasonably happy?', 'Should I sleep on it or sleep through it?', 'Will they remember my name?',
  'What is the right size for this ambition?', 'Should I name the plant?', 'What does the next hour need?', 'Is this the right time to reply all?', 'Should I turn the music up?', 'What is the one thing I shouldn’t postpone?',
  'Should I wear the red one?', 'Will we get lost, and will it be good?', 'What does the empty chair want?', 'Should I take it personally?', 'What would the ghost of this house advise?', 'Should I say sorry first?',
  'Am I too early or too late?', 'Will the bridge hold?', 'Is it time to stop apologising for taking up space?', 'Should I light a candle?', 'What will surprise me this week?', 'Which door is the real door?',
  'Do I need rest, or a reason?', 'Should I fix it or let it break?', 'What am I about to learn the hard way?', 'Who is the next person I will make laugh?', 'Should I bring a gift?',
  'What is the one thing worth finishing today?', 'Should I talk to the mirror?', 'Is the fridge the answer?', 'Will the printer work when it counts?', 'Should I eat the leftovers of unknown age?'
];

// ---------------------------------------------------------------- readings
// How the oracle sounds when it answers: verdicts run from yes through lean, mixed and wait to no.
export const VERDICT = {
  yes: ['says yes, and means it', 'is warm toward it, the way a doorway is warm when the light is on', 'nods firmly: the signs line up', 'gives a clear green light'],
  lean: ['leans yes, though warm isn’t the same as certain', 'tilts toward yes with a few conditions attached', 'is cautiously for it', 'says probably, with one eyebrow raised'],
  mixed: ['says both, which is its way of saying it depends on how you go about it', 'refuses to pick a side; the outcome is still in your hands', 'shrugs, kindly: the answer is not in the omen, it is in the doing', 'comes back evenly split'],
  wait: ['asks you to wait', 'says not yet', 'leans no for now, which is different from no for ever', 'would rather you sleep on it'],
  no: ['says no, and would like you to hear it', 'is cold toward it', 'frowns: the signs do not line up', 'advises against, firmly']
};
// something concrete to do, whatever the question was
export const ADVICE = {
  yes: ['Take the first step before lunch, while the sign is fresh: a draft, a call, a booking you can still cancel.', 'Say yes out loud to one person today, so that it is a little harder to take back.', 'Do the part you have been rehearsing, and do it badly first; the real version will follow.', 'Clear thirty minutes this afternoon and spend them on this and nothing else.', 'Write down what “success” would look like in one sentence, tape it where you will see it, and begin.', 'Tell the one friend who will be pleased, then act while their cheer is still in your ears.'],
  lean: ['Go ahead, but make the first move small and reversible, and look at how it feels afterwards.', 'Decide a limit in advance, such as an amount, a time or a number of tries, and then say yes inside it.', 'Do it, and ask one person you trust to check on you in three days.', 'Start with the version that costs least, and let the oracle’s lean turn into a certainty by evidence.', 'Say yes to the part that makes you slightly nervous in a good way and no to the part that makes you tired.'],
  mixed: ['Flip a coin, and watch what you hope for while it is in the air; that is your answer.', 'List what you would gain and what you would grieve, one line each, then read both aloud to someone.', 'Take the smallest step that keeps both doors open, and decide properly after a night’s sleep.', 'Ask the one question you have been avoiding; the whole reading hinges on its answer.', 'Do half of it today: the half you would be glad to have done whatever happens next.'],
  wait: ['Give it three days, and in that time collect one new fact; decide when the fact arrives.', 'Do not decide today. Tidy something physical instead: a drawer, a desk, a sock pile; clarity travels through the hands.', 'Write the decision on a slip of paper, put it in a pocket, and look at it again on the weekend.', 'Wait until you have eaten, slept and walked. Then ask again; if the answer changes, the first one was tiredness.', 'Use the pause to prepare: gather the paperwork, the courage or the apology, so that when the time comes you are fast.'],
  no: ['Leave it alone for now, and put the energy into something that is already half-built.', 'Say a polite no today, or simply do not reply; silence is also an answer, and cheaper.', 'Name what you were hoping this would give you, and find a smaller way to get that exact thing this week.', 'Do the opposite of your first impulse for one hour and see whether anything in you objects.', 'Close the tab, put the phone in another room and take a ten-minute walk; the urge cools quicker than you think.']
};
// how the question is being read, for the sentence that ties the omen to it
export const LENS = { do: 'On whether to act', will: 'As a forecast', what: 'As to what is going on', am: 'About you', other: 'Held up against your question' };
export function qKind(q) {
  q = (q || '').toLowerCase();
  return /^(should|shall|can i|must i|is it (time|okay|ok|wise|safe)|is (today|this) (a good|the right)|do i need)/.test(q) ? 'do' : /^(will|would|is .* going to|are we going)/.test(q) ? 'will' : /^(am i|are we|do i|did i|who am i)/.test(q) ? 'am' : /^(what|why|who|where|when|how|which|does|is there)/.test(q) ? 'what' : 'other';
}
export const verdictOf = (score) => (score >= 1 ? 'yes' : score >= 0.3 ? 'lean' : score > -0.3 ? 'mixed' : score > -1 ? 'wait' : 'no');

// How favourable each card is: the major arcana, the ranks, and a nudge for swords. A reversed card is weighted at -½.
export const MAJOR_TONE = [1, 2, 0, 1.5, 0.5, 0, 1.5, 1.5, 1.5, -0.5, 1, 0.5, -0.5, -0.5, 1, -1.5, -2, 2, -0.5, 2, 1, 2];
export const RANK_TONE = [1.5, 0, 1, 0, -1.5, 1, -0.5, 0.5, 0, -1, 0.5, 0.5, 1, 1];
export const SUIT_TONE = { W: 0.2, C: 0.2, S: -0.4, P: 0.1 };
export const cardTone = (c) => (c.major ? MAJOR_TONE[c.num] : RANK_TONE[c.num - 1] + SUIT_TONE[c.suit]);
// I Ching: + favourable, - hard, ~ wait, 0 mixed (hexagrams 1–64)
export const HEX_TONE = '+0~~~-0+' + '~0+-++++' + '+0+00 0-'.replace(/ /g, '') + '+0+0-0--'.replace(/ /g, '').slice(0) ;
