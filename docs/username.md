# Login con username en lugar de email

Fecha: 2026-03-10

## Objetivo
Evaluar qué implica pasar de login por email a login por username, cuáles son los riesgos, qué alternativas existen con la arquitectura actual, y qué cambios habría que hacer antes de decidir.

## Decisiones tomadas (contexto actual)
- Los usuarios actuales son de prueba y se pueden recrear (sin migración histórica)
- No habrá recuperación de contraseña por el usuario final
- Recuperación/reset solo por administrador desde backend
- Se acepta usar email sintético derivado de username para Supabase (ej. `username@cbtenis.com`)
- El email de negocio/contacto puede ser opcional en la base de negocio
- Username es identificador inmutable: no se puede editar una vez creado
- Si hay que cambiar username: baja lógica del usuario actual + alta de nuevo usuario
- Username pasa a ser el identificador visible en toda la aplicación
- Username liberado se puede reutilizar
- No habrá usernames reservados
- Regla técnica cerrada para auth: `auth_email = lower(trim(username)) + '@cbtenis.com'`
- Se mantiene `contact_email` opcional explícito para futuras comunicaciones

## Resumen ejecutivo
Con la arquitectura actual, la estrategia objetivo será:

- Opción C: email sintético derivado del username (ej. `username@cbtenis.com`) para Supabase Auth

Esto permite login visible por username sin depender de un email real del usuario final.

## Hallazgo clave de factibilidad
Hoy el sistema usa Supabase Auth con password-based login por email.

Evidencia en el código actual:
- Backend login: `auth.signInWithPassword({ email, password })`
- DTO backend: `LoginDto.email` está validado con `@IsEmail()`
- Frontend login: campo `type="email"`
- Alta de usuarios: se crea usuario en Supabase Auth con email
- Tabla `usuarios`: tiene columna `email` obligatoria
- Trigger de alta: copia `NEW.email` desde `auth.users` hacia `public.usuarios`

Restricción relevante de Supabase Auth:
- Las identidades de login soportadas nativamente son email, phone, OAuth y SAML
- No aparece username como identidad primaria nativa en el modelo actual

Conclusión práctica:
- Si querés que el usuario escriba un username en la pantalla de login, eso se puede hacer
- Si además querés eliminar email como identidad de autenticación subyacente, eso ya no es un cambio menor: sería un rediseño del modelo de autenticación

Nota importante sobre contraseña:
- La contraseña no se guarda en la tabla `public.usuarios`
- Se gestiona en Supabase Auth (hash en `auth.users`)
- El backend solo dispara operaciones de cambio/reset vía API de Supabase

## Recomendación
Implementar username como identificador visible de acceso y usar email sintético técnico para Supabase Auth.

En la práctica:
1. El usuario escribe username + password
2. El backend normaliza username
3. Construye `auth_email = username_normalizado + '@cbtenis.com'`
4. Ejecuta `signInWithPassword({ email: auth_email, password })` contra Supabase
5. El resto del flujo sigue igual

Esto mantiene compatibilidad con Supabase sin usar email real como credencial de ingreso.

## Qué cambia conceptualmente
Hoy:
- Email cumple dos funciones:
  - credencial de acceso
  - dato de contacto

Con Opción C:
- Username pasa a ser la credencial visible de acceso
- Email técnico (`@cbtenis.com`) queda como identificador interno de auth
- Email de contacto pasa a ser opcional de negocio

Esto es importante porque evita mezclar una decisión de UX con una migración profunda de identidad/autenticación.

## Alternativas

### Opción A: username como alias de login, email se mantiene internamente
Cómo funciona:
- Agregar columna `username` única en `usuarios`
- Cambiar login para recibir `identifier` o `username`
- Backend resuelve username -> email
- Supabase sigue autenticando con email + password

Pros:
- Menor riesgo
- Compatible con Supabase actual
- Cambio acotado y reversible
- Menor impacto sobre refresh tokens, guards y RLS
- Mantiene email para comunicación, recuperación y administración

