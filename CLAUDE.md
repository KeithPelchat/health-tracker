# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server on port 3100
npm run build        # production build
npm run start        # start production server (port 3100)
npm run db:push      # push schema changes (npx prisma db push)
npm run db:generate  # regenerate Prisma client
```

**Deploy sequence (schema change):**
```bash
npx prisma db push && npx prisma generate && npm run build && pm2 restart keith-health
```

**PM2:**
```bash
pm2 status
pm2 logs keith-health
pm2 restart keith-health
```

## Architecture

Next.js 14 App Router, Prisma + PostgreSQL, Recharts, Anthropic SDK. No test suite. No linting config.

**Stack:**
- All pages: `src/app/<page>/page.tsx` (client components, `'use client'`)
- All API routes: `src/app/api/<resource>/route.ts`
- DB schema: `prisma/schema.prisma` — push changes with `npx prisma db push`
- Shared utilities: `src/lib/` — `prisma.ts` (singleton), `dates.ts` (Chicago timezone), `generateRecommendation.ts` (AI data summary), `seedProtocol.ts`

**Pages:** `/log`, `/history`, `/patterns`, `/meals`, `/recommendations`, `/export`

**Key API routes:**
- `POST /api/log` — upserts `DailyLog` by date (all daily vitals: weight, BP, sleep, walk, hydration, supplements)
- `GET /api/patterns` — aggregated trend data with `?period=7|30|all`
- `GET/POST /api/food` — `FoodEntry` records linked to `Meal` library
- `POST /api/coach/chat` — streams Claude response using `buildDataSummary()` + protocol context
- `GET /api/export` — generates formatted text export with `?range=today|yesterday|7days`

**Data model:**
- `DailyLog` — one row per day, all vitals (weight, BP, RHR, sleep, walk miles/mins/secs, hydration, supplements, notes)
- `Meal` — nutrient library with four categories: `protein` (per 100g), `countable` (per unit), `vegetable` (per 100g), `condiment` (per fixed portion)
- `FoodEntry` — logged servings linked to `Meal`, grouped by `mealSlot` (breakfast/lunch/snack/dinner)
- `CoachMessage` — persisted chat history by date
- `Recommendation` — daily AI coaching writeup with data snapshot

**AI integration (`src/lib/generateRecommendation.ts`):**
- `buildDataSummary()` — queries last 90 days, formats structured text used as context for both the daily recommendation and coach chat. Walking calorie burn uses MET 3.8 formula.
- `generateRecommendation()` — streams a coaching response and upserts to `Recommendation` table
- Coach chat (`/api/coach/chat`) streams via Anthropic SDK using `claude-sonnet-4-6`

**CSS variables** (defined in `globals.css`):
`--navy`, `--sky`, `--green`, `--red`, `--orange`, `--gold`, `--text`, `--text-muted`, `--surface`, `--surface2`, `--border`, `--bg`

**Date handling:** All dates are stored as UTC midnight. The app uses Chicago timezone via `src/lib/dates.ts` (`todayChicago()`, `toChicagoDateStr()`). Always use these helpers — never `new Date()` for the current date.

## Deployment

Served at `https://ft.keithpelchat.com` via Nginx reverse proxy → PM2 process `keith-health` on port 3100. Cloudflare SSL Full (strict). EC2 Amazon Linux 2023.

Environment variables required: `DATABASE_URL`, `ANTHROPIC_API_KEY`
