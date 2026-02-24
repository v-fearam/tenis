export const MatchType = {
    SINGLE: 'single',
    DOUBLE: 'double',
} as const;

export type MatchType = typeof MatchType[keyof typeof MatchType];

export const BookingStatus = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];
