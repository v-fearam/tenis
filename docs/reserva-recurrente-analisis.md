# Turnos Recurrentes — Diseño de Implementación (v4)

> **Decisión**: Opción A confirmada — módulo nuevo, aislado del flujo de turnos normales.
> **Estado**: Decisiones cerradas. Listo para implementar (pendiente revisión final).

---

## 1. El concepto

Un grupo alquila una cancha de forma recurrente (ej: "martes y jueves 17hs hasta mayo"). No se sabe quién juega cada día. Hay un **socio responsable** (debe ser socio existente en el sistema) que es el contacto y responsable del pago. La deuda es de la recurrencia como unidad, no de jugadores individuales.

**Principio clave**: este módulo es autónomo. Tiene su propia cuenta corriente, sus propios cobros. No toca el flujo de turnos normales (jugadores, abonos, cobranzas por persona). Solo comparte la tabla `turnos` para bloquear las canchas y aparecer en el calendario.

### Modelo de deuda: precio por turno

Cada turno generado tiene su propio `monto_recurrente` (cuánto vale ese día). Hay dos conceptos distintos:

- **Deuda**: turnos pasados no cancelados (ya se usó la cancha → se debe pagar).
- **Comprometido**: turnos futuros no cancelados (van a generar deuda cuando se jueguen, pero aún no la son).

El saldo se calcula en tiempo real:

```
Deuda         = SUM(monto_recurrente) de turnos PASADOS no cancelados
Comprometido  = SUM(monto_recurrente) de turnos FUTUROS no cancelados  (informativo)
Total pagado  = SUM(monto) de movimientos tipo 'pago'/'bonificacion'
Saldo         = Total pagado - Deuda
```

**Ventajas vs. modelo de movimientos cargo/ajuste:**
- Cancelar un día = cancelar el turno. Si era pasado, sale de la deuda. Si era futuro, sale del comprometido. Sin movimientos de ajuste.
- Recalcular precios = UPDATE del `monto_recurrente` en turnos futuros. Sin movimientos de ajuste.
- El saldo siempre es correcto sin reconstruir historial de movimientos.
- Cada turno sabe exactamente cuánto vale, sin ambigüedad.
- La distinción deuda/comprometido da visibilidad real al estado financiero.

---

## 2. Decisiones de diseño

| Tema | Decisión |
|---|---|
| **Modelo de deuda** | Precio vive en cada turno (`monto_recurrente`). **Deuda** = SUM(turnos pasados no cancelados). **Comprometido** = SUM(turnos futuros no cancelados) — informativo, no es deuda aún. Saldo = pagado - deuda. Sin movimientos de cargo/ajuste. |
| **Socio responsable** | Debe ser socio existente del sistema. Búsqueda typeahead como la de jugadores. |
| **Múltiples canchas** | Una recurrencia = una cancha. Si necesitan 2 canchas, se crean 2 recurrencias. |
| **Calendario** | Mismo slot pero con color distinto y mostrando "Recurrente". No muestra nombre del grupo ni detalle. |
| **Duración** | Siempre la estándar (1h30). No se elige duración. |
| **Extender recurrencia** | No se puede extender. Se debe crear una nueva recurrencia. |
| **Cancelar un día** | Se cancela el turno. Si era pasado, su `monto_recurrente` sale de la deuda. Si era futuro, sale del comprometido. No hay monto a editar. |
| **Visibilidad para socios** | La gestión es 100% admin. El socio ve el slot ocupado en el calendario con color distinto y texto "Recurrente" (sin detalle del grupo). No puede interactuar ni ver más info. |
| **Precio sugerido** | `cantidad_turnos × precio_socio_sin_abono × (1 - descuento_recurrente%)`. Admin edita libremente. |
| **Descuento configurable** | Nueva clave en `config_sistema`: `descuento_recurrente` (valor: porcentaje, ej: "20"). Se aplica al precio sugerido. |
| **Recálculo de deuda** | Botón "Recalcular deuda". Actualiza `monto_recurrente` de turnos futuros al precio actual. El comprometido se ajusta. La deuda (pasados) no cambia. |
| **Horario de inicio** | Dropdown cada 30 min (dentro del rango horario de la cancha). No es libre. |
| **Conflictos al crear** | Solo se crean los turnos sin conflicto. Los conflictos se muestran pero no se pueden forzar. |
| **Click en calendario** | No pasa nada. Solo se ve el slot con color distinto y texto "Recurrente". Sin interacción. |
| **Deuda en dashboard** | Se muestra deuda (turnos pasados) y comprometido (futuros) de recurrencias en el dashboard principal. |
| **Paginación** | Paginación en el listado usando `items_per_page` de `config_sistema` (mismo criterio que el resto del sistema). |

