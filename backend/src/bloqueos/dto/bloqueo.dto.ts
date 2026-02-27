import {
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsString,
  IsOptional,
  IsInt,
} from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class BloqueoQueryDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}

export enum BloqueoTipo {
  TORNEO = 'torneo',
  CLASE = 'clase',
  MANTENIMIENTO = 'mantenimiento',
  OTRO = 'otro',
}

export class CreateBloqueoDto {
  @IsInt()
  @IsNotEmpty()
  id_cancha: number;

  @IsEnum(BloqueoTipo)
  @IsNotEmpty()
  tipo: BloqueoTipo;

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsOptional()
  @IsDateString({}, { each: true })
  fechas?: string[];

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @IsString()
  @IsNotEmpty()
  hora_inicio: string;

  @IsString()
  @IsNotEmpty()
  hora_fin: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
