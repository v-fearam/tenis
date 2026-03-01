import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBloqueoDto } from './dto/bloqueo.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@Injectable()
export class BloqueosService {
  private readonly logger = new Logger(BloqueosService.name);
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

  async create(
    createBloqueoDto: CreateBloqueoDto,
    creatorId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { fecha, fecha_fin, fechas, ...rest } = createBloqueoDto;

    const datesToBlock: string[] = [];

    // 1. Handle explicit list of dates
    if (fechas && fechas.length > 0) {
      datesToBlock.push(...fechas);
    }

    // 2. Handle date range (from fecha to fecha_fin)
    if (fecha && fecha_fin) {
      const current = new Date(fecha + 'T12:00:00'); // Use mid-day to avoid TZ issues
      const last = new Date(fecha_fin + 'T12:00:00');

      while (current <= last) {
        datesToBlock.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    // 3. Handle single date if no list or range
    else if (fecha) {
      if (!datesToBlock.includes(fecha)) {
        datesToBlock.push(fecha);
      }
    }

    // De-duplicate dates
    const uniqueDates = [...new Set(datesToBlock)];

    const insertions = uniqueDates.map((d) => ({
      ...rest,
      fecha: d,
      creado_por: creatorId,
    }));

    const { data, error } = await client
      .from('bloqueos')
      .insert(insertions)
      .select();

    if (error) {
      this.logger.error('Error creating bloqueos', error);
      throw new InternalServerErrorException('Error al crear los bloqueos');
    }

    return data;
  }

  async findAll(
    paginationDto: PaginationDto,
    accessToken?: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<PaginatedResponseDto<any>> {
    const client = this.supabaseService.getOptionalClient(accessToken);
    const page = paginationDto.page || 1;
    const pageSize = paginationDto.pageSize || this.defaultPageSize;
    const offset = (page - 1) * pageSize;

    // Get total count
    let countQuery = client
      .from('bloqueos')
      .select('*', { count: 'exact', head: true });
    if (fechaDesde) countQuery = countQuery.gte('fecha', fechaDesde);
    if (fechaHasta) countQuery = countQuery.lte('fecha', fechaHasta);

    const { count, error: countError } = await countQuery;

    if (countError) {
      this.logger.error('Error counting bloqueos', countError);
      throw new InternalServerErrorException('Error al contar los bloqueos');
    }

    // Get paginated data
    let dataQuery = client
      .from('bloqueos')
      .select('*, canchas(nombre)')
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (fechaDesde) dataQuery = dataQuery.gte('fecha', fechaDesde);
    if (fechaHasta) dataQuery = dataQuery.lte('fecha', fechaHasta);

    const { data, error } = await dataQuery;

    if (error) {
      this.logger.error('Error fetching bloqueos', error);
      throw new InternalServerErrorException('Error al obtener los bloqueos');
    }

    return PaginatedResponseDto.create(data || [], page, pageSize, count || 0);
  }

  async findByDate(fecha: string, accessToken?: string) {
    const client = this.supabaseService.getOptionalClient(accessToken);
    const { data, error } = await client
      .from('bloqueos')
      .select('*')
      .eq('fecha', fecha);

    if (error) {
      this.logger.error('Error fetching bloqueos by date', error);
      throw new InternalServerErrorException(
        'Error al obtener bloqueos del día',
      );
    }
    return data;
  }

  async delete(id: string, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);
    const { error } = await client.from('bloqueos').delete().eq('id', id);

    if (error) {
      this.logger.error('Error deleting bloqueo', error);
      throw new InternalServerErrorException('Error al eliminar el bloqueo');
    }
    return { success: true };
  }

  async purgeByMonth(mes: number, anio: number, accessToken: string) {
    const client = this.supabaseService.getAuthenticatedClient(accessToken);

    const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(anio, mes, 0).getDate();
    const fechaHasta = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    this.logger.log(`Purging bloqueos from ${fechaDesde} to ${fechaHasta}`);

    const { count, error } = await client
      .from('bloqueos')
      .delete({ count: 'exact' })
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta);

    if (error) {
      this.logger.error('Error purging bloqueos', error);
      throw new InternalServerErrorException('Error al depurar bloqueos');
    }

    this.logger.log(`Purge complete: ${count} bloqueos deleted`);
    return { bloqueos_eliminados: count || 0 };
  }
}
