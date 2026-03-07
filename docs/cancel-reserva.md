# Feature: Cancelar Reserva Propia

**Estado**: Diseño aprobado — pendiente implementación

---

## Resumen

Permitir que un usuario logueado (socio o no-socio) cancele un turno que él mismo creó, directamente desde el calendario. Los turnos propios se destacan visualmente con un color diferente para facilitar su identificación.

---

## Flujo de Usuario

1. El socio abre el calendario de reservas
2. Ve sus propios turnos en **verde pastel** con la etiqueta **"MI TURNO"** (los ajenos siguen en celeste "Reservado")
3. Hace click en un turno propio → aparece un panel de confirmación
4. El panel muestra: cancha, horario, y dos botones: **Volver** / **Confirmar cancelación**
5. Al confirmar, el sistema cancela el turno y revierte todo automáticamente:
   - Estado del turno → `cancelado`
   - Créditos de abono consumidos → reembolsados
   - Pagos pendientes de los jugadores → bonificados
6. El slot vuelve a quedar libre en el calendario

---

## Diseño Visual — Paleta del Calendario

| Estado | Color | Etiqueta | Clickeable |
|--------|-------|----------|------------|
| Libre | Blanco | _(reloj)_ | Sí → reservar |
| Reservado (ajeno) | `#E3F2FD` celeste | "Reservado" | No |
| **Mi turno (NUEVO)** | **`#C8E6C9` verde pastel** | **"MI TURNO"** | **Sí → cancelar** |
| Recurrente | `#EDE7F6` violeta | "RECURRENTE" | No |
| Bloqueado | `#FFE0B2` naranja | "TORNEO/CLASE/..." | No |
| Sin luz | `#E5E7E9` gris | "Sin Luz" | No |
| Pasado | `#F2F3F4` gris claro | _(vacío)_ | No |

El verde se eligió porque:
- Se diferencia claramente del celeste (ajeno) y del violeta (recurrente)
- Connota "tuyo / positivo" — intuitivo
- Encaja en la paleta pastel existente (Material Design green-100)

---

## Panel de Cancelación

Aparece en la misma zona que el panel de selección de slot (sticky arriba del grid). Diseño:

```
┌──────────────────────────────────────────────┐
│  ❌ Cancelar reserva                         │
│  Cancha 3 • 19:00 hs — Mié 12               │
│                                              │
│          [Volver]  [Confirmar cancelación]    │
│                         (rojo)               │
└──────────────────────────────────────────────┘
```

- "Confirmar cancelación" en rojo (`#E74C3C`)
- Si hay créditos de abono consumidos, se reembolsan automáticamente (sin mensaje extra — misma lógica que cancel admin)

---

## Reglas de Negocio

| Regla | Detalle |
|-------|---------|
| **Quién puede cancelar** | El usuario que creó el turno (`turnos.creado_por = user.id`) |
| **Qué estados** | `pendiente` y `confirmado` |
| **Turnos recurrentes** | NO — solo admin puede cancelarlos |
| **Restricción de tiempo** | Ninguna — se puede cancelar en cualquier momento |
| **Qué se revierte** | Estado→cancelado, abono→refund, pagos pendientes→bonificados |
| **Turnos anónimos** | No aplica — `creado_por` es NULL, nadie los ve como "MI TURNO" |

---

## Impacto Técnico

### Backend (2 archivos)

**`bookings.controller.ts`** — Endpoint cancel
- Abrir `@Roles` de `('admin')` a `('admin', 'socio', 'no-socio')`
- Pasar `req.user` al service para validación de ownership

**`bookings.service.ts`** — Método `cancel()` + `findByDateForCalendar()`
- Agregar validación: si no es admin, verificar que `creado_por === user.id` y que no es recurrente
- Error 403 si no cumple las condiciones
- Agregar `creado_por` al response del endpoint `/bookings/calendar` (es un UUID, no expone datos personales)

**Riesgo**: Bajo. La lógica de cancelación no cambia — solo se agrega un guard de ownership antes de ejecutarla. El admin sigue pudiendo cancelar todo sin restricciones.

### Frontend (2 archivos)

**`Calendar.tsx`** — Componente de calendario
- Nueva prop `currentUserId` para detectar turnos propios
- Nueva prop `onCancelBooking` callback
- Nuevo color verde + etiqueta "MI TURNO" para slots propios
- Click en slot propio abre panel de cancelación (nuevo state `cancelTarget`)
- Panel con botones Volver / Confirmar cancelación

**`Reserve.tsx`** — Página principal
- Handler `handleCancelBooking`: llama `PATCH /bookings/:id/cancel`, muestra toast, refresca calendario
- Pasa `currentUserId` y `onCancelBooking` al Calendar

**Riesgo**: Bajo. Los cambios al Calendar son aditivos — no modifican el flujo existente de reserva ni el comportamiento para usuarios no logueados.

### Base de datos

**Sin migraciones.** El campo `creado_por` ya existe en la tabla `turnos`. Solo se empieza a exponerlo en el endpoint calendar y a validarlo en el cancel.

---

## Edge Cases

| Caso | Comportamiento |
|------|---------------|
| Usuario no logueado | No ve "MI TURNO" — todo se ve como antes |
| Admin logueado | No ve "MI TURNO" en el calendario público — cancela desde su panel |
| Turno creado por otro socio | Se ve en celeste "Reservado", no es clickeable |
| Turno recurrente del socio | Se ve en violeta "RECURRENTE", no es clickeable |
| Turno anónimo (sin cuenta) | `creado_por=NULL` — nadie lo ve como "MI TURNO" |
| Cancelar turno ya cancelado | Backend ya devuelve error (idempotente) |
| Dos socios en el mismo turno | Solo el creador (`creado_por`) puede cancelar, no los otros jugadores |

---

## Diagrama de Flujo

```
Socio abre calendario
    │
    ├─ Ve slots verdes "MI TURNO" (sus reservas)
    ├─ Ve slots celestes "Reservado" (ajenos)
    │
    ▼ Click en "MI TURNO"
    │
    ├─ ¿Es recurrente? → No clickeable
    │
    ▼ Panel: "Cancelar reserva — Cancha X • HH:MM"
    │
    ├─ [Volver] → cierra panel
    ▼ [Confirmar cancelación]
    │
    ├─ PATCH /bookings/:id/cancel
    │   ├─ Backend verifica: ¿creado_por === user.id?
    │   │   ├─ NO → 403 Forbidden
    │   │   └─ SÍ → ejecuta cancelación completa
    │   │       ├─ estado → cancelado
    │   │       ├─ abono credits → refund
    │   │       └─ pagos pendientes → bonificado
    │   └─ Response: { id, status: 'cancelado' }
    │
    ▼ Toast: "Reserva cancelada exitosamente"
    │
    └─ Calendario se refresca → slot vuelve a estar libre
```
