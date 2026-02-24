# Implementation Plan: Tennis Club Management System (ERS)

## Context

The ERS defines a comprehensive tennis court booking and membership management system for Club Belgrano. The current codebase has a basic booking flow (create, list, confirm) but lacks auth, validation, proper data model, abonos, bloqueos, payments, notifications, and reports. This plan rebuilds the system in 12 phases ordered by dependency.

## Current State vs Target

**Built:** Basic booking CRUD (cancel stubbed), hardcoded Calendar, BookingForm (not connected to API), AdminDashboard, Reserve page with fake metrics, Supabase integration without auth guards.

**Missing:** Full data model, auth/RBAC, monthly parameters, abonos, bloqueos, payments/cuenta corriente, proper cost calculation, calendar with real availability, socio pages, reports, notifications, audit logging.

---

## Phase 0: Database Schema

Create `db/migrations/` at project root with SQL files for Supabase.

**Tables:** `usuarios`, `socios`, `canchas`, `parametros_mensuales`, `turnos` (with GiST exclusion constraint for overlap prevention), `turno_jugadores`, `bloqueos`, `abonos`, `pagos`

**Files:**
- CREATE `db/migrations/001_initial_schema.sql` — Full schema with constraints and indexes
- CREATE `db/migrations/002_seed_courts.sql` — Seed 5 courts
- CREATE `db/migrations/003_rls_policies.sql` — Row Level Security
- CREATE `db/README.md` — Migration instructions
- CREATE/MODIFY `frontend/src/types/` — Type files for all entities (user.ts, court.ts, turno.ts, parametro.ts, abono.ts, pago.ts, bloqueo.ts, index.ts)

---

## Phase 1: Authentication & Authorization

Secure the app with Supabase Auth + JWT guards.

