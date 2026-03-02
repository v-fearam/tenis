import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AbonosService } from '../abonos/abonos.service';
import { CreateBookingDto, BookingStatus, MatchType } from './dto/booking.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

// Fallback defaults if database config is missing
const DEFAULT_PRICES = {
  price_socio_libre: 0,
  price_socio_partidos: 500,
  price_socio_sin_abono: 1000,
  price_no_socio: 2000,
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly defaultPageSize: number;

  // In-memory price cache with TTL (5 minutes)
  private priceCache: {
    prices: Record<string, number>;
    expiresAt: number;
  } | null = null;
  private static readonly PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly abonosService: AbonosService,
    private readonly configService: ConfigService,
  ) {
    this.defaultPageSize = this.configService.get<number>(
      'PAGINATION_PAGE_SIZE',
      20,
    );
  }

  async create(
    createBookingDto: CreateBookingDto,
    creatorId: string | null,
    accessToken: string | null,
  ) {
    this.logger.log(`Creating booking for user: ${creatorId || 'anonymous'}`);

    const client = this.supabaseService.getOptionalClient(
      accessToken || undefined,
    );

    // Use a consistent timezone for all calculations (Argentina)
    const timeZone = 'America/Argentina/Buenos_Aires';

    const startDate = new Date(createBookingDto.start_time);
    const endDate = new Date(createBookingDto.end_time);

    // Extract date and time in Argentina timezone
    const dFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const tFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const fecha = dFmt.format(startDate); // YYYY-MM-DD
    const hora_inicio = tFmt.format(startDate); // HH:mm
    const hora_fin = tFmt.format(endDate); // HH:mm

    // Validate that the booking is in the future
    if (startDate < new Date()) {
      throw new ConflictException(
        'No se pueden realizar reservas para fechas u horarios pasados.',
      );
    }

    // Fetch court schedule
    const { data: court, error: courtError } = await client
      .from('canchas')
      .select('hora_apertura, hora_cierre')
      .eq('id', createBookingDto.court_id)
      .single();

    if (courtError || !court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    // Validate hours (normalization to HH:mm for both sides)
    const openStr = court.hora_apertura.substring(0, 5);
    const closeStr = court.hora_cierre.substring(0, 5);

    if (hora_inicio < openStr || hora_fin > closeStr) {
      throw new ConflictException(
        `La cancha seleccionada solo está disponible entre las ${openStr} y las ${closeStr}hs.`,
      );
    }

    const { data: booking, error: bookingError } = await client
      .from('turnos')
      .insert({
        id_cancha: createBookingDto.court_id,
        fecha: fecha,
        hora_inicio: hora_inicio,
        hora_fin: hora_fin,
        tipo_partido: createBookingDto.type,
        estado: 'pendiente',
        creado_por: creatorId,
        // Store organizer contact info if not authenticated
        ...(!creatorId
          ? {
            nombre_organizador: createBookingDto.organizer_name,
            email_organizador: createBookingDto.organizer_email,
            telefono_organizador: createBookingDto.organizer_phone,
          }
          : {}),
      })
      .select()
      .single();

    if (bookingError) {
      this.logger.error('Error inserting booking into turnos', bookingError);
      if (bookingError.code === '23P01') {
        throw new ConflictException(
          'Esta cancha ya se encuentra reservada para el horario seleccionado.',
        );
      }
      throw new InternalServerErrorException(
        'Error al crear el turno en la base de datos',
      );
    }

    const players = createBookingDto.players.map((p) => ({
      id_turno: booking.id,
      id_persona: p.user_id || null,
      nombre_invitado: p.guest_name || null,
      tipo_persona: p.user_id ? 'socio' : 'invitado',
    }));

    const { data: insertedPlayers, error: playersError } = await client
      .from('turno_jugadores')
      .insert(players)
      .select();

    if (playersError) {
      this.logger.error(
        'Error inserting players into turno_jugadores',
        playersError,
      );
      throw new InternalServerErrorException(
        'Error al registrar los jugadores del turno',
      );
    }

    // Calculate cost and consume abono credits at creation time
    const costo = await this.calculateAndApplyCosts(
      insertedPlayers,
      client,
    );

    // Update turno with calculated cost
    const { error: costoError } = await client
      .from('turnos')
      .update({ costo })
      .eq('id', booking.id);

    if (costoError) {
      this.logger.error(`Error updating costo on turno: ${JSON.stringify(costoError)}`);
    }

    return this.mapToFrontendStructure({
      ...booking,
      costo,
      turno_jugadores: insertedPlayers,
    });
  }

  async findAll(
    paginationDto: PaginationDto,
    accessToken?: string,
    status?: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getOptionalClient(accessToken);
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Map frontend status to DB estado
    const estadoMap: Record<string, string> = {
      pending: 'pendiente',
      confirmed: 'confirmado',
      cancelled: 'cancelado',
    };
    const dbEstado = status ? estadoMap[status] : undefined;

    // Get total count
    let countQuery = client
      .from('turnos')
      .select('*', { count: 'exact', head: true });
    if (dbEstado) countQuery = countQuery.eq('estado', dbEstado);
    if (fechaDesde) countQuery = countQuery.gte('fecha', fechaDesde);
    if (fechaHasta) countQuery = countQuery.lte('fecha', fechaHasta);

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    // Get paginated data
    let dataQuery = client
      .from('turnos')
      .select(
        '*, canchas(*), turno_jugadores(*), solicitante:usuarios!turnos_creado_por_fkey(nombre)',
      )
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (dbEstado) dataQuery = dataQuery.eq('estado', dbEstado);
    if (fechaDesde) dataQuery = dataQuery.gte('fecha', fechaDesde);
    if (fechaHasta) dataQuery = dataQuery.lte('fecha', fechaHasta);

    const { data, error } = await dataQuery;

    if (error) throw error;

    const mappedData = (data || []).map((b) => this.mapToFrontendStructure(b));
    return PaginatedResponseDto.create(mappedData, page, pageSize, count || 0);
  }

  async findActive(
    paginationDto: PaginationDto,
    accessToken: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    const timeZone = 'America/Argentina/Buenos_Aires';
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = dateFormatter.format(new Date());

    // Get total count for active bookings
    const { count, error: countError } = await client
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'confirmado')
      .gte('fecha', today);

    if (countError) throw countError;

    // Get paginated data
    const { data, error } = await client
      .from('turnos')
      .select(
        '*, canchas(*), turno_jugadores(*), solicitante:usuarios!turnos_creado_por_fkey(nombre)',
      )
      .eq('estado', 'confirmado')
      .gte('fecha', today)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const mappedData = (data || []).map((b) => this.mapToFrontendStructure(b));
    return PaginatedResponseDto.create(mappedData, page, pageSize, count || 0);
  }

  async confirm(bookingId: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const rawBooking = await this.findRawBookingWithPlayers(
      bookingId,
      accessToken,
    );

    // Update booking status
    const { error: updateError } = await client
      .from('turnos')
      .update({ estado: 'confirmado' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Generate debt entries from pre-calculated player costs
    await this.generatePlayerDebtsFromPrecalculated(
      rawBooking,
      client,
    );

    return this.mapToFrontendStructure(rawBooking);
  }

  async cancel(bookingId: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: booking, error: fetchError } = await client
      .from('turnos')
      .select('id, estado')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    // Refund abono credits for players that used them (single query + atomic batch refund)
    const { data: playersWithAbono, error: abonoQueryError } = await client
      .from('turno_jugadores')
      .select('id_persona')
      .eq('id_turno', bookingId)
      .eq('uso_abono', true);

    if (abonoQueryError) {
      this.logger.error(`Error querying turno_jugadores for refund: ${JSON.stringify(abonoQueryError)}`);
    }

    const playerIds = (playersWithAbono || [])
      .map((p: any) => p.id_persona)
      .filter(Boolean);

    this.logger.log(`Cancel refund: found ${playerIds.length} players with uso_abono=true for turno ${bookingId}`);

    if (playerIds.length > 0) {
      const { data: refunded, error: refundError } = await client.rpc(
        'refund_abono_credits',
        { p_user_ids: playerIds },
      );

      if (refundError) {
        this.logger.error(`Error batch-refunding credits: ${JSON.stringify(refundError)}`);
      } else {
        this.logger.log(`Refunded credits for ${refunded} socios`);
      }
    }

    const { error: updateError } = await client
      .from('turnos')
      .update({ estado: 'cancelado' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    return { id: bookingId, status: 'cancelado' };
  }

  /**
   * Lightweight query for calendar: returns only fields needed to render slots.
   * Single query, no count, no joins to turno_jugadores/usuarios.
   */
  async findByDateForCalendar(fecha: string, accessToken?: string) {
    const client = this.supabaseService.getOptionalClient(accessToken);
    const { data, error } = await client
      .from('turnos')
      .select('id, id_cancha, fecha, hora_inicio, hora_fin, estado')
      .eq('fecha', fecha)
      .neq('estado', 'cancelado');

    if (error) {
      this.logger.error('Error fetching bookings for calendar', error);
      throw error;
    }

    // Argentina timezone offset for correct UTC conversion
    const AR_OFFSET = '-03:00';

    return (data || []).map((b: any) => {
      let startTime = '';
      let endTime = '';
      try {
        const timePart =
          b.hora_inicio.split(':').length === 2
            ? `${b.hora_inicio}:00`
            : b.hora_inicio;
        startTime = new Date(`${b.fecha}T${timePart}${AR_OFFSET}`).toISOString();

        if (b.hora_fin) {
          const endPart =
            b.hora_fin.split(':').length === 2
              ? `${b.hora_fin}:00`
              : b.hora_fin;
          endTime = new Date(`${b.fecha}T${endPart}${AR_OFFSET}`).toISOString();
        }
      } catch {
        startTime = new Date().toISOString();
      }

      return {
        id: b.id,
        court_id: b.id_cancha,
        start_time: startTime,
        end_time: endTime || undefined,
        status:
          b.estado === 'pendiente'
            ? 'pending'
            : b.estado === 'confirmado'
              ? 'confirmed'
              : 'unknown',
      };
    });
  }

  private mapToFrontendStructure(b: any) {
    // Construct start_time from fecha and hora_inicio
    // b.fecha is 'YYYY-MM-DD', b.hora_inicio is 'HH:MM:SS' or 'HH:MM'
    // These values represent Argentina local time (UTC-3)
    const AR_OFFSET = '-03:00';
    let startTime = '';
    try {
      if (b.fecha && b.hora_inicio) {
        const datePart = b.fecha;
        const timePart =
          b.hora_inicio.includes(':') && b.hora_inicio.split(':').length === 2
            ? `${b.hora_inicio}:00`
            : b.hora_inicio;

        // Append Argentina offset so JS correctly converts to UTC
        startTime = new Date(`${datePart}T${timePart}${AR_OFFSET}`).toISOString();
      }
    } catch (e) {
      this.logger.error(
        `Error parsing date/time for booking: ${b.fecha} ${b.hora_inicio}`,
      );
      startTime = new Date().toISOString(); // Fallback
    }

    return {
      id: b.id,
      court_id: b.id_cancha,
      start_time: startTime,
      type: b.tipo_partido,
      status:
        b.estado === 'pendiente'
          ? 'pending'
          : b.estado === 'confirmado'
            ? 'confirmed'
            : b.estado === 'cancelado'
              ? 'cancelled'
              : 'unknown',
      costo: b.costo ? Number(b.costo) : 0,
      booking_players: (b.turno_jugadores || []).map((p: any) => ({
        id: p.id,
        user_id: p.id_persona,
        guest_name: p.nombre_invitado,
        tipo_persona: p.tipo_persona,
        uso_abono: p.uso_abono || false,
        monto_generado: p.monto_generado ? Number(p.monto_generado) : 0,
      })),
      courts: b.canchas,
      solicitante_nombre: b.solicitante?.nombre || b.nombre_organizador || 'Desconocido',
      court_name: b.canchas?.nombre || null,
    };
  }

  private async findRawBookingWithPlayers(
    bookingId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: booking, error } = await client
      .from('turnos')
      .select('*, turno_jugadores(*)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return booking;
  }

  private async getPrices(client: any) {
    // Return cached prices if still valid
    if (this.priceCache && Date.now() < this.priceCache.expiresAt) {
      return this.priceCache.prices;
    }

    const { data: allConfigs, error: configError } = await client
      .from('config_sistema')
      .select('clave, valor');

    if (configError) {
      this.logger.error(`Error fetching config_sistema: ${JSON.stringify(configError)}`);
    }

    // Normalize keys: lowercase, replace spaces with underscores
    const configMap: Record<string, number> = {};
    allConfigs?.forEach((c: any) => {
      if (c.clave) {
        const normalized = c.clave.toLowerCase().replace(/\s+/g, '_');
        configMap[normalized] = parseFloat(c.valor);
      }
    });

    const prices = {
      price_socio_libre: 0,
      price_socio_partidos:
        configMap['precio_socio_abonado'] ??
        configMap['precio_socio_con_abono'] ??
        DEFAULT_PRICES.price_socio_partidos,
      price_socio_sin_abono:
        configMap['precio_socio_sin_abono'] ??
        configMap['precio_socio'] ??
        DEFAULT_PRICES.price_socio_sin_abono,
      price_no_socio:
        configMap['precio_no_socio'] ??
        configMap['precio_invitado'] ??
        DEFAULT_PRICES.price_no_socio,
    };

    this.priceCache = {
      prices,
      expiresAt: Date.now() + BookingsService.PRICE_CACHE_TTL_MS,
    };

    return prices;
  }

  /**
   * Calculate costs and consume abono credits at booking creation time.
   * Updates turno_jugadores with uso_abono and monto_generado.
   * Returns the total booking cost (only what needs to be paid, not abono-covered).
   *
   * Optimized: batch-fetches data, uses atomic credit consumption,
   * and batches turno_jugadores updates by outcome.
   */
  private async calculateAndApplyCosts(
    players: any[],
    client: any,
  ): Promise<number> {
    const prices = await this.getPrices(client);
    const numPlayers = players.length;

    // Batch-fetch socios and usuarios for registered players (2 queries)
    const registeredPlayerIds = players
      .filter((p: any) => p.id_persona)
      .map((p: any) => p.id_persona);

    const socioMap = new Map<string, any>();
    const usuarioMap = new Map<string, any>();

    if (registeredPlayerIds.length > 0) {
      const [sociosResult, usuariosResult] = await Promise.all([
        client
          .from('socios')
          .select('id, id_usuario, id_tipo_abono, creditos_disponibles')
          .in('id_usuario', registeredPlayerIds),
        client
          .from('usuarios')
          .select('id, nombre, rol, socios(id, id_tipo_abono, tipo_abono:tipos_abono(nombre))')
          .in('id', registeredPlayerIds),
      ]);

      sociosResult.data?.forEach((s: any) => socioMap.set(s.id_usuario, s));
      usuariosResult.data?.forEach((u: any) => usuarioMap.set(u.id, u));
    }

    // Calculate costs and consume credits atomically
    let totalCosto = 0;
    const abonoPlayerIds: string[] = [];
    const costUpdates: { id: string; monto: number }[] = [];

    for (const player of players) {
      const socio = player.id_persona
        ? socioMap.get(player.id_persona)
        : null;

      // Try atomic credit consumption (single UPDATE with WHERE guard)
      let usoAbono = false;
      if (socio) {
        usoAbono = await this.consumeCreditAtomic(socio.id, client);
      }

      if (usoAbono) {
        abonoPlayerIds.push(player.id);
      } else {
        const usuario = player.id_persona
          ? usuarioMap.get(player.id_persona)
          : null;
        const baseCost = this.calculatePlayerCostFromData(
          player,
          usuario,
          prices,
        );
        const montoGenerado = baseCost / numPlayers;
        costUpdates.push({ id: player.id, monto: montoGenerado });
        totalCosto += montoGenerado;
      }
    }

    // Batch update turno_jugadores: abono players (single query)
    const updatePromises: Promise<any>[] = [];

    if (abonoPlayerIds.length > 0) {
      updatePromises.push(
        client
          .from('turno_jugadores')
          .update({ uso_abono: true, monto_generado: 0 })
          .in('id', abonoPlayerIds),
      );
    }

    // Non-abono players: group by monto to minimize queries
    const montoGroups = new Map<number, string[]>();
    for (const { id, monto } of costUpdates) {
      const group = montoGroups.get(monto) || [];
      group.push(id);
      montoGroups.set(monto, group);
    }

    for (const [monto, ids] of montoGroups) {
      updatePromises.push(
        client
          .from('turno_jugadores')
          .update({ uso_abono: false, monto_generado: monto })
          .in('id', ids),
      );
    }

    await Promise.all(updatePromises);

    return totalCosto;
  }

  /**
   * Atomically consume one abono credit using a conditional UPDATE.
   * Avoids the read-then-write race condition of the original consumeCredit.
   */
  private async consumeCreditAtomic(
    socioId: string,
    client: any,
  ): Promise<boolean> {
    const { data, error } = await client.rpc('consume_abono_credit', {
      p_socio_id: socioId,
    });

    if (error) {
      this.logger.warn(`Atomic credit consume failed for socio ${socioId}: ${JSON.stringify(error)}`);
      return false;
    }

    return data === true;
  }

  /**
   * Generate payment (debt) entries from pre-calculated turno_jugadores costs.
   * Called when admin confirms a booking.
   * Optimized: single batch INSERT instead of N individual inserts.
   */
  private async generatePlayerDebtsFromPrecalculated(
    booking: any,
    client: any,
  ) {
    // Batch-fetch socios for registered players
    const registeredPlayerIds = booking.turno_jugadores
      .filter((p: any) => p.id_persona)
      .map((p: any) => p.id_persona);

    if (registeredPlayerIds.length === 0) return;

    const { data: socios } = await client
      .from('socios')
      .select('id, id_usuario')
      .in('id_usuario', registeredPlayerIds);

    const socioMap = new Map<string, any>();
    socios?.forEach((s: any) => socioMap.set(s.id_usuario, s));

    // Collect all pago rows and insert in a single batch
    const pagosToInsert = booking.turno_jugadores
      .filter((p: any) => {
        const monto = Number(p.monto_generado) || 0;
        return monto > 0 && p.id_persona && socioMap.has(p.id_persona);
      })
      .map((p: any) => ({
        id_turno_jugador: p.id,
        id_socio: socioMap.get(p.id_persona).id,
        monto: -Number(p.monto_generado),
        tipo: 'cargo',
        observacion: `Reserva Cancha ${booking.id_cancha} - ${booking.fecha} ${booking.hora_inicio}`,
      }));

    if (pagosToInsert.length > 0) {
      const { error } = await client.from('pagos').insert(pagosToInsert);
      if (error) {
        this.logger.error(`Error batch-inserting pagos: ${JSON.stringify(error)}`);
        throw error;
      }
    }
  }

  async previewCost(
    players: { user_id?: string; guest_name?: string }[],
  ) {
    const client = this.supabaseService.getClient();
    const prices = await this.getPrices(client);
    const numPlayers = players.length;

    // Build player-like objects matching the format expected by calculatePlayerCostFromData
    const registeredPlayerIds = players
      .filter((p) => p.user_id)
      .map((p) => p.user_id!);

    const socioMap = new Map<string, any>();
    const usuarioMap = new Map<string, any>();

    if (registeredPlayerIds.length > 0) {
      const { data: socios } = await client
        .from('socios')
        .select('id, id_usuario, id_tipo_abono, creditos_disponibles')
        .in('id_usuario', registeredPlayerIds);

      socios?.forEach((s: any) => socioMap.set(s.id_usuario, s));

      const { data: usuarios, error: usuariosError } = await client
        .from('usuarios')
        .select('id, nombre, rol, socios(id, id_tipo_abono, tipo_abono:tipos_abono(nombre))')
        .in('id', registeredPlayerIds);

      if (usuariosError) {
        this.logger.error(`Error fetching usuarios for preview: ${JSON.stringify(usuariosError)}`);
      }

      usuarios?.forEach((u: any) => usuarioMap.set(u.id, u));
    }

    let totalCosto = 0;
    const breakdown: {
      nombre: string;
      tipo: string;
      usa_abono: boolean;
      monto: number;
    }[] = [];

    for (const p of players) {
      const player = {
        id_persona: p.user_id || null,
      };
      const socio = p.user_id ? socioMap.get(p.user_id) : null;
      const usuario = p.user_id ? usuarioMap.get(p.user_id) : null;

      let usaAbono = false;
      let monto = 0;

      // Check if socio has available abono credits
      if (socio && socio.id_tipo_abono && socio.creditos_disponibles > 0) {
        usaAbono = true;
        monto = 0;
      } else {
        const baseCost = this.calculatePlayerCostFromData(
          player,
          usuario,
          prices,
        );
        monto = baseCost / numPlayers;
      }

      const nombre = usuario?.nombre || p.guest_name || 'Invitado';
      const tipo = usaAbono
        ? 'abono'
        : p.user_id && usuario?.rol === 'socio'
          ? 'socio'
          : 'invitado';

      breakdown.push({ nombre, tipo, usa_abono: usaAbono, monto });
      totalCosto += monto;
    }

    return { costo_total: totalCosto, jugadores: breakdown };
  }

  async findAllCourts(accessToken?: string) {
    const client = this.supabaseService.getOptionalClient(accessToken);
    const { data, error } = await client
      .from('canchas')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    return data.map((c) => ({
      id: c.id,
      name: c.nombre,
      hora_apertura: c.hora_apertura,
      hora_cierre: c.hora_cierre,
    }));
  }

  async purgeByMonth(mes: number, anio: number, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    this.logger.log(`Purging turnos from ${fechaDesde} to ${fechaHasta}`);

    // 1. Find all turno_jugadores IDs for turnos in the date range
    const { data: turnos } = await client
      .from('turnos')
      .select('id')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta);

    const turnoIds = (turnos || []).map((t: any) => t.id);
    let pagosEliminados = 0;

    if (turnoIds.length > 0) {
      // 2. Find turno_jugadores for those turnos
      const { data: jugadores } = await client
        .from('turno_jugadores')
        .select('id')
        .in('id_turno', turnoIds);

      const jugadorIds = (jugadores || []).map((j: any) => j.id);

      // 3. Delete pagos linked to those turno_jugadores
      if (jugadorIds.length > 0) {
        const { count } = await client
          .from('pagos')
          .delete({ count: 'exact' })
          .in('id_turno_jugador', jugadorIds);
        pagosEliminados = count || 0;
      }

      // 4. Delete turnos (cascade deletes turno_jugadores)
      const { error: deleteError } = await client
        .from('turnos')
        .delete()
        .in('id', turnoIds);

      if (deleteError) {
        this.logger.error('Error purging turnos', deleteError);
        throw new InternalServerErrorException('Error al depurar turnos');
      }
    }

    this.logger.log(
      `Purge complete: ${turnoIds.length} turnos, ${pagosEliminados} pagos deleted`,
    );

    return {
      turnos_eliminados: turnoIds.length,
      pagos_eliminados: pagosEliminados,
    };
  }

  private calculatePlayerCostFromData(
    player: any,
    usuario: any | null,
    prices: any,
  ): number {
    if (!player.id_persona || !usuario) {
      return prices.price_no_socio;
    }

    const socio = Array.isArray(usuario.socios)
      ? usuario.socios[0]
      : usuario.socios;

    // tipo_abono is a relation to tipos_abono: { nombre: "Abono Libre" }
    const tipoAbonoNombre = socio?.tipo_abono?.nombre;

    if (tipoAbonoNombre === 'Abono Libre') return prices.price_socio_libre;
    if (tipoAbonoNombre === 'Abono x Partidos')
      return prices.price_socio_partidos;
    if (usuario.rol === 'socio') return prices.price_socio_sin_abono;

    return prices.price_no_socio;
  }
}
