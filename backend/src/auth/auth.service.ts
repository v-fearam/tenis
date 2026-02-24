import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async login(loginDto: LoginDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Fetch user profile
    const { data: usuario } = await client
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...usuario,
      },
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
    if (data.user && (registerDto.dni || registerDto.telefono)) {
      await client
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

  async getProfile(userId: string) {
    const client = this.supabaseService.getClient();

    const { data: usuario, error } = await client
      .from('usuarios')
      .select('*, socios(*)')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return usuario;
  }
}