---

## 3. Modelo de datos

### Nueva clave en `config_sistema`

```sql
INSERT INTO config_sistema (clave, valor, descripcion)
VALUES ('descuento_recurrente', '20', 'Porcentaje de descuento para turnos recurrentes');
```

### Tabla `turnos_recurrentes` (nueva)

```sql
CREATE TABLE turnos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,                          -- "Grupo de Pablo", "Escuelita martes"
  id_cancha INT NOT NULL REFERENCES canchas(id),
  id_socio_responsable UUID NOT NULL REFERENCES socios(id),  -- contacto / responsable de pago
  dias_semana INT[] NOT NULL,                    -- [2, 4] = martes, jueves (ISO: 1=lun, 7=dom)
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  precio_unitario_original NUMERIC(10,2) NOT NULL, -- monto_total / N al crear (registro histórico, no se usa en cálculos)
  estado VARCHAR(20) DEFAULT 'activa'
    CHECK (estado IN ('activa', 'cancelada')),
  observacion TEXT,
  creado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

> **Nota**: no hay `monto_total` ni `cantidad_turnos` como columnas. Ambos se calculan desde los turnos:
> - `cantidad_turnos` = COUNT de turnos con ese `id_turno_recurrente`
> - `deuda` = SUM(`monto_recurrente`) de turnos **pasados** no cancelados
> - `comprometido` = SUM(`monto_recurrente`) de turnos **futuros** no cancelados (informativo)
> - `precio_unitario_original` se guarda solo como referencia del acuerdo inicial

### Tabla `movimientos_recurrentes` (nueva — solo pagos)

```sql
CREATE TABLE movimientos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno_recurrente UUID NOT NULL REFERENCES turnos_recurrentes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('pago', 'bonificacion')),
  monto NUMERIC(10,2) NOT NULL,                  -- siempre positivo (dinero que ingresó)
  descripcion TEXT,                              -- "Pago efectivo marzo", "Bonificación por lluvia", etc.
  medio VARCHAR(30),                             -- efectivo, transferencia, etc.
  fecha TIMESTAMPTZ DEFAULT now(),
  registrado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> **Simplificación vs. v3**: solo existen `pago` y `bonificacion`. No hay `cargo` ni `ajuste` — la deuda es implícita en los turnos pasados.
> **Saldo** = SUM(movimientos.monto) - SUM(turnos_pasados_no_cancelados.monto_recurrente). Negativo = debe. Cero = al día. Positivo = crédito a favor.

### Cambios en tabla `turnos` (existente)

```sql
ALTER TABLE turnos
  ADD COLUMN id_turno_recurrente UUID REFERENCES turnos_recurrentes(id),
  ADD COLUMN monto_recurrente NUMERIC(10,2);
```

- `id_turno_recurrente`: apunta al grupo. NULL para turnos normales.
- `monto_recurrente`: cuánto vale este día. NULL para turnos normales. Cada turno recurrente tiene su precio.
- No tienen `turno_jugadores`. No pasan por el flujo de confirm/cancel normal.
- Se crean directamente con `estado = 'confirmado'`.
- Duración fija: 1h30 (hora_fin = hora_inicio + 90 min).

### Índices

```sql
CREATE INDEX idx_turnos_recurrente ON turnos(id_turno_recurrente) WHERE id_turno_recurrente IS NOT NULL;
CREATE INDEX idx_movimientos_recurrentes_turno ON movimientos_recurrentes(id_turno_recurrente);
```

---

## 4. Fórmula de saldo

