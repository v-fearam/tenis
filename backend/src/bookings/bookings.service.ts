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

        // In a real scenario, we'd also calculate and insert payments/debt here
        const { data, error } = await client
            .from('bookings')
            .update({ status: BookingStatus.CONFIRMED })
            .eq('id', bookingId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}
