import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AssignAbonoDto, CreateAbonoTypeDto, UpdateAbonoTypeDto } from './dto/abono.dto';

@Injectable()
export class AbonosService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- TYPES CRUD ---

    async findAllTypes(accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('tipos_abono')
            .select('*')
            .order('precio', { ascending: true });

        if (error) throw error;
        return data;
    }

    async createType(dto: CreateAbonoTypeDto, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('tipos_abono')
            .insert({
                ...dto,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateType(id: string, dto: UpdateAbonoTypeDto, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('tipos_abono')
            .update({
                ...dto,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deleteType(id: string, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { error } = await client
            .from('tipos_abono')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { message: 'Tipo de abono eliminado' };
    }

    // --- ASSIGNMENT ---

    async findAll(accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('abonos')
            .select('*, socio:socios(*, usuario:usuarios(*))')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async assign(dto: AssignAbonoDto, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);

        // 1. Fetch tier config from DB
        const { data: tier, error: tierError } = await client
            .from('tipos_abono')
            .select('*')
            .eq('nombre', dto.tipo)
            .maybeSingle();

        if (tierError || !tier) throw new BadRequestException(`Tipo de abono "${dto.tipo}" no encontrado`);

        // 2. Check if socio already has an abono for this month
        const { data: existing } = await client
            .from('abonos')
            .select('*')
            .eq('id_socio', dto.socio_id)
            .eq('mes_anio', dto.mes_anio)
            .eq('activo', true)
            .maybeSingle();

        if (existing) {
            // Update existing
            const { data, error } = await client
                .from('abonos')
                .update({
                    tipo: dto.tipo,
                    creditos_totales: tier.creditos,
                    creditos_disponibles: tier.creditos,
                    precio_lista_mes: tier.precio,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        }

        // 3. Create new
        const { data, error } = await client
            .from('abonos')
            .insert({
                id_socio: dto.socio_id,
                mes_anio: dto.mes_anio,
                tipo: dto.tipo,
                creditos_totales: tier.creditos,
                creditos_disponibles: tier.creditos,
                precio_lista_mes: tier.precio,
                activo: true,
                fecha_alta: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async consumeCredit(socioId: string, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const { data: abono, error } = await client
            .from('abonos')
            .select('*')
            .eq('id_socio', socioId)
            .eq('mes_anio', monthStart)
            .eq('activo', true)
            .maybeSingle();

        if (error || !abono) return false;

        if (abono.creditos_disponibles <= 0) return false;

        const { error: updateError } = await client
            .from('abonos')
            .update({
                creditos_disponibles: abono.creditos_disponibles - 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', abono.id);

        if (updateError) throw updateError;
        return true;
    }
}
