import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterPaymentDto, GiftPaymentDto, PayAllDto } from './dto/pagos.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);
  private readonly defaultPageSize: number;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.defaultPageSize = this.configService.get<number>(
      'PAGINATION_PAGE_SIZE',
      20,
    );
  }

  async findUnpaidTurnos(
    paginationDto: PaginationDto,
    accessToken: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getClient();
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Step 1: Find turno IDs that have at least one pending player with debt
    const { data: pendingRows, error: pendingError } = await client
      .from('turno_jugadores')
      .select('id_turno')
      .eq('estado_pago', 'pendiente')
      .gt('monto_generado', 0);

    if (pendingError) {
      this.logger.error('Error fetching pending players', pendingError);
      throw new InternalServerErrorException('Error al buscar jugadores pendientes');
    }

    const turnoIds = [...new Set((pendingRows || []).map((r: any) => r.id_turno))];

    if (turnoIds.length === 0) {
      return PaginatedResponseDto.create([], page, pageSize, 0);
    }

    // Steps 2+3: Count and fetch paginated turnos in parallel
    let countQuery = client
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .in('id', turnoIds)
      .eq('estado', 'confirmado');
    if (fechaDesde) countQuery = countQuery.gte('fecha', fechaDesde);
    if (fechaHasta) countQuery = countQuery.lte('fecha', fechaHasta);

    let dataQuery = client
      .from('turnos')
      .select('id, id_cancha, fecha, hora_inicio, canchas(nombre), turno_jugadores(id, id_persona, tipo_persona, nombre_invitado, uso_abono, monto_generado, estado_pago, usuarios:id_persona(nombre))')
      .in('id', turnoIds)
      .eq('estado', 'confirmado')
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (fechaDesde) dataQuery = dataQuery.gte('fecha', fechaDesde);
    if (fechaHasta) dataQuery = dataQuery.lte('fecha', fechaHasta);

    const [countResult, turnosResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countResult.error) {
      this.logger.error('Error counting unpaid turnos', countResult.error);
      throw new InternalServerErrorException('Error al contar turnos impagos');
    }

    if (turnosResult.error) {
      this.logger.error('Error fetching unpaid turnos', turnosResult.error);
      throw new InternalServerErrorException('Error al obtener turnos impagos');
    }

    const count = countResult.count;
    const turnos = turnosResult.data;

    if (!turnos || turnos.length === 0) {
      return PaginatedResponseDto.create([], page, pageSize, count || 0);
    }

    // Step 4: Batch-fetch pagos for all players in visible turnos
    const allPlayerIds = turnos.flatMap((t: any) =>
      (t.turno_jugadores || []).map((p: any) => p.id),
    );

    const { data: allPagos, error: pagosError } = await client
      .from('pagos')
      .select('id_turno_jugador, monto, tipo')
      .in('id_turno_jugador', allPlayerIds)
      .in('tipo', ['pago', 'bonificacion', 'devolucion']);

    if (pagosError) {
      this.logger.error('Error fetching pagos', pagosError);
      throw new InternalServerErrorException('Error al obtener pagos');
    }

    // Build map: turno_jugador_id -> total paid
    const paidMap = new Map<string, number>();
    (allPagos || []).forEach((p: any) => {
      const current = paidMap.get(p.id_turno_jugador) || 0;
      paidMap.set(p.id_turno_jugador, current + Number(p.monto));
    });

    // Step 5: Map to response shape
    const data = turnos.map((t: any) => {
      const players = (t.turno_jugadores || [])
        .filter((p: any) => Number(p.monto_generado) > 0)
        .map((p: any) => {
          const montoGenerado = Number(p.monto_generado) || 0;
          const totalPagado = paidMap.get(p.id) || 0;
          const saldoPendiente = Math.max(0, montoGenerado - totalPagado);
          const nombre =
            p.usuarios?.nombre || p.nombre_invitado || 'Sin nombre';

          return {
            turno_jugador_id: p.id,
            nombre,
            tipo_persona: p.tipo_persona,
            uso_abono: p.uso_abono,
            monto_generado: montoGenerado,
            total_pagado: totalPagado,
            saldo_pendiente: saldoPendiente,
            estado_pago: p.estado_pago,
          };
        });

      const totalPendiente = players.reduce(
        (sum: number, p: any) => sum + p.saldo_pendiente,
        0,
      );

      return {
        turno_id: t.id,
        fecha: t.fecha,
        hora_inicio: t.hora_inicio,
        court_id: t.id_cancha,
        court_name: t.canchas?.nombre || `Cancha ${t.id_cancha}`,
        players,
        total_pendiente: totalPendiente,
      };
    });

    // Filter out turnos where all players are already paid
    const filtered = data.filter((t: any) => t.total_pendiente > 0);

    return PaginatedResponseDto.create(filtered, page, pageSize, count || 0);
  }

  async registerPayment(
    dto: RegisterPaymentDto,
    adminName: string,
    accessToken: string,
  ) {
    try {
    const client = this.supabaseService.getClient();

    this.logger.log(`registerPayment: turno_jugador_id=${dto.turno_jugador_id}, monto=${dto.monto}`);

    // Fetch player + existing payments in parallel (2 queries instead of 3 sequential)
    const [playerResult, pagosResult] = await Promise.all([
      client
        .from('turno_jugadores')
        .select('id, monto_generado, estado_pago, id_persona')
        .eq('id', dto.turno_jugador_id)
        .single(),
      client
        .from('pagos')
        .select('monto')
        .eq('id_turno_jugador', dto.turno_jugador_id)
        .in('tipo', ['pago', 'bonificacion', 'devolucion']),
    ]);

    if (playerResult.error || !playerResult.data) {
      this.logger.error('Error fetching player', playerResult.error);
      throw new NotFoundException('Jugador no encontrado');
    }

    const player = playerResult.data;

    this.logger.log(`Player found: estado_pago=${player.estado_pago}, monto_generado=${player.monto_generado}, id_persona=${player.id_persona}`);

    if (player.estado_pago !== 'pendiente') {
      throw new BadRequestException('Este jugador ya está pagado');
    }

    // Compute remaining from already-fetched data (no extra query)
    const montoGenerado = Number(player.monto_generado) || 0;
    const totalPaid = (pagosResult.data || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto), 0,
    );
    const remaining = Math.max(0, montoGenerado - totalPaid);

    this.logger.log(`Remaining debt: ${remaining}`);

    if (remaining <= 0) {
      throw new BadRequestException('Este jugador no tiene deuda pendiente');
    }

    if (dto.monto > remaining + 0.01) {
      throw new BadRequestException(
        `El monto ($${dto.monto}) supera la deuda pendiente ($${remaining})`,
      );
    }

    // Cap monto to remaining to handle floating point
    const monto = Math.min(dto.monto, remaining);

    // Get socio id for the payment record
    const socioId = await this.getSocioId(player.id_persona, client);
    this.logger.log(`Socio ID: ${socioId}`);

    // Insert payment
    const { error: insertError } = await client.from('pagos').insert({
      id_turno_jugador: dto.turno_jugador_id,
      id_socio: socioId,
      monto: monto,
      tipo: 'pago',
      medio: dto.medio || null,
      observacion: dto.observacion || `Cobro por ${adminName}`,
    });

    if (insertError) {
      this.logger.error('Error inserting payment', JSON.stringify(insertError));
      throw new InternalServerErrorException(
        `Error al registrar el pago: ${insertError.message || insertError.code || 'desconocido'}`,
      );
    }

    const newRemaining = remaining - monto;

    // If fully paid, update estado_pago
    if (newRemaining <= 0.01) {
      const { error: updateError } = await client
        .from('turno_jugadores')
        .update({ estado_pago: 'pagado' })
        .eq('id', dto.turno_jugador_id);

      if (updateError) {
        this.logger.error('Error updating estado_pago', updateError);
      }
    }

    return {
      remaining: Math.max(0, newRemaining),
      estado_pago: newRemaining <= 0.01 ? 'pagado' : 'pendiente',
    };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Unexpected error in registerPayment', error?.toString(), (error as any)?.stack);
      throw new InternalServerErrorException(`Error inesperado: ${error?.toString()}`);
    }
  }

  async giftPayment(
    dto: GiftPaymentDto,
    adminName: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getClient();

    // Fetch player + existing payments in parallel (2 queries instead of 3 sequential)
    const [playerResult, pagosResult] = await Promise.all([
      client
        .from('turno_jugadores')
        .select('id, monto_generado, estado_pago, id_persona')
        .eq('id', dto.turno_jugador_id)
        .single(),
      client
        .from('pagos')
        .select('monto')
        .eq('id_turno_jugador', dto.turno_jugador_id)
        .in('tipo', ['pago', 'bonificacion', 'devolucion']),
    ]);

    if (playerResult.error || !playerResult.data) {
      throw new NotFoundException('Jugador no encontrado');
    }

    const player = playerResult.data;

    if (player.estado_pago !== 'pendiente') {
      throw new BadRequestException('Este jugador ya está pagado');
    }

    // Compute remaining from already-fetched data
    const montoGenerado = Number(player.monto_generado) || 0;
    const totalPaid = (pagosResult.data || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto), 0,
    );
    const remaining = Math.max(0, montoGenerado - totalPaid);

    if (remaining <= 0) {
      throw new BadRequestException('No hay deuda pendiente');
    }

    const socioId = await this.getSocioId(player.id_persona, client);

    // Insert bonificacion + mark as bonificado in parallel
    const [insertResult, updateResult] = await Promise.all([
      client.from('pagos').insert({
        id_turno_jugador: dto.turno_jugador_id,
        id_socio: socioId,
        monto: remaining,
        tipo: 'bonificacion',
        observacion: dto.observacion
          ? `Regalo por ${adminName}: ${dto.observacion}`
          : `Regalo por ${adminName}`,
      }),
      client
        .from('turno_jugadores')
        .update({ estado_pago: 'bonificado' })
        .eq('id', dto.turno_jugador_id),
    ]);

    if (insertResult.error) {
      this.logger.error('Error inserting gift payment', insertResult.error);
      throw new InternalServerErrorException('Error al registrar el regalo');
    }

    return { success: true };
  }

  async payAllForTurno(
    dto: PayAllDto,
    adminName: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getClient();

    // Fetch all pending players for this turno
    const { data: players, error: playersError } = await client
      .from('turno_jugadores')
      .select('id, monto_generado, estado_pago, id_persona')
      .eq('id_turno', dto.turno_id)
      .eq('estado_pago', 'pendiente')
      .gt('monto_generado', 0);

    if (playersError) {
      this.logger.error('Error fetching players for pay-all', playersError);
      throw new InternalServerErrorException('Error al obtener jugadores');
    }

    if (!players || players.length === 0) {
      throw new BadRequestException('No hay jugadores con deuda pendiente');
    }

    const playerIds = players.map((p: any) => p.id);
    const userIds = players.map((p: any) => p.id_persona).filter(Boolean);

    // Batch-fetch existing payments and socios in parallel (2 queries instead of N*3)
    const [pagosResult, sociosResult] = await Promise.all([
      client
        .from('pagos')
        .select('id_turno_jugador, monto')
        .in('id_turno_jugador', playerIds)
        .in('tipo', ['pago', 'bonificacion', 'devolucion']),
      userIds.length > 0
        ? client
            .from('socios')
            .select('id, id_usuario')
            .in('id_usuario', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build paid map
    const paidMap = new Map<string, number>();
    (pagosResult.data || []).forEach((p: any) => {
      const current = paidMap.get(p.id_turno_jugador) || 0;
      paidMap.set(p.id_turno_jugador, current + Number(p.monto));
    });

    // Build socio map
    const socioMap = new Map<string, string>();
    ((sociosResult as any).data || []).forEach((s: any) =>
      socioMap.set(s.id_usuario, s.id),
    );

    // Calculate remaining debts and build batch insert
    const pagosToInsert: any[] = [];
    const paidPlayerIds: string[] = [];
    let totalPaid = 0;

    for (const player of players) {
      const montoGenerado = Number(player.monto_generado) || 0;
      const alreadyPaid = paidMap.get(player.id) || 0;
      const remaining = Math.max(0, montoGenerado - alreadyPaid);

      if (remaining <= 0) continue;

      pagosToInsert.push({
        id_turno_jugador: player.id,
        id_socio: player.id_persona ? socioMap.get(player.id_persona) || null : null,
        monto: remaining,
        tipo: 'pago',
        medio: dto.medio || null,
        observacion: `Pago total por ${adminName}`,
      });

      paidPlayerIds.push(player.id);
      totalPaid += remaining;
    }

    if (pagosToInsert.length === 0) {
      return { players_paid: 0, total_paid: 0 };
    }

    // Batch insert all payments + batch update all estados (2 queries instead of N*2)
    const [insertResult, updateResult] = await Promise.all([
      client.from('pagos').insert(pagosToInsert),
      client
        .from('turno_jugadores')
        .update({ estado_pago: 'pagado' })
        .in('id', paidPlayerIds),
    ]);

    if (insertResult.error) {
      this.logger.error('Error batch-inserting payments', insertResult.error);
      throw new InternalServerErrorException('Error al registrar pagos');
    }

    if (updateResult.error) {
      this.logger.error('Error batch-updating estado_pago', updateResult.error);
    }

    return { players_paid: paidPlayerIds.length, total_paid: totalPaid };
  }

  async getMonthlyRevenue() {
    const client = this.supabaseService.getClient();
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}T23:59:59`;

    // Include both regular payments and recurring payments
    const [pagosResult, recurrentesResult] = await Promise.all([
      client
        .from('pagos')
        .select('monto')
        .eq('tipo', 'pago')
        .gte('fecha', firstDay)
        .lte('fecha', lastDayStr),
      client
        .from('movimientos_recurrentes')
        .select('monto')
        .eq('tipo', 'pago')
        .gte('fecha', firstDay)
        .lte('fecha', lastDayStr),
    ]);

    if (pagosResult.error) {
      this.logger.error('Error fetching monthly revenue', pagosResult.error);
      return { total: 0 };
    }

    const totalPagos = (pagosResult.data || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto),
      0,
    );
    const totalRecurrentes = (recurrentesResult.data || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto),
      0,
    );

    return { total: totalPagos + totalRecurrentes };
  }

  private async computeRemainingDebt(
    turnoJugadorId: string,
    client: any,
  ): Promise<number> {
    // Get monto_generado
    const { data: player } = await client
      .from('turno_jugadores')
      .select('monto_generado')
      .eq('id', turnoJugadorId)
      .single();

    const montoGenerado = Number(player?.monto_generado) || 0;

    // Sum positive payments (pago, bonificacion, devolucion)
    const { data: pagos } = await client
      .from('pagos')
      .select('monto')
      .eq('id_turno_jugador', turnoJugadorId)
      .in('tipo', ['pago', 'bonificacion', 'devolucion']);

    const totalPaid = (pagos || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto),
      0,
    );

    return Math.max(0, montoGenerado - totalPaid);
  }

  private async getSocioId(
    userId: string | null,
    client: any,
  ): Promise<string | null> {
    if (!userId) return null;

    const { data: socio } = await client
      .from('socios')
      .select('id')
      .eq('id_usuario', userId)
      .single();

    return socio?.id || null;
  }
}
