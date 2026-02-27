-- Migration: Monthly closing snapshots for financial reporting
-- Date: 2026-02-27
-- Description: Creates cierres_mensuales table to store monthly revenue snapshots
--              before clearing all socio abono assignments (month change process)

CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_anio DATE NOT NULL UNIQUE,                  -- first day of month, e.g. '2026-02-01'
  ingreso_abonos NUMERIC(10,2) NOT NULL,          -- sum of tipos_abono.precio for all assigned socios
  ingreso_turnos NUMERIC(10,2) NOT NULL,          -- sum of ABS(monto) from pagos tipo='cargo' in the month
  cantidad_socios_con_abono INTEGER NOT NULL,      -- count of socios with abono at closing time
  detalle_abonos JSONB,                            -- [{tipo_abono_id, nombre, precio, cantidad_socios}]
  ejecutado_por UUID REFERENCES usuarios(id),      -- admin who executed the closing
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE cierres_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on cierres_mensuales"
  ON cierres_mensuales
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );
