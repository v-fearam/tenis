import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';

@Injectable()
export class CanchasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll(accessToken?: string) {
        const client = this.supabaseService.getOptionalClient(accessToken);
        const { data, error } = await client
            .from('canchas')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        return data;
    }

    async create(createCanchaDto: CreateCanchaDto, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('canchas')
            .insert([createCanchaDto])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: number, updateCanchaDto: UpdateCanchaDto, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('canchas')
            .update(updateCanchaDto)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async remove(id: number, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { error } = await client
            .from('canchas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { message: 'Cancha eliminada correctamente' };
    }
}
