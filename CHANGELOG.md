# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.2] - 2026-11-22

### Fixed
- Antigravity CLI sessions did not show up: the CLI keeps its own database in `~/.gemini/antigravity-cli`, separate from the IDE one in `~/.gemini/antigravity`. Both are read now, merged by id.
- Antigravity folders use the same path spelling as the other agents, so one folder is one group.

## [0.2.1] - 2026-11-22

### Added
- A row of agent filter chips (All, Claude, Codex, Agy, with counts) under the search box, shown only when at least two agents have sessions.

### Changed
- The `codex` / `agy` badge is a little larger and clearer (10 px, `muted`).
- The running-session dot sits in the left gutter, so titles no longer shift right.

## [0.2.0] - 2026-11-22

### Added
- Codex sessions, read from `~/.codex/sessions` and `session_index.jsonl`, resumed with `codex --no-daemon resume <id>`.
- Antigravity sessions, read from `~/.gemini/antigravity/conversation_summaries.db` through Node's built-in `node:sqlite` (read-only), resumed with `agy --conversation <id>`.
- A small `codex` / `agy` badge on those rows, searchable; the folder's "+" starts the agent of its newest session.

### Changed
- The mod is listed as "Agent Sessions".
- `index.js` is split into one isolated reader per agent; a missing agent never hides the others.
- Cursor CLI is documented as not supported yet.

## [0.1.0] - 2026-11-22

### Changed
- The mod is listed as "Claude Sessions" (`mod.json` title) so it is easy to tell apart from other session mods.

### Added
- Popup (`Ctrl+Shift+S`) that lists Claude Code sessions grouped by folder, with search. It can also be docked as a side panel.
- `keys.json` with the default shortcut.
- Hover actions on each folder heading: new Claude session in that folder, and a menu to sort groups (recent or name) or turn grouping off. The choice is saved in `localStorage`. The menu closes on Esc, on a click outside it or after choosing an option.
- SVG chevrons next to the folder names.
- `sessions-button`: a small "Sessions" button for the top bar that opens the popup, so the entry point is visible.
- Resume a session in a new tab with one click.
- Running sessions (detected from `~/.claude/sessions`) are marked with a dot; clicking one focuses its tab instead of running `claude --resume` a second time.
- A "claude.ai" section: your own pinned links (from the clipboard, `claude.ai` links only) plus Projects and Chats shortcuts.
- "Open links in" chip on the claude.ai heading, always showing the current choice and opening a dropdown to change it. Browser (Default, Brave, Chrome, Edge, Firefox) and mode (Normal, New window, Private) are chosen separately, so any combination works; a previously saved combined choice is migrated. Each link's tooltip says where it will open.

[Unreleased]: https://github.com/JhonZBM/herdr-sessions/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/JhonZBM/herdr-sessions/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/JhonZBM/herdr-sessions/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JhonZBM/herdr-sessions/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JhonZBM/herdr-sessions/releases/tag/v0.1.0
