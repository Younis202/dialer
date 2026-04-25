# DIALR — World Dialer & CRM

A premium 2026 web dialer + CRM built on Next.js 15, custom Node WebSocket server, Postgres, Drizzle, JsSIP (Voip.ms), and WebRTC P2P.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Server**: Custom `server.ts` (tsx) — Next.js + WebSocket signaling on port 5000
- **DB**: Replit Postgres + Drizzle ORM (`drizzle-kit push`)
- **Telephony**:
  - `JsSIP` browser-side SIP for Voip.ms (cheapest worldwide rates from a US number)
  - WebRTC P2P (free DIALR-to-DIALR calls) over our own `/ws` signaling
- **UI**: Tailwind v3, hand-rolled shadcn-style primitives, Framer Motion, Lucide, Recharts, sonner, cmdk
- **Phone**: `libphonenumber-js`

## Layout

```
server.ts                 # custom Next + WebSocket server
src/
  app/                    # 14 pages + /api/* routes
    api/                  # REST CRUD (calls, contacts, lists, messages,
                          # scheduled, scripts, voicemails, dnc, settings,
                          # dispositions, stats)
    page.tsx              # Dialer (centerpiece)
    power/                # Auto-dialer
    network/              # P2P presence
    world/                # Country reach
    contacts/, lists/, history/, messages/, scheduled/,
    scripts/, voicemail/, analytics/, dnc/, settings/
    globals.css           # Full design system
    layout.tsx
  components/
    ui/                   # ~22 primitives
    shell/                # sidebar, header, command-palette, providers, page-header
    dialer/               # keypad, number-display, cost-optimizer, active-call
  lib/
    db/                   # Drizzle schema + client
    sip/client.ts         # JsSIP wrapper (Voip.ms)
    p2p/peer.ts           # WebRTC P2P
    rates.ts              # multi-provider per-min costs
    phone.ts, utils.ts
```

## Workflow

`npm run dev` (configured) → `tsx server.ts` listening on `:5000` (webview).

## Deployment

Use **Reserved VM** so the WebSocket server persists. Build: `npm run build`. Start: `npm start`.

## Setup

User credentials live in `/settings` (stored as JSON in `settings` table). See `SETUP_GUIDE.md` for the user-facing onboarding.

## Recent changes

- 2026-04-25: Initial rebuild from Flask/vanilla-JS to Next.js stack. All 14 pages, 11 API route groups, full design system, P2P + SIP wrappers shipped.
- 2026-04-25: Migrated from Replit Agent to Replit. Provisioned Replit Postgres, pushed Drizzle schema, removed leftover Flask scaffolding (`main.py`, `pyproject.toml`, `uv.lock`, `dialr.db`), confirmed Next.js + custom WS server boots cleanly on port 5000.
