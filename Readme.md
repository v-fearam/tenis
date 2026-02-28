# Club Belgrano - Tennis Court Management System

A modern management system for **Club Belgrano** (General Belgrano, Buenos Aires) to handle tennis court bookings, membership management, and financial tracking.

## Features

### Court Booking (Public)
- **Interactive Calendar**: 5 clay courts with dynamic scheduling, 7-day date selector. Displays "Sin Luz" for slots without illumination.
- **2-Step Booking Flow**:
  1. Select match type: Single or Dobles.
  2. Fill player slots: search registered socios or type guest names.
- **CORS Support**: Secure cross-origin communication enabled between frontend and backend.
- **System Config**: Dynamic loading of slot duration, opening hours, and court-specific schedules.

### Authentication & User Management
- **Login**: Email/password authentication via Supabase Auth.
- **Role-based access**: Admin, Socio, No Socio roles with route protection.
- **Admin User CRUD**: Create, edit, activate/deactivate users. Manage socio membership details.
- **Trigger-based**: Creating a user in Supabase Auth auto-creates the `usuarios` row.

### Admin Panel
- **Booking Approval**: Admin dashboard to confirm or reject pending reservations.
- **User Management**: Full CRUD at `/admin/users`.
- **Court Blocking**: Manage maintenance periods, tournaments, or classes per court via the `/api/bloqueos` endpoint.
- **Automated Debt**: Confirming a booking generates proportional debt per player.

### Membership Tiers
- Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio — each with different pricing.

### Booking Cost Calculation (Business Logic)

The cost of a booking is calculated **at creation time** and stored in the `turnos.costo` column. The pricing logic works as follows:

**Pricing source:** All prices are read from the `config_sistema` table:
- `precio_no_socio` — rate for non-members and guests
- `precio_socio_sin_abono` — rate for members without a subscription
- `precio_socio_abonado` — rate for members with "Abono x Partidos" (if they run out of credits)

**Per-player cost:** Each player pays a proportional share: `base_tariff / total_players_in_match`

**Player classification and tariffs:**
| Player Type | Tariff | Notes |
|-------------|--------|-------|
| Socio con Abono Libre | $0 | Unlimited free play |
| Socio con Abono x Partidos (with credits) | $0 | 1 credit consumed immediately |
| Socio sin abono | `precio_socio_sin_abono / N` | Proportional share |
| No socio / Invitado | `precio_no_socio / N` | Proportional share |

**Lifecycle:**
1. **Creation** → Cost calculated, abono credits consumed, stored in `turno_jugadores.monto_generado` and `turno_jugadores.uso_abono`
2. **Confirmation** (admin) → `pagos` (debt records) generated from pre-calculated `monto_generado` values
3. **Cancellation** (admin) → Abono credits refunded to players who had `uso_abono = true`

**Cost Preview:** Users can preview the estimated cost before submitting via `POST /api/bookings/preview`.

## Latest Updates (Feb 2026)

### Security & Bot Protection
- **Google reCAPTCHA v3 Implementation**: All public booking requests and sensitive actions are now protected by reCAPTCHA v3 with score verification (min: 0.5) to prevent automated booking attempts.
- **Optional Auth Support**: Guests can now submit reservations with contact details even without an account, protected by reCAPTCHA.

### UI/UX Refactor (Mobile-First)
- **Compact Dashboard**: Authenticated users now see a clean one-line summary of their next match, account balance, and current membership status.
- **Responsive Header**: Redesigned header and navigation for better mobile experience, including an "Admin" quick-access button for staff.
- **Improved Booking Flow**: Streamlined the multi-step booking modal to be more intuitive on small screens.

### Backend Infrastructure
- **Modular Services**: Reorganized common logic into reusable services like `RecaptchaService`.
- **Enhanced DTOs**: Improved validation for booking players and contact information.

## Tech Stack

