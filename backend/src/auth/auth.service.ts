import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto, ChangePasswordDto } from './dto/auth.dto';
import { UnauthorizedException, ConflictException, Logger, Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async login(loginDto: LoginDto) {
    const client = this.supabaseService.getClient();

    // Check if account is locked
    const { data: usuario, error: lookupError } = await client
      .from('usuarios')
      .select('*')
      .eq('email', loginDto.email)
      .maybeSingle();

    if (usuario?.is_locked) {
      throw new UnauthorizedException(
        'Cuenta bloqueada por intentos fallidos. Contactá al administrador.',
      );
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      // Increment failed attempts if user exists
      if (usuario) {
        const newAttempts = (usuario.failed_login_attempts || 0) + 1;
        const updateData: any = { failed_login_attempts: newAttempts };
        if (newAttempts >= 5) {
          updateData.is_locked = true;
          updateData.locked_at = new Date().toISOString();
        }
        await client
          .from('usuarios')
          .update(updateData)
          .eq('id', usuario.id);
      }
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset failed attempts on successful login
    if (usuario && usuario.failed_login_attempts > 0) {
      await client
        .from('usuarios')
        .update({ failed_login_attempts: 0 })
        .eq('id', usuario.id);
    }

    // Use the session token to create an authenticated client so RLS works
    const authClient = this.supabaseService.getAuthenticatedClient(
      data.session.access_token,
    );

    this.logger.log(`Login successful for user ${data.user.id}`);

    const { data: profile, error: profileError } = await authClient
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const finalUser = {
      id: data.user.id,
      email: data.user.email,
      nombre: data.user.user_metadata?.nombre,
      rol: data.user.user_metadata?.rol || 'socio',
      ...profile,
    };

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
    if (
      data.user &&
      data.session &&
      (registerDto.dni || registerDto.telefono)
    ) {
      const authClient = this.supabaseService.getAuthenticatedClient(
        data.session.access_token,
      );
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

  async changePassword(user: any, changePasswordDto: ChangePasswordDto, ipAddress?: string) {
    const client = this.supabaseService.getClient();

    // 1. Validate current password (skip if force_password_change)
    if (!user.force_password_change) {
      if (!changePasswordDto.currentPassword) {
        throw new UnauthorizedException('Debe ingresar la contraseña actual');
      }
      const { error: verifyError } = await client.auth.signInWithPassword({
        email: user.email,
        password: changePasswordDto.currentPassword,
      });
      if (verifyError) {
        throw new UnauthorizedException('Contraseña actual incorrecta');
      }
    }

    // 2. Update password in Supabase Auth
    const { error: authError } = await client.auth.admin.updateUserById(user.id, {
      password: changePasswordDto.newPassword,
    });

    if (authError) throw authError;

    // 3. Reset force_password_change flag in usuarios table
    const { error: dbError } = await client
      .from('usuarios')
      .update({
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (dbError) throw dbError;

    // 4. Audit log
    await client
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'password_change',
        details: { forced: !!user.force_password_change },
        ip_address: ipAddress || null,
      });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
