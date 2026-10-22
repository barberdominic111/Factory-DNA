# Factory DNA 1.0

A cozy, cartoon-style factory management game for phones and desktops. You inherit a troubled-but-viable distribution plant and turn it around over a quarter: find the constraint, free capacity, develop your people, keep customers happy and the books straight. It is an installable PWA that works offline; saves live on your device.

## How to play (60 seconds)
1. **Map**: the area marked LIMITING is where work piles up. Tap it. Tap people to move or develop them.
2. **Next day / Week** runs the shift in the simulation (animation never decides anything).
3. **Improve**: spend Earned Hours to remove workarounds ("containment") and add standard work. Run staged projects.
4. **Ops**: cartons, machines (plan maintenance before breakdowns), temps, capital investment. **Team**: fatigue, engagement, training, careers. **Reports**: P&L, cash, Earned Hours, variance bridge, reconciliation, audit history.
5. **Campaign**: chapters, products, two challenges, enterprise (up to 3 sites) and save slots.
Winning a chapter needs all four minimums: profit, on-time delivery, quality, engagement.

## Run locally
Requires Node 18+ (20 recommended).
```
npm install
npm run dev        # http://localhost:5173
npm test           # 92 tests (engine, accounting, workforce, enterprise, saves, screens)
npm run build      # production build + PWA service worker in dist/
npm run preview    # serve dist/ locally (needed to test offline/install)
```
Browser end-to-end checks (journey, accessibility scan, offline): `cd e2e && npm install && URL=http://localhost:4173/ npm run e2e` (with `npm run preview` running). Writes screenshots and `e2e-results.json` to `e2e/evidence/`.

## Architecture
`src/content` all game data and balance · `src/engine` pure simulation, no React (`sim.js` day engine, `report.js` quarter close, `clock.js`/`enterprise.js` real-time, `scenarios.js`, `slots.js`/`persist.js` saves) · `src/ui` React screens · `tests`. Rules live in the engine; UI only displays and calls actions. Randomness is a seeded RNG stored in the save.

## Clock and offline
One game day = 10 real minutes by default; players can pick Relaxed (30), Standard (10), Fast (5) or Manual only (no away progress) in Campaign → Time while you're away, per save and changeable mid-game (elapsed time is settled at the old rate first; challenges are locked to Standard). On opening the app (and every 30 s) it catches up elapsed whole days, at most 5 per call; extra time is forfeited, not banked. The save records how much real time has been consumed, so reloading or re-saving never repeats days, events or rewards. It stops at a significant bad event when pausing is allowed. Manual Next day/Week also resets the real-time marker. Challenges can disallow pausing. Limitation: an offline game cannot detect a device clock set forward; catch-up is capped for that reason. Everything works offline once loaded; nothing needs a network.

## Earned Hours (one rule, used everywhere)
Per day, for units produced: baseline hours = units × **locked** starting standard time; standard hours = units × current standard time; used hours = labor time actually spent (std time ÷ real pace, incl. machine slowdown and rework time).
- **Verified labor productivity** = baseline − standard (work content removed: containment, projects, assets).
- **Released capacity** = standard − used (pace/performance; may be negative and is then recorded, not debited).
- Total EH = baseline − used. The two never overlap. EH buy improvements.
- **Cash savings** are recognised only when overtime + temp cost is below the locked plan (2 OT h/person/day). Released capacity is never cash; unused paid hours stay paid.

## Financial model
Accrual P&L: revenue when shipped; credits for returns; costs: materials (COGS), scrap/rework, direct labor, overtime (escalating), temps, maintenance, expedite, opex, penalties, depreciation, asset opex, transfer fees. Separate cash flow: customer receipts 10 days after shipment; carton purchases when delivered; components when used; payroll same day; capital at purchase. Cash may go negative from payroll timing (documented overdraft rule); discretionary spending is blocked without cash. Variance bridge compares to a locked plan with an explicit unattributed residual. Quarter close runs reconciliation checks (units, cartons, reservations, EH identity, bank, cash, revenue, P&L) and the enterprise adds site/transfer/capital checks.

## Saves
Slots (`fdna3:slot:<id>`, one backup each) are enterprise containers with one or more site states, JSON-exportable. Import always creates a new slot after validation; malformed or incompatible data is rejected without touching existing saves. Older saves (Phase 1/2 single saves) migrate forward on load or import; the originals are never deleted. Old completed orders are archived after 90 days to bound size (≈160 KB per 60-day slot).

## Deploy (owner-controlled; nothing here is pushed for you)
1. `git init && git add . && git commit -m "Factory DNA 1.0"`; create the GitHub repo; `git remote add origin <url>`; `git push -u origin main`.
2. Vercel → Add New Project → import the repo. Framework Vite (auto), build `npm run build`, output `dist` (see `vercel.json`, which also sets no-cache on the service worker).
3. After the first deploy: open the URL, wait for load, install ("Add to Home Screen"/Install), go offline and reload to confirm.
4. Delete any stray `f.jsx` files left from earlier uploads. Replace placeholder icons in `public/` with real artwork before a public launch.

## Manual release checklist
New campaign → inspect an order and the limiting area → change staffing → Next day → buy an improvement → reach quarter end → read scorecard/reports → reload (progress kept) → export, import into a new slot → start a challenge and return to the campaign → go offline, reload, play a day → back online, reload. On a real phone: install to home screen, rotate, check touch targets and the map pan/zoom buttons.

## Known limitations
Real-device checks (iOS Safari, install prompt, haptics/battery) are not covered by automated runs. Placeholder icons. Worker names for replacement hires and new sites are placeholders. Map labels are dense on small phones (use the Aa toggle). Moving people is by tap, not drag. Three products only; no competing corporate capital bids, bidding, multiplayer or leaderboards. Product art is emoji.
