import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CheckAvailabilityDto,
  CreateTurnoRecurrenteDto,
  AddPagoRecurrenteDto,
} from './dto/turnos-recurrentes.dto';

@Injectable()
export class TurnosRecurrentesService {
  private readonly logger = new Logger(TurnosRecurrentesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private todayAR(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  /** Generate all dates in [fechaDesde, fechaHasta] matching the ISO days of week */
  private generateDates(
    fechaDesde: string,
    fechaHasta: string,
    diasSemana: number[],
  ): string[] {
    const dates: string[] = [];
    const start = new Date(fechaDesde + 'T12:00:00');
    const end = new Date(fechaHasta + 'T12:00:00');
    const current = new Date(start);

    while (current <= end) {
      const jsDay = current.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay; // JS: 0=Sun → ISO: 7=Sun
      if (diasSemana.includes(isoDay)) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /** hora_inicio + 90 minutes → hora_fin */
  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  async checkAvailability(dto: CheckAvailabilityDto) {
    const horaFin = this.addMinutes(dto.hora_inicio, 90);
    const dates = this.generateDates(dto.fecha_desde, dto.fecha_hasta, dto.dias_semana);

    if (dates.length === 0) {
      throw new BadRequestException(
        'No hay fechas en el rango para los días indicados',
      );
    }

    const [turnosResult, bloqueosResult, configResult] = await Promise.all([
      this.client
        .from('turnos')
        .select('fecha')
        .eq('id_cancha', dto.id_cancha)
        .neq('estado', 'cancelado')
        .in('fecha', dates)
        .lt('hora_inicio', horaFin)
        .gt('hora_fin', dto.hora_inicio),
      this.client
        .from('bloqueos')
        .select('fecha')
        .eq('id_cancha', dto.id_cancha)
        .in('fecha', dates)
        .lt('hora_inicio', horaFin)
        .gt('hora_fin', dto.hora_inicio),
      this.client
        .from('config_sistema')
        .select('clave, valor')
        .in('clave', ['precio_socio_sin_abono', 'descuento_recurrente']),
    ]);

    if (turnosResult.error) {
      this.logger.error('Error checking turnos', turnosResult.error);
      throw new InternalServerErrorException('Error al verificar disponibilidad');
    }

    const conflictDates = new Set<string>();
    const conflictos: { fecha: string; motivo: string }[] = [];

    (turnosResult.data || []).forEach((t: any) => {
      if (!conflictDates.has(t.fecha)) {
        conflictDates.add(t.fecha);
        conflictos.push({ fecha: t.fecha, motivo: 'turno existente' });
      }
    });
    (bloqueosResult.data || []).forEach((b: any) => {
      if (!conflictDates.has(b.fecha)) {
        conflictDates.add(b.fecha);
        conflictos.push({ fecha: b.fecha, motivo: 'bloqueo' });
      }
    });

    const fechasDisponibles = dates.filter((d) => !conflictDates.has(d));

    const configMap: Record<string, string> = {};
    (configResult.data || []).forEach((r: any) => {
      configMap[r.clave] = r.valor;
    });
    const precioBase = parseFloat(configMap['precio_socio_sin_abono'] || '0');
    const descuento = parseFloat(configMap['descuento_recurrente'] || '0');
    const precioConDto = precioBase * (1 - descuento / 100);

    return {
      hora_fin: horaFin,
      fechas_disponibles: fechasDisponibles,
      conflictos,
      cantidad_disponibles: fechasDisponibles.length,
      cantidad_conflictos: conflictos.length,
      precio_sugerido: Math.round(fechasDisponibles.length * precioConDto * 100) / 100,
      precio_unitario_base: precioBase,
      descuento_aplicado: descuento,
    };
  }

  async create(dto: CreateTurnoRecurrenteDto, userId: string) {
    const horaFin = this.addMinutes(dto.hora_inicio, 90);
    const dates = this.generateDates(dto.fecha_desde, dto.fecha_hasta, dto.dias_semana);

    if (dates.length === 0) {
      throw new BadRequestException('No hay fechas en el rango seleccionado');
    }

    // Filter out conflicting dates
    const [turnosConflict, bloqueosConflict] = await Promise.all([
      this.client
        .from('turnos')
        .select('fecha')
        .eq('id_cancha', dto.id_cancha)
        .neq('estado', 'cancelado')
        .in('fecha', dates)
        .lt('hora_inicio', horaFin)
        .gt('hora_fin', dto.hora_inicio),
      this.client
        .from('bloqueos')
        .select('fecha')
        .eq('id_cancha', dto.id_cancha)
        .in('fecha', dates)
        .lt('hora_inicio', horaFin)
        .gt('hora_fin', dto.hora_inicio),
    ]);

    const conflictSet = new Set<string>([
      ...((turnosConflict.data || []).map((t: any) => t.fecha)),
      ...((bloqueosConflict.data || []).map((b: any) => b.fecha)),
    ]);
    const availableDates = dates.filter((d) => !conflictSet.has(d));

    if (availableDates.length === 0) {
      throw new BadRequestException(
        'No hay fechas disponibles para crear la recurrencia',
      );
    }

    const precioUnitario =
      Math.round((dto.monto_total / availableDates.length) * 100) / 100;

    // Resolve usuario → socio
    const { data: socio } = await this.client
      .from('socios')
      .select('id')
      .eq('id_usuario', dto.id_usuario_responsable)
      .single();

    if (!socio) {
      throw new BadRequestException('El usuario seleccionado no es socio del club');
    }

    const { data: recurrente, error: recurrenteError } = await this.client
      .from('turnos_recurrentes')
      .insert({
        nombre: dto.nombre,
        id_cancha: dto.id_cancha,
        id_socio_responsable: socio.id,
        dias_semana: dto.dias_semana,
        hora_inicio: dto.hora_inicio,
        hora_fin: horaFin,
        fecha_desde: dto.fecha_desde,
        fecha_hasta: dto.fecha_hasta,
        precio_unitario_original: precioUnitario,
        observacion: dto.observacion || null,
        creado_por: userId,
      })
      .select()
      .single();

    if (recurrenteError || !recurrente) {
      this.logger.error('Error creating turnos_recurrentes', recurrenteError);
      throw new InternalServerErrorException('Error al crear la recurrencia');
    }

    const turnosToInsert = availableDates.map((fecha) => ({
      id_cancha: dto.id_cancha,
      fecha,
      hora_inicio: dto.hora_inicio,
      hora_fin: horaFin,
      tipo_partido: 'double',
      estado: 'confirmado',
      creado_por: userId,
      id_turno_recurrente: recurrente.id,
      monto_recurrente: precioUnitario,
    }));

    const { error: turnosError } = await this.client
      .from('turnos')
      .insert(turnosToInsert);

    if (turnosError) {
      this.logger.error('Error inserting recurrente turnos', turnosError);
      // Rollback: delete the recurrente
      await this.client.from('turnos_recurrentes').delete().eq('id', recurrente.id);
      throw new InternalServerErrorException('Error al crear los turnos');
    }

    return {
      ...recurrente,
      turnos_creados: availableDates.length,
      precio_unitario: precioUnitario,
    };
  }

  async findAll(page = 1, pageSize = 10, estado?: string) {
    const offset = (page - 1) * pageSize;
    const today = this.todayAR();

    let query = this.client
      .from('turnos_recurrentes')
      .select(
        `id, nombre, id_cancha, id_socio_responsable, dias_semana,
         hora_inicio, hora_fin, fecha_desde, fecha_hasta,
         precio_unitario_original, estado, observacion, created_at,
         canchas(nombre),
         socios(id, usuarios(nombre))`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (estado) query = query.eq('estado', estado);

    const { data, count, error } = await query;
    if (error) {
      this.logger.error('Error fetching turnos_recurrentes', error);
      throw new InternalServerErrorException('Error al obtener recurrencias');
    }

    if (!data || data.length === 0) {
      return { data: [], total: count || 0, page, pageSize };
    }

    const ids = data.map((r: any) => r.id);

    // Batch fetch saldo data for all recurrencias in one round
    const [deudaRes, comprometidoRes, pagadoRes] = await Promise.all([
      this.client
        .from('turnos')
        .select('id_turno_recurrente, monto_recurrente')
        .in('id_turno_recurrente', ids)
        .neq('estado', 'cancelado')
        .lt('fecha', today),
      this.client
        .from('turnos')
        .select('id_turno_recurrente, monto_recurrente')
        .in('id_turno_recurrente', ids)
        .neq('estado', 'cancelado')
        .gte('fecha', today),
      this.client
        .from('movimientos_recurrentes')
        .select('id_turno_recurrente, monto')
        .in('id_turno_recurrente', ids),
    ]);

    const deudaMap = new Map<string, number>();
    (deudaRes.data || []).forEach((t: any) => {
      deudaMap.set(
        t.id_turno_recurrente,
        (deudaMap.get(t.id_turno_recurrente) || 0) + Number(t.monto_recurrente),
      );
    });

    const comprometidoMap = new Map<string, number>();
    (comprometidoRes.data || []).forEach((t: any) => {
      comprometidoMap.set(
        t.id_turno_recurrente,
        (comprometidoMap.get(t.id_turno_recurrente) || 0) + Number(t.monto_recurrente),
      );
    });

    const pagadoMap = new Map<string, number>();
    (pagadoRes.data || []).forEach((m: any) => {
      pagadoMap.set(
        m.id_turno_recurrente,
        (pagadoMap.get(m.id_turno_recurrente) || 0) + Number(m.monto),
      );
    });

    const result = data.map((r: any) => {
      const deuda = deudaMap.get(r.id) || 0;
      const comprometido = comprometidoMap.get(r.id) || 0;
      const pagado = pagadoMap.get(r.id) || 0;
      return {
        id: r.id,
        nombre: r.nombre,
        id_cancha: r.id_cancha,
        cancha_nombre: (r.canchas as any)?.nombre || `Cancha ${r.id_cancha}`,
        socio_nombre: (r.socios as any)?.usuarios?.nombre || 'Sin nombre',
        id_socio_responsable: r.id_socio_responsable,
        dias_semana: r.dias_semana,
        hora_inicio: r.hora_inicio,
        hora_fin: r.hora_fin,
        fecha_desde: r.fecha_desde,
        fecha_hasta: r.fecha_hasta,
        precio_unitario_original: r.precio_unitario_original,
        estado: r.estado,
        observacion: r.observacion,
        created_at: r.created_at,
        deuda: Math.round(deuda * 100) / 100,
        comprometido: Math.round(comprometido * 100) / 100,
        pagado: Math.round(pagado * 100) / 100,
        saldo: Math.round((pagado - deuda) * 100) / 100,
      };
    });

    return { data: result, total: count || 0, page, pageSize };
  }

  async findOne(id: string) {
    const today = this.todayAR();

    const [recurrenteRes, turnosRes, movimientosRes] = await Promise.all([
      this.client
        .from('turnos_recurrentes')
        .select(
          `id, nombre, id_cancha, id_socio_responsable, dias_semana,
           hora_inicio, hora_fin, fecha_desde, fecha_hasta,
           precio_unitario_original, estado, observacion, created_at,
           canchas(nombre),
           socios(id, usuarios(nombre))`,
        )
        .eq('id', id)
        .single(),
      this.client
        .from('turnos')
        .select('id, fecha, hora_inicio, hora_fin, estado, monto_recurrente')
        .eq('id_turno_recurrente', id)
        .order('fecha', { ascending: true }),
      this.client
        .from('movimientos_recurrentes')
        .select('id, tipo, monto, descripcion, medio, fecha, usuarios:registrado_por(nombre)')
        .eq('id_turno_recurrente', id)
        .order('fecha', { ascending: false }),
    ]);

    if (recurrenteRes.error || !recurrenteRes.data) {
      throw new NotFoundException('Recurrencia no encontrada');
    }

    const r = recurrenteRes.data;
    const turnos = turnosRes.data || [];
    const movimientos = movimientosRes.data || [];

    const deuda = turnos
      .filter((t: any) => t.estado !== 'cancelado' && t.fecha < today)
      .reduce((sum: number, t: any) => sum + Number(t.monto_recurrente || 0), 0);

    const comprometido = turnos
      .filter((t: any) => t.estado !== 'cancelado' && t.fecha >= today)
      .reduce((sum: number, t: any) => sum + Number(t.monto_recurrente || 0), 0);

    const pagado = movimientos.reduce(
      (sum: number, m: any) => sum + Number(m.monto || 0),
      0,
    );

    return {
      id: r.id,
      nombre: r.nombre,
      id_cancha: r.id_cancha,
      cancha_nombre: (r.canchas as any)?.nombre || `Cancha ${r.id_cancha}`,
      socio_nombre: (r.socios as any)?.usuarios?.nombre || 'Sin nombre',
      id_socio_responsable: r.id_socio_responsable,
      dias_semana: r.dias_semana,
      hora_inicio: r.hora_inicio,
      hora_fin: r.hora_fin,
      fecha_desde: r.fecha_desde,
      fecha_hasta: r.fecha_hasta,
      precio_unitario_original: Number(r.precio_unitario_original),
      estado: r.estado,
      observacion: r.observacion,
      created_at: r.created_at,
      deuda: Math.round(deuda * 100) / 100,
      comprometido: Math.round(comprometido * 100) / 100,
      pagado: Math.round(pagado * 100) / 100,
      saldo: Math.round((pagado - deuda) * 100) / 100,
      turnos,
      movimientos,
      cantidad_turnos: turnos.length,
      cantidad_activos: turnos.filter((t: any) => t.estado !== 'cancelado').length,
      cantidad_cancelados: turnos.filter((t: any) => t.estado === 'cancelado').length,
    };
  }

  async addPago(id: string, dto: AddPagoRecurrenteDto, userId: string) {
    const { data: r } = await this.client
      .from('turnos_recurrentes')
      .select('id')
      .eq('id', id)
      .single();

    if (!r) throw new NotFoundException('Recurrencia no encontrada');

    const { error } = await this.client.from('movimientos_recurrentes').insert({
      id_turno_recurrente: id,
      tipo: dto.tipo || 'pago',
      monto: dto.monto,
      descripcion: dto.descripcion || null,
      medio: dto.medio || null,
      registrado_por: userId,
    });

    if (error) {
      this.logger.error('Error registering pago recurrente', error);
      throw new InternalServerErrorException('Error al registrar el pago');
    }

    return { success: true };
  }

  /** Preview: shows what would change if we recalculate future turnos prices */
  async recalcularPreview(id: string) {
    const today = this.todayAR();

    const [configRes, turnosRes] = await Promise.all([
      this.client
        .from('config_sistema')
        .select('clave, valor')
        .in('clave', ['precio_socio_sin_abono', 'descuento_recurrente']),
      this.client
        .from('turnos')
        .select('id, monto_recurrente')
        .eq('id_turno_recurrente', id)
        .neq('estado', 'cancelado')
        .gte('fecha', today),
    ]);

    const configMap: Record<string, string> = {};
    (configRes.data || []).forEach((r: any) => {
      configMap[r.clave] = r.valor;
    });

    const precioBase = parseFloat(configMap['precio_socio_sin_abono'] || '0');
    const descuento = parseFloat(configMap['descuento_recurrente'] || '0');
    const nuevoPrecio = Math.round(precioBase * (1 - descuento / 100) * 100) / 100;

    const futuros = turnosRes.data || [];
    const comprometidoActual = futuros.reduce(
      (sum: number, t: any) => sum + Number(t.monto_recurrente || 0),
      0,
    );
    const precioActual =
      futuros.length > 0
        ? Math.round((comprometidoActual / futuros.length) * 100) / 100
        : 0;

    return {
      turnos_afectados: futuros.length,
      precio_actual: precioActual,
      precio_nuevo: nuevoPrecio,
      comprometido_actual: Math.round(comprometidoActual * 100) / 100,
      comprometido_nuevo: Math.round(futuros.length * nuevoPrecio * 100) / 100,
    };
  }

  /** Confirm: update monto_recurrente of future non-cancelled turnos */
  async recalcularConfirm(id: string) {
    const today = this.todayAR();

    const { data: configRows } = await this.client
      .from('config_sistema')
      .select('clave, valor')
      .in('clave', ['precio_socio_sin_abono', 'descuento_recurrente']);

    const configMap: Record<string, string> = {};
    (configRows || []).forEach((r: any) => {
      configMap[r.clave] = r.valor;
    });

    const precioBase = parseFloat(configMap['precio_socio_sin_abono'] || '0');
    const descuento = parseFloat(configMap['descuento_recurrente'] || '0');
    const nuevoPrecio = Math.round(precioBase * (1 - descuento / 100) * 100) / 100;

    const { error } = await this.client
      .from('turnos')
      .update({ monto_recurrente: nuevoPrecio })
      .eq('id_turno_recurrente', id)
      .neq('estado', 'cancelado')
      .gte('fecha', today);

    if (error) {
      this.logger.error('Error recalculating prices', error);
      throw new InternalServerErrorException('Error al recalcular precios');
    }

    return { success: true, nuevo_precio: nuevoPrecio };
  }

  async cancelTurno(recurrenteId: string, turnoId: string) {
    const { data: turno } = await this.client
      .from('turnos')
      .select('id, estado, id_turno_recurrente')
      .eq('id', turnoId)
      .eq('id_turno_recurrente', recurrenteId)
      .single();

    if (!turno) throw new NotFoundException('Turno no encontrado en esta recurrencia');
    if (turno.estado === 'cancelado') {
      throw new BadRequestException('El turno ya está cancelado');
    }

    const { error } = await this.client
      .from('turnos')
      .update({ estado: 'cancelado' })
      .eq('id', turnoId);

    if (error) {
      this.logger.error('Error cancelling turno', error);
      throw new InternalServerErrorException('Error al cancelar el turno');
    }

    return { success: true };
  }

  async cancelAll(id: string) {
    const today = this.todayAR();

    const { data: recurrente } = await this.client
      .from('turnos_recurrentes')
      .select('id, estado')
      .eq('id', id)
      .single();

    if (!recurrente) throw new NotFoundException('Recurrencia no encontrada');
    if (recurrente.estado === 'cancelada') {
      throw new BadRequestException('La recurrencia ya está cancelada');
    }

    const { data: futuros } = await this.client
      .from('turnos')
      .select('id, monto_recurrente')
      .eq('id_turno_recurrente', id)
      .neq('estado', 'cancelado')
      .gte('fecha', today);

    const cantFuturos = (futuros || []).length;
    const montoLiberado = (futuros || []).reduce(
      (sum: number, t: any) => sum + Number(t.monto_recurrente || 0),
      0,
    );

    const [updateTurnos, updateRecurrente] = await Promise.all([
      this.client
        .from('turnos')
        .update({ estado: 'cancelado' })
        .eq('id_turno_recurrente', id)
        .neq('estado', 'cancelado')
        .gte('fecha', today),
      this.client
        .from('turnos_recurrentes')
        .update({ estado: 'cancelada' })
        .eq('id', id),
    ]);

    if (updateTurnos.error || updateRecurrente.error) {
      this.logger.error(
        'Error cancelling recurrencia',
        updateTurnos.error || updateRecurrente.error,
      );
      throw new InternalServerErrorException('Error al cancelar la recurrencia');
    }

    return {
      success: true,
      turnos_cancelados: cantFuturos,
      monto_liberado: Math.round(montoLiberado * 100) / 100,
    };
  }

  /** Total deuda + comprometido across all recurrencias — for dashboard */
  async getDeudaTotal() {
    const today = this.todayAR();

    const [deudaRes, comprometidoRes] = await Promise.all([
      this.client
        .from('turnos')
        .select('monto_recurrente')
        .not('id_turno_recurrente', 'is', null)
        .neq('estado', 'cancelado')
        .lt('fecha', today),
      this.client
        .from('turnos')
        .select('monto_recurrente')
        .not('id_turno_recurrente', 'is', null)
        .neq('estado', 'cancelado')
        .gte('fecha', today),
    ]);

    const deuda = (deudaRes.data || []).reduce(
      (sum: number, t: any) => sum + Number(t.monto_recurrente || 0),
      0,
    );
    const comprometido = (comprometidoRes.data || []).reduce(
      (sum: number, t: any) => sum + Number(t.monto_recurrente || 0),
      0,
    );

    return {
      deuda: Math.round(deuda * 100) / 100,
      comprometido: Math.round(comprometido * 100) / 100,
    };
  }
}
