# Análisis: Estrategia de Documentación

## Resumen

Se proponen **dos documentos principales** + ideas adicionales. Abajo detallo qué incluiría cada uno, cómo estructurarlo, y preguntas abiertas para que definas antes de arrancar.

---

## 0. Script SQL de Deploy (`docs/implementacion/deploy/`)

**Objetivo:** Script completo para instalar la app desde cero en una base de datos Supabase limpia.

### Contenido

Un único archivo `install.sql` (o varios numerados) con comentarios explicativos, que incluya:

```
1. Extensiones requeridas
   - uuid-ossp, btree_gist, pg_trgm

2. Tablas (en orden de dependencias FK)
   - usuarios, socios, canchas, tipos_abono
   - config_sistema, parametros_mensuales
   - turnos, turno_jugadores, bloqueos, pagos
   - cierres_mensuales
   - turnos_recurrentes, movimientos_recurrentes

3. Constraints y exclusiones
   - CHECK constraints (roles, estados, tipos)
   - GIST exclusion (turnos_no_overlap)
   - UNIQUE constraints

4. Indexes
   - Performance indexes (19 totales)
   - Trigram indexes para búsqueda

5. Funciones y triggers
   - handle_new_user() + trigger on_auth_user_created

6. RLS policies
   - config_sistema (read auth, all admin)
   - cierres_mensuales (all admin)

7. Datos básicos (seed)
   - 5 canchas de polvo de ladrillo
   - config_sistema (precios, descuentos)
   - tipos_abono (Oro, Plata, etc.)
```

### Notas
- Fuente: consolidación de migraciones 001-007 + config manual + tablas recurrentes (008 faltante)
- ⚠️ La migración 008 (turnos_recurrentes, movimientos_recurrentes) no existe como archivo SQL — se creó desde Supabase SQL Editor. El script de deploy la incluirá.
- Comentarios en español explicando cada sección

---

## 1. Documentación Técnica — Arquitectura

**Objetivo:** Que un desarrollador nuevo (o vos en 6 meses) pueda entender el sistema completo en < 30 minutos.

### Decisiones tomadas

- **Audiencia**: Desarrollador que va a mantener el código
- **Diagramas**: Mermaid (se renderizan en GitHub/VS Code)
- **Endpoints**: Solo listar módulo + cantidad
- **ADRs**: No incluir (elimina extensión innecesaria)
- **Diagramas de secuencia**: Solo del flujo crítico de reserva (create → confirm → payment)

### Estructura definida

```
1. Visión general
   - Qué es el sistema (1 párrafo)
   - Stack tecnológico (NestJS 11, React 19, Supabase/Postgres, Vercel)
   - Monorepo con NPM workspaces

2. Diagrama de arquitectura de alto nivel (Mermaid)
   - Frontend (Vite/React) → API REST → Backend (NestJS) → Supabase (Postgres + Auth)
   - Vercel deploys (frontend SPA + backend serverless)

3. Backend — Módulos y responsabilidades
   - 11 módulos (abonos, auth, bloqueos, bookings, canchas, common, config, pagos/finanzas, supabase, turnos-recurrentes, users)
   - Auth flow: Supabase JWT → JwtAuthGuard → RolesGuard → @Roles()
   - Tabla resumen: módulo + cantidad de endpoints
   - Capa de seguridad: reCAPTCHA v3, guards, validación DTO

4. Modelo de datos (Mermaid ER)
   - Diagrama ER (12 tablas, relaciones FK)
   - Tablas clave con descripción de 1 línea cada una
   - Decisiones de diseño notables:
     * creditos_disponibles como numeric(5,1) para fraccionarios
     * monto_recurrente en turnos (desnormalización intencional)
     * cierres_mensuales como snapshot mensual

5. Lógica de negocio crítica
   - Diagrama de secuencia: flujo de reserva (create → pending → confirm → genera pagos)
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
   - PWA: manifest
```

### Formato

- **Markdown** (vive en el repo, se versiona con git)
- Diagramas en **Mermaid** (se renderizan en GitHub/VS Code)
- Nombre: `docs/implementacion/arquitectura.md`

---

## 2. Documento de Producto (`docs/implementacion/producto.md`)

**Objetivo:** Describir qué hace la app, para quién, y sus funcionalidades clave.

### Decisiones tomadas

- **Formato**: Markdown (en el repo, no Google Slides)
- **Modelo de negocio**: SaaS mensual (no hablar de precios por ahora)
- **Screenshots**: No incluir (se desactualizan)
- **Audiencia**: Por ahora solo Club Belgrano, luego se adaptaría para otros
- **Competencia**: No mencionar por ahora

### Estructura definida

