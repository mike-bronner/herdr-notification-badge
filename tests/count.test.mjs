import assert from "node:assert/strict";
import test from "node:test";
import { badgeText, needsYou } from "../mods/dock-badge/count.js";

const agent = (address, status) => ({ address, status });

test("counts only agents in status blocked", () => {
  const agents = [agent("t1", "blocked"), agent("t2", "working"), agent("t3", "done"), agent("t4", "idle"), agent("t5", "blocked")];
  assert.equal(needsYou(agents, []), 2);
});

test("leaves out sub-agents, the terminals that have a parent", () => {
  const agents = [agent("t1", "blocked"), agent("t2", "blocked")];
  const terminals = [{ address: "t1" }, { address: "t2", parent: "t1" }];
  assert.equal(needsYou(agents, terminals), 1);
});

test("counts agents on other machines by their full address", () => {
  const agents = [agent("vps/t7", "blocked"), agent("t7", "blocked")];
  const terminals = [{ address: "t7", parent: "t1" }];
  assert.equal(needsYou(agents, terminals), 1);
});

test("counts zero when there are no agents or terminals", () => {
  assert.equal(needsYou(undefined, undefined), 0);
  assert.equal(needsYou(null, null), 0);
  assert.equal(needsYou([], []), 0);
});

test("skips empty entries in either list", () => {
  assert.equal(needsYou([null, agent("t1", "blocked")], [null, undefined]), 1);
});

test("the badge shows the count, and clears at zero", () => {
  assert.equal(badgeText(3), "3");
  assert.equal(badgeText(1), "1");
  assert.equal(badgeText(0), null);
});
