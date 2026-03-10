# Cambio de contraseña por usuario logueado

Fecha: 2026-03-10

## Objetivo
Permitir que un usuario autenticado cambie su contraseña por iniciativa propia, de forma segura y trazable, minimizando riesgo operativo y de seguridad.

## Decisiones ya tomadas
- Sesión post-cambio: cerrar solo la sesión actual (logout inmediato en este dispositivo)
- Estrategia inicial: Opción 1 (mínima/rápida)
- Exigir siempre contraseña actual para cambio voluntario
- Auditoría persistente básica en base de datos
- Habilitado para todos los roles (admin, socio, no-socio)
- Habilitado también desde Perfil/Cuenta (además de flujo forzado)
- Política de contraseña: mantener política simple actual
- Control de login inválido: bloquear cuenta al superar 5 intentos fallidos
- Gestión administrativa: admin puede desbloquear cuenta y asignar nueva contraseña

## Estado actual del sistema
Hoy ya existe un flujo técnico de cambio de contraseña:

- Endpoint backend: PATCH /auth/change-password
- Página frontend: /change-password
- El endpoint está protegido por JWT (requiere usuario logueado)

Pero el comportamiento actual está orientado más a un flujo de contraseña forzada que a autogestión segura:

- Solo pide newPassword (no valida contraseña actual)
- Actualiza contraseña con privilegios admin (auth.admin.updateUserById)
- Resetea force_password_change en tabla usuarios
- No hay auditoría explícita del evento
- No hay evidencia de tests en backend para este flujo

## Riesgos e implicancias

### 0) Ataques de fuerza bruta en login
Sin control de intentos fallidos, una cuenta puede recibir múltiples intentos de login inválidos sin bloqueo.

Impacto:
- Mayor exposición a ataques por prueba de contraseñas

Mitigación recomendada:
- Bloquear cuenta luego de 5 intentos fallidos consecutivos
- Mostrar mensaje claro: "Cuenta bloqueada, contactá al administrador"
- Permitir desbloqueo y reset por administrador

### 1) Seguridad de sesión robada
Si alguien roba un token válido de un usuario, hoy puede cambiarle la contraseña sin conocer la contraseña actual.

Impacto:
- Toma de cuenta más fácil en escenarios de sesión comprometida

Mitigación recomendada:
- Exigir currentPassword y validarla antes de permitir el cambio

### 2) Uso de privilegios elevados innecesarios
El endpoint usa operación admin para un cambio que debería ser de autogestión del propio usuario.

Impacto:
- Mayor superficie de riesgo si hay bug en autorización

Mitigación recomendada:
- Preferir actualización con contexto del usuario autenticado (least privilege)

### 3) Falta de trazabilidad
No queda claro un registro de seguridad de tipo cambio de contraseña.

Impacto:
- Difícil investigar incidentes o reclamos

Mitigación recomendada:
- Registrar evento de auditoría (usuario, fecha/hora, IP si está disponible, user-agent opcional)

### 4) Política de contraseña mínima
Hoy solo se valida longitud mínima (6).

Impacto:
- Contraseñas débiles

Mitigación recomendada:
- Subir estándar mínimo (por ejemplo 10-12) y reglas de complejidad razonables
- Mensajes de error claros en UI

Decisión para esta etapa:
- Mantener la política simple actual

### 5) Experiencia y soporte
Si se endurece validación de golpe, puede aumentar fricción para socios con poca familiaridad técnica.

Impacto:
- Más tickets de soporte al principio

Mitigación recomendada:
- Copys claros, validación en vivo y guía visual
- Mantener alternativa de recuperación por email

## Propuesta funcional

### Flujo objetivo (autogestión segura)
1. Usuario logueado entra a Perfil o Seguridad
2. Ingresa:
   - contraseña actual
   - nueva contraseña
   - confirmación de nueva contraseña
3. Backend valida contraseña actual
4. Backend cambia contraseña
5. Backend registra auditoría
6. Sesión:
   - opción A (elegida): cerrar solo sesión actual (logout inmediato)
   - opción B (no elegida en esta etapa): invalidar todas las sesiones y forzar re-login global
7. Frontend muestra éxito y redirige a login o mantiene sesión según decisión de producto

## Cambios técnicos sugeridos

### Backend (NestJS)
0. Control de login inválido (nuevo):
   - En cada login fallido, incrementar contador por usuario
   - Al llegar a 5 intentos fallidos consecutivos: marcar cuenta bloqueada
   - Si cuenta bloqueada: rechazar login y devolver mensaje de contacto con admin
   - En login exitoso: resetear contador de intentos fallidos

1. DTO de cambio de contraseña:
   - currentPassword obligatorio
   - newPassword con política más fuerte

2. Servicio de auth:
   - Verificar currentPassword contra Supabase Auth antes de cambiar
   - Cambiar contraseña en contexto de usuario (evitar admin cuando no sea necesario)
   - Mantener reset de force_password_change cuando aplique
   - Emitir evento de auditoría

3. Controlador:
   - Mantener endpoint protegido por JwtAuthGuard
   - Tomar userId y accessToken del request

4. Administración de desbloqueo/reset (nuevo):
   - Reutilizar endpoint admin existente PATCH /users/:id para:
     - limpiar bloqueo
     - resetear contador de intentos
     - asignar nueva contraseña temporal o definitiva
   - Al asignar nueva contraseña por admin, marcar force_password_change=true

5. Seguridad adicional (recomendado):
   - Rate limit para endpoint de cambio de contraseña
   - Mensajes de error que no filtren detalles sensibles

