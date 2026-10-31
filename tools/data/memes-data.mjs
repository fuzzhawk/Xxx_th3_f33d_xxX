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
  isthis: ['is this {title}?', 'is this a pigeon? no, it\'s {title}']
};
export const memeWeights = { impact: 12, caption: 18, demotivator: 7, post: 6, chyron: 6, twopanel: 8, versus: 6, brain: 5, starter: 5, labels: 6, quotecard: 7, pov: 6, isthis: 4 };
export const memeImageCount = { twopanel: 2, versus: 2, brain: 4, starter: 4 };
