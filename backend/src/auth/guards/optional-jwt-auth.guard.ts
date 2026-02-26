import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Optional JWT Authentication Guard
 *
 * Unlike JwtAuthGuard, this guard does NOT throw an exception if no token is provided.
 * Instead, it attempts to authenticate the user if a token exists, but allows
 * the request to proceed anonymously if no token is present or if it's invalid.
 *
 * Use this for endpoints that should work for both authenticated and anonymous users.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // If no auth header, allow request to proceed anonymously
    if (!authHeader?.startsWith('Bearer ')) {
      return true;
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verify the token with Supabase Auth
      const client = this.supabaseService.getClient();
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      // If token is invalid, allow request to proceed anonymously
      if (error || !user) {
        return true;
      }

      // Use an authenticated client (with user's JWT) so RLS auth.uid() works
      const authClient = this.supabaseService.getAuthenticatedClient(token);
      const { data: usuario, error: profileError } = await authClient
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();

      // If profile not found, allow request to proceed anonymously
      if (profileError || !usuario) {
        return true;
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
      // On any error, allow request to proceed anonymously
      console.warn('Optional JWT authentication failed:', err.message);
      return true;
    }
  }
}
