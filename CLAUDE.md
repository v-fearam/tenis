# CLAUDE.md

## Project

Tennis court booking & membership system for Club Belgrano (BA). NestJS backend + Vite/React frontend + Supabase (Postgres + Auth).

**Convention:** Code in English, UI text in Spanish.

## Commands

```bash
npm install                              # root — installs all workspaces
npm run dev:backend                      # NestJS watch mode (port 3000)
npm run dev:frontend                     # Vite dev server
npm run build --workspace=backend        # tsc → dist/
npm run build --workspace=frontend       # tsc + vite build
npm run test                             # Jest (backend)
npm run lint --workspace=backend         # ESLint + Prettier (auto-fix)
npm run lint --workspace=frontend        # ESLint
```

## Architecture

**Monorepo** (NPM workspaces: `backend/`, `frontend/`).

- **Backend (NestJS 11)**: Feature modules — `module`, `controller`, `service`, `dto/`. Modules: Auth, Users, Bookings, Canchas, Bloqueos, Abonos, TurnosRecurrentes, Config, Supabase (global). All endpoints under `/api`.
- **Frontend (Vite + React 19 + TS)**: Vanilla CSS pastel design system (`index.css` vars). React Router v7. `AuthContext` for auth. `lib/api.ts` injects Bearer token.
- **Auth**: Supabase JWT (`JwtAuthGuard`), roles: `admin`, `socio`, `no-socio` (`RolesGuard` + `@Roles()`).
- **User creation**: Admin → `auth.admin.createUser()` → DB trigger creates `usuarios` row → service creates `socios` row if socio.

## Business Rules (Booking & Pricing)

Logic in `bookings.service.ts`:
- **Prices** from `config_sistema`: `precio_no_socio`, `precio_socio_sin_abono`, `precio_socio_abonado`, `descuento_recurrente`.
- **Cost split**: `base_tariff / total_players` per player, stored in `turno_jugadores.monto_generado`.
- **Abono x Partidos**: singles = 1 credit, doubles = 0.5 credits. Falls back to `precio_socio_sin_abono` if exhausted. Credits consumed at creation.
- **Lifecycle**: `create()` → status pending, cost calculated. `confirm()` → generates `pagos`. `cancel()` → refunds abono credits (0.5 for doubles, 1 for singles).

## Finanzas Dashboard (`/admin/finanzas`)

Frontend: `AdminFinance.tsx` — Recharts `ComposedChart` (stacked bars + line overlay on secondary Y axis).
- **`GET /pagos/historical-revenue`** → last 12 cierres → chart data
- **`GET /pagos/current-month-summary`** → 4 stat cards + tendencia %
- **Cierre mensual** (`ejecutarCierreMensual`): `ingreso_turnos` = `pagos.tipo='pago'` (cobrado efectivo). `ingreso_recurrentes` = `movimientos_recurrentes.tipo='pago'`. Column `ingreso_recurrentes` added (migration).
- Seed data: `db/seeds/seed_cierres.sql` (Dic 25, Ene 26, Feb 26)

## Recurring Bookings (TurnosRecurrentes)

Isolated module. Turnos are created as `confirmado` with `tipo_partido: 'double'`.
- **Debt model**: `deuda` = SUM past non-cancelled `monto_recurrente`; `comprometido` = SUM future; `saldo` = pagado − deuda.
- Frontend: `id_usuario_responsable` (usuarios.id from typeahead) → service resolves to `socios.id`.
- New tables: `turnos_recurrentes`, `movimientos_recurrentes`. New columns on `turnos`: `id_turno_recurrente`, `monto_recurrente`.

## Database & API Reference

See `docs/claude-reference.md` for full endpoints and schema.

Key tables: `usuarios`, `socios`, `turnos`, `turno_jugadores`, `canchas`, `bloqueos`, `tipos_abono`, `pagos`, `config_sistema`, `cierres_mensuales`, `turnos_recurrentes`, `movimientos_recurrentes`.

## Deployment

Both services on Vercel. Frontend: SPA rewrite. Backend: all routes → NestJS entry point.

## Skills

| Skill | When to use |
|-------|-------------|
| `nestjs-best-practices` | NestJS modules, DI, guards, pipes, interceptors |
| `supabase-postgres-best-practices` | SQL, schemas, indexes, RLS, query optimization |
| `vercel-react-best-practices` | React re-renders, bundle size, data fetching, memoization |
| `ui-ux-pro-max` | UI design, palettes, typography, accessibility, animations |
| `architecture-patterns` | Major refactors — Clean/Hexagonal/DDD |
| `requirements-analysis` | Clarifying vague feature requests |
| `find-skills` | Searching for new agent skills |
