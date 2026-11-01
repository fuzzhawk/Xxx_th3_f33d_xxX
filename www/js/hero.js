// The player's own character, made in the Studio's character creator or saved from a D&D roll. When one is saved,
// games that have a hero use it instead of the theme's. A hero is { name, seed, persona, dnd, crystal, marrow }:
// the persona is the one description both styles are dressed from; crystal and marrow are kept alongside for the
// games that read them directly. Heroes saved before personas ({ name, seed, crystal, marrow }) still load.
import { humanoid } from './games/creature.js';
import { crystalSheet } from './crystal/sprites.js';
import { normPersona, personaFor, personaToCrystal, personaToMarrow } from './persona.js';

const KEY = 'feed-hero';
// fill in what older saves lack
export function upgradeHero(h) {
  if (!h || typeof h !== 'object') return null;
  const seed = (h.seed >>> 0) || 1;
  const persona = h.persona ? normPersona(h.persona, seed) : h.crystal ? normPersona(h.crystal, seed) : personaFor(seed, 'Fantasy');
  return { ...h, name: h.name || 'Nameless One', seed, persona, dnd: h.dnd || null, crystal: h.crystal || personaToCrystal(persona), marrow: h.marrow || personaToMarrow(persona) };
}
export function getHero() { try { return upgradeHero(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return null; } }
export function setHero(h) { try { if (h) localStorage.setItem(KEY, JSON.stringify(h)); else localStorage.removeItem(KEY); } catch { /* private mode */ } }
// a hero from a persona (and optionally a D&D sheet): both styles are derived from it
export function makeHero(name, persona, dnd = null) {
  const p = normPersona(persona);
  return { name: name || 'Nameless One', seed: p.seed, persona: p, dnd, crystal: personaToCrystal(p), marrow: personaToMarrow(p) };
}
// the hero as a MARROW sheet (the generic one most games' hero slots use)
export const heroSheet = (h = getHero()) => (h ? humanoid(h.seed, 0, { marrow: h.marrow || personaToMarrow(h.persona) }) : null);
// The hero as a Crystal sprite sheet (the style most games use).
export function heroCrystal(h = getHero(), dirs) {
  if (!h) return null;
  return crystalSheet(h.seed, { char: h.crystal || personaToCrystal(h.persona), dirs });
}
