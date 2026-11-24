# Agent alerts

Herdr tells you on macOS when an agent needs you, even when its window is in the background. A red badge on Herdr's Dock icon counts the top-level agents waiting for you. When an agent stops and needs you while Herdr's window is not active, a Notification Center banner says so. When an agent finishes then, a banner says that too. While Herdr's window is active, Herdr shows its own toast and the mod posts no banner. Each banner carries Herdr's icon, names the agent's program, its space and tab and its conversation title, and takes you to that agent when you click it. When Herdr comes to the front while the badge shows a count, Herdr shows the first agent that needs you, so a click on the badged Dock icon lands there. The badge drops, and a banner leaves Notification Center, when its agent's status changes again. The mod draws nothing inside the Herdr window.

![Agent alerts](preview.png)

The preview shows a `Claude Code needs you` banner above Herdr's Dock icon with a badge of 2. It is an illustration drawn from Herdr's app icon, not a screen capture.

The idea comes from benjaminsicard's [desktop-notifications](https://github.com/benjaminsicard/herdr-mods) mod. This mod is a separate build with its own code.

## What you see

- **The Herdr window looks the same.** The mod's block is 0px high. Its `render` returns one empty `div` with the id `agent-alerts`.
- **A badge on the Dock icon** with the number of agents that need you, for example `2`. macOS draws the badge in its own style. There is no badge when no agent needs you.
- **A Notification Center banner** for each alert, in the style macOS draws:
  - Title: the program's name and what happened, for example `Claude Code needs you` or `Claude Code finished`.
  - Subtitle: the space and the tab, for example `api › Tab 2`.
  - Message: the conversation title. Herdr reports it as the agent's terminal title.
- **The banner icon:** in light mode, a dark tile with Herdr's ivory ram. In dark mode, Herdr's own ivory app icon. This needs the two notifier copies built (see Built from). Without them the icon is the one of whichever program posts the banner.
- The mod plays no sound and attaches no images.

## How it behaves

