export type UserRole = 'admin' | 'socio' | 'no-socio';
export type EstadoUsuario = 'activo' | 'inactivo';

export interface Usuario {
  id: string;
  nombre: string | null;
  dni: string | null;
  telefono: string | null;
  email: string;
  rol: UserRole;
  estado: EstadoUsuario;
  force_password_change: boolean;
  ok_club: boolean;
  failed_login_attempts?: number;
  is_locked?: boolean;
  locked_at?: string | null;
  created_at: string;
  socios?: Socio[];
}

export interface Socio {
  id: string;
  id_usuario: string;
  nro_socio: number;
  activo: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: Usuario;
}

export interface CreateUserPayload {
  nombre: string;
  email: string;
  password: string;
  dni?: string;
  telefono?: string;
  rol?: UserRole;
  force_password_change?: boolean;
  ok_club?: boolean;
}

export interface UpdateUserPayload {
  nombre?: string;
  dni?: string;
  telefono?: string;
  rol?: UserRole;
  estado?: EstadoUsuario;
  force_password_change?: boolean;
  ok_club?: boolean;
  password?: string;
  is_locked?: boolean;
}