6. Persistencia mínima requerida (nuevo):
   - Agregar campos en usuarios (o estructura equivalente):
     - failed_login_attempts (integer, default 0)
     - is_locked (boolean, default false)
     - locked_at (timestamp, nullable)
   - Opcional para auditoría básica:
     - tabla de eventos de seguridad o log simple en tabla existente

7. Testing (obligatorio por estándar del repo):
   - Crear auth.service.spec.ts
   - Casos mínimos:
     - falla si currentPassword incorrecta
     - falla si newPassword no cumple política
     - éxito: cambia password y resetea force_password_change
     - error de proveedor auth
     - error de DB al actualizar flag
     - login inválido incrementa intentos
     - al 5to intento inválido se bloquea cuenta
     - cuenta bloqueada no puede loguear
     - admin desbloquea y resetea contador

### Frontend (React)
0. Login (nuevo):
    - Si backend devuelve cuenta bloqueada, mostrar mensaje:
       - "Cuenta bloqueada por intentos fallidos. Contactá al administrador."

0.1. Pantalla de usuarios admin (nuevo):
    - En la grilla de Gestión de Usuarios, mostrar estado de bloqueo de forma sutil
    - Recomendación UI:
       - mantener Estado principal como Activo/Inactivo
       - sumar un indicador secundario discreto si la cuenta está bloqueada
       - ejemplo: badge chico "Bloqueada" o icono de alerta con tooltip
    - En edición de usuario, habilitar acción clara para levantar bloqueo
    - Recomendación UX:
       - no agregar una pantalla nueva
       - reutilizar el modal de edición actual
       - incluir checkbox o acción explícita tipo "Desbloquear cuenta"
       - si el admin carga nueva contraseña al desbloquear, marcar force_password_change=true
    - Si la cuenta está bloqueada, conviene mostrar además el contador de intentos o al menos la fecha de bloqueo si existe

1. Pantalla de cambio:
   - Agregar campo contraseña actual
   - Mantener nueva + confirmación
   - Validaciones en cliente (solo UX, no seguridad final)

2. Navegación:
   - Exponer acceso desde Perfil/Cuenta (no solo por flujo forzado)

3. UX:
   - Medidor de fortaleza (opcional)
   - Mensajes claros y consistentes
   - Botón de submit deshabilitado durante petición

4. Sesión post-cambio:
   - Definir si logout inmediato o continuidad de sesión

## Opciones de implementación

### Opción 1: mínima (rápida)
- Agregar currentPassword
- Validar actual
- Mantener resto similar
- Logout inmediato luego de cambio exitoso

Pros:
- Menor esfuerzo
- Reduce riesgo principal de token robado

Contras:
- Sigue faltando auditoría robusta
- Política de password puede quedar corta

### Opción 2: recomendada (balance)
- Todo lo de opción 1
- Política de contraseña reforzada
- Auditoría de evento
- Decisión explícita de sesión post-cambio

Pros:
- Seguridad y operación equilibradas
- Mejor soporte de incidentes

Contras:
- Trabajo moderado

### Opción 3: hardening completo
- Todo lo de opción 2
- Invalidación global de sesiones
- Alertas de seguridad por email
- Historial de seguridad en perfil

Pros:
- Máxima seguridad y trazabilidad

Contras:
- Mayor costo de implementación y soporte

## Compatibilidad con flujo force_password_change
Conviene mantener y unificar ambos casos:

- Caso A: cambio voluntario desde Perfil
- Caso B: cambio obligatorio al loguear con force_password_change=true

Ambos deberían reutilizar el mismo endpoint, con una política clara:
- Si es flujo forzado y no hay contraseña previa conocida por usuario final (depende de operación interna), definir excepción controlada
- Si el usuario sí conoce su contraseña, exigir currentPassword también en flujo forzado

## Plan de rollout sugerido
1. Definir decisiones de producto y seguridad (preguntas de abajo)
2. Implementar backend con tests TDD
3. Implementar frontend y validaciones UX
4. Pruebas manuales con casos nominales y de error
5. Despliegue con monitoreo de errores/auth
6. Revisar métricas de fallos y tickets 1-2 semanas

## Criterios de aceptación
- Usuario logueado puede cambiar su contraseña desde UI
- Se exige validación de contraseña actual (según política definida)
- Nueva contraseña cumple política acordada
- Endpoint protegido y cubierto por tests
- Evento queda auditado (si se aprueba)
- UX muestra resultado claro y no filtra información sensible
- Al 5to intento fallido consecutivo de login, la cuenta queda bloqueada
- Usuario bloqueado recibe mensaje de contacto con administrador
- Admin puede desbloquear cuenta y asignar nueva contraseña
- Al desbloquear, contador de intentos fallidos vuelve a 0
- En Gestión de Usuarios, una cuenta bloqueada se identifica visualmente sin resultar invasiva
- Desde el flujo actual de edición de usuario, el admin puede levantar el bloqueo sin salir de la pantalla

## Preguntas para decidir (necesarias)
1. Decidida: exigir siempre contraseña actual para cambio voluntario
2. Decidida: mantener política simple actual
3. Decidida: logout inmediato en este dispositivo
4. Decidida: auditoría persistente básica en base de datos
5. Decidida: disponible para todos los roles (admin, socio, no-socio)
6. Decidida: habilitar acceso desde Perfil/Cuenta además del flujo forzado
7. Decidida: arrancar por Opción 1 (mínima/rápida)
8. Decidida: bloquear al superar 5 intentos fallidos y pedir contacto con admin
9. Decidida: admin puede desbloquear cuenta y asignar nueva contraseña

## Estimación orientativa
- Opción 1: baja (0.5 a 1 día)
- Opción 2: media (1 a 2 días)
- Opción 3: media-alta (2 a 4 días)

(Estimación sin contar cambios de diseño grandes o QA extendido)
