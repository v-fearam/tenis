import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBookingDto, BookingStatus } from './dto/booking.dto';

@Injectable()
export class BookingsService {
    constructor(private supabaseService: SupabaseService) { }

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
            .select('*, courts(*), booking_players(*)');
        if (error) throw error;
        return data;
    }

    async confirm(bookingId: string) {
        const client = this.supabaseService.getClient();

        // 1. Get booking and players
        const { data: booking, error: fetchError } = await client
            .from('bookings')
            .select('*, booking_players(*)')
            .eq('id', bookingId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Get monthly parameters for pricing
        const monthStart = new Date(booking.start_time).toISOString().slice(0, 7) + '-01';
        const { data: params, error: paramsError } = await client
            .from('monthly_parameters')
            .select('*')
            .eq('month_year', monthStart)
            .single();

        // Fallback prices if parameters aren't set for the month
        const prices = params || {
            price_socio_libre: 0,
            price_socio_partidos: 500,
            price_socio_sin_abono: 1000,
            price_no_socio: 2000,
        };

        // 3. Update booking status
        const { error: updateError } = await client
            .from('bookings')
            .update({ status: BookingStatus.CONFIRMED })
            .eq('id', bookingId);

        if (updateError) throw updateError;

        // 4. Calculate and record costs/debt for each player
        const numPlayers = booking.booking_players.length;

        for (const player of booking.booking_players) {
            let cost = 0;

            if (player.user_id) {
                // Fetch player profile to check membership
                const { data: profile } = await client
                    .from('profiles')
                    .select('*')
                    .eq('id', player.user_id)
                    .single();

                if (profile?.membership_type === 'Abono Libre') cost = prices.price_socio_libre;
                else if (profile?.membership_type === 'Abono x Partidos') cost = prices.price_socio_partidos;
                else if (profile?.role === 'socio') cost = prices.price_socio_sin_abono;
                else cost = prices.price_no_socio;
            } else {
                cost = prices.price_no_socio;
            }

            const proportionalCost = cost / numPlayers;

            if (proportionalCost > 0 && player.user_id) {
                await client.from('payments').insert({
                    user_id: player.user_id,
                    amount: -proportionalCost, // Negative for debt
                    description: `Reserva Cancha ${booking.court_id} - ${booking.start_time}`,
                    booking_id: booking.id,
                });
            }
        }

        return booking;
    }
}
