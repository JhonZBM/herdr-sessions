# Contributing

Thanks for looking. Issues and PRs are welcome, in English or Spanish.

## What fits

- Fixes for macOS or Linux: this was built and tested on Windows only, so reports there are the most useful. In particular the browser launch commands (`start brave`, `open -na`, `<browser> --incognito`).
- Another agent CLI: add a reader to `mods/sessions/index.js` (same fields as the others plus `agent`, capped at 200 sessions, failing silently) and a row to `AGENTS` in `mods/sessions/main.js`. Cursor CLI is the open one: it needs someone who has it installed to confirm where it keeps its history.
- Another browser or mode in the link chooser, following `launchArgv` in `mods/sessions/main.js`.
- Polish that keeps the popup compact and theme-agnostic (colors only from `theme()`).

## The one rule: stay lightweight

Zero dependencies (only Node and git), one file per piece, no build, nothing periodic if an event can replace it. Each `exec` is a one-off, run on a click, always with an argv array (never a shell string). A PR that adds a dependency, a timer or a background process will be asked to find a native alternative first.

## Before opening a PR

- Check the mod: `herdr-app check mods/sessions` (and `mods/sessions-button`).
- Update `README.md` and `README.es.md` together, and `CHANGELOG.md` under `[Unreleased]`.
- No absolute paths (drive, user) in what is versioned.
- Conventional Commits in English (`feat:`, `fix:`, `docs:`), no co-author lines.
- Quick checks:

```sh
git grep -nE "setInterval|setTimeout|timer\.every"        # periodicity
git grep -nE "[A-Za-z]:[\/](Users|PROGRAMACION)|/home/"  # absolute paths
```