```
1. Portada / Resumen
   "Sistema de Gestión de Canchas — Club Belgrano"
   Reservas, membresías y finanzas en una sola plataforma

2. La solución
   - App web mobile-first (funciona como app nativa, se instala en el celular)
   - Reservas en pocos clicks con calendario visual en tiempo real
   - Gestión integral: reservas + cobros + abonos + recurrentes

3. Funcionalidades — Vista socio
   - Calendario de disponibilidad en tiempo real
   - Reserva rápida (single/doble, con invitados)
   - Historial personal con estado de pagos y deuda
   - PWA instalable (sin bajar de App Store)

4. Funcionalidades — Vista admin
   - Gestión de socios y no-socios con roles
   - Dashboard financiero: ingresos por turnos, abonos, recurrentes
   - Bloqueo de canchas (mantenimiento, eventos)
   - Cierre mensual automático con snapshots históricos

5. Sistema de abonos
   - Tipos de abono configurables (Oro 8 partidos, Plata 4, etc.)
   - Créditos fraccionarios: doble consume 0.5, single consume 1
   - Fallback automático a tarifa sin abono cuando se agotan
   - Cierre mensual: reporte + reset automático

6. Turnos recurrentes
   - Grupos que juegan siempre el mismo día/hora
   - Descuento configurable (ej: 20%)
   - Control de deuda y pagos por grupo
   - Cancelación individual o masiva con recálculo automático

7. Precios inteligentes
   - 3 tarifas: no-socio, socio sin abono, socio con abono
   - Split automático del costo entre jugadores
   - Preview del costo antes de confirmar
   - Todo configurable desde el panel de admin

8. Tecnología y seguridad
   - Cloud-native: cero servidores que mantener
   - Autenticación segura (Supabase Auth + JWT)
   - Protección anti-bots (Google reCAPTCHA v3)
   - PWA: se instala como app

9. Contacto / Próximos pasos
   - Demo en vivo
```

---

## 3. Ideas adicionales

### 3a. README profesional (público) — APROBADO
Mejorar el README actual con:
- Logo/banner
- Features con iconos
- Arquitectura resumida
- Quick start
- Badge de tech stack

### 3b. Documentación de API (Swagger/OpenAPI) — APROBADO
NestJS soporta `@nestjs/swagger` casi sin esfuerzo. Genera documentación interactiva de la API automáticamente. Esto:
- Sirve como doc técnica viva (siempre actualizada)
- Facilita integración si algún club quiere conectar su sistema

### 3c. Onboarding Guide — APROBADO
Ubicación: `docs/implementacion/onboarding.md`

Un doc paso a paso para el admin del club:
1. Primer login
2. Configurar canchas
3. Configurar precios
4. Crear tipos de abono
5. Dar de alta socios
6. Primera reserva

Reduce soporte post-venta.

### ~~3d. Roadmap público~~ — DESCARTADO

### ~~3e. Landing page~~ — DESCARTADO

---

## 4. Plan de acción

| Prioridad | Documento | Estado |
|-----------|-----------|--------|
| 🔴 Alta | Script SQL de deploy (`docs/implementacion/deploy/`) | Pendiente |
| 🔴 Alta | Arquitectura técnica (`docs/implementacion/arquitectura.md`) | Pendiente |
| 🔴 Alta | Documento de producto (`docs/implementacion/producto.md`) | Pendiente |
| 🟡 Media | Swagger/OpenAPI (setup `@nestjs/swagger`) | Pendiente |
| 🟡 Media | Onboarding guide (`docs/implementacion/onboarding.md`) | Pendiente |
| 🟢 Baja | README profesional | Pendiente |

---

## 5. Decisiones pendientes (resumen)

### Resueltas
- ~~Audiencia del doc técnico~~ → Dev mantenedor
- ~~Mermaid para diagramas~~ → Sí
- ~~Formato producto~~ → Markdown (`docs/implementacion/producto.md`)
- ~~Pricing en el deck~~ → No por ahora
- ~~PWA offline~~ → No prometer (no implementado)
- ~~Modelo de negocio~~ → SaaS mensual (sin hablar de precios aún)
- ~~Screenshots~~ → No incluir (se desactualizan)
- ~~Competencia~~ → No mencionar por ahora
- ~~Roadmap público~~ → No
- ~~Landing page~~ → No
- ~~README~~ → Sí, mejorar
- ~~Swagger~~ → Sí, generar
- ~~Onboarding~~ → Sí, en `docs/implementacion/onboarding.md`

### Pendientes
- Ninguna. Todas las decisiones están tomadas.
- Nombre del producto: "Sistema de Gestión de Canchas — Club Belgrano" (se puede cambiar después)

---

*Próximo paso: arrancar con la generación de los 5 documentos del plan de acción.*
