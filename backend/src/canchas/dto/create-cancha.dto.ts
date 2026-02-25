import { IsString, IsNotEmpty, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateCanchaDto {
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsOptional()
    superficie?: string;

    @IsBoolean()
    @IsOptional()
    activa?: boolean;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)?$/, {
        message: 'hora_apertura must be a valid time (HH:mm:ss)',
    })
    hora_apertura: string;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)?$/, {
        message: 'hora_cierre must be a valid time (HH:mm:ss)',
    })
    hora_cierre: string;
}
