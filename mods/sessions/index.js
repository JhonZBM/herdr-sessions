// Lists agent sessions (Claude Code, Codex, Antigravity) by reading what each CLI already keeps on
// disk. Only the head and tail of each transcript are read. Prints JSON. No dependencies, no cache.
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const HEAD = 48 * 1024;
const TAIL = 96 * 1024;
const MAX_OTHER = 200; // cap per non-Claude agent: keeps the cost flat however old the history is

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

const base = (cwd) => path.basename(cwd.replace(/[\/]+$/, ""));

function session(agent, f) {
  return {
    id: f.id, cwd: f.cwd, project: base(f.cwd),
    worktree: /[\/]\.claude[\/]worktrees[\/]/.test(f.cwd),
    title: f.title || "(untitled)", name: f.name || "", last: (f.last || "").slice(0, 200),
    branch: f.branch || "", mtime: f.mtime, live: !!f.live, agent,
  };
}

// ---- Claude Code: ~/.claude/projects/<folder>/<id>.jsonl ------------------------------------

function readClaude(file) {
  const st = fs.statSync(file);
  const fd = fs.openSync(file, "r");
  try {
    const head = records(slice(fd, 0, Math.min(HEAD, st.size)), false, st.size > HEAD);
    const tailStart = Math.max(0, st.size - TAIL);
    const tail = st.size > HEAD ? records(slice(fd, tailStart, st.size - tailStart), tailStart > 0, false) : [];
    let cwd = "", branch = "", title = "", last = "", name = "";
    for (const r of head.concat(tail)) {
      if (!cwd && r.cwd) cwd = r.cwd;
      if (r.gitBranch) branch = r.gitBranch;
      if (r.type === "ai-title" && r.aiTitle) title = r.aiTitle;
      if (r.type === "last-prompt" && r.lastPrompt) last = r.lastPrompt;
      if (r.type === "agent-name" && r.agentName) name = r.agentName;
    }
    if (!cwd) return null;
    return session("claude", {
      id: path.basename(file, ".jsonl"), cwd, title: title || last.slice(0, 80), name, last, branch,
      mtime: Math.floor(st.mtimeMs),
    });
  } finally {
    fs.closeSync(fd);
  }
}

// Claude Code keeps one small file per running process in ~/.claude/sessions/<pid>.json.
// A session is "live" when its process is still alive (signal 0 only checks, it sends nothing).
function liveIds() {
  const dir = path.join(HOME, ".claude", "sessions");
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

function claude() {
  const root = path.join(HOME, ".claude", "projects");
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return out; }
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      try { const s = readClaude(path.join(root, d, f)); if (s) out.push(s); } catch {}
    }
  }
  const live = liveIds();
  for (const s of out) s.live = live.has(s.id);
  return out;
}

// ---- Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl ------------------------------------
// The first record (session_meta) has the id and folder; session_index.jsonl has the thread names.

function codex() {
  const root = path.join(HOME, ".codex", "sessions");
  const names = new Map();
  try {
    for (const r of records(fs.readFileSync(path.join(HOME, ".codex", "session_index.jsonl"), "utf8"), false, false)) {
      if (r.id && r.thread_name) names.set(r.id, r.thread_name);
    }
  } catch {}
  const desc = (dir) => { try { return fs.readdirSync(dir).sort().reverse(); } catch { return []; } };
  const files = [];
  for (const y of desc(root)) for (const m of desc(path.join(root, y))) for (const d of desc(path.join(root, y, m))) {
    for (const f of desc(path.join(root, y, m, d))) {
      if (f.endsWith(".jsonl")) files.push(path.join(root, y, m, d, f));
    }
    if (files.length >= MAX_OTHER) break;
  }
  const out = [];
  for (const file of files.slice(0, MAX_OTHER)) {
    try {
      const st = fs.statSync(file);
      const fd = fs.openSync(file, "r");
      let recs;
      try { recs = records(slice(fd, 0, Math.min(HEAD, st.size)), false, st.size > HEAD); } finally { fs.closeSync(fd); }
      const meta = recs.find((r) => r.type === "session_meta")?.payload;
      if (!meta || !meta.id || !meta.cwd) continue;
      let title = names.get(meta.id) || "";
      let last = "";
      for (const r of recs) {
        const it = r.type === "event_msg" && r.payload?.type === "item_completed" ? r.payload.item : null;
        if (it?.type !== "UserMessage") continue;
        const text = (it.content || []).map((c) => c.text || "").join(" ");
        const line = text.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#") && !l.startsWith("-"));
        if (line) { last = line; break; }
      }
      out.push(session("codex", { id: meta.id, cwd: meta.cwd, title: title || last.slice(0, 80), last, mtime: Math.floor(st.mtimeMs) }));
    } catch {}
  }
  return out;
}

// ---- Antigravity (agy): ~/.gemini/antigravity/conversation_summaries.db (SQLite) ------------
// Read-only through node:sqlite (built into Node 22.5+); skipped when it is missing.

function agy() {
  const db = path.join(HOME, ".gemini", "antigravity", "conversation_summaries.db");
  if (!fs.existsSync(db)) return [];
  const { DatabaseSync } = require("node:sqlite");
  const d = new DatabaseSync(db, { readOnly: true });
  try {
    const rows = d.prepare(
      "SELECT conversation_id id, title, preview, last_modified_time t, workspace_uris w FROM conversation_summaries " +
      "WHERE parent_conversation_id = '' AND step_count > 0 ORDER BY last_modified_time DESC LIMIT ?"
    ).all(MAX_OTHER);
    const out = [];
    for (const r of rows) {
      const uri = String(r.w || "").split(/[\s,;\[\]"]+/).find((u) => u.startsWith("file://"));
      if (!uri) continue;
      let cwd = decodeURIComponent(uri.replace(/^file:\/\//, ""));
      if (/^\/[A-Za-z]:/.test(cwd)) cwd = cwd.slice(1);
      out.push(session("agy", { id: r.id, cwd, title: r.title || String(r.preview || "").slice(0, 80), last: r.preview, mtime: Date.parse(r.t) || 0 }));
    }
    return out;
  } finally {
    d.close();
  }
}

// ---- Run: one agent failing never hides the others ------------------------------------------

process.removeAllListeners("warning"); // node:sqlite prints an "experimental" warning on stderr
const all = [];
for (const read of [claude, codex, agy]) {
  try { all.push(...read()); } catch {}
}
all.sort((a, b) => b.mtime - a.mtime);
process.stdout.write(JSON.stringify(all));
