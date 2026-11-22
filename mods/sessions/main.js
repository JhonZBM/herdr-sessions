// Sessions: your Claude Code sessions grouped by folder, with search and resume.
// Same view in two modes: popup (mod.open sessions, the default) or a docked block in a layout.
// Reads ~/.claude/projects only on open and on refresh (no timers).
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, home, run, theme, props, closeOverlay } from "herdr";

const SCRIPT = () => `${home()}/.config/herdr-app/mods/sessions/index.js`;
const ICON = (name) => `mods/sessions/${name}.svg`;
const pref = (k, d) => { try { return localStorage.getItem(`sessions.${k}`) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(`sessions.${k}`, v); } catch {} };
const LINKS = [["Projects", "https://claude.ai/projects"], ["Chats", "https://claude.ai/recents"]];

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
    this.hov = ""; // cwd of the hovered group heading
    this.menu = false; // sort/group dropdown open
    this.handle = cx.focus_handle(); // lets Esc reach the root while the search has focus
    this.sortBy = pref("sort", "recent"); // recent | name
    this.grouped = pref("group", "on") !== "off"; // off: one flat list by date
    this.input = InputState.new({ placeholder: "Search sessions…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value().trim().toLowerCase();
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

  resume(s) {
    run("tab.new", { name: s.title.slice(0, 40), folder: s.cwd, argv: ["claude", "--resume", s.id] });
    if (this.popup) closeOverlay(props()?.overlay); // get out of the way once a session opens
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

  // One line per session, 28px pitch: title left, age right in `dim`. The branch lives in the tooltip.
  row(s, t) {
    const branch = s.branch && s.branch !== "HEAD" ? `${s.branch}\n` : "";
    return div().id(`s-${s.id}`).h_flex().items_center().gap(10).h(28).px(10).rounded(6).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .active((x) => x.bg(t.selected))
      .on_click(() => this.resume(s))
      .tooltip(`${branch}${(s.last || s.title).slice(0, 110)}`)
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(s.title))
      .child(div().flex_none().text_size(10.5).text_color(t.dim).child(ago(s.mtime)));
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
        .child(this.tool(`sort-${g.cwd}`, "sort", "Sort and group", t, (cx) => { this.menu = !this.menu; cx.notify(); }))
        .child(this.tool(`new-${g.cwd}`, "plus", `New session in ${g.project}`, t, () => this.newSession(g))));
  }

  // Dropdown under the header: sort groups by Recent | Name, group by folder on | off.
  menuView(t) {
    const opt = (id, label, on, fn) => h_flex().id(id).items_center().gap(8).h(26).px(8).rounded(5).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .on_click((_e, cx) => { fn(); this.menu = false; cx.notify(); })
      .child(div().w(12).flex_none().when(on, (el) => el.child(svg(ICON("check")).size(12).text_color(t.accent))))
      .child(div().text_size(12).text_color(t.foreground).child(label));
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

  link([label, url], t) {
    return h_flex().id(`l-${label}`).flex_1().h(24).gap(4).rounded(5).items_center().justify_center()
      .text_size(11).text_color(t.muted).bg(t.raised).cursor_pointer()
      .hover((x) => x.text_color(t.foreground).bg(t.hover))
      .on_click((_e, cx) => cx.open_url(url))
      .child(label)
      .child(svg(ICON("external")).size(10).flex_none());
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
      .when(this.popup, (e) => e.w_full().h(520), (e) => e.size_full()).bg(this.popup ? t.popover : t.surface).text_size(12)
      .child(h_flex().items_center().gap(6).px(14).pt(12).pb(8)
        .child(div().flex_1().text_size(12.5).font_semibold().text_color(t.foreground).child("Sessions"))
        .child(div().id("sessions-sort").p(4).rounded(5).cursor_pointer()
          .when(this.menu, (x) => x.bg(t.raised)) // pressed look while the menu is open
          .hover((x) => x.bg(t.hover))
          .on_click((_e, cx) => { this.menu = !this.menu; cx.notify(); }).tooltip("Sort and group")
          .child(svg(ICON("sort")).size(12).text_color(t.dim)))
        .child(div().id("sessions-refresh").p(4).rounded(5).cursor_pointer()
          .hover((x) => x.bg(t.hover))
          .on_click((_e, cx) => this.load(cx)).tooltip("Refresh")
          .child(svg(ICON("refresh")).size(12).text_color(t.dim))))
      .child(h_flex().h(28).flex_none().mx(12).mb(6).px(8).items_center().rounded(6).border_1().border_color(t.border).bg(t.background)
        .child(Input.new(this.input).flex_1().h_full().text_size(11.5).text_color(t.foreground)))
      .child(list)
      .child(h_flex().gap(4).p(6).border_t(1).border_color(t.border).children(LINKS.map((l) => this.link(l, t))))
      // A transparent layer under the menu: any click outside it only closes the menu.
      .when(this.menu, (el) => el
        .child(div().id("sessions-menu-away").absolute().inset_0()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); this.menu = false; cx.notify(); }))
        .child(this.menuView(t)));
  }
}
