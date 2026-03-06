# Guía de Implementación — Club Belgrano

Guía paso a paso para el administrador del club. Seguir en orden.

---

## Requisitos previos

Antes de empezar, tener a mano:
- URL de la aplicación (provista durante la implementación)
- Email y contraseña del usuario administrador inicial
- Lista de canchas del club (nombre, superficie, horario)
- Precios de la temporada actual
- Lista de socios (nombre, DNI, teléfono, email)

---

## Paso 1 — Primer login

1. Ingresar a la URL de la aplicación
2. Hacer clic en **Ingresar**
3. Usar el email y contraseña del administrador
4. Al ingresar, se ve el panel de administración

> Si el login falla, verificar que el email sea exactamente el que se configuró durante la instalación.

---

## Paso 2 — Configurar precios

Los precios se aplican automáticamente a todas las reservas.

1. Ir a **Admin → Configuración**
2. Ajustar los valores:
   - **Precio no-socio**: tarifa por jugador para visitantes
   - **Precio socio sin abono**: tarifa para socios que no tienen plan
   - **Precio socio con abono**: tarifa para socios con plan activo
   - **Descuento recurrente**: % de descuento para grupos fijos (ej: 20)
3. Guardar cambios

> Los precios son por jugador, no por cancha. El sistema divide el costo total entre la cantidad de jugadores del turno.

---

## Paso 3 — Configurar canchas

1. Ir a **Admin → Canchas**
2. Verificar que estén cargadas las canchas del club
3. Para cada cancha, configurar:
   - **Nombre**: cómo aparece en el calendario (ej: "Cancha 1")
   - **Superficie**: polvo de ladrillo, cemento, etc.
   - **Horario**: apertura y cierre (puede diferir del horario general del club)
   - **Luz**: si la cancha tiene iluminación nocturna
4. Activar o desactivar canchas según disponibilidad

> Las canchas desactivadas no aparecen en el calendario de reservas.

---

## Paso 4 — Crear tipos de abono

Los abonos son planes de membresía que permiten reservar a tarifa reducida.

1. Ir a **Admin → Abonos → Tipos de abono**
2. Para cada plan, definir:
   - **Nombre**: descripción del plan (ej: "Abono Singles", "Abono Dobles")
   - **Créditos**: cantidad de partidos incluidos (singles = 1 crédito/partido, dobles = 0.5 créditos/partido)
   - **Precio mensual**
   - **Color**: para diferenciarlo visualmente en la UI
3. Guardar

**Ejemplo de configuración:**

| Plan | Créditos | Equivalencia | Precio |
|------|----------|--------------|--------|
| Abono Singles | 8 | 8 partidos singles | $9.000 |
| Abono Dobles | 8 | 16 partidos dobles | $6.000 |

---

## Paso 5 — Dar de alta socios

### Opción A: Socio nuevo (sin cuenta previa)

1. Ir a **Admin → Usuarios → Nuevo usuario**
2. Completar:
   - Nombre completo
   - DNI
   - Teléfono
   - Email
   - Rol: **socio**
3. El sistema envía un email de bienvenida con la contraseña temporal

### Opción B: Asignar abono a un socio existente

1. Ir a **Admin → Usuarios** y buscar el socio
2. Clic en el socio → **Editar membresía**
3. Seleccionar el tipo de abono
4. El sistema asigna los créditos automáticamente

### Opción C: Usuarios no-socios

Visitantes que reservan ocasionalmente. Se crean igual que los socios pero con rol **no-socio**. Pagan tarifa completa.

---

## Paso 6 — Primera reserva de prueba

Verificar que todo funcione antes de abrir al público:

1. Ir al **Calendario**
2. Hacer clic en un slot libre
3. Completar el formulario: cancha, horario, jugadores
4. Verificar que el **preview de precio** sea correcto
5. Confirmar la reserva
6. En **Admin → Reservas activas**, buscar la reserva y confirmarla
7. Verificar que aparezca el cargo en el historial del socio

---

## Operación diaria

### Confirmar reservas pendientes
- **Admin → Reservas activas** muestra todos los turnos pendientes de confirmación
- Confirmar genera el cargo en la cuenta del socio

### Registrar un pago
- Abrir el turno correspondiente
- Clic en **Registrar pago**
- Ingresar monto y medio de pago (efectivo, transferencia, etc.)

### Bloquear una cancha
- **Admin → Bloqueos → Nuevo bloqueo**
- Seleccionar cancha, fecha, horario y motivo (mantenimiento, torneo, clase)

---

## Cierre mensual

Al finalizar cada mes, ejecutar el cierre para registrar el snapshot financiero.

1. Ir a **Admin → Finanzas**
2. Verificar que los cobros del mes estén al día
3. Hacer clic en **Ejecutar cierre mensual**
4. El sistema registra:
   - Ingresos por turnos cobrados
   - Ingresos por abonos
   - Ingresos por turnos recurrentes
5. El cierre es **irreversible** — no modifica datos, solo toma la foto del estado actual

---

## Turnos recurrentes

Para grupos que juegan siempre el mismo día y horario:

1. **Admin → Turnos Recurrentes → Nueva recurrencia**
2. Definir:
   - Nombre del grupo
   - Responsable (socio que gestiona los pagos)
   - Cancha y horario
   - Días de la semana (ej: martes y jueves)
   - Período (fecha inicio y fin)
3. El sistema crea todos los turnos del período automáticamente con el descuento correspondiente
4. Los pagos del grupo se registran en **Admin → Turnos Recurrentes → [Grupo] → Registrar pago**

---

## Preguntas frecuentes

**¿Qué pasa si un socio cancela un turno con abono?**
El sistema devuelve los créditos automáticamente al cancelar.

**¿Puedo cambiar el precio de un abono existente?**
Sí, desde Admin → Abonos → Tipos de abono. El cambio afecta a los nuevos asignados, no a los que ya tienen créditos.

**¿Cómo veo cuánto debe un socio?**
En Admin → Usuarios → [Socio] → Historial se muestra la deuda total.

**¿Un no-socio puede reservar sin tener cuenta?**
Sí, desde el calendario público pueden reservar ingresando nombre, email y teléfono de contacto (sin registrarse).

**¿Dónde veo el resumen financiero del mes actual?**
En Admin → Finanzas se muestran los ingresos del mes en curso con las 4 tarjetas de resumen.
