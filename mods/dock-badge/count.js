export function needsYou(agents, terminals) {
  const subAgents = new Set((terminals ?? []).filter((t) => t?.parent).map((t) => t.address));
  return (agents ?? []).filter((a) => a?.status === "blocked" && !subAgents.has(a.address)).length;
}

export const badgeText = (count) => (count > 0 ? String(count) : null);
