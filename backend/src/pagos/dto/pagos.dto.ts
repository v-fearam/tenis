import { IsUUID, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

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
