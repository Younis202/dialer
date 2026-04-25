# DIALR - World Dialer & CRM

A modern web-based telephony application and CRM system for global calling via SIP and P2P communication.

## Overview

DIALR enables international calls via Voip.ms SIP integration, P2P encrypted video/audio calls between DIALR users, SMS management, contact CRM, power dialer, and call analytics.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Server**: Custom `server.ts` using `tsx` — runs Next.js + WebSocket signaling server on port 5000
- **Database**: PostgreSQL (Replit Postgres) with Drizzle ORM
- **Telephony**: JsSIP (SIP/Voip.ms), WebRTC (P2P calls)
- **UI**: Tailwind CSS, Framer Motion, Lucide React, Shadcn UI components

## Project Structure

- `server.ts` — Entry point; starts Next.js + WebSocket signaling server
- `src/app/` — Next.js App Router pages and API routes
  - `api/` — Backend API routes (calls, contacts, messages, stats, settings)
  - `analytics/`, `contacts/`, `history/`, `lists/`, `messages/`, `network/`, `power/`, `settings/` — Feature pages
  - `page.tsx` — Main Dialer interface
- `src/components/` — UI components
  - `dialer/` — Keypad, active call UI, cost optimizer
  - `shell/` — Layout (sidebar, header), context providers (SIP/P2P)
  - `ui/` — Radix-based primitives
- `src/lib/` — Core utilities
  - `db/` — Database schema (schema.ts) and client
  - `p2p/`, `sip/` — WebRTC/JsSIP wrappers
  - `rates.ts` — International call rate comparison
- `drizzle.config.ts` — Drizzle ORM configuration
- `next.config.mjs` — Next.js configuration

## Running the App

```bash
npm run dev       # Development server (tsx server.ts)
npm run build     # Build for production
npm run start     # Production server
npm run db:push   # Push schema changes to database
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit Postgres)
- `PORT` — Server port (defaults to 5000)

## SIP / Voip.ms Configuration

Users configure their Voip.ms SIP credentials via the Settings page in the app UI. No hardcoded credentials needed.

## Deployment

The app runs on port 5000 and is deployed via the "Start application" workflow (`npm run dev`).
For production deployment, the command is `NODE_ENV=production tsx server.ts`.
