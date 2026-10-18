# Feedback

The app writes here when you tap **Settings → Feedback & sync → Sync to GitHub**:

- `latest.json`: the most recent snapshot.
- `<package-id>.json`: one file per package.

Each snapshot lists favorites, saves, ▲/▼ marks, your feed mix and topic weights,
and 7-day usage (hours, time of day, average dwell per category). The next package
build reads it to decide what to keep, drop or expand.
