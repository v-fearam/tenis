import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify the token with Supabase Auth
      const client = this.supabaseService.getClient();
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      // Use an authenticated client (with user's JWT) so RLS auth.uid() works
      const authClient = this.supabaseService.getAuthenticatedClient(token);
      const { data: usuario, error: profileError } = await authClient
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !usuario) {
        throw new UnauthorizedException('Perfil de usuario no encontrado');
      }

      // Attach user data and token to request for downstream use
      request.user = {
        id: user.id,
        email: user.email,
        ...usuario,
      };
      request.accessToken = token;

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Error de autenticación');
    }
  }
}
