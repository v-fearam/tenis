-- Migration: Performance indexes and query optimizations
-- Date: 2026-02-27
-- Description: Adds missing indexes based on actual application query patterns analysis
--
-- ANALYSIS SUMMARY:
-- Reviewed all 50+ queries across 7 service files (bookings, users, bloqueos, abonos, auth, canchas, config)
-- Identified query patterns that lack proper index coverage
--
-- EXISTING INDEXES (from 001/002 migrations):
--   idx_turnos_fecha_cancha       -> turnos(fecha, id_cancha)
--   idx_turnos_estado             -> turnos(estado)
--   idx_turno_jugadores_turno     -> turno_jugadores(id_turno)
--   idx_turno_jugadores_persona   -> turno_jugadores(id_persona)
--   idx_bloqueos_fecha_cancha     -> bloqueos(fecha, id_cancha)
--   idx_abonos_socio_mes          -> abonos(id_socio, mes_anio)
--   idx_pagos_socio               -> pagos(id_socio)
--   idx_pagos_turno_jugador       -> pagos(id_turno_jugador)
--   idx_usuarios_dni              -> usuarios(dni)
--   idx_usuarios_email            -> usuarios(email)

-- ============================================
-- 1. TURNOS (bookings) - CRITICAL
-- ============================================

-- The admin dashboard queries `estado + fecha` together constantly:
--   findAll:   WHERE estado = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha DESC, hora_inicio DESC
--   findActive: WHERE estado = 'confirmado' AND fecha >= today ORDER BY fecha, hora_inicio
--   confirm/cancel: WHERE id = ? (covered by PK)
--
-- The existing separate idx_turnos_estado is nearly useless because estado has only
-- 3 values (low cardinality). A composite index is far more efficient.
-- This covers both filtered listing and the active bookings dashboard.

CREATE INDEX IF NOT EXISTS idx_turnos_estado_fecha
    ON turnos(estado, fecha DESC, hora_inicio DESC);

-- For getDashboardData: queries turnos via turno_jugadores.id_persona + estado + fecha
-- The inner join on turno_jugadores is the bottleneck. The existing idx_turno_jugadores_persona
-- helps, but adding estado coverage on turnos for the post-join filter is important.
-- The composite index above already covers this.

-- ============================================
-- 2. USUARIOS - CRITICAL (most queried table)
-- ============================================

-- searchPublic: WHERE estado='activo' AND (nombre ILIKE OR dni ILIKE OR email ILIKE)
-- This query runs on every keystroke in the booking form's player search.
-- A partial index on active users improves the base filter before ILIKE scanning.

CREATE INDEX IF NOT EXISTS idx_usuarios_estado_nombre
    ON usuarios(estado, nombre)
    WHERE estado = 'activo';

-- For text search on nombre (used by searchPublic and search with ILIKE):
-- pg_trgm extension enables GIN trigram indexes for fast ILIKE queries.
-- This is the #1 performance improvement for the player search autocomplete.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_trgm
    ON usuarios USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni_trgm
    ON usuarios USING gin (dni gin_trgm_ops);

-- findAll: SELECT * ORDER BY nombre (paginated) — covered by idx_usuarios_estado_nombre
-- findOne: WHERE id = ? — covered by PK

-- ============================================
-- 3. SOCIOS - HIGH (frequent lookups by id_usuario)
-- ============================================

-- Multiple services query socios by id_usuario:
--   generatePlayerDebts: WHERE id_usuario = ? (runs per player per booking confirmation)
--   getDashboardData:    WHERE id_usuario = ? (on every user dashboard load)
--   updateSocio:         WHERE id_usuario = ?
--   consumeCredit:       WHERE id = ? (covered by PK)
--
-- socios.id_usuario already has a UNIQUE constraint which creates an implicit index.
-- No additional index needed.

-- For abono type check: WHERE id_tipo_abono = ? (deleteType checks usage count)
CREATE INDEX IF NOT EXISTS idx_socios_id_tipo_abono
    ON socios(id_tipo_abono)
    WHERE id_tipo_abono IS NOT NULL;

-- ============================================
-- 4. BLOQUEOS - MEDIUM
-- ============================================

-- findAll: WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC, hora_inicio DESC
-- findByDate: WHERE fecha = ?
-- Both are covered by idx_bloqueos_fecha_cancha(fecha, id_cancha).
-- Adding a pure fecha index for the range queries without cancha filter.

CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha
    ON bloqueos(fecha DESC);

-- ============================================
-- 5. CONFIG_SISTEMA - LOW
-- ============================================

-- Queried by clave (which has UNIQUE constraint = implicit index). No changes needed.

-- ============================================
-- 6. PARAMETROS_MENSUALES - LOW
-- ============================================

-- Queried by mes_anio (which has UNIQUE constraint = implicit index). No changes needed.

-- ============================================
-- 7. PAGOS - MEDIUM
-- ============================================

-- Currently only INSERT operations from the app, but for future financial reports:
-- The existing idx_pagos_socio covers the most likely query pattern.
-- Add a date-based index for report queries.

CREATE INDEX IF NOT EXISTS idx_pagos_fecha
    ON pagos(fecha DESC);

-- ============================================
-- 8. CLEANUP: Drop redundant single-column index
-- ============================================

-- idx_turnos_estado is low-cardinality (3 values) and now superseded by
-- idx_turnos_estado_fecha. Keeping it wastes space and slows writes.

DROP INDEX IF EXISTS idx_turnos_estado;

-- ============================================
-- 9. ANALYZE tables to refresh planner statistics
-- ============================================

ANALYZE turnos;
ANALYZE usuarios;
ANALYZE socios;
ANALYZE turno_jugadores;
ANALYZE bloqueos;
ANALYZE pagos;
ANALYZE config_sistema;
ANALYZE tipos_abono;
ANALYZE parametros_mensuales;
