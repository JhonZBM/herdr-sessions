// Sessions: your Claude Code sessions grouped by folder, with search and resume.
// Same view in two modes: popup (mod.open sessions, the default) or a docked block in a layout.
// Reads ~/.claude/projects only on open and on refresh (no timers).
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, panes, exec, home, run, theme, props, closeOverlay, window } from "herdr";

const SCRIPT = () => `${home()}/.config/herdr-app/mods/sessions/index.js`;
const ICON = (name) => `mods/sessions/${name}.svg`;
const pref = (k, d) => { try { return localStorage.getItem(`sessions.${k}`) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(`sessions.${k}`, v); } catch {} };
const DEFAULT_LINKS = [["Projects", "https://claude.ai/projects"], ["Chats", "https://claude.ai/recents"]];
const URL_RE = /^https:\/\/claude\.ai\/[\w\-./?=%#]*$/; // the only links that are ever stored or launched
// Browsers: [id, short label, windows exe, macOS app, linux exe, private flag, new-window flag]
const BROWSERS = [
  ["default", "Default"],
  ["brave", "Brave", "brave", "Brave Browser", "brave-browser", "--incognito", "--new-window"],
  ["chrome", "Chrome", "chrome", "Google Chrome", "google-chrome", "--incognito", "--new-window"],
  ["edge", "Edge", "msedge", "Microsoft Edge", "microsoft-edge", "--inprivate", "--new-window"],
  ["firefox", "Firefox", "firefox", "Firefox", "firefox", "-private-window", "-new-window"],
];
const MODES = [["normal", "Normal"], ["window", "New window"], ["private", "Private"]];

// The command to open `url`: [command, args] (argv only, never a shell string) or null.
// Default browser + Normal is handled by cx.open_url; Default + other modes is not offered (unknown browser).
function launchArgv(browser, mode, platform, url) {
  if (!URL_RE.test(url)) return null;
  const b = BROWSERS.find((x) => x[0] === browser);
  if (!b || !b[2]) return null;
  const flags = mode === "private" ? [b[5]] : mode === "window" ? [b[6]] : [];
  if (platform === "windows") return ["cmd", ["/c", "start", "", b[2], ...flags, url]];
  if (platform === "macos") return mode === "normal" ? ["open", ["-a", b[3], url]] : ["open", ["-na", b[3], "--args", ...flags, url]];
  return [b[4], [...flags, url]];
}

// Saved choice. Older builds stored one combined value ("brave", "chrome", ... meaning the private mode)
// and no mode: a named browser without a saved mode is migrated to that browser + "private".
function loadChoice() {
  let browser = pref("browser", "default");
  let mode = null;
  try { mode = localStorage.getItem("sessions.mode"); } catch {}
  if (/^(brave|chrome|edge|firefox)-/.test(browser)) browser = browser.split("-")[0]; // brave-private, chrome-incognito...
  if (!BROWSERS.some((b) => b[0] === browser)) browser = "default";
  if (mode === null) {
    mode = browser === "default" ? "normal" : "private";
    setPref("browser", browser);
    setPref("mode", mode);
  }
  if (!MODES.some((m) => m[0] === mode) || browser === "default") mode = "normal";
  return [browser, mode];
}
const loadLinks = () => {
  try {
    const v = JSON.parse(pref("links", "[]"));
    return Array.isArray(v) ? v.filter((l) => l && typeof l.name === "string" && URL_RE.test(String(l.url))) : [];
  } catch { return []; }
};

function ago(ms) {
  const m = Math.max(0, Date.now() - ms) / 60000;
  if (m < 1) return "now";
  if (m < 60) return `${Math.floor(m)} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  if (m < 43200) return `${Math.floor(m / 1440)} d`;
  return new Date(ms).toLocaleDateString("en", { day: "numeric", month: "short" });
}

export default class Sessions extends View {
  init(_props, cx) {
    this.popup = !!props()?.overlay; // opened with mod.open: a popup instead of a docked block
    this.sessions = [];
    this.loading = true;
    this.error = "";
    this.filter = "";
    this.collapsed = {};
    this.links = loadLinks();
    [this.browser, this.mode] = loadChoice();
    this.notice = ""; // id of a live row whose terminal was not found
    this.hint = ""; // inline hint of the claude.ai section
    this.linkHov = "";
    this.hov = ""; // cwd of the hovered group heading
    this.menu = false; // open dropdown: false | "sort" | "browser" (one at a time)
    this.handle = cx.focus_handle(); // lets Esc reach the root while the search has focus
    this.sortBy = pref("sort", "recent"); // recent | name
    this.grouped = pref("group", "on") !== "off"; // off: one flat list by date
    this.input = InputState.new({ placeholder: "Search sessions…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value().trim().toLowerCase();
      this.notice = "";
      this.hint = "";
      cx.notify();
    });
    this.load(cx);
    if (this.popup) this.input.focus();
  }

  load(cx) {
    this.loading = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("node", [SCRIPT()], { timeout: 15000 });
        this.sessions = JSON.parse(r.stdout || "[]");
        this.error = "";
      } catch (e) {
        this.error = String(e?.message ?? e).slice(0, 160);
      }
      this.loading = false;
      cx.notify();
    });
  }

  // The herdr terminal running a live session: the agent title carries the session name (strong
  // signal); else the only Claude pane whose folder matches (weak signal, must be unambiguous).
  findLive(s) {
    const norm = (p) => String(p ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const isClaude = (x) => /claude/i.test(`${x.app ?? ""} ${x.program?.key ?? ""}`);
    const name = (s.name ?? "").toLowerCase();
    if (name) {
      const a = agents().find((x) => isClaude(x) && String(x.title ?? "").toLowerCase().includes(name));
      if (a) return a.pane;
    }
    const m = panes().filter((p) => p.terminal && isClaude(p) && norm(p.cwd) === norm(s.cwd));
    return m.length === 1 ? m[0].pane : null;
  }

  resume(s, cx) {
    this.notice = "";
    if (s.live) {
      // Never `claude --resume` a running session: jump to its terminal (pane.focus, like the agents list).
      const pane = this.findLive(s);
      if (pane) {
        run("pane.focus", { pane });
        if (this.popup) closeOverlay(props()?.overlay);
      } else {
        this.notice = s.id;
        cx?.notify();
      }
      return;
    }
    run("tab.new", { name: s.title.slice(0, 40), folder: s.cwd, argv: ["claude", "--resume", s.id] });
    if (this.popup) closeOverlay(props()?.overlay); // get out of the way once a session opens
  }

  // Open a claude.ai link in the chosen browser; the URL is re-validated and only argv arrays are used.
  openLink(url, cx) {
    if (!URL_RE.test(url)) return;
    const argv = launchArgv(this.browser, this.mode, window()?.platform, url);
    if (!argv) return cx.open_url(url);
    exec(argv[0], argv[1]).catch(() => {});
    if (this.popup) closeOverlay(props()?.overlay);
  }

  // Pin the claude.ai link in the clipboard; name = typed text, else the last path segment.
  pinLink(cx) {
    const url = (cx.read_from_clipboard() ?? "").trim();
    if (!URL_RE.test(url)) { this.hint = "Copy a claude.ai link first"; return cx.notify(); }
    if (this.links.some((l) => l.url === url)) { this.hint = "Already pinned"; return cx.notify(); }
    const typed = this.input.value().trim().slice(0, 40);
    const seg = decodeURIComponent(url.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "claude.ai");
    this.links = [...this.links, { name: typed || seg.slice(0, 40), url }];
    setPref("links", JSON.stringify(this.links));
    this.hint = "";
    if (typed) { this.input.set_value?.(""); this.filter = ""; }
    cx.notify();
  }

  unpin(url, cx) {
    this.links = this.links.filter((l) => l.url !== url);
    setPref("links", JSON.stringify(this.links));
    cx.notify();
  }

  groups() {
    const q = this.filter;
    const by = new Map();
    for (const s of this.sessions) {
      if (q && !`${s.title} ${s.last} ${s.cwd} ${s.branch}`.toLowerCase().includes(q)) continue;
      if (!by.has(s.cwd)) by.set(s.cwd, { cwd: s.cwd, project: s.project, worktree: s.worktree, items: [] });
      by.get(s.cwd).items.push(s);
    }
    const out = [...by.values()]; // already sorted by date: most recent folder first
    if (this.sortBy === "name") out.sort((a, b) => a.project.localeCompare(b.project));
    return out;
  }

  // One line per session, 28px pitch: title left, age right in `dim`. A live session (running in a
  // Claude Code process) gets an accent dot and jumps to its terminal instead of resuming.
  row(s, t) {
    const branch = s.branch && s.branch !== "HEAD" ? `${s.branch}\n` : "";
    const tip = `${s.live ? "Open in herdr\n" : ""}${branch}${(s.last || s.title).slice(0, 110)}`;
    return div().id(`s-${s.id}`).h_flex().items_center().gap(8).h(28).px(10).rounded(6).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .active((x) => x.bg(t.selected))
      .on_click((_e, cx) => this.resume(s, cx))
      .tooltip(tip)
      .when(s.live, (el) => el.child(div().size(6).flex_none().rounded(3).bg(t.accent)))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(s.title))
      .child(div().flex_none().text_size(10.5).text_color(t.dim).child(this.notice === s.id ? "running outside herdr" : ago(s.mtime)));
  }

  newSession(g) {
    run("tab.new", { name: g.project, folder: g.cwd, argv: ["claude"] });
    if (this.popup) closeOverlay(props()?.overlay);
  }

  // Small icon button inside a heading; its press must not fold the group.
  tool(id, icon, tip, t, fn) {
    return div().id(id).flex_none().p(4).rounded(5).cursor_pointer().text_color(t.muted)
      .hover((x) => x.bg(t.raised).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); })
      .tooltip(tip)
      .child(svg(ICON(icon)).size(13));
  }

  // Heading: bold name + crisp chevron; on hover the count gives way to "sort" and "+" buttons.
  head(g, t, first) {
    const open = !(this.collapsed[g.cwd] && !this.filter);
    const hot = this.hov === g.cwd;
    return h_flex().id(`g-${g.cwd}`).gap(4).items_center().h(26).px(10).mt(first ? 2 : 16).rounded(6).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .on_hover((on, cx) => {
        if (on && this.hov !== g.cwd) { this.hov = g.cwd; cx.notify(); }
        else if (!on && this.hov === g.cwd) { this.hov = ""; cx.notify(); }
      })
      .on_click((_e, cx) => { this.collapsed[g.cwd] = open; cx.notify(); })
      .tooltip(g.cwd)
      .child(div().min_w(0).truncate().text_size(12).font_bold().text_color(t.foreground).child(g.project))
      .child(svg(ICON(open ? "chevron-down" : "chevron-right")).size(13).flex_none().text_color(hot ? t.foreground : t.muted))
      .when(g.worktree, (el) => el.child(div().flex_none().ml(2).text_size(9.5).text_color(t.dim).child("worktree")))
      .child(div().flex_1())
      .when(!hot, (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(String(g.items.length))))
      .when(hot, (el) => el
        .child(this.tool(`sort-${g.cwd}`, "sort", "Sort and group", t, (cx) => { this.toggleMenu("sort", cx); }))
        .child(this.tool(`new-${g.cwd}`, "plus", `New session in ${g.project}`, t, () => this.newSession(g))));
  }

  // Dropdown under the header: sort groups by Recent | Name, group by folder on | off.
  toggleMenu(kind, cx) {
    this.menu = this.menu === kind ? false : kind; // opening one closes the other
    cx.notify();
  }

  // Dropdown for the claude.ai chip, opening upward from the section: pick the browser/mode for links.
  browserMenu(t, opt) {
    const title = (x) => div().px(8).pt(6).pb(2).text_size(10).font_semibold().text_color(t.dim).child(x);
    const dflt = this.browser === "default";
    return v_flex().id("sessions-browser-menu").absolute().bottom(this.linksHeight()).right(14).w(190).p(4).rounded(8).bg(t.popover)
      .border_1().border_color(t.border).shadow_md()
      .child(title("Browser"))
      .children(BROWSERS.map(([id, label]) => opt(`m-b-${id}`, label, this.browser === id, () => {
        this.browser = id; setPref("browser", id);
        if (id === "default") { this.mode = "normal"; setPref("mode", "normal"); }
      }, false, true)))
      .child(title(dflt ? "Mode (pick a browser)" : "Mode"))
      .children(MODES.map(([id, label]) => opt(`m-m-${id}`, label, this.mode === id, () => { this.mode = id; setPref("mode", id); }, dflt && id !== "normal")));
  }

  // Height of the claude.ai section, to anchor its dropdown right above it.
  linksHeight() {
    return 4 + 24 + Math.min(112, 24 * (this.links.length + DEFAULT_LINKS.length)) + 6 + 1;
  }

  menuView(t) {
    const opt = (id, label, on, fn, off = false, keep = false) => h_flex().id(id).items_center().gap(8).h(26).px(8).rounded(5).when(off, (x) => x.opacity(0.4), (x) => x.cursor_pointer())
      .when(!off, (x) => x.hover((y) => y.bg(t.hover)))
      .on_click((_e, cx) => { if (off) return; fn(); if (!keep) this.menu = false; cx.notify(); }) // a browser pick keeps the menu open for the mode
      .child(div().w(12).flex_none().when(on, (el) => el.child(svg(ICON("check")).size(12).text_color(t.accent))))
      .child(div().text_size(12).text_color(t.foreground).child(label));
    if (this.menu === "browser") return this.browserMenu(t, opt);
    const title = (x) => div().px(8).pt(6).pb(2).text_size(10).font_semibold().text_color(t.dim).child(x);
    return v_flex().id("sessions-menu").absolute().top(78).right(14).w(190).p(4).rounded(8).bg(t.popover)
      .border_1().border_color(t.border).shadow_md()
      .child(title("Sort groups by"))
      .child(opt("m-recent", "Recent", this.sortBy === "recent", () => { this.sortBy = "recent"; setPref("sort", "recent"); }))
      .child(opt("m-name", "Name", this.sortBy === "name", () => { this.sortBy = "name"; setPref("sort", "name"); }))
      .child(title("Group by folder"))
      .child(opt("m-on", "On", this.grouped, () => { this.grouped = true; setPref("group", "on"); }))
      .child(opt("m-off", "Off (flat list by date)", !this.grouped, () => { this.grouped = false; setPref("group", "off"); }));
  }

  // Compact "Browser · mode": just the browser when Normal, "Default" alone for the default browser.
  browserLabel() {
    const name = BROWSERS.find((b) => b[0] === this.browser)?.[1] ?? "Default";
    const mode = this.mode === "normal" ? "" : ` · ${MODES.find((m) => m[0] === this.mode)?.[1].toLowerCase()}`;
    return name + mode;
  }

  // One claude.ai row: name and a small arrow; pinned ones show an "x" on hover.
  linkRow(name, url, t, pinned) {
    const hot = this.linkHov === url;
    return h_flex().id(`l-${url}`).h(24).px(10).gap(6).items_center().rounded(6).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .on_hover((on, cx) => {
        if (on && this.linkHov !== url) { this.linkHov = url; cx.notify(); }
        else if (!on && this.linkHov === url) { this.linkHov = ""; cx.notify(); }
      })
      .on_click((_e, cx) => this.openLink(url, cx))
      .tooltip("Open in " + (this.browser === "default" ? "default browser" : this.browserLabel()) + String.fromCharCode(10) + url)
      .child(div().min_w(0).truncate().text_size(12).text_color(t.foreground).child(name))
      .child(svg(ICON("external")).size(10).flex_none().text_color(t.dim))
      .child(div().flex_1())
      .when(pinned && hot, (el) => el.child(this.tool(`unpin-${url}`, "close", "Remove", t, (cx) => this.unpin(url, cx))));
  }

  // "claude.ai" section: pinned links, then the two defaults. Fixed under the list, capped in height.
  linksView(t) {
    const hot = this.linkHov === "head";
    return v_flex().flex_none().border_t(1).border_color(t.border).px(6).pb(6)
      .child(h_flex().id("links-head").gap(4).items_center().h(24).px(10).mt(4)
        .on_hover((on, cx) => {
          if (on && this.linkHov !== "head") { this.linkHov = "head"; cx.notify(); }
          else if (!on && this.linkHov === "head") { this.linkHov = ""; cx.notify(); }
        })
        .child(div().text_size(11).font_semibold().text_color(t.muted).child("claude.ai"))
        .child(div().flex_1())
        .when(this.hint, (el) => el.child(div().min_w(0).truncate().text_size(10.5).text_color(t.dim).child(this.hint)))
        .child(h_flex().id("browser-chip").h(20).px(6).gap(3).flex_none().items_center().rounded(5).cursor_pointer()
          .text_size(10.5).text_color(t.muted).bg(t.raised)
          .hover((x) => x.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => this.toggleMenu("browser", cx)).tooltip("Open links in…")
          .child(this.browserLabel())
          .child(svg(ICON("chevron-down")).size(10).flex_none()))
        .when(hot, (el) => el.child(this.tool("pin-link", "plus", "Pin the link in your clipboard", t, (cx) => this.pinLink(cx)))))
      .child(v_flex().max_h(112).overflow_y_scrollbar()
        .children([...this.links.map((l) => this.linkRow(l.name, l.url, t, true)), ...DEFAULT_LINKS.map(([n, u]) => this.linkRow(n, u, t, false))]));
  }

  render(_cx) {
    const t = theme();
    const groups = this.groups();
    const list = v_flex().flex_1().min_h(0).px(6).pb(8).overflow_y_scrollbar();
    if (this.error) list.child(div().p(10).text_size(11).text_color(t.dim).child(`Could not read: ${this.error}`));
    else if (!groups.length) list.child(div().p(10).text_size(11).text_color(t.dim).child(this.loading ? "Reading sessions…" : "No results"));
    if (this.grouped) groups.forEach((g, i) => {
      list.child(this.head(g, t, i === 0));
      if (!(this.collapsed[g.cwd] && !this.filter)) for (const s of g.items) list.child(this.row(s, t));
    });
    else for (const s of groups.flatMap((g) => g.items).sort((a, b) => b.mtime - a.mtime)) list.child(this.row(s, t));
    return v_flex().id("sessions").relative().track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.menu) { this.menu = false; cx.stop_propagation(); cx.notify(); } // Esc closes the menu first
      })
      .when(this.popup, (e) => e.w_full().h(560), (e) => e.size_full()).bg(this.popup ? t.popover : t.surface).text_size(12)
      .child(h_flex().items_center().gap(6).px(14).pt(12).pb(8)
        .child(div().flex_1().text_size(12.5).font_semibold().text_color(t.foreground).child("Sessions"))
        .child(div().id("sessions-sort").p(4).rounded(5).cursor_pointer()
          .when(this.menu === "sort", (x) => x.bg(t.raised)) // pressed look while the menu is open
          .hover((x) => x.bg(t.hover))
          .on_click((_e, cx) => this.toggleMenu("sort", cx)).tooltip("Sort and group")
          .child(svg(ICON("sort")).size(12).text_color(t.dim)))
        .child(div().id("sessions-refresh").p(4).rounded(5).cursor_pointer()
          .hover((x) => x.bg(t.hover))
          .on_click((_e, cx) => this.load(cx)).tooltip("Refresh")
          .child(svg(ICON("refresh")).size(12).text_color(t.dim))))
      .child(h_flex().h(28).flex_none().mx(12).mb(6).px(8).items_center().rounded(6).border_1().border_color(t.border).bg(t.background)
        .child(Input.new(this.input).flex_1().h_full().text_size(11.5).text_color(t.foreground)))
      .child(list)
      .child(this.linksView(t))
      // A transparent layer under the menu: any click outside it only closes the menu.
      .when(this.menu, (el) => el
        .child(div().id("sessions-menu-away").absolute().inset_0()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); this.menu = false; cx.notify(); }))
        .child(this.menuView(t)));
  }
}
