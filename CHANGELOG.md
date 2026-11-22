# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Popup (`Ctrl+Shift+S`) that lists Claude Code sessions grouped by folder, with search. It can also be docked as a side panel.
- `keys.json` with the default shortcut.
- Hover actions on each folder heading: new Claude session in that folder, and a menu to sort groups (recent or name) or turn grouping off. The choice is saved in `localStorage`. The menu closes on Esc, on a click outside it or after choosing an option.
- SVG chevrons next to the folder names.
- `sessions-button`: a small "Sessions" button for the top bar that opens the popup, so the entry point is visible.
- Resume a session in a new tab with one click.
- Running sessions (detected from `~/.claude/sessions`) are marked with a dot; clicking one focuses its tab instead of running `claude --resume` a second time.
- A "claude.ai" section: your own pinned links (from the clipboard, `claude.ai` links only) plus Projects and Chats shortcuts.
- "Open links in" chip on the claude.ai heading, always showing the current choice (default browser, Brave private, Chrome incognito, Edge InPrivate or Firefox private) and opening a small dropdown to change it. Each link's tooltip says where it will open.
