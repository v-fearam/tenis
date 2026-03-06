# Análisis: Reformulación de la página Finanzas (v2)

**Fecha:** 2026-03-05
**Estado:** Todas las decisiones cerradas. Listo para implementar.
**Prerrequisito:** Se asume que `reserva-recurrente-analisis.md` se implementa primero.

---

## Decisiones cerradas

| Pregunta | Decisión |
|----------|----------|
| Librería de gráficos | **Recharts** |
| Datos seed | Script separado: `db/seeds/seed_cierres.sql` |
| ¿Destruir AdminFinance actual? | **Sí**, se reemplaza completamente |
| Métricas extra | Solo las de bajo costo. Descartadas las caras en performance |
| Abonos como ingreso | Pre-pago → se considera **cobrado** al asignarse |
| Criterio de cierre | Plata **efectivamente cobrada** (pagos), no facturada (cargos) |
| Segmentos del gráfico | **3 segmentos**: Turnos / Abonos / Recurrentes (más detalle) |
| Tarjeta deuda pendiente | **Sí**, incluir |
| Seeds con recurrentes | **Sí**, con montos de recurrentes incluidos |
| Cierre viejo con criterio incorrecto | **Dejarlo** como está (1 solo registro, pragmático) |

---

## 1. Bug crítico: inconsistencia en el cierre mensual

### El problema

`ejecutarCierreMensual()` calcula `ingreso_turnos` como suma de `pagos` con `tipo='cargo'`. Esto es **lo facturado/generado como deuda**, no lo cobrado. Pero el concepto correcto para un reporte financiero es: **¿cuánta plata entró efectivamente?**

La decisión es: **el cierre mensual solo contabiliza plata cobrada**. Lo no cobrado queda pendiente para el mes que se cobre.

### Cambio necesario en `ejecutarCierreMensual()`

**Antes (incorrecto):**
```typescript
// Suma cargos generados en el mes → facturado, no cobrado
const { data: cargos } = await client
  .from('pagos')
  .select('monto')
  .eq('tipo', 'cargo')
  .gte('fecha', mesAnio)
  .lt('fecha', nextMesAnio);
```

**Después (correcto):**
```typescript
// Suma pagos efectivos del mes → lo realmente cobrado
const { data: pagos } = await client
  .from('pagos')
  .select('monto')
  .eq('tipo', 'pago')
  .gte('fecha', mesAnio)
  .lt('fecha', nextMesAnio);
```

### Sobre la columna `pagos.fecha`

La tabla `pagos` ya tiene `fecha TIMESTAMPTZ DEFAULT now()`. Ningún insert la setea explícitamente — siempre usa el default `now()`. Esto es correcto:

- Para `tipo='cargo'`: `fecha` = momento en que se confirmó el turno (se genera la deuda)
- Para `tipo='pago'`: `fecha` = momento en que se registró el cobro
- Para `tipo='bonificacion'`: `fecha` = momento en que se bonificó

**No hay que agregar columna nueva.** La `fecha` ya existe y ya registra cuándo ocurrió cada operación. El fix es solo **cambiar el filtro del cierre** de `tipo='cargo'` a `tipo='pago'`.

### Impacto en datos existentes

Si ya se ejecutaron cierres previos con el criterio viejo (cargos), esos registros en `cierres_mensuales` tienen `ingreso_turnos` inflado (deuda generada, no cobrada). Hay solo 1 row en la base. Si se quiere corregir, se puede recalcular manualmente o simplemente aceptar que ese mes tiene datos con criterio viejo.

---

## 2. Ingresos de recurrentes en el cierre mensual

Con la implementación de turnos recurrentes (`reserva-recurrente-analisis.md`), hay una nueva fuente de ingresos que también debe entrar en el cierre mensual.

### Modelo de datos de recurrentes

Los pagos de recurrentes viven en una **tabla separada**: `movimientos_recurrentes` (no en `pagos`). Solo tiene tipos `pago` y `bonificacion` — no hay cargos porque la deuda es implícita en los turnos.

### Cambio necesario en `cierres_mensuales`

Agregar una nueva columna para capturar ingresos de recurrentes:

```sql
ALTER TABLE cierres_mensuales
  ADD COLUMN ingreso_recurrentes NUMERIC(10,2) DEFAULT 0;
```

El cierre mensual debe sumar:
```typescript
// Pagos de recurrentes en el mes
const { data: pagosRecurrentes } = await client
  .from('movimientos_recurrentes')
  .select('monto')
  .eq('tipo', 'pago')
  .gte('fecha', mesAnio)
  .lt('fecha', nextMesAnio);
```

### Impacto en el gráfico

El gráfico de barras apiladas pasa a tener **3 segmentos**:
- Color A: Turnos (cobros efectivos de `pagos`)
- Color B: Abonos (pre-pago al asignar)
- Color C: Recurrentes (cobros de `movimientos_recurrentes`)

---

## 3. Propuesta de UI

### 3.1. Gráfico de barras apiladas — Ingresos históricos

