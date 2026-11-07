// Meme remix formats: caption templates, weights per format and images per format.
export const memeTemplates = [
  { style: 'impact', top: '{quoteA}', bottom: '{quoteB}' },
  { style: 'caption', text: 'me after learning that {fact}' },
  { style: 'caption', text: 'me explaining {title} to my cat at 3am' },
  { style: 'caption', text: 'nobody:\n{author}: "{quote}"' },
  { style: 'caption', text: 'when the {title} hits' },
  { style: 'caption', text: 'POV: you just discovered {title}' },
  { style: 'caption', text: 'my last two brain cells discussing {title}' },
  { style: 'caption', text: '2am thoughts: {fact}' },
  { style: 'caption', text: 'they don\'t teach you about {title} in school' },
  { style: 'caption', text: '"{quote}"\n— {author}, probably about this picture' },
  { style: 'caption', text: 'me pretending to understand {title}' },
  { style: 'caption', text: 'how it feels to read about {title} instead of sleeping' },
  { style: 'impact', top: 'nobody:', bottom: 'me: researching {title}' },
  { style: 'impact', top: 'one does not simply', bottom: 'stop reading about {title}' },
  { style: 'caption', text: 'my therapist: {title} isn\'t real, it can\'t hurt you\n{title}:' },
  { style: 'caption', text: 'local creature learns that {fact}' },
  { style: 'impact', top: '{author} said', bottom: '"{quote}"' },
  { style: 'caption', text: 'the group chat when I bring up {title} again' }
];

