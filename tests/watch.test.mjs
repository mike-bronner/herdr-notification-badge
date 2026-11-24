import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { STAND_ASIDE, badgeText, bannerFocus, bannerText, compare, jumpTo, movedOn, needsYou, quote, readable, topLevelAgents } from "../mods/agent-alerts/watch.js";

const agent = (address, status, more = {}) => ({
  address,
  status,
  tab: `tab-${address}`,
  space_name: "api",
  tab_name: "Tab 2",
  title: "Rename the billing job",
  program: { name: "Claude Code" },
  ...more,
});
const before = (entries) => new Map(entries);
const inBackground = false;
const herdrActive = true;

test("leaves out sub-agents, empty entries and missing lists", () => {
  const agents = [agent("t1", "blocked"), agent("t2", "blocked"), null, { status: "blocked" }];
  const terminals = [{ address: "t1" }, { address: "t2", parent: "t1" }, null];
  assert.deepEqual(topLevelAgents(agents, terminals).map((a) => a.address), ["t1"]);
  assert.deepEqual(topLevelAgents(undefined, undefined), []);
  assert.deepEqual(topLevelAgents(null, null), []);
});

test("the badge counts only agents in status blocked", () => {
  const agents = ["blocked", "working", "done", "idle", "blocked"].map((status, i) => agent(`t${i}`, status));
  assert.equal(needsYou(agents, []), 2);
});

test("the badge leaves out sub-agents, the terminals that have a parent", () => {
  const terminals = [{ address: "t1" }, { address: "t2", parent: "t1" }];
  assert.equal(needsYou([agent("t1", "blocked"), agent("t2", "blocked")], terminals), 1);
});

test("the badge counts agents on other machines by their full address", () => {
  const terminals = [{ address: "t7", parent: "t1" }];
  assert.equal(needsYou([agent("vps/t7", "blocked"), agent("t7", "blocked")], terminals), 1);
});

test("the badge counts zero with no agents or terminals, and skips empty entries", () => {
  assert.equal(needsYou(undefined, undefined), 0);
  assert.equal(needsYou(null, null), 0);
  assert.equal(needsYou([], []), 0);
  assert.equal(needsYou([null, agent("t1", "blocked")], [null, undefined]), 1);
});

test("the badge shows the count, and clears at zero", () => {
  assert.equal(badgeText(3), "3");
  assert.equal(badgeText(1), "1");
  assert.equal(badgeText(0), null);
});

test("the first check after start posts nothing", () => {
  const { statuses, alerts } = compare(null, [agent("t1", "blocked"), agent("t2", "done")], [], inBackground);
  assert.deepEqual(alerts, []);
  assert.deepEqual([...statuses], [["t1", "blocked"], ["t2", "done"]]);
});

test("an agent that first shows up after the first check, already blocked, gets a banner", () => {
  const { alerts } = compare(before([["t1", "working"]]), [agent("t1", "working"), agent("t9", "blocked")], [], inBackground);
  assert.deepEqual(alerts.map((a) => [a.address, a.title]), [["t9", "Claude Code needs you"]]);
});

test("an agent that first shows up after the first check in any other status gets no banner", () => {
  for (const status of ["working", "done", "idle"]) {
    assert.deepEqual(compare(new Map(), [agent("t9", status)], [], inBackground).alerts, [], status);
  }
});

test("alerts when an agent starts needing you", () => {
  for (const was of ["working", "done", "idle"]) {
    const { alerts } = compare(before([["t1", was]]), [agent("t1", "blocked")], [], inBackground);
    assert.deepEqual(alerts, [{ address: "t1", status: "blocked", title: "Claude Code needs you", subtitle: "api › Tab 2", body: "Rename the billing job" }]);
  }
});

test("does not alert again while an agent stays blocked", () => {
  assert.deepEqual(compare(before([["t1", "blocked"]]), [agent("t1", "blocked")], [], inBackground).alerts, []);
});

test("a finish while Herdr is in the background gets a banner", () => {
  for (const now of ["done", "idle"]) {
    const { alerts } = compare(before([["t1", "working"]]), [agent("t1", now)], [], inBackground);
    assert.deepEqual(alerts.map((a) => [a.title, a.status]), [["Claude Code finished", now]]);
  }
});

