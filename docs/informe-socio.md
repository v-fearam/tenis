# Informe: Pantalla de Historial del Socio

## Resumen

Agregar una pantalla accesible para usuarios logueados (socios y no-socios) donde puedan consultar su historial de turnos jugados, estado de pago, y deuda total acumulada. La pantalla debe ser mobile-first (es la interfaz principal desde el teléfono — la vista admin está oculta en mobile) y con carga eficiente bajo demanda.

Adicionalmente, el admin podrá ver el historial de cualquier usuario desde el CRUD de socios (`AdminUsers`).

---

## Estado Actual

- **No existe** una vista dedicada para el socio. Hoy el socio solo ve la página de reserva (`Reserve.tsx`) con un pequeño header mostrando próximo partido, créditos de abono y estado `ok_club`.
- Los datos de pagos y turnos existen en las tablas `turno_jugadores`, `turnos`, `pagos`, pero solo son consultados desde endpoints admin (`GET /pagos/unpaid`).
- El endpoint `GET /users/me/dashboard` devuelve datos mínimos: próximo partido + info de abono.

---

## Diseño Funcional

### Acceso
- Botón visible en el dashboard del usuario logueado (header de `Reserve.tsx`) → navega a `/mi-historial`.
- Ruta protegida: requiere JWT (rol `socio`, `no-socio`, o `admin`).
- Desde admin: botón en el CRUD de usuarios (`AdminUsers.tsx`) para ver historial de un usuario específico → navega a `/admin/usuarios/:id/historial` (misma pantalla reutilizada con `userId` por param).

### Resumen de Deuda (parte superior, siempre visible)
- **Deuda total**: suma de `turno_jugadores.monto_generado` donde `estado_pago = 'pendiente'` y `monto_generado > 0` y `turnos.estado = 'confirmado'` para el usuario. **Sin límite de fecha** — la deuda es global independiente del filtro del historial.
- Se muestra en una card destacada (sticky en mobile para que siempre sea visible al scrollear).
- Formato: `Deuda pendiente: $X.XXX` (o `Sin deuda pendiente` con estilo verde si es $0).
- **Indicador sutil en Reserve.tsx**: si el usuario tiene deuda > 0, mostrar un pequeño texto/badge discreto en el header del dashboard (ej: `Deuda: $4.500` en color muted) con link a `/mi-historial`. Sin ser intrusivo.

### Listado de Turnos (cuerpo principal)
- Entrada por `turno_jugadores` del usuario logueado.
- **Filtro por defecto**: últimos 2 meses desde hoy.
- **Filtro configurable**: selector de rango de fechas (fecha desde / fecha hasta).
- Solo muestra turnos **confirmados** (excluye pendientes y cancelados).
- Ordenamiento: fecha descendente (más reciente primero).

#### Vista compacta (por defecto) — una fila/card por turno:
| Campo | Origen |
|-------|--------|
| Fecha | `turnos.fecha` |
| Hora | `turnos.hora_inicio` - `turnos.hora_fin` |
| Cancha | `canchas.nombre` |
| Tipo | `turnos.tipo_partido` (single/double) |
| Mi costo | `turno_jugadores.monto_generado` |
| Estado pago | `turno_jugadores.estado_pago` (pendiente/pagado/bonificado) |

Indicador visual de estado: 🔴 Pendiente / 🟢 Pagado / 🔵 Bonificado (chips de color).

#### Vista detalle (bajo demanda, al tocar/clickear un turno):
Se expande mostrando:
- **Otros jugadores** del turno: nombre + tipo (socio/no_socio/invitado).
- Si usó abono: `turno_jugadores.uso_abono`.
- Datos de pago (si pagado): fecha de pago, medio, observación (de tabla `pagos`).

### Paginación
- Paginación server-side (20 items por página).
- Componente `PaginationControls` existente reutilizable.

---

## Diseño Técnico

### Backend

#### Endpoint 1: `GET /api/users/me/history`

**Controller**: `users.controller.ts`  
**Guard**: `JwtAuthGuard` (requiere login, cualquier rol)  
**Query params**:

```typescript
class HistoryQueryDto extends PaginationDto {
  @IsOptional() @IsDateString()
  fecha_desde?: string;   // default: hoy - 2 meses

  @IsOptional() @IsDateString()  
  fecha_hasta?: string;   // default: hoy
}
```

**Response** (resumida):

```typescript
{
  deuda_total: number;           // sum de monto_generado pendientes
  turnos: {
    data: HistoryItem[];
    meta: PaginationMeta;
  };
}

interface HistoryItem {
  turno_jugador_id: string;      // turno_jugadores.id
  turno_id: string;              // turnos.id
  fecha: string;                 // turnos.fecha
  hora_inicio: string;           // turnos.hora_inicio  
  hora_fin: string;              // turnos.hora_fin
  cancha_nombre: string;         // canchas.nombre
  tipo_partido: string;          // turnos.tipo_partido
  monto_generado: number;        // turno_jugadores.monto_generado
  estado_pago: string;           // turno_jugadores.estado_pago
  uso_abono: boolean;            // turno_jugadores.uso_abono
}
```

