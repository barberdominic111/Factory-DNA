# Factory DNA

A cozy manufacturing management simulator. You inherit an existing factory
and improve it over time — managing variability with the people, equipment,
and resources you already have, rather than building from scratch or just
chasing profit.

## Project structure

```
src/
  data/          game balance & content (edit these, not the logic)
    dna.js           Factory DNA slider definitions
    presets.js       factory profile presets, worker names, machine types
    events.js        random event pool
    improvements.js  Earned Hours shop catalog
  engine/        pure simulation logic, no React
    generate.js      seeded RNG + starting worker/machine generation
    simulate.js      the daily simulation math (earned hours, productivity, etc.)
  components/    UI pieces, one per file
  App.jsx        the day-phase state machine: setup -> morning -> planning
                 -> simulating -> results -> (loop)
  main.jsx       React entry point
public/          static assets + PWA icons
```

This split matches the "don't hardcode values" and "modular architecture"
goals from the design doc — new content (events, presets, upgrades) goes in
`src/data/*`, new mechanics go in `src/engine/*`, and new UI goes in
`src/components/*` without touching the rest.

## Run it locally

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL.

## Push to GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Factory DNA MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on github.com first, or use `gh repo create` if you
have the GitHub CLI installed.)

## Deploy to Vercel

Easiest path — no config needed, Vercel auto-detects Vite:

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Framework preset: **Vite** (auto-detected).
3. Build command: `npm run build` (default). Output directory: `dist` (default).
4. Deploy.

Every push to `main` will auto-redeploy. The app is already configured as an
installable PWA (see `vite.config.js`), so once deployed, it can be "Added to
Home Screen" on iOS/Android and installed as a desktop app from Chrome.

**Note:** `public/icon-192.png` and `public/icon-512.png` are placeholder
icons generated for this scaffold — swap them for real artwork before a
real launch.

## What's implemented (MVP slice)

- Factory DNA setup with 11 sliders across 4 groups + 6 quick-start presets
- 6 generated workers (skill/effort/morale/fatigue/cross-training) and 5
  machines (availability/efficiency/breakdown risk), assignable via dropdown
- Daily loop: Morning (event + review) -> Planning (assign + invest) ->
  Simulation (animated) -> Results (stats)
- Earned Hours system feeding an Improvement Shop (cross-training, PM,
  standard work, automation, fixtures)
- 15 random events (positive/neutral/negative) with real gameplay effects
- Calendar with day/week/month/quarter and period-based framing
- 7-day productivity history strip

## Natural next slices

- Save/load (works fine with `localStorage` once running on Vercel — the
  in-browser Claude artifact preview blocks it, this scaffold doesn't use it
  yet)
- Quarterly review modal (customer scorecards, financial review, bonus
  eligibility)
- Local hot-seat co-op mode (Player One: production/scheduling/labor,
  Player Two: inventory/purchasing/CI/capital)
- Multiple factories / campaign mode
- Worker absence & fatigue surfaced more clearly in the UI