Contras:
- Internamente seguís dependiendo de email
- Requiere garantizar unicidad, normalización y administración del username

### Opción B: reemplazar email por username como identidad real
Cómo funcionaría:
- Auth dejaría de girar alrededor de email
- Habría que rediseñar cómo se crean usuarios y cómo se autentican
- Posiblemente habría que usar emails sintéticos o cambiar de proveedor/estrategia de auth

Pros:
- Modelo más puro si de verdad no querés email como credencial

Contras:
- Mucho más riesgo técnico
- Puede chocar con limitaciones del proveedor auth actual
- Rompe más piezas del sistema
- Complica recuperación de cuenta, administración y soporte
- No la recomiendo como primera etapa

### Opción C: email sintético derivado del username (ej. `username@cbtenis.com`)
Cómo funcionaría:
- Cada usuario tiene un `username` único
- Para Supabase Auth se guarda/usa un email sintético con formato válido
- Ese email puede no existir en la realidad (solo cumple formato)
- Login visible sigue siendo `username + password`

Pros:
- Compatible con Supabase sin pelear contra su modelo de identidad
- Permite ocultar el email real en el login
- Simplifica el mapeo: `username` -> `username@cbtenis.com`

Contras:
- Si no guardás email real de contacto, recuperación de cuenta y comunicaciones se vuelven más complejas
- Si luego querés enviar emails reales (reset, avisos), necesitás un segundo campo de contacto sí o sí
- Riesgo de colisión si cambia la regla de normalización de username
- Requiere política estricta para cambios de username (porque cambia también la identidad técnica de login)

Estado para este proyecto:
- Esta opción es la más alineada con las decisiones actuales
- Como no habrá recuperación por usuario, la complejidad operativa baja
- El reset de contraseña queda delegado al admin

Recomendación para esta opción:
- Si avanzás con email sintético, conservar además un `contact_email` real opcional/obligatorio para operación
- Tratar el email sintético como identificador técnico, no como canal de comunicación

## Riesgos

### 1. Unicidad y colisiones de username
Dos usuarios no pueden compartir username.

Riesgos:
- colisiones al crear usuarios
- conflictos al migrar usuarios existentes
- discusiones de formato (`Juan`, `juan`, `juan_`, `juan.1`)

Mitigación:
- definir normalización clara, por ejemplo lowercase y trim
- índice único en DB
- validación consistente en backend y frontend

### 2. Enumeración de usuarios
Un login por username suele facilitar que alguien pruebe usernames comunes.

Riesgos:
- más facilidad para adivinar cuentas válidas

Mitigación:
- mensaje genérico de error
- rate limit
- bloqueo por intentos fallidos
- no revelar si falló por username inexistente o password inválida

### 3. Recuperación de cuenta
Si el usuario ya no recuerda el username, el soporte puede aumentar.

Mitigación:
- mantener email como canal de recuperación/contacto
- permitir que admin vea y edite username
- definir si el usuario puede cambiar su username o no

Si se usa email sintético:
- el canal real de recuperación debe ser otro campo (por ejemplo `contact_email`) o un flujo 100% administrado por soporte

Decisión actual:
- Flujo 100% administrado por soporte/admin (sin recuperación self-service)

### 4. Impacto operacional
Hoy muchas pantallas y búsquedas usan email como identificador visible.

Riesgo:
- inconsistencias UX si login usa username pero el resto del sistema sigue mostrando email

Mitigación:
- decidir si username se muestra solo en login/admin o si también se vuelve visible en perfil

### 5. Migración de usuarios existentes
Todos los usuarios actuales tienen email, pero no username.

Riesgos:
- datos incompletos
- usernames feos o ambiguos si se autogeneran
- necesidad de resolución manual para algunos casos

Mitigación:
- plan de backfill
- username temporal autogenerado
- forzar revisión/cambio posterior si hace falta

Decisión actual:
- No se hace migración porque los usuarios actuales son de prueba y se recrean

## Cambios técnicos necesarios

