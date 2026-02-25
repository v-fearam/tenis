import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBookingDto, BookingStatus, MatchType } from './dto/booking.dto';

const DEFAULT_PRICES = {
    price_socio_libre: 0,
    price_socio_partidos: 500,
    price_socio_sin_abono: 1000,
    price_no_socio: 2000,
};

@Injectable()
export class BookingsService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createBookingDto: CreateBookingDto, creatorId: string, accessToken: string) {
        console.log('Creating booking for user:', creatorId);

        const client = this.supabaseService.getAuthenticatedClient(accessToken);

        // Map start_time to DATE and TIME
        const startDate = new Date(createBookingDto.start_time);
        const fecha = startDate.toISOString().split('T')[0];
        const hora_inicio = startDate.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

        const endDate = new Date(createBookingDto.end_time);
        const hora_fin = endDate.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

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
            })
            .select()
            .single();

        if (bookingError) {
            console.error('Error inserting booking into turnos:', bookingError);
            if (bookingError.code === '23P01') {
                throw new ConflictException('Esta cancha ya se encuentra reservada para el horario seleccionado.');
            }
            throw new InternalServerErrorException('Error al crear el turno en la base de datos');
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
            console.error('Error inserting players into turno_jugadores:', playersError);
            throw new InternalServerErrorException('Error al registrar los jugadores del turno');
        }

        return this.mapToFrontendStructure(booking);
    }

    async findAll(accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data, error } = await client
            .from('turnos')
            .select('*, canchas(*), turno_jugadores(*)')
            .order('fecha', { ascending: false })
            .order('hora_inicio', { ascending: false });

        if (error) throw error;
        return data.map(b => this.mapToFrontendStructure(b));
    }

    async confirm(bookingId: string, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);

        const rawBooking = await this.findRawBookingWithPlayers(bookingId, accessToken);
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
                const timePart = b.hora_inicio.includes(':') && b.hora_inicio.split(':').length === 2
                    ? `${b.hora_inicio}:00`
                    : b.hora_inicio;

                // Construct a valid ISO-like string: YYYY-MM-DDTHH:MM:SS
                startTime = new Date(`${datePart}T${timePart}`).toISOString();
            }
        } catch (e) {
            console.error('Error parsing date/time for booking:', b.fecha, b.hora_inicio);
            startTime = new Date().toISOString(); // Fallback
        }

        return {
            id: b.id,
            court_id: b.id_cancha,
            start_time: startTime,
            type: b.tipo_partido,
            status: b.estado === 'pendiente' ? 'pending' : b.estado === 'confirmado' ? 'confirmed' : 'cancelled',
            booking_players: (b.turno_jugadores || []).map((p: any) => ({
                id: p.id,
                user_id: p.id_persona,
                guest_name: p.nombre_invitado,
                tipo_persona: p.tipo_persona
            })),
            courts: b.canchas
        };
    }

    private async findRawBookingWithPlayers(bookingId: string, accessToken: string) {
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

        const { data: params } = await client
            .from('parametros_mensuales')
            .select('*')
            .eq('mes_anio', monthStart)
            .single();

        if (!params) return DEFAULT_PRICES;

        return {
            price_socio_libre: params.precio_abono_libre || 0,
            price_socio_partidos: params.tarifa_socio || 500,
            price_socio_sin_abono: params.tarifa_socio || 1000,
            price_no_socio: params.tarifa_no_socio || 2000,
        };
    }

    private async generatePlayerDebts(booking: any, prices: any, accessToken: string) {
        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const numPlayers = booking.turno_jugadores.length;

        for (const player of booking.turno_jugadores) {
            const cost = await this.calculatePlayerCost(player, prices, accessToken);
            const proportionalCost = cost / numPlayers;

            if (proportionalCost > 0 && player.id_persona) {
                // Find socio id for the user
                const { data: socio } = await client
                    .from('socios')
                    .select('id')
                    .eq('id_usuario', player.id_persona)
                    .single();

                if (socio) {
                    await client.from('pagos').insert({
                        id_turno_jugador: player.id,
                        id_socio: socio.id,
                        monto: -proportionalCost,
                        tipo: 'cargo',
                        observacion: `Reserva Cancha ${booking.id_cancha} - ${booking.fecha} ${booking.hora_inicio}`,
                    });
                }
            }
        }
    }

    private async calculatePlayerCost(player: any, prices: any, accessToken: string): Promise<number> {
        if (!player.id_persona) {
            return prices.price_no_socio;
        }

        const client = this.supabaseService.getAuthenticatedClient(accessToken);
        const { data: usuario } = await client
            .from('usuarios')
            .select('*, socios(*)')
            .eq('id', player.id_persona)
            .single();

        if (!usuario) return prices.price_no_socio;

        const socio = Array.isArray(usuario.socios) ? usuario.socios[0] : usuario.socios;

        if (socio?.tipo_abono === 'Abono Libre') return prices.price_socio_libre;
        if (socio?.tipo_abono === 'Abono x Partidos') return prices.price_socio_partidos;
        if (usuario.rol === 'socio') return prices.price_socio_sin_abono;

        return prices.price_no_socio;
    }
}
