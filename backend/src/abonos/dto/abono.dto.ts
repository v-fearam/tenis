import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class AssignAbonoDto {
    @IsString()
    @IsNotEmpty()
    socio_id: string;

    @IsString()
    @IsNotEmpty()
    tipo_abono_id: string;
}

export class CreateAbonoTypeDto {
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsNumber()
    @Min(1)
    creditos: number;

    @IsNumber()
    @Min(0)
    precio: number;

    @IsOptional()
    @IsString()
    color?: string;
}

export class UpdateAbonoTypeDto {
    @IsOptional()
    @IsString()
    nombre?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    creditos?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    precio?: number;

    @IsOptional()
    @IsString()
    color?: string;
}
