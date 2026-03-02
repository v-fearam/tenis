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
| GET | `/users/count` | Admin | Get user count |
| GET | `/users/search?q=` | Admin | Search users (full details, paginated) |
| GET | `/users` | Admin | List all users (paginated) |
| GET | `/users/:id` | Admin | Get user by ID |
| POST | `/users` | Admin | Create user (auth + usuarios + socios) |
| PATCH | `/users/:id` | Admin | Update user fields |
| PATCH | `/users/:id/socio` | Admin | Update socio membership |
| DELETE | `/users/:id` | Admin | Soft-delete (estado=inactivo) |

### Bookings (`/api/bookings`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bookings/preview` | Public | Preview booking cost |
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
| GET | `/pagos/monthly-revenue` | Get monthly revenue |
| GET | `/pagos/unpaid` | List unpaid turnos (paginated) |
| POST | `/pagos/pay` | Register payment |
| POST | `/pagos/gift` | Gift/bonify payment |
| POST | `/pagos/pay-all` | Pay all debts for a turno |

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
| creditos_disponibles | int | default: 0 |

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

### turnos (44 rows)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| id_cancha | int | FK → canchas |
| fecha | date | |
| hora_inicio | time | |
| hora_fin | time | |
| tipo_partido | varchar | check: single, double |
| estado | varchar | check: pendiente, confirmado, cancelado |
| creado_por | uuid | FK → usuarios, nullable |
| confirmado_por | uuid | FK → usuarios, nullable |
| motivo_cancelacion | text | nullable |
| nombre_organizador | varchar | nullable (non-auth bookings) |
| email_organizador | varchar | nullable |
| telefono_organizador | varchar | nullable |
| costo | numeric | default: 0 |

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
| creditos | int | |
| precio | numeric | |
| color | text | nullable |

### config_sistema (7 rows, RLS enabled)
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

### cierres_mensuales (1 row, RLS enabled)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mes_anio | date | unique |
| ingreso_abonos | numeric | |
| ingreso_turnos | numeric | |
| cantidad_socios_con_abono | int | |
| detalle_abonos | jsonb | nullable |
| ejecutado_por | uuid | FK → usuarios, nullable |

---

### Key FK Relationships
```
auth.users ←── usuarios.id
usuarios ←── socios.id_usuario
usuarios ←── turnos.creado_por, confirmado_por
usuarios ←── turno_jugadores.id_persona
usuarios ←── bloqueos.creado_por
usuarios ←── cierres_mensuales.ejecutado_por
canchas ←── turnos.id_cancha
canchas ←── bloqueos.id_cancha
turnos ←── turno_jugadores.id_turno
turno_jugadores ←── pagos.id_turno_jugador
socios ←── pagos.id_socio
tipos_abono ←── socios.id_tipo_abono
```
