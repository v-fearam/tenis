# Claude Quick Reference

Quick-lookup file to avoid re-reading controllers and querying DB schema each session.

## API Endpoints (all prefixed with `/api`)

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login with email/password |
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/refresh` | Public | Refresh JWT token |
| GET | `/auth/me` | JWT | Get current user profile |

### Users (`/api/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/search-socios?q=` | Public | Search active socios (minimal fields) |
| GET | `/users/me` | JWT | Get own user details |
| GET | `/users/me/dashboard` | JWT | Get user dashboard data |
| GET | `/users/me/history?page=&pageSize=&fecha_desde=&fecha_hasta=` | JWT | Own turn history + deuda_total (paginated, defaults to last 2 months) |
| GET | `/users/me/history/:turnoId/detail?turnoJugadorId=` | JWT | Detail for a specific turn (co-players + payment info) |
| GET | `/users/count` | Admin | Get user count |
| GET | `/users/search?q=` | Admin | Search users (full details, paginated) |
| GET | `/users` | Admin | List all users (paginated) |
| GET | `/users/:id/history?page=&pageSize=&fecha_desde=&fecha_hasta=` | Admin | Turn history + deuda_total for any user |
| GET | `/users/:id/history/:turnoId/detail?turnoJugadorId=` | Admin | Turn detail for any user |
| GET | `/users/:id` | Admin | Get user by ID |
| POST | `/users` | Admin | Create user (auth + usuarios + socios) |
| PATCH | `/users/:id` | Admin | Update user fields |
| PATCH | `/users/:id/socio` | Admin | Update socio membership |
| DELETE | `/users/:id` | Admin | Soft-delete (estado=inactivo) |

#### History response shape
```typescript
// GET /users/me/history (or /users/:id/history)
{
  deuda_total: number;           // global debt (no date filter)
  turnos: {
    data: HistoryItem[];
    meta: PaginationMeta;
  };
}
interface HistoryItem {
  turno_jugador_id: string;
  turno_id: string;
  fecha: string;                 // YYYY-MM-DD
  hora_inicio: string;
  hora_fin: string;
  cancha_nombre: string;
  tipo_partido: string;          // single | double
  monto_generado: number;
  estado_pago: string;           // pendiente | pagado | bonificado
  uso_abono: boolean;
}

// GET /users/me/history/:turnoId/detail?turnoJugadorId=
{
  jugadores: { nombre: string; tipo_persona: string }[];
  pago_info: { fecha: string; medio: string | null; observacion: string | null } | null;
}
```

### Bookings (`/api/bookings`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bookings/preview` | Public | Preview booking cost (accepts `match_type`) |
| POST | `/bookings` | OptionalJWT | Create booking (+ reCAPTCHA) |
| GET | `/bookings` | Public | List bookings (filterable by status, fechas) |
| GET | `/bookings/calendar?fecha=` | Public | Get bookings for calendar view |
| GET | `/bookings/courts` | Public | List courts for booking |
| GET | `/bookings/active` | Admin | List active bookings (paginated) |
| PATCH | `/bookings/:id/confirm` | Admin | Confirm booking → generate pagos |
| PATCH | `/bookings/:id/cancel` | Admin | Cancel booking → refund créditos |
| DELETE | `/bookings/purge?mes=&anio=` | Admin | Purge bookings by month |

### Canchas (`/api/canchas`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/canchas` | Public | List all courts |
| POST | `/canchas` | Admin | Create court |
| PATCH | `/canchas/:id` | Admin | Update court |
| DELETE | `/canchas/:id` | Admin | Delete court |

### Bloqueos (`/api/bloqueos`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bloqueos` | Public | List blocks (filterable by fecha, fecha_desde, fecha_hasta) |
| POST | `/bloqueos` | Admin | Create court block |
| DELETE | `/bloqueos/purge?mes=&anio=` | Admin | Purge blocks by month |
| DELETE | `/bloqueos/:id` | Admin | Delete block |

### Abonos (`/api/abonos`) — All Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/abonos/types` | List membership types |
| POST | `/abonos/types` | Create membership type |
| PATCH | `/abonos/types/:id` | Update membership type |
| DELETE | `/abonos/types/:id` | Delete membership type |
| GET | `/abonos/stats` | Get membership statistics |
| POST | `/abonos/cierre-mensual` | Execute monthly close |
| POST | `/abonos/assign` | Assign membership to socio |
| DELETE | `/abonos/assign/:socioId` | Remove membership from socio |

### Pagos (`/api/pagos`) — All Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/pagos/historical-revenue` | Last 12 monthly closes from `cierres_mensuales` (for chart) |
| GET | `/pagos/current-month-summary` | Current month: cobrado turnos/abonos/recurrentes + deuda pendiente + tendencia |
| GET | `/pagos/monthly-revenue` | Combined current-month revenue (turnos + recurrentes) — used by dashboard StatCard |
| GET | `/pagos/unpaid?page=&pageSize=&fecha_desde=&fecha_hasta=` | List unpaid turnos (paginated, filterable by date) |
| POST | `/pagos/pay` | Register payment |
| POST | `/pagos/gift` | Gift/bonify payment |
| POST | `/pagos/pay-all` | Pay all debts for a turno |

