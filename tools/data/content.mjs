// Hand-written building blocks for the procedural categories.
// Edit freely: every list here is sampled without replacement where possible.

// ---------------------------------------------------------------- products
export const selfCare = [
  // art
  ['art', 'prompt', 'Put the phone down and draw the nearest object in under two minutes. Bad drawings count double.'],
  ['art', 'prompt', 'Draw your own hand without looking at the paper.'],
  ['art', 'prompt', 'Fill a page with spirals. Do not plan them.'],
  ['art', 'prompt', 'Make a collage from whatever paper is in reach: receipts, mail, packaging.'],
  ['art', 'prompt', 'Doodle a creature that would live inside a teapot.'],
  ['art', 'prompt', 'Take one photo of something ugly and make it beautiful by framing.'],
  ['art', 'prompt', 'Sketch the view out of your nearest window using only lines, no shading.'],
  ['art', 'prompt', 'Draw a map of a city you have never been to. Name three streets.'],
  ['art', 'prompt', 'Pick one color and find five things in the room that match it.'],
  ['art', 'prompt', 'Write a six-word story, then illustrate it.'],
  ['art', 'prompt', 'Do a blind contour drawing of a friend or a pet.'],
  ['art', 'prompt', 'Design a tarot card for something that happened today.'],
  ['art', 'prompt', 'Make a tiny zine: fold one sheet into eight pages and fill it.'],
  ['art', 'prompt', 'Draw the sound you heard most recently.'],
  ['art', 'prompt', 'Cut up a page of text and rearrange it into a poem, Burroughs-style.'],
  ['art', 'timer', 'Ten-minute sketch session. Timer starts when you tap.', 600],
  ['art', 'timer', 'Five minutes of free drawing. No erasing allowed.', 300],
  // music
  ['music', 'prompt', 'Hum a melody you have never heard before and record a voice memo of it.'],
  ['music', 'prompt', 'Make a beat on the table with your hands. Loop it for a minute.'],
  ['music', 'prompt', 'Open your instrument, or a free synth app, and play one note for as long as it is interesting.'],
  ['music', 'prompt', 'Record 30 seconds of the sounds in your room. That is a field recording now.'],
  ['music', 'prompt', 'Listen to one full album side with your eyes closed. No skipping.'],
  ['music', 'prompt', 'Write four lines of lyrics about the last thing you ate.'],
  ['music', 'prompt', 'Sample something: a door creak, a kettle, a cat. Build a loop from it.'],
  ['music', 'prompt', 'Play a song you love at half speed and listen for what changes.'],
  ['music', 'prompt', 'Make a playlist of five songs for a road trip to nowhere.'],
  ['music', 'prompt', 'Try to play a song by ear on any instrument, even a glass of water.'],
  ['music', 'prompt', 'Find a chord you have never used before and write a loop around it.'],
  ['music', 'timer', 'Fifteen minutes of noodling on an instrument. No goals.', 900],
  ['music', 'timer', 'Three minutes: sing along to something, loudly.', 180],
  // walk / outside
  ['walk', 'prompt', 'Go for a walk around the block. Count the birds you see.'],
  ['walk', 'prompt', 'Take a walk and photograph three textures.'],
  ['walk', 'prompt', 'Step outside and look at the sky for one full minute.'],
  ['walk', 'prompt', 'Walk somewhere without a destination. Turn left at every second corner.'],
  ['walk', 'prompt', 'Go touch a tree. Seriously. Notice its bark.'],
  ['walk', 'prompt', 'Walk to the nearest place you have never been inside.'],
  ['walk', 'prompt', 'Take a slow walk and only listen. Name every sound.'],
  ['walk', 'prompt', 'Find the oldest thing you can see on your street.'],
  ['walk', 'prompt', 'Go outside barefoot for a minute, if it is safe to.'],
  ['walk', 'prompt', 'Walk until you find something that makes you smile, then come back.'],
  ['walk', 'timer', 'Twenty-minute walk. The feed will be here when you get back.', 1200],
  ['walk', 'timer', 'Ten-minute walk, phone in pocket.', 600],
  // workout
  ['workout', 'prompt', 'Ten squats. Right now. The feed can wait.'],
  ['workout', 'prompt', 'Hold a plank for as long as you can. Then scroll on, victorious.'],
  ['workout', 'prompt', 'Twenty jumping jacks. Shake out the scroll.'],
  ['workout', 'prompt', 'Do ten push-ups, from your knees or against a wall if you like.'],
  ['workout', 'prompt', 'Stand up and roll your shoulders back ten times.'],
  ['workout', 'prompt', 'Stretch your neck slowly: left, right, chin to chest.'],
  ['workout', 'prompt', 'Climb a flight of stairs, twice.'],
  ['workout', 'prompt', 'Touch your toes, or try. Hold it for five breaths.'],
  ['workout', 'prompt', 'Dance to one entire song like nobody is watching (they are not).'],
  ['workout', 'prompt', 'Wall sit for 45 seconds.'],
  ['workout', 'prompt', 'Do a sun salutation, or your best approximation of one.'],
  ['workout', 'prompt', 'Shake your whole body for 30 seconds, like a wet dog.'],
  ['workout', 'timer', 'Seven-minute workout: squats, push-ups, planks, repeat.', 420],
  ['workout', 'timer', 'Five-minute stretch break. Timer starts when you tap.', 300],
  // breathe
  ['breathe', 'breathe', 'Box breathing: in for four, hold for four, out for four, hold for four.', 'box'],
  ['breathe', 'breathe', '4-7-8 breathing: in for four, hold for seven, out for eight.', '478'],
  ['breathe', 'breathe', 'Slow breathing: in for five, out for five. Follow the circle.', 'coherent'],
  ['breathe', 'breathe', 'Physiological sigh: two short inhales through the nose, one long exhale.', 'sigh'],
  ['breathe', 'prompt', 'Take three breaths so slow that you can feel your ribs move.'],
  ['breathe', 'prompt', 'Breathe out longer than you breathe in, five times.'],
  ['breathe', 'prompt', 'Unclench your jaw. Drop your shoulders. Breathe.'],
  // meditate
  ['meditate', 'prompt', 'Close your eyes and notice five sounds, four sensations, three smells.'],
  ['meditate', 'prompt', 'Sit still and watch your thoughts like cars passing on a street.'],
  ['meditate', 'prompt', 'Scan your body from toes to scalp. Where are you holding tension?'],
  ['meditate', 'prompt', 'Look at a single object for one minute as if you have never seen one before.'],
  ['meditate', 'prompt', 'Repeat a word you like, silently, for twenty breaths.'],
  ['meditate', 'prompt', 'Imagine the room you are in from the ceiling looking down.'],
  ['meditate', 'prompt', 'Notice the space between two thoughts. Rest there.'],
  ['meditate', 'timer', 'Five-minute sit. Eyes closed, phone face down.', 300],
  ['meditate', 'timer', 'Ten-minute meditation. Tap to begin, and the timer will chime.', 600],
  ['meditate', 'timer', 'Two minutes of doing absolutely nothing.', 120],
  // body / basics
  ['body', 'prompt', 'Drink a full glass of water.'],
  ['body', 'prompt', 'Eat something with a color in it.'],
  ['body', 'prompt', 'Check your posture. Is your phone pulling your head forward?'],
  ['body', 'prompt', 'Look at something at least twenty feet away for twenty seconds.'],
  ['body', 'prompt', 'Wash your face with cool water.'],
  ['body', 'prompt', 'Open a window and let some air in.'],
  ['body', 'prompt', 'Make a cup of tea and drink it without your phone.'],
  ['body', 'prompt', 'If it is late, this is your sign to go to sleep.'],
  ['body', 'prompt', 'Put on a song and make yourself a proper snack.'],
  // connect / mind
  ['connect', 'prompt', 'Text a friend something you appreciate about them.'],
  ['connect', 'prompt', 'Call someone instead of messaging them.'],
  ['connect', 'prompt', 'Write down three things that went okay today.'],
  ['connect', 'prompt', 'Tidy one small surface. Just one.'],
  ['connect', 'prompt', 'Write a postcard to someone. Actually mail it.'],
  ['connect', 'prompt', 'Read one page of a physical book.'],
  ['connect', 'prompt', 'Write one sentence in a journal about how you feel right now.'],
  ['connect', 'prompt', 'Water a plant, or go and look at someone else’s.'],
  ['connect', 'prompt', 'Learn one word in a language you do not speak.'],
  ['connect', 'prompt', 'Plan one small thing to look forward to this week.']
];

