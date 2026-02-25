import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBookingDto, BookingStatus } from './dto/booking.dto';

const DEFAULT_PRICES = {
    price_socio_libre: 0,
    price_socio_partidos: 500,
    price_socio_sin_abono: 1000,
    price_no_socio: 2000,
};

@Injectable()
export class BookingsService {
    constructor(private readonly supabaseService: SupabaseService) {}

    async create(createBookingDto: CreateBookingDto, creatorId: string) {
        const client = this.supabaseService.getClient();

        const { data: booking, error: bookingError } = await client
            .from('bookings')
            .insert({
                court_id: createBookingDto.court_id,
                start_time: createBookingDto.start_time,
                end_time: createBookingDto.end_time,
                type: createBookingDto.type,
                status: BookingStatus.PENDING,
                created_by: creatorId,
            })
            .select()
            .single();

        if (bookingError) throw bookingError;

        const players = createBookingDto.players.map((p) => ({
            booking_id: booking.id,
            user_id: p.user_id,
            guest_name: p.guest_name,
            is_organizer: p.is_organizer,
        }));

        const { error: playersError } = await client
            .from('booking_players')
            .insert(players);

        if (playersError) throw playersError;

        return booking;
    }

    async findAll() {
        const client = this.supabaseService.getClient();
        const { data, error } = await client
            .from('bookings')
            .select('*, courts(*), booking_players(*)')
            .order('start_time', { ascending: false });
        if (error) throw error;
        return data;
    }

    async confirm(bookingId: string) {
        const client = this.supabaseService.getClient();

        const booking = await this.findBookingWithPlayers(bookingId);
        const prices = await this.getMonthlyPrices(booking.start_time);

        // Update booking status
        const { error: updateError } = await client
            .from('bookings')
            .update({ status: BookingStatus.CONFIRMED })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        // Generate debt for each player
        await this.generatePlayerDebts(booking, prices);

        return booking;
    }

    async cancel(bookingId: string) {
        const client = this.supabaseService.getClient();

        const { data: booking, error: fetchError } = await client
            .from('bookings')
            .select('id, status')
            .eq('id', bookingId)
            .single();

        if (fetchError || !booking) {
            throw new NotFoundException('Reserva no encontrada');
        }

        const { error: updateError } = await client
            .from('bookings')
            .update({ status: BookingStatus.CANCELLED })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        return { id: bookingId, status: BookingStatus.CANCELLED };
    }

    private async findBookingWithPlayers(bookingId: string) {
        const client = this.supabaseService.getClient();

        const { data: booking, error } = await client
            .from('bookings')
            .select('*, booking_players(*)')
            .eq('id', bookingId)
            .single();

        if (error || !booking) {
            throw new NotFoundException('Reserva no encontrada');
        }

        return booking;
    }

    private async getMonthlyPrices(startTime: string) {
        const client = this.supabaseService.getClient();
        const monthStart = new Date(startTime).toISOString().slice(0, 7) + '-01';

        const { data: params } = await client
            .from('monthly_parameters')
            .select('*')
            .eq('month_year', monthStart)
            .single();

        return params || DEFAULT_PRICES;
    }

    private async generatePlayerDebts(booking: any, prices: any) {
        const client = this.supabaseService.getClient();
        const numPlayers = booking.booking_players.length;

        for (const player of booking.booking_players) {
            const cost = await this.calculatePlayerCost(player, prices);
            const proportionalCost = cost / numPlayers;

            if (proportionalCost > 0 && player.user_id) {
                await client.from('payments').insert({
                    user_id: player.user_id,
                    amount: -proportionalCost,
                    description: `Reserva Cancha ${booking.court_id} - ${booking.start_time}`,
                    booking_id: booking.id,
                });
            }
        }
    }

    private async calculatePlayerCost(player: any, prices: any): Promise<number> {
        if (!player.user_id) {
            return prices.price_no_socio;
        }

        const client = this.supabaseService.getClient();
        const { data: usuario } = await client
            .from('usuarios')
            .select('*, socios(*)')
            .eq('id', player.user_id)
            .single();

        if (!usuario) return prices.price_no_socio;

        const socio = Array.isArray(usuario.socios) ? usuario.socios[0] : usuario.socios;

        if (socio?.tipo_abono === 'Abono Libre') return prices.price_socio_libre;
        if (socio?.tipo_abono === 'Abono x Partidos') return prices.price_socio_partidos;
        if (usuario.rol === 'socio') return prices.price_socio_sin_abono;

        return prices.price_no_socio;
    }
}
