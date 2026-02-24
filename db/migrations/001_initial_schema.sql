-- 001_initial_schema.sql
-- Tennis Club Management System - Club Belgrano
-- Run in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- USUARIOS (linked to Supabase auth.users)
-- ============================================
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  dni VARCHAR(20),
  telefono VARCHAR(30),
  email VARCHAR(150) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'socio' CHECK (rol IN ('admin', 'socio')),
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SOCIOS (membership details for registered users)
-- ============================================
CREATE TABLE socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nro_socio INTEGER UNIQUE,
  activo BOOLEAN DEFAULT true,
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

-- ============================================
-- PARAMETROS MENSUALES (monthly frozen config)
-- ============================================
CREATE TABLE parametros_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_anio DATE NOT NULL UNIQUE, -- first day of month, e.g. '2026-03-01'
  tarifa_socio NUMERIC(10,2) NOT NULL,
  tarifa_no_socio NUMERIC(10,2) NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 90,
  horario_apertura TIME NOT NULL DEFAULT '08:00',
  horario_cierre TIME NOT NULL DEFAULT '21:30',
  dias_habilitados JSONB DEFAULT '["lun","mar","mie","jue","vie","sab","dom"]',
  tipos_abono_habilitados JSONB DEFAULT '["libre","5","10"]',
  precio_abono_libre NUMERIC(10,2),
  precio_abono_5 NUMERIC(10,2),
  precio_abono_10 NUMERIC(10,2),
  devuelve_credito_cancelacion BOOLEAN DEFAULT true,
  penaliza_cancelacion_tardia BOOLEAN DEFAULT false,
  notas TEXT,
  publicado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Prevent overlapping bookings on the same court+date (excluding cancelled)
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
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'pago', 'bonificacion', 'devolucion')),
  monto NUMERIC(10,2) NOT NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  medio VARCHAR(30),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_turnos_fecha_cancha ON turnos(fecha, id_cancha);
CREATE INDEX idx_turnos_estado ON turnos(estado);
CREATE INDEX idx_turno_jugadores_turno ON turno_jugadores(id_turno);
CREATE INDEX idx_turno_jugadores_persona ON turno_jugadores(id_persona);
CREATE INDEX idx_bloqueos_fecha_cancha ON bloqueos(fecha, id_cancha);
CREATE INDEX idx_abonos_socio_mes ON abonos(id_socio, mes_anio);
CREATE INDEX idx_pagos_socio ON pagos(id_socio);
CREATE INDEX idx_pagos_turno_jugador ON pagos(id_turno_jugador);
CREATE INDEX idx_usuarios_dni ON usuarios(dni);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ============================================
-- AUTO-CREATE usuario ON SIGNUP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, rol, estado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'socio'),
    'activo'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
