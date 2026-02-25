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
| POST | `/api/bookings` | JWT | Create booking |
| GET | `/api/bookings` | JWT | List bookings |
| PATCH | `/api/bookings/:id/confirm` | Admin | Confirm + generate debt |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking |
| GET | `/api/config` | Public | List system parameters |

## Database Schema

Key tables in `public` schema:
- **`usuarios`**: User profiles (nombre, dni, telefono, email, rol, estado)
- **`socios`**: Membership details linked to `usuarios`
- **`turnos`**: Court reservations (id_cancha, fecha, hora_inicio, hora_fin, tipo_partido, estado)
- **`turno_jugadores`**: Players per booking (id_turno, id_persona, tipo_persona, nombre_invitado)
- **`canchas`**: 5 clay courts (nombre, superficie, activa, hora_apertura, hora_cierre)
- **`parametros_mensuales`**: Pricing and timing configuration
- **`bloqueos`**: Court maintenance/event block periods
- **`abonos`**: Monthly subscription credits
- **`pagos`**: Financial ledger (cargo/pago system)
- **`config_sistema`**: Global string-key configurations

## Documentation

- [Implementation Plan](docs/implementation-plan.md) — Multi-phase roadmap
- [Requirements Analysis](docs/requirements/requirements-club-belgrano.md) — Feature discovery and business rules
