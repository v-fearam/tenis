import {
  IsString,
  IsInt,
  IsUUID,
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Matches,
} from 'class-validator';

export class CheckAvailabilityDto {
  @IsInt()
  id_cancha: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  dias_semana: number[]; // ISO: 1=Mon, 7=Sun

  @Matches(/^\d{2}:\d{2}$/)
  hora_inicio: string;

  @IsDateString()
  fecha_desde: string;

  @IsDateString()
  fecha_hasta: string;
}

export class CreateTurnoRecurrenteDto {
  @IsString()
  nombre: string;

  @IsInt()
  id_cancha: number;

  @IsUUID()
  id_usuario_responsable: string; // usuarios.id; service resolves to socios.id

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  dias_semana: number[];

  @Matches(/^\d{2}:\d{2}$/)
  hora_inicio: string;

  @IsDateString()
  fecha_desde: string;

  @IsDateString()
  fecha_hasta: string;

  @IsNumber()
  @Min(0)
  monto_total: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class AddPagoRecurrenteDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsIn(['pago', 'bonificacion'])
  tipo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  medio?: string;
}

export class ListTurnosRecurrentesDto {
  @IsOptional()
  @IsIn(['activa', 'cancelada'])
  estado?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;
}
