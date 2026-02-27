import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  valor: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
