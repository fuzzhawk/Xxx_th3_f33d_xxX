// The player's own character, made in the Studio's character creator. When one is
// saved, games that have a hero use it instead of the theme's.
import { humanoid } from './games/creature.js';

const KEY = 'feed-hero';
export function getHero() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function setHero(h) { try { if (h) localStorage.setItem(KEY, JSON.stringify(h)); else localStorage.removeItem(KEY); } catch { /* private mode */ } }
// heroes saved before the MARROW creator have no `marrow` look; they get a fresh MARROW body from their seed
export const heroSheet = (h = getHero()) => (h ? humanoid(h.seed, 0, { marrow: h.marrow || { preset: 'Average adult' } }) : null);
