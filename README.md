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
| Physics games | 20% | 10 procedurally seeded game types with autopilot |
| Condensed Wikipedia | 30% | Wikipedia API: seed articles, categories, "more like" search |
| Videos | 20% | YouTube search (short videos), checked for embedding |
| Memes | 10% | Wikimedia Commons images + Wikiquote/Wikipedia captions, Know Your Meme |
| Made-up products | 5% | Hand-written parts + generated 80s/90s promo art |
| Psychedelic | 5% | Generative visuals in the app + quotes |
| Self-care | 5% | Hand-written prompts, timers, breathing exercises |
| From the web | 5% | Hacker News, Substack, occasionally Reddit |

**To make a new package**, edit [`packages/request.json`](packages/request.json) (for
example set `"id": "2026-W44"`) and push, or run **Build weekly package** from the
Actions tab. The workflow scrapes the sources, commits the package and rebuilds the APK.
The app offers the new package on launch.

What goes into a package is described in [`packages/prompt.md`](packages/prompt.md)
(editable in the app) and configured in [`tools/data/`](tools/data/): category
shares in `config.json`, Wikipedia seeds and video searches in `topics.json`, and
hand-written products, self-care prompts and meme templates in `content.mjs`.
Feedback synced from the app lands in [`feedback/`](feedback/).

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
