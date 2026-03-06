# Análisis: Estrategia de Documentación

## Resumen

Se proponen **dos documentos principales** + ideas adicionales. Abajo detallo qué incluiría cada uno, cómo estructurarlo, y preguntas abiertas para que definas antes de arrancar.

---

## 1. Documentación Técnica — Arquitectura

**Objetivo:** Que un desarrollador nuevo (o vos en 6 meses) pueda entender el sistema completo en < 30 minutos.

### Estructura propuesta

```
1. Visión general
   - Qué es el sistema (1 párrafo)
   - Stack tecnológico (NestJS 11, React 19, Supabase/Postgres, Vercel)
   - Monorepo con NPM workspaces

2. Diagrama de arquitectura de alto nivel
   - Frontend (Vite/React) → API REST → Backend (NestJS) → Supabase (Postgres + Auth)
   - Vercel deploys (frontend SPA + backend serverless)
   - Diagrama de flujo: Usuario → CDN/Vercel → React SPA → /api/* → NestJS → Supabase

3. Backend — Módulos y responsabilidades
   - Diagrama de módulos NestJS (10 módulos feature + 1 global)
   - Auth flow: Supabase JWT → JwtAuthGuard → RolesGuard → @Roles()
   - Tabla de endpoints por módulo (resumen, no el detalle completo)
   - Capa de seguridad: reCAPTCHA v3, guards, validación DTO con class-validator

4. Modelo de datos
   - Diagrama ER (12 tablas, relaciones FK)
   - Tablas clave con descripción de 1 línea cada una
   - Decisiones de diseño notables:
     * creditos_disponibles como numeric(5,1) para fraccionarios
     * monto_recurrente en turnos (desnormalización intencional)
     * cierres_mensuales como snapshot mensual

5. Lógica de negocio crítica
   - Flujo de reserva: create → pending → confirm → genera pagos
   - Sistema de precios: 3 tarifas + split por cantidad de jugadores
   - Abonos: consumo de créditos (1 single, 0.5 double), fallback si agotados
   - Turnos recurrentes: modelo de deuda, comprometido, saldo
   - Cierre mensual: snapshot + reset de abonos

6. Frontend — Estructura y patrones
   - Rutas públicas vs protegidas vs admin
   - AuthContext + Bearer token injection
   - Design system: CSS variables pastel, mobile-first
   - Componentes clave (Calendar, BookingForm, AdminLayout)

7. Deployment y DevOps
   - Vercel config (frontend SPA rewrite, backend catch-all)
   - Variables de entorno necesarias
   - PWA: manifest + service worker

8. Decisiones de arquitectura (ADRs resumidos)
   - Por qué Supabase y no Firebase
   - Por qué CSS vanilla y no Tailwind
   - Por qué monorepo con workspaces
   - Por qué no ORM (queries directas a Supabase client)
```

### Formato sugerido

- **Markdown** (vive en el repo, se versiona con git)
- Diagramas en **Mermaid** (se renderizan en GitHub/VS Code)
- Nombre: `docs/arquitectura.md`

### Preguntas antes de escribirlo

1. **¿Querés que incluya diagramas Mermaid** (se renderizan en GitHub) o preferís algo que se pueda exportar a imagen fácilmente?
2. **¿Nivel de detalle en endpoints?** ¿Solo listar módulo + cantidad, o incluir cada ruta con método HTTP?
3. **¿Incluir las decisiones de arquitectura (ADRs)?** Son útiles para entender los "por qué", pero agregan extensión.
4. **¿Audiencia?** ¿Es para un dev que va a mantener el código, o también para alguien evaluando si adoptar el proyecto?
5. **¿Querés incluir un diagrama de secuencia** del flujo de reserva completo (create → confirm → payment)? Es el corazón del sistema.

---

## 2. Presentación Comercial (PPT / Pitch Deck)

**Objetivo:** Vender la app a clubes de tenis, paddle u otros deportes con canchas.

### Estructura propuesta (10-12 slides)

```
Slide 1 — Portada
   "Sistema de Gestión de Canchas — Club Belgrano"
   Subtítulo: Reservas, membresías y finanzas en una sola plataforma

Slide 2 — El problema
   - Reservas por WhatsApp/teléfono → errores, doble booking, pérdida de tiempo
   - Cobros manuales → deuda invisible, socios morosos sin control
   - Sin visibilidad de ocupación → canchas vacías, ingresos perdidos
   - Abonos en papel/Excel → imposible trackear créditos

Slide 3 — La solución
   - App web mobile-first (funciona como app nativa, se instala en el celular)
   - Reservas en 3 clicks con calendario visual en tiempo real
   - Gestión integral: reservas + cobros + abonos + recurrentes

Slide 4 — Funcionalidades clave (vista socio)
   - 📅 Calendario de disponibilidad en tiempo real
   - 🎾 Reserva rápida (single/doble, con invitados)
   - 💳 Historial personal con estado de pagos y deuda
   - 📱 PWA instalable (sin bajar de App Store)

Slide 5 — Funcionalidades clave (vista admin)
   - 👥 Gestión de socios y no-socios con roles
   - 💰 Dashboard financiero: ingresos por turnos, abonos, recurrentes
   - 🔒 Bloqueo de canchas (mantenimiento, eventos)
   - 📊 Cierre mensual automático con snapshots históricos

Slide 6 — Sistema de abonos
   - Tipos de abono configurables (Oro 8 partidos, Plata 4, etc.)
   - Créditos fraccionarios: doble consume 0.5, single consume 1
   - Fallback automático a tarifa sin abono cuando se agotan
   - Cierre mensual: reporte + reset automático

Slide 7 — Turnos recurrentes
   - Grupos que juegan siempre el mismo día/hora
   - Descuento configurable (ej: 20%)
   - Control de deuda y pagos por grupo
   - Cancelación individual o masiva con recálculo automático

Slide 8 — Precios inteligentes
   - 3 tarifas: no-socio, socio sin abono, socio con abono
   - Split automático del costo entre jugadores
   - Preview del costo antes de confirmar
   - Todo configurable desde el panel de admin

Slide 9 — Tecnología y seguridad
   - ☁️ Cloud-native: cero servidores que mantener
   - 🔐 Autenticación segura (Supabase Auth + JWT)
   - 🤖 Protección anti-bots (Google reCAPTCHA v3)
   - 📱 PWA: funciona offline-capable, se instala como app

Slide 10 — Casos de uso / Testimonios
   - Club con 4 canchas y 200 socios
   - Reducción de conflictos de horarios a 0
   - Visibilidad total de ingresos mensuales
   - Admin gasta 10 min/día en vez de 2 horas

Slide 11 — Adaptable a tu club
   - Multi-cancha (ilimitadas)
   - Configurable: precios, horarios, tipos de abono
   - Escalable: funciona para 1 cancha o 20
   - Adaptable: tenis, paddle, fútbol, cualquier deporte con cancha

Slide 12 — Contacto / Próximos pasos
   - Demo en vivo
   - Precio / modelo de negocio
   - Implementación en X días
```