```sql
-- Deuda (turnos pasados no cancelados = ya se jugó, se debe pagar)
SELECT COALESCE(SUM(monto_recurrente), 0)
FROM turnos
WHERE id_turno_recurrente = :id
  AND estado != 'cancelado'
  AND fecha < CURRENT_DATE
-- → deuda

-- Comprometido (turnos futuros no cancelados = informativo, no es deuda aún)
SELECT COALESCE(SUM(monto_recurrente), 0)
FROM turnos
WHERE id_turno_recurrente = :id
  AND estado != 'cancelado'
  AND fecha >= CURRENT_DATE
-- → comprometido

-- Total pagado
SELECT COALESCE(SUM(monto), 0)
FROM movimientos_recurrentes
WHERE id_turno_recurrente = :id
-- → pagado

-- Saldo = pagado - deuda
-- Negativo → debe  |  Cero → al día  |  Positivo → crédito a favor
-- (comprometido se muestra aparte como referencia)
```
```

### Comparación de operaciones (v3 vs v4)

| Operación | v3 (movimientos cargo/ajuste) | v4 (precio por turno) |
|---|---|---|
| **Cancelar un día** | Cancelar turno + crear movimiento ajuste + decidir monto | Cancelar turno. Si era pasado, sale de deuda. Si era futuro, sale de comprometido. Listo. |
| **Recalcular precios** | Contar futuros, calcular diff, crear movimiento ajuste, actualizar recurrencia | UPDATE monto_recurrente en turnos futuros. Comprometido se ajusta. Listo. |
| **Saber el saldo** | SUM de toda la historia de movimientos | SUM(turnos pasados) - SUM(pagos). Directo. |
| **Monto de un turno** | Inferir de precio_unitario (¿original? ¿recalculado?) | Leer `monto_recurrente` del turno. Sin ambigüedad. |

---

## 5. Flujos

### 5.1 Creación de recurrencia

```
1. Admin va a /admin/turnos-recurrentes → "Nueva recurrencia"
2. Completa formulario:
   - Nombre del grupo
   - Socio responsable (búsqueda typeahead de socios existentes)
   - Cancha (dropdown)
   - Días de la semana (checkboxes: Lun, Mar, Mié, Jue, Vie, Sáb, Dom)
   - Horario inicio (dropdown cada 30 min dentro del rango de la cancha)
   - Desde fecha / Hasta fecha
   - Observación (opcional)
3. Click "Verificar disponibilidad"
4. Backend:
   a. Genera lista de fechas concretas (hora_fin = hora_inicio + 1h30)
   b. Chequea contra turnos existentes (no cancelados, misma cancha, overlap de horario)
   c. Chequea contra bloqueos existentes (misma cancha, overlap de horario)
   d. Lee precio_socio_sin_abono y descuento_recurrente de config_sistema
5. Respuesta al frontend:
   - fechas_disponibles: [lista]
   - conflictos: [{fecha, motivo: "turno existente" | "bloqueo"}]
   - precio_sugerido: N × precio_socio_sin_abono × (1 - descuento/100)
   - precio_unitario_base: precio_socio_sin_abono
   - descuento_aplicado: X%
6. Frontend muestra:
   - ✅ "22 turnos disponibles — Precio sugerido: $17.600 (22 × $1.000 - 20%)"
   - ⚠️ Si hay conflictos: "20 de 22 disponibles. Conflictos: Jue 10/4 (turno), Mar 22/4 (bloqueo)"
   - Campo editable "Monto total" (precargado con precio sugerido, admin cambia si quiere)
7. Admin confirma → Backend:
   - precio_unitario = monto_total / N
   - INSERT 1 registro en `turnos_recurrentes` (con precio_unitario_original)
   - INSERT N registros en `turnos` (estado=confirmado, id_turno_recurrente=X,
     monto_recurrente=precio_unitario para cada uno)
   - NO se crea ningún movimiento de cargo (la deuda es implícita en los turnos)
```

### 5.2 Cuenta corriente (pagos)

Desde la vista de detalle de una recurrencia:

```
- Se ve: nombre, cancha, socio responsable, fechas, turnos generados
- Se ve el SALDO calculado: SUM(pagos) - SUM(turnos pasados no cancelados)
- Se ve el COMPROMETIDO: SUM(turnos futuros no cancelados) — informativo
- Se ve la lista de pagos realizados (movimientos)
- Botón "Registrar pago" → modal con:
  - Monto (obligatorio)
  - Medio de pago (efectivo, transferencia, etc.)
  - Descripción (ej: "Pago marzo efectivo")
  → crea movimiento tipo 'pago'
```

Completamente independiente de `pagos.service.ts`. No toca la tabla `pagos` existente.

### 5.3 Cancelar un día particular

```
1. Admin va al detalle de la recurrencia
2. En la lista de turnos, click "Cancelar este día" en un turno futuro
3. Confirmación simple: "¿Cancelar turno del Mar 15/4? ($800 se descontarán del comprometido)"
4. Confirmar →
   - El turno en tabla `turnos` pasa a estado='cancelado'
   - La cancha queda libre para ese día
   - Si era futuro: sale del comprometido. Si era pasado: sale de la deuda.
   - No se crea ningún movimiento. No hay monto a editar.
