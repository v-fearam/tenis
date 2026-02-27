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

    const { error: playersError } = await client
      .from('turno_jugadores')
      .insert(players);

    if (playersError) {
      this.logger.error(
        'Error inserting players into turno_jugadores',
        playersError,
      );
      throw new InternalServerErrorException(
        'Error al registrar los jugadores del turno',
      );
    }

    return this.mapToFrontendStructure(booking);
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
    const prices = await this.getMonthlyPrices(rawBooking.fecha, accessToken);

    // Update booking status
    const { error: updateError } = await client
      .from('turnos')
      .update({ estado: 'confirmado' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Generate debt for each player
    await this.generatePlayerDebts(rawBooking, prices, accessToken);

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

    const { error: updateError } = await client
      .from('turnos')
      .update({ estado: 'cancelado' })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    return { id: bookingId, status: 'cancelado' };
  }

  private mapToFrontendStructure(b: any) {
    // Construct start_time from fecha and hora_inicio
    // b.fecha is 'YYYY-MM-DD', b.hora_inicio is 'HH:MM:SS' or 'HH:MM'
    let startTime = '';
    try {
      if (b.fecha && b.hora_inicio) {
        const datePart = b.fecha;
        const timePart =
          b.hora_inicio.includes(':') && b.hora_inicio.split(':').length === 2
            ? `${b.hora_inicio}:00`
            : b.hora_inicio;

        // Construct a valid ISO-like string: YYYY-MM-DDTHH:MM:SS
        startTime = new Date(`${datePart}T${timePart}`).toISOString();
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
      booking_players: (b.turno_jugadores || []).map((p: any) => ({
        id: p.id,
        user_id: p.id_persona,
        guest_name: p.nombre_invitado,
        tipo_persona: p.tipo_persona,
      })),
      courts: b.canchas,
      solicitante_nombre: b.solicitante?.nombre || 'Desconocido',
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

  private async getMonthlyPrices(fecha: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const monthStart = fecha.slice(0, 7) + '-01';

    // 1. Fetch global config for defaults
    const { data: globalConfigs } = await client
      .from('config_sistema')
      .select('clave, valor')
      .in('clave', [
        'precio_socio_sin_abono',
        'precio_socio_abonado',
        'precio_no_socio',
      ]);

    const configMap: Record<string, number> = {};
    globalConfigs?.forEach((c) => {
      configMap[c.clave] = parseFloat(c.valor);
    });

    const dynamicDefaults = {
      price_socio_libre: 0,
      price_socio_partidos:
        configMap['precio_socio_abonado'] ??
        DEFAULT_PRICES.price_socio_partidos,
      price_socio_sin_abono:
        configMap['precio_socio_sin_abono'] ??
        DEFAULT_PRICES.price_socio_sin_abono,
      price_no_socio:
        configMap['precio_no_socio'] ?? DEFAULT_PRICES.price_no_socio,
    };

    // 2. Try to fetch month-specific overrides
    const { data: params } = await client
      .from('parametros_mensuales')
      .select('*')
      .eq('mes_anio', monthStart)
      .single();

    if (!params) return dynamicDefaults;

    return {
      price_socio_libre:
        params.precio_abono_libre ?? dynamicDefaults.price_socio_libre,
      price_socio_partidos:
        params.tarifa_socio ?? dynamicDefaults.price_socio_partidos,
      price_socio_sin_abono:
        params.tarifa_socio ?? dynamicDefaults.price_socio_sin_abono,
      price_no_socio: params.tarifa_no_socio ?? dynamicDefaults.price_no_socio,
    };
  }

  private async generatePlayerDebts(
    booking: any,
    prices: any,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const numPlayers = booking.turno_jugadores.length;

    // Batch-fetch all socios and usuarios for registered players in 2 queries
    // instead of N+1 queries per player (was up to 12 queries for doubles)
    const registeredPlayerIds = booking.turno_jugadores
      .filter((p: any) => p.id_persona)
      .map((p: any) => p.id_persona);

    const socioMap = new Map<string, any>();
    const usuarioMap = new Map<string, any>();

    if (registeredPlayerIds.length > 0) {
      const { data: socios } = await client
        .from('socios')
        .select('id, id_usuario, id_tipo_abono, creditos_disponibles')
        .in('id_usuario', registeredPlayerIds);

      socios?.forEach((s) => socioMap.set(s.id_usuario, s));

      const { data: usuarios } = await client
        .from('usuarios')
        .select('id, rol, socios(id, tipo_abono, id_tipo_abono)')
        .in('id', registeredPlayerIds);

      usuarios?.forEach((u) => usuarioMap.set(u.id, u));
    }

    for (const player of booking.turno_jugadores) {
      let finalPriceToCharge = 0;

      // 1. Try to use abono if player is a socio
      let usedAbono = false;
      const socio = player.id_persona ? socioMap.get(player.id_persona) : null;

      if (socio) {
        usedAbono = await this.abonosService.consumeCredit(
          socio.id,
          accessToken,
        );
      }

      // 2. If not covered by abono, calculate proportional cost
      if (!usedAbono) {
        const usuario = player.id_persona
          ? usuarioMap.get(player.id_persona)
          : null;
        const baseCost = this.calculatePlayerCostFromData(
          player,
          usuario,
          prices,
        );
        finalPriceToCharge = baseCost / numPlayers;
      }

      if (finalPriceToCharge > 0 && socio) {
        await client.from('pagos').insert({
          id_turno_jugador: player.id,
          id_socio: socio.id,
          monto: -finalPriceToCharge,
          tipo: 'cargo',
          observacion: `Reserva Cancha ${booking.id_cancha} - ${booking.fecha} ${booking.hora_inicio}`,
        });
      }
    }
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

    if (socio?.tipo_abono === 'Abono Libre') return prices.price_socio_libre;
    if (socio?.tipo_abono === 'Abono x Partidos')
      return prices.price_socio_partidos;
    if (usuario.rol === 'socio') return prices.price_socio_sin_abono;

    return prices.price_no_socio;
  }
}
