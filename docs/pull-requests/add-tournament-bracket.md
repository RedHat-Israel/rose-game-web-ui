# Add a browser-based tournament bracket

## Summary

Add a tournament workflow to the game UI. Organizers can add driver URLs,
build a single-elimination bracket, run best-of-three matches, and see winners
advance through a responsive bracket view.

## User-visible changes

- Add a **Tournament** entry point on the game page.
- Add a tournament setup and bracket page at `/tournament/index.html`.
- Persist entrants, brackets, in-progress heats, and match scores in
  `localStorage` so a page navigation does not discard tournament state.
- Fetch each driver's metadata endpoint to display its name; retain the URL as
  the participant identity.
- Start heats through the existing `/api/admin` endpoint and use game-state
  updates to record their result.
- Require two heat wins to decide a match; ties replay the heat.
- Advance byes automatically and highlight the upcoming match and final champion.
- Show a result panel on the game page with a **Next** action for continuing
  the tournament.

## Implementation notes

- `public/tournament.js` contains the bracket model, persistence, heat
  lifecycle, and rendering logic.
- `public/tournament/index.html` and `index.css` provide the tournament setup
  and bracket presentation.
- `public/game.js`, `game.css`, and `index.html` integrate the flow with the
  existing game screen.
- The UI assumes driver metadata endpoints permit cross-origin reads; the
  companion driver-module change adds this support for the standard driver.

## Compatibility and risk

- **Compatibility:** existing game controls and API routes are unchanged;
  tournament state is isolated under the `localStorage` key `tournament`.
- **Risk:** medium. Tournament progress is stored only in the browser, so it is
  not shared between devices and can be cleared by browser storage cleanup.
  Driver URLs are user-supplied and fetched by the browser; unreachable URLs
  remain in the bracket with a fallback label.
- **Rollback:** revert the UI assets. Removing the `tournament` localStorage
  key clears any client-side state created by this feature.

## Validation

- `npm --prefix web-ui run lint` — passed.
- Automated browser coverage is not present in this repository.

Before merge, perform this smoke test:

1. Open the game page and confirm the **Tournament** link opens the setup page.
2. Add 2, 3, 4, and 8 reachable driver URLs; confirm names load and byes advance
   correctly for non-power-of-two entrant counts.
3. Start a match, complete two winning heats for one driver, and verify the
   winner advances and the bracket is shown after the decided match.
4. Complete a tied heat and verify **Next** starts a replay without changing
   the match score.
5. Refresh during setup and during a live heat; confirm state resumes from
   `localStorage`.
6. Complete the final and confirm the champion is displayed. Select **New
   Tournament** and confirm all tournament state is cleared.

## Review checklist

- [ ] Tournament behavior matches the agreed single-elimination,
      best-of-three rules.
- [ ] The supported engine reliably accepts `/api/admin` driver and running
      requests across heat transitions.
- [ ] The cross-origin driver metadata policy is approved for deployed driver
      modules.
- [ ] The manual smoke test passes at desktop and narrow viewport widths.
