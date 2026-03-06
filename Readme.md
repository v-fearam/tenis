# Club Belgrano — Sistema de Gestión de Canchas

Plataforma web para gestión de reservas de canchas, membresías y finanzas de Club Belgrano (Buenos Aires).

**App:** https://cbtenis.vercel.app

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?logo=vercel)

---

## Para socios — Cómo usar la app

### Instalar en el celular

La app se puede usar desde el navegador y también **instalar como una app** (sin pasar por el App Store).

**Android (Chrome):**
1. Abrir https://cbtenis.vercel.app en Chrome
2. Tocar los tres puntitos (⋮) arriba a la derecha
3. Tocar **"Agregar a pantalla de inicio"**
4. Confirmar — aparece el ícono en la pantalla de inicio

**iPhone (Safari):**
1. Abrir https://cbtenis.vercel.app en Safari (no funciona con Chrome en iOS)
2. Tocar el botón de compartir (□↑) en la barra de abajo
3. Tocar **"Agregar a pantalla de inicio"**
4. Confirmar — aparece el ícono en la pantalla de inicio

Una vez instalada, se abre como una app normal.

---

### Qué se puede hacer

**Sin iniciar sesión:**
- Ver el calendario de disponibilidad de las 5 canchas
- Hacer una reserva ingresando nombre, email y teléfono de contacto

**Con sesión (socios):**
- Reservar eligiendo compañeros socios del club
- Ver el costo antes de confirmar
- Ver el historial de turnos y el estado de los pagos
- Ver el saldo de créditos del abono

**Panel de administración (solo PC):**
El usuario administrador tiene acceso a la gestión completa del club: confirmar reservas, registrar pagos, gestionar socios, ver finanzas, etc. Se recomienda usarlo desde una computadora.

---

## Funcionalidades principales

### Para socios
- Calendario de disponibilidad en tiempo real (5 canchas de polvo)
- Reserva de turno: single o doble, con búsqueda de compañeros
- Preview del costo antes de confirmar
- Historial de turnos, pagos y créditos de abono
- PWA instalable desde el celular (sin App Store)

### Para administradores
- Confirmación y cancelación de turnos
- Gestión de socios, roles y membresías
- Sistema de abonos con créditos fraccionarios
- Turnos recurrentes con modelo de deuda propio
- Dashboard financiero con gráfico histórico 12 meses
- Cierre mensual automático
- Bloqueo de canchas por eventos o mantenimiento
- Configuración de precios en runtime

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS 11, TypeScript |
| Frontend | Vite + React 19, TypeScript, React Router v7 |
| Base de datos | Supabase (PostgreSQL 15 + Auth) |
| Seguridad | Supabase JWT, reCAPTCHA v3, class-validator |
| Deploy | Vercel (SPA + Serverless) |

**Monorepo** con NPM workspaces: `backend/` y `frontend/`.

---

## Estructura del proyecto

```
/
├── backend/src/
│   ├── auth/                 # JWT guard, roles guard
│   ├── users/                # CRUD usuarios, búsqueda socios
│   ├── bookings/             # Motor de reservas y precios
│   ├── canchas/              # Gestión de canchas
│   ├── bloqueos/             # Bloqueos de horarios
│   ├── abonos/               # Membresías y cierre mensual
│   ├── turnos-recurrentes/   # Reservas semanales recurrentes
│   ├── pagos/                # Cobros y dashboard financiero
│   ├── config/               # Configuración runtime
│   └── supabase/             # Cliente global (service_role)
│
├── frontend/src/
│   ├── components/           # Calendar, Sidebar, UI compartida
│   ├── pages/                # Páginas por ruta
│   ├── lib/                  # api.ts (Bearer token), Supabase client
│   └── index.css             # Design system pastel (CSS variables)
│
├── db/
│   ├── migrations/           # Migraciones SQL históricas (001–007)
│   └── seeds/                # Datos de prueba
│
└── docs/
    ├── claude-reference.md           # Referencia rápida API + schema
    └── implementacion/
        ├── arquitectura.md           # Arquitectura técnica con diagramas Mermaid
        ├── producto.md               # Descripción de funcionalidades
        ├── onboarding.md             # Guía de implementación para el admin del club
        └── deploy/
            └── install.sql           # Script SQL completo para instalación desde cero
```

---

## Instalación

### Requisitos
- Node.js 18+
- Proyecto en Supabase (URL + service role key)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Inicializar la base de datos

Ejecutar `docs/implementacion/deploy/install.sql` en el SQL Editor de Supabase.
Incluye tablas, índices, RLS, triggers y datos básicos.

### 3. Variables de entorno

`backend/.env`:
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>
RECAPTCHA_SECRET_KEY=<google_recaptcha_v3_secret>
FRONTEND_URL=http://localhost:5173
PORT=3000
```

`frontend/.env`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_RECAPTCHA_SITE_KEY=<google_recaptcha_v3_site_key>
```

### 4. Desarrollo local

```bash
npm run dev:backend    # NestJS en puerto 3000
npm run dev:frontend   # Vite dev server
```

API docs disponibles en `http://localhost:3000/api/docs` (Swagger, solo en desarrollo).

---

## Rutas

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/` | Público | Calendario de reservas |
| `/login` | Público | Inicio de sesión |
| `/dashboard` | Socio | Panel personal |
| `/mi-historial` | Socio | Historial de turnos y pagos |
| `/admin` | Admin | Reservas pendientes |
| `/admin/users` | Admin | Gestión de usuarios |
| `/admin/abonos` | Admin | Membresías |
| `/admin/canchas` | Admin | Canchas |
| `/admin/bloqueos` | Admin | Bloqueos |
| `/admin/finanzas` | Admin | Dashboard financiero |
| `/admin/pagos` | Admin | Pagos y deudas |
| `/admin/config` | Admin | Configuración del sistema |
| `/admin/turnos-recurrentes` | Admin | Reservas recurrentes |

---

## Comandos útiles

```bash
npm run dev:backend                    # Backend en modo watch
npm run dev:frontend                   # Frontend Vite
npm run build --workspace=backend      # Build TypeScript
npm run build --workspace=frontend     # Build Vite
npm run test                           # Jest (backend)
npm run lint --workspace=backend       # ESLint + Prettier
```

---

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [docs/implementacion/arquitectura.md](docs/implementacion/arquitectura.md) | Arquitectura técnica completa con diagramas |
| [docs/implementacion/producto.md](docs/implementacion/producto.md) | Descripción de funcionalidades |
| [docs/implementacion/onboarding.md](docs/implementacion/onboarding.md) | Guía para el administrador del club |
| [docs/implementacion/deploy/install.sql](docs/implementacion/deploy/install.sql) | Script SQL de instalación completa |
| [docs/claude-reference.md](docs/claude-reference.md) | Referencia rápida de API y schema |