**Backend — new `auth/` module:**
- `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- `guards/jwt-auth.guard.ts` — Extract + validate Supabase JWT from Bearer token
- `guards/roles.guard.ts` — Check user role via `@Roles()` decorator
- `decorators/roles.decorator.ts`, `decorators/current-user.decorator.ts`
- `strategies/supabase.strategy.ts`
- `dto/auth.dto.ts`
- MODIFY `main.ts` — Add global `ValidationPipe`, API prefix `/api`
- MODIFY `app.module.ts` — Import AuthModule
- MODIFY `bookings.controller.ts` — Add guards, replace placeholder userId

**Frontend:**
- CREATE `contexts/AuthContext.tsx` — user, session, login(), logout(), isAdmin
- CREATE `pages/Login.tsx` — Email/password login
- CREATE `components/ProtectedRoute.tsx` — Redirect to /login if unauthenticated
- CREATE `components/AdminRoute.tsx` — Check isAdmin
- CREATE `lib/api.ts` — Centralized fetch wrapper with Bearer token
- MODIFY `App.tsx` — Wrap with AuthProvider, add /login route, protect routes
- MODIFY `Reserve.tsx` — Use useAuth() context
- MODIFY `AdminDashboard.tsx` — Use api client, protect with AdminRoute
- MODIFY `.env` — Add `VITE_API_URL`

---

## Phase 2: Courts, Users & Monthly Parameters CRUD

Admin management of foundational entities. Prerequisites for correct booking flow.

**Backend — new modules:**

`courts/` module:
- `GET /api/courts` — List active courts (public)
- `GET /api/courts/all` — All courts including inactive (admin)
- `PATCH /api/courts/:id` — Update court (admin)

`users/` module:
- `GET /api/users/search?q=term` — Search by name/DNI/phone (admin)
- `GET /api/users/:id` — User profile with socio info
- `GET /api/users/me` — Current user's profile
- `PATCH /api/users/:id` — Update role/status (admin)

`monthly-parameters/` module:
- `GET /api/monthly-parameters/current` — Current month's published params
- `GET /api/monthly-parameters/:mesAnio` — Params for specific month
- `POST /api/monthly-parameters` — Create draft (admin)
- `PATCH /api/monthly-parameters/:id` — Update draft, fails if published (admin)
- `PATCH /api/monthly-parameters/:id/publish` — Publish and freeze (admin)

**Frontend:**
- CREATE `pages/admin/CourtsManagement.tsx`
- CREATE `pages/admin/MonthlyParameters.tsx`
- CREATE `pages/admin/UserManagement.tsx`
- CREATE `components/PlayerSearch.tsx` — Search by name/DNI/phone with autocomplete
- CREATE `components/Layout.tsx` — Shared layout with sidebar (different nav for admin vs socio)
- CREATE `components/Sidebar.tsx`
- MODIFY `App.tsx` — Add admin routes, wrap in Layout

---

## Phase 3: Booking Flow Rewrite

Replace placeholder booking logic with full ERS-compliant flow. **This is the critical path.**

**Backend — rewrite `bookings/` module:**

Rename routes from `/bookings` to `/turnos`.

New endpoints:
- `POST /api/turnos` — Create booking (authenticated)
- `GET /api/turnos` — List with filters: date, court, status (admin)
- `GET /api/turnos/availability?fecha=&id_cancha=` — Available slots (public)
- `GET /api/turnos/my` — Current user's bookings (socio)
- `GET /api/turnos/:id` — Booking detail
- `PATCH /api/turnos/:id/confirm` — Confirm (admin)
- `PATCH /api/turnos/:id/cancel` — Cancel (admin or owner)

**Create logic:**
1. Validate court is active
2. Validate no overlap with existing turnos (DB exclusion constraint as safety net)
3. Validate no overlap with bloqueos
4. Validate time aligns with monthly parameters (hours, duration, enabled days)
5. Validate player count (single=2, double=2-4)
6. Insert turno + turno_jugadores

**Confirm logic:**
1. Fetch turno (must be pendiente) + monthly params
2. For each jugador: resolve condicion_en_mes (Abono Libre → $0, Abono Partidos with credit → $0 + deduct, Socio sin abono → tarifa_socio/num_players, No Socio → tarifa_no_socio/num_players)
3. Insert cargo records into pagos, update turno_jugadores
4. Set estado=confirmado, confirmado_por=admin

**Cancel logic:**
1. If confirmado and devuelve_credito_cancelacion: restore abono credits
2. Insert devolucion records in pagos
3. Set estado=cancelado + motivo

**Frontend:**
- MODIFY `Calendar.tsx` — Fetch real availability, real courts from API, color coding (green=available, blue=pending, yellow=confirmed, red=blocked, gray=past)
- MODIFY `BookingForm.tsx` — Connect to POST /api/turnos, add PlayerSearch, use react-hook-form
- MODIFY `Reserve.tsx` — Fetch real metrics (next match, balance, credits, available courts)
- MODIFY `AdminDashboard.tsx` — Fetch from /api/turnos

**Calendar CSS vars to add:**
```css
--slot-available: #D5F5E3;
--slot-pending: #D6EAF8;
--slot-confirmed: #FCF3CF;
--slot-blocked: #FADBD8;
--slot-past: #EAECEE;
```

---

## Phase 4: Court Blocks (Bloqueos)

**Backend — new `bloqueos/` module:**
- `POST /api/bloqueos` — Create block (admin)
- `GET /api/bloqueos?fecha_desde=&fecha_hasta=&id_cancha=` — List blocks
- `DELETE /api/bloqueos/:id` — Remove block (admin)

**Frontend:**
- CREATE `pages/admin/BloqueosManagement.tsx`

*Can be built in parallel with Phase 5.*

---

## Phase 5: Abono Management

**Backend — new `abonos/` module:**
- `POST /api/abonos` — Sell abono to socio (admin)
- `GET /api/abonos?id_socio=&mes_anio=` — List abonos (admin)
- `GET /api/abonos/my` — Current user's active abono (socio)
- `PATCH /api/abonos/:id/deactivate` — Deactivate (admin)

Sell logic: verify socio active, no duplicate abono for month, lookup monthly price, set credits (libre=999, 5=5, 10=10), insert cargo in pagos.

**Frontend:**
- CREATE `pages/admin/AbonoManagement.tsx`
- CREATE `pages/socio/MiAbono.tsx` — Credits, usage history, expiration

*Can be built in parallel with Phase 4.*

---

## Phase 6: Payments & Cuenta Corriente

**Backend — new `pagos/` module:**
- `POST /api/pagos` — Record manual payment (admin)
- `GET /api/pagos/balance/:idSocio` — Balance calculation
- `GET /api/pagos?id_socio=&desde=&hasta=` — Transaction history
- `GET /api/pagos/my` — Current user's balance (socio)
- `GET /api/pagos/debtors` — Socios with outstanding debt (admin)

**Frontend:**
- CREATE `pages/admin/Cobranzas.tsx` — Debtor list, record payments, filters
- CREATE `pages/socio/MiCuenta.tsx` — Balance + transaction history
- MODIFY `Reserve.tsx` — Real cuenta corriente metric from /api/pagos/my

---

## Phase 7: Socio Pages + Enhanced Calendar

**Frontend only (uses existing endpoints):**
- CREATE `pages/socio/MisPartidos.tsx` — Upcoming/past matches, cancel option
- CREATE `components/CalendarWeekView.tsx` — 7-day × time rows view
- CREATE `components/CalendarMonthView.tsx` — Monthly occupancy overview
- MODIFY `Calendar.tsx` — View toggle (day/week/month)

*Can be built in parallel with Phase 8.*

---

## Phase 8: Admin Calendar & Dashboard Redesign

**Frontend:**
- CREATE `pages/admin/CalendarAdmin.tsx` — Full calendar with all statuses, click-to-confirm, click-to-block
- CREATE `components/BookingDetailModal.tsx` — Full booking detail with actions
- MODIFY `AdminDashboard.tsx` — Real dashboard: pending count, today's bookings, revenue summary

*Can be built in parallel with Phase 7.*

---

## Phase 9: In-App Notifications

**Database:** New migration `004_notifications.sql` — `notificaciones` table

**Backend — new `notifications/` module:**
- `GET /api/notifications` — Current user's notifications
- `PATCH /api/notifications/:id/read` — Mark as read
- `PATCH /api/notifications/read-all` — Mark all as read

Integration: bookings.service emits on confirm/cancel, abonos.service emits on sell/low credits.

**Frontend:**
- CREATE `components/NotificationBell.tsx` — Bell icon with unread count dropdown
- CREATE `hooks/useNotifications.ts` — Polls every 30s

---

## Phase 10: Reports

**Backend — new `reports/` module (admin only):**
- `GET /api/reports/revenue?mes_anio=` — Monthly charges, payments, outstanding
- `GET /api/reports/debtors` — Socios with unpaid balances
- `GET /api/reports/court-usage?mes_anio=` — Per-court bookings, occupancy, peaks
- `GET /api/reports/credit-consumption?mes_anio=` — Credits sold vs used vs expired

**Frontend:**
- CREATE `pages/admin/Reports.tsx` — Report cards, month selector, tables
- CREATE `components/ReportCard.tsx`

---

## Phase 11: Audit Logging

**Database:** New migration `005_audit_log.sql` — `audit_log` table

**Backend — new `audit/` module:**
- `audit.service.ts` — Log action with actor, entity, before/after snapshot
- `audit.interceptor.ts` — Auto-log on decorated endpoints
- `decorators/auditable.decorator.ts` — `@Auditable('turno.confirm')`
- Add `@Auditable()` to all admin mutation endpoints

**Frontend:**
- CREATE `pages/admin/AuditLog.tsx` — Searchable log viewer

---

## Phase 12: Polish & Testing

**Backend tests:**
- `bookings.service.spec.ts` — create, confirm, cancel, overlap
- `abonos.service.spec.ts` — sell, deduct, expire
- `pagos.service.spec.ts` — balance calculation
- `test/bookings.e2e-spec.ts` — Full booking flow
- `test/auth.e2e-spec.ts` — Login + protected routes

**Frontend polish:**
- `components/ErrorBoundary.tsx`
- `components/LoadingSpinner.tsx`
- `components/Toast.tsx` — Replace all alert() calls
- Mobile-first responsive polish in `index.css`
- Loading skeletons for better perceived performance

---

## Dependency Graph

```
Phase 0 (Schema)
  └─ Phase 1 (Auth)
       └─ Phase 2 (Courts + Users + Params)
            └─ Phase 3 (Booking Rewrite)  ← critical path
                 ├─ Phase 4 (Bloqueos)     ← parallel
                 └─ Phase 5 (Abonos)       ← parallel
                      └─ Phase 6 (Pagos)
                           ├─ Phase 7 (Socio Pages)  ← parallel
                           └─ Phase 8 (Admin Cal)    ← parallel
                                └─ Phase 9 (Notifications)
                                     └─ Phase 10 (Reports)
                                          └─ Phase 11 (Audit)
                                               └─ Phase 12 (Polish)
```

## Verification

After each phase:
1. `npm run build --workspace=backend` — must compile
2. `npm run build --workspace=frontend` — must compile
3. `npm run test` — existing tests must pass
4. Manual test new endpoints via curl or Postman
5. Manual test new UI pages in browser

End-to-end smoke test after Phase 3:
- Create a user in Supabase Auth → Login via frontend
- Select court+time in Calendar (real availability) → Submit booking
- Admin Dashboard → Confirm booking → Verify debt records in pagos
