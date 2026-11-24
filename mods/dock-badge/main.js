import { View, div } from "gpui-kit";
import { agents, terminals, setBadge, checking } from "herdr";
import { needsYou, badgeText } from "./count.js";

export default class DockBadge extends View {
  init(_props, cx) {
    this.shown = undefined;
    if (checking()) return;
    cx.timer.every(2000, () => this.refresh());
  }

  refresh() {
    if (checking()) return;
    let text;
    try {
      text = badgeText(needsYou(agents(), terminals()));
    } catch {
      return;
    }
    if (text === this.shown) return;
    setBadge(text);
    this.shown = text;
  }

  close() {
    if (!checking()) setBadge(null);
  }

  render() {
    this.refresh();
    return div().id("dock-badge").size_full();
  }
}
