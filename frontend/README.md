# App Tenis – Club Belgrano (Frontend)

Vite + React 19 + TypeScript SPA for the tennis court booking system.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev   # Vite dev server (port 5173)
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Reserve** | `/` | Public booking form with calendar, cost preview |
| **Login** | `/login` | Auth login page |
| **AdminDashboard** | `/admin` | Turno management, confirm/cancel, payments |
| **AdminAbonos** | `/admin/abonos` | Membership types & credit assignment |
| **AdminCanchas** | `/admin/canchas` | Court management |
| **AdminBloqueos** | `/admin/bloqueos` | Court blocks |
| **AdminUsers** | `/admin/users` | User management |
| **AdminFinance** | `/admin/finance` | Financial overview, unpaid debts |
| **AdminConfig** | `/admin/config` | System configuration |

## Key Features

- **Vanilla CSS** design system with CSS variables (pastel theme, dark mode ready)
- **Mobile-first** responsive design
- **Fractional credit display**: Credits shown with one decimal (e.g. "3.5/4.0")
- **Real-time cost preview**: Debounced cost estimation during booking
- **reCAPTCHA v3** for public booking submissions

## Deployment

Deployed to Vercel as SPA with rewrite rules.
