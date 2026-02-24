# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tennis court booking and membership management system for Club Belgrano (General Belgrano, Buenos Aires). Monorepo with NestJS backend and Vite+React frontend, using Supabase (PostgreSQL) as the database and auth provider.

**Language convention:** Code in English, UI text in Spanish.

## Commands

```bash
# Install all dependencies (from root)
npm install

# Development
npm run dev:backend          # NestJS watch mode (port 3000)
npm run dev:frontend         # Vite dev server

# Build
npm run build --workspace=backend    # TypeScript compilation → dist/
npm run build --workspace=frontend   # tsc + vite build

# Tests
npm run test                         # Jest (backend)
npm run test:watch --workspace=backend
npm run test:cov --workspace=backend

# Lint
npm run lint --workspace=backend     # ESLint + Prettier (auto-fix)
npm run lint --workspace=frontend    # ESLint
```

## Project Structure

```
tenis/
├── backend/                   # NestJS API
│   ├── src/
│   │   ├── main.ts            # Entry point (port 3000, CORS enabled)
│   │   ├── app.module.ts      # Root module
│   │   ├── bookings/          # Booking feature module
│   │   │   ├── bookings.controller.ts   # REST endpoints
│   │   │   ├── bookings.service.ts      # Business logic & debt engine
│   │   │   └── dto/booking.dto.ts       # DTOs & enums
│   │   └── supabase/          # Supabase client integration
│   ├── vercel.json            # Vercel deployment config
│   └── .env                   # SUPABASE_URL, SUPABASE_KEY, PORT
├── frontend/                  # Vite + React UI
│   ├── src/
│   │   ├── App.tsx            # Root component with routing
│   │   ├── index.css          # Global pastel design system (CSS vars)
│   │   ├── components/
│   │   │   ├── Calendar.tsx   # Court/time slot selection grid
│   │   │   └── BookingForm.tsx # Multi-step booking modal
│   │   ├── pages/
│   │   │   ├── Reserve.tsx    # Main booking dashboard
│   │   │   └── AdminDashboard.tsx # Admin approval panel
│   │   ├── lib/supabase.ts    # Supabase client init
│   │   └── types/booking.ts   # Shared TS interfaces
│   ├── vercel.json            # SPA rewrite config
│   └── .env                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── docs/requirements/         # Requirements analysis
├── .agents/skills/            # AI agent skills (see Skills section)
└── package.json               # NPM workspaces root
```

## Architecture

**Monorepo** using NPM workspaces (`backend/`, `frontend/`).

### Backend (NestJS)

- Feature modules pattern: each feature has its own `module`, `controller`, `service`, and `dto/` folder
- `SupabaseService` is a global injectable that provides the Supabase client via `getClient()`
- **Booking confirmation flow** (key business logic in `bookings.service.ts`):
  1. Create booking with players → status `pending`
  2. Admin confirms → fetches `monthly_parameters` for pricing, updates status to `confirmed`
  3. For each player: looks up `profiles.membership_type`, calculates proportional cost, inserts debt into `payments` table
- Membership tiers affect pricing: Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio

### Frontend (Vite + React + TypeScript)

- Routing via React Router v7 (`/` → Reserve, `/admin` → AdminDashboard)
- Vanilla CSS with a pastel design system defined in `index.css` (CSS variables: `--brand-blue`, `--clay-orange`, etc.)
- `Calendar.tsx`: 5 courts × 9 time slots (08:00–20:00, 90-min intervals), 7-day selector
- `BookingForm.tsx`: modal with match type selection (single/double) and player management
- Supabase client initialized in `lib/supabase.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Database (Supabase/PostgreSQL)

Key tables referenced in code: `bookings`, `booking_players`, `courts`, `profiles`, `monthly_parameters`, `payments`.

### Environment Variables

- Backend `.env`: `SUPABASE_URL`, `SUPABASE_KEY`, `PORT`
- Frontend `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Deployment

Both services deploy to Vercel with configs in their respective `vercel.json` files. Frontend uses SPA rewrite; backend routes all requests to the NestJS entry point.

## Skills (`.agents/skills/`)

This project includes agent skills that should be invoked via `/skill-name` depending on the task:

| Skill | When to use |
|-------|-------------|
| `nestjs-best-practices` | Writing, reviewing, or refactoring backend NestJS code — modules, controllers, services, DI, guards, pipes, interceptors, and error handling. 40 rules across architecture, DI, security, performance, and testing. |
| `supabase-postgres-best-practices` | Writing SQL queries, designing schemas, adding indexes, configuring RLS policies, optimizing query performance, or troubleshooting connection pooling. |
| `vercel-react-best-practices` | Writing or optimizing React components — re-render prevention, bundle size reduction, data fetching patterns, memoization, and Suspense boundaries. 57 rules from Vercel Engineering. |
| `ui-ux-pro-max` | Designing or building UI components, choosing color palettes, typography, implementing accessibility, animations, or applying visual styles (glassmorphism, etc.). Covers this project's React + Vanilla CSS stack. |
| `architecture-patterns` | Planning major refactors or new subsystems — Clean Architecture, Hexagonal Architecture, DDD. Use when restructuring the backend or decomposing features. |
| `requirements-analysis` | Clarifying vague feature requests before implementation. Helps distinguish stated wants from underlying problems and discover real constraints. |
| `find-skills` | Searching for and installing new agent skills when the existing ones don't cover a needed capability. Uses `npx skills find [query]`. |

## Implementation Plan

See `docs/implementation-plan.md` for the 12-phase roadmap (Phase 0–12) covering database schema, auth, CRUD modules, booking rewrite, bloqueos, abonos, payments, notifications, reports, audit, and polish.