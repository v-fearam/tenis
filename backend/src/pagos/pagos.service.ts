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
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
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

    // Step 2: Count total matching turnos
    const { count, error: countError } = await client
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .in('id', turnoIds)
      .eq('estado', 'confirmado');

    if (countError) {
      this.logger.error('Error counting unpaid turnos', countError);
      throw new InternalServerErrorException('Error al contar turnos impagos');
    }

    // Step 3: Get paginated turnos with players
    const { data: turnos, error: turnosError } = await client
      .from('turnos')
      .select('id, id_cancha, fecha, hora_inicio, canchas(nombre), turno_jugadores(id, id_persona, tipo_persona, nombre_invitado, uso_abono, monto_generado, estado_pago, usuarios:id_persona(nombre))')
      .in('id', turnoIds)
      .eq('estado', 'confirmado')
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (turnosError) {
      this.logger.error('Error fetching unpaid turnos', turnosError);
      throw new InternalServerErrorException('Error al obtener turnos impagos');
    }

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
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // Fetch player record
    const { data: player, error: playerError } = await client
      .from('turno_jugadores')
      .select('id, monto_generado, estado_pago, id_persona')
      .eq('id', dto.turno_jugador_id)
      .single();

    if (playerError || !player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (player.estado_pago !== 'pendiente') {
      throw new BadRequestException('Este jugador ya está pagado');
    }

    const remaining = await this.computeRemainingDebt(dto.turno_jugador_id, client);

    if (dto.monto > remaining) {
      throw new BadRequestException(
        `El monto ($${dto.monto}) supera la deuda pendiente ($${remaining})`,
      );
    }

    // Get socio id for the payment record
    const socioId = await this.getSocioId(player.id_persona, client);

    // Insert payment
    const { error: insertError } = await client.from('pagos').insert({
      id_turno_jugador: dto.turno_jugador_id,
      id_socio: socioId,
      monto: dto.monto,
      tipo: 'pago',
      medio: dto.medio || null,
      observacion: dto.observacion || `Cobro por ${adminName}`,
    });

    if (insertError) {
      this.logger.error('Error inserting payment', insertError);
      throw new InternalServerErrorException('Error al registrar el pago');
    }

    const newRemaining = remaining - dto.monto;

    // If fully paid, update estado_pago
    if (newRemaining <= 0) {
      await client
        .from('turno_jugadores')
        .update({ estado_pago: 'pagado' })
        .eq('id', dto.turno_jugador_id);
    }

    return {
      remaining: Math.max(0, newRemaining),
      estado_pago: newRemaining <= 0 ? 'pagado' : 'pendiente',
    };
  }

  async giftPayment(
    dto: GiftPaymentDto,
    adminName: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: player, error: playerError } = await client
      .from('turno_jugadores')
      .select('id, monto_generado, estado_pago, id_persona')
      .eq('id', dto.turno_jugador_id)
      .single();

    if (playerError || !player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (player.estado_pago !== 'pendiente') {
      throw new BadRequestException('Este jugador ya está pagado');
    }

    const remaining = await this.computeRemainingDebt(dto.turno_jugador_id, client);

    if (remaining <= 0) {
      throw new BadRequestException('No hay deuda pendiente');
    }

    const socioId = await this.getSocioId(player.id_persona, client);

    // Insert bonificacion
    const { error: insertError } = await client.from('pagos').insert({
      id_turno_jugador: dto.turno_jugador_id,
      id_socio: socioId,
      monto: remaining,
      tipo: 'bonificacion',
      observacion: dto.observacion
        ? `Regalo por ${adminName}: ${dto.observacion}`
        : `Regalo por ${adminName}`,
    });

    if (insertError) {
      this.logger.error('Error inserting gift payment', insertError);
      throw new InternalServerErrorException('Error al registrar el regalo');
    }

    // Mark as bonificado
    await client
      .from('turno_jugadores')
      .update({ estado_pago: 'bonificado' })
      .eq('id', dto.turno_jugador_id);

    return { success: true };
  }

  async payAllForTurno(
    dto: PayAllDto,
    adminName: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

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

    let playersPaid = 0;
    let totalPaid = 0;

    for (const player of players) {
      const remaining = await this.computeRemainingDebt(player.id, client);
      if (remaining <= 0) continue;

      const socioId = await this.getSocioId(player.id_persona, client);

      const { error: insertError } = await client.from('pagos').insert({
        id_turno_jugador: player.id,
        id_socio: socioId,
        monto: remaining,
        tipo: 'pago',
        medio: dto.medio || null,
        observacion: `Pago total por ${adminName}`,
      });

      if (insertError) {
        this.logger.error(`Error paying player ${player.id}`, insertError);
        continue;
      }

      await client
        .from('turno_jugadores')
        .update({ estado_pago: 'pagado' })
        .eq('id', player.id);

      playersPaid++;
      totalPaid += remaining;
    }

    return { players_paid: playersPaid, total_paid: totalPaid };
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