**Query SQL principal** (lo que ejecuta Supabase client):

```sql
-- 1. Deuda total (query separada, sin paginación)
SELECT COALESCE(SUM(tj.monto_generado), 0) as deuda_total
FROM turno_jugadores tj
  JOIN turnos t ON tj.id_turno = t.id
WHERE tj.id_persona = :userId
  AND tj.estado_pago = 'pendiente'
  AND tj.monto_generado > 0
  AND t.estado = 'confirmado';

-- 2. Historial paginado
SELECT tj.id as turno_jugador_id, tj.monto_generado, tj.estado_pago, tj.uso_abono,
       t.id as turno_id, t.fecha, t.hora_inicio, t.hora_fin, t.tipo_partido,
       c.nombre as cancha_nombre
FROM turno_jugadores tj
  JOIN turnos t ON tj.id_turno = t.id
  JOIN canchas c ON t.id_cancha = c.id  
WHERE tj.id_persona = :userId
  AND t.estado = 'confirmado'
  AND t.fecha >= :fechaDesde
  AND t.fecha <= :fechaHasta
ORDER BY t.fecha DESC, t.hora_inicio DESC
LIMIT :pageSize OFFSET :offset;
```

**Traducción a Supabase JS client**:

```typescript
// Deuda total
const { data: debtData } = await client
  .from('turno_jugadores')
  .select('monto_generado, turnos!inner(estado)')
  .eq('id_persona', userId)
  .eq('estado_pago', 'pendiente')
  .gt('monto_generado', 0)
  .eq('turnos.estado', 'confirmado');

const deuda_total = debtData?.reduce((sum, d) => sum + Number(d.monto_generado), 0) ?? 0;

// Historial paginado
const { data, count } = await client
  .from('turno_jugadores')
  .select(`
    id, monto_generado, estado_pago, uso_abono,
    turnos!inner(id, fecha, hora_inicio, hora_fin, tipo_partido,
      canchas(nombre)
    )
  `, { count: 'exact' })
  .eq('id_persona', userId)
  .eq('turnos.estado', 'confirmado')
  .gte('turnos.fecha', fechaDesde)
  .lte('turnos.fecha', fechaHasta)
  .order('fecha', { referencedTable: 'turnos', ascending: false })
  .order('hora_inicio', { referencedTable: 'turnos', ascending: false })
  .range(offset, offset + pageSize - 1);
```

#### Endpoint 2: `GET /api/users/me/history/:turnoId/detail`

**Propósito**: Carga bajo demanda los detalles de un turno específico.

**Response**:

```typescript
{
  jugadores: {
    nombre: string;         // usuarios.nombre o turno_jugadores.nombre_invitado
    tipo_persona: string;   // socio / no_socio / invitado
  }[];
  pago_info?: {             // solo si el jugador actual pagó
    fecha: string;
    medio: string | null;
    observacion: string | null;
  };
}
```

**Query**: Fetch `turno_jugadores` del turno con join a `usuarios`, más `pagos` del jugador actual.

```typescript
// Co-jugadores
const { data: players } = await client
  .from('turno_jugadores')
  .select('tipo_persona, nombre_invitado, usuarios(nombre)')
  .eq('id_turno', turnoId)
  .neq('id_persona', userId);  // excluir al usuario actual

// Info de pago del usuario (si existe)
const { data: pagos } = await client
  .from('pagos')
  .select('fecha, medio, observacion')
  .eq('id_turno_jugador', turnoJugadorId)
  .eq('tipo', 'pago')
  .order('fecha', { ascending: false })
  .limit(1);
```

#### Endpoint 3: `GET /api/users/:id/history` (Admin)

**Controller**: `users.controller.ts`  
**Guard**: `JwtAuthGuard` + `RolesGuard` (solo `admin`)  
**Reutiliza** la misma lógica de `getHistory()` pero recibe `userId` del param `:id` en vez del token.

#### Endpoint 4: `GET /api/users/:id/history/:turnoId/detail` (Admin)

**Guard**: `JwtAuthGuard` + `RolesGuard` (solo `admin`)  
**Reutiliza** `getHistoryDetail()` con `userId` del param.

> **Nota de implementación**: Los métodos del service reciben `userId` como parámetro. Los endpoints `/me/` extraen el userId del JWT; los endpoints `/:id/` lo toman del param. Misma lógica interna.

---

### Análisis de Performance

