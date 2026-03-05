# CLAUDE.md

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

## Architecture

**Monorepo** using NPM workspaces (`backend/`, `frontend/`).

- **Backend (NestJS 11)**: Feature modules pattern — each feature has `module`, `controller`, `service`, `dto/`. Modules: Auth, Users, Bookings, Canchas, Bloqueos, Abonos, Config, Supabase (global). All endpoints under `/api` prefix.
- **Frontend (Vite + React 19 + TS)**: Vanilla CSS with pastel design system (`index.css` CSS vars). React Router v7. Auth via `AuthContext`. API client in `lib/api.ts` with Bearer token injection.
- **Auth**: Supabase Auth with JWT validation (`JwtAuthGuard`), role-based access (`RolesGuard` + `@Roles()` decorator). Roles: `admin`, `socio`, `no-socio`.
- **User creation flow**: Admin creates user via `auth.admin.createUser()` → DB trigger auto-creates `usuarios` row → service creates `socios` row if role is socio.

## Business Rules (Booking & Pricing)

Key logic in `bookings.service.ts`:

1. **At creation** (`create()`): status `pending`, cost calculated immediately:
   - Prices from `config_sistema` table (keys: `precio_no_socio`, `precio_socio_sin_abono`, `precio_socio_abonado`)
   - Each player's cost = `base_tariff / total_players` (proportional split)
   - **Abono x Partidos**: consumes credits → $0 if credits available. **Credit consumption varies by match type**: singles = 1 credit, doubles = 0.5 credits. If credits exhausted, falls back to `precio_socio_sin_abono`
   - **Socio sin abono**: `precio_socio_sin_abono` rate
   - **No socio / Invitado**: `precio_no_socio` rate
   - Abono credits consumed immediately. Per-player cost stored in `turno_jugadores.monto_generado`
   - `creditos_disponibles` is `numeric(5,1)` — supports fractional values (e.g. 3.5)
2. **At confirmation** (`confirm()`): admin confirms → generates `pagos` (debt records) from pre-calculated `monto_generado`
3. **At cancellation** (`cancel()`): refunds abono credits for players with `uso_abono = true` (refund amount matches match type: 0.5 for doubles, 1 for singles)
4. **Cost preview** (`POST /api/bookings/preview`): estimates cost before submitting. Accepts optional `match_type` to calculate correct credit usage.

Membership tiers: Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio. `config_sistema` is the single source of truth for pricing (keys normalized: lowercase, spaces → underscores).

## Database & API Reference

For full API endpoints and DB schema details, read `docs/claude-reference.md` (only when needed).

Key tables: `usuarios`, `socios`, `turnos`, `turno_jugadores`, `canchas`, `bloqueos`, `tipos_abono`, `pagos`, `config_sistema`, `cierres_mensuales`. Trigger `handle_new_user` on `auth.users` auto-creates `usuarios` row. RLS enabled on all tables.

## Deployment

Both services deploy to Vercel. Frontend: SPA rewrite. Backend: routes all to NestJS entry point.

## Skills

| Skill | When to use |
|-------|-------------|
| `nestjs-best-practices` | Writing/reviewing NestJS code — modules, DI, guards, pipes, interceptors |
| `supabase-postgres-best-practices` | SQL queries, schemas, indexes, RLS policies, query optimization |
| `vercel-react-best-practices` | React components — re-renders, bundle size, data fetching, memoization |
| `ui-ux-pro-max` | UI design, color palettes, typography, accessibility, animations |
| `architecture-patterns` | Major refactors — Clean Architecture, Hexagonal, DDD |
| `requirements-analysis` | Clarifying vague feature requests before implementation |
| `find-skills` | Searching for new agent skills |