### Base de datos
Cambios mínimos recomendados:
- agregar columna `username` en `usuarios`
- hacerla `UNIQUE`
- hacerla `NOT NULL` después del backfill
- crear índice para búsquedas
- definir regla de normalización
- evaluar separar email técnico y email de contacto opcional

Posible esquema:
- `username VARCHAR(50)`
- `UNIQUE (lower(username))` o guardar siempre en minúsculas

Esquema recomendado para este caso:
- `username` obligatorio y único
- `auth_email` técnico obligatorio (derivado: `username@cbtenis.com`)
- `contact_email` opcional para negocio/comunicación
- mantener `email` actual solo si decidís reutilizarlo como `auth_email` por compatibilidad

Migración sugerida en fases:
1. agregar columna nullable
2. backfill de usuarios existentes
3. corregir colisiones
4. agregar restricción unique
5. pasar a not null

Plan simplificado para entorno actual (sin migración):
1. agregar `username` + columnas de email según modelo final
2. recrear usuarios de prueba con username
3. generar email técnico desde username al crear usuario
4. activar login por username

### Backend auth
Cambios necesarios:
- reemplazar `LoginDto.email` por algo como `identifier` o `username`
- quitar `@IsEmail()` del login
- normalizar username
- construir email técnico derivado (`username@cbtenis.com`)
- autenticar contra Supabase con email técnico + password
- mantener mensajes genéricos
- garantizar que la misma regla de derivación se use en create/login/update

