import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { NOT_ALLOWED, askOnce, clickCommand, deliver, firstToPost, notifierArgs, notifierOrder, rememberSenders, removeEverywhere } from "../mods/agent-alerts/banner.js";
import { compare } from "../mods/agent-alerts/watch.js";

const own = { light: "/m/HerdrNotifierDark.app/bin", dark: "/m/HerdrNotifier.app/bin" };
const missing = () => Promise.reject(new Error("no such file"));

test("the copy that matches the appearance goes first, then the other, then the rest", () => {
  assert.deepEqual(notifierOrder(false, own, ["terminal-notifier"]), [own.light, own.dark, "terminal-notifier"]);
  assert.deepEqual(notifierOrder(true, own, ["terminal-notifier"]), [own.dark, own.light, "terminal-notifier"]);
  assert.deepEqual(notifierOrder(true, {}, ["terminal-notifier"]), ["terminal-notifier"]);
});

test("the first notifier that posts wins, and refusals are collected", async () => {
  const codes = { a: NOT_ALLOWED, b: 1, c: 0, d: 0 };
  const tried = [];
  const result = await firstToPost(["x", "a", "b", "c", "d"], (n) => {
    tried.push(n);
    return n === "x" ? missing() : Promise.resolve({ code: codes[n] });
  });
  assert.deepEqual(result, { via: "c", refused: ["a"] });
  assert.deepEqual(tried, ["x", "a", "b", "c"]);
});

test("with no copies built, terminal-notifier posts the alert", async () => {
  let fellBack = false;
  const sent = await deliver({
    dark: false,
    own,
    others: ["terminal-notifier"],
    run: (n) => (n === "terminal-notifier" ? Promise.resolve({ code: 0 }) : missing()),
    ask: async (refused) => (assert.deepEqual(refused, []), []),
    fallback: async () => (fellBack = true),
  });
  assert.deepEqual(sent, ["terminal-notifier"]);
  assert.equal(fellBack, false);
});

test("with no notifier at all, AppleScript posts the alert", async () => {
  let fellBack = false;
  const sent = await deliver({ dark: true, own, others: ["terminal-notifier"], run: missing, ask: async () => [], fallback: async () => (fellBack = true) });
  assert.deepEqual(sent, []);
  assert.equal(fellBack, true);
});

test("a refused copy is asked for permission, and AppleScript still posts this alert", async () => {
  let fellBack = false;
  const sent = await deliver({
    dark: false,
    own,
    others: [],
    run: (n) => Promise.resolve({ code: n === own.light ? NOT_ALLOWED : 1 }),
    ask: async (refused) => (assert.deepEqual(refused, [own.light]), [own.light]),
    fallback: async () => (fellBack = true),
  });
  assert.deepEqual(sent, [own.light]);
  assert.equal(fellBack, true);
});

