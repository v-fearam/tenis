export class AssignAbonoDto {
    socio_id: string;
    tipo: string; // Now refers to nombre in tipos_abono
    mes_anio: string; // YYYY-MM-DD
}

export class CreateAbonoTypeDto {
    nombre: string;
    creditos: number;
    precio: number;
    color?: string;
}

export class UpdateAbonoTypeDto {
    nombre?: string;
    creditos?: number;
    precio?: number;
    color?: string;
}

export class UpdateAbonoCreditsDto {
    creditos_disponibles: number;
}
