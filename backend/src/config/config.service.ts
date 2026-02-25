import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ConfigService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const { data, error } = await this.supabaseService.getClient()
            .from('config_sistema')
            .select('*')
            .order('clave', { ascending: true });

        if (error) throw error;
        return data;
    }

    async findByKey(clave: string) {
        const { data, error } = await this.supabaseService.getClient()
            .from('config_sistema')
            .select('*')
            .eq('clave', clave)
            .single();

        if (error || !data) throw new NotFoundException(`Configuración ${clave} no encontrada`);
        return data;
    }

    async update(clave: string, valor: string, descripcion?: string) {
        const { data, error } = await this.supabaseService.getClient()
            .from('config_sistema')
            .update({ valor, descripcion, updated_at: new Date().toISOString() })
            .eq('clave', clave)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}