// Used only if Wikiquote is unreachable. Kept short and well attested.
export const memeText = {
  impact: [
    ['nobody:', 'me: researching {title}'], ['one does not simply', 'stop reading about {title}'], ['me at 3am', 'learning about {title}'],
    ['they said', '{title} wasn\'t real'], ['i don\'t always read wikipedia', 'but when i do it\'s about {title}'], ['what if i told you', '{fact}'],
    ['brace yourselves', '{title} discourse is coming'], ['is it just me', 'or is {title} kind of hot'], ['first rule of {title}', 'you do not talk about {title}'],
    ['sleep?', 'not when {title} exists'], ['y\'all ever just', '{title}'], ['me: i\'m normal', 'also me: {title}'], ['not sure if {title}', 'or just {title2}'],
    ['{title}', 'that\'s it. that\'s the meme.'], ['gets into {title}', 'never recovers'], ['studies {title} for 5 minutes', 'becomes the expert'],
    ['{quoteA}', '{quoteB}'], ['{author} said', '"{quote}"'], ['ah yes', '{title}'], ['you vs the {title}', 'she told you not to worry about'],
    ['this is fine', '{fact}'], ['my brain at the worst possible moment', '"remember {title}?"'], ['when the wikipedia rabbit hole', 'ends at {title}']
  ],
  caption: [
    'me after learning that {fact}', 'my toxic trait is thinking about {title} for six hours', '{title} supremacy', 'nobody:\n{author}: "{quote}"',
    'the cat when I explain {title} to it at 3am', 'every family has that one cousin who is really into {title}', 'hello yes I would like one (1) {title} please',
    'me reading about {title} instead of replying to my texts', 'this is what peak performance looks like ({title})', 'i fear no man. but {title}… it scares me',
    'how I look explaining {title} at the party', 'the voices told me about {title}', 'manifesting {title} energy this week', 'tell me you\'re into {title} without telling me',
    'society if everyone knew about {title}', '{title}? in this economy?', 'when someone says {title} isn\'t interesting', 'me pretending to understand {title}',
    'my last two brain cells discussing {title}', 'they don\'t teach you about {title} in school', 'POV: your date starts talking about {title}', '2am thoughts: {fact}',
    'what my parents think I do all day vs what I actually do: {title}', 'local creature learns that {fact}', 'the group chat when I bring up {title} again',
    '"{quote}"\n— {author}, probably about this picture', 'my therapist: {title} isn\'t real, it can\'t hurt you\n{title}:', 'me trying to stop thinking about {title}: day 47',
    'the face you make when you realise {fact}', 'I have a {title} emergency', 'girl dinner but it\'s {title}', 'they called me crazy for liking {title}. they were right but still'
  ],
  demotivator: [['{TITLE}', '{fact}'], ['AMBITION', 'Sometimes it leads to {title}.'], ['CURIOSITY', 'It killed the cat. Then the cat read about {title}.'], ['{TITLE}', '"{quote}" — {author}'], ['PERSPECTIVE', '{fact}'], ['RESEARCH', 'You started with one article. Now you know about {title}.']],
  post: ['{quote}'],
  chyron: ['{fact}'],
  twopanel: { boring: ['touching grass', 'sleeping eight hours', 'small talk', 'doing my taxes', 'replying to emails', 'going outside', 'drinking water', 'normal hobbies', 'being productive', 'reading the terms and conditions', 'answering the phone', 'meal prep'], weird: ['reading about {title}', '{title}', 'explaining {title} to strangers', 'becoming an expert in {title}', 'a 40-tab deep dive into {title}'] },
  versus: [['Expectation', 'Reality'], ['What I planned to do tonight', '{title} rabbit hole'], ['{title}', '{title2}'], ['How it started', 'How it\'s going'], ['Them', 'Me, into {title}']],
  brain: [['reading the news', 'reading Wikipedia', 'reading about {title}', 'becoming {title2}'], ['having hobbies', 'having niche hobbies', '{title}', 'founding a {title2} society'], ['going to bed', 'scrolling until 2am', 'researching {title}', 'ascending into {title2}']],
  starter: ['{topic} starter pack', 'the {title} starter pack', 'you, after one week of this app: starter pack'],
  labels: [['me', '{title}', 'my sleep schedule'], ['my brain', '{title}', 'everything else'], ['me', 'my responsibilities', '{title}'], ['society', '{title}', 'me']],
  quotecard: ['{quote}'],
  pov: ['POV: you just discovered {title}', 'POV: you\'re the {title}', 'POV: your friend will not stop talking about {title}', 'POV: it\'s 3am and you\'re reading about {title}', 'POV: you finally understand {title}'],
  isthis: ['is this {title}?', 'is this a pigeon? no, it\'s {title}'],
  venn: { mids: ['a man named Gary', 'the concept of Tuesday', 'mild existential dread', 'a goat, for some reason', 'unpaid labour', 'a small administrative error', 'soup, eventually', 'somebody\'s grandmother', 'a very specific smell', '{topic}', 'nobody knows how', 'the sea, apparently'] },
  nobody: [['Nobody:', 'Absolutely no one:', '{title}:'], ['Nobody:', 'Not a single soul:', 'Me, thinking about {title}:'], ['Nobody:', 'Literally nobody:', 'The internet: {fact}'], ['Nobody:', 'Not even my cat:', '{author}: "{quoteA}…"'], ['Nobody:', 'Wikipedia at 3am:', '{title}.']],
  placard: { media: ['oil on glass', 'gelatin silver print', 'mixed media and regret', 'found object', 'engraving on paper', 'ink on vellum', 'tempera on a door', 'salvaged dream, varnished'] },
  wanted: { crimes: ['crimes against {title}', 'possession of {title2} with intent to explain', 'knowing too much about {title}', 'saying "{quoteA}…" in public', 'impersonating {title2}', 'disturbing the peace of {title3}'], rewards: ['$5,000', '3 goats', '$1,000,000 (or a good explanation)', 'one (1) slightly used {title2}', '$50 and a firm handshake', 'a nice sit-down'] },
  align: [[['Lawful', 'Neutral', 'Chaotic'], ['Good', 'Neutral', 'Evil']], [['Harmless', 'Suspicious', 'Cursed'], ['Obscure', 'Famous', 'Overexposed']], [['Calm', 'Unsettled', 'Feral'], ['Useful', 'Decorative', 'Haunted']], [['Plausible', 'Implausible', 'Illegal'], ['Small', 'Medium', 'Cosmic']]],
  flow: [['I want to learn about {title}', 'Is it 3am?', 'Perfect. Continue.', 'Go to sleep. (You won\'t.)'], ['Do you know {title}?', 'Do you know {title2}?', 'Congratulations, you are me.', 'Read about {title}. You will.'], ['Is {title} real?', 'Does it matter?', 'Then why ask?', 'Read about {title2} instead.'], ['Should I stop reading about {title}?', 'Is there another tab open?', 'Close it. Open three more.', 'Proceed to {title2}.']],
  graph: [['My interest in {title}', 'hours since I learned it exists', 'interest', 'spike', 'me, at 3am'], ['Things I understand about {title}', 'minutes of reading', 'understanding', 'cliff', 'the second paragraph'], ['Public awareness of {title}', 'years', 'awareness', 'flat', 'then: {title2}'], ['Sleep vs {title}', 'night', 'sleep', 'cliff', 'someone mentioned {title}'], ['Confidence about {title}', 'knowledge', 'confidence', 'wave', 'peak ignorance'], ['Vibes around {title}', 'week', 'vibes', 'rise', 'it\'s happening']],
  triptych: [['Three Studies in {topic}', '{title}', '{title2}', '{title3}'], ['The {title} Triptych', 'me before', 'me during', 'me after'], ['Three Stages of {title}', 'denial', 'research', 'obsession'], ['{topic}, in Three Parts', 'the question', 'the answer', 'the other question']]
};
// Used only when the builder runs offline.
export const offlineQuotes = [
  ['Oscar Wilde', 'Is death the only honest critic of a life?'], ['Oscar Wilde', 'Death is so final that I find it vulgar.'], ['Mark Twain', 'The fear of death follows from the fear of life.'], ['Mark Twain', 'I do not fear death; I was dead for billions of years before I was born.'], ['Terry Pratchett', 'Death is not the end, merely a change of employment.'], ['Terry Pratchett', 'Who would wait for death, when death is so punctual?'],
  ['Jorge Luis Borges', 'Is time the substance I am made of? Time is a river.'], ['Jorge Luis Borges', 'Time is the only real mystery; the rest is clocks.'], ['Franz Kafka', 'Time moves in one direction, memory in another.'], ['Franz Kafka', 'Why does the clock always know more than I do?'], ['Emily Dickinson', 'Forever is composed of nows.'], ['Emily Dickinson', 'Time feels so vast that were it not for the other things, we could not feel eternity.'],
  ['Italo Calvino', 'Is every dream a city seen from far away?'], ['Italo Calvino', 'We dream the city, and the city sleeps in us.'], ['Franz Kafka', 'A dream is a small door left open in the night.'], ['Franz Kafka', 'Do we sleep to dream, or dream to sleep?'], ['Jorge Luis Borges', 'Dreams are a branch of fantastic literature.'], ['Jorge Luis Borges', 'I sleep, and the world goes on without asking permission.'],
  ['Ursula K. Le Guin', 'Is there any language left that is not borrowed?'], ['Ursula K. Le Guin', 'The words are what we have, and silence is what they are for.'], ['Italo Calvino', 'Language is a city; every word a lantern.'], ['Italo Calvino', 'What words can say a thing that silence already holds?'], ['Oscar Wilde', 'Words are the only luggage that gets lighter with use.'], ['Oscar Wilde', 'Who needs a language when one has a good silence?'],
  ['Mark Twain', 'Money is the most important thing in the world, but only for the poor.'], ['Mark Twain', 'Does money talk, or does it merely listen very loudly?'], ['Terry Pratchett', 'Money is a kind of dream, and the poor wake up first.'], ['Terry Pratchett', 'Is wealth what you own, or what owns you?'], ['Oscar Wilde', 'Nowadays people know the price of everything and the value of nothing.'], ['Oscar Wilde', 'When I was young I thought money was the most important thing in life; now I know it is.']
];

export const memeWeights = { impact: 12, caption: 18, demotivator: 7, post: 6, chyron: 6, twopanel: 8, versus: 6, brain: 5, starter: 5, labels: 6, quotecard: 7, pov: 6, isthis: 4, venn: 6, nobody: 5, placard: 6, wanted: 5, align: 5, flow: 5, graph: 5, triptych: 5 };
export const memeImageCount = { twopanel: 2, versus: 2, brain: 4, starter: 4, venn: 2, triptych: 3 };