test("while Herdr is active, no banner of either kind goes out, and statuses are still recorded", () => {
  for (const was of ["working", "done", "idle", undefined]) {
    const last = before(was ? [["t1", was]] : []);
    const { alerts, statuses } = compare(last, [agent("t1", "blocked")], [], herdrActive);
    assert.deepEqual(alerts, [], String(was));
    assert.deepEqual([...statuses], [["t1", "blocked"]]);
  }
  for (const now of ["done", "idle"]) {
    assert.deepEqual(compare(before([["t1", "working"]]), [agent("t1", now)], [], herdrActive).alerts, [], now);
  }
});

test("an alert that arose while Herdr was active is dropped, not posted once Herdr goes to the background", () => {
  const list = [agent("t1", "blocked"), agent("t2", "done")];
  const whileActive = compare(before([["t1", "working"], ["t2", "working"]]), list, [], herdrActive);
  assert.deepEqual(whileActive.alerts, []);
  const afterwards = compare(whileActive.statuses, list, [], inBackground);
  assert.deepEqual(afterwards.alerts, []);
  assert.equal(needsYou(list, []), 1);
});

test("an agent that needs you again after Herdr goes to the background gets a banner", () => {
  const whileActive = compare(before([["t1", "working"]]), [agent("t1", "blocked")], [], herdrActive);
  const working = compare(whileActive.statuses, [agent("t1", "working")], [], inBackground);
  const { alerts } = compare(working.statuses, [agent("t1", "blocked")], [], inBackground);
  assert.deepEqual(alerts.map((a) => [a.address, a.title]), [["t1", "Claude Code needs you"]]);
});

test("a finish counts only after working", () => {
  for (const was of ["blocked", "idle", "done"]) {
    assert.deepEqual(compare(before([["t1", was]]), [agent("t1", "done")], [], inBackground).alerts, [], was);
  }
  assert.deepEqual(compare(before([["t1", "idle"]]), [agent("t1", "working")], [], inBackground).alerts, []);
});

test("a blocked sub-agent stays silent", () => {
  const terminals = [{ address: "t2", parent: "t1" }];
  const { alerts, statuses } = compare(before([["t2", "working"]]), [agent("t2", "blocked")], terminals, inBackground);
  assert.deepEqual(alerts, []);
  assert.equal(statuses.has("t2"), false);
});

test("an agent that leaves the list is forgotten", () => {
  assert.deepEqual([...compare(before([["t1", "working"]]), [], [], inBackground).statuses], []);
});

test("the banner falls back when names are missing", () => {
  const bare = { address: "t4", app: "pi", program: null, title: "", pane_name: null, space_name: "", tab_name: "Tab 1" };
  assert.deepEqual(bannerText(bare, "finished"), { title: "pi finished", subtitle: "Tab 1", body: "t4" });
  assert.deepEqual(bannerText({ address: "t5", pane_name: "server" }, "blocked"), { title: "Agent needs you", subtitle: "", body: "server" });
});

test("banner text drops leading characters terminal-notifier cannot read", () => {
  assert.equal(readable("[WIP] login"), "WIP] login");
  assert.equal(readable(' "(1) {x} -- <y> \\z'), "1) {x} -- <y> \\z");
  assert.equal(readable("--force"), "force");
  assert.equal(readable("it's [fine]"), "it's [fine]");
  assert.equal(readable(null), "");
  const odd = { address: "t4", program: { name: "-pi" }, app: "pi", space_name: "(api", tab_name: "{Tab", title: "[]" };
  assert.deepEqual(bannerText(odd, "blocked"), { title: "pi needs you", subtitle: "api › Tab", body: "]" });
  const empty = { address: "t5", program: { name: "[(" }, space_name: '"', tab_name: "-", title: "-", pane_name: "(" };
  assert.deepEqual(bannerText(empty, "finished"), { title: "Agent finished", subtitle: "", body: "t5" });
});

test("a banner moves on when its agent's status changes or the agent goes", () => {
  const banners = before([["t1", "blocked"], ["t2", "done"], ["t3", "blocked"]]);
  const statuses = before([["t1", "blocked"], ["t2", "idle"]]);
  assert.deepEqual(movedOn(banners, statuses), ["t2", "t3"]);
});

test("quoting survives the shell for any text", () => {
  for (const text of ["t1", "it's", `{"terminal":"t1"}`, "$(rm -rf ~) `x` ; | &", "'"]) {
    assert.equal(execFileSync("/bin/sh", ["-c", `printf %s ${quote(text)}`], { encoding: "utf8" }), text);
  }
});

