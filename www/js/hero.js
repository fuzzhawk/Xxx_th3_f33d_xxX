// The player's own character, made in the Studio's character creator. When one is
// saved, games that have a hero use it instead of the theme's.
import { humanoid } from './games/creature.js';

const KEY = 'feed-hero';
export function getHero() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function setHero(h) { try { if (h) localStorage.setItem(KEY, JSON.stringify(h)); else localStorage.removeItem(KEY); } catch { /* private mode */ } }
export const heroSheet = (h = getHero()) => (h ? humanoid(h.seed, h.hue, { look: h.look }) : null);
