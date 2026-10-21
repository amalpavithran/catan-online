# Version 0.5.0: room action timers

Timer settings are chosen when creating a room and shown to everyone in the lobby. Defaults are 30 seconds per action and 5 seconds before an unattended dice roll. Action time accepts 0–600 whole seconds; auto-roll accepts 0–60. Zero disables that timer. Settings are fixed for that room.

The server owns deadlines. Each valid action by the active player grants a new action budget. Invalid requests, other players' trade replies, and reconnecting while someone is still online do not extend it. The header shows the live countdown.

An expired ordinary action ends the active player's turn or paired-player portion. Mandatory choices are resolved legally first: setup timeout places the required starting settlement/road; overdue discards return the required number of cards; robber/steal timeout resolves those choices before passing control. Other players get their own shared discard window and cannot prolong it by waiting for one another. If auto-roll is disabled but action timing is enabled, an expired pre-roll action resolves required production before the turn ends.

Timers pause only when everyone is disconnected and resume with the remaining budget. Settings, deadlines, paused budgets and pending timeout completion are persisted. Existing rooms created before this version retain their untimed behavior; create a new room to choose timers.

Validation: 124 rules/server/render tests including timer boundaries, resetting, invalid-action protection, pending discards, pre-roll Knights, six-player paired turns, legacy rooms and pause/resume. Real WebSocket tests exercise unattended setup, rolls and turn endings. Browser tests verify creation defaults, custom settings, shared lobby settings, live countdowns, auto-roll after five seconds, expiry, reconnect budget and phone bounds. Dice geometry regression still passes all 36 rolls at four widths.

The previously deployed 0.4.0 snapshot remains committed on the fork's main branch. Timer changes are on feature/action-timers. No deployment address is included in source.
