import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly clientCache = new Map<string, SupabaseClient>();

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    this.supabaseKey = this.configService.get<string>('SUPABASE_KEY')!;

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(
        'SUPABASE_URL or SUPABASE_KEY is not defined in environment variables',
      );
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  /** Default client (service role key, no user context) – used for auth operations */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Returns a Supabase client authenticated with the user's JWT if provided,
   * otherwise returns the default client.
   */
  getOptionalClient(accessToken?: string): SupabaseClient {
    if (accessToken) {
      return this.getAuthenticatedClient(accessToken);
    }
    return this.getClient();
  }

  /**
   * Returns a Supabase client authenticated with the user's JWT.
   * Caches clients per token to avoid creating a new client on every call
   * within the same request (guard + service both call this).
   */
  getAuthenticatedClient(accessToken: string): SupabaseClient {
    const cached = this.clientCache.get(accessToken);
    if (cached) return cached;

    const client = createClient(this.supabaseUrl, this.supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    this.clientCache.set(accessToken, client);

    // Evict after 5 minutes to prevent memory leaks from expired tokens
    setTimeout(() => this.clientCache.delete(accessToken), 5 * 60 * 1000);

    return client;
  }
}
