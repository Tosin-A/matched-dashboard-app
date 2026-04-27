# MatchLock Dashboard

MatchLock is a matched betting dashboard built with Next.js.  
It combines offer tracking, bet logging, calculators, and live Smarkets market data in one app.

## Current App Status

The app is working end to end locally:

- Multi-tab dashboard UI
- Offer pipeline tracking
- Bet logging with P&L calculations
- Qualifying and free bet calculators
- Acca helper
- Live odds scanner via server-side Smarkets API proxy
- Local persistence using browser `localStorage`

## Features

- **Overview**: KPI cards for profit, qualifying loss, free bet unlocks, and pipeline progress
- **Calculator**: qualifying, free bet SNR, and free bet SR modes
- **Odds Scanner**: fetches events/markets/contracts/quotes from Smarkets and ranks selections
- **Offers**: track bookmaker offers and status (`unused`, `qualifying`, `free_bet`, `complete`, `failed`)
- **Bet Log**: log back/lay bets, update outcomes, and export CSV
- **Acca Helper**: plan multi-leg matched setups with liability visibility

## Tech Stack

- Next.js (App Router)
- TypeScript
- API route proxy for Smarkets (`src/app/api/smarkets/route.ts`)

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` from `.env.example` and provide:

```bash
SMARKETS_USERNAME=your-email@example.com
SMARKETS_PASSWORD=your-password
```

Notes:

- Credentials are read server-side only by the API route.
- Do not commit `.env.local`.
- If credentials are missing, Smarkets requests run unauthenticated and may be limited.

## Data Storage

- Offers are saved in `localStorage` under `matchlock_offers`
- Bets are saved in `localStorage` under `matchlock_bets`

Clearing browser storage resets local app data.

## Project Structure

- `src/app/page.tsx`: app entry
- `src/components/Dashboard.tsx`: main shell and tab routing
- `src/components/Overview.tsx`: summary/KPI view
- `src/components/Calculator.tsx`: matched betting calculator
- `src/components/OddsScanner.tsx`: market scanner UI
- `src/components/OfferTracker.tsx`: offer management
- `src/components/BetLog.tsx`: bet history and export
- `src/components/AccaHelper.tsx`: acca planning tool
- `src/app/api/smarkets/route.ts`: authenticated Smarkets proxy

## Security

- Keep credentials and tokens out of docs and source files.
- Store secrets only in env files.
