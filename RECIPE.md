# Sessions

A compact left side panel for the herdr app that lists every Claude Code session on this computer, grouped by folder. Typing filters the list, a click resumes a session in a new tab, and two buttons open claude.ai Projects and Chats in the browser.

![Sessions](preview.png)

## What you see

A 300 px column placed right after the Spaces sidebar, background `theme().surface`, base text 12 px.

1. **Header**: "Sessions" (12.5 px, semibold, `foreground`) and a refresh icon button on the right.
2. **Search**: a 26 px input, 11.5 px text, placeholder "Search sessions…", border `border`, fill `background`.
3. **List** (scrolls, with scrollbar): for each folder a 26 px header with a closed or open folder icon, the folder name (12 px semibold; `foreground` when open, `muted` when closed), a small "worktree" badge (9 px, `accent`) for git worktrees, and a rounded count badge on the right. Under it, one 23 px row per session: title truncated (12 px) and its age on the right (10 px, `dim`: "now", "23 min", "6 d", then a date). A 1 px guide line on the left turns `accent` on hover.
4. **Footer**: two 24 px buttons, "Projects ↗" and "Chats ↗".

Folders are ordered by their newest session; sessions inside a folder are newest first. Sessions without a generated title show their first prompt, or "(untitled)".

## How it behaves

- Click a folder header: fold or unfold it. While searching, every folder with a match is shown unfolded.
- Click a session: `tab.new` with the session title as name, the session's folder as `folder` and `argv: ["claude", "--resume", <session id>]`.
- Hover a session: tooltip with the last prompt (110 characters) and the git branch.
- Refresh icon: reads the sessions again. Nothing else reads: no timers, no polling.
- "Projects" and "Chats" call `cx.open_url` with `https://claude.ai/projects` and `https://claude.ai/recents`.
- Errors reading the sessions show "Could not read: <message>" in the list.

## Built from

- `mods/sessions/mod.json`: `{ "place": "left", "size": 300, "title": "Sessions" }`.
- `mods/sessions/main.js`: a `View` using `gpui-kit` and `gpui-base` (`v_flex`, `h_flex`, `InputState`, `Input`, `overflow_y_scrollbar`), and from `herdr`: `exec`, `home`, `run`, `theme`. All colors come from `theme()`; none are hard coded.
- `mods/sessions/index.js`: plain Node, no dependencies. Run with `exec("node", [<home>/.config/herdr-app/mods/sessions/index.js])`. For every `~/.claude/projects/<folder>/*.jsonl` it reads the first 48 KB and the last 96 KB, parses each complete JSON line and takes `cwd`, `gitBranch`, the last `ai-title`, `last-prompt` and `agent-name`. It prints a JSON array of `{id, cwd, project, worktree, title, name, last, branch, mtime}` sorted by `mtime` descending. Transcripts without a `cwd` are skipped. A path containing `.claude/worktrees` marks a worktree.
- Icons (`folder.svg`, `folder-open.svg`, `refresh.svg`, `external.svg`): one-color SVGs tinted by the text color.
- The panel also needs a layout block: `{ "type": "block", "content": { "mod": "sessions" }, "size": { "px": 300 } }` right after the sidebar.

## Watch out

- `place` only decides where the panel first appears. If the layout already holds a `sessions` block, changing `place` moves nothing; edit the layout. Renaming the mod makes herdr add a second block, so remove the duplicate.
- Only local sessions exist on disk. claude.ai Projects, scheduled tasks and cloud sessions cannot be listed, which is why those are links.
- Reading 100+ MB of transcripts whole would be slow; keep the head and tail limits.
- The script needs `node` on the PATH; `exec` runs it for real, including during `herdr-app check`.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/sessions` passes and no `*.error` file appears.
- The panel lists the folders that have sessions in `~/.claude/projects`, newest first.
- Typing a word that appears in a title or folder name filters the list.
- Clicking a session opens a tab whose terminal runs `claude --resume <id>` in the session's folder.
- "Projects ↗" opens `https://claude.ai/projects` in the browser.
- With the panel idle, no process runs and nothing is read.
