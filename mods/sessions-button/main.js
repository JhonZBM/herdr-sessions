// Sessions button: a native-looking top-bar entry point that opens the `sessions` popup.
// Meant for a small block next to the tab bar; same look as the tab bar's Files / Changes buttons.
import { View, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme } from "herdr";

export default class SessionsButton extends View {
  render(_cx) {
    const t = theme();
    return h_flex().size_full().min_w(0).pl(10).pr(2).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("sessions-open").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).text_color(t.muted).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation()) // do not start a window drag
        .on_click(() => run("mod.open", { name: "sessions" }))
        .tooltip("Session history (Ctrl+Shift+S)")
        .child(svg("mods/sessions-button/history.svg").size(14))
        .child("Sessions"));
  }
}