```

> **Simplicidad**: al cancelar, el `monto_recurrente` del turno sigue existiendo en la DB como registro histórico, pero el cálculo de deuda filtra `estado != 'cancelado'` y `fecha < hoy`, así que se descuenta solo.

### 5.4 Cancelar recurrencia completa

```
1. Admin va al detalle de la recurrencia → "Cancelar recurrencia"
2. Se muestran los turnos futuros (fecha >= hoy, estado != cancelado)
3. Confirmación: "Se cancelarán X turnos. Se descontarán $Y del comprometido."
4. Admin confirma →
   - Todos los turnos futuros pasan a estado='cancelado' en tabla `turnos`
   - La recurrencia pasa a estado='cancelada'
   - Los turnos pasados quedan como estaban (ya se jugaron, son deuda)
   - El saldo se recalcula automáticamente
```

### 5.5 Recalcular deuda (cambio de precio)

Si el precio del turno cambia en `config_sistema`, el admin puede recalcular:

```
1. Admin va al detalle de la recurrencia → botón "Recalcular deuda"
2. Backend calcula:
   - Turnos futuros no cancelados = WHERE fecha >= hoy AND estado != 'cancelado'
   - Precio nuevo = precio_socio_sin_abono actual × (1 - descuento_recurrente/100)
   - Precio actual promedio de esos turnos (por si ya hubo recálculos previos)
3. Frontend muestra preview:
   - "12 turnos pendientes"
   - "Precio actual: $800/turno → Precio nuevo: $960/turno"
   - "Deuda no cambia (solo afecta turnos futuros)"
4. Admin confirma →
   - UPDATE turnos SET monto_recurrente = precio_nuevo
     WHERE id_turno_recurrente = X AND fecha >= hoy AND estado != 'cancelado'
   - El comprometido se recalcula automáticamente (ya refleja los nuevos montos)
   - La deuda (turnos pasados) no cambia
   - No se crean movimientos de ajuste
