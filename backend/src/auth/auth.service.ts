import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async login(loginDto: LoginDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Use the session token to create an authenticated client so RLS works
    const authClient = this.supabaseService.getAuthenticatedClient(data.session.access_token);

    console.log('Login successful for:', data.user.id);

    const { data: usuario, error: profileError } = await authClient
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const finalUser = {
      id: data.user.id,
      email: data.user.email,
      nombre: data.user.user_metadata?.nombre,
      rol: data.user.user_metadata?.rol || 'socio',
      ...usuario,
    };

    console.log('Final user object being returned:', finalUser);

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: finalUser,
    };
  }

  async register(registerDto: RegisterDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        data: {
          nombre: registerDto.nombre,
          rol: 'socio',
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }

    // Update additional fields if provided
    if (data.user && data.session && (registerDto.dni || registerDto.telefono)) {
      const authClient = this.supabaseService.getAuthenticatedClient(data.session.access_token);
      await authClient
        .from('usuarios')
        .update({
          dni: registerDto.dni,
          telefono: registerDto.telefono,
        })
        .eq('id', data.user.id);
    }

    return {
      message: 'Registro exitoso',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    };
  }

  async refresh(refreshToken: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const authClient = this.supabaseService.getAuthenticatedClient(
      data.session.access_token,
    );

    const { data: usuario, error: profileError } = await authClient
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !usuario) {
      throw new UnauthorizedException('Perfil de usuario no encontrado');
    }

    const finalUser = {
      id: data.user.id,
      email: data.user.email,
      nombre: data.user.user_metadata?.nombre,
      rol: data.user.user_metadata?.rol || 'socio',
      ...usuario,
    };

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: finalUser,
    };
  }

  async getProfile(userId: string, accessToken: string) {
    // Use authenticated client so RLS auth.uid() resolves correctly
    const authClient = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: usuario, error } = await authClient
      .from('usuarios')
      .select('*, socios(*)')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return usuario;
  }
}
