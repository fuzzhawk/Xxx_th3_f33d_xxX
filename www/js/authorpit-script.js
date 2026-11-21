// The Author Pit's script: fourteen writers summoned to a sunken garden to make one thing together.
// They argue about what it should be, quarrel in pairs, find the shape of it, write it a door at a
// time, and sit by the fire after. Their lines are written for this, in the spirit of each writer's
// ideas (a few words of theirs at most); none of it is quoted from their books.
//
// A line is one of:
//   'KEY: words {emote}'      a line of dialogue (the emote is optional: wave cheer nod shake laugh
//                             surprise sad think angry love)
//   '> KEY KEY … spot'        those writers walk to a spot (spots are in authorpit.js)
//   '# Title'                 a new act: its banner, and the light changes (dusk, gold, evening, lamp, night)
//   '! DOOR n KEY: words'     a door of the book written: shown on the manuscript
//   '~ text'                  a stage note shown in italics (a silence, the title appearing)

export const AUTHORS = {
  RAW: { name: 'Robert Anton Wilson', short: 'Wilson', col: '#c070e0', home: 'board', char: { hair: 'short', hairColor: 'Silver', beard: 'long', head: 'none', top: 'jacket', topColor: 'Plum', trimColor: 'Saffron', bot: 'pants', botColor: 'Denim', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  WSB: { name: 'William S. Burroughs', short: 'Burroughs', col: '#a0a8b0', home: 'cutup', char: { hair: 'short', hairColor: 'Silver', head: 'fedora', headColor: 'Coal', top: 'suit', topColor: 'Steel', trimColor: 'Coal', bot: 'pants', botColor: 'Coal', feet: 'shoes', feetColor: 'Coal', skin: 'Porcelain' } },
  HPL: { name: 'H. P. Lovecraft', short: 'Lovecraft', col: '#6ab0a0', home: 'crypt', char: { hair: 'short', hairColor: 'Ink', head: 'none', top: 'suit', topColor: 'Navy', trimColor: 'Coal', bot: 'pants', botColor: 'Navy', feet: 'shoes', feetColor: 'Coal', skin: 'Porcelain' } },
  CW: { name: 'Colin Wilson', short: 'C. Wilson', col: '#e0b050', home: 'river', char: { hair: 'short', hairColor: 'Chestnut', head: 'none', top: 'longsleeve', topColor: 'Forest', bot: 'pants', botColor: 'Khaki', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  UKL: { name: 'Ursula K. Le Guin', short: 'Le Guin', col: '#70c0e8', home: 'cafe', char: { hair: 'bob', hairColor: 'Silver', head: 'none', top: 'longsleeve', topColor: 'Teal', bot: 'pants', botColor: 'Linen', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  OEB: { name: 'Octavia E. Butler', short: 'Butler', col: '#f08a5a', home: 'crypt', char: { hair: 'buzz', hairColor: 'Ink', head: 'none', top: 'jacket', topColor: 'Denim', trimColor: 'Coal', bot: 'pants', botColor: 'Coal', feet: 'boots', feetColor: 'Leather', skin: 'Umber' } },
  JPS: { name: 'Jean-Paul Sartre', short: 'Sartre', col: '#d0d0d8', home: 'cafe', char: { hair: 'short', hairColor: 'Ink', head: 'none', top: 'suit', topColor: 'Coal', trimColor: 'White', bot: 'pants', botColor: 'Coal', feet: 'shoes', feetColor: 'Coal', skin: 'Fair' } },
  WR: { name: 'Wilhelm Reich', short: 'Reich', col: '#8ad8ff', home: 'orgone', char: { hair: 'short', hairColor: 'Snow', head: 'none', top: 'coat', topColor: 'White', trimColor: 'Steel', bot: 'pants', botColor: 'Steel', feet: 'shoes', feetColor: 'Coal', skin: 'Fair' } },
  JJ: { name: 'James Joyce', short: 'Joyce', col: '#9ae07a', home: 'cutup', char: { hair: 'short', hairColor: 'Ink', head: 'fedora', headColor: 'Linen', top: 'suit', topColor: 'Linen', trimColor: 'Coal', bot: 'pants', botColor: 'Linen', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  JRRT: { name: 'J. R. R. Tolkien', short: 'Tolkien', col: '#c8a060', home: 'tree', char: { hair: 'short', hairColor: 'Silver', head: 'none', top: 'jacket', topColor: 'Leather', trimColor: 'Khaki', bot: 'pants', botColor: 'Khaki', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  FN: { name: 'Friedrich Nietzsche', short: 'Nietzsche', col: '#e05a4a', home: 'tree', char: { hair: 'short', hairColor: 'Chestnut', beard: 'short', head: 'none', top: 'coat', topColor: 'Coal', trimColor: 'Steel', bot: 'pants', botColor: 'Coal', feet: 'boots', feetColor: 'Coal', skin: 'Fair' } },
  HH: { name: 'Hermann Hesse', short: 'Hesse', col: '#f0e08a', home: 'river', char: { hair: 'buzz', hairColor: 'Silver', head: 'none', top: 'longsleeve', topColor: 'Linen', bot: 'pants', botColor: 'Khaki', feet: 'shoes', feetColor: 'Leather', skin: 'Bronze' } },
  PKD: { name: 'Philip K. Dick', short: 'Dick', col: '#ff7ad0', home: 'orgone', char: { hair: 'short', hairColor: 'Chestnut', beard: 'short', head: 'none', top: 'jacket', topColor: 'Denim', trimColor: 'Coal', bot: 'pants', botColor: 'Denim', feet: 'shoes', feetColor: 'Leather', skin: 'Fair' } },
  MA: { name: 'Margaret Atwood', short: 'Atwood', col: '#ff9a9a', home: 'board', char: { hair: 'afro', hairColor: 'Silver', head: 'none', top: 'coat', topColor: 'Scarlet', trimColor: 'Coal', bot: 'pants', botColor: 'Coal', feet: 'boots', feetColor: 'Coal', skin: 'Porcelain' } }
};

export const SCRIPT = `
# I · The Summons
> ALL table
HH: The garden brought us here. Each of us got the same invitation, folded into a dream. {think}
RAW: Mine came in the mail. Postmarked the twenty-third. Of course it did. {laugh}
WSB: Twenty-three. You've caught my disease, Bob.
RAW: You gave it to half the planet, Bill. I just kept the notebook.
HPL: I confess I do not care for invitations from places that appear on no map. {sad}
JRRT: Every place is on some map, Mr. Lovecraft. The question is who drew it.
UKL: There's a book on the table. Blank. And a note tucked in the cover. {surprise}
MA: Let me. It says: "Make one thing. Together. Before the ink dries."
JPS: An order with no author. How very modern.
FN: Every command is a mask over a will. Someone wants this. {angry}
OEB: Or nobody does, and we're being asked to grow something nobody planted.
PKD: Or we're already characters in it, and the blank book is the only honest thing in the room.
CW: Good. I've waited my whole life for an emergency worth waking up for. {cheer}
WR: Feel the air? Charged. Fourteen nervous systems in one hollow in the earth.
JJ: Fourteen voices and a blank page. That's not a book. That's a river looking for its bed.
# II · What Shall It Be?
MA: So what are we making? A novel? I'd want a plot. Plots are where the consequences live.
WSB: Plots are control machines. Cut the lines and see what leaks out. {shake}
JRRT: A world, then. Not a plot: a world, with roots deep enough to bear a story's weight.
FN: A manifesto. Break the old tablets. Carve the new ones. {angry}
JPS: A manifesto is a declaration of freedom that becomes a prison the moment it's printed.
UKL: Not a spear at all. A carrier bag. Something that holds things: seeds, stories, a good stone.
HH: A game, perhaps. Every science a note, every art a note, and the notes making one music. {think}
HPL: Whatever it is, it must admit there is more outside it than in it.
OEB: It has to be useful. Something people can carry when things fall apart.
PKD: It has to be able to tell when it's being lied to. Even by us. Especially by us.
RAW: Can it be all of those? I vote yes, no and maybe, in that order. {laugh}
CW: A book that wakes its reader up. Everything else is decoration.
WR: A book with a pulse. I'll know if it's dead. {nod}
JJ: Then let it start in the middle of a sentence and end in the middle of the same one.
HH: Let us think apart for a while, and argue in pairs. Ideas come walking.
> JPS UKL cafe
> HPL OEB crypt
> WSB JJ cutup
> JRRT FN tree
> WR PKD orgone
> CW HH river
> MA RAW board
# III · Quarrels in Pairs
JPS: Le Guin. Your best world has no God and no State. Then who carries the weight of choosing?
UKL: Everyone, every day. That's the weight. Heavier than a god, and kinder than a state.
JPS: Kinder? Freedom is a sentence. We are condemned to it. {shake}
UKL: Condemned is a prison word. Try "entrusted."
JPS: Entrusted... I'll have to smoke on that. {laugh}
HPL: The universe is vast, and it does not know we exist. That is where all true horror begins.
OEB: Or all true freedom. Nothing out there decided what I'm for.
HPL: The indifference does not frighten you? {surprise}
OEB: People who weren't indifferent to me frightened me plenty. The stars never bothered me.
HPL: I wrote a great deal about the dread of what is other. I begin to suspect the dread was mine. {sad}
OEB: Then put that in the book. A monster that turns out to be a mirror is worth a shelf of tentacles.
WSB: Snip. Snip. Language is a virus, James. I'm cutting the host open.
JJ: And I'm feeding it. Words should breed, pun with each other, have children with two meanings. {laugh}
WSB: You stitch, I slice. Same quilt.
JJ: A quilt! The book as a patchwork: a shroud and a wedding dress at once. Yes. {cheer}
FN: Your little people who stay at home. Where is the will to power in that?
JRRT: In giving it up. The bravest act in my story is a small person letting go of a ring.
FN: Renunciation as strength. That is either the deepest wisdom or the cleverest trick of the weak. {think}
JRRT: It's mercy. You'd have understood it on a long walk.
FN: I walked everywhere. The best thoughts come walking. Perhaps I will walk to your Shire.
WR: Sit in the box, Philip. Twenty minutes. Your energy is armoured: your shoulders are up at your ears.
PKD: The last time something beamed into me, it was a pink light full of information. {surprise}
WR: Exactly! The life energy, concentrated.
PKD: Or a satellite. Or God. Or my own mind sending a memo. I wrote thousands of pages deciding which.
WR: And?
PKD: All of them. None. The light was real. The explanation keeps changing. {think}
CW: Your Steppenwolf is the Outsider exactly. Sees too deep, too much, and suffers for it.
HH: Harry had to learn to laugh. The Immortals laugh. That is what your Outsider lacks. {laugh}
CW: Laughter, and Faculty X: the sense of other times and places, as real as this one.
HH: Siddhartha found it listening to a river. All its voices at once.
CW: Then the book should be a river. Joyce said so too. That makes two of us. {nod}
MA: I never put anything in a book that people hadn't already done somewhere.
RAW: That is the scariest sentence I've ever heard, Margaret. {surprise}
MA: It's meant to be. Warnings work best when they're true.
RAW: I put things in my books nobody had done yet. Then people started doing them.
MA: That's the other scary sentence.
RAW: Fnord. {laugh}
MA: Don't you start. {shake}
> ALL table
# IV · The Hinge
FN: We have talked in pairs, like lovers. Now talk like a crowd.
JPS: The question is simple. Is this book a description of the world, or an act upon it?
MA: Both. Every description is an act. Ask anyone who's been described.
WSB: The word is the act. That's why they want control of the words.
RAW: Every description is a reality tunnel. I propose we build one with a lot of exits.
UKL: Doors. A book of doors. {surprise}
HPL: Doors open both ways. Some of us have written about what comes through.
OEB: Then we write about how you live with what comes through. That's all my work is. Change.
JRRT: A map, then, with doors drawn on it, and a long road between each.
JJ: And every door a word that means two things.
PKD: And at least one door painted on the wall, to see who's paying attention. {laugh}
CW: And behind the last door, the reader, wide awake.
WR: And the whole of it breathing. Don't let it go stiff.
HH: Then it is decided. Not a novel, not a manifesto. A game of doors. {cheer}
RAW: I'll take that as a yes, a no and a maybe.
MA: Title?
~ A long silence. Fourteen people thinking at once.
JJ: Riverrun of Doors.
FN: Too pretty. {shake}
WSB: Cut it up. Doors. Run. River. Of. "Run River of Doors."
UKL: The Book of Doors. Plain, the way a bowl is plain.
OEB: The Book of Doors. And it changes every time you open it. Good. {nod}
~ The title rises out of the blank cover, in fourteen handwritings at once: THE BOOK OF DOORS.
# V · The Making
! DOOR 1 JRRT: The first door opens on a road longer than your courage. You take it anyway.
! DOOR 2 UKL: The second door is a bag. Put in it what you'll need: seeds, a story, someone's hand.
WSB: You've drawn us a road and given us luggage. Fine. Now somebody get lost.
! DOOR 3 OEB: The third door is change. You can't close it. You can learn to steer what comes through.
! DOOR 4 HPL: The fourth door opens on a dark too large for names. Look back: it was studying you.
WSB: Snip. {laugh}
HPL: You have cut my cosmos into confetti! {angry}
WSB: Now it can get out.
! DOOR 5 FN: The fifth door is this same door, again, forever. Walk through as if you'd choose it every time.
! DOOR 6 JPS: The sixth door has no handle on the far side. Whatever you become beyond it, you chose.
UKL: And whatever you become, you'll have help. Put that in the margin, Jean-Paul.
JPS: I'll put it in pencil. {laugh}
! DOOR 7 WSB: The seventh door is cut into strips and pasted back crooked. Read it any order. The control is gone.
! DOOR 8 JJ: The eighth door is a word with a river in it, saying yes and yes and yes.
WR: I'm putting the manuscript in the accumulator overnight. Let it charge.
JPS: A book cannot be charged, Wilhelm.
WR: Then why is it warm? {surprise}
! DOOR 9 HH: The ninth door is a game. Every science and every song a bead. Play until they ring together.
! DOOR 10 WR: The tenth door is a breath. Let your shoulders fall. The book is alive if you are.
PKD: Did anyone else notice the page numbers are changing? {surprise}
JJ: They're breeding. I told you they would.
UKL: Let them.
! DOOR 11 PKD: The eleventh door is painted on the wall. If you noticed, you're still free.
! DOOR 12 MA: The twelfth door was built by someone who says it's for your safety. Read the small print.
! DOOR 13 CW: The thirteenth door is Faculty X: this room, this hour, suddenly as real as it always was.
! DOOR 14 RAW: The fourteenth door is maybe. Every door is true in some tunnel. Pick the one with the view.
HH: Fourteen doors. And the last page?
OEB: Leave it blank. Whoever reads it writes the fifteenth.
~ Everyone writes it in the last line together: whoever reads this is the fifteenth author.
> ALL fire
# VI · By the Fire
CW: Tell me honestly. Did any of you feel it, just now, finishing it?
HH: The Immortals laughing. {laugh}
OEB: Something growing that none of us planted.
HPL: The cosmos, for once, did not feel indifferent. It felt curious. {think}
FN: I would do all of it again. Every hour of it. Even Bob's footnotes.
RAW: Especially my footnotes. {laugh}
JPS: We're responsible for it now. That is the price of having made something.
UKL: And the gift of it.
MA: Someone is going to ban it, you know.
WSB: Good. Then they'll read it.
JRRT: It will want appendices. Several. {nod}
PKD: It will want a sequel that contradicts it.
JJ: It wants nothing. It's already beginning again.
WR: Breathe, everybody. In. And out. {love}
~ The fire settles. Somewhere a page turns by itself.
RAW: Same time next eternity?
FN: Of course. That is the whole point. {cheer}
~ The ink is dry. The book begins again.
`;