```

> **Lo elegante**: el recálculo es un simple UPDATE. Los turnos ya jugados mantienen su precio histórico (son deuda firme). Los futuros se actualizan. El comprometido se ajusta solo.

---

## 6. Impacto en el sistema existente

### Lo que NO se toca

| Componente | Por qué no se toca |
|---|---|
| `bookings.service.ts` confirm/cancel/create | Los turnos recurrentes no pasan por este flujo |
| `pagos.service.ts` findUnpaidTurnos | La deuda está en `turnos.monto_recurrente`, no en `turno_jugadores` |
| `pagos.service.ts` registerPayment/gift/payAll | Opera sobre `turno_jugadores`, que no existen para recurrentes |
| Tab Cobranzas en AdminDashboard | Sigue mostrando solo deudas de jugadores individuales |
| Tab Cobrados en AdminDashboard | Sigue mostrando solo turnos normales cobrados |
| Flujo de abonos/créditos | Los recurrentes no consumen abonos |
| Creación de turnos por socios | Sigue igual, no pueden crear recurrentes |

### Lo que SÍ se toca (mínimo)

| Componente | Cambio | Esfuerzo |
|---|---|---|
| **Calendario** (`Calendar.tsx` + `bookings.service.ts findByDateForCalendar`) | Los turnos con `id_turno_recurrente` se renderizan con color distinto y texto "Recurrente". Sin click/interacción. | Bajo |
| **Revenue mensual** (`pagos.service.ts getMonthlyRevenue`) | Sumar también `movimientos_recurrentes` de tipo 'pago' del mes | ~5 líneas |
| **Dashboard principal** (`AdminDashboard.tsx`) | Nuevo indicador: "Deuda recurrencias: $X" (solo turnos pasados) + "Comprometido: $Y" (informativo) | Bajo |
| **Sidebar** (`AdminSidebar.tsx`) | Nuevo link "Turnos Recurrentes" en sección OPERACIONES | 1 línea |
| **Router** (`App.tsx`) | Nueva ruta `/admin/turnos-recurrentes` y `/admin/turnos-recurrentes/:id` | 2 líneas |

### Lo nuevo (módulo aislado)

| Componente | Descripción |
|---|---|
| Migración SQL `008_turnos_recurrentes.sql` | Tablas, columnas en `turnos`, config, índices |
| Backend módulo `turnos-recurrentes/` | Controller, Service, Module, DTOs |
| Frontend `TurnosRecurrentes.tsx` | Listado de recurrencias |
| Frontend `TurnoRecurrenteDetalle.tsx` | Detalle con cuenta corriente + lista de turnos |

---

## 7. API del módulo nuevo

### Endpoints (todos Admin, JWT + RolesGuard)

| Method | Path | Descripción |
|---|---|---|
| POST | `/api/turnos-recurrentes/check-availability` | Chequea disponibilidad, devuelve fechas ok + conflictos + precio sugerido |
| POST | `/api/turnos-recurrentes` | Crea recurrencia + turnos (cada uno con su monto_recurrente) |
| GET | `/api/turnos-recurrentes` | Lista recurrencias con saldo calculado (filtrable por estado, paginado con `items_per_page` de config) |
| GET | `/api/turnos-recurrentes/:id` | Detalle con turnos, pagos y saldo |
| POST | `/api/turnos-recurrentes/:id/pagos` | Registra un pago |
| POST | `/api/turnos-recurrentes/:id/recalcular` | Recalcula monto_recurrente de turnos futuros |
| DELETE | `/api/turnos-recurrentes/:id/turnos/:turnoId` | Cancela un día (el saldo se ajusta automáticamente) |
| DELETE | `/api/turnos-recurrentes/:id` | Cancela recurrencia completa (turnos futuros) |
| GET | `/api/turnos-recurrentes/deuda-total` | Deuda total (turnos pasados) + comprometido (futuros) de todas las recurrencias activas (para dashboard) |

---

## 8. Esquema de pantallas (frontend)

### Listado `/admin/turnos-recurrentes`

```
┌──────────────────────────────────────────────────────────────────┐
│  Turnos Recurrentes                              [+ Nueva]       │
│  [Filtro: Activas ▾]                                             │
│  Deuda total recurrencias: -$17.000  │  Comprometido: $8.000     │
├──────────────────────────────────────────────────────────────────┤
│  Grupo de Pablo   │ Cancha 2 │ Ma/Ju 17:00 │ Pablo García       │
│  5/3→30/5         │ 22 turnos│ $800/turno  │ Saldo: -$5.000 🔴  │
├──────────────────────────────────────────────────────────────────┤
│  Escuelita Pepe   │ Cancha 1 │ Lun/Mié 9:00│ Pepe Rodríguez     │
│  1/3→30/6         │ 34 turnos│ $800/turno  │ Saldo: $0 ✅        │
├──────────────────────────────────────────────────────────────────┤
│  Veteranos        │ Cancha 3 │ Vie 20:00   │ Carlos López        │
│  1/3→30/5         │ 13 turnos│ $800/turno  │ Saldo: -$12.000 🔴 │
├──────────────────────────────────────────────────────────────────┤
│                          ◀ 1 de 1 ▶                             │
└──────────────────────────────────────────────────────────────────┘
```

### Detalle `/admin/turnos-recurrentes/:id`

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Grupo de Pablo              [Recalcular deuda] [Cancelar todo]│
│  Cancha 2 │ Mar y Jue 17:00-18:30 │ 5/3 → 30/5                  │
│  Responsable: Pablo García (Socio #45)                            │
│  Turnos: 22 generados (20 activos, 2 cancelados)                  │
│  Precio unitario original: $800                                   │
├──────────────────────────────────────────────────────────────────┤
│  RESUMEN                                                          │
│  Deuda (turnos jugados):        $12.000  (15 × $800)             │
│  Comprometido (turnos futuros): $4.000   (5 × $800)  ℹ️          │
│  Total pagado:                  $11.000                           │
│  Saldo:                         -$1.000 🔴                       │
├──────────────────────────────────────────────────────────────────┤
│  PAGOS REALIZADOS                                                 │
├──────────┬───────────────┬──────────┬────────────────────────────┤
│  Fecha   │  Tipo         │  Monto   │  Descripción               │
│  5/3     │  🟢 Pago      │  $10.000 │  Adelanto efectivo         │
│  25/4    │  🟢 Pago      │  $1.000  │  Efectivo abril            │
├──────────┴───────────────┴──────────┴────────────────────────────┤
│                                              [Registrar pago]     │
├──────────────────────────────────────────────────────────────────┤
│  TURNOS                                                           │
│  ✅ Mar 5/3   17:00  Cancha 2  $800                               │
│  ✅ Jue 7/3   17:00  Cancha 2  $800                               │
│  ✅ Mar 12/3  17:00  Cancha 2  $800                               │
│  ...                                                              │
│  ❌ Jue 15/4  17:00  Cancha 2  $800 (cancelado)                   │
│  ⏳ Mar 20/5  17:00  Cancha 2  $800       [Cancelar este día]    │
│  ⏳ Jue 22/5  17:00  Cancha 2  $800       [Cancelar este día]    │
└──────────────────────────────────────────────────────────────────┘
```

