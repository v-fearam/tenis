# Club Belgrano - Tennis Court Management System

A modern management system for **Club Belgrano** (General Belgrano, Buenos Aires) to handle tennis court bookings, membership management, and financial tracking.

## Features

### Court Booking (Public)
- **Interactive Calendar**: 5 clay courts with 90-minute time slots (08:00-20:00), 7-day date selector.
- **2-Step Booking Flow**:
  1. Select match type: Individual (2 players) or Dobles (4 players).
  2. Fill player slots: search registered socios by name/DNI/email, or type a guest name.
- No login required to browse availability and book a court.

### Authentication & User Management
- **Login**: Email/password authentication via Supabase Auth.
- **Role-based access**: Admin, Socio, No Socio roles with route protection.
- **Admin User CRUD**: Create, edit, activate/deactivate users. Search/filter user list. Manage socio membership details (nro_socio, activo).
- **Trigger-based**: Creating a user in Supabase Auth auto-creates the `usuarios` row with role from metadata.

### Admin Panel
- **Booking Approval**: Admin dashboard to confirm or reject pending reservations.
- **User Management**: Full CRUD at `/admin/users` with table view, search, and create/edit modals.
- **Automated Debt**: Confirming a booking generates proportional debt per player based on membership tier.

### Membership Tiers
- Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio — each with different pricing from monthly parameters.

## Tech Stack

- **Monorepo**: NPM Workspaces
- **Frontend**: Vite + React 19 + TypeScript + Vanilla CSS (pastel design system) + Lucide Icons
- **Backend**: NestJS + TypeScript
- **Database**: Supabase (PostgreSQL) with RLS, triggers, and UUID/GiST extensions
- **Auth**: Supabase Auth with JWT validation + custom RBAC guards

## Project Structure

```
tenis/
├── backend/                   # NestJS API (port 3000, /api prefix)
│   └── src/
│       ├── auth/              # Login, register, JWT guard, roles guard
│       ├── users/             # User CRUD (admin) + public socio search
│       ├── bookings/          # Booking CRUD + debt engine
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
   SUPABASE_KEY=your-service-role-key
   PORT=3000
   ```

   `frontend/.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
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
| GET | `/api/users/search-socios?q=` | Public | Search socios (for booking form) |
| GET | `/api/users` | Admin | List all users |
| POST | `/api/users` | Admin | Create user |
| PATCH | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Deactivate user |
| POST | `/api/bookings` | JWT | Create booking |
| GET | `/api/bookings` | JWT | List bookings |
| PATCH | `/api/bookings/:id/confirm` | Admin | Confirm + generate debt |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking |

## Database Schema

Key tables in `public` schema:
- **`usuarios`**: User profiles linked to `auth.users` (nombre, dni, telefono, email, rol, estado)
- **`socios`**: Membership details (nro_socio, activo) linked to usuarios
- **`bookings`**: Court reservations (court_id, start/end time, type, status)
- **`booking_players`**: Players per booking (user_id or guest_name, cost_proportion)
- **`courts`**: 5 clay courts (name, surface, is_active)
- **`monthly_parameters`**: Monthly pricing configuration per membership tier
- **`payments`**: Financial ledger (user_id, amount, booking_id)
- **`court_blocks`**: Court maintenance/block periods

## Documentation

- [Implementation Plan](docs/implementation-plan.md) — 12-phase roadmap
- [Requirements Analysis](docs/requirements/) — Feature discovery and constraints
