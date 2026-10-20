# Xxx_th3_f33d_xxX
Vibe coded feed replacer

> "All statements are true in some sense, false in some sense, meaningless in some sense, true and false in some sense, true and meaningless in some sense, false and meaningless in some sense, and true and false and meaningless in some sense."
> — *Principia Discordia*

**The Feed** is an Android app that replaces doomscrolling with a weekly package of
curious, weird and kind posts: physics games that play themselves, five-sentence
Wikipedia rabbit holes, short videos, memes, made-up products, psychedelic math
visuals, self-care nudges and hand-picked links from around the web.

## Install on your phone

1. Open the [**apk-latest** release](../../releases/tag/apk-latest) on your phone.
2. Download `the-feed.apk` and open it. Allow installs from your browser if Android asks.
3. Later builds install over the old one and keep your favorites, stats and settings.

## Web version (share with friends)

The repo is a plain static site: no build step, no npm. To host it on Netlify:

1. Sign in at [app.netlify.com](https://app.netlify.com) with GitHub.
2. **Add new site → Import an existing project → GitHub**, pick this repository and the branch to publish.
3. Leave **Build command** empty and **Publish directory** empty (the repo root). Click **Deploy**.
4. Share the `*.netlify.app` link. Each friend's favorites, stats and settings stay in their own browser.

`_redirects` serves the app in `www/` at the site root, and the app reads the weekly
packages straight from `packages/` on the same site, so every push of a new package
shows up for everyone. Other static hosts work too (the root `index.html` hops to `www/`).

## Using it

- **Feed**: scroll. Games run on autopilot; tap one to play it (drag outside the game
  area to keep scrolling). Videos autoplay muted; tap **Unmute** for sound. Tap a
  Wikipedia card to expand it.
- **♥ / 🔖 / ▲ / ▼** on every post: favorite, save, more like this, less like this.
  Marks nudge topic weights straight away and steer the next package.
- **Favorites tab**: favorites, saved posts and marks, filterable by category.
- **Timer** (top right): tap for usage today and over 7 days, time of day, sessions,
  scroll distance, time per post by category and how much of the package you've seen.
- **Settings**: feed mix per category, topic weights, playback, a daily time budget,
  the editable package prompt, package downloads, offline images and GitHub sync.

Everything except videos works offline. Memes and thumbnails are cached as you see
them, or all at once with **Settings → Download images for offline**.

## Weekly packages

Packages live in [`packages/`](packages/), one folder per week, with the full history
kept for archiving and to avoid repeats. Each one is sized for 5 hours a day for 7 days.

| Category | Share | Source |
|---|---|---|
| Games | 20% | 35 game types with autopilot, themed sprite kits and random modifiers, including word games (five-letter guessing, spelling hive, word search, letter wheel, hangman, vocabulary quiz, word ladders) |
| Condensed Wikipedia | 25% | Wikipedia API: seed articles, categories, "more like" search |
| Videos | 20% | YouTube search (short videos), checked for embedding |
| Memes | 10% | Wikimedia Commons images + Wikiquote/Wikipedia captions, Know Your Meme |
| Made-up products | 5% | Hand-written parts + generated 80s/90s promo art |
| Psychedelic | 5% | Generative visuals in the app + quotes |
| Self-care | 5% | Hand-written prompts, timers, breathing exercises |
| From the web | 5% | 19 sites (Lobsters, MetaFilter, Atlas Obscura, Quanta…), Hacker News, webcomics |
| Oracle | 3% | Dice, I Ching, sacred-chicken augury, haruspicy (sacrifice a generated beast, read its entrails), tarot (old decks scanned on Wikimedia Commons) |
| Power scale | 2% | Versus cards and tier lists of odd things from history and fiction (Wikipedia) |
| News | 0% (hidden) | 17 feeds in four groups; tap **News** in the stories row |

**To make a new package**, edit [`packages/request.json`](packages/request.json) (for
example set `"id": "2026-W44"`) and push, or run **Build weekly package** from the
Actions tab. The workflow scrapes the sources, commits the package and rebuilds the APK.
The app offers the new package on launch.

What goes into a package is described in [`packages/prompt.md`](packages/prompt.md)
(editable in the app) and configured in [`tools/data/`](tools/data/): category
shares in `config.json`, Wikipedia seeds and video searches in `topics.json`, and
hand-written products, self-care prompts and meme templates in `content.mjs`.
Feedback synced from the app lands in [`feedback/`](feedback/).

## Credits

Word list: [SCOWL](http://wordlist.aspell.net/) by Kevin Atkinson (see `www/data/words-LICENSE.txt`). Vocabulary definitions: [Wiktionary](https://en.wiktionary.org/) (CC BY-SA). Tarot scans and other images: Wikimedia Commons (public domain and CC licences, credited per image). Game art: [Kenney](https://kenney.nl) (CC0).

## Development

```sh
npm install
node tools/build-package.mjs --offline --out /tmp/pk   # placeholder package, no network
node tools/bundle-package.mjs --src /tmp/pk            # copy it into www/bundled
node tools/serve.mjs 8080                              # open http://localhost:8080
```

The app is plain HTML/CSS/JS modules in `www/`, wrapped with Capacitor 8 for Android.
`.github/workflows/apk.yml` builds the APK; `.github/workflows/package.yml` builds packages.
`android-overrides/debug.keystore` is a throwaway signing key that exists only so
updates install over each other.