- **Fuente:** tabla `cierres_mensuales` (últimos 12 meses)
- **Barras apiladas** con 3 colores:
  - `ingreso_turnos` — cobros de turnos normales
  - `ingreso_abonos` — abonos (pre-pago)
  - `ingreso_recurrentes` — cobros de recurrentes
- **Eje X:** mes/año (ej: "Feb 2026")
- **Nota:** "Se muestran meses con cierre ejecutado. El mes corriente no aparece."

**Endpoint:** `GET /pagos/historical-revenue`

### 3.2. Tarjetas del mes actual

| Tarjeta | Contenido | Fuente |
|---------|-----------|--------|
| **Cobrado en Turnos** | SUM `pagos.monto` donde `tipo='pago'` del mes actual | `pagos` |
| **Cobrado en Abonos** | SUM `tipos_abono.precio` de socios con abono asignado actualmente | `socios` JOIN `tipos_abono` |
| **Cobrado en Recurrentes** | SUM `movimientos_recurrentes.monto` donde `tipo='pago'` del mes actual | `movimientos_recurrentes` |
| **Deuda pendiente** | SUM saldos pendientes turnos normales + deuda recurrentes | `turno_jugadores` + `turnos` + `movimientos_recurrentes` |

### 3.3. Métricas extra (bajo costo)

| Métrica | Cálculo | Costo |
|---------|---------|-------|
| **% ingresos abonos vs turnos vs recurrentes** | Frontend, de los datos del gráfico | Zero |
| **Tendencia mes a mes** | Flecha ↑↓ comparando mes actual vs último cierre | Zero (frontend) |
| **Socios con abono (evolución)** | Ya viene en `cierres_mensuales.cantidad_socios_con_abono` — línea superpuesta al gráfico | Zero |
| **Deuda pendiente total** | SUM de saldos pendientes en `turno_jugadores` + deuda de recurrentes | Medio |
| **Ticket promedio por turno** | `ingreso_turnos / COUNT(turnos confirmados del mes)` | Bajo |

---

## 4. Decisiones resueltas (preguntas cerradas)

| # | Pregunta | Decisión |
|---|----------|----------|
| P1 | ¿Segmentos en el gráfico? | **3 segmentos** — Turnos / Abonos / Recurrentes |
| P2 | ¿Tarjeta de deuda pendiente? | **Sí** — SUM pendientes de turnos normales + deuda de recurrentes |
| P3 | ¿Seeds con recurrentes? | **Sí** — incluir `ingreso_recurrentes` con montos ficticios |
| P4 | ¿Cierre viejo con criterio incorrecto? | **Dejarlo** — aceptar que ese registro tiene criterio viejo |

---

## 5. Impacto en el codebase

### Archivos a modificar/crear

| Acción | Archivo | Detalle |
|--------|---------|---------|
| **Reescribir** | `frontend/src/pages/AdminFinance.tsx` | Dashboard: gráfico Recharts + tarjetas + métricas |
| **Fix bug** | `backend/src/abonos/abonos.service.ts` → `ejecutarCierreMensual()` | Cambiar filtro de `tipo='cargo'` a `tipo='pago'` |
| **Agregar columna** | Migration: `ALTER TABLE cierres_mensuales ADD COLUMN ingreso_recurrentes` | Para cuando se implementen recurrentes |
| **Crear endpoint** | `GET /pagos/historical-revenue` | Query a `cierres_mensuales` últimos 12 meses |
| **Crear endpoint** | `GET /pagos/current-month-summary` | 3 tarjetas del mes actual |
| **Modificar** | `backend/src/pagos/pagos.service.ts` | Agregar métodos para los 2 endpoints nuevos |
| **Modificar** | `backend/src/pagos/pagos.controller.ts` | Agregar rutas |
| **Instalar** | `recharts` en frontend | `npm install recharts --workspace=frontend` |
| **Crear** | `db/seeds/seed_cierres.sql` | Datos ficticios (dic 2025, ene 2026, feb 2026) |

### Archivos que NO se tocan

- `bookings.service.ts` — la generación de cargos sigue igual
- Otros componentes de frontend — sin dependencias cruzadas
- `abonos.controller.ts` — el endpoint de cierre sigue siendo el mismo

### Riesgo

**Bajo.** El fix del cierre es un cambio de una línea en el filtro. La nueva columna tiene default 0 (retrocompatible). La página de finanzas es aislada.

---

## 6. Plan de ejecución

1. ~~Resolver preguntas P1-P4~~ ✅ Todas resueltas
2. Fix: cambiar criterio del cierre mensual (`cargo` → `pago`)
3. Migration: agregar columna `ingreso_recurrentes` a `cierres_mensuales`
4. Instalar Recharts en frontend
5. Crear endpoint `historical-revenue` (query a `cierres_mensuales`)
6. Crear endpoint `current-month-summary` (cobrado turnos + abonos + recurrentes del mes)
7. Insertar datos seed en `cierres_mensuales`
8. Reescribir `AdminFinance.tsx`:
   - Gráfico barras apiladas (histórico, 3 segmentos)
   - 3 tarjetas mes actual
   - Métricas: tendencia, % composición, evolución socios
9. Validar con datos seed
