import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsIn(['admin', 'socio'])
  rol?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo'])
  estado?: string;
}

export class UpdateSocioDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  nro_socio?: number;
}

export class CreateUserDto {
  @IsString()
  nombre: string;

  @IsString()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsIn(['admin', 'socio'])
  rol?: string;
}
