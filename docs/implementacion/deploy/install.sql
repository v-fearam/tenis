-- =============================================================================
-- install.sql — Club Belgrano: Sistema de Gestión de Canchas
-- =============================================================================
-- Descripción : Script de instalación completo para base de datos Supabase nueva.
--               Incluye tablas, índices, funciones, políticas RLS y datos básicos.
-- Ejecutar en : Supabase SQL Editor (como usuario postgres/service_role)
-- Versión     : 2026-03 (consolida migraciones 001–008 + config manual)
-- =============================================================================


-- =============================================================================
-- SECCIÓN 1: EXTENSIONES
-- Requeridas antes de crear tablas con GIST, UUID y búsqueda por texto.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- soporte GIST para exclusión de solapamientos
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- índices trigramas para búsqueda ILIKE rápida


-- =============================================================================
-- SECCIÓN 2: TABLAS
-- Orden respeta dependencias de claves foráneas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 USUARIOS
-- Espejo de auth.users. Se crea automáticamente vía trigger al registrar usuario.
-- Roles: admin (gestión total), socio (reservas con privilegios), no-socio (reservas básicas).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,
  dni         VARCHAR(20),
  telefono    VARCHAR(30),
  email       VARCHAR(150) NOT NULL,
  rol         VARCHAR(20)  NOT NULL DEFAULT 'no-socio'
                           CHECK (rol IN ('admin', 'socio', 'no-socio')),
  estado      VARCHAR(20)  NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo', 'inactivo')),
  ok_club     BOOLEAN      DEFAULT true,   -- permite o bloquea acceso al sistema
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.2 CANCHAS
-- Canchas físicas del club. Cada cancha puede tener horarios propios.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canchas (
  id             SERIAL       PRIMARY KEY,
  nombre         VARCHAR(50)  NOT NULL,
  superficie     VARCHAR(30)  DEFAULT 'polvo',   -- polvo de ladrillo, cemento, etc.
  activa         BOOLEAN      DEFAULT true,
  hora_apertura  TIME         DEFAULT '08:00',
  hora_cierre    TIME         DEFAULT '22:30',
  tiene_luz      BOOLEAN      DEFAULT false,
  created_at     TIMESTAMPTZ  DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.3 TIPOS DE ABONO
-- Productos de membresía disponibles. Cada socio puede tener uno asignado.
-- Los créditos pueden ser fraccionarios: dobles consumen 0.5, singles consumen 1.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipos_abono (
  id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre   TEXT          NOT NULL UNIQUE,
  creditos NUMERIC(5,1)  NOT NULL,   -- créditos totales por ciclo (ej: 8.0)
  precio   NUMERIC(10,2) NOT NULL,
  color    TEXT                       -- color hex para UI (ej: '#4CAF50')
);

-- -----------------------------------------------------------------------------
-- 2.4 CONFIG SISTEMA
-- Parámetros globales del sistema (precios, horarios, etc.).
-- RLS habilitado: solo admins pueden escribir, todos los autenticados leen.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_sistema (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT         NOT NULL UNIQUE,
  valor       TEXT         NOT NULL,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ  DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2.5 PARAMETROS MENSUALES
-- Configuración mensual archivada (histórico). Actualmente poco usada;
-- la configuración activa vive en config_sistema.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parametros_mensuales (
  id                         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_anio                   DATE          NOT NULL UNIQUE,  -- primer día del mes (YYYY-MM-01)
  tarifa_socio               NUMERIC(10,2) NOT NULL DEFAULT 500,
  tarifa_no_socio            NUMERIC(10,2) NOT NULL DEFAULT 2000,
  duracion_min               INTEGER       NOT NULL DEFAULT 90,
  horario_apertura           TIME          NOT NULL DEFAULT '08:00',
  horario_cierre             TIME          NOT NULL DEFAULT '21:30',
  dias_habilitados           JSONB         DEFAULT '["lun","mar","mie","jue","vie","sab","dom"]',
  tipos_abono_habilitados    JSONB         DEFAULT '["libre","5","10"]',
  precio_abono_libre         NUMERIC(10,2) DEFAULT 0,
  precio_abono_5             NUMERIC(10,2) DEFAULT 2500,
  precio_abono_10            NUMERIC(10,2) DEFAULT 4500,
  devuelve_credito_cancelacion BOOLEAN     DEFAULT true,
  penaliza_cancelacion_tardia  BOOLEAN     DEFAULT false,
  notas                      TEXT,
  publicado                  BOOLEAN       DEFAULT true,
  created_at                 TIMESTAMPTZ   DEFAULT now(),
  updated_at                 TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.6 SOCIOS
-- Detalle de membresía de usuarios con rol 'socio'.
-- nro_socio: número auto-incremental único del carnet.
-- creditos_disponibles: fraccionarios (NUMERIC(5,1)) para dobles (0.5) y singles (1.0).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.socios (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario            UUID          NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nro_socio             SERIAL        UNIQUE,
  activo                BOOLEAN       DEFAULT true,
  id_tipo_abono         UUID          REFERENCES tipos_abono(id),           -- nulo si no tiene abono
  creditos_disponibles  NUMERIC(5,1)  DEFAULT 0,                            -- saldo de créditos actuales
  created_at            TIMESTAMPTZ   DEFAULT now(),
  updated_at            TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.7 TURNOS RECURRENTES
-- Grupos que reservan siempre el mismo día/hora (ej: martes y jueves 19:00).
-- El precio por turno puede recalcularse; el precio original queda en precio_unitario_original.
-- dias_semana usa numeración ISO: 1=lun, 2=mar, ..., 7=dom.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turnos_recurrentes (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                   TEXT          NOT NULL,
  id_cancha                INTEGER       NOT NULL REFERENCES canchas(id),
  id_socio_responsable     UUID          NOT NULL REFERENCES socios(id),
  dias_semana              INTEGER[]     NOT NULL,      -- ej: {2,4} = martes y jueves
  hora_inicio              TIME          NOT NULL,
  hora_fin                 TIME          NOT NULL,
  fecha_desde              DATE          NOT NULL,
  fecha_hasta              DATE          NOT NULL,
  precio_unitario_original NUMERIC(10,2) NOT NULL,     -- precio al momento de creación
  observacion              TEXT,
  estado                   VARCHAR(20)   NOT NULL DEFAULT 'activa'
                                         CHECK (estado IN ('activa', 'cancelada')),
  creado_por               UUID          REFERENCES usuarios(id),
  created_at               TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.8 TURNOS
-- Reservas individuales de cancha. Cada turno tiene jugadores asociados en turno_jugadores.
-- Estado lifecycle: pendiente → confirmado → (cancelado).
-- El constraint turnos_no_overlap evita reservas solapadas en la misma cancha.
-- costo: precio total del turno (suma de monto_generado de jugadores).
-- id_turno_recurrente: vincula el turno a su recurrencia (nullable para turnos individuales).
-- monto_recurrente: precio por ocurrencia acordado en la recurrencia.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turnos (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cancha            INTEGER       NOT NULL REFERENCES canchas(id),
  fecha                DATE          NOT NULL,
  hora_inicio          TIME          NOT NULL,
  hora_fin             TIME          NOT NULL,
  tipo_partido         VARCHAR(10)   NOT NULL CHECK (tipo_partido IN ('single', 'double')),
  estado               VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
                                     CHECK (estado IN ('pendiente', 'confirmado', 'cancelado')),
  creado_por           UUID          REFERENCES usuarios(id),
  confirmado_por       UUID          REFERENCES usuarios(id),
  motivo_cancelacion   TEXT,
  -- Contacto para reservas de no-autenticados (creado_por debe ser NULL en ese caso)
  nombre_organizador   VARCHAR(255),
  email_organizador    VARCHAR(255),
  telefono_organizador VARCHAR(50),
  -- Precio total calculado al confirmar
  costo                NUMERIC(10,2) DEFAULT 0,
  -- Vínculo con recurrencia (solo para turnos generados desde turnos_recurrentes)
  id_turno_recurrente  UUID          REFERENCES turnos_recurrentes(id),
  monto_recurrente     NUMERIC(10,2),
  created_at           TIMESTAMPTZ   DEFAULT now(),
  updated_at           TIMESTAMPTZ   DEFAULT now(),
  -- Garantiza que haya organizador autenticado o datos de contacto completos
  CONSTRAINT check_organizer_info CHECK (
    creado_por IS NOT NULL OR
    (nombre_organizador IS NOT NULL AND email_organizador IS NOT NULL AND telefono_organizador IS NOT NULL)
  )
);

-- Exclusión de solapamientos: no se pueden crear dos turnos en la misma cancha
-- que se superpongan en tiempo (excepto cancelados).
ALTER TABLE public.turnos ADD CONSTRAINT turnos_no_overlap
  EXCLUDE USING gist (
    id_cancha WITH =,
    tsrange(
      (fecha + hora_inicio)::timestamp,
      (fecha + hora_fin)::timestamp
    ) WITH &&
  ) WHERE (estado != 'cancelado');

-- -----------------------------------------------------------------------------
-- 2.9 TURNO JUGADORES
-- Un registro por cada jugador en un turno. Soporta socios, no-socios e invitados.
-- monto_generado: tarifa individual (base_tariff / cantidad_jugadores).
-- uso_abono: true si se descontó un crédito del abono del jugador.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turno_jugadores (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno         UUID          NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  id_persona       UUID          REFERENCES usuarios(id),         -- null si es invitado
  tipo_persona     VARCHAR(20)   NOT NULL
                                 CHECK (tipo_persona IN ('socio', 'no_socio', 'invitado')),
  nombre_invitado  VARCHAR(100),                                   -- solo si tipo_persona='invitado'
  monto_generado   NUMERIC(10,2) DEFAULT 0,
  estado_pago      VARCHAR(20)   DEFAULT 'pendiente'
                                 CHECK (estado_pago IN ('pendiente', 'pagado', 'bonificado')),
  uso_abono        BOOLEAN       DEFAULT false,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.10 BLOQUEOS
-- Bloquea franjas horarias de canchas por torneos, clases, mantenimiento, etc.
-- Impide la creación de turnos en esas franjas.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bloqueos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cancha   INTEGER     NOT NULL REFERENCES canchas(id),
  tipo        VARCHAR(30) NOT NULL CHECK (tipo IN ('torneo', 'clase', 'mantenimiento', 'otro')),
  fecha       DATE        NOT NULL,
  hora_inicio TIME        NOT NULL,
  hora_fin    TIME        NOT NULL,
  descripcion TEXT,
  creado_por  UUID        REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.11 PAGOS
-- Libro de cuentas corrientes. Registra cargos, pagos, bonificaciones y devoluciones.
-- Tipos: cargo (deuda generada), pago (dinero recibido), bonificacion, devolucion.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno_jugador UUID          REFERENCES turno_jugadores(id),
  id_socio         UUID          REFERENCES socios(id),
  monto            NUMERIC(10,2) NOT NULL,
  tipo             VARCHAR(20)   NOT NULL
                                 CHECK (tipo IN ('cargo', 'pago', 'bonificacion', 'devolucion')),
  fecha            TIMESTAMPTZ   DEFAULT now(),
  medio            VARCHAR(30),   -- efectivo, transferencia, etc.
  observacion      TEXT,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.12 MOVIMIENTOS RECURRENTES
-- Pagos y bonificaciones asociados a turnos recurrentes.
-- El saldo de una recurrencia se calcula como: pagado − deuda.
-- deuda = SUM(monto_recurrente) de turnos pasados no cancelados.
-- pagado = SUM(monto) de movimientos tipo='pago'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimientos_recurrentes (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_turno_recurrente UUID          NOT NULL REFERENCES turnos_recurrentes(id),
  tipo                VARCHAR(20)   NOT NULL CHECK (tipo IN ('pago', 'bonificacion')),
  monto               NUMERIC(10,2) NOT NULL,
  descripcion         TEXT,
  medio               VARCHAR(50),
  registrado_por      UUID          REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ   DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2.13 CIERRES MENSUALES
-- Snapshot del estado financiero al ejecutar el cierre de cada mes.
-- ingreso_turnos: dinero efectivamente cobrado (pagos.tipo='pago'), no facturado.
-- ingreso_recurrentes: cobros de movimientos_recurrentes.tipo='pago'.
-- detalle_abonos: JSONB con breakdown por tipo de abono.
-- RLS habilitado: solo administradores pueden leer y escribir.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cierres_mensuales (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_anio                DATE          NOT NULL UNIQUE,    -- YYYY-MM-01
  ingreso_abonos          NUMERIC(10,2) NOT NULL DEFAULT 0, -- suma de precios de abonos asignados
  ingreso_turnos          NUMERIC(10,2) NOT NULL DEFAULT 0, -- plata cobrada en turnos
  ingreso_recurrentes     NUMERIC(10,2) NOT NULL DEFAULT 0, -- plata cobrada en recurrentes
  cantidad_socios_con_abono INTEGER      NOT NULL DEFAULT 0,
  detalle_abonos          JSONB,         -- [{tipo_abono_id, nombre, precio, cantidad_socios}]
  ejecutado_por           UUID          REFERENCES usuarios(id),
  created_at              TIMESTAMPTZ   DEFAULT now()
);


-- =============================================================================
-- SECCIÓN 3: ÍNDICES DE PERFORMANCE
-- Optimizados para los patrones de consulta reales de la aplicación.
-- =============================================================================

-- Turnos: admin dashboard consulta estado+fecha constantemente
CREATE INDEX IF NOT EXISTS idx_turnos_estado_fecha
  ON turnos(estado, fecha DESC, hora_inicio DESC);

-- Turnos: búsqueda por cancha y fecha (calendario)
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_cancha
  ON turnos(fecha, id_cancha);

-- Turno jugadores: joins frecuentes
CREATE INDEX IF NOT EXISTS idx_turno_jugadores_turno
  ON turno_jugadores(id_turno);

CREATE INDEX IF NOT EXISTS idx_turno_jugadores_persona
  ON turno_jugadores(id_persona);

-- Usuarios: búsqueda de socios activos (typeahead en formulario de reserva)
CREATE INDEX IF NOT EXISTS idx_usuarios_estado_nombre
  ON usuarios(estado, nombre)
  WHERE estado = 'activo';

-- Usuarios: búsqueda full-text con ILIKE (trigramas) — crítico para autocomplete
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_trgm
  ON usuarios USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni_trgm
  ON usuarios USING gin (dni gin_trgm_ops);

-- Usuarios: lookups directos
CREATE INDEX IF NOT EXISTS idx_usuarios_dni
  ON usuarios(dni);

CREATE INDEX IF NOT EXISTS idx_usuarios_email
  ON usuarios(email);

-- Socios: lookup por tipo de abono
CREATE INDEX IF NOT EXISTS idx_socios_id_tipo_abono
  ON socios(id_tipo_abono)
  WHERE id_tipo_abono IS NOT NULL;

-- Bloqueos
CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha_cancha
  ON bloqueos(fecha, id_cancha);

CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha
  ON bloqueos(fecha DESC);

-- Pagos
CREATE INDEX IF NOT EXISTS idx_pagos_socio
  ON pagos(id_socio);

CREATE INDEX IF NOT EXISTS idx_pagos_turno_jugador
  ON pagos(id_turno_jugador);

CREATE INDEX IF NOT EXISTS idx_pagos_fecha
  ON pagos(fecha DESC);

-- Turnos recurrentes
CREATE INDEX IF NOT EXISTS idx_turnos_recurrentes_socio
  ON turnos_recurrentes(id_socio_responsable);

CREATE INDEX IF NOT EXISTS idx_turnos_recurrentes_cancha_estado
  ON turnos_recurrentes(id_cancha, estado);

CREATE INDEX IF NOT EXISTS idx_turnos_id_turno_recurrente
  ON turnos(id_turno_recurrente)
  WHERE id_turno_recurrente IS NOT NULL;

-- Movimientos recurrentes
CREATE INDEX IF NOT EXISTS idx_movimientos_recurrentes_turno
  ON movimientos_recurrentes(id_turno_recurrente);

-- Actualizar estadísticas del planificador de queries
ANALYZE turnos;
ANALYZE usuarios;
ANALYZE socios;
ANALYZE turno_jugadores;
ANALYZE bloqueos;
ANALYZE pagos;
ANALYZE tipos_abono;
ANALYZE turnos_recurrentes;
ANALYZE movimientos_recurrentes;
ANALYZE config_sistema;


-- =============================================================================
-- SECCIÓN 4: FUNCIONES Y TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 handle_new_user()
-- Crea automáticamente una fila en public.usuarios cuando Supabase Auth
-- registra un nuevo usuario. El nombre se toma del metadata o del email.
-- SECURITY DEFINER: se ejecuta con permisos del creador (postgres), no del usuario.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, rol, estado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'no-socio'),
    'activo'
  );
  RETURN NEW;
END;
$$;

-- Trigger: se activa después de cada INSERT en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SECCIÓN 5: ROW LEVEL SECURITY (RLS)
-- Solo para tablas sensibles. La mayoría de las restricciones se aplican
-- en la capa de aplicación (NestJS guards + roles).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 config_sistema
-- Todos los usuarios autenticados pueden leer.
-- Solo admins pueden insertar, actualizar y eliminar.
-- -----------------------------------------------------------------------------
ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.config_sistema;
CREATE POLICY "Allow read access to authenticated users"
  ON public.config_sistema
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all access to admins" ON public.config_sistema;
CREATE POLICY "Allow all access to admins"
  ON public.config_sistema
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 5.2 cierres_mensuales
-- Solo admins tienen acceso total (lectura y escritura).
-- -----------------------------------------------------------------------------
ALTER TABLE public.cierres_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on cierres_mensuales" ON public.cierres_mensuales;
CREATE POLICY "Admin full access on cierres_mensuales"
  ON public.cierres_mensuales
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );


-- =============================================================================
-- SECCIÓN 6: DATOS BÁSICOS (SEED)
-- Valores mínimos para que el sistema funcione desde el primer día.
-- Ajustar precios y nombres según el club.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 Canchas
-- El club tiene 5 canchas de polvo de ladrillo.
-- Ajustar nombre, superficie y horarios según necesidad.
-- -----------------------------------------------------------------------------
INSERT INTO public.canchas (nombre, superficie, activa, hora_apertura, hora_cierre, tiene_luz)
VALUES
  ('Cancha 1', 'polvo', true, '08:00', '22:30', false),
  ('Cancha 2', 'polvo', true, '08:00', '22:30', false),
  ('Cancha 3', 'polvo', true, '08:00', '22:30', false),
  ('Cancha 4', 'polvo', true, '08:00', '22:30', false),
  ('Cancha 5', 'polvo', true, '08:00', '22:30', false)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6.2 Config sistema
-- Parámetros globales de la aplicación. Claves fijas — no cambiar los nombres.
-- Ajustar los valores (precios, horarios) según el club.
-- -----------------------------------------------------------------------------
INSERT INTO public.config_sistema (clave, valor, descripcion)
VALUES
  -- Precios por jugador según tipo (en pesos ARS)
  ('precio_no_socio',         '2000', 'Tarifa por jugador para no-socios'),
  ('precio_socio_sin_abono',  '1000', 'Tarifa por jugador para socios sin abono'),
  ('precio_socio_abonado',    '500',  'Tarifa por jugador para socios con abono'),
  -- Descuento automático para turnos recurrentes (porcentaje, 0-100)
  ('descuento_recurrente',    '20',   'Descuento en % aplicado a turnos recurrentes'),
  -- Horario general del club (puede sobreescribirse por cancha)
  ('hora_apertura',           '08:00', 'Hora de apertura del club (HH:MM)'),
  ('hora_cierre',             '23:30', 'Hora de cierre del club (HH:MM)'),
  -- Configuración de bloques de tiempo
  ('duracion_bloque',         '30',   'Duración de cada bloque de tiempo en minutos'),
  ('bloques_por_turno',       '3',    'Cantidad de bloques consecutivos por reserva (= 90 min)')
ON CONFLICT (clave) DO UPDATE SET
  valor      = EXCLUDED.valor,
  descripcion = EXCLUDED.descripcion;

-- -----------------------------------------------------------------------------
-- 6.3 Tipos de abono
-- Ajustar nombres, créditos y precios según la oferta del club.
-- color: hex para diferenciación visual en la UI.
-- -----------------------------------------------------------------------------
INSERT INTO public.tipos_abono (nombre, creditos, precio, color)
VALUES
  ('Abono Singles',  8.0, 9000, '#4CAF50'),   -- 8 créditos: 8 partidos singles
  ('Abono Dobles',   8.0, 6000, '#2196F3'),   -- 8 créditos: 16 partidos dobles (0.5 c/u)
  ('Abono Libre',   99.0, 15000, '#9C27B0')   -- créditos ilimitados (prácticamente)
ON CONFLICT (nombre) DO NOTHING;

-- Notificar a PostgREST para refrescar el cache del esquema
NOTIFY pgrst, 'reload schema';