const strictNotifier = (args) => {
  const unreadable = (value) => /^\s*[[({"<]/.test(value) || value.startsWith("-");
  const values = args.filter((_, i) => i % 2 === 1);
  const intact = values.every((value) => !value.startsWith("\\"));
  return { code: values.some(unreadable) ? 2 : 0, intact };
};
const herdrApp = "/opt/homebrew/bin/herdr-app";

test("the notifier arguments carry the banner text, group, app and click command", () => {
  const alert = { address: "t1", title: "Claude Code needs you", subtitle: "api › Tab 2", body: "Fix it" };
  assert.deepEqual(notifierArgs(alert, "focus t1"), [
    "-title", "Claude Code needs you", "-subtitle", "api › Tab 2", "-message", "Fix it",
    "-group", "herdr-agent-alerts-t1", "-activate", "dev.herdr.app", "-execute", "focus t1",
  ]);
  assert.deepEqual(notifierArgs({ ...alert, subtitle: "" }, null), [
    "-title", "Claude Code needs you", "-message", "Fix it", "-group", "herdr-agent-alerts-t1", "-activate", "dev.herdr.app",
  ]);
});

test("the click command reaches herdr-app intact through the shell", () => {
  const output = execFileSync("/bin/sh", ["-c", clickCommand("/bin/echo", "vps/it's")], { encoding: "utf8" });
  assert.equal(output, `do agent.focus {"terminal":"vps/it's"}\n`);
  assert.equal(strictNotifier(["-execute", clickCommand(herdrApp, "t1")]).code, 0);
});

test("text that starts with a character terminal-notifier cannot read still posts through the Herdr notifier", async () => {
  const fields = {
    title: (c) => ({ program: { name: `${c}Claude` } }),
    subtitle: (c) => ({ space_name: `${c}api` }),
    body: (c) => ({ title: `${c}WIP] login` }),
  };
  const cleaned = { title: "Claude needs you", subtitle: "api › Tab 2", body: "WIP] login" };
  for (const start of ["[", "(", "{", '"', "-", "<", "\\"]) {
    for (const [field, make] of Object.entries(fields)) {
      const blocked = { address: "t1", status: "blocked", tab: "x", space_name: "api", tab_name: "Tab 2", title: "login", program: { name: "Claude" }, ...make(start) };
      const [alert] = compare(new Map([["t1", "working"]]), [blocked], [], () => false).alerts;
      assert.equal(alert[field], cleaned[field], `${field} ${start} cleaned`);
      const raw = strictNotifier(notifierArgs({ ...alert, [field]: `${start}${alert[field]}` }, null));
      assert.ok(raw.code === 2 || !raw.intact, `${field} ${start} raw`);
      const args = notifierArgs(alert, clickCommand(herdrApp, alert.address));
      assert.deepEqual(strictNotifier(args), { code: 0, intact: true }, `${field} ${start} sent`);
      let fellBack = false;
      const sent = await deliver({
        dark: false,
        own,
        others: ["terminal-notifier"],
        run: async (n) => (n === own.light ? strictNotifier(args) : { code: 1 }),
        ask: async () => [],
        fallback: async () => (fellBack = true),
      });
      assert.deepEqual(sent, [own.light], `${field} ${start}`);
      assert.equal(fellBack, false, `${field} ${start}`);
    }
  }
});

test("a refused copy is launched for permission once, however many banners follow", async () => {
  const bundles = new Map([[own.light, "/m/HerdrNotifierDark.app"], [own.dark, "/m/HerdrNotifier.app"]]);
  const prompted = new Set();
  const launched = [];
  const launch = async (bundle) => (launched.push(bundle), { code: bundle === "/m/HerdrNotifier.app" ? 1 : 0 });
  const post = () => deliver({
    dark: false,
    own,
    others: ["terminal-notifier"],
    run: async () => ({ code: NOT_ALLOWED }),
    ask: (refused) => askOnce(refused, bundles, prompted, launch),
    fallback: async () => {},
  });
  assert.deepEqual(await post(), [own.light]);
  assert.deepEqual(await post(), []);
  assert.deepEqual(await post(), []);
  assert.deepEqual(launched, ["/m/HerdrNotifierDark.app", "/m/HerdrNotifier.app"]);
  assert.deepEqual([...prompted], [own.light, own.dark]);
});

test("a permission launch that fails to start is not reported as asked, and the next copy is still asked", async () => {
  const bundles = new Map([[own.light, "/m/HerdrNotifierDark.app"], [own.dark, "/m/HerdrNotifier.app"]]);
  const prompted = new Set();
  const launched = [];
  const launch = (bundle) => (launched.push(bundle), bundle === "/m/HerdrNotifierDark.app" ? Promise.reject(new Error("timed out")) : Promise.resolve({ code: 0 }));
  assert.deepEqual(await askOnce([own.light, own.dark], bundles, prompted, launch), [own.dark]);
  assert.deepEqual(launched, ["/m/HerdrNotifierDark.app", "/m/HerdrNotifier.app"]);
  assert.deepEqual([...prompted], [own.light, own.dark]);
  assert.deepEqual(await askOnce([own.light], bundles, prompted, launch), []);
  assert.equal(launched.length, 2);
});

test("a copy asked for permission is still reported when the AppleScript fallback fails", async () => {
  let fellBack = false;
  const sent = await deliver({
    dark: false,
    own,
    others: ["terminal-notifier"],
    run: (n) => (n === own.light ? Promise.resolve({ code: NOT_ALLOWED }) : missing()),
    ask: async (refused) => (assert.deepEqual(refused, [own.light]), [own.light]),
    fallback: async () => {
      fellBack = true;
      throw new Error("osascript timed out");
    },
  });
  assert.deepEqual(sent, [own.light]);
  assert.equal(fellBack, true);
  const senders = new Map();
  rememberSenders(senders, "t1", sent);
  const removed = [];
  await removeEverywhere(senders, "t1", async (n) => removed.push(n));
  assert.deepEqual(removed, [own.light]);
});

test("clearing an agent removes its banner from every notifier that posted one", async () => {
  const senders = new Map();
  rememberSenders(senders, "t1", ["terminal-notifier"]);
  rememberSenders(senders, "t1", [own.dark, own.light]);
  rememberSenders(senders, "t1", ["terminal-notifier"]);
  rememberSenders(senders, "t2", [own.light]);
  const removed = [];
  await removeEverywhere(senders, "t1", async (n) => {
    removed.push(n);
    if (n === own.dark) throw new Error("gone");
  });
  assert.deepEqual(removed, ["terminal-notifier", own.dark, own.light]);
  assert.deepEqual([...senders.keys()], ["t2"]);
  await removeEverywhere(senders, "t9", async () => assert.fail("nothing posted for t9"));
  assert.deepEqual([...senders.keys()], ["t2"]);
});
