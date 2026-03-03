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
import { PaginationDto } from '../../common/dto';

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

export class BookingQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  court_id?: string;
}

class PreviewPlayerDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  guest_name?: string;
}

export class PreviewBookingDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PreviewPlayerDto)
  players: PreviewPlayerDto[];
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

  // Optional contact info for non-authenticated organizers
  @IsOptional()
  @IsString()
  organizer_name?: string;

  @IsOptional()
  @IsString()
  organizer_email?: string;

  @IsOptional()
  @IsString()
  organizer_phone?: string;

  // reCAPTCHA token for bot protection
  @IsOptional()
  @IsString()
  recaptcha_token?: string;
}
