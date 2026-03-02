export interface Cancha {
    id: number;
    nombre: string;
    superficie: string;
    activa: boolean;
    hora_apertura: string;
    hora_cierre: string;
    tiene_luz: boolean;
    created_at?: string;
}

export interface CreateCanchaPayload {
    nombre: string;
    superficie?: string;
    activa?: boolean;
    hora_apertura: string;
    hora_cierre: string;
    tiene_luz?: boolean;
}

export type UpdateCanchaPayload = Partial<CreateCanchaPayload>;