### Formato sugerido

- **Google Slides o PowerPoint** — exportable a PDF
- Diseño: limpio, colores pastel consistentes con la app (azul #0A84FF, naranja #FF9F0A, fondos claros)
- Screenshots reales de la app (calendario, booking form, admin dashboard, historial de socio)
- Se puede generar el contenido en **Markdown** primero y después pasarlo a slides

### Preguntas antes de armarlo

1. **¿Modelo de negocio?** ¿SaaS mensual, licencia única, implementación + soporte? Esto cambia el slide final.
2. **¿Tenés screenshots de la app funcionando?** Son clave para el PPT. Si no, ¿querés que diseñe mockups descriptivos?
3. **¿Audiencia?** ¿Directivos de club que no saben nada de tecnología, o gente más técnica?
4. **¿Querés incluir pricing en el deck** o lo manejás aparte?
5. **¿Nombre comercial del producto?** "Sistema Club Belgrano" es específico. ¿Tiene un nombre genérico tipo "CanchaApp", "CourtManager", etc.?
6. **¿Competencia?** ¿Sabés contra qué compite? (MiTurno, TuCancha, PlayTomic, etc.) Podríamos incluir un diferenciador.

---

## 3. Ideas adicionales

### 3a. README profesional (público)
Si vas a vender o mostrar el proyecto, el README actual es básico. Un README con:
- Logo/banner
- Features con iconos
- Screenshots/GIFs
- Arquitectura resumida
- Quick start
- Badge de tech stack

Esto sirve tanto para venta como para portfolio.

### 3b. Documentación de API (Swagger/OpenAPI)
NestJS soporta `@nestjs/swagger` casi sin esfuerzo. Genera documentación interactiva de la API automáticamente. Esto:
- Sirve como doc técnica viva (siempre actualizada)
- Impresiona a clientes técnicos
- Facilita integración si algún club quiere conectar su sistema

### 3c. Onboarding Guide (para el club que compra)
Un doc paso a paso para el admin del club:
1. Primer login
2. Configurar canchas
3. Configurar precios
4. Crear tipos de abono
5. Dar de alta socios
6. Primera reserva

Esto reduce soporte post-venta y es un diferenciador vs la competencia.

### 3d. Roadmap público
Lista de features futuras (priorizadas):
- Notificaciones push (recordatorio de turno)
- Pagos online (MercadoPago/Stripe)
- Estadísticas de ocupación por cancha/horario
- App nativa (si en algún momento escala)
- Multi-club (white-label)

Mostrar roadmap genera confianza de que el producto tiene futuro.

### 3e. Landing page
Una single-page que funcione como sitio comercial del producto. Con la misma estética pastel de la app. Secciones: Hero → Features → Screenshots → Pricing → Contacto. Se puede hacer como otra ruta en el mismo frontend o un sitio aparte.

---

## 4. Plan de acción sugerido

| Prioridad | Documento | Esfuerzo | Impacto |
|-----------|-----------|----------|---------|
| 🔴 Alta | Arquitectura técnica | 2-3 horas | Base para todo lo demás |
| 🔴 Alta | Contenido del pitch deck (MD) | 1-2 horas | Necesario para vender |
| 🟡 Media | Swagger/OpenAPI | 30 min setup | Doc viva de API |
| 🟡 Media | Onboarding guide | 1 hora | Reduce soporte |
| 🟢 Baja | README profesional | 1 hora | Portfolio + primera impresión |
| 🟢 Baja | Roadmap | 30 min | Genera confianza |
| 🟢 Baja | Landing page | 3-4 horas | Canal de venta |

---

## 5. Decisiones pendientes (resumen)

Antes de escribir cualquier documento, idealmente definir:

1. **¿Nombre comercial del producto?** (afecta todo)
2. **¿Modelo de negocio?** SaaS vs licencia vs custom
3. **¿Audiencia del doc técnico?** Dev nuevo vs evaluador externo
4. **¿Screenshots disponibles?** Clave para el PPT
5. **¿Mermaid está OK para diagramas?** O preferís Draw.io/Figma exportable
6. **¿Querés que genere el PPT como Markdown** (y vos lo pasás a Slides) o preferís otro formato?
7. **¿Algún feature que quieras destacar o esconder** en el material comercial?

---

*Leé tranquilo este análisis y decime qué ajustar. Cuando estés listo, arranco con los documentos que elijas.*
