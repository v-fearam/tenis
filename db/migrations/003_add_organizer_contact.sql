-- Migration: Add organizer contact information for non-authenticated bookings
-- Date: 2026-02-26
-- Description: Adds optional contact fields for organizers who are not registered users

-- Add contact information columns to turnos table
ALTER TABLE turnos
ADD COLUMN IF NOT EXISTS nombre_organizador VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_organizador VARCHAR(255),
ADD COLUMN IF NOT EXISTS telefono_organizador VARCHAR(50);

-- Add comment to document the purpose
COMMENT ON COLUMN turnos.nombre_organizador IS 'Contact name for non-authenticated booking organizers';
COMMENT ON COLUMN turnos.email_organizador IS 'Contact email for non-authenticated booking organizers';
COMMENT ON COLUMN turnos.telefono_organizador IS 'Contact phone for non-authenticated booking organizers';

-- Add a check constraint to ensure either authenticated user OR contact info is provided
ALTER TABLE turnos
ADD CONSTRAINT check_organizer_info
CHECK (
  creado_por IS NOT NULL OR
  (nombre_organizador IS NOT NULL AND email_organizador IS NOT NULL AND telefono_organizador IS NOT NULL)
);
