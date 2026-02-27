-- Migration: Drop unused abonos table
-- Date: 2026-02-27
-- Description: The original abonos table (monthly subscriptions) was replaced by
-- the tipos_abono + socios.id_tipo_abono + socios.creditos_disponibles system.
-- No code references .from('abonos') anywhere. Safe to drop.

DROP TABLE IF EXISTS abonos CASCADE;
