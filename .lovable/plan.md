# 12-Item Bug-Fix Sweep

I'll work through the items in the order you listed, but grouped by file for safe edits. One additive migration is needed; everything else is code.

## 1. Schema (one additive migration)

`ALTER TABLE cities ADD COLUMN monthly_rent_modifier numeric NOT NULL DEFAULT 0;`

Used by item #7 (rental income tracks market events). No other schema changes — value-history retention bump (30 days) is a code change to `processDailyTicks`.

## 2. Daily tick / weather / news (`src/lib/game.ts`, `src/lib/news.ts`)

- **#4** Apply `weather_multiplier` to maintenance: confirmed already wired (`computeMonthlyMaintenance(value, weather)`); verify with a console.log in dev and add a one-line comment so it isn't accidentally dropped.
- **#6** Confirm news firing: keep `count = 2 + floor(rand()*2)`, but **weight the daily pool 60/40 positive/negative** by inflating `weight` for `price_modifier > 0` events when picking (positive bias factor `1.5`).
- **#7** Per city, derive `monthly_rent_modifier = 0.5 * sum(today's price_modifier for that city)`, persist it on the cities row in `applyDailyMarket`, and in the tick rent block multiply `tenant.monthly_rent` by `(1 + city.monthly_rent_modifier)` for that day's collection.
- **#11** Bump value-history retention from 7 to 30 days.
- **#2** Loan repayments are already aggregated into `loan_paid` on `daily_ticks`; expose it in the gazette (UI item below).
- **#8** Eviction completion already calls `generateApplicants(...)`; add a defensive recheck: after the loop, for every property whose status is `vacant` and has zero applicants, call `generateApplicants(...)`.

## 3. Weather cron route (`src/routes/api/public/hooks/weather-update.ts`)

No code change to logic — confirm the cron is wired (it is). Add a manual-trigger safety: route returns the per-city result so we can spot-check from the console.

Add a row to `news_events`-style ticker: in `applyDailyMarket`, after writing city rows, insert one `market_news` row per city whose `weather_multiplier > 1.10` with `headline = "{city}: {label} disrupts maintenance"` and `event_type = "weather"`, `price_modifier = 0`. (Idempotent via `(tick_date,event_key)` UNIQUE — key = `weather:{cityId}:{date}`.)

## 4. UI — Today tab (`src/components/DailyReportModal.tsx`)

- **#4** Remove the `weather_label` chip from the Market Modifiers card. Add a new **Weather** section listing each city: `{name}: {label} · maintenance ×{mult.toFixed(2)}` with red tint when mult > 1, plus its rent modifier from item #7 (`rent ×{(1+mod).toFixed(2)}`).
- **#5** Latest Random Event already shows the amount (verified in code) — make it more prominent (larger font, success/destructive background).

## 5. UI — Daily Gazette (`src/components/DailyGazette.tsx`)

- **#1** Already shows once per day after the tick; the issue is the modal only mounts after the tick effect resolves on the *current* render. Fix in `_app.tsx`: lift the gazette-show check so it triggers immediately on mount when `last_tick_date == today && last_gazette_shown < today` (no swipe required). Also force `qc.invalidateQueries(["latest_tick"])` and `(["gazette_data"])` on mount.
- **#2** Add `Loan repayments: −R{amount}` row using `tick.loan_paid` (already on the row).
- **#5** Make the random-event "Impact" line a bold green/red chip instead of small uppercase text.

## 6. App refresh on focus (`src/routes/_app.tsx`)

Add a `visibilitychange` listener: when `document.visibilityState === "visible"`, call `qc.invalidateQueries()` for `profile`, `player_properties`, `loans`, `ledger`, `properties`, `tenants`, `latest_tick`, `gazette_data`, `market_news`. Wire alongside the existing tick effect.

## 7. Portfolio (`src/routes/_app.portfolio.tsx`)

- **#9** Hide `Renew` and `Release` buttons unless `lease_end` is within 2 days of today. Show a small "lease healthy" hint instead.
- **#10** Add an `info` button next to the "City collection" header opening a small modal explaining Trophy / Prestige tiers and how to acquire them. New file: `src/components/CollectionInfoModal.tsx`.
- **#11** Make each property card tappable → opens a new `PropertyDetailDrawer` (new file `src/components/PropertyDetailDrawer.tsx`) with photo, nickname/address, current value, purchase price, profit/loss, and a 30-day recharts `LineChart` from `useValueHistory` (already returns an array per property).

## 8. Trophy/Prestige celebration (`src/components/AcquisitionCelebration.tsx` + buy flow)

- **#10** When the purchased property is tier 4 or 5 **and** it's the player's first in that tier, render a distinct gold/platinum hero card with copy "Trophy Acquired" or "Prestige Property Added to Your Empire". Detection: pass `isFirstTrophy` / `isFirstPrestige` flags from the buy callsites by counting existing tier-4/5 properties in `owned`.

## 9. Market & Map "NEW" badge

- **#12 Market** (`src/routes/_app.market.tsx`): if `now - listed_at < 24h`, add a small gold `NEW` chip on the card.
- **#12 Map** (`src/components/MapView.tsx`): pass `isNew` into the marker icon factory; render a pulsing gold ring around new pins via an extra `<span class="pe-pin-new-pulse">` and a CSS keyframe in `src/styles.css`.

## Out of scope (per your instructions)

Loan system, gazette layout (only content additions), leaderboard, achievements, image system — untouched.

## Migration first, then code

I'll send the migration for approval, then implement all UI/logic changes in one batch and report back item-by-item.