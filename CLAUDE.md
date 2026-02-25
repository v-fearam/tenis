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
│   │   ├── main.ts            # Entry point (port 3000, CORS enabled, /api prefix)
│   │   ├── app.module.ts      # Root module
│   │   ├── auth/              # Authentication & authorization
│   │   │   ├── auth.controller.ts   # POST /login, /register, GET /me
│   │   │   ├── auth.service.ts      # Supabase Auth integration
│   │   │   ├── dto/auth.dto.ts      # LoginDto, RegisterDto
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts  # Bearer token validation via Supabase
│   │   │   │   └── roles.guard.ts     # RBAC based on user.rol
│   │   │   └── decorators/
│   │   │       ├── current-user.decorator.ts  # @CurrentUser() param decorator
│   │   │       └── roles.decorator.ts         # @Roles('admin') metadata
│   │   ├── users/             # User CRUD (admin-only) + public search
│   │   │   ├── users.controller.ts   # UsersPublicController + UsersController
│   │   │   ├── users.service.ts      # CRUD for usuarios + socios tables
│   │   │   └── dto/user.dto.ts       # CreateUserDto, UpdateUserDto, UpdateSocioDto
│   │   ├── bookings/          # Booking feature module
│   │   │   ├── bookings.controller.ts   # REST endpoints
│   │   │   ├── bookings.service.ts      # Business logic & debt engine
│   │   │   └── dto/booking.dto.ts       # DTOs & enums
│   │   └── supabase/          # Supabase client integration
│   ├── vercel.json            # Vercel deployment config
│   └── .env                   # SUPABASE_URL, SUPABASE_KEY, PORT
├── frontend/                  # Vite + React UI
│   ├── src/
│   │   ├── App.tsx            # Root component with routing & AuthProvider
│   │   ├── index.css          # Global pastel design system (CSS vars)
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Auth state management (login/logout, token persistence)
│   │   ├── components/
│   │   │   ├── Calendar.tsx       # Court/time slot selection grid
│   │   │   ├── BookingForm.tsx    # 2-step booking: type selection → player management
│   │   │   └── ProtectedRoute.tsx # Route guard with role-based access
│   │   ├── pages/
│   │   │   ├── Login.tsx          # Login page with club branding
│   │   │   ├── Reserve.tsx        # Public booking dashboard (auth optional)
│   │   │   ├── AdminDashboard.tsx # Admin approval panel (admin-only)
│   │   │   └── AdminUsers.tsx     # Admin user CRUD management (admin-only)
│   │   ├── lib/
│   │   │   ├── supabase.ts    # Supabase client init
│   │   │   └── api.ts         # API client with Bearer token injection
│   │   └── types/
│   │       ├── booking.ts     # MatchType, BookingStatus enums
│   │       └── user.ts        # Usuario, Socio, payload interfaces
│   ├── vercel.json            # SPA rewrite config
│   └── .env                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
├── docs/requirements/         # Requirements analysis
├── .agents/skills/            # AI agent skills (see Skills section)
└── package.json               # NPM workspaces root
```

## Architecture

**Monorepo** using NPM workspaces (`backend/`, `frontend/`).

### Backend (NestJS)

- Feature modules pattern: each feature has its own `module`, `controller`, `service`, and `dto/` folder
- `SupabaseService` is a global injectable that provides the Supabase client via `getClient()`
- **Authentication**: Supabase Auth with JWT validation in `JwtAuthGuard`, role-based access via `RolesGuard` + `@Roles()` decorator
- **User management**: Admin creates users via `auth.admin.createUser()` → trigger auto-creates `usuarios` row → service creates `socios` row if role is socio
- **Booking confirmation flow** (key business logic in `bookings.service.ts`):
  1. Create booking with players → status `pending`
  2. Admin confirms → fetches `monthly_parameters` for pricing, updates status to `confirmed`
  3. For each player: looks up membership type, calculates proportional cost, inserts debt into `payments` table
- Membership tiers affect pricing: Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio

### Frontend (Vite + React + TypeScript)

- **Routing** via React Router v7:
  - `/` → Reserve (public, no auth required)
  - `/login` → Login page
  - `/admin` → AdminDashboard (admin-only, protected)
  - `/admin/users` → AdminUsers CRUD (admin-only, protected)
- **AuthContext**: manages login/logout, stores token in localStorage, injects Bearer token into API client
- **API client** (`lib/api.ts`): centralized fetch wrapper with automatic auth header injection
- Vanilla CSS with a pastel design system defined in `index.css` (CSS variables: `--brand-blue`, `--clay-orange`, etc.)
- `Calendar.tsx`: 5 courts × 9 time slots (08:00–20:00, 90-min intervals), 7-day selector
- `BookingForm.tsx`: 2-step modal — (1) match type selection (single/double), (2) player slots with socio search or guest name entry
- `ProtectedRoute.tsx`: redirects to `/login` if unauthenticated, blocks non-admin from admin routes

### Database (Supabase/PostgreSQL)

Key tables: `usuarios`, `socios`, `bookings`, `booking_players`, `courts`, `court_blocks`, `monthly_parameters`, `payments`, `profiles` (legacy).

- `usuarios`: linked to `auth.users` via FK, stores nombre, dni, telefono, email, rol (admin/socio/no-socio), estado (activo/inactivo)
- `socios`: linked to `usuarios`, stores nro_socio (auto-increment), activo flag
- Trigger `handle_new_user` on `auth.users` auto-creates `usuarios` row with rol from `raw_user_meta_data`
- RLS enabled on all tables with policies for self-access and admin management

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login with email/password |
| POST | `/api/auth/register` | Public | Register new user |
| GET | `/api/auth/me` | JWT | Get current user profile |
| GET | `/api/users/search-socios?q=` | Public | Search active users (minimal fields: id, nombre, email, dni) |
| GET | `/api/users/me` | JWT | Get own user details |
| GET | `/api/users` | Admin | List all users |
| GET | `/api/users/search?q=` | Admin | Search users (full details) |
| GET | `/api/users/:id` | Admin | Get user by ID |
| POST | `/api/users` | Admin | Create user (creates auth + usuarios + socios) |
| PATCH | `/api/users/:id` | Admin | Update user fields |
| PATCH | `/api/users/:id/socio` | Admin | Update socio membership details |
| DELETE | `/api/users/:id` | Admin | Soft-delete (set estado=inactivo) |
| POST | `/api/bookings` | JWT | Create booking |
| GET | `/api/bookings` | JWT | List bookings |
| PATCH | `/api/bookings/:id/confirm` | Admin | Confirm booking + generate debt |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking |

### Environment Variables

- Backend `.env`: `SUPABASE_URL`, `SUPABASE_KEY` (service role key), `PORT`
- Frontend `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (defaults to `http://localhost:3000/api`)

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
