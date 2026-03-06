-- Seed: cierres_mensuales (datos de prueba para dashboard Finanzas)
-- Meses: Dic 2025, Ene 2026, Feb 2026
-- Ejecutar solo en dev. Requiere que exista al menos un usuario admin en auth.users.

INSERT INTO cierres_mensuales (mes_anio, ingreso_turnos, ingreso_abonos, ingreso_recurrentes, cantidad_socios_con_abono, detalle_abonos, ejecutado_por)
VALUES
  (
    '2025-12-01',
    185000,
    72000,
    24000,
    8,
    '[{"tipo_abono_id":"seed-1","nombre":"Abono Singles","precio":9000,"cantidad_socios":4},{"tipo_abono_id":"seed-2","nombre":"Abono Dobles","precio":6000,"cantidad_socios":4}]'::jsonb,
    (SELECT id FROM auth.users LIMIT 1)
  ),
  (
    '2026-01-01',
    210000,
    81000,
    31500,
    9,
    '[{"tipo_abono_id":"seed-1","nombre":"Abono Singles","precio":9000,"cantidad_socios":5},{"tipo_abono_id":"seed-2","nombre":"Abono Dobles","precio":6000,"cantidad_socios":4}]'::jsonb,
    (SELECT id FROM auth.users LIMIT 1)
  ),
  (
    '2026-02-01',
    228000,
    90000,
    38000,
    10,
    '[{"tipo_abono_id":"seed-1","nombre":"Abono Singles","precio":9000,"cantidad_socios":6},{"tipo_abono_id":"seed-2","nombre":"Abono Dobles","precio":6000,"cantidad_socios":4}]'::jsonb,
    (SELECT id FROM auth.users LIMIT 1)
  )
ON CONFLICT (mes_anio) DO NOTHING;