- **Monorepo**: NPM Workspaces
- **Frontend**: Vite + React 19 + TypeScript + Vanilla CSS (pastel design system) + Lucide Icons
- **Backend**: NestJS + TypeScript
- **Database**: Supabase (PostgreSQL) with RLS, triggers, and JSONB/GiST extensions
- **Auth**: Supabase Auth with JWT validation + custom RBAC guards

## Project Structure

```
tenis/
├── backend/                   # NestJS API (port 3000, /api prefix)
│   └── src/
│       ├── auth/              # Login, register, JWT guard, roles guard
│       ├── users/             # User CRUD (admin) + public socio search
│       ├── bookings/          # Booking CRUD + debt engine
│       ├── bloqueos/          # Court blocking (tournaments, maintenance)
│       ├── canchas/           # Court availability management
│       ├── config/            # System-wide configuration (timing, slots)
│       ├── common/            # Shared utilities (reCAPTCHA verification, error filters)
│       └── supabase/          # Supabase client service
├── frontend/                  # Vite + React UI
│   └── src/
│       ├── context/           # AuthContext (login/logout, token mgmt)
│       ├── components/        # Calendar, BookingForm, ProtectedRoute
│       ├── pages/             # Login, Reserve, AdminDashboard, AdminUsers
│       ├── lib/               # API client, Supabase client
│       └── types/             # TypeScript interfaces
├── docs/                      # Requirements & implementation plan
└── package.json               # Workspaces root
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase project with service role key

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:

   `backend/.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key  # Used for admin tasks, bypasses RLS
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   ```

   `frontend/.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key  # Public key, respects RLS
   VITE_API_URL=http://localhost:3000/api
   ```

3. **Run development servers**:
   ```bash
   npm run dev:backend          # NestJS on port 3000
   npm run dev:frontend         # Vite dev server
   ```

4. **Build for production**:
   ```bash
   npm run build --workspace=backend
   npm run build --workspace=frontend
   ```

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Public | Court booking calendar and dashboard |
| `/login` | Public | Login page |
| `/admin` | Admin only | Booking approval dashboard |
| `/admin/users` | Admin only | User management CRUD |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/register` | Public | Register |
| GET | `/api/auth/me` | JWT | Current user profile |
| GET | `/api/users/search-socios?q=` | Public | Search socios |
| GET | `/api/users` | Admin | List all users |
| POST | `/api/users` | Admin | Create user |
| PATCH | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Deactivate user |
| GET | `/api/canchas` | Public | List courts and schedules |
| GET | `/api/bloqueos?fecha=` | Public | List blocks for a specific date |
| POST | `/api/bookings` | JWT | Create booking (cost calculated, credits consumed) |
| POST | `/api/bookings/preview` | JWT | Preview booking cost estimate |
| GET | `/api/bookings` | JWT | List bookings |
| PATCH | `/api/bookings/:id/confirm` | Admin | Confirm + generate debt from pre-calculated costs |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking + refund abono credits |
| GET | `/api/config` | Public | List system parameters |

## Database Schema

Key tables in `public` schema:
- **`usuarios`**: User profiles (nombre, dni, telefono, email, rol, estado)
- **`socios`**: Membership details linked to `usuarios`
- **`turnos`**: Court reservations (id_cancha, fecha, hora_inicio, hora_fin, tipo_partido, estado, costo)
- **`turno_jugadores`**: Players per booking (id_turno, id_persona, tipo_persona, nombre_invitado, uso_abono, monto_generado)
- **`canchas`**: 5 clay courts (nombre, superficie, activa, hora_apertura, hora_cierre)
- **`bloqueos`**: Court maintenance/event block periods
- **`abonos`**: Monthly subscription credits
- **`pagos`**: Financial ledger (cargo/pago system)
- **`config_sistema`**: Global configuration (pricing, schedules, etc.)

## Documentation

- [Implementation Plan](docs/implementation-plan.md) — Multi-phase roadmap
- [Requirements Analysis](docs/requirements/requirements-club-belgrano.md) — Feature discovery and business rules
