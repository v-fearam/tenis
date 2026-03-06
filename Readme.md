# Club Belgrano — Sistema de Reservas de Tenis

Plataforma de gestión de reservas de canchas y membresías para Club Belgrano (General Belgrano, Buenos Aires).

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, TypeScript |
| Frontend | Vite + React 19, TypeScript, React Router v7 |
| Database | Supabase (PostgreSQL + Auth) |
| Deployment | Vercel (both services) |

## Features

### Public / Members

- **Booking calendar** — Visual availability grid per court and time slot, 5 clay courts
- **2-step booking flow** — Select singles/doubles, add players (search socios or enter guests)
- **Cost preview** — Per-player cost calculated before confirming, based on membership tier
- **reCAPTCHA v3** — Bot protection on public booking submissions
- **Member dashboard** — Booking history, debt overview, credit balance, membership status

### Admin

- **Booking management** — Confirm/cancel bookings, register payments, export data
- **Recurring bookings** — Weekly recurring reservations with isolated debt tracking, payment registration, price recalculation, and individual session cancellation
- **User management** — Full CRUD with roles (admin / socio / no-socio), membership assignment, booking history
- **Membership (Abonos)** — Manage subscription types (Abono Libre, Abono x Partidos, Socio Sin Abono), assign to members, monthly close
- **Courts (Canchas)** — Create and manage courts with hours, surface, and lighting
- **Blocks (Bloqueos)** — Block time slots for tournaments, classes, or maintenance
- **Finanzas** — Financial dashboard: stacked bar chart (Recharts) with 3-segment historical revenue (turnos / abonos / recurrentes), 4 stat cards for current month, trend indicator vs last close, composition breakdown
- **Payments** — Register payments/bonifications, view unpaid debts by turno
- **Configuration** — Pricing keys editable at runtime (`precio_no_socio`, `precio_socio_sin_abono`, `precio_socio_abonado`, `descuento_recurrente`)
- **Dashboard** — Summary: pending bookings, monthly revenue, member debt, recurring booking debt

## Pricing Model

| Player type | Cost |
|-------------|------|
| Socio con Abono Libre | $0 |
| Socio con Abono x Partidos (con créditos) | $0 (singles: 1 crédito, dobles: 0.5) |
| Socio sin abono | `precio_socio_sin_abono / N jugadores` |
| No socio / Invitado | `precio_no_socio / N jugadores` |

Cost is calculated at creation, stored per player in `turno_jugadores.monto_generado`. Admin confirms → generates `pagos`. Cancel → refunds abono credits.

**Recurring**: fixed price per occurrence with configurable discount (default 20%).

## Project Structure

```
/
├── backend/          # NestJS — feature modules
│   └── src/
│       ├── auth/                 # Login, JWT guard, roles guard
│       ├── users/                # User CRUD + public socio search
│       ├── bookings/             # Booking flow + pricing engine
│       ├── canchas/              # Court management
│       ├── bloqueos/             # Court blocks
│       ├── abonos/               # Membership subscriptions
│       ├── turnos-recurrentes/   # Weekly recurring bookings
│       ├── pagos/                # Payment registration + revenue
│       ├── config/               # Runtime system config
│       └── supabase/             # Supabase client (global)
├── frontend/         # Vite + React
│   └── src/
│       ├── components/   # Calendar, Sidebar, shared UI
│       ├── pages/        # Route-level pages
│       ├── lib/          # api.ts (Bearer token), Supabase client
│       └── index.css     # Pastel design system (CSS vars)
└── docs/
    └── claude-reference.md   # Full API + DB schema reference
```

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project (URL + service role key)

### Setup

```bash
npm install
```

`backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=3000
FRONTEND_URL=http://localhost:5173
```

`frontend/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000/api
```

```bash
npm run dev:backend    # NestJS on port 3000
npm run dev:frontend   # Vite dev server
```

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Public | Booking calendar |
| `/login` | Public | Login |
| `/dashboard` | Member | Personal dashboard |
| `/admin` | Admin | Booking approval |
| `/admin/users` | Admin | User management |
| `/admin/abonos` | Admin | Membership management |
| `/admin/canchas` | Admin | Court management |
| `/admin/bloqueos` | Admin | Court blocks |
| `/admin/finanzas` | Admin | Financial dashboard (chart + stat cards) |
| `/admin/pagos` | Admin | Payments & debt |
| `/admin/config` | Admin | System configuration |
| `/admin/turnos-recurrentes` | Admin | Recurring bookings |

For full API endpoints and DB schema see [docs/claude-reference.md](docs/claude-reference.md).
