// A level-1 Dungeons & Dragons 5e character, rolled the classic way (4d6, drop the
// lowest), using the races, classes and spells of the free System Reference Document.
// Every adventurer comes with a persona (how they look, in both sprite styles) and can
// become the player's hero. Stats are flavour only.
import { el } from './util.js';
import { crystalSheet, drawFrame } from './crystal/sprites.js';
import { normPersona, personaToCrystal, describePersona } from './persona.js';
import { setHero, makeHero } from './hero.js';

const AB = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const RACES = [
  { n: 'Hill Dwarf', asi: { CON: 2, WIS: 1 }, speed: 25, langs: ['Common', 'Dwarvish'], traits: ['Darkvision', 'Dwarven Resilience', 'Stonecunning', 'Dwarven Toughness'], hp: 1, syl: ['Thor', 'Bru', 'Dag', 'Kil', 'Ror', 'Vond', 'Ebb', 'Gar', 'din', 'grim', 'mek', 'dal', 'ra'] },
  { n: 'High Elf', asi: { DEX: 2, INT: 1 }, speed: 30, langs: ['Common', 'Elvish'], traits: ['Darkvision', 'Keen Senses', 'Fey Ancestry', 'Trance', 'one wizard cantrip'], syl: ['Ael', 'Thi', 'Lia', 'Sor', 'Ere', 'Van', 'Quel', 'dril', 'thas', 'wyn', 'iel', 'ara', 'non'] },
  { n: 'Lightfoot Halfling', asi: { DEX: 2, CHA: 1 }, speed: 25, langs: ['Common', 'Halfling'], traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Naturally Stealthy'], syl: ['Pip', 'Mer', 'Ros', 'Cora', 'Wil', 'Bree', 'Tob', 'lo', 'ric', 'wyn', 'by', 'ella', 'dock'] },
  { n: 'Human', asi: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, speed: 30, langs: ['Common', 'one extra'], traits: ['Versatile'], syl: ['Al', 'Bran', 'Cas', 'Ed', 'Mar', 'Ros', 'Tam', 'ric', 'wen', 'ia', 'dred', 'mund', 'sa'] },
  { n: 'Dragonborn', asi: { STR: 2, CHA: 1 }, speed: 30, langs: ['Common', 'Draconic'], traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'], syl: ['Arj', 'Bal', 'Kriv', 'Med', 'Nad', 'Sora', 'Thava', 'han', 'asar', 'ash', 'rash', 'kar', 'ra'] },
  { n: 'Rock Gnome', asi: { INT: 2, CON: 1 }, speed: 25, langs: ['Common', 'Gnomish'], traits: ['Darkvision', 'Gnome Cunning', 'Artificer’s Lore', 'Tinker'], syl: ['Bim', 'Fon', 'Gim', 'Nis', 'Orl', 'Zook', 'Ella', 'ble', 'kin', 'ywick', 'nock', 'yn', 'pip'] },
  { n: 'Half-Elf', asi: { CHA: 2, DEX: 1, CON: 1 }, speed: 30, langs: ['Common', 'Elvish', 'one extra'], traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility'], syl: ['Ari', 'Dela', 'Fen', 'Lor', 'Mira', 'Sev', 'Tal', 'an', 'is', 'eth', 'ra', 'wyn', 'ion'] },
  { n: 'Half-Orc', asi: { STR: 2, CON: 1 }, speed: 30, langs: ['Common', 'Orc'], traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'], syl: ['Dench', 'Gor', 'Hol', 'Krusk', 'Ront', 'Shau', 'Vola', 'ag', 'gash', 'tha', 'ka', 'mok', 'ra'] },
  { n: 'Tiefling', asi: { CHA: 2, INT: 1 }, speed: 30, langs: ['Common', 'Infernal'], traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy (thaumaturgy)'], syl: ['Ak', 'Dam', 'Kal', 'Lev', 'Mor', 'Nem', 'Orianna', 'menos', 'akos', 'lista', 'thai', 'eia', 'is'] }
];
const VIRTUE = ['Hope', 'Doubt', 'Ennui', 'Carrion', 'Poetry', 'Gloom', 'Torment', 'Whimsy', 'Static', 'Marrow'];
const CLASSES = [
  { n: 'Barbarian', hd: 12, pri: ['STR', 'CON', 'DEX'], saves: ['STR', 'CON'], skills: [2, ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival']], armor: 'none', gear: ['greataxe', 'two handaxes', 'explorer’s pack', 'four javelins'], feats: ['Rage (2/day)', 'Unarmored Defense'], hue: 10 },
  { n: 'Bard', hd: 8, pri: ['CHA', 'DEX', 'CON'], saves: ['DEX', 'CHA'], skills: [3, null], armor: 'leather', gear: ['rapier', 'lute', 'entertainer’s pack', 'dagger'], feats: ['Bardic Inspiration (d6)', 'Spellcasting'], cast: 'CHA', cantrips: ['Vicious Mockery', 'Minor Illusion', 'Mage Hand', 'Prestidigitation'], spells: ['Healing Word', 'Charm Person', 'Dissonant Whispers', 'Faerie Fire', 'Sleep', 'Thunderwave'], nc: 2, ns: 4, hue: 300 },
  { n: 'Cleric', hd: 8, pri: ['WIS', 'CON', 'STR'], saves: ['WIS', 'CHA'], skills: [2, ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion']], armor: 'scale', shield: true, gear: ['mace', 'scale mail', 'shield', 'holy symbol', 'priest’s pack'], feats: ['Spellcasting', 'Divine Domain (Life)'], cast: 'WIS', cantrips: ['Sacred Flame', 'Guidance', 'Thaumaturgy', 'Spare the Dying'], spells: ['Cure Wounds', 'Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Sanctuary'], nc: 3, ns: 3, hue: 45 },
  { n: 'Druid', hd: 8, pri: ['WIS', 'CON', 'DEX'], saves: ['INT', 'WIS'], skills: [2, ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival']], armor: 'leather', shield: true, gear: ['wooden shield', 'scimitar', 'druidic focus', 'explorer’s pack'], feats: ['Druidic', 'Spellcasting'], cast: 'WIS', cantrips: ['Druidcraft', 'Produce Flame', 'Shillelagh', 'Guidance'], spells: ['Entangle', 'Goodberry', 'Faerie Fire', 'Thunderwave', 'Cure Wounds', 'Speak with Animals'], nc: 2, ns: 3, hue: 110 },
  { n: 'Fighter', hd: 10, pri: ['STR', 'CON', 'DEX'], saves: ['STR', 'CON'], skills: [2, ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival']], armor: 'chain', shield: true, gear: ['longsword', 'chain mail', 'shield', 'light crossbow', 'dungeoneer’s pack'], feats: ['Fighting Style (Defense)', 'Second Wind'], hue: 0 },
  { n: 'Monk', hd: 8, pri: ['DEX', 'WIS', 'CON'], saves: ['STR', 'DEX'], skills: [2, ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth']], armor: 'monk', gear: ['shortsword', 'ten darts', 'explorer’s pack'], feats: ['Unarmored Defense', 'Martial Arts (d4)'], hue: 30 },
  { n: 'Paladin', hd: 10, pri: ['STR', 'CHA', 'CON'], saves: ['WIS', 'CHA'], skills: [2, ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion']], armor: 'chain', shield: true, gear: ['longsword', 'shield', 'five javelins', 'chain mail', 'holy symbol'], feats: ['Divine Sense', 'Lay on Hands (5 hp)'], hue: 50 },
  { n: 'Ranger', hd: 10, pri: ['DEX', 'WIS', 'CON'], saves: ['STR', 'DEX'], skills: [3, ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival']], armor: 'scale', gear: ['two shortswords', 'longbow and 20 arrows', 'scale mail', 'explorer’s pack'], feats: ['Favored Enemy', 'Natural Explorer'], hue: 140 },
  { n: 'Rogue', hd: 8, pri: ['DEX', 'INT', 'CON'], saves: ['DEX', 'INT'], skills: [4, ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth']], armor: 'leather', gear: ['rapier', 'shortbow and 20 arrows', 'burglar’s pack', 'two daggers', 'thieves’ tools'], feats: ['Expertise', 'Sneak Attack (1d6)', 'Thieves’ Cant'], hue: 260 },
  { n: 'Sorcerer', hd: 6, pri: ['CHA', 'CON', 'DEX'], saves: ['CON', 'CHA'], skills: [2, ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion']], armor: 'none', gear: ['light crossbow and 20 bolts', 'arcane focus', 'dungeoneer’s pack', 'two daggers'], feats: ['Spellcasting', 'Sorcerous Origin (Draconic Bloodline)'], cast: 'CHA', cantrips: ['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation', 'Ray of Frost', 'Shocking Grasp'], spells: ['Magic Missile', 'Burning Hands', 'Shield', 'Sleep', 'Thunderwave', 'Charm Person'], nc: 4, ns: 2, hue: 350 },
  { n: 'Warlock', hd: 8, pri: ['CHA', 'CON', 'DEX'], saves: ['WIS', 'CHA'], skills: [2, ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion']], armor: 'leather', gear: ['light crossbow and 20 bolts', 'component pouch', 'scholar’s pack', 'two daggers'], feats: ['Otherworldly Patron (the Fiend)', 'Pact Magic'], cast: 'CHA', cantrips: ['Eldritch Blast', 'Chill Touch', 'Mage Hand', 'Minor Illusion'], spells: ['Hex', 'Armor of Agathys', 'Burning Hands', 'Command', 'Charm Person'], nc: 2, ns: 2, hue: 280 },
  { n: 'Wizard', hd: 6, pri: ['INT', 'CON', 'DEX'], saves: ['INT', 'WIS'], skills: [2, ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion']], armor: 'none', gear: ['quarterstaff', 'spellbook', 'arcane focus', 'scholar’s pack'], feats: ['Spellcasting', 'Arcane Recovery'], cast: 'INT', cantrips: ['Fire Bolt', 'Mage Hand', 'Light', 'Minor Illusion', 'Prestidigitation', 'Ray of Frost'], spells: ['Magic Missile', 'Shield', 'Sleep', 'Detect Magic', 'Feather Fall', 'Find Familiar', 'Mage Armor', 'Burning Hands'], nc: 3, ns: 6, hue: 220 }
];
const SKILLS = { Acrobatics: 'DEX', 'Animal Handling': 'WIS', Arcana: 'INT', Athletics: 'STR', Deception: 'CHA', History: 'INT', Insight: 'WIS', Intimidation: 'CHA', Investigation: 'INT', Medicine: 'WIS', Nature: 'INT', Perception: 'WIS', Performance: 'CHA', Persuasion: 'CHA', Religion: 'INT', 'Sleight of Hand': 'DEX', Stealth: 'DEX', Survival: 'WIS' };
const BACKGROUNDS = [
  ['Acolyte', ['Insight', 'Religion']], ['Criminal', ['Deception', 'Stealth']], ['Folk Hero', ['Animal Handling', 'Survival']], ['Sage', ['Arcana', 'History']], ['Soldier', ['Athletics', 'Intimidation']],
  ['Hermit', ['Medicine', 'Religion']], ['Outlander', ['Athletics', 'Survival']], ['Charlatan', ['Deception', 'Sleight of Hand']], ['Entertainer', ['Acrobatics', 'Performance']], ['Noble', ['History', 'Persuasion']], ['Sailor', ['Athletics', 'Perception']], ['Urchin', ['Sleight of Hand', 'Stealth']]
];
const ALIGN = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
export const TRAITS = ['Talks to their weapon and expects answers.', 'Narrates their own actions in the third person.', 'Apologises to doors before kicking them in.', 'Keeps a running tally of everyone who owes them a favour.', 'Sleeps with one boot on, just in case.', 'Trusts cats, distrusts anyone who dislikes cats.', 'Names every horse they ride "Horse".', 'Collects keys to locks they will never find.', 'Insists on a toast before every fight.', 'Speaks fondly of a hometown no map has heard of.', 'Collects teeth. Not only their own.', 'Is unfailingly polite to the dead.', 'Cannot pass a door without knocking twice.', 'Keeps a diary addressed to a god who never writes back.', 'Hums when lying.', 'Eats only things that are round.', 'Believes they are being followed by a specific crow.', 'Quotes proverbs that do not exist.', 'Laughs at funerals, cries at weddings.'];
export const IDEALS = ['Greed: the treasure is the point, the adventure is the tax.', 'Community: nobody eats until everybody eats.', 'Honour: a lie is a debt the soul pays later.', 'Change: the old order deserves a gentle shove off a cliff.', 'Curiosity: the forbidden door is the one worth opening.', 'Mercy: everyone gets one second chance. Some get three.', 'Freedom: chains are meant to be broken, especially metaphorical ones.', 'Knowledge: the library is the only temple.', 'Chaos: the dice decide, and the dice are always right.', 'Duty: a promise to a stranger is still a promise.', 'Beauty: even a dungeon deserves a nice tablecloth.'];
export const BONDS = ['Guards a sealed box they have never been allowed to open.', 'Writes letters to a mentor who vanished at sea.', 'Was raised by the monks of a monastery that burned down.', 'Promised to return a borrowed spoon, whatever it takes.', 'Owes a large debt to a talking frog.', 'Searching for the sibling who sold their shadow.', 'Carries the last letter of a dead friend, unopened.', 'Protects a village that does not know it exists.', 'Swore vengeance on a minor noble for a stolen hat.', 'Is the only one who remembers a forgotten god.'];
export const FLAWS = ['Gambles on anything, including the weather.', 'Holds grudges with professional dedication.', 'Has never once read the fine print.', 'Faints at the sight of their own blood (only their own).', 'Cannot resist a riddle, even mid-battle.', 'Trusts anyone who offers soup.', 'Panics around mirrors.', 'Spends all gold on maps of places that might not exist.', 'Insults dragons by accident.', 'Is certain they are the chosen one. They are not.'];

export const QUIRKS = ['Hums tavern songs off-key when nervous.', 'Taps their nose before telling a lie.', 'Counts their coins whenever they sit down.', 'Speaks to plants as if they were old friends.', 'Never sits with their back to a door.', 'Laughs a beat too late at every joke.', 'Keeps a pressed flower in their spellbook, or their boot.', 'Sniffs food suspiciously, then eats it anyway.', 'Twirls a coin across their knuckles.', 'Refers to the party as "my associates".', 'Whistles at dramatic moments.', 'Sketches every monster they meet.'];
export const HOOKS = ['A stranger died in their arms, whispering a name that turned out to be theirs.', 'They woke up in a crypt with a map tattooed on their back.', 'Their village was traded to a dragon in a game of cards; they intend to win it back.', 'A prophecy names them as the one who will lose the final battle. They plan to read it more carefully.', 'They are being hunted by a bounty hunter who is also their twin.', 'A god owes them a favour and keeps changing the subject.', 'They carry a sword that remembers its previous owners and keeps comparing.', 'They signed the wrong contract and now technically own a haunted lighthouse.', 'Their shadow has started arriving a few seconds late.', 'An heir to a minor throne, seven claimants removed and counting.'];
export { RACES, CLASSES, BACKGROUNDS, ALIGN };
// what an adventurer of each class and race tends to look like (choices for the persona)
const CLOOK = {
  Barbarian: { top: ['none', 'vest'], bot: ['pants', 'shorts'], head: ['none', 'none', 'bandana'], weapon: ['sword', 'dagger'], hands: ['gloves', 'none'], feet: ['boots'], build: ['brawny', 'athletic'], cape: 0.15 },
  Bard: { top: ['jacket', 'tunic', 'longsleeve'], head: ['none', 'fedora', 'none'], weapon: ['sword', 'dagger'], feet: ['boots', 'shoes'], cape: 0.3 },
  Cleric: { top: ['robe', 'armor'], head: ['none', 'hood', 'helm'], weapon: ['wrench', 'staff'], feet: ['boots', 'shoes'], cape: 0.2 },
  Druid: { top: ['robe', 'tunic'], head: ['hood', 'none'], weapon: ['staff'], feet: ['none', 'shoes'], cape: 0.15 },
  Fighter: { top: ['armor'], head: ['helm', 'none'], weapon: ['sword'], hands: ['gauntlets'], feet: ['boots'], build: ['athletic', 'brawny'], cape: 0.3 },
  Monk: { top: ['vest', 'robe'], hair: ['bald', 'topknot', 'buzz'], weapon: ['none', 'staff'], feet: ['none', 'shoes'], build: ['athletic', 'slim'], cape: 0 },
  Paladin: { top: ['armor'], head: ['helm', 'none'], weapon: ['sword'], hands: ['gauntlets'], feet: ['boots'], build: ['athletic', 'brawny'], cape: 0.6 },
  Ranger: { top: ['tunic', 'vest', 'jacket'], head: ['hood', 'none', 'bandana'], weapon: ['dagger', 'sword'], hands: ['gloves'], feet: ['boots'], cape: 0.35 },
  Rogue: { top: ['vest', 'jacket', 'longsleeve'], head: ['hood', 'bandana', 'none'], weapon: ['dagger'], hands: ['gloves'], feet: ['boots'], build: ['slim', 'average'], cape: 0.2 },
  Sorcerer: { top: ['robe', 'coat', 'tunic'], head: ['none', 'none', 'wizard'], weapon: ['staff', 'none'], feet: ['shoes', 'boots'], cape: 0.3 },
  Warlock: { top: ['coat', 'robe', 'jacket'], head: ['hood', 'none', 'fedora'], weapon: ['staff', 'dagger', 'none'], feet: ['boots', 'shoes'], cape: 0.3 },
  Wizard: { top: ['robe'], head: ['wizard', 'wizard', 'hood'], weapon: ['staff'], feet: ['shoes'], build: ['slim', 'average', 'elder'], cape: 0.25 },
};
const RLOOK = {
  'Hill Dwarf': { build: ['stocky'], beard: ['long', 'short', 'long', 'none'], skin: ['Fair', 'Template', 'Bronze', 'Porcelain'] },
  'High Elf': { build: ['slim', 'lanky'], beard: ['none'], hair: ['long', 'ponytail', 'braid', 'bob'], skin: ['Porcelain', 'Fair', 'Olive', 'Umber'] },
  'Lightfoot Halfling': { build: ['small'], feet: ['none', 'shoes'], beard: ['none', 'none', 'stubble'] },
  'Rock Gnome': { build: ['small'], hair: ['spiky', 'afro', 'bun', 'pigtails'], beard: ['none', 'short', 'long'] },
  Dragonborn: { skin: ['Infernal', 'Goblin', 'Bronze', 'Cerulean', 'Chrome'], hair: ['bald'], beard: ['none'], build: ['brawny', 'athletic'] },
  'Half-Orc': { skin: ['Goblin', 'Olive', 'Umber'], build: ['brawny', 'heavy', 'athletic'], hair: ['mohawk', 'topknot', 'long', 'bald'] },
  Tiefling: { skin: ['Infernal', 'Infernal', 'Cerulean', 'Umber'], hair: ['long', 'ponytail', 'short', 'spiky', 'braid'] },
};
const CLOTHN = ['Navy', 'Denim', 'Khaki', 'Drab', 'Hazard', 'Neon', 'White', 'Azure', 'Scarlet', 'Forest', 'Plum', 'Linen', 'Coal', 'Leather', 'Saffron', 'Teal', 'Steel'];
const HAIRN = ['Chestnut', 'Gold', 'Ink', 'Crimson', 'Silver', 'Violet', 'Moss', 'Rose', 'Umber', 'Copper', 'Azure', 'Snow'];
const SKINN = ['Porcelain', 'Fair', 'Template', 'Olive', 'Bronze', 'Umber', 'Ebony'];
const HAIRS = ['short', 'spiky', 'bob', 'long', 'ponytail', 'braid', 'pigtails', 'topknot', 'bun', 'buzz', 'afro', 'mohawk', 'bald'];
// a look for an adventurer, from class, race and dice
export function adventurerPersona(race, cls, rnd, seed) {
  const pick = (a) => a[Math.floor(rnd() * a.length)], C = CLOOK[cls.n] || {}, R = RLOOK[race.n] || {}, from = (k, d) => pick(R[k] || C[k] || d);
  const metal = (k) => (k === 'armor' || k === 'helm' ? pick(['Steel', 'Steel', 'Coal', 'White', 'Saffron']) : pick(CLOTHN));
  const top = pick(C.top || ['tunic']), head = pick(C.head || ['none']);
  return normPersona({
    seed, era: 'Fantasy', build: from('build', ['average', 'athletic', 'slim', 'heavy', 'lanky']), skin: from('skin', SKINN), hair: from('hair', HAIRS), hairColor: pick(HAIRN),
    beard: from('beard', ['none', 'none', 'none', 'stubble', 'short', 'long']), head, headColor: metal(head), top, topColor: metal(top), trimColor: pick(CLOTHN),
    bot: top === 'robe' ? 'none' : pick(C.bot || ['pants', 'pants', 'skirt']), botColor: pick(CLOTHN), feet: from('feet', ['boots', 'shoes']), feetColor: pick(['Leather', 'Coal', 'Leather', 'Steel']),
    hands: pick(C.hands || ['none', 'none', 'gloves']), handsColor: pick(['Leather', 'Coal', 'Steel', 'Linen']), belt: rnd() < 0.7 ? 'on' : 'off', beltColor: pick(['Leather', 'Saffron', 'Coal', 'Scarlet']),
    cape: rnd() < (C.cape ?? 0.2) ? 'cape' : 'none', capeColor: pick(CLOTHN), weapon: pick(C.weapon || ['dagger']), weaponColor: pick(['Leather', 'Coal', 'Saffron', 'Scarlet', 'Azure', 'Teal']),
  }, seed);
}
const RACE_LOOK = { Dragonborn: 'Scales, a crest of horn and a smell of struck matches.', Tiefling: 'Curled horns and a tail that betrays every mood.', 'High Elf': 'Pointed ears and an unhurried stare.', 'Half-Elf': 'Faintly pointed ears.', 'Half-Orc': 'Tusks, and a grin that uses them.', 'Hill Dwarf': 'Broad as a door, and about as easy to move.', 'Rock Gnome': 'Soot on the nose and a pocketful of springs.', 'Lightfoot Halfling': 'Bare, leathery feet and quick hands.' };

const mod = (v) => Math.floor((v - 10) / 2);
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

// fixed: choices to keep ({ race, cls, bg, align } by name, trait/ideal/... text, persona, name); every roll still
// happens, so changing one choice leaves the dice and the other choices as they were
export function rollCharacter(rnd, fixed = {}) {
  const pick = (a) => a[Math.floor(rnd() * a.length)], keep = (v, k, list, key = (x) => x) => (fixed[k] !== undefined ? list.find((x) => key(x) === fixed[k]) ?? v : v);
  const d6 = () => 1 + Math.floor(rnd() * 6);
  const race = keep(pick(RACES), 'race', RACES, (r) => r.n), cls = keep(pick(CLASSES), 'cls', CLASSES, (c) => c.n), [bg, bgSkills] = keep(pick(BACKGROUNDS), 'bg', BACKGROUNDS, (b) => b[0]);
  const rolls = Array.from({ length: 6 }, () => { const r = [d6(), d6(), d6(), d6()].sort((a, b) => b - a); return { r, total: r[0] + r[1] + r[2] }; }).sort((a, b) => b.total - a.total);
  // best rolls to the class's key abilities, the rest at random
  const order = [...cls.pri, ...AB.filter((a) => !cls.pri.includes(a)).sort(() => rnd() - 0.5)], base = {}, rollOf = {};
  order.forEach((a, i) => { base[a] = rolls[i].total; rollOf[a] = rolls[i].r; });
  const score = Object.fromEntries(AB.map((a) => [a, base[a] + (race.asi[a] || 0)]));
  const m = Object.fromEntries(AB.map((a) => [a, mod(score[a])]));
  const pool = cls.skills[1] || Object.keys(SKILLS);
  const skills = new Set(bgSkills);
  for (const sk of [...pool].sort(() => rnd() - 0.5)) { if (skills.size >= bgSkills.length + cls.skills[0]) break; skills.add(sk); }
  const ac = cls.armor === 'chain' ? 16 : cls.armor === 'scale' ? 14 + Math.min(2, m.DEX) : cls.armor === 'leather' ? 11 + m.DEX : cls.n === 'Barbarian' ? 10 + m.DEX + m.CON : cls.n === 'Monk' ? 10 + m.DEX + m.WIS : 10 + m.DEX;
  const name0 = `${pick(race.syl.slice(0, 7))}${pick(race.syl.slice(7))}`, virtue = race.n === 'Tiefling' && rnd() < 0.5 ? pick(VIRTUE) : null;
  const ch = {
    name: fixed.name || virtue || name0, race, cls, bg, align: keep(pick(ALIGN), 'align', ALIGN), level: 1, prof: 2,
    score, base, rollOf, m, skills: [...skills],
    hp: cls.hd + m.CON + (race.hp || 0), ac: ac + (cls.shield ? 2 : 0), init: m.DEX, speed: race.speed,
    passive: 10 + m.WIS + (skills.has('Perception') ? 2 : 0),
    trait: keep(pick(TRAITS), 'trait', TRAITS), ideal: keep(pick(IDEALS), 'ideal', IDEALS), bond: keep(pick(BONDS), 'bond', BONDS), flaw: keep(pick(FLAWS), 'flaw', FLAWS),
    age: Math.floor({ 'Hill Dwarf': 60, 'High Elf': 120, 'Rock Gnome': 70 }[race.n] || 18 + rnd() * 30) + Math.floor(rnd() * 40), seed: Math.floor(rnd() * 1e9)
  };
  ch.trait2 = keep(pick(TRAITS.filter((x) => x !== ch.trait)), 'trait2', TRAITS); ch.quirk = keep(pick(QUIRKS), 'quirk', QUIRKS); ch.hook = keep(pick(HOOKS), 'hook', HOOKS);
  const look = adventurerPersona(race, cls, rnd, ch.seed);
  ch.persona = fixed.persona ? normPersona(fixed.persona, fixed.persona.seed ?? ch.seed) : look;
  ch.appearance = `${describePersona(ch.persona)}${RACE_LOOK[race.n] ? ` ${RACE_LOOK[race.n]}` : ''}`;
  if (cls.cast) {
    ch.cantrips = [...cls.cantrips].sort(() => rnd() - 0.5).slice(0, cls.nc);
    ch.spells = [...cls.spells].sort(() => rnd() - 0.5).slice(0, cls.ns);
    ch.dc = 8 + 2 + m[cls.cast]; ch.atk = 2 + m[cls.cast];
  }
  return ch;
}
// a plain, storable copy (races and classes by name) and back
export function toSheet(ch) {
  const { race, cls, sheetCv, ...rest } = ch;
  return { ...rest, race: race.n, cls: cls.n };
}
export function fromSheet(d) {
  if (!d) return null;
  const race = RACES.find((r) => r.n === d.race) || RACES[3], cls = CLASSES.find((c) => c.n === d.cls) || CLASSES[4];
  const ch = { ...d, race, cls, persona: normPersona(d.persona, d.seed) };
  ch.m ||= Object.fromEntries(AB.map((a) => [a, mod(ch.score?.[a] ?? 10)]));
  return ch;
}
// make a rolled adventurer the player's hero (games then star them, in both styles)
export function saveAsHero(ch) {
  const h = makeHero(ch.name, ch.persona, toSheet(ch));
  setHero(h);
  return h;
}

// the sheet as HTML for under the canvas
export function sheet(ch) {
  const save = (a) => sign(ch.m[a] + (ch.cls.saves.includes(a) ? 2 : 0));
  const skillLine = Object.entries(SKILLS).map(([k, a]) => `${ch.skills.includes(k) ? '●' : '○'} ${k} ${sign(ch.m[a] + (ch.skills.includes(k) ? 2 : 0))}`);
  return el('div.dnd',
    el('b', `${ch.name} — ${ch.race.n} ${ch.cls.n} 1`),
    el('p.muted', `${ch.bg} · ${ch.align} · age ${ch.age} · speed ${ch.speed} ft`),
    el('div.dnd-stats', ...AB.map((a) => el('div', el('small', a), el('b', String(ch.score[a])), el('span', sign(ch.m[a])), el('i', ch.rollOf[a].join(' '))))),
    el('p', `HP ${ch.hp} · AC ${ch.ac} · Initiative ${sign(ch.init)} · Proficiency +2 · Passive Perception ${ch.passive} · Hit die d${ch.cls.hd}`),
    el('p', `Saving throws: ${AB.map((a) => `${a} ${save(a)}`).join(', ')}`),
    el('p.dnd-skills', skillLine.join(' · ')),
    el('p', `Features: ${[...ch.cls.feats, ...ch.race.traits].join(', ')}`),
    ch.cantrips ? el('p', `Spell save DC ${ch.dc} · spell attack ${sign(ch.atk)} · Cantrips: ${ch.cantrips.join(', ')} · 1st level: ${ch.spells.join(', ')}`) : null,
    el('p', `Equipment: ${ch.cls.gear.join(', ')}, a ${ch.bg.toLowerCase()}’s keepsake, ${10 + Math.floor((ch.seed % 7) * 3)} gp`),
    el('p', `Languages: ${ch.race.langs.join(', ')}`),
    el('p', `Personality: ${ch.trait}${ch.trait2 ? ` ${ch.trait2}` : ''}`),
    el('p', `Ideal: ${ch.ideal} Bond: ${ch.bond} Flaw: ${ch.flaw}`),
    ch.quirk ? el('p', `Quirk: ${ch.quirk}`) : null,
    ch.appearance ? el('p', `Appearance: ${ch.appearance}`) : null,
    ch.hook ? el('p', `Hook: ${ch.hook}`) : null
  );
}
export function sheetText(ch) {
  return `${ch.name} — ${ch.race.n} ${ch.cls.n} 1\n${ch.bg} · ${ch.align}\n\n${AB.map((a) => `${a} ${ch.score[a]} (${sign(ch.m[a])})`).join('  ')}\nHP ${ch.hp}  AC ${ch.ac}  Init ${sign(ch.init)}  Speed ${ch.speed}\nSkills: ${ch.skills.join(', ')}\nFeatures: ${[...ch.cls.feats, ...ch.race.traits].join(', ')}\n${ch.cantrips ? `Cantrips: ${ch.cantrips.join(', ')}\nSpells: ${ch.spells.join(', ')}\n` : ''}Equipment: ${ch.cls.gear.join(', ')}\nPersonality: ${ch.trait}${ch.trait2 ? ` ${ch.trait2}` : ''}\nIdeal: ${ch.ideal}\nBond: ${ch.bond}\nFlaw: ${ch.flaw}\n${ch.quirk ? `Quirk: ${ch.quirk}\n` : ''}${ch.appearance ? `Appearance: ${ch.appearance}\n` : ''}${ch.hook ? `Hook: ${ch.hook}\n` : ''}`;
}
// portrait and ability boxes on the canvas
export function drawCharacter(c, ch, t, pal, W, H) {
  const k = Math.min(1, t / 0.8);
  if (!ch.sheetCv) Object.defineProperty(ch, 'sheetCv', { value: crystalSheet(ch.persona.seed, { char: personaToCrystal(ch.persona), dirs: ['S', 'SE', 'E'] }), enumerable: false });
  const w = ch.persona.weapon, act = w === 'pistol' || w === 'rifle' ? 'shoot' : w === 'staff' || w === 'none' ? 'cast' : 'attack';
  const seq = [['idle', 'S', 1.6], ['walk', 'SE', 1.2], [act, 'E', 0.8], ['idle', 'SE', 1], ['cheer', 'S', 1.2]], tot = seq.reduce((a, q) => a + q[2], 0);
  let u = t % tot, i = 0; while (u > seq[i][2]) { u -= seq[i][2]; i++; }
  const [anim, dir] = seq[i], A = ch.sheetCv.meta.animations[anim];
  c.save(); c.globalAlpha = k;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(90, 202, 34, 7, 0, 0, 7); c.fill();
  drawFrame(c, ch.sheetCv, anim, dir, A.loop ? Math.floor(u * A.fps) % A.frames : Math.min(A.frames - 1, Math.floor(u * A.fps)), 90, 204 + (1 - k) * 20, 4);
  c.restore();
  c.fillStyle = pal.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.font = '700 18px Georgia, serif'; c.fillText(ch.name, 170, 50);
  c.font = '600 12px ui-monospace, monospace'; c.fillStyle = pal.c[1]; c.fillText(`${ch.race.n}`, 170, 72); c.fillText(`${ch.cls.n} · level 1`, 170, 88);
  AB.forEach((a, i) => {
    const x = 170 + (i % 3) * 60, y = 110 + Math.floor(i / 3) * 62, show = t > 0.5 + i * 0.25;
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, y, 52, 54); c.strokeStyle = pal.c[0]; c.lineWidth = 1.5; c.strokeRect(x, y, 52, 54);
    c.fillStyle = pal.ink; c.textAlign = 'center'; c.font = '600 10px ui-monospace, monospace'; c.fillText(a, x + 26, y + 10);
    c.font = '800 20px ui-monospace, monospace'; c.fillText(show ? String(ch.score[a]) : String(3 + Math.floor((t * 37 + i * 7) % 16)), x + 26, y + 29);
    if (show) { c.font = '600 11px ui-monospace, monospace'; c.fillStyle = pal.c[1]; c.fillText(sign(ch.m[a]), x + 26, y + 46); }
  });
  c.textAlign = 'center'; c.fillStyle = pal.ink; c.font = '700 13px ui-monospace, monospace';
  c.fillText(`HP ${ch.hp}   AC ${ch.ac}   ${ch.align}`, W / 2, H - 46);
  c.font = 'italic 12px Georgia, serif'; c.fillStyle = pal.c[4];
  c.fillText(ch.trait, W / 2, H - 22);
}
