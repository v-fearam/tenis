-- 002_full_rebuild.sql
-- Tennis Club Management System - Club Belgrano
-- This script resets the database while preserving 'usuarios' data.

-- 1. Drop existing tables safely (except usuarios)
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS abonos CASCADE;
DROP TABLE IF EXISTS bloqueos CASCADE;
DROP TABLE IF EXISTS turno_jugadores CASCADE;
DROP TABLE IF EXISTS turnos CASCADE;
DROP TABLE IF EXISTS parametros_mensuales CASCADE;
DROP TABLE IF EXISTS canchas CASCADE;
DROP TABLE IF EXISTS socios CASCADE;

-- 2. Ensure 'usuarios' has the correct role constraint
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'socio', 'no-socio'));

-- ============================================
-- SOCIOS (membership details for registered users)
-- ============================================
CREATE TABLE socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nro_socio SERIAL UNIQUE,
  activo BOOLEAN DEFAULT true,
  tipo_abono VARCHAR(50) DEFAULT 'Sin Abono', -- e.g. 'Abono Libre', 'Abono x Partidos'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CANCHAS (courts)
-- ============================================
CREATE TABLE canchas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  superficie VARCHAR(30) DEFAULT 'polvo',
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial courts
INSERT INTO canchas (nombre, superficie) VALUES 
('Cancha 1', 'polvo'),
('Cancha 2', 'polvo'),
('Cancha 3', 'polvo'),
('Cancha 4', 'polvo'),
('Cancha 5', 'polvo');

-- ============================================
-- PARAMETROS MENSUALES (monthly config)
-- ============================================
CREATE TABLE parametros_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_anio DATE NOT NULL UNIQUE, -- first day of month, e.g. '2026-02-01'
  tarifa_socio NUMERIC(10,2) NOT NULL DEFAULT 500,
  tarifa_no_socio NUMERIC(10,2) NOT NULL DEFAULT 2000,
  duracion_min INTEGER NOT NULL DEFAULT 90,
  horario_apertura TIME NOT NULL DEFAULT '08:00',
  horario_cierre TIME NOT NULL DEFAULT '21:30',
  dias_habilitados JSONB DEFAULT '["lun","mar","mie","jue","vie","sab","dom"]',
  tipos_abono_habilitados JSONB DEFAULT '["libre","5","10"]',
  precio_abono_libre NUMERIC(10,2) DEFAULT 0,
  precio_abono_5 NUMERIC(10,2) DEFAULT 2500,
  precio_abono_10 NUMERIC(10,2) DEFAULT 4500,
  devuelve_credito_cancelacion BOOLEAN DEFAULT true,
  penaliza_cancelacion_tardia BOOLEAN DEFAULT false,
  notas TEXT,
  publicado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed current month parameters
INSERT INTO parametros_mensuales (mes_anio, tarifa_socio, tarifa_no_socio)
VALUES (DATE_TRUNC('month', CURRENT_DATE)::DATE, 500, 2000);

-- ============================================
-- TURNOS (bookings)
-- ============================================
CREATE TABLE turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cancha INTEGER NOT NULL REFERENCES canchas(id),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  tipo_partido VARCHAR(10) NOT NULL CHECK (tipo_partido IN ('single', 'double')),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmado', 'cancelado')),
  creado_por UUID REFERENCES usuarios(id),
  confirmado_por UUID REFERENCES usuarios(id),
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable btree_gist for overlap check if not enabled
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Prevent overlapping bookings
ALTER TABLE turnos ADD CONSTRAINT turnos_no_overlap
  EXCLUDE USING gist (
    id_cancha WITH =,
    tsrange(
      (fecha + hora_inicio)::timestamp,
      (fecha + hora_fin)::timestamp
    ) WITH &&
  ) WHERE (estado != 'cancelado');

-- ============================================
-- TURNO JUGADORES (players per booking)
-- ============================================
CREATE TABLE turno_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  id_persona UUID REFERENCES usuarios(id),
  tipo_persona VARCHAR(20) NOT NULL CHECK (tipo_persona IN ('socio', 'no_socio', 'invitado')),
  nombre_invitado VARCHAR(100),
  condicion_en_mes VARCHAR(30),
  uso_abono BOOLEAN DEFAULT false,
  id_abono_usado UUID,
  monto_generado NUMERIC(10,2) DEFAULT 0,
  estado_pago VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente', 'pagado', 'bonificado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BLOQUEOS (court blocks)
-- ============================================
CREATE TABLE bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cancha INTEGER NOT NULL REFERENCES canchas(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('torneo', 'clase', 'mantenimiento', 'otro')),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  descripcion TEXT,
  creado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ABONOS (monthly subscriptions)
-- ============================================
CREATE TABLE abonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_socio UUID NOT NULL REFERENCES socios(id),
  mes_anio DATE NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('libre', '5', '10')),
  creditos_totales INTEGER NOT NULL,
  creditos_disponibles INTEGER NOT NULL,
  precio_lista_mes NUMERIC(10,2),
  precio_pagado NUMERIC(10,2),
  activo BOOLEAN DEFAULT true,
  fecha_alta TIMESTAMPTZ DEFAULT now(),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PAGOS (payments / cuenta corriente ledger)
-- ============================================
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno_jugador UUID REFERENCES turno_jugadores(id),
  id_socio UUID REFERENCES socios(id),
  monto NUMERIC(10,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'pago', 'bonificacion', 'devolucion')),
  fecha TIMESTAMPTZ DEFAULT now(),
  medio VARCHAR(30),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_cancha ON turnos(fecha, id_cancha);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turno_jugadores_turno ON turno_jugadores(id_turno);
CREATE INDEX IF NOT EXISTS idx_turno_jugadores_persona ON turno_jugadores(id_persona);
CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha_cancha ON bloqueos(fecha, id_cancha);
CREATE INDEX IF NOT EXISTS idx_abonos_socio_mes ON abonos(id_socio, mes_anio);
CREATE INDEX IF NOT EXISTS idx_pagos_socio ON pagos(id_socio);
CREATE INDEX IF NOT EXISTS idx_pagos_turno_jugador ON pagos(id_turno_jugador);
CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ============================================
-- ENSURE ALL USERS HAVE A SOCIO ENTRY
-- ============================================
INSERT INTO socios (id_usuario, activo)
SELECT id, true FROM usuarios
ON CONFLICT (id_usuario) DO NOTHING;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