- **Blocked:** each top-level agent in status `blocked` adds one to the badge. A top-level agent that turns `blocked` from any other status gets a "needs you" banner. It gets one banner per turn, not one per check.
- **Working:** no banner, and it does not count on the badge.
- **Done or idle after working:** a "finished" banner. Done and idle agents do not count on the badge.
- **Herdr active:** while `window().active` is true, no banner of either kind goes out. Herdr shows its own toast then. The mod still records each agent's status, so an alert that came up then is dropped. It does not post when the window stops being active. An agent that is still `blocked` stays on the badge. It gets a banner again only when it turns `blocked` anew while the window is not active.
- **Done or idle after blocked, or done after idle:** no banner.
- **Sub-agents:** never count and never alert, even when blocked. A sub-agent is an agent whose terminal has a `parent`. Its parent counts if the parent is blocked.
- **Other machines:** an address such as `vps/t7` is treated like a local one.
- **When the mod starts:** the first check sets the badge and records each agent's status. It posts no banner. After that, an agent that appears for the first time already `blocked` gets a "needs you" banner. One that appears in any other status gets none.
- **Removal:** when an agent's status differs from the one its banner reported, or the agent is gone from the list, its banner is taken out of Notification Center. A finished agent turns `idle` once you look at it, so its banner goes then.
- **Zero:** the badge is cleared.
- **Close:** when the mod's copy closes, it clears the badge.
- **Click on a banner:** Herdr comes to the front and the notifier runs `herdr-app do agent.focus '{"terminal":"<address>"}'`, which shows that agent.
- **Herdr comes to the front:** when the window goes from not active to active and at least one top-level agent is `blocked`, the mod runs `agent.focus` on the first of them. First means first in the order `agents()` gives: space, then tab, then pane. Herdr gives mods no Dock click event, so a click on the Dock icon, Cmd-Tab and a click on the window all count. It jumps once per activation.
- **No jump:** when no top-level agent is `blocked`, or within 1 second of a banner click. There is also no jump when the focused tab holds a top-level agent that is `blocked` or whose banner is still up. The mod counts a banner click when the focus moves to another tab or terminal, and that tab holds an agent whose banner is up. A click on a banner whose agent's tab is already focused moves no focus. The rule for a banner still up covers that click, so the person stays on the agent they clicked. A banner click seen in the same check as the activation is inside that second. The first check after a start never jumps.
- **Checks:** a 2-second timer reads the agents, and so does each render. The timer keeps the alerts going when Herdr does not draw the block. The badge is set only when its text changes.
- **Posting:** it tries, in order, the copy whose icon fits the macOS appearance, the other copy, Homebrew's `terminal-notifier`, and last AppleScript's `display notification`. The first one that exits 0 posts the banner. A program that is missing or fails is skipped.
- **Banner text:** any `[`, `(`, `{`, `"`, `<`, `-`, `\` or white space at the start of the title, subtitle or message is dropped, so the notifier can read it. `[WIP] login` shows as `WIP] login`. A message left empty falls back to the next name.
- **Permission:** a copy that exits 3 is not allowed to notify yet. The mod then launches that copy once through `open -n` with the same banner, which makes macOS ask the person for permission. It asks once per copy each time the mod starts. That alert still goes out through the next program in the order.
- No clicks, keys or hovers inside the window.

## Built from

- `mods/agent-alerts/mod.json`: `{ "place": "bottom", "size": 0, "title": "Agent alerts" }`. Herdr reads it when the folder is new, and adds a block with `content: { "mod": "agent-alerts" }` and no height to the current layout.
- `watch.js`: pure functions with no `herdr` import.
  - `topLevelAgents(agents, terminals)`: agents with an address that is not the address of a terminal with a `parent`. Missing lists and empty entries count as nothing.
  - `waiting(agents, terminals)`: the top-level agents with `status === "blocked"`, in the order of `agents`.
  - `needsYou(agents, terminals)`: the number of agents `waiting` returns.
  - `badgeText(count)`: `String(count)` above zero, else `null`.
  - `compare(before, agents, terminals, herdrActive)`: takes the last statuses by address, or `null` for the first check, and returns the new statuses and the alerts. The first check gives no alerts, and neither does any check with `herdrActive` true. Both still return the new statuses. A blocked alert needs `blocked` now and any other status, or none, before. A finished alert needs `working` before and `done` or `idle` now.
  - `readable(text)`: the text without its leading `[`, `(`, `{`, `"`, `<`, `-`, `\` and white space.
  - `bannerText(agent, kind)`: every part goes through `readable`. Title from `program.name`, else `app`, else `Agent`. Subtitle `space_name › tab_name`, leaving out an empty one. Message the first non-empty of `title`, `pane_name` and `address`.
  - `movedOn(banners, statuses)`: addresses whose banner status differs from the status now.
  - `bannerFocus(banners, agents, before, focus)`: true when `focus` has a tab, its tab or terminal differs from `before`, and an agent on that tab has its address in `banners`.
  - `jumpTo({ was, win, focus, agents, terminals, banners, now, clickedAt })`: the address to focus, or `null`. It needs `was === false` and `win.active`, and `clickedAt` absent or at least `STAND_ASIDE` (1000) ms before `now`. It also needs no top-level agent on `focus.tab` that is `blocked` or has its address in `banners`. Then it gives the first `waiting` agent.
  - `quote(text)`: single-quotes text for the shell.
- `banner.js`: pure functions with no `herdr` import.
  - `notifierArgs(alert, click)`: the options for one banner. `-title`, `-subtitle` when not empty, `-message`, `-group herdr-agent-alerts-<address>`, `-activate dev.herdr.app`, and `-execute <click>` when there is a click command.
  - `clickCommand(herdrApp, address)`: `herdr-app`'s path, `do`, `agent.focus` and `{"terminal":"<address>"}`, each one quoted for the shell.
  - `groupOf(address)`: `herdr-agent-alerts-<address>`.
  - `notifierOrder(dark, own, others)`, `firstToPost(commands, run)` (exit 0 posts, exit 3 is a refusal, anything else or a failure to start goes to the next one) and `deliver(...)`, which tries the order, asks for permission, and calls the AppleScript fallback when nothing posted. If the fallback fails, it still returns the copies it asked, so their banners can be removed.
  - `askOnce(refused, bundles, prompted, launch)`: launches each refused copy that has a bundle and was not asked before, and returns those that launched.
  - `rememberSenders(senders, address, sent)` and `removeEverywhere(senders, address, removeWith)`: keep every notifier that posted for an agent, and run the removal on each of them.
- `main.js`: the `View`.
  - Reads `agents()`, `terminals()`, `focused()` and `window()` from `herdr`, and finds its own folder with `appHome()`.
  - Runs only when `window()?.platform === "macos"` and `checking()` is false, so `herdr-app check` sets no badge and starts no timer.
  - Starts `cx.timer.every(2000)` in `init`, with the last statuses at `null`.
  - Reads `agents()`, `terminals()`, `window()` and `focused()` once per check, for the badge, the banners and the jump. It passes `Boolean(window()?.active)` to `compare`.
  - Keeps the last window `active` value, starting at `null`, the last focus, and the time of the last banner click from `Date.now()`.
  - Calls `run("agent.focus", { terminal })` when `jumpTo` gives an address.
  - Calls `setBadge(text)` when the text differs from the last one it set, and `setBadge(null)` in `close()`.
  - Runs its posts and removals one at a time, in order, inside `cx.spawn`.
  - Removal is `-remove herdr-agent-alerts-<address>` on each notifier that posted for that agent.
- Programs it runs, all through `exec`:
  - `mods/agent-alerts/HerdrNotifierDark.app/Contents/MacOS/terminal-notifier` and `mods/agent-alerts/HerdrNotifier.app/Contents/MacOS/terminal-notifier`, when built.
  - `terminal-notifier` from the PATH.
  - `/usr/bin/defaults read -g AppleInterfaceStyle`, once per banner. `Dark` means dark mode.
  - `/usr/bin/open -n <copy>.app --args ...`, to raise the permission prompt.
  - `/usr/bin/which herdr-app`, the first time it posts after a start, for the click command.
  - `/usr/bin/osascript`, as the last fallback.
  - `herdr-app`, run by the notifier when you click a banner.
- `make-notifier.sh [ivory|dark|all]`: builds the copies next to itself from Homebrew's `terminal-notifier.app`, or from `$TERMINAL_NOTIFIER_APP`.
  - `HerdrNotifier.app`: bundle id `local.herdr.notifier`, Herdr's own `Herdr.icns` copied from `/Applications/Herdr.app`. Used in dark mode.
  - `HerdrNotifierDark.app`: bundle id `local.herdr.notifier.dark`, an icon made from `herdr-dark.svg` with `sips` and `iconutil`. Used in light mode.
  - Each copy gets a new bundle id, name and icon, an ad-hoc signature and a `-version` run.
- Art: `herdr-dark.svg`, Herdr's ram in ivory `#f4f1e9` on a `#1c1d21` tile with 192px corners on a 1024px canvas. `NOTICE` carries its Apache-2.0 attribution.
- No props, keys, network or file writes. Only `make-notifier.sh`, run by hand, writes the copies into the mod's folder.

## Watch out

- `setBadge` and Notification Center are macOS only. On other platforms the mod does nothing.
- Do not call `setBadge` on every check. Compare with the last text first.
- The banner icon always comes from the program that posts it. `terminal-notifier` ignores `-appIcon` and `-sender`. That is why the copies exist.
- macOS shows the permission prompt for a copy only when it is launched through LaunchServices (`open -n`). Running its binary directly never prompts and exits 3.
- terminal-notifier 3.1.0 reads every option value as a property list first. A value that starts with `[`, `(`, `{`, `"` or `<` fails with exit 2, and one that starts with `-` is taken for an option. It also drops one leading `\`. Clean the text before it goes out, or the banner falls through to AppleScript. The `-execute` value starts with a single quote, which it reads as plain text.
- Do not use `settings().dark` to pick the copy. A person can pin Herdr's appearance, so it can differ from the system's. Read `AppleInterfaceStyle` instead.
- The copies are built on each Mac and never shipped. They are binaries made from another project, with a local signature. Without them, banners still post through `terminal-notifier` or AppleScript.
- The mod looks for the copies in `mods/agent-alerts/`. If the folder is renamed, change `FOLDER` in `main.js` too, or the copies are not found.
- AppleScript banners cannot be removed and do not focus the agent on click.
- When `herdr-app` is not on the PATH, a click only brings Herdr forward.
- Use `terminals()` to find sub-agents. `agents()` has no `parent` field.
- If `agents()`, `terminals()`, `window()` or `focused()` throws, that check is skipped. The last badge stays until the next good read.
- Herdr runs the mod only in a layout that holds its block. It adds the block by itself to one layout, the one on screen when the folder first appears. Every other layout needs it pasted in: `{ "type": "block", "content": { "mod": "agent-alerts" }, "size": { "px": 0 } }`.
- Put the block in a layout once. Two blocks mean two copies of the mod, and each banner then arrives twice.
- After Herdr adds the block, the old top node of the layout is no longer at the top. `titlebar`, `traffic_lights`, `terminal_padding` and `background` only work on the top node, so move them to the new one.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/agent-alerts` reports no errors.
- `node --test tests/watch.test.mjs tests/banner.test.mjs` passes: 44 tests.
- Each banner check below runs with another app in front, unless it says Herdr is active.
- In any tab, a fake agent reports three states in a row, `working`, `blocked` and `working`. Switch to another app during the first 4 seconds:

  ```sh
  printf '\033]7501;state=working\033\\'; sleep 4
  printf '\033]7501;state=blocked\033\\'; sleep 10
  printf '\033]7501;state=working\033\\'; sleep 600
  ```

  Within 2 seconds of `blocked`, the Dock icon shows `1` and a `needs you` banner with the space, tab and title appears. Within 2 seconds of `working`, the badge clears and the banner leaves Notification Center.
- Two blocked agents show `2` on the Dock icon.
- A click on the banner opens Herdr at the fake agent.
- With the fake agent blocked and another tab on screen, switch to another app, then click Herdr's Dock icon: Herdr shows the fake agent's tab. Cmd-Tab back to Herdr does the same.
- With the fake agent's tab already on screen, switch away and back: the tab stays.
- With no agent blocked, switch away and back: the tab stays.
- With two banners up, click the second agent's banner while another app is in front: Herdr shows that agent, not the first.
- With a fake agent's tab on screen, switch to another app. Let that agent finish while a second fake agent is blocked. Click the `finished` banner: Herdr stays on the finished agent's tab, and the Dock icon still shows `1`.
- A fake agent whose first state is `blocked`, started after the mod, gives a `needs you` banner.
- A conversation title such as `[WIP] login` still posts through a notifier copy, with Herdr's icon, as `WIP] login`.
- Switch to another app and let the agent go from working to idle: a `finished` banner appears.
- With Herdr active, on any tab, let one fake agent turn `blocked` and another finish: no banner appears, and the Dock icon shows `1`. Switch to another app: still no banner. Let the blocked agent turn `working` and then `blocked` again: a `needs you` banner appears.
- A blocked sub-agent adds nothing to the badge and gives no banner.
- In light mode the banner shows the dark tile. In dark mode it shows the ivory icon.
- With the two copies deleted, a blocked agent still gives a banner.
