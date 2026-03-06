# Sistema de Gestión de Canchas — Club Belgrano

**Reservas, membresías y finanzas en una sola plataforma.**

---

## La Solución

App web diseñada para que los socios reserven canchas desde el celular en pocos clicks, y la administración tenga visibilidad total de ocupación, cobros y finanzas.

- **Mobile-first**: funciona desde el navegador del celular, se puede instalar como app (sin bajar de App Store)
- **Calendario visual**: disponibilidad en tiempo real, sin llamadas ni WhatsApp
- **Gestión integral**: reservas, cobros, abonos y turnos recurrentes en un mismo sistema

---

## Funcionalidades — Vista Socio

**Calendario de disponibilidad**
- Vista semanal de todas las canchas
- Slots libres, ocupados y bloqueados visibles en tiempo real
- Reservas propias destacadas

**Reserva de turno**
- Selección de cancha, fecha y horario
- Tipo de partido: single (2 jugadores) o doble (4 jugadores)
- Búsqueda de compañeros socios por nombre o DNI
- Preview del costo antes de confirmar

**Historial personal**
- Lista de turnos pasados y futuros
- Estado de pago por turno (pendiente, pagado, bonificado)
- Saldo de créditos de abono disponibles

**App instalable**
- PWA: se instala en la pantalla de inicio del celular como una app nativa
- Sin descargas ni actualizaciones manuales

---

## Funcionalidades — Vista Admin

**Gestión de usuarios**
- Alta de socios, no-socios y administradores
- Asignación de abonos y créditos
- Historial de turnos y pagos por usuario
- Bloqueo de acceso (ok_club)

**Calendario y reservas**
- Vista completa de todas las canchas
- Confirmar y cancelar turnos
- Crear bloqueos por mantenimiento, torneos o clases

**Dashboard financiero**
- Ingresos del mes: turnos cobrados, abonos, recurrentes
- Deuda pendiente en tiempo real
- Gráfico histórico de los últimos 12 meses
- Tendencia vs mes anterior

**Cierre mensual**
- Snapshot automático de ingresos al cerrar el mes
- Registro inmutable del estado financiero de cada período

---

## Sistema de Abonos

Los socios pueden suscribirse a planes de abono con créditos para reservar a tarifa reducida.

- **Tipos configurables**: el admin define nombre, créditos y precio (ej: "Abono Singles — 8 créditos — $9.000")
- **Créditos fraccionarios**: un partido doble consume 0.5 créditos, un single consume 1
- **Fallback automático**: si los créditos se agotan, el sistema aplica la tarifa sin abono
- **Cierre mensual**: los abonos se registran en el snapshot del mes

---

## Turnos Recurrentes

Para grupos que juegan siempre el mismo día y horario (ej: martes y jueves a las 19:00).

- **Reserva por período**: se crean todos los turnos del ciclo de una vez
- **Descuento configurable**: descuento automático respecto a la tarifa regular (ej: 20%)
- **Control de deuda por grupo**: saldo = plata pagada − deuda acumulada
- **Cancelación flexible**: individual (un día) o total (cancela toda la recurrencia con recálculo)

---

## Precios Inteligentes

- **3 tarifas** configurables desde el panel de admin:
  - No-socio
  - Socio sin abono
  - Socio con abono
- **Split automático** del costo entre todos los jugadores del turno
- **Preview del costo** antes de confirmar cualquier reserva
- **Todo configurable** sin tocar código: desde el panel de admin

---

## Tecnología y Seguridad

- **Cloud-native**: sin servidores propios que mantener — todo en la nube (Vercel + Supabase)
- **Autenticación segura**: Supabase Auth con JWT — contraseñas nunca se almacenan en el sistema
- **Protección anti-bots**: Google reCAPTCHA v3 en reservas públicas
- **App instalable**: PWA que funciona desde el navegador, se instala en el celular

---

## Próximos Pasos

Para una demo en vivo o consultas: [contacto del club]
