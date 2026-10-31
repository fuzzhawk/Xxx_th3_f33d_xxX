import { Platformer } from './platformer.js';
import { Racer } from './racer.js';
import { Rocks } from './rocks.js';
import { HellMaze } from './hellmaze.js';
import { Outland } from './outland.js';
import { Sling } from './sling.js';
import { Chess, Dice, Cards } from './board.js';
import { Monsters } from './battle.js';
import { Fighter } from './brawl.js';
import { Flight } from './flight.js';
import { Ski } from './ski.js';
import { Robotron } from './robotron.js';
import { Crokinole } from './crokinole.js';
import { Survivors } from './survivors.js';
import { Graves } from './graves.js';
import { Expedition } from './expedition.js';
import { Wordle, Bee, WordSearch, Wheel, Hangman, Vocab, Ladder } from './wordgames.js';
import { Twenty48, Arrows } from './puzzles.js';
import { Jrpg } from './jrpg.js';
import { Hack } from './hack.js';
import { Plinko } from './plinko.js';
import { Breakout } from './breakout.js';
import { Merge } from './merge.js';
import { Dash } from './dash.js';
import { Flap } from './flap.js';
import { Tetris } from './tetris.js';
import { Pong } from './pong.js';
import { PegShot } from './peggle.js';
import { Juggle } from './juggle.js';

export const GAMES = { plinko: Plinko, breakout: Breakout, merge: Merge, dash: Dash, flappy: Flap, tetris: Tetris, pong: Pong, peggle: PegShot, juggle: Juggle, platformer: Platformer, racer: Racer, raycast: HellMaze, rocks: Rocks, sling: Sling,
  chess: Chess, dice: Dice, cards: Cards, monsters: Monsters, fighter: Fighter,
  starfox: Flight, ski: Ski, robotron: Robotron, crokinole: Crokinole, survivors: Survivors, graves: Graves, expedition: Expedition,
  wordle: Wordle, bee: Bee, wordsearch: WordSearch, wheel: Wheel, hangman: Hangman, vocab: Vocab, ladder: Ladder, t2048: Twenty48, arrows: Arrows, jrpg: Jrpg, hack: Hack, outland: Outland };
// display names (the package's own names win when it has them)
export const GAME_NAMES = {
  plinko: 'Plinko', breakout: 'Breakout', merge: 'Merge', dash: 'Dash', flappy: 'Flap', tetris: 'Tetris', pong: 'Pong', peggle: 'Peg Shot', juggle: 'Juggle',
  platformer: 'Platformer', racer: 'Road Racer', raycast: 'Hell Maze', rocks: 'Rocks', sling: 'Slingshot', outland: 'Outland',
  chess: 'Chess', dice: 'Yacht Dice', cards: 'Joker Hands', monsters: 'Monster Battle', fighter: 'Street Brawl',
  starfox: 'Sky Fox', expedition: 'Expeditions', ski: 'Downhill', graves: 'Grave Merge', survivors: 'Cave Horde', robotron: 'Robo Arena', crokinole: 'Crokinole',
  wordle: 'Five Letters', bee: 'Spelling Hive', wordsearch: 'Word Search', wheel: 'Letter Wheel', hangman: 'Hangman', vocab: 'Vocab Quiz', ladder: 'Word Ladder', t2048: '2048', arrows: 'Arrow Escape', jrpg: 'Crystal Quest', hack: 'Crypt Hack'
};
export const GAME_HINT = {
  plinko: 'tap to drop a ball', breakout: 'drag to move the paddle', merge: 'drag to aim, release to drop', dash: 'tap to jump (twice to double-jump)',
  flappy: 'tap to flap', tetris: 'tap left or right to move, tap the piece to rotate, swipe down to drop · lines of words become sayings', pong: 'drag to move your paddle', peggle: 'aim, release to shoot', juggle: 'tap the balls to keep them up',
  platformer: 'tap to jump, twice to double-jump, stomp enemies', racer: 'hold left or right to steer', raycast: 'drag sideways to turn, up/down to walk, tap to fire, tap the HUD to switch weapons',
  rocks: 'tap to shoot, hold to thrust toward your finger', sling: 'drag down and release to fire upward',
  chess: 'tap a white piece, then its destination', dice: 'roll, tap dice to hold, tap a row to score',
  cards: 'tap up to five cards, then play or discard', monsters: 'tap a move', fighter: '◀ ▶ walk (hold away to block) · ▲ jump · ▼ crouch for sweeps and uppercuts · P K S attack · land hits to chain combos, fill the meter for an ULTRA · on autopilot, bet on the fight',
  starfox: 'hold and drag to steer, lasers fire while you hold · fly through rings',
  ski: 'tap to jump, hold in the air to backflip, land along the slope',
  robotron: 'left thumb moves, right thumb shoots (one thumb auto-aims) · rescue the humans',
  crokinole: 'touch near the bottom arc to place, drag back and release to flick · hit their discs or lose yours',
  survivors: 'drag anywhere to walk · weapons fire by themselves · tap an upgrade on level up',
  graves: 'tap a grave to raise, drag two alike together to merge, drag or tap to fill orders',
  expedition: 'tap to walk, tap people and things to interact · finish the mission',
  wordle: 'type a five-letter word, six tries', bee: 'tap letters to make words with the centre letter', wordsearch: 'drag across letters to circle a word',
  wheel: 'drag through the letters to spell words', hangman: 'tap letters; the clue is the definition', vocab: 'tap the right meaning before time runs out', ladder: 'change one letter at a time to reach the target word',
  t2048: 'swipe to slide the tiles; matching numbers merge', arrows: 'tap an arrow to send it flying; if something is in its way you lose a heart',
  jrpg: 'tap a tile to walk · tap commands, then a monster, to fight',
  hack: 'tap the floor to walk · tap a monster to attack · FIRE casts · flasks drink potions',
  outland: 'left thumb moves, drag elsewhere to look · ● fires, ◎ scopes, ✸ throws a grenade, ⇄ swaps · DRIVE takes the buggy · destroy the relay towers'
};
