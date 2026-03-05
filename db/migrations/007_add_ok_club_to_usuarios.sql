-- 007_add_ok_club_to_usuarios.sql
-- Add ok_club status to users

ALTER TABLE usuarios ADD COLUMN ok_club BOOLEAN DEFAULT true;