#### Response shapes
```typescript
// GET /pagos/historical-revenue
Array<{
  mes: string;              // "2025-12-01" (YYYY-MM-DD, first of month)
  ingreso_turnos: number;
  ingreso_abonos: number;
  ingreso_recurrentes: number;
  cantidad_socios_con_abono: number;
  total: number;
}>

// GET /pagos/current-month-summary
{
  cobrado_turnos: number;       // SUM pagos.tipo='pago' this month
  cobrado_abonos: number;       // SUM tipos_abono.precio for socios with abono now
  cobrado_recurrentes: number;  // SUM movimientos_recurrentes.tipo='pago' this month
  deuda_pendiente: number;      // Unpaid turno_jugadores + deuda recurrentes global
  total_cobrado: number;        // cobrado_turnos + cobrado_abonos + cobrado_recurrentes
  tendencia_pct: number;        // % change vs last cierre total (0 if no cierres)
}
```

### Turnos Recurrentes (`/api/turnos-recurrentes`) — All Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/turnos-recurrentes/check-availability` | Check slot availability + compute suggested price |
| GET | `/turnos-recurrentes/deuda-total` | Total debt + committed across all active recurrencias (dashboard) |
| GET | `/turnos-recurrentes?page=&pageSize=&estado=` | List recurrencias with saldo calculated |
| POST | `/turnos-recurrentes` | Create recurrencia + batch-insert turnos |
| GET | `/turnos-recurrentes/:id` | Detail: recurrencia + turnos + movimientos + saldo |
| POST | `/turnos-recurrentes/:id/pagos` | Register a payment or bonification |
| GET | `/turnos-recurrentes/:id/recalcular` | Preview price recalculation for future turnos |
| POST | `/turnos-recurrentes/:id/recalcular` | Confirm price recalculation (update monto_recurrente) |
| DELETE | `/turnos-recurrentes/:id/turnos/:turnoId` | Cancel a single day turno |
| DELETE | `/turnos-recurrentes/:id` | Cancel all: marks future turnos cancelled + recurrencia cancelled |

#### Key DTOs
```typescript
// POST /check-availability
{ id_cancha: number; dias_semana: number[]; hora_inicio: string; fecha_desde: string; fecha_hasta: string; }
// Response: { fechas_disponibles: string[]; conflictos: {...}[]; precio_sugerido: number }

// POST / (create)
{ nombre: string; id_usuario_responsable: string; id_cancha: number; dias_semana: number[];
  hora_inicio: string; fecha_desde: string; fecha_hasta: string; monto_total: number; observacion?: string }
// Note: id_usuario_responsable is usuarios.id — service resolves to socios.id

// POST /:id/pagos
{ monto: number; tipo: 'pago' | 'bonificacion'; descripcion?: string; medio?: string }
```

#### Debt model
- `deuda` = SUM(`monto_recurrente`) of past non-cancelled turnos
- `comprometido` = SUM(`monto_recurrente`) of future non-cancelled turnos
- `pagado` = SUM(`monto`) of movimientos where tipo='pago'
- `saldo` = pagado − deuda (positive = in favor, negative = owes)

### Config (`/api/config`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/config` | Public | List all config params |
| GET | `/config/:clave` | Public | Get config by key |
| PATCH | `/config/:clave` | Admin | Update config param |

---

## Database Schema

### usuarios (12 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, FK → auth.users |
| nombre | text | nullable |
| dni | text | nullable |
| telefono | text | nullable |
| email | text | unique |
| rol | enum | admin, socio, no-socio (default: no-socio) |
| estado | enum | activo, inactivo (default: activo) |
| created_at | timestamptz | |
| updated_at | timestamptz | nullable |

### socios (12 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_usuario | uuid | FK → usuarios, unique |
| nro_socio | int | auto-increment, unique |
| activo | bool | default: true |
| id_tipo_abono | uuid | FK → tipos_abono, nullable |
| creditos_disponibles | numeric(5,1) | default: 0, supports fractional values (e.g. 3.5) |

### canchas (5 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | int | PK, serial |
| nombre | varchar | |
| superficie | varchar | default: polvo |
| activa | bool | default: true |
| hora_apertura | time | default: 08:00 |
| hora_cierre | time | default: 22:30 |
| tiene_luz | bool | default: false |

