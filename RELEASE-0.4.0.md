# Version 0.4.0

- Dice now use fixed 36px SVG faces with proportional pips, rather than a 25px CSS grid containing fixed-size dots.
- Trade composition and responses live in a compact, nonmodal overlay clipped to the board area. Hands and navigation stay outside it. Offers remain visible after a response and scroll inside the overlay; the panel can be minimized.
- Red up arrows identify the viewer's outgoing cards; green down arrows identify incoming cards. The recipient sees the reverse of the offerer's perspective.
- The active player can publish multiple independent offers. Every offer has its own id, responses, withdrawal and completion. Completing one does not clear the others. Both sides' resources are checked again on completion, so overlapping offers cannot spend the same cards twice. Offers clear when the turn passes. Existing base and paired-turn restrictions remain enforced.
- Old saved single-offer games and legacy action payloads remain supported. The first offer is also exposed through the old single-offer field for clients awaiting a refresh.

Validation:

- `npm test`: existing rules/server/render tests plus multi-offer isolation, stale ids, double spending, serialization, legacy saves and turn restrictions.
- `npm run test:dice`: all 36 rolls at 320, 390, 844 and 1440 pixels, constrained footers, face sizes, pip counts and geometry. Uses installed Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`).
- `scripts/test-board-trades.mjs`: real browser sessions verify multiple offers, perspective and arrow size/colors, acceptance/rejection, correct hand changes, isolated cancellation, scrolling, board-only bounds, visible hands, minimize and reload. Start `scripts/layout-fixture.ts` with `NODE_ENV=production` to create isolated fixtures; use `CATAN_TEST_URL` to target their Docker deployment instead of localhost:3191.

The production Docker image is versioned, previous images are kept stopped for rollback, and production data is backed up before promotion.
