// A level-1 Dungeons & Dragons 5e character, rolled the classic way (4d6, drop the
// lowest), using the races, classes and spells of the free System Reference Document.
import { el } from './util.js';
import { humanoid } from './games/creature.js';

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
const TRAITS = ['Talks to their weapon and expects answers.', 'Collects teeth. Not only their own.', 'Is unfailingly polite to the dead.', 'Cannot pass a door without knocking twice.', 'Keeps a diary addressed to a god who never writes back.', 'Hums when lying.', 'Eats only things that are round.', 'Believes they are being followed by a specific crow.', 'Quotes proverbs that do not exist.', 'Laughs at funerals, cries at weddings.'];
const IDEALS = ['Curiosity: the forbidden door is the one worth opening.', 'Mercy: everyone gets one second chance. Some get three.', 'Freedom: chains are meant to be broken, especially metaphorical ones.', 'Knowledge: the library is the only temple.', 'Chaos: the dice decide, and the dice are always right.', 'Duty: a promise to a stranger is still a promise.', 'Beauty: even a dungeon deserves a nice tablecloth.'];
const BONDS = ['Owes a large debt to a talking frog.', 'Searching for the sibling who sold their shadow.', 'Carries the last letter of a dead friend, unopened.', 'Protects a village that does not know it exists.', 'Swore vengeance on a minor noble for a stolen hat.', 'Is the only one who remembers a forgotten god.'];
const FLAWS = ['Cannot resist a riddle, even mid-battle.', 'Trusts anyone who offers soup.', 'Panics around mirrors.', 'Spends all gold on maps of places that might not exist.', 'Insults dragons by accident.', 'Is certain they are the chosen one. They are not.'];

const mod = (v) => Math.floor((v - 10) / 2);
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

export function rollCharacter(rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const d6 = () => 1 + Math.floor(rnd() * 6);
  const race = pick(RACES), cls = pick(CLASSES), [bg, bgSkills] = pick(BACKGROUNDS);
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
  const name = `${pick(race.syl.slice(0, 7))}${pick(race.syl.slice(7))}`;
  const ch = {
    name: race.n === 'Tiefling' && rnd() < 0.5 ? pick(VIRTUE) : name, race, cls, bg, align: pick(ALIGN), level: 1, prof: 2,
    score, base, rollOf, m, skills: [...skills],
    hp: cls.hd + m.CON + (race.hp || 0), ac: ac + (cls.shield ? 2 : 0), init: m.DEX, speed: race.speed,
    passive: 10 + m.WIS + (skills.has('Perception') ? 2 : 0),
    trait: pick(TRAITS), ideal: pick(IDEALS), bond: pick(BONDS), flaw: pick(FLAWS),
    age: Math.floor({ 'Hill Dwarf': 60, 'High Elf': 120, 'Rock Gnome': 70 }[race.n] || 18 + rnd() * 30) + Math.floor(rnd() * 40), seed: Math.floor(rnd() * 1e9)
  };
  if (cls.cast) {
    ch.cantrips = [...cls.cantrips].sort(() => rnd() - 0.5).slice(0, cls.nc);
    ch.spells = [...cls.spells].sort(() => rnd() - 0.5).slice(0, cls.ns);
    ch.dc = 8 + 2 + m[cls.cast]; ch.atk = 2 + m[cls.cast];
  }
  ch.sprite = humanoid(ch.seed, cls.hue, {});
  return ch;
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
    el('p', `Trait: ${ch.trait} Ideal: ${ch.ideal} Bond: ${ch.bond} Flaw: ${ch.flaw}`)
  );
}
export function sheetText(ch) {
  return `${ch.name} — ${ch.race.n} ${ch.cls.n} 1\n${ch.bg} · ${ch.align}\n\n${AB.map((a) => `${a} ${ch.score[a]} (${sign(ch.m[a])})`).join('  ')}\nHP ${ch.hp}  AC ${ch.ac}  Init ${sign(ch.init)}  Speed ${ch.speed}\nSkills: ${ch.skills.join(', ')}\nFeatures: ${[...ch.cls.feats, ...ch.race.traits].join(', ')}\n${ch.cantrips ? `Cantrips: ${ch.cantrips.join(', ')}\nSpells: ${ch.spells.join(', ')}\n` : ''}Equipment: ${ch.cls.gear.join(', ')}\nTrait: ${ch.trait}\nIdeal: ${ch.ideal}\nBond: ${ch.bond}\nFlaw: ${ch.flaw}\n`;
}
// portrait and ability boxes on the canvas
export function drawCharacter(c, ch, t, pal, W, H) {
  const k = Math.min(1, t / 0.8);
  c.save(); c.imageSmoothingEnabled = false;
  const fr = Math.floor(t * 2) % 2 ? ch.sprite.idle : ch.sprite.walk[0];
  c.globalAlpha = k; c.drawImage(fr, 30, 40 + (1 - k) * 30, 120, 160); c.globalAlpha = 1;
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