### turnos_recurrentes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| nombre | text | |
| id_cancha | int | FK → canchas |
| id_socio_responsable | uuid | FK → socios |
| dias_semana | int[] | ISO days: 1=Mon … 7=Sun |
| hora_inicio | time | |
| hora_fin | time | |
| fecha_desde | date | |
| fecha_hasta | date | |
| precio_unitario_original | numeric(10,2) | price at creation time |
| observacion | text | nullable |
| estado | varchar | check: activa, cancelada |
| creado_por | uuid | FK → usuarios, nullable |
| created_at | timestamptz | |

### movimientos_recurrentes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_turno_recurrente | uuid | FK → turnos_recurrentes |
| tipo | varchar | check: pago, bonificacion |
| monto | numeric(10,2) | |
| descripcion | text | nullable |
| medio | varchar | nullable |
| registrado_por | uuid | FK → usuarios, nullable |
| created_at | timestamptz | |

### turnos
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_cancha | int | FK → canchas |
| fecha | date | |
| hora_inicio | time | |
| hora_fin | time | |
| tipo_partido | varchar | check: single, double — NOT NULL |
| estado | varchar | check: pendiente, confirmado, cancelado |
| creado_por | uuid | FK → usuarios, nullable |
| confirmado_por | uuid | FK → usuarios, nullable |
| motivo_cancelacion | text | nullable |
| nombre_organizador | varchar | nullable (non-auth bookings) |
| email_organizador | varchar | nullable |
| telefono_organizador | varchar | nullable |
| costo | numeric | default: 0 |
| id_turno_recurrente | uuid | FK → turnos_recurrentes, nullable |
| monto_recurrente | numeric(10,2) | per-occurrence price for recurrentes, nullable |

### turno_jugadores (94 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_turno | uuid | FK → turnos |
| id_persona | uuid | FK → usuarios, nullable |
| tipo_persona | varchar | check: socio, no_socio, invitado |
| nombre_invitado | varchar | nullable |
| monto_generado | numeric | default: 0 |
| estado_pago | varchar | check: pendiente, pagado, bonificado |
| uso_abono | bool | default: false |

### pagos (7 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_turno_jugador | uuid | FK → turno_jugadores, nullable |
| id_socio | uuid | FK → socios, nullable |
| monto | numeric | |
| tipo | varchar | check: cargo, pago, bonificacion, devolucion |
| fecha | timestamptz | |
| medio | varchar | nullable |
| observacion | text | nullable |

### tipos_abono (3 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| nombre | text | unique |
| creditos | numeric(5,1) | supports fractional values |
| precio | numeric | |
| color | text | nullable |

### config_sistema (8 rows, RLS enabled)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| clave | text | unique |
| valor | text | |
| descripcion | text | nullable |

### bloqueos (19 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_cancha | int | FK → canchas |
| tipo | varchar | check: torneo, clase, mantenimiento, otro |
| fecha | date | |
| hora_inicio | time | |
| hora_fin | time | |
| descripcion | text | nullable |
| creado_por | uuid | FK → usuarios, nullable |

### cierres_mensuales (4 rows, RLS enabled)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mes_anio | date | unique |
| ingreso_abonos | numeric | Pre-pago: SUM precio of assigned abonos |
| ingreso_turnos | numeric | **Plata cobrada** (tipo='pago'), not cargos |
| ingreso_recurrentes | numeric | SUM movimientos_recurrentes.tipo='pago' (default 0) |
| cantidad_socios_con_abono | int | |
| detalle_abonos | jsonb | nullable |
| ejecutado_por | uuid | FK → usuarios, nullable |

> **Criterio cierre**: `ingreso_turnos` = plata **efectivamente cobrada** (pagos), no facturada (cargos). Corrección aplicada en `ejecutarCierreMensual()` — cambio de `tipo='cargo'` a `tipo='pago'`.

---

### Key FK Relationships
```
auth.users ←── usuarios.id
usuarios ←── socios.id_usuario
usuarios ←── turnos.creado_por, confirmado_por
usuarios ←── turno_jugadores.id_persona
usuarios ←── bloqueos.creado_por
usuarios ←── cierres_mensuales.ejecutado_por
usuarios ←── turnos_recurrentes.creado_por
usuarios ←── movimientos_recurrentes.registrado_por
canchas ←── turnos.id_cancha
canchas ←── bloqueos.id_cancha
canchas ←── turnos_recurrentes.id_cancha
turnos ←── turno_jugadores.id_turno
turnos ←── turnos_recurrentes.id (via turnos.id_turno_recurrente)
turno_jugadores ←── pagos.id_turno_jugador
socios ←── pagos.id_socio
socios ←── turnos_recurrentes.id_socio_responsable
tipos_abono ←── socios.id_tipo_abono
turnos_recurrentes ←── movimientos_recurrentes.id_turno_recurrente
```

### config_sistema keys
| Key | Description |
|-----|-------------|
| `precio_no_socio` | Per-player price for non-members |
| `precio_socio_sin_abono` | Per-player price for members without abono |
| `precio_socio_abonado` | Per-player price for members with abono |
| `descuento_recurrente` | Discount % for recurring bookings (default: 20) |
