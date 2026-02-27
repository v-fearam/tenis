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
│   │   ├── app.module.ts      # Root module (imports all feature modules)
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
│   │   │   ├── users.controller.ts   # REST endpoints for user management
│   │   │   ├── users.service.ts      # CRUD for usuarios + socios tables
│   │   │   └── dto/                  # CreateUserDto, UpdateUserDto, UpdateSocioDto
│   │   ├── bookings/          # Booking feature module
│   │   │   ├── bookings.controller.ts   # REST endpoints
│   │   │   ├── bookings.service.ts      # Business logic & debt engine
│   │   │   └── dto/                     # DTOs & enums
│   │   ├── canchas/           # Court management (admin-only)
│   │   │   ├── canchas.controller.ts    # GET (public), POST/PATCH/DELETE (admin)
│   │   │   ├── canchas.service.ts       # CRUD for courts table
│   │   │   └── dto/                     # CreateCanchaDto, UpdateCanchaDto
│   │   ├── bloqueos/          # Court blocks/closures (admin-only)
│   │   │   ├── bloqueos.controller.ts   # CRUD endpoints
│   │   │   ├── bloqueos.service.ts      # Court block scheduling logic
│   │   │   └── dto/                     # CreateBloqueoDto, UpdateBloqueoDto
│   │   ├── abonos/            # Membership subscriptions (admin-only)
│   │   │   ├── abonos.controller.ts     # CRUD endpoints
│   │   │   ├── abonos.service.ts        # Membership plan management
│   │   │   └── dto/                     # DTOs for abonos
│   │   ├── config/            # System configuration (monthly_parameters)
│   │   │   ├── config.controller.ts     # GET (public), PATCH (admin)
│   │   │   ├── config.service.ts        # Key-value config management
│   │   │   └── dto/                     # UpdateConfigDto
│   │   ├── common/            # Shared utilities
│   │   │   └── filters/               # Exception filters
│   │   └── supabase/          # Supabase client integration
│   │       ├── supabase.module.ts     # Global module
│   │       └── supabase.service.ts    # Provides getClient()
│   ├── vercel.json            # Vercel deployment config
│   └── .env                   # SUPABASE_URL, SUPABASE_KEY, PORT, FRONTEND_URL
├── frontend/                  # Vite + React UI
│   ├── src/
│   │   ├── App.tsx            # Root component with routing & AuthProvider
│   │   ├── index.css          # Global pastel design system (CSS vars)
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Auth state management (login/logout, token persistence)
│   │   ├── components/
│   │   │   ├── Calendar.tsx       # Court/time slot selection grid
│   │   │   ├── BookingForm.tsx    # 2-step booking: type selection → player management
│   │   │   ├── ProtectedRoute.tsx # Route guard with role-based access
│   │   │   ├── AdminLayout.tsx    # Admin layout wrapper with persistent sidebar
│   │   │   ├── AdminSidebar.tsx   # Admin navigation sidebar
│   │   │   └── Toast.tsx          # Notification toast component
│   │   ├── pages/
│   │   │   ├── Login.tsx          # Login page with club branding
│   │   │   ├── Reserve.tsx        # Public booking dashboard (auth optional)
│   │   │   ├── AdminDashboard.tsx # Admin booking approval panel
│   │   │   ├── AdminUsers.tsx     # User CRUD management (admin-only)
│   │   │   ├── AdminCanchas.tsx   # Court management (admin-only)
│   │   │   ├── AdminBloqueos.tsx  # Court blocks management (admin-only)
│   │   │   ├── AdminAbonos.tsx    # Membership plans management (admin-only)
│   │   │   ├── AdminFinance.tsx   # Financial reports (admin-only)
│   │   │   └── AdminConfig.tsx    # System configuration (admin-only)
│   │   ├── lib/
│   │   │   ├── supabase.ts    # Supabase client init
│   │   │   └── api.ts         # API client with Bearer token injection
│   │   └── types/
│   │       ├── booking.ts     # MatchType, BookingStatus enums
│   │       ├── user.ts        # Usuario, Socio, payload interfaces
│   │       └── cancha.ts      # Court type definitions
│   ├── vercel.json            # SPA rewrite config
│   └── .env                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
├── docs/                      # Setup guides (recaptcha-setup.md)
├── .agents/skills/            # AI agent skills (see Skills section)
└── package.json               # NPM workspaces root
```

## Architecture

**Monorepo** using NPM workspaces (`backend/`, `frontend/`).

### Backend (NestJS)

- **Architecture**: Feature modules pattern — each feature has its own `module`, `controller`, `service`, and `dto/` folder
- **Modules**: Auth, Users, Bookings, Canchas, Bloqueos, Abonos, Config, Supabase (global)
- **Key Dependencies**:
  - `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` (v11)
  - `@nestjs/config` (environment variables)
  - `@nestjs/jwt` (JWT utilities)
  - `@supabase/supabase-js` (v2.97)
  - `class-validator`, `class-transformer` (DTO validation)
  - `axios` (HTTP client for reCAPTCHA verification)
- **Supabase Integration**: `SupabaseService` is a global injectable that provides the Supabase client via `getClient()`
- **Bot Protection**: `RecaptchaService` in `common/` verifies Google reCAPTCHA v3 tokens with configurable score threshold (min: 0.5)
- **Authentication**: Supabase Auth with JWT validation in `JwtAuthGuard`, role-based access via `RolesGuard` + `@Roles()` decorator
- **User management**: Admin creates users via `auth.admin.createUser()` → trigger auto-creates `usuarios` row → service creates `socios` row if role is socio
- **Booking confirmation flow** (key business logic in `bookings.service.ts`):
  1. Create booking with players → status `pending`
  2. Admin confirms → fetches `monthly_parameters` for pricing, updates status to `confirmed`
  3. For each player: looks up membership type, calculates proportional cost, inserts debt into `payments` table
- **Membership tiers** affect pricing: Abono Libre, Abono x Partidos, Socio Sin Abono, No Socio

### Frontend (Vite + React + TypeScript)

- **Stack**: Vite 7 + React 19 + TypeScript 5.9 + React Router 7
- **Key Dependencies**:
  - `react` & `react-dom` (v19.2)
  - `react-router-dom` (v7.13)
  - `@supabase/supabase-js` (v2.97)
  - `react-hook-form` (v7.71) — form state management
  - `lucide-react` (v0.575) & `react-icons` (v5.5) — icon libraries
- **Routing** via React Router v7:
  - `/` → Reserve (public, no auth required)
  - `/login` → Login page
  - `/admin/*` → AdminLayout wrapper with persistent sidebar (admin-only, protected)
    - `/admin` → AdminDashboard (booking approvals)
    - `/admin/users` → AdminUsers (user CRUD)
    - `/admin/canchas` → AdminCanchas (court management)
    - `/admin/bloqueos` → AdminBloqueos (court blocks)
    - `/admin/abonos` → AdminAbonos (membership plans)
    - `/admin/finanzas` → AdminFinance (financial reports)
    - `/admin/config` → AdminConfig (system parameters)
- **AuthContext**: manages login/logout, stores token in localStorage, injects Bearer token into API client
- **API client** (`lib/api.ts`): centralized fetch wrapper with automatic auth header injection
- **Styling**: Vanilla CSS with a pastel design system defined in `index.css` (CSS variables: `--brand-blue`, `--clay-orange`, etc.)
- **Key Components**:
  - `Calendar.tsx`: Court/time slot selection grid with 7-day selector
  - `BookingForm.tsx`: 2-step modal — (1) match type selection (single/double), (2) player slots with socio search or guest name entry
  - `AdminLayout.tsx`: Nested route wrapper providing persistent sidebar navigation for all admin pages
  - `AdminSidebar.tsx`: Navigation sidebar with links to all admin sections
  - `Toast.tsx`: Notification system for user feedback
  - `ProtectedRoute.tsx`: redirects to `/login` if unauthenticated, blocks non-admin from admin routes

### Database (Supabase/PostgreSQL)

Key tables: `usuarios`, `socios`, `bookings`, `booking_players`, `courts`, `court_blocks`, `monthly_parameters`, `payments`, `profiles` (legacy).

- `usuarios`: linked to `auth.users` via FK, stores nombre, dni, telefono, email, rol (admin/socio/no-socio), estado (activo/inactivo)
- `socios`: linked to `usuarios`, stores nro_socio (auto-increment), activo flag
- Trigger `handle_new_user` on `auth.users` auto-creates `usuarios` row with rol from `raw_user_meta_data`
- RLS enabled on all tables with policies for self-access and admin management

### API Endpoints

#### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login with email/password |
| POST | `/api/auth/register` | Public | Register new user |
| GET | `/api/auth/me` | JWT | Get current user profile |

#### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/search-socios?q=` | Public | Search active users (minimal fields: id, nombre, email, dni) |
| GET | `/api/users/me` | JWT | Get own user details |
| GET | `/api/users` | Admin | List all users |
| GET | `/api/users/search?q=` | Admin | Search users (full details) |
| GET | `/api/users/:id` | Admin | Get user by ID |
| POST | `/api/users` | Admin | Create user (creates auth + usuarios + socios) |
| PATCH | `/api/users/:id` | Admin | Update user fields |
| PATCH | `/api/users/:id/socio` | Admin | Update socio membership details |
| DELETE | `/api/users/:id` | Admin | Soft-delete (set estado=inactivo) |

#### Bookings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/bookings` | JWT | Create booking |
| GET | `/api/bookings` | JWT | List bookings |
| PATCH | `/api/bookings/:id/confirm` | Admin | Confirm booking + generate debt |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking |

#### Courts (Canchas)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/canchas` | Public | List all courts |
| POST | `/api/canchas` | Admin | Create new court |
| PATCH | `/api/canchas/:id` | Admin | Update court details |
| DELETE | `/api/canchas/:id` | Admin | Delete court |

#### Court Blocks (Bloqueos)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bloqueos` | Public | List all court blocks |
| POST | `/api/bloqueos` | Admin | Create court block/closure |
| PATCH | `/api/bloqueos/:id` | Admin | Update block details |
| DELETE | `/api/bloqueos/:id` | Admin | Delete block |

#### Memberships (Abonos)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/abonos` | Admin | List all membership plans |
| POST | `/api/abonos` | Admin | Create membership plan |
| PATCH | `/api/abonos/:id` | Admin | Update membership plan |
| DELETE | `/api/abonos/:id` | Admin | Delete membership plan |

#### System Configuration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | Public | List all config parameters |
| GET | `/api/config/:clave` | Public | Get config by key |
| PATCH | `/api/config/:clave` | Admin | Update config parameter |

### Environment Variables

- **Backend** `.env`:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_KEY`: Service role key (secret, admin privileges)
  - `PORT`: Server port (default: 3000)
  - `FRONTEND_URL`: Frontend origin for CORS (default: `http://localhost:5173`)
  - `RECAPTCHA_SECRET_KEY`: Google reCAPTCHA v3 secret key for bot protection (see `docs/recaptcha-setup.md`)

- **Frontend** `.env`:
  - `VITE_SUPABASE_URL`: Supabase project URL
  - `VITE_SUPABASE_ANON_KEY`: Public anon key for client-side auth
  - `VITE_API_URL`: Backend API base URL (default: `http://localhost:3000/api`)
  - `VITE_RECAPTCHA_SITE_KEY`: Google reCAPTCHA v3 site key for bot protection (see `docs/recaptcha-setup.md`)

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
