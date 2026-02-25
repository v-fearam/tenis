import {
    IsEnum,
    IsInt,
    IsDateString,
    IsArray,
    ValidateNested,
    IsOptional,
    IsUUID,
    IsString,
    IsBoolean,
    Min,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
}

export enum MatchType {
    SINGLE = 'single',
    DOUBLE = 'double',
}

class BookingPlayerDto {
    @IsOptional()
    @IsUUID()
    user_id?: string;

    @IsOptional()
    @IsString()
    guest_name?: string;

    @IsBoolean()
    is_organizer: boolean;
}

export class CreateBookingDto {
    @IsInt()
    @Min(1)
    court_id: number;

    @IsDateString()
    start_time: string;

    @IsDateString()
    end_time: string;

    @IsEnum(MatchType)
    type: MatchType;

    @IsArray()
    @ArrayMinSize(2)
    @ValidateNested({ each: true })
    @Type(() => BookingPlayerDto)
    players: BookingPlayerDto[];
}