export const selfCareFlavors = [
  'Gentle reminder', 'Pattern interrupt', 'Hey, you', 'Quick quest', 'Side quest unlocked', 'Brief transmission', 'A small rebellion',
  'The feed suggests', 'Signal from the real world', 'Intermission', 'Checkpoint', 'Your body called', 'Tiny ritual'
];

// ---------------------------------------------------------------- memes
export const fallbackQuotes = [
  ['Robert Anton Wilson', 'Convictions cause convicts.'],
  ['Robert Anton Wilson', 'Only the madman is absolutely sure.'],
  ['Principia Discordia', 'All statements are true in some sense, false in some sense, meaningless in some sense.'],
  ['Principia Discordia', 'We Discordians must stick apart.'],
  ['Tom Robbins', 'It\'s never too late to have a happy childhood.'],
  ['Philip K. Dick', 'Reality is that which, when you stop believing in it, doesn\'t go away.'],
  ['Hunter S. Thompson', 'When the going gets weird, the weird turn pro.'],
  ['Kurt Vonnegut', 'We are what we pretend to be, so we must be careful about what we pretend to be.'],
  ['Ursula K. Le Guin', 'You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.'],
  ['Terence McKenna', 'Nature loves courage.']
];

// ---------------------------------------------------------------- meme formats (v2)
// {title}/{title2}/{title3}/{fact}: Wikipedia items · {quote}/{author}: Wikiquote · {topic}: wiki topic label
