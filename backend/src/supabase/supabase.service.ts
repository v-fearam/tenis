import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    this.supabaseKey = this.configService.get<string>('SUPABASE_KEY')!;

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL or SUPABASE_KEY is not defined in environment variables');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  /** Default client (anon key, no user context) – used for auth operations */
  getClient() {
    return this.supabase;
  }

  /**
   * Returns a Supabase client authenticated with the user's JWT.
   * This allows RLS policies using auth.uid() to work correctly.
   */
  getAuthenticatedClient(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
