export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
}

export enum MatchType {
    SINGLE = 'single',
    DOUBLE = 'double',
}

export class CreateBookingDto {
    court_id: number;
    start_time: string;
    end_time: string;
    type: MatchType;
    players: {
        user_id?: string;
        guest_name?: string;
        is_organizer: boolean;
    }[];
}
