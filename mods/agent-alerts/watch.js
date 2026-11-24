const FINISHED = new Set(["done", "idle"]);
const HEADLINES = { blocked: "needs you", finished: "finished" };
const UNREADABLE_START = /^[\s[({"<\\-]+/u;
export const STAND_ASIDE = 1000;

export function topLevelAgents(agents, terminals) {
  const children = new Set();
  for (const terminal of terminals ?? []) if (terminal?.parent) children.add(terminal.address);
  return (agents ?? []).filter((a) => a?.address && !children.has(a.address));
}

export const waiting = (agents, terminals) => topLevelAgents(agents, terminals).filter((a) => a.status === "blocked");

export const needsYou = (agents, terminals) => waiting(agents, terminals).length;

export const badgeText = (count) => (count > 0 ? String(count) : null);

function alertKind(was, now, seen) {
  if (was === now) return null;
  if (now === "blocked") return "blocked";
  return was === "working" && FINISHED.has(now) && !seen ? "finished" : null;
}

export const lookingAt = (agent, win, focus) => Boolean(win?.active) && focus?.tab === agent.tab;

export const readable = (text) => String(text ?? "").replace(UNREADABLE_START, "");

export function bannerText(agent, kind) {
  const program = readable(agent.program?.name) || readable(agent.app) || "Agent";
  return {
    title: `${program} ${HEADLINES[kind]}`,
    subtitle: [agent.space_name, agent.tab_name].map(readable).filter(Boolean).join(" › "),
    body: [agent.title, agent.pane_name, agent.address].map(readable).find(Boolean) ?? program,
  };
}

export function compare(before, agents, terminals, inSight) {
  const statuses = new Map();
  const alerts = [];
  for (const agent of topLevelAgents(agents, terminals)) {
    statuses.set(agent.address, agent.status);
    const kind = before ? alertKind(before.get(agent.address), agent.status, inSight(agent)) : null;
    if (kind) alerts.push({ ...bannerText(agent, kind), address: agent.address, status: agent.status });
  }
  return { statuses, alerts };
}

export function movedOn(banners, statuses) {
  return [...banners].filter(([address, status]) => statuses.get(address) !== status).map(([address]) => address);
}

export function bannerFocus(banners, agents, before, focus) {
  if (!focus?.tab || (focus.tab === before?.tab && focus.terminal === before?.terminal)) return false;
  return (agents ?? []).some((a) => a?.tab === focus.tab && banners.has(a.address));
}

export function jumpTo({ was, win, focus, agents, terminals, banners, now, clickedAt }) {
  if (was !== false || !win?.active) return null;
  if (clickedAt != null && now - clickedAt < STAND_ASIDE) return null;
  const onScreen = topLevelAgents(agents, terminals).filter((a) => a.tab === focus?.tab);
  if (onScreen.some((a) => a.status === "blocked" || banners.has(a.address))) return null;
  return waiting(agents, terminals)[0]?.address ?? null;
}

export const quote = (text) => `'${String(text).replaceAll("'", `'"'"'`)}'`;