const waitingList = [agent("t1", "working"), agent("t2", "blocked"), agent("t3", "blocked")];
const activation = (more = {}) => ({ was: false, win: { active: true }, focus: { tab: "tab-t1" }, agents: waitingList, terminals: [], banners: new Map(), now: 10_000, clickedAt: null, ...more });

test("Herdr turning active jumps to the first blocked agent in Herdr's order", () => {
  assert.equal(jumpTo(activation()), "t2");
  assert.equal(jumpTo(activation({ agents: [agent("t3", "blocked"), agent("t2", "blocked")] })), "t3");
});

test("the jump leaves out a blocked sub-agent, as the badge does", () => {
  assert.equal(jumpTo(activation({ terminals: [{ address: "t2", parent: "t1" }] })), "t3");
  assert.equal(jumpTo(activation({ agents: [agent("t2", "blocked")], terminals: [{ address: "t2", parent: "t1" }] })), null);
});

test("the jump happens once per activation, only on the change from not active", () => {
  assert.equal(jumpTo(activation({ was: true })), null);
  assert.equal(jumpTo(activation({ was: null })), null);
  assert.equal(jumpTo(activation({ was: false, win: { active: false } })), null);
  assert.equal(jumpTo(activation({ was: false, win: null })), null);
});

test("no jump when no agent is blocked", () => {
  assert.equal(jumpTo(activation({ agents: [agent("t1", "working"), agent("t2", "done"), agent("t3", "idle")] })), null);
  assert.equal(jumpTo(activation({ agents: [] })), null);
});

test("no jump when the person already looks at a blocked agent's tab", () => {
  assert.equal(jumpTo(activation({ focus: { tab: "tab-t3" } })), null);
  assert.equal(jumpTo(activation({ focus: { tab: "tab-t2" } })), null);
  assert.equal(jumpTo(activation({ focus: null })), "t2");
});

test("no jump when the tab on screen holds an agent whose banner is still up", () => {
  const finished = [agent("t1", "done"), agent("t2", "blocked")];
  assert.equal(jumpTo(activation({ agents: finished, banners: before([["t1", "done"]]) })), null);
  assert.equal(jumpTo(activation({ agents: finished })), "t2");
  assert.equal(jumpTo(activation({ agents: finished, banners: before([["t2", "blocked"]]) })), "t2");
  assert.equal(jumpTo(activation({ agents: finished, banners: before([["t1", "done"]]), focus: { tab: "tab-t9" } })), "t2");
});

test("a banner up for a sub-agent on the tab on screen does not stop the jump", () => {
  const list = [agent("t1", "done"), agent("t2", "blocked")];
  assert.equal(jumpTo(activation({ agents: list, terminals: [{ address: "t1", parent: "t0" }], banners: before([["t1", "done"]]) })), "t2");
});

test("no jump within a second of a banner click, and a jump after it", () => {
  assert.equal(jumpTo(activation({ clickedAt: 10_000 })), null);
  assert.equal(jumpTo(activation({ clickedAt: 10_000 - STAND_ASIDE + 1 })), null);
  assert.equal(jumpTo(activation({ clickedAt: 10_000 - STAND_ASIDE })), "t2");
  assert.equal(STAND_ASIDE, 1000);
});

test("a banner click is a focus that moves onto the tab of an agent with a banner up", () => {
  const banners = before([["t2", "blocked"]]);
  assert.equal(bannerFocus(banners, waitingList, { tab: "tab-t1", terminal: "t1" }, { tab: "tab-t2", terminal: "t2" }), true);
  assert.equal(bannerFocus(banners, waitingList, null, { tab: "tab-t2", terminal: "t2" }), true);
  assert.equal(bannerFocus(banners, waitingList, { tab: "tab-t2", terminal: "x" }, { tab: "tab-t2", terminal: "t2" }), true);
});

test("a focus that stays put, or lands where no banner is up, is no banner click", () => {
  const banners = before([["t2", "blocked"]]);
  assert.equal(bannerFocus(banners, waitingList, { tab: "tab-t2", terminal: "t2" }, { tab: "tab-t2", terminal: "t2" }), false);
  assert.equal(bannerFocus(banners, waitingList, { tab: "tab-t2", terminal: "t2" }, { tab: "tab-t3", terminal: "t3" }), false);
  assert.equal(bannerFocus(banners, waitingList, { tab: "tab-t1" }, null), false);
  assert.equal(bannerFocus(banners, null, { tab: "tab-t1" }, { tab: "tab-t2" }), false);
  assert.equal(bannerFocus(new Map(), waitingList, { tab: "tab-t1" }, { tab: "tab-t2" }), false);
});
