# App Tenis – Club Belgrano (Backend)

NestJS 11 API for the tennis court booking and membership management system.

## Setup

```bash
npm install
```

## Development

```bash
npm run start:dev   # Watch mode on port 3000
```

## Modules

| Module | Description |
|--------|-------------|
| **Auth** | Supabase JWT auth, login, register, refresh |
| **Users** | User CRUD, search, dashboard, socio management |
| **Bookings** | Court reservations, pricing, calendar, preview |
| **Canchas** | Court CRUD, schedules (apertura/cierre) |
| **Bloqueos** | Court blocks (torneos, clases, mantenimiento) |
| **Abonos** | Membership types, credit assignment, monthly close |
| **Pagos** | Payment tracking, debt management, revenue |
| **Config** | System-wide configuration parameters |
| **Supabase** | Global Supabase client provider |

## Key Business Logic

- **Pricing**: Proportional cost split per player. Three tiers: No Socio, Socio sin Abono, Abono (credits).
- **Fractional Credits**: Singles consume 1 credit, doubles consume 0.5 credits per player. `creditos_disponibles` is `numeric(5,1)`.
- **Confirmation Flow**: Booking created → admin confirms → debt records (`pagos`) generated.
- **Cancellation**: Refunds abono credits proportionally by match type.

## Deployment

Deployed to Vercel. All routes go through the NestJS serverless entry point.
