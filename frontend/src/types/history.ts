export interface HistoryItem {
  turno_jugador_id: string;
  turno_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cancha_nombre: string;
  tipo_partido: string;
  monto_generado: number;
  estado_pago: 'pendiente' | 'pagado' | 'bonificado';
  uso_abono: boolean;
}

export interface HistoryDetail {
  jugadores: {
    nombre: string;
    tipo_persona: string;
  }[];
  pago_info: {
    fecha: string;
    medio: string | null;
    observacion: string | null;
  } | null;
}

export interface HistoryResponse {
  deuda_total: number;
  turnos: {
    data: HistoryItem[];
    meta: {
      currentPage: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
