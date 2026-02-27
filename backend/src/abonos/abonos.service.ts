import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AssignAbonoDto,
  CreateAbonoTypeDto,
  UpdateAbonoTypeDto,
} from './dto/abono.dto';

@Injectable()
export class AbonosService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

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
        updated_at: new Date().toISOString(),
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteType(id: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // Check if any socio has this type assigned
    const { count } = await client
      .from('socios')
      .select('*', { count: 'exact', head: true })
      .eq('id_tipo_abono', id);

    if (count && count > 0) {
      throw new BadRequestException(
        `No se puede eliminar: hay ${count} socio(s) con este abono asignado`,
      );
    }

    const { error } = await client.from('tipos_abono').delete().eq('id', id);

    if (error) throw error;
    return { message: 'Tipo de abono eliminado' };
  }

  // --- ASSIGNMENT ---

  async assign(dto: AssignAbonoDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // 1. Fetch tipo_abono to get credits
    const { data: tipo, error: tipoError } = await client
      .from('tipos_abono')
      .select('*')
      .eq('id', dto.tipo_abono_id)
      .single();

    if (tipoError || !tipo) {
      throw new BadRequestException('Tipo de abono no encontrado');
    }

    // 2. Update socio with FK and credits
    const { data, error } = await client
      .from('socios')
      .update({
        id_tipo_abono: dto.tipo_abono_id,
        creditos_disponibles: tipo.creditos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.socio_id)
      .select('*, tipo_abono:tipos_abono(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async consumeCredit(socioId: string, accessToken: string): Promise<boolean> {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: socio, error } = await client
      .from('socios')
      .select('id, id_tipo_abono, creditos_disponibles')
      .eq('id', socioId)
      .single();

    if (
      error ||
      !socio ||
      !socio.id_tipo_abono ||
      socio.creditos_disponibles <= 0
    ) {
      return false;
    }

    const { error: updateError } = await client
      .from('socios')
      .update({
        creditos_disponibles: socio.creditos_disponibles - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', socioId);

    if (updateError) throw updateError;
    return true;
  }

  async removeAbono(socioId: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from('socios')
      .update({
        id_tipo_abono: null,
        creditos_disponibles: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', socioId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
