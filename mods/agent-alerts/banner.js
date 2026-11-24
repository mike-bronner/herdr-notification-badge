import { quote } from "./watch.js";

export const NOT_ALLOWED = 3;
const HERDR = "dev.herdr.app";

export const groupOf = (address) => `herdr-agent-alerts-${address}`;

export const clickCommand = (herdrApp, address) => [herdrApp, "do", "agent.focus", JSON.stringify({ terminal: address })].map(quote).join(" ");

export function notifierArgs(alert, click) {
  const shown = Object.entries({ "-title": alert.title, "-subtitle": alert.subtitle, "-message": alert.body }).filter(([, value]) => value);
  const onClick = click ? [["-execute", click]] : [];
  return [...shown, ["-group", groupOf(alert.address)], ["-activate", HERDR], ...onClick].flat();
}

export function notifierOrder(dark, own, others) {
  const [first, second] = dark ? [own.dark, own.light] : [own.light, own.dark];
  return [first, second, ...others].filter(Boolean);
}

export async function firstToPost(commands, run) {
  const refused = [];
  for (const command of commands) {
    const r = await run(command).catch(() => null);
    if (r?.code === 0) return { via: command, refused };
    if (r?.code === NOT_ALLOWED) refused.push(command);
  }
  return { via: null, refused };
}

export async function deliver({ dark, own, others, run, ask, fallback }) {
  const { via, refused } = await firstToPost(notifierOrder(dark, own, others), run);
  const asked = await ask(refused);
  if (!via) await fallback().catch(() => {});
  return [via, ...asked].filter(Boolean);
}

export async function askOnce(refused, bundles, prompted, launch) {
  const asked = [];
  for (const notifier of refused) {
    if (!bundles.has(notifier) || prompted.has(notifier)) continue;
    prompted.add(notifier);
    const r = await launch(bundles.get(notifier)).catch(() => null);
    if (r?.code === 0) asked.push(notifier);
  }
  return asked;
}

export function rememberSenders(senders, address, sent) {
  senders.set(address, new Set([...(senders.get(address) ?? []), ...sent]));
}

export async function removeEverywhere(senders, address, removeWith) {
  for (const notifier of senders.get(address) ?? []) await removeWith(notifier).catch(() => {});
  senders.delete(address);
}