#### Volumetría estimada
- ~12 usuarios activos, ~94 turno_jugadores actuales.
- Proyección a 1 año: ~500-1000 turno_jugadores.
- Filtro de 2 meses: ~80-150 registros por socio activo.
- **Conclusión**: volumetría baja. No se esperan problemas de performance a corto/mediano plazo.

#### Índices existentes relevantes
| Índice | Columnas | Utilidad |
|--------|----------|---------|
| `idx_turno_jugadores_persona` | `turno_jugadores(id_persona)` | ✅ Cubre el WHERE principal |
| `idx_turnos_estado_fecha` | `turnos(estado, fecha DESC, hora_inicio DESC)` | ✅ Cubre filtro + orden |
| PK en `turnos`, `canchas` | id | ✅ JOIN eficiente |

#### ¿Se necesitan nuevos índices?
**No por ahora**. Los índices existentes cubren bien la consulta:
1. `idx_turno_jugadores_persona` filtra rápido por usuario.
2. El join con `turnos` usa PK.
3. `idx_turnos_estado_fecha` ayuda si Supabase resuelve el `!inner` como subquery.

**Índice opcional a futuro** (si la tabla crece a >5000 rows):
```sql
CREATE INDEX idx_tj_persona_pago ON turno_jugadores(id_persona, estado_pago) 
  WHERE estado_pago = 'pendiente' AND monto_generado > 0;
```
Esto optimizaría la query de deuda total. Evaluarlo solo si se detecta degradación.

#### Optimizaciones implementadas
1. **Deuda total en la misma request** que el historial (evita un round-trip extra).
2. **Detalle bajo demanda**: los co-jugadores y datos de pago solo se cargan al expandir.
3. **Paginación server-side**: máximo 20 registros por request.
4. **Filtro de fechas**: limita el rango de datos escaneados.

---

### Frontend

#### Nuevas rutas
```
/mi-historial                    → <ProtectedRoute> → <SocioHistorial />           (userId del JWT)
/admin/usuarios/:id/historial    → <ProtectedRoute requiredRole="admin"> → <SocioHistorial />  (userId del param)
```

#### Componente: `SocioHistorial.tsx` (nueva página)

**Estructura mobile-first**:

```
┌──────────────────────────────┐
│  ← Volver                   │  ← Header con botón atrás
├──────────────────────────────┤
│  💰 Deuda pendiente         │  ← Card sticky
│     $4.500                  │
├──────────────────────────────┤
│  📅 Desde [01/01/2026]      │  ← Filtros compactos
│  📅 Hasta [05/03/2026]      │
├──────────────────────────────┤
│ ┌────────────────────────┐  │
│ │ 04/03 18:00 Cancha 1   │  │  ← Cards de turno
│ │ Double    $2.250  🟢   │  │
│ └────────────────────────┘  │
│ ┌────────────────────────┐  │
│ │ 28/02 20:00 Cancha 3   │  │
│ │ Single    $4.500  🔴   │  │
│ │ ┌──────────────────┐   │  │  ← Detalle expandido
│ │ │ Con: Juan, Pedro │   │  │
│ │ │ Bonificado: No   │   │  │
│ │ └──────────────────┘   │  │
│ └────────────────────────┘  │
│        < 1  2  3 >          │  ← Paginación
└──────────────────────────────┘
```

**Consideraciones mobile**:
- Cards en vez de tabla (mejor en pantallas < 640px).
- Filtros de fecha colapsables o en una fila compacta.
- Touch targets mínimo 44px.
- Chip de estado con color y borde (sin depender solo del color para accesibilidad).
- Skeleton loading mientras carga.
- Sticky header de deuda (no se pierde al scrollear).

#### Botón de acceso desde Reserve.tsx
- Agregar en la sección de dashboard del usuario (junto al próximo partido y créditos).
- Botón secundario: `"Ver mi historial"` → navega a `/mi-historial`.
- Visible para cualquier usuario logueado (socio o no-socio).
- **Indicador de deuda sutil**: si hay deuda pendiente, mostrar monto en texto muted debajo del botón o integrado al dashboard header. No pop-up, no banner llamativo — solo información pasiva.

#### Acceso desde Admin (CRUD de usuarios)
- En `AdminUsers.tsx`, agregar botón/enlace "Ver historial" en la fila o detalle de cada usuario.
- Navega a `/admin/usuarios/:id/historial`.
- Reutiliza el mismo componente `SocioHistorial.tsx` pero recibiendo `userId` como prop/param en vez de usar el usuario logueado.

#### Nuevo archivo de tipos
Ampliar `frontend/src/types/` con interface `HistoryItem` y `HistoryDetail`.

---

## Plan de Implementación

### Fase 1 — Backend

