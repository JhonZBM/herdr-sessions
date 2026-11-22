// Lists Claude Code sessions by reading ~/.claude/projects (only the head and tail of each
// transcript: title, last prompt, folder, branch). Prints JSON. No dependencies, no cache.
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(os.homedir(), ".claude", "projects");
const HEAD = 48 * 1024;
const TAIL = 96 * 1024;

function slice(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = fs.readSync(fd, b, 0, len, pos);
  return b.toString("utf8", 0, n);
}

function records(text, dropFirst, dropLast) {
  const lines = text.split("\n");
  if (dropFirst) lines.shift();
  if (dropLast) lines.pop();
  const out = [];
  for (const l of lines) {
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch {}
  }
  return out;
}

function readSession(file, dir) {
  const st = fs.statSync(file);
  const fd = fs.openSync(file, "r");
  try {
    const head = records(slice(fd, 0, Math.min(HEAD, st.size)), false, st.size > HEAD);
    const tailStart = Math.max(0, st.size - TAIL);
    const tail = st.size > HEAD ? records(slice(fd, tailStart, st.size - tailStart), tailStart > 0, false) : [];
    const all = head.concat(tail);
    let cwd = "", branch = "", title = "", last = "", name = "";
    for (const r of all) {
      if (!cwd && r.cwd) cwd = r.cwd;
      if (r.gitBranch) branch = r.gitBranch;
      if (r.type === "ai-title" && r.aiTitle) title = r.aiTitle;
      if (r.type === "last-prompt" && r.lastPrompt) last = r.lastPrompt;
      if (r.type === "agent-name" && r.agentName) name = r.agentName;
    }
    if (!cwd) return null;
    if (!title) title = last.slice(0, 80) || "(untitled)";
    return {
      id: path.basename(file, ".jsonl"),
      cwd,
      project: path.basename(cwd.replace(/[\/]+$/, "")),
      worktree: /[\/]\.claude[\/]worktrees[\/]/.test(cwd),
      title,
      name,
      last: last.slice(0, 200),
      branch,
      mtime: Math.floor(st.mtimeMs),
    };
  } finally {
    fs.closeSync(fd);
  }
}

// Claude Code keeps one small file per running process in ~/.claude/sessions/<pid>.json.
// A session is "live" when its process is still alive (signal 0 only checks, it sends nothing).
function liveIds() {
  const dir = path.join(os.homedir(), ".claude", "sessions");
  const ids = new Set();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return ids; }
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!j.sessionId || !j.pid) continue;
      try { process.kill(j.pid, 0); ids.add(j.sessionId); } catch (e) { if (e.code === "EPERM") ids.add(j.sessionId); }
    } catch {}
  }
  return ids;
}

const sessions = [];
let dirs = [];
try { dirs = fs.readdirSync(ROOT); } catch {}
for (const d of dirs) {
  const dir = path.join(ROOT, d);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
  for (const f of files) {
    try {
      const s = readSession(path.join(dir, f), d);
      if (s) sessions.push(s);
    } catch {}
  }
}
const live = liveIds();
for (const s of sessions) s.live = live.has(s.id);
sessions.sort((a, b) => b.mtime - a.mtime);
process.stdout.write(JSON.stringify(sessions));
