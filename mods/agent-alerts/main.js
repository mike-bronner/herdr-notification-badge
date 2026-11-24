import { View, div } from "gpui-kit";
import { agents, terminals, focused, window, exec, run, appHome, setBadge, checking } from "herdr";
import { badgeText, bannerFocus, compare, jumpTo, movedOn, needsYou } from "./watch.js";
import { askOnce, clickCommand, deliver, groupOf, notifierArgs, rememberSenders, removeEverywhere } from "./banner.js";

const FOLDER = "mods/agent-alerts";
const BINARY = "Contents/MacOS/terminal-notifier";
const COPIES = { light: "HerdrNotifierDark.app", dark: "HerdrNotifier.app" };
const TIMEOUT = 10000;

export default class AgentAlerts extends View {
  init(_props, cx) {
    this.statuses = null;
    this.banners = new Map();
    this.senders = new Map();
    this.prompted = new Set();
    this.jobs = [];
    this.draining = false;
    this.shown = undefined;
    this.active = null;
    this.focus = null;
    this.clickedAt = null;
    this.own = {};
    this.bundles = new Map();
    for (const [appearance, name] of Object.entries(COPIES)) {
      const bundle = `${appHome()}/${FOLDER}/${name}`;
      this.own[appearance] = `${bundle}/${BINARY}`;
      this.bundles.set(this.own[appearance], bundle);
    }
    if (checking()) return;
    cx.timer.every(2000, (cx) => this.refresh(cx));
  }

  live() {
    return !checking() && window()?.platform === "macos";
  }

  refresh(cx) {
    if (!this.live()) return;
    let badge, result, target;
    try {
      const list = agents();
      const terms = terminals();
      const win = window();
      const focus = focused();
      const now = Date.now();
      badge = badgeText(needsYou(list, terms));
      result = compare(this.statuses, list, terms, Boolean(win?.active));
      if (bannerFocus(this.banners, list, this.focus, focus)) this.clickedAt = now;
      target = jumpTo({ was: this.active, win, focus, agents: list, terminals: terms, banners: this.banners, now, clickedAt: this.clickedAt });
      this.active = Boolean(win?.active);
      this.focus = focus;
    } catch {
      return;
    }
    if (target) this.jump(target);
    this.badge(badge);
    this.statuses = result.statuses;
    for (const address of movedOn(this.banners, result.statuses)) {
      this.banners.delete(address);
      this.queue(cx, () => this.remove(address));
    }
    for (const alert of result.alerts) {
      this.banners.set(alert.address, alert.status);
      this.queue(cx, () => this.post(alert));
    }
  }

  jump(address) {
    try {
      run("agent.focus", { terminal: address });
    } catch {}
  }

  badge(text) {
    if (text === this.shown) return;
    setBadge(text);
    this.shown = text;
  }

  queue(cx, job) {
    this.jobs.push(job);
    if (this.draining) return;
    this.draining = true;
    cx.spawn(async () => {
      while (this.jobs.length) await this.jobs.shift()().catch(() => {});
      this.draining = false;
    });
  }

  async post(alert) {
    const herdrApp = await this.herdrApp();
    const args = notifierArgs(alert, herdrApp && clickCommand(herdrApp, alert.address));
    const launch = (bundle) => exec("/usr/bin/open", ["-n", bundle, "--args", ...args], { timeout: TIMEOUT });
    const sent = await deliver({
      dark: await this.dark(),
      own: this.own,
      others: ["terminal-notifier"],
      run: (notifier) => exec(notifier, args, { timeout: TIMEOUT }),
      ask: (refused) => askOnce(refused, this.bundles, this.prompted, launch),
      fallback: () => this.appleScript(alert),
    });
    rememberSenders(this.senders, alert.address, sent);
  }

  remove(address) {
    return removeEverywhere(this.senders, address, (notifier) => exec(notifier, ["-remove", groupOf(address)], { timeout: TIMEOUT }));
  }

  async dark() {
    const r = await exec("/usr/bin/defaults", ["read", "-g", "AppleInterfaceStyle"], { timeout: TIMEOUT }).catch(() => null);
    return r?.code === 0 && r.stdout.trim() === "Dark";
  }

  herdrApp() {
    this.herdrAppPath ??= exec("/usr/bin/which", ["herdr-app"], { timeout: TIMEOUT }).then(
      (r) => (r.code === 0 && r.stdout.trim()) || null,
      () => null,
    );
    return this.herdrAppPath;
  }

  async appleScript(alert) {
    const lines = ["on run {heading, place, message}", "display notification message with title heading subtitle place", "end run"];
    await exec("/usr/bin/osascript", [...lines.flatMap((line) => ["-e", line]), alert.title, alert.subtitle, alert.body], { timeout: TIMEOUT });
  }

  close() {
    if (!checking()) setBadge(null);
  }

  render(cx) {
    this.refresh(cx);
    return div().id("agent-alerts").size_full();
  }
}
