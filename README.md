<div align="center">

<h1>herdr-sessions</h1>

<p><b>Agent Sessions</b>: your Claude Code, Codex and Antigravity session history, inside herdr</p>

[Español](README.es.md)

[![License: MIT](https://img.shields.io/github/license/JhonZBM/herdr-sessions?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-required-5FA04E?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)

A [herdr](https://herdr.dev) mod: a popup with every Claude Code, Codex and Antigravity session you have run, grouped by folder. Press a key, search, click, and the session resumes in a new tab. It takes no screen space until you open it.

![herdr-sessions](preview.png)

</div>

- **Grouped by folder** under small muted headings, newest first, with the title and how long ago. The git branch and last prompt are in the tooltip. Git worktrees are tagged.
- **Fold, add and organize from the heading**: each folder has a chevron; hover its heading to get a **+** (new Claude session in that folder) and a sort icon (sort groups by recent or name, or turn grouping off for a flat list by date). Your choice is remembered.
- **Search** across titles, last prompts, folders and branches.
- **One click resumes** the session (`claude --resume`) in a new tab, in the right folder.
- **Running sessions are marked** with a dot. Clicking one jumps to its tab instead of opening a second copy.
- **claude.ai links**: pin your own Projects and Chats (copy the link, press **+** on the "claude.ai" heading), plus Projects and Chats shortcuts. They open in the browser and mode you choose with the chip on that heading, which always shows the current choice. Pick a browser (Default, Brave, Chrome, Edge or Firefox) and a mode (Normal, New window or Private); every combination works. The setting is remembered and starts as "Default" in Normal mode, so pick yours once. New window and Private need a named browser.
- **A visible button** in the top bar, plus `Ctrl+Shift+S`, so you never have to remember a key.
- **Popup or docked**: a popup by default (`Ctrl+Shift+S`), so it fits any layout; it can also be docked as a side panel.
- **Follows your theme**: it only uses the active layout's colors.
- **Light by design**: one Node script, no dependencies, no timers and no background process. It reads on open and when you press refresh.

## Install

Requirements: herdr-app (open it once), Node and at least one of Claude Code, Codex or Antigravity (`agy`). Antigravity needs Node 22.5 or newer. Built and tested on Windows 11; macOS and Linux should work but are untested.

**Easiest:** ask an agent in herdr to add this repo as a mod:

> Add the herdr-sessions mod from https://github.com/JhonZBM/herdr-sessions. Read RECIPE.md and every file before installing.

**Manually:** copy `mods/sessions/` (and `mods/sessions-button/`, optional) into `~/.config/herdr-app/mods/` and check it:

```sh
herdr-app check ~/.config/herdr-app/mods/sessions
```

Merge `mods/sessions/keys.json` into your `keys.json` (it binds `Ctrl+Shift+S`), add the button below, or run `herdr-app do mod.open '{"name":"sessions"}'`.

**A visible button (optional):** `mods/sessions-button/` is a tiny "Sessions" button for the top bar. Herdr's shipped layouts cannot be edited, so clone yours (`layout.clone {"name":"main","as":"my-main"}`) and wrap its `tabs` block in a row with the button. Use the height your `tabs` block already has (30 px in `main`):

```json
{ "id": "tabbar", "type": "row", "size": { "px": 30 }, "window_drag": true,
  "children": [
    { "id": "sessions-button", "type": "block", "content": { "mod": "sessions-button" }, "size": { "px": 112 } },
    { "id": "tabs", "type": "block", "content": { "mod": "tabs" }, "size": { "weight": 1 } }
  ] }
```

**Docked panel (optional):** add a block to your layout, right after the sidebar, to keep it always visible:

```json
{ "id": "sessions", "type": "block", "content": { "mod": "sessions" }, "size": { "px": 300 }, "hidden": true }
```

Then `layout.toggle:sessions` shows or hides it.

## How it works

Each agent already keeps its history on disk, and `index.js` reads it (one small reader per agent, each isolated, so a missing agent never hides the others):

| Agent | Reads | Resumes with |
|---|---|---|
| Claude Code | `~/.claude/projects/<folder>/<id>.jsonl`: first 48 KB and last 96 KB of each file | `claude --resume <id>` |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (header only) and `~/.codex/session_index.jsonl` for names; newest 200 | `codex --no-daemon resume <id>` |
| Antigravity | `~/.gemini/antigravity/conversation_summaries.db`, read-only through Node's built-in `node:sqlite`; newest 200 | `agy --conversation <id>` |

It prints JSON. It never writes, never sends anything over the network and ignores sub-agent transcripts.

## Limits

- Only sessions stored on this computer appear. Cloud sessions and claude.ai Projects and Chats are not on disk and there is no API to read them, so the panel only opens their links; you still need to be signed in to claude.ai in that browser. To work on a project inside herdr, make a local folder with its `CLAUDE.md` and files: its sessions then show up here by themselves.
- A private browser window shares its login only while a private window stays open; otherwise it asks you to sign in again.
- Jumping to a running session matches its terminal by the session name shown in the tab title. Two Claude sessions with the same name, or one running outside herdr, cannot be matched and show "running outside herdr".
- Sessions without an AI-generated title show their first prompt.
- Codex and Antigravity rows show a small `codex` / `agy` badge. When two or more agents have sessions, a row of chips (All, Claude, Codex, Agy, each with its count) under the search box filters by agent; with a single agent it stays hidden.
- Only Claude Code sessions are detected as running. A Codex or Antigravity row always opens a new tab, so check that it is not already open.
- Cursor CLI is not supported yet: it is not installed on the machine this was built on, so its history format is unverified. A contribution is welcome (see `CONTRIBUTING.md`).
- Antigravity sessions without a folder, such as ones started from its IDE, are skipped.

## Contributing

Code, comments and UI strings are in English. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). Every change must pass `herdr-app check` and be recorded in [CHANGELOG.md](CHANGELOG.md). See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
