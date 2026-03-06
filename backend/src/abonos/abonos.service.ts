import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AssignAbonoDto,
  CreateAbonoTypeDto,
  UpdateAbonoTypeDto,
} from './dto/abono.dto';

@Injectable()
export class AbonosService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) { }

  // --- TYPES CRUD ---

  async findAllTypes(accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { data, error } = await client
      .from('tipos_abono')
      .select('*')
      .order('precio', { ascending: true });

    if (error) throw error;
    return data;
  }

  async createType(dto: CreateAbonoTypeDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { data, error } = await client
      .from('tipos_abono')
      .insert({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateType(id: string, dto: UpdateAbonoTypeDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { data, error } = await client
      .from('tipos_abono')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteType(id: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // Check if any socio has this type assigned
    const { count } = await client
      .from('socios')
      .select('*', { count: 'exact', head: true })
      .eq('id_tipo_abono', id);

    if (count && count > 0) {
      throw new BadRequestException(
        `No se puede eliminar: hay ${count} socio(s) con este abono asignado`,
      );
    }

    const { error } = await client.from('tipos_abono').delete().eq('id', id);

    if (error) throw error;
    return { message: 'Tipo de abono eliminado' };
  }

  // --- STATS ---

  async getAbonoStats(accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data: socios, error } = await client
      .from('socios')
      .select('id_tipo_abono, tipo_abono:tipos_abono(id, nombre, color)')
      .not('id_tipo_abono', 'is', null);

    if (error) throw error;

    const counts = new Map<string, { nombre: string; color: string; count: number }>();
    for (const s of socios || []) {
      const tipo = s.tipo_abono as any;
      if (!tipo) continue;
      if (counts.has(tipo.id)) {
        counts.get(tipo.id)!.count += 1;
      } else {
        counts.set(tipo.id, { nombre: tipo.nombre, color: tipo.color || '#3498DB', count: 1 });
      }
    }

    // Count socios without abono
    const { count: sinAbono } = await client
      .from('socios')
      .select('*', { count: 'exact', head: true })
      .is('id_tipo_abono', null);

    return {
      por_tipo: Array.from(counts.entries()).map(([id, v]) => ({
        tipo_abono_id: id,
        ...v,
      })),
      sin_abono: sinAbono || 0,
    };
  }

  // --- ASSIGNMENT ---

  async assign(dto: AssignAbonoDto, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // 1. Fetch tipo_abono to get credits
    const { data: tipo, error: tipoError } = await client
      .from('tipos_abono')
      .select('*')
      .eq('id', dto.tipo_abono_id)
      .single();

    if (tipoError || !tipo) {
      throw new BadRequestException('Tipo de abono no encontrado');
    }

    // 2. Update socio with FK and credits
    const { data, error } = await client
      .from('socios')
      .update({
        id_tipo_abono: dto.tipo_abono_id,
        creditos_disponibles: tipo.creditos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.socio_id)
      .select('*, tipo_abono:tipos_abono(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async consumeCredit(socioId: string, accessToken?: string, amount: number = 1): Promise<boolean> {
    const client = accessToken
      ? this.supabaseService.getAuthenticatedClient(accessToken)
      : this.supabaseService.getClient();

    const { data: socio, error } = await client
      .from('socios')
      .select('id, id_tipo_abono, creditos_disponibles')
      .eq('id', socioId)
      .single();

    if (
      error ||
      !socio ||
      !socio.id_tipo_abono ||
      Number(socio.creditos_disponibles) < amount
    ) {
      return false;
    }

    const { error: updateError } = await client
      .from('socios')
      .update({
        creditos_disponibles: Number(socio.creditos_disponibles) - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', socioId);

    if (updateError) throw updateError;
    return true;
  }

  async removeAbono(socioId: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const { data, error } = await client
      .from('socios')
      .update({
        id_tipo_abono: null,
        creditos_disponibles: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', socioId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // --- CIERRE MENSUAL ---

  async getCierrePendiente() {
    const client = this.supabaseService.getClient();
    const tz = 'America/Argentina/Buenos_Aires';

    const now = new Date();
    // Previous month first day in AR timezone
    const ar = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' });
    const [year, month] = ar.format(now).split('-').map(Number);
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const mesAnio = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;

    const { data } = await client
      .from('cierres_mensuales')
      .select('id')
      .eq('mes_anio', mesAnio)
      .maybeSingle();

    const mesNombre = new Date(`${mesAnio}T12:00:00`).toLocaleDateString('es-AR', {
      month: 'long', year: 'numeric', timeZone: tz,
    });

    return { pendiente: !data, mes: mesNombre, mes_anio: mesAnio };
  }

  async ejecutarCierreMensual(accessToken: string, adminUserId: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    // 1. Determine the month being closed (= previous month) and the boundary dates
    //    The cierre is always run at the start of the new month to close the previous one.
    //    e.g. run on April 5 → closes March (mesAnio='2026-03-01', boundary='2026-04-01')
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const mesAnio = `${firstDayPrevMonth.getFullYear()}-${String(firstDayPrevMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const mesAnioActual = `${firstDayCurrentMonth.getFullYear()}-${String(firstDayCurrentMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // 2. Check for duplicate closing
    const { data: existing } = await client
      .from('cierres_mensuales')
      .select('id')
      .eq('mes_anio', mesAnio)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        `Ya se realizó el cierre del mes ${mesAnio}. No se puede ejecutar dos veces.`,
      );
    }

    // 3. Compute abono revenue: snapshot of socios with abono assigned right now
    //    (these are the socios who had abono during the previous month, before reset)
    const { data: sociosConAbono, error: sociosError } = await client
      .from('socios')
      .select('id, id_tipo_abono, tipo_abono:tipos_abono(id, nombre, precio)')
      .not('id_tipo_abono', 'is', null);

    if (sociosError) throw sociosError;

    // 4. Group by tipo_abono for breakdown
    const abonoGroups = new Map<
      string,
      { tipo_abono_id: string; nombre: string; precio: number; cantidad_socios: number }
    >();
    let totalIngresoAbonos = 0;

    for (const s of sociosConAbono || []) {
      const tipo = s.tipo_abono as any;
      if (!tipo) continue;
      totalIngresoAbonos += Number(tipo.precio);
      const key = tipo.id;
      if (abonoGroups.has(key)) {
        abonoGroups.get(key)!.cantidad_socios += 1;
      } else {
        abonoGroups.set(key, {
          tipo_abono_id: tipo.id,
          nombre: tipo.nombre,
          precio: Number(tipo.precio),
          cantidad_socios: 1,
        });
      }
    }

    // 5. Compute turnos revenue: payments collected during the previous month
    const { data: pagos, error: pagosError } = await client
      .from('pagos')
      .select('monto')
      .eq('tipo', 'pago')
      .gte('fecha', mesAnio)
      .lt('fecha', mesAnioActual);

    if (pagosError) throw pagosError;

    const totalIngresoTurnos = (pagos || []).reduce(
      (sum, p) => sum + Number(p.monto),
      0,
    );

    // 5b. Compute recurrentes revenue: payments collected during the previous month
    const { data: pagosRecurrentes, error: recurrentesError } = await client
      .from('movimientos_recurrentes')
      .select('monto')
      .eq('tipo', 'pago')
      .gte('fecha', mesAnio)
      .lt('fecha', mesAnioActual);

    if (recurrentesError) throw recurrentesError;

    const totalIngresoRecurrentes = (pagosRecurrentes || []).reduce(
      (sum, p) => sum + Number(p.monto),
      0,
    );

    // 6. Insert cierre record
    const { data: cierre, error: insertError } = await client
      .from('cierres_mensuales')
      .insert({
        mes_anio: mesAnio,
        ingreso_abonos: totalIngresoAbonos,
        ingreso_turnos: totalIngresoTurnos,
        ingreso_recurrentes: totalIngresoRecurrentes,
        cantidad_socios_con_abono: (sociosConAbono || []).length,
        detalle_abonos: Array.from(abonoGroups.values()),
        ejecutado_por: adminUserId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 7. Clear ALL socios' abono assignments
    const { error: clearError } = await client
      .from('socios')
      .update({
        id_tipo_abono: null,
        creditos_disponibles: 0,
        updated_at: new Date().toISOString(),
      })
      .not('id_tipo_abono', 'is', null);

    if (clearError) throw clearError;

    return cierre;
  }
}