| # | Tarea | Archivo(s) | Impacto |
|---|-------|-----------|---------|
| 1 | Crear `HistoryQueryDto` | `backend/src/users/dto/history-query.dto.ts` | Nuevo archivo |
| 2 | Agregar método `getHistory(userId)` en service | `backend/src/users/users.service.ts` | Agregar ~60 líneas |
| 3 | Agregar método `getHistoryDetail(userId, turnoId)` en service | `backend/src/users/users.service.ts` | Agregar ~30 líneas |
| 4 | Agregar 4 endpoints (2 `/me/`, 2 `/:id/` admin) en controller | `backend/src/users/users.controller.ts` | Agregar ~35 líneas |
| 5 | Verificar RLS permite lectura desde el token del usuario | N/A (test manual) | Sin cambio de código |

### Fase 2 — Frontend

| # | Tarea | Archivo(s) | Impacto |
|---|-------|-----------|---------|
| 6 | Crear tipos `HistoryItem`, `HistoryDetail` | `frontend/src/types/history.ts` | Nuevo archivo |
| 7 | Crear página `SocioHistorial.tsx` (acepta `userId` opcional) | `frontend/src/pages/SocioHistorial.tsx` | Nuevo archivo (~250 líneas) |
| 8 | Agregar rutas `/mi-historial` + `/admin/usuarios/:id/historial` | `frontend/src/App.tsx` | Modificar ~5 líneas |
| 9 | Agregar botón "Ver mi historial" + indicador deuda sutil | `frontend/src/pages/Reserve.tsx` | Modificar ~10 líneas |
| 10 | Agregar botón "Ver historial" en CRUD de usuarios | `frontend/src/pages/AdminUsers.tsx` | Modificar ~5 líneas |
| 11 | Estilos mobile-first | `frontend/src/index.css` | Agregar ~60 líneas CSS |

### Fase 3 — Testing y ajustes

| # | Tarea | Descripción |
|---|-------|-------------|
| 12 | Test manual con socio real | Verificar datos correctos, paginación, filtros |
| 13 | Test en mobile real (prioridad) | Verificar layout responsive, scroll, tap targets — es la interfaz principal |
| 14 | Test vista admin de historial | Verificar acceso desde CRUD de usuarios |
| 15 | Verificar performance de query | Revisar `EXPLAIN ANALYZE` en Supabase dashboard |

---

## Análisis de Impacto

### Archivos nuevos (3)
- `backend/src/users/dto/history-query.dto.ts`
- `frontend/src/types/history.ts`
- `frontend/src/pages/SocioHistorial.tsx`

### Archivos modificados (5)
- `backend/src/users/users.service.ts` — 2 métodos nuevos
- `backend/src/users/users.controller.ts` — 4 endpoints nuevos (2 `/me/`, 2 `/:id/` admin)
- `frontend/src/App.tsx` — 2 rutas nuevas
- `frontend/src/pages/Reserve.tsx` — botón historial + indicador deuda sutil
- `frontend/src/pages/AdminUsers.tsx` — botón "Ver historial" por usuario

### Riesgo
- **Bajo**: No modifica lógica existente. Solo agrega endpoints de lectura y una nueva pantalla.
- **RLS**: Hay que verificar que las policies de `turno_jugadores` permitan al socio leer sus propios registros. Actualmente los endpoints usan `service_role` key en backend, por lo que RLS no es bloqueante (el backend bypasea RLS).
- **Sin migraciones**: No requiere cambios en la base de datos.

### Decisiones de diseño tomadas
1. **Un solo endpoint `/me/history`** que devuelve deuda + historial (ahorra un round-trip).
2. **Detalle como segundo endpoint** (bajo demanda) para mantener la respuesta principal liviana.
3. **Solo turnos confirmados**: excluye pendientes y cancelados del historial.
4. **Ubicación en users module** (no en pagos/bookings): la perspectiva es "mi información como usuario", no gestión de pagos.
5. **Deuda total sin límite de fecha** — es global, independiente del filtro del historial.
6. **Acceso para todos los logueados** (socio + no-socio) — ambos pueden tener turno_jugadores.
7. **Indicador de deuda sutil** en Reserve.tsx — información pasiva, no intrusiva.
8. **Admin puede ver historial** de cualquier usuario desde el CRUD — reutiliza el mismo componente con endpoints `/:id/history`.
9. **Componente reutilizable** — `SocioHistorial.tsx` acepta `userId` opcional; si no lo recibe, usa el del JWT.

---

## Decisiones Validadas

| Pregunta | Decisión |
|----------|----------|
| ¿Mostrar turnos cancelados? | **No** — solo confirmados |
| ¿Deuda sin límite de fecha? | **Sí** — deuda total global, historial filtrado por rango |
| ¿No-socio accede? | **Sí** — cualquier usuario logueado |
| ¿Notificación de deuda? | **Sí, muy sutil** — texto muted en Reserve.tsx, no intrusivo |
| ¿Admin ve historial de otro? | **Sí** — desde CRUD de usuarios en AdminUsers.tsx |
