import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto, UpdateSocioDto, CreateUserDto } from './dto/user.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class UsersService {
  private readonly defaultPageSize: number;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.defaultPageSize = this.configService.get<number>(
      'PAGINATION_PAGE_SIZE',
      20,
    );
  }

  private sanitizeFilter(input: string): string {
    return input.replace(/[%_\\(),.\"']/g, '');
  }

  async findAll(
    paginationDto: PaginationDto,
    accessToken: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Get total count
    const { count, error: countError } = await client
      .from('usuarios')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get paginated data
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*, tipo_abono:tipos_abono(*))')
      .order('nombre')
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return PaginatedResponseDto.create(data || [], page, pageSize, count || 0);
  }

  async count(accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { count, error } = await client
      .from('usuarios')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return { count: count || 0 };
  }

  async findOne(id: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*, tipo_abono:tipos_abono(*))')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  async searchPublic(query: string) {
    // Public searches use the default client (no auth needed, RLS allows it)
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuarios')
      .select('id, nombre, email, dni')
      .eq('estado', 'activo')
      .or(
        `nombre.ilike.%${this.sanitizeFilter(query)}%,dni.ilike.%${this.sanitizeFilter(query)}%,email.ilike.%${this.sanitizeFilter(query)}%`,
      )
      .order('nombre')
      .limit(10);

    if (error) throw error;
    return data;
  }

  async search(
    query: string,
    paginationDto: PaginationDto,
    accessToken: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;
    const sanitized = this.sanitizeFilter(query);
    const searchFilter = `nombre.ilike.%${sanitized}%,dni.ilike.%${sanitized}%,telefono.ilike.%${sanitized}%,email.ilike.%${sanitized}%`;

    // Get total count for search
    const { count, error: countError } = await client
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .or(searchFilter);

    if (countError) throw countError;

    // Get paginated search results
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*, tipo_abono:tipos_abono(*))')
      .or(searchFilter)
      .order('nombre')
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return PaginatedResponseDto.create(data || [], page, pageSize, count || 0);
  }

  async create(createUserDto: CreateUserDto) {
    const client = this.supabaseService.getClient();

    // Create user in Supabase Auth (trigger will create usuarios row)
    const { data: authData, error: authError } =
      await client.auth.admin.createUser({
        email: createUserDto.email,
        password: createUserDto.password,
        email_confirm: true,
        user_metadata: {
          nombre: createUserDto.nombre,
          rol: createUserDto.rol || 'socio',
        },
      });

    if (authError) {
      if (authError.message.includes('already')) {
        throw new ConflictException('El email ya está registrado');
      }
      throw authError;
    }

    // Update additional fields — we need a workaround since we don't have a user token yet
    // The admin.createUser doesn't give us a session, so we use the default client
    // and rely on the trigger having already created the row
    if (createUserDto.dni || createUserDto.telefono) {
      await client
        .from('usuarios')
        .update({
          dni: createUserDto.dni,
          telefono: createUserDto.telefono,
          rol: createUserDto.rol || 'socio',
        })
        .eq('id', authData.user.id);
    }

    // If socio, create socios row
    if ((createUserDto.rol || 'socio') === 'socio') {
      await client.from('socios').insert({
        id_usuario: authData.user.id,
        activo: true,
      });
    }

    // Return the created user (use admin client for the read)
    const { data: newUser } = await client
      .from('usuarios')
      .select('*, socios(*, tipo_abono:tipos_abono(*))')
      .eq('id', authData.user.id)
      .single();

    return newUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from('usuarios')
      .update({
        ...updateUserDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, socios(*, tipo_abono:tipos_abono(*))')
      .single();

    if (error) throw error;
    return data;
  }

  async updateSocio(
    userId: string,
    updateSocioDto: UpdateSocioDto,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: existing } = await client
      .from('socios')
      .select('*')
      .eq('id_usuario', userId)
      .single();

    if (!existing) {
      const { data, error } = await client
        .from('socios')
        .insert({
          id_usuario: userId,
          ...updateSocioDto,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from('socios')
      .update({
        ...updateSocioDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id_usuario', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { error } = await client
      .from('usuarios')
      .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { message: 'Usuario desactivado' };
  }

  async getDashboardData(userId: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // Use Argentina timezone for date/time comparisons
    const timeZone = 'America/Argentina/Buenos_Aires';
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const nowDate = dateFormatter.format(new Date());
    const nowTime = timeFormatter.format(new Date());

    // 1. Find turno IDs where this user is a player
    const { data: jugadas, error: jugadasError } = await client
      .from('turno_jugadores')
      .select('id_turno')
      .eq('id_persona', userId);

    if (jugadasError) throw jugadasError;

    const turnoIds = (jugadas || []).map((j: any) => j.id_turno);
    let nextMatch = null;

    if (turnoIds.length > 0) {
      // 2. Fetch next confirmed match from those turnos
      const { data: turnos, error: turnosError } = await client
        .from('turnos')
        .select('id, fecha, hora_inicio, type:tipo_partido, canchas:id_cancha (nombre)')
        .in('id', turnoIds)
        .eq('estado', 'confirmado')
        .or(
          `fecha.gt.${nowDate},and(fecha.eq.${nowDate},hora_inicio.gte.${nowTime})`,
        )
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(1);

      if (turnosError) throw turnosError;
      nextMatch = turnos?.[0] || null;
    }

    // 2. Fetch membership (socio + tipo_abono)
    const { data: socio } = await client
      .from('socios')
      .select(
        `
        id,
        nro_socio,
        id_tipo_abono,
        creditos_disponibles,
        tipos_abono:id_tipo_abono (id, nombre, creditos, precio, color)
      `,
      )
      .eq('id_usuario', userId)
      .single();

    let abono: {
      tipo: string;
      creditos_totales: number;
      creditos_disponibles: number;
      color: string | null;
    } | null = null;

    if (socio?.tipos_abono) {
      const tipo = socio.tipos_abono as any;
      abono = {
        tipo: tipo.nombre,
        creditos_totales: tipo.creditos,
        creditos_disponibles: socio.creditos_disponibles ?? 0,
        color: tipo.color || null,
      };
    }

    // Determine membership status for the user
    const isSocio = !!socio;

    return {
      nextMatch,
      abono,
      isSocio,
    };
  }
}
