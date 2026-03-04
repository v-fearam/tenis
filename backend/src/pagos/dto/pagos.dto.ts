import { IsUUID, IsNumber, IsPositive, IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class UnpaidQueryDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}

export class RegisterPaymentDto {
  @IsUUID()
  turno_jugador_id: string;

  @IsNumber()
  @IsPositive()
  monto: number;

  @IsOptional()
  @IsString()
  medio?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class GiftPaymentDto {
  @IsUUID()
  turno_jugador_id: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class PayAllDto {
  @IsUUID()
  turno_id: string;

  @IsOptional()
  @IsString()
  medio?: string;
}
