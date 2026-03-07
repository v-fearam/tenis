import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class ConfigService {
  private cache: { data: any[] | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const now = Date.now();
    if (this.cache.data && now - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.data;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('config_sistema')
      .select('*')
      .order('clave', { ascending: true });

    if (error) throw error;
    this.cache = { data, timestamp: now };
    return data;
  }

  async findByKey(clave: string) {
    const all = await this.findAll();
    const item = all?.find((c: any) => c.clave === clave);
    if (!item)
      throw new NotFoundException(`Configuración ${clave} no encontrada`);
    return item;
  }

  async update(clave: string, valor: string, descripcion?: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('config_sistema')
      .update({ valor, descripcion, updated_at: new Date().toISOString() })
      .eq('clave', clave)
      .select()
      .single();

    if (error) throw error;
    // Invalidate cache on update
    this.cache = { data: null, timestamp: 0 };
    return data;
  }
}
