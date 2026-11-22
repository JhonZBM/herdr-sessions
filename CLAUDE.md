# herdr-sessions
A herdr mod: Claude Code session history as a popup. Public repo.

## Lightness rule (central)
- Zero dependencies except Node and git. One file per piece. No build, no `package.json`.
- Reuse what Claude Code and herdr already give before writing anything.
- Nothing periodic: no recurring timers; every `exec` is one-off, with an argv array.
- Colors only from `theme()`. No absolute paths in what is versioned.

## Conventions
- A mod is `mods/<name>/` with `mod.json`, `main.js`, `keys.json` (if it has keys) and its icons.
- `README.md` (English) and `README.es.md` (Spanish) are updated together; `RECIPE.md` explains how to rebuild it; `CHANGELOG.md` follows Keep a Changelog.
- Code, comments, UI strings and commits in English; Conventional Commits, no co-author lines.
- `preview.png` must never show a real chat: use demo data.

## Check
```
herdr-app check mods/sessions
git grep -nE "setInterval|setTimeout|timer\.every"
git grep -nE "[A-Za-z]:[\/](Users|PROGRAMACION)|/home/"
```
