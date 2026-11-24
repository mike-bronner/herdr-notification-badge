# Agent alerts for Herdr

A [Herdr](https://herdr.dev) mod for macOS that tells you when an agent needs you. It puts the count on Herdr's Dock icon and sends banners to Notification Center, with Herdr's icon on each one.

![Agent alerts](./preview.png)

The preview shows a `Claude Code needs you` banner above Herdr's Dock icon with a badge of 2. It is an illustration drawn from Herdr's app icon, not a screen capture.

- **Dock badge:** the number of top-level agents in status `blocked`. It refreshes every 2 seconds and goes away at zero.
- **Needs you:** a banner when a top-level agent turns `blocked`, or first shows up already `blocked`, while Herdr's window is not active.
- **Finished:** a banner when an agent stops working while Herdr's window is not active.
- **Herdr active:** no banners of either kind. Herdr shows its own toast then. An alert that comes up while Herdr is active is dropped. It does not post later when you switch away. An agent that still needs you stays on the Dock badge.
- **Sub-agents:** never count and never alert.
- **At start:** agents that already need you count on the badge but get no banner.
- **Banner text:** for example `Claude Code needs you`, then `api › Tab 2`, then the conversation title. No images.
- **Click:** shows that agent in Herdr.
- **Dock icon:** when Herdr comes to the front while the badge shows a count, Herdr shows the first agent that needs you. First means first in Herdr's own order: space, then tab, then pane. Switching to Herdr with Cmd-Tab, or any other way, does the same while an agent needs you.
- **No jump:** when no agent needs you, or within a second of a banner click. There is also no jump when the tab on screen holds an agent that needs you, or an agent whose banner is still up. So a banner click always shows its own agent, and the agent that needs you stays on the badge. The jump happens once each time Herdr comes to the front.
- **Removal:** when the agent's status changes again, or the agent closes, its banner leaves Notification Center.
- **Icon:** a dark tile with Herdr's ram in light mode, Herdr's ivory icon in dark mode.
- **Herdr window:** unchanged. The mod's block has no height and shows nothing.

The idea comes from benjaminsicard's [desktop-notifications](https://github.com/benjaminsicard/herdr-mods) mod. This mod is a separate build with its own code.

## What it runs

It runs programs. It makes no network requests and writes no files. From Herdr it reads only the lists of agents and terminals, the focus and the window state. It runs one Herdr command, `agent.focus`, to show the first agent that needs you.

- The two notifier copies in its folder, when you have built them.
- `terminal-notifier` from Homebrew, when installed.
- `/usr/bin/defaults`, to read whether macOS is in dark mode.
- `/usr/bin/open`, to make macOS ask for permission the first time a copy is refused.
- `/usr/bin/which`, to find `herdr-app`.
- `/usr/bin/osascript`, when nothing else posted the banner.
- `herdr-app`, when you click a banner.

The Dock badge itself runs no programs. It uses Herdr's own `setBadge`.

## Install

Your Herdr agent can install it for you. Give it this repo's address, `https://github.com/mike-bronner/herdr-notification-badge`, or the mod's page on https://herdr.dev/mods.

To do it yourself, first make sure `~/.config/herdr-app/mods/agent-alerts` does not exist yet. If it does, compare the two folders before you replace anything. Then run:

```sh
git clone https://github.com/mike-bronner/herdr-notification-badge.git
cp -R herdr-notification-badge/mods/agent-alerts ~/.config/herdr-app/mods/agent-alerts
herdr-app check ~/.config/herdr-app/mods/agent-alerts
```

Keep the folder name `agent-alerts`. The mod finds its notifier copies there.

This mod replaces the earlier `dock-badge` mod from this repo. If you installed `dock-badge`, delete its folder and its block from your layouts. Both set the same badge.

When Herdr first finds the mod, it adds the mod's block to the layout on screen and to no other. Paste this block into each other layout you use:

```json
{ "type": "block", "content": { "mod": "agent-alerts" }, "size": { "px": 0 } }
```

Adding the block changes the layout file. Herdr adds new nodes at the top and moves the old top node under them. Four settings only work on the top node: `titlebar`, `traffic_lights`, `terminal_padding` and `background`. They stay on the old node, the one with `"id": "root"`, and stop working there. Open the layout file and move them to the new top node.

## Build the notifier copies

The mod works without this step. Banners then come from `terminal-notifier` or AppleScript, with their icons.

For Herdr's icon on the banners, build two copies of Homebrew's `terminal-notifier` on your Mac:

```sh
brew install terminal-notifier
sh ~/.config/herdr-app/mods/agent-alerts/make-notifier.sh
```

The script makes `HerdrNotifier.app` and `HerdrNotifierDark.app` in the mod's folder. It gives each one its own bundle id, name and icon, and signs it locally. The ivory icon is copied from `/Applications/Herdr.app`. The dark icon is built from `herdr-dark.svg`. Run `make-notifier.sh ivory` or `make-notifier.sh dark` to rebuild one.

The repo does not ship the copies. They are binaries made from another project, and their signatures belong to the Mac that built them.

The first time a copy is not allowed to notify, the mod launches it once so macOS asks you. Allow it, or change it later in System Settings, Notifications, under Herdr Notifier and Herdr Notifier Dark.

## Limits

- macOS only. On other platforms the mod does nothing.
- A layout without the mod's block gets no badge and no banners.
- AppleScript banners cannot be removed, and clicking one does not show the agent.
- When `herdr-app` is not on your PATH, clicking a banner only brings Herdr forward.
- Banner text loses any `[`, `(`, `{`, `"`, `<`, `-`, `\` or spaces at its start. terminal-notifier cannot read a value that starts with most of them. A title such as `[WIP] login` shows as `WIP] login`.

## Tests

```sh
node --test tests/watch.test.mjs tests/banner.test.mjs
```

To build the mod again from a description, read [RECIPE.md](RECIPE.md).

## License

MIT. See [LICENSE](LICENSE).

`herdr-dark.svg`, and the icon `make-notifier.sh` builds from it, use the ram from [Herdr's logo](https://github.com/herdrdev/herdr/blob/HEAD/assets/logo.svg). Herdr is licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0). The colors are changed. See [NOTICE](mods/agent-alerts/NOTICE).