Impacto en código actual:
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`

### Backend users/admin
Cambios necesarios:
- permitir crear/editar username desde admin
- validar unicidad
- incluir username en listados y búsqueda
- definir si admin puede cambiar username de usuarios existentes
- si cambia username, actualizar también el email técnico en Supabase Auth
- cuando admin resetea password, operar sobre el usuario resuelto por username

Ajuste por decisión tomada:
- no permitir edición de username en usuarios existentes
- implementar flujo operativo: desactivar usuario anterior y crear usuario nuevo cuando se requiera cambiar identificador

Impacto en código actual:
- `backend/src/users/dto/user.dto.ts`
- `backend/src/users/users.service.ts`
- `backend/src/users/users.controller.ts`

### Frontend login
Cambios necesarios:
- cambiar input email por username
- cambiar label, placeholder y autocomplete
- actualizar `AuthContext.login()` para enviar `username` o `identifier`

Impacto en código actual:
- `frontend/src/pages/Login.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/types/user.ts`

### Frontend admin users
Cambios necesarios:
- agregar campo username al alta y edición de usuarios
- mostrarlo en tabla o al menos en modal
- advertir si está repetido o inválido

Impacto en código actual:
- `frontend/src/pages/AdminUsers.tsx`
- `frontend/src/types/user.ts`

### Otras pantallas
Hay varias pantallas donde email hoy aparece como dato visible o criterio de búsqueda.
No todas requieren cambio funcional, pero sí una decisión de producto.

Decisión de diseño:
- username reemplaza email como identificador visible en todos lados
- las búsquedas y listados de usuarios deben incluir username como criterio principal

Áreas impactadas por uso visible de email:
- reservas
- selección de socios/usuarios
- admin usuarios
- admin abonos
- turnos recurrentes
- saludos o fallbacks visuales

## Cambios de validación y reglas
Hay que definir reglas desde el inicio para evitar deuda:

### Reglas mínimas sugeridas para username
- solo letras, números, guión bajo y punto
- min 3 caracteres
- max 30 o 40 caracteres
- case-insensitive
- no permitir espacios

### Reglas de negocio a decidir
- ¿puede cambiarlo el usuario o solo admin?
- ¿puede reutilizarse un username liberado?
- ¿puede coincidir con email de otro usuario?
- ¿hay usernames reservados? (`admin`, `club`, `soporte`)

Reglas de negocio cerradas:
- username no se puede cambiar (ni por usuario ni por admin)
- username liberado se puede reutilizar
- no hay usernames reservados

## Impacto sobre el modelo actual de Supabase
Con la opción recomendada, el impacto es moderado.

Se mantiene igual:
- Supabase Auth
- JWT
- refresh token
- guards
- RLS
- creación de sesión

Se modifica:
- la forma en que resolvés la identidad antes de autenticar

Con la opción no recomendada, el impacto es alto porque tocaría la base del modelo de identidad/auth.

## Riesgo técnico relativo

### Opción recomendada: medio
Porque:
- toca auth, DB, admin users y login
- pero no rompe la infraestructura de auth existente

### Opción no recomendada: alto
Porque:
- fuerza a pelear contra el modelo base del proveedor auth
- complica migración, soporte y recuperación

## Riesgo de producto/UX
Ventajas posibles:
- usernames más fáciles de recordar para algunos usuarios
- menos exposición visual del email en login
- puede sentirse más "club" y menos "app genérica"

Desventajas posibles:
- usuarios ya acostumbrados a su email pueden confundirse
- si no recuerdan username, aumenta soporte
- si el username no se comunica bien, la fricción puede subir

## Estrategia recomendada de rollout

### Etapa única (alineada a Opción C)
- agregar `username` y modelo de email técnico/contacto
- crear usuarios nuevos con `auth_email` derivado
- cambiar login a username
- habilitar administración de username y reset por admin
- validar operación con usuarios de prueba recreados

## Plan de implementación sugerido
1. Definir reglas de username
2. Definir modelo de email:
  - técnico derivado para auth
  - contacto opcional para negocio
3. Crear migración DB para `usuarios.username` y campos de email elegidos
4. Extender create/update de usuarios en backend (generar `username@cbtenis.com`)
5. Bloquear edición de username en update y validar contrato API
6. Extender admin users en frontend (alta con username, sin edición posterior)
7. Cambiar login backend y frontend a username
8. Reemplazar email por username como identificador visible en todas las pantallas relevantes
9. Agregar/reset de contraseña solo por admin (sin self-service de recuperación)
10. Re-crear usuarios de prueba
11. Ejecutar plan de testing completo

## Cobertura de tests recomendada (para minimizar riesgo)

### Backend unit tests
- login exitoso con username válido
- falla con username inexistente
- falla con password incorrecta
- falla con username duplicado en alta
- create normaliza username (trim/lowercase)
- update rechaza intento de cambio de username
- create genera auth_email técnico correctamente desde username
- reset de contraseña por admin funciona con usuario identificado por username
- baja lógica + alta nueva respeta reutilización de username

### Backend integration/e2e tests
- flujo completo: create user con username -> login -> `/auth/me`
- login bloqueado cuando usuario está inactivo
- contrato de API: payload de login ya no exige formato email
- endpoint de usuarios devuelve username en listados/detalle
- update de usuario sin username mantiene compatibilidad de campos existentes

### Frontend tests
- Login usa campo username (input tipo texto) y envía payload correcto
- errores de autenticación se muestran sin filtrar detalles
- Admin Users permite crear con username y no permite editar username existente
- tabla/listados muestran username como identificador principal
- búsquedas funcionan por username

### Regression checklist manual
- alta de usuario desde admin
- login/logout/refresh session
- cambio de contraseña de usuario logueado
- reset por admin
- bloqueo por intentos fallidos + desbloqueo admin
- módulos que muestran usuarios (reservas, abonos, recurrentes, historial)

## Decisión recomendada
Si querés avanzar, te recomendaría esto:
- Sí a username como login visible
- Mantener email técnico interno para Supabase, derivado del username
- Dejar email de contacto como opcional en la base de negocio
- Reset/recovery de contraseña solo por admin
- Sin migración histórica: recrear usuarios de prueba

Regla técnica cerrada:
- `auth_email = lower(trim(username)) + '@cbtenis.com'`

## Preguntas para decidir antes de implementar
- No quedan preguntas abiertas para esta etapa.

## Estimación orientativa
- Opción recomendada por etapas: media (1 a 3 días según migración y QA)
- Reemplazo completo de email como identidad: alta y con más incertidumbre
