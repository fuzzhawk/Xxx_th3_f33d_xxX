// Erotica for Long reads: public-domain works on Project Gutenberg, resolved with Gutendex at
// build time, from Sappho and the Song of Songs to the modern classics that have come into the
// public domain (Lady Chatterley's Lover), with whole bawdy tales from the story collections.
// Adult and explicit where the books are, but never minors, incest or non-consent:
//   picks  hand-chosen passages. `at` is the opening words (a list tries each), `n` the
//          paragraphs to take, or for verse `to` the closing words (+`plus` lines);
//          `verses: [c1, v1, c2, v2]` takes a chapter:verse range. A pick whose words are
//          not found is skipped, never guessed.
//   auto   random excerpts, only from the given span of the text and only if they pass
//          the bans below; of the candidates the most sensual are kept (`min` distinct sensual
//          words at least). `light: true` on a work uses the light ban instead of the soft one:
//          it still keeps out youth, family, captivity and violence, but lets tears, fear and sleep in.
//   tales  whole stories from a collection (the sections between its headings), 1,500–16,000
//          characters, the most sensual first; every word of a tale must pass the hard ban and
//          the tale ban (no girls, maids, virgins, lads, children or daughters in it at all).
// `ids` are known Gutenberg ebook numbers (tried first when Gutendex lists them, and as
// a fallback when Gutendex is unreachable; the text's Title: line must still match).
export const eroticaWorks = [
  { key: 'venus', search: 'venus in furs', title: /venus in furs/i, ids: [6852], book: 'Venus in Furs', by: 'Leopold von Sacher-Masoch', year: 1870, kind: 'novel',
    picks: [
      { at: 'My company was charming', n: 8, title: 'Venus by the fireplace' },
      { at: 'It is full moon. It is already peering over', n: 9, title: 'The statue in the moonlight' },
      { at: 'A sultry morning, the atmosphere is dead', n: 9, title: 'The widow in white' },
      { at: 'The rain beat in melancholy fashion on the window-panes', n: 6, title: 'A poem at her feet' },
      { at: 'After a short but severe shower we went out together', n: 6, title: 'Could you love me?' }
    ] },
  { key: 'decameron', search: 'decameron', title: /decameron/i, ids: [23700], book: 'The Decameron', by: 'Giovanni Boccaccio', year: 1353, kind: 'novel',
    picks: [
      { at: 'However, the saint had not lost sight of him', n: 5, title: 'Rinaldo d’Asti and the widow' },
      { at: 'There was, then, aforetime, in the city of Prato', n: 5, title: 'Madam Filippa before the judge', allow: /handsome youth/i },
      { at: 'Tancred, Lord of Salerno, was a humane prince', n: 4, title: 'Ghismonda and Guiscardo' }
    ] },
  { key: 'catullus', search: 'catullus', title: /catullus/i, ids: [20732], book: 'Carmina (tr. Burton & Smithers)', by: 'Catullus', year: 'c. 60 BC', kind: 'poem',
    picks: [
      { at: 'Love we (my Lesbia!) and live we our day', to: 'kisses have been kissed between us', title: 'Let us live, my Lesbia (V)' },
      { at: 'Thou ask’st How many kissing bouts I bore', to: 'evil tongue avail', title: 'How many kisses (VII)' },
      { at: 'Peer of a God meseemeth he', to: 'Mine eyes with night', title: 'Peer of a god (LI)' },
      { at: 'Sparrow! my pet’s delicious joy', to: 'loosed for aye', title: 'Lesbia’s sparrow (II)' },
      { at: 'An to one ever accrue any boon he lusted and longed for', to: 'more coveted lot', title: 'To Lesbia, reconciled (CVII)' }
    ] },
  { key: 'song', search: 'song of solomon', title: /song of (?:solomon|songs)|king james/i, ids: [8022, 10], book: 'The Song of Songs', by: 'King James Version', kind: 'poem', at: 'Let him kiss me with the kisses of his mouth',
    picks: [
      { verses: [1, 1, 1, 17], title: 'Let him kiss me', allow: /mother’s children|mother's children/i },
      { verses: [2, 1, 2, 17], title: 'I am the rose of Sharon' },
      { verses: [4, 1, 4, 7], title: 'Behold, thou art fair' },
      { verses: [5, 10, 5, 16], title: 'My beloved is white and ruddy' },
      { verses: [7, 1, 7, 13], title: 'How beautiful are thy feet' }
    ] },
  { key: 'whitman', search: 'leaves of grass whitman', title: /leaves of grass/i, author: /whitman/i, ids: [1322], book: 'Leaves of Grass · Children of Adam', by: 'Walt Whitman', year: 1860, kind: 'poem',
    picks: [
      { at: 'Out of the rolling ocean the crowd', to: 'for your dear sake my love', title: 'Out of the Rolling Ocean the Crowd' },
      { at: 'We two, how long we were fool’d', to: 'all but our own joy', title: 'We Two, How Long We Were Fool’d' },
      { at: 'Ages and ages returning at intervals', to: 'Offspring of my loins', title: 'Ages and Ages Returning at Intervals' },
      { at: 'O hymen! O hymenee! why do you tantalize me', to: 'soon certainly kill me', title: 'O Hymen! O Hymenee!' },
      { at: 'Once I pass’d through a populous city', to: 'silent lips sad and tremulous', title: 'Once I Pass’d Through a Populous City' },
      { at: 'As Adam early in the morning', to: 'Be not afraid of my body', title: 'As Adam Early in the Morning' }
    ] },
  { key: 'swinburne', search: 'swinburne poems ballads', title: /poems (?:and|&) ballads|laus veneris/i, author: /swinburne/i, ids: [35402], book: 'Poems and Ballads', by: 'Algernon Charles Swinburne', year: 1866, kind: 'poem', multi: 3,
    picks: [
      { at: 'If love were what the rose is', to: 'find his mouth a rein', plus: 2, title: 'A Match' },
      { at: 'Lying asleep between the strokes of night', to: 'eyelids of my soul’s desire', title: 'Love and Sleep' },
      { at: 'All the night sleep came not upon my eyelids', to: 'trumpets of the night', title: 'Sapphics' }
    ],
    auto: { count: 2, span: [0.05, 1] } },
  { key: 'kamasutra', search: 'kama sutra', title: /kama ?sutra/i, ids: [27827], book: 'The Kama Sutra (tr. Burton)', by: 'Vatsyayana', year: 1883, kind: 'novel',
    picks: [
      { at: 'In the pleasure-room, decorated with flowers', to: 'or Great Bear', n: 6, title: 'In the pleasure-room' },
      { at: 'there is no fixed time or order between the embrace', n: 2, title: 'On kissing' },
      { at: 'a bed, soft, agreeable to the sight', n: 2, title: 'The house of a citizen' }
    ] },
  { key: 'fannyhill', search: 'fanny hill cleland', title: /fanny hill|woman of pleasure/i, author: /cleland/i, ids: [25305], book: 'Fanny Hill', by: 'John Cleland', year: 1748, kind: 'novel',
    // the narrator is a girl for most of the book: only the adult frame of the letters is used
    picks: [
      { at: 'I sit down to give you an undeniable proof', n: 2, title: 'Truth, stark naked truth' },
      { at: 'I got snug into port', n: 3, title: 'A tail-piece of morality' }
    ] },
  { key: 'perfumed', search: 'perfumed garden', title: /perfumed garden/i, book: 'The Perfumed Garden (tr. Burton)', by: 'Sheikh Nefzaoui', year: 1886, kind: 'novel',
    picks: [{ at: 'that there are women of all sorts', n: 2, title: 'Concerning praiseworthy women' }] },
  { key: 'nights', search: 'thousand nights', title: /thousand nights|arabian nights/i, ids: [51252], book: 'The Arabian Nights', by: 'Anonymous', kind: 'novel', multi: 4,
    picks: [{ at: ['there was a Porter in Baghdad', 'in the city of Baghdad a porter', 'a porter in the city of Baghdad'], n: 6, title: 'The porter and the ladies of Baghdad' }] },
  { key: 'ovid', search: 'ovid art of love', title: /art of love|amores|amours|love books/i, author: /ovid/i, ids: [31036], book: 'The Art of Love', by: 'Ovid', year: 'c. 2 AD', kind: 'poem', multi: 2,
    auto: { count: 2, span: [0.15, 1] } },
  { key: 'sappho', search: 'sappho', title: /sappho/i, ids: [42166], book: 'Sappho', by: 'Sappho', year: 'c. 600 BC', kind: 'poem', multi: 2,
    auto: { count: 3, span: [0.05, 1] } },
  // the modern classics, now in the public domain in the US
  { key: 'chatterley', search: 'lady chatterley', title: /lady chatterley/i, author: /lawrence/i, ids: [73144], book: 'Lady Chatterley’s Lover', by: 'D. H. Lawrence', year: 1928, kind: 'novel', light: true,
    auto: { count: 7, span: [0.2, 0.98], min: 6 } },
  { key: 'womeninlove', search: 'women in love', title: /women in love/i, author: /lawrence/i, ids: [4240], book: 'Women in Love', by: 'D. H. Lawrence', year: 1920, kind: 'novel', light: true,
    auto: { count: 2, span: [0.15, 0.95], min: 6 } },
  { key: 'teleny', search: 'teleny', title: /teleny/i, book: 'Teleny', by: 'attributed to Oscar Wilde and friends', year: 1893, kind: 'novel', light: true,
    auto: { count: 4, span: [0.08, 0.95], min: 5 } },
  { key: 'aphrodite', search: 'aphrodite louys', title: /aphrodite/i, author: /lou[yÿ]s/i, book: 'Aphrodite', by: 'Pierre Louÿs', year: 1896, kind: 'novel',
    auto: { count: 3, span: [0.05, 0.9], min: 5 } },
  { key: 'lysistrata', search: 'lysistrata', title: /lysistrata/i, ids: [7700], book: 'Lysistrata', by: 'Aristophanes', year: '411 BC', kind: 'novel', light: true,
    auto: { count: 2, span: [0.4, 0.9], prose: true, min: 4 } },
  { key: 'venusadonis', search: 'venus and adonis', title: /venus and adonis/i, ids: [1045], book: 'Venus and Adonis', by: 'William Shakespeare', year: 1593, kind: 'poem', light: true,
    auto: { count: 3, span: [0.05, 1], min: 5 } },
  { key: 'donne', search: 'donne poems', title: /donne/i, author: /donne/i, book: 'Poems', by: 'John Donne', year: 'c. 1595', kind: 'poem', multi: 3, light: true,
    picks: [{ at: 'Come, Madam, come, all rest my powers defy', to: 'more covering than a man', title: 'To His Mistress Going to Bed' }],
    auto: { count: 2, span: [0.05, 1], min: 5 } },
  { key: 'baudelaire', search: 'flowers of evil baudelaire', title: /flowers of evil|fleurs du mal/i, author: /baudelaire/i, book: 'The Flowers of Evil', by: 'Charles Baudelaire', year: 1857, kind: 'poem', multi: 3, light: true,
    auto: { count: 3, span: [0.05, 1], min: 5 } },
  { key: 'rochester', search: 'rochester poems', title: /rochester|poems/i, author: /wilmot|rochester/i, book: 'Poems', by: 'John Wilmot, Earl of Rochester', year: 'c. 1675', kind: 'poem', multi: 2, light: true,
    auto: { count: 2, span: [0.05, 1], min: 5 } },
  // whole bawdy tales from the story collections
  { key: 'decameron-tales', search: 'decameron', title: /decameron/i, ids: [23700], book: 'The Decameron', by: 'Giovanni Boccaccio', year: 1353, kind: 'novel', multi: 2,
    tales: { count: 6 } },
  { key: 'heptameron', search: 'heptameron', title: /heptameron/i, book: 'The Heptameron', by: 'Marguerite de Navarre', year: 1558, kind: 'novel', multi: 5,
    tales: { count: 4 } },
  { key: 'droll', search: 'droll stories balzac', title: /droll stories/i, author: /balzac/i, book: 'Droll Stories', by: 'Honoré de Balzac', year: 1837, kind: 'novel', multi: 3,
    tales: { count: 4 } },
  { key: 'lafontaine', search: 'la fontaine tales novels', title: /tales|contes/i, author: /fontaine/i, book: 'Tales and Novels in Verse', by: 'Jean de La Fontaine', year: 1665, kind: 'poem', multi: 3,
    tales: { count: 3, verse: true } },
  // the songs of Bilitis' girlhood come first; only the courtesan years and the tombs at the end
  { key: 'bilitis', search: 'songs of bilitis', title: /bilitis/i, ids: [76646], book: 'The Songs of Bilitis', by: 'Pierre Louÿs', year: 1894, kind: 'novel',
    auto: { count: 2, span: [0.88, 1], prose: true } }
];

// Always applied, even to hand-picked passages: minors, incest, non-consent, animals.
export const eroticaHardBan = /\b(?:bestial\w*|zoophil\w*|incest\w*|rap(?:e|ed|es|ing)|ravish\w*|violat(?:e|ed|ion)|defil\w*|deflower\w*|against (?:her|his|my|their|your) will|by force|forcibl\w*|unwilling\w*|overpower\w*|helpless\w*|unconscious|drugged|child|children|childhood|infants?|school-?girls?|school-?boys?|puberty|pubescent|nubile|under-?age|striplings?|lads?|lass(?:es)?|little (?:girls?|boys?)|young (?:girls?|boys?)|tender (?:age|years)|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth)\b/i;
// Also applied to random (auto) excerpts: anything that could hint at youth, family,
// coercion, captivity, sleep or pain is skipped.
export const eroticaSoftBan = /\b(?:girls?|boys?|maids?|maiden\w*|virgin\w*|innocen\w*|youths?|young\w*|daughters?|sisters?|brothers?|mothers?|fathers?|sons?|aunts?|uncles?|nieces?|nephews?|cousins?|step\w+|nuns?|novices?|slaves?|slavery|captives?|prisoners?|asleep|sleep\w*|slumber\w*|drunk\w*|intoxicat\w*|tears?|weep\w*|wept|cr(?:y|ied|ies|ying)|scream\w*|shriek\w*|pain\w*|hurt\w*|blood\w*|bleed\w*|wound\w*|whip\w*|lash\w*|rods?|birch\w*|flog\w*|scourg\w*|beat\w*|struck|strik\w*|bound|bind\w*|tied|chain\w*|ropes?|seiz\w*|snatch\w*|terror\w*|afraid|fear\w*|trembl\w*|shame\w*|disgrace\w*|beasts?|animals?|dogs?|horses?|eunuchs?|corpses?|dead|death|kill\w*|murder\w*|struggl\w*|resist\w*|refus\w*|protest\w*|striv\w*|strove|yield\w*|reluct\w*|den(?:y|ied|ies)|chaste|chastity|coy|modest\w*|flee|fled|pursu\w*|chas(?:e|ed|es|ing)|caught|sabines?)\b/i;
// The light ban (works marked `light`): youth, family, captivity, violence and animals, but not feelings.
export const eroticaLightBan = /\b(?:girls?|boys?|maids?|maiden\w*|virgin\w*|daughters?|sisters?|brothers?|mothers?|fathers?|sons?|aunts?|uncles?|nieces?|nephews?|cousins?|step\w+|nuns?|novices?|slaves?|slavery|captives?|prisoners?|asleep|drunk\w*|intoxicat\w*|scream\w*|shriek\w*|blood\w*|bleed\w*|wound\w*|whip\w*|lash\w*|flog\w*|scourg\w*|beat\w*|struck|bound|tied|chain\w*|seiz\w*|struggl\w*|resist\w*|refus\w*|beasts?|animals?|dogs?|horses?|eunuchs?|corpses?|dead|kill\w*|murder\w*)\b/i;
// A whole tale must not mention any of these anywhere.
export const eroticaTaleBan = /\b(?:girls?|maids?|maiden\w*|damsels?|virgin\w*|lads?|lass\w*|boys?|daughters?|novices?|wenches?|beasts?|animals?|dogs?|ass(?:es)?|goats?|rap(?:e|ed|es|ing)|ravish\w*|forc(?:e|ed|ibly))\b/i;
// An auto excerpt needs at least four of these (distinct) to count as sensual.
export const eroticaSensual = /\b(?:voluptu\w*|lust\w*|carnal|amorous|ecsta\w*|swoon\w*|quiver\w*|throb\w*|undress\w*|unclothed|nipples?|loins|hips?|belly|moan\w*|penis|phall\w*|orgasm\w*|aroused|naked\w*|nakedness|limbs|wanton\w*|seduc\w*|lover|lovers|caress\w*|kiss\w*|lips?|mouth|breasts?|bosom|embrac\w*|naked|nude|desir\w*|passion\w*|caress\w*|tender\w*|limbs?|thighs?|skin|perfum\w*|fragran\w*|beds?|couch|lov\w*|beloved|delight\w*|sweet\w*|warm\w*|flesh|bod(?:y|ies)|honey|wine|roses?|arms|hair|touch\w*|pleasure\w*|longing|ardou?r|rapture|blush\w*|sighs?|soft\w*|bath\w*)\b/gi;