**Leyenda de turnos:**
- ✅ = jugado (fecha pasada, no cancelado) — su `monto_recurrente` **cuenta como deuda**
- ❌ = cancelado — su `monto_recurrente` NO cuenta para nada
- ⏳ = futuro (pendiente de jugar) — su `monto_recurrente` es **comprometido** (informativo, no es deuda aún)

> **Diferencia con v3**: la sección "CUENTA CORRIENTE" se simplifica a "PAGOS REALIZADOS" (solo pagos y bonificaciones). Ya no hay movimientos de cargo ni ajuste. El saldo se muestra en el resumen, calculado en tiempo real.

---

## 9. Precio sugerido — Fórmula

```
precio_base       = precio_socio_sin_abono  (de config_sistema)
descuento          = descuento_recurrente    (de config_sistema, ej: "20" = 20%)
precio_con_dto    = precio_base × (1 - descuento / 100)
precio_sugerido   = cantidad_turnos × precio_con_dto
```

Ejemplo con 22 turnos, precio $1.000, descuento 20%:
```
precio_con_dto  = $1.000 × 0.80 = $800
precio_sugerido = 22 × $800 = $17.600
```

El admin puede editar el monto total libremente. Cada turno se crea con `monto_recurrente = monto_ingresado / cantidad_turnos`.

---

## 10. Recálculo de deuda — Detalle

Cuando el precio de `precio_socio_sin_abono` o `descuento_recurrente` cambian en `config_sistema`, las recurrencias existentes mantienen sus precios. El admin decide si recalcular:

```sql
-- Paso 1: calcular nuevo precio unitario
precio_nuevo = precio_socio_sin_abono × (1 - descuento_recurrente / 100)

-- Paso 2: preview (sin tocar datos)
SELECT COUNT(*) as turnos_afectados,
       SUM(monto_recurrente) as deuda_actual,
       COUNT(*) * precio_nuevo as deuda_nueva
FROM turnos
WHERE id_turno_recurrente = :id
  AND fecha >= CURRENT_DATE
  AND estado != 'cancelado'

-- Paso 3: si admin confirma, un solo UPDATE
UPDATE turnos
SET monto_recurrente = precio_nuevo
WHERE id_turno_recurrente = :id
  AND fecha >= CURRENT_DATE
  AND estado != 'cancelado'
```

- Los turnos ya jugados mantienen su precio histórico (son deuda firme, no se tocan).
- Los turnos cancelados mantienen su monto como registro (pero no cuentan para nada).
- Los turnos futuros se actualizan → el comprometido cambia.
- El saldo (pagado - deuda) no cambia porque solo toca turnos futuros.
- No se crean movimientos de ajuste.

---

## 11. Impacto en reportes de revenue

`getMonthlyRevenue()` actualmente hace:
```sql
SELECT monto FROM pagos WHERE tipo='pago' AND fecha BETWEEN inicio_mes AND fin_mes
```

Hay que sumar también:
```sql
SELECT monto FROM movimientos_recurrentes WHERE tipo='pago' AND fecha BETWEEN inicio_mes AND fin_mes
```

Esto es un cambio de ~5 líneas en `pagos.service.ts`. El total del dashboard muestra la suma de ambas fuentes.

---

## 12. Lo que NO se rompe

- **Reservas normales**: siguen exactamente igual, flujo con jugadores, abonos, cobranzas por persona
- **Constraint de overlap**: los turnos de la recurrencia son registros en `turnos` con estado `confirmado`, el EXCLUDE constraint sigue protegiendo contra colisiones
- **Bloqueos**: se chequean al crear la recurrencia
- **Auth/roles**: solo admin opera este módulo
- **Abonos**: no se tocan
- **Cobranzas/Cobrados**: no se tocan (los pagos recurrentes viven en el módulo nuevo)
- **Columnas nuevas en `turnos`**: `id_turno_recurrente` y `monto_recurrente` son NULL para turnos normales, no afectan nada existente

---

## 13. Todas las preguntas cerradas

No quedan preguntas abiertas. El documento está listo para implementar.
