-- Manually execute this in Supabase SQL Editor if the automated migration fails

-- Create system configuration table
CREATE TABLE IF NOT EXISTS public.config_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.config_sistema;
CREATE POLICY "Allow read access to authenticated users" 
ON public.config_sistema FOR SELECT 
TO authenticated 
USING (true);

-- Allow all access to admins
DROP POLICY IF EXISTS "Allow all access to admins" ON public.config_sistema;
CREATE POLICY "Allow all access to admins" 
ON public.config_sistema FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id = auth.uid() AND rol = 'admin'
    )
);

-- Seed initial data
INSERT INTO public.config_sistema (clave, valor, descripcion) VALUES
('hora_apertura', '08:00', 'Hora de apertura del club (HH:MM)'),
('hora_cierre', '23:30', 'Hora de cierre del club (HH:MM)'),
('duracion_bloque', '30', 'Duración de cada bloque de tiempo en minutos'),
('bloques_por_turno', '3', 'Cantidad de bloques consecutivos para una reserva')
ON CONFLICT (clave) DO UPDATE SET
valor = EXCLUDED.valor,
descripcion = EXCLUDED.descripcion;

-- Also ensure 'no-socio' role is allowed in constraints (if not already)
-- ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
-- ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'socio', 'no-socio'));
