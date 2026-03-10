import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto, UpdateSocioDto, CreateUserDto } from './dto/user.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { HistoryQueryDto } from './dto/history-query.dto';

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
    const rol = createUserDto.rol || 'socio';
    // No-socios always have ok_club = false
    const ok_club = rol === 'no-socio' ? false : (createUserDto.ok_club ?? true);
    if (createUserDto.dni || createUserDto.telefono || rol === 'no-socio') {
      await client
        .from('usuarios')
        .update({
          dni: createUserDto.dni,
          telefono: createUserDto.telefono,
          rol,
          force_password_change: createUserDto.force_password_change || false,
          ok_club,
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
    const adminClient = this.supabaseService.getClient();

    // Sync Auth metadata if role is updated, or update password if provided
    if (updateUserDto.rol || updateUserDto.password) {
      const authUpdate: any = {};
      if (updateUserDto.rol) authUpdate.user_metadata = { rol: updateUserDto.rol };
      if (updateUserDto.password) authUpdate.password = updateUserDto.password;

      const { error: authError } = await adminClient.auth.admin.updateUserById(
        id,
        authUpdate,
      );
      if (authError) throw authError;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, is_locked, ...dbUpdateData } = updateUserDto;

    // Auto-reset lockout fields when unlocking
    if (is_locked === false) {
      (dbUpdateData as any).is_locked = false;
      (dbUpdateData as any).failed_login_attempts = 0;
      (dbUpdateData as any).locked_at = null;
    }

    // No-socios always have ok_club = false
    if (dbUpdateData.rol === 'no-socio') {
      dbUpdateData.ok_club = false;
    }

    const { data, error } = await client
      .from('usuarios')
      .update({
        ...dbUpdateData,
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
      // 2. Fetch next match (pendiente or confirmado) from those turnos
      const { data: turnos, error: turnosError } = await client
        .from('turnos')
        .select('id, fecha, hora_inicio, type:tipo_partido, estado, canchas:id_cancha (nombre)')
        .in('id', turnoIds)
        .in('estado', ['confirmado', 'pendiente'])
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
        tipos_abono:id_tipo_abono (id, nombre, creditos, precio, color),
        usuarios:id_usuario (ok_club)
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
    const okClub = (socio as any)?.usuarios?.ok_club ?? true;

    return {
      nextMatch,
      abono,
      isSocio,
      ok_club: okClub,
    };
  }

  async getHistory(userId: string, query: HistoryQueryDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const page = query.page || 1;
    const pageSize = query.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Default date range: last 2 months → next 30 days (includes upcoming confirmed bookings)
    const today = new Date();
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const thirtyDaysAhead = new Date(today);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const fechaHasta = query.fecha_hasta || thirtyDaysAhead.toISOString().slice(0, 10);
    const fechaDesde = query.fecha_desde || twoMonthsAgo.toISOString().slice(0, 10);

    // 1. Deuda total (sin límite de fecha) — incluye pendientes y confirmados
    const { data: debtData } = await client
      .from('turno_jugadores')
      .select('monto_generado, turnos!inner(estado)')
      .eq('id_persona', userId)
      .eq('estado_pago', 'pendiente')
      .gt('monto_generado', 0)
      .in('turnos.estado', ['confirmado', 'pendiente']);

    const deuda_total =
      debtData?.reduce((sum: number, d: any) => sum + Number(d.monto_generado), 0) ?? 0;

    // 2. Historial paginado (pendientes y confirmados)
    const { data, count, error } = await client
      .from('turno_jugadores')
      .select(
        `
        id, monto_generado, estado_pago, uso_abono,
        turnos!inner(id, fecha, hora_inicio, hora_fin, tipo_partido, estado,
          canchas(nombre)
        )
      `,
        { count: 'exact' },
      )
      .eq('id_persona', userId)
      .in('turnos.estado', ['confirmado', 'pendiente'])
      .gte('turnos.fecha', fechaDesde)
      .lte('turnos.fecha', fechaHasta)
      .order('fecha', { referencedTable: 'turnos', ascending: false })
      .order('hora_inicio', { referencedTable: 'turnos', ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const items = (data || []).map((row: any) => ({
      turno_jugador_id: row.id,
      turno_id: row.turnos?.id,
      fecha: row.turnos?.fecha,
      hora_inicio: row.turnos?.hora_inicio,
      hora_fin: row.turnos?.hora_fin,
      cancha_nombre: row.turnos?.canchas?.nombre,
      tipo_partido: row.turnos?.tipo_partido,
      estado_turno: row.turnos?.estado,
      monto_generado: Number(row.monto_generado),
      estado_pago: row.estado_pago,
      uso_abono: row.uso_abono,
    }));

    return {
      deuda_total,
      turnos: PaginatedResponseDto.create(items, page, pageSize, count || 0),
    };
  }

  async getHistoryDetail(
    userId: string,
    turnoId: string,
    turnoJugadorId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // Co-jugadores del turno
    const { data: players, error: playersError } = await client
      .from('turno_jugadores')
      .select('tipo_persona, nombre_invitado, usuarios(nombre)')
      .eq('id_turno', turnoId)
      .neq('id_persona', userId);

    if (playersError) throw playersError;

    // Info de pago del usuario actual (si existe)
    const { data: pagos } = await client
      .from('pagos')
      .select('fecha, medio, observacion')
      .eq('id_turno_jugador', turnoJugadorId)
      .eq('tipo', 'pago')
      .order('fecha', { ascending: false })
      .limit(1);

    const jugadores = (players || []).map((p: any) => ({
      nombre: p.nombre_invitado || p.usuarios?.nombre || 'Invitado',
      tipo_persona: p.tipo_persona,
    }));

    const pago_info =
      pagos && pagos.length > 0
        ? {
            fecha: pagos[0].fecha,
            medio: pagos[0].medio,
            observacion: pagos[0].observacion,
          }
        : null;

    return { jugadores, pago_info };
  }
}
