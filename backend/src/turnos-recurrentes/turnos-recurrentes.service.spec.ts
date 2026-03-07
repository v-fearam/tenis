import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TurnosRecurrentesService } from './turnos-recurrentes.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';

const USER_ID = 'uuid-admin-001';

describe('TurnosRecurrentesService', () => {
  let service: TurnosRecurrentesService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnosRecurrentesService,
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compile();
    service = module.get<TurnosRecurrentesService>(TurnosRecurrentesService);
  };

  // ---------------------------------------------------------------------------
  describe('generateDates (via checkAvailability)', () => {
    // Use 2026-06-08 (Monday) to 2026-06-14 (Sunday), dias_semana=[1] (Monday ISO)
    const dto = {
      id_cancha: 1,
      hora_inicio: '09:00',
      fecha_desde: '2026-06-08',
      fecha_hasta: '2026-06-14',
      dias_semana: [1], // Monday only
    };

    it('generates only the days matching dias_semana', async () => {
      await buildModule({
        turnos: [{ data: [], error: null }],
        bloqueos: [{ data: [], error: null }],
        config_sistema: [{ data: [{ clave: 'precio_socio_sin_abono', valor: '1200' }, { clave: 'descuento_recurrente', valor: '20' }], error: null }],
      });

      const result = await service.checkAvailability(dto);

      // Only 1 Monday in that week
      expect(result.fechas_disponibles).toEqual(['2026-06-08']);
      expect(result.hora_fin).toBe('10:30'); // 09:00 + 90min
    });

    it('returns multiple dates for multiple matching days', async () => {
      // Mon + Wed in a 2-week range (2026-06-08 to 2026-06-21)
      const multiDto = { ...dto, fecha_hasta: '2026-06-21', dias_semana: [1, 3] };

      await buildModule({
        turnos: [{ data: [], error: null }],
        bloqueos: [{ data: [], error: null }],
        config_sistema: [{ data: [], error: null }],
      });

      const result = await service.checkAvailability(multiDto);

      // Mon 06-08, Wed 06-10, Mon 06-15, Wed 06-17
      expect(result.fechas_disponibles).toHaveLength(4);
      expect(result.fechas_disponibles[0]).toBe('2026-06-08');
      expect(result.fechas_disponibles[1]).toBe('2026-06-10');
    });

    it('throws BadRequestException if no dates match dias_semana in range', async () => {
      // 7-day range, sunday only, but range has no Sundays
      const badDto = {
        ...dto,
        fecha_desde: '2026-06-08',
        fecha_hasta: '2026-06-13', // Mon-Sat only
        dias_semana: [7], // Sunday
      };

      await buildModule();

      await expect(service.checkAvailability(badDto)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('checkAvailability', () => {
    const dto = {
      id_cancha: 1,
      hora_inicio: '09:00',
      fecha_desde: '2026-06-08',
      fecha_hasta: '2026-06-22',
      dias_semana: [1], // Mondays: 06-08, 06-15, 06-22
    };

    it('excludes conflicting dates from fechas_disponibles', async () => {
      await buildModule({
        turnos: [{ data: [{ fecha: '2026-06-15' }], error: null }], // conflict on 06-15
        bloqueos: [{ data: [], error: null }],
        config_sistema: [{ data: [], error: null }],
      });

      const result = await service.checkAvailability(dto);

      expect(result.fechas_disponibles).not.toContain('2026-06-15');
      expect(result.conflictos).toHaveLength(1);
      expect(result.conflictos[0]).toMatchObject({ fecha: '2026-06-15', motivo: 'turno existente' });
    });

    it('excludes blocked dates', async () => {
      await buildModule({
        turnos: [{ data: [], error: null }],
        bloqueos: [{ data: [{ fecha: '2026-06-22' }], error: null }], // block on 06-22
        config_sistema: [{ data: [], error: null }],
      });

      const result = await service.checkAvailability(dto);

      expect(result.fechas_disponibles).not.toContain('2026-06-22');
      expect(result.conflictos[0]).toMatchObject({ fecha: '2026-06-22', motivo: 'bloqueo' });
    });

    it('calculates precio_sugerido with discount applied', async () => {
      await buildModule({
        turnos: [{ data: [], error: null }],
        bloqueos: [{ data: [], error: null }],
        config_sistema: [{
          data: [
            { clave: 'precio_socio_sin_abono', valor: '1200' },
            { clave: 'descuento_recurrente', valor: '20' },
          ],
          error: null,
        }],
      });

      const result = await service.checkAvailability(dto);

      // 3 Mondays available, price = 1200 * 0.8 = 960 per session, total = 2880
      expect(result.precio_unitario_base).toBe(1200);
      expect(result.descuento_aplicado).toBe(20);
      expect(result.precio_sugerido).toBe(2880); // 3 × 960
    });
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      id_cancha: 1,
      hora_inicio: '09:00',
      fecha_desde: '2026-06-08',
      fecha_hasta: '2026-06-22',
      dias_semana: [1], // Mondays: 06-08, 06-15, 06-22
      monto_total: 2880,
      nombre: 'Recurrencia Test',
      id_usuario_responsable: 'uuid-socio-001',
    };

    it('calculates precio_unitario as monto_total / available dates', async () => {
      const recurrente = { id: 'uuid-rec-001', nombre: 'Recurrencia Test' };

      await buildModule({
        turnos: [
          { data: [], error: null },    // conflict check (Promise.all)
          { data: null, error: null },  // insert turnos
        ],
        bloqueos: [{ data: [], error: null }],  // conflict check (Promise.all)
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],  // resolve usuario→socio
        turnos_recurrentes: [{ data: recurrente, error: null }],  // insert recurrente
      });

      const result = await service.create(dto, USER_ID);

      // 3 Mondays, no conflicts → precio_unitario = 2880 / 3 = 960
      expect(result.precio_unitario).toBe(960);
      expect(result.turnos_creados).toBe(3);
    });

    it('creates turnos in estado=confirmado (not pendiente)', async () => {
      const recurrente = { id: 'uuid-rec-001', nombre: 'Recurrencia Test' };

      await buildModule({
        turnos: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        bloqueos: [{ data: [], error: null }],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],
        turnos_recurrentes: [{ data: recurrente, error: null }],
      });

      await service.create(dto, USER_ID);

      const turnosInserted = mockClient.from('turnos').insert.mock.calls[0][0];
      turnosInserted.forEach((t: any) => {
        expect(t.estado).toBe('confirmado');
      });
    });

    it('filters out conflicting dates before creating turnos', async () => {
      const recurrente = { id: 'uuid-rec-001', nombre: 'Recurrencia Test' };

      await buildModule({
        turnos: [
          { data: [{ fecha: '2026-06-15' }], error: null }, // conflict on 06-15
          { data: null, error: null },
        ],
        bloqueos: [{ data: [], error: null }],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],
        turnos_recurrentes: [{ data: recurrente, error: null }],
      });

      const result = await service.create(dto, USER_ID);

      // Only 2 dates (06-08 and 06-22) are available
      expect(result.turnos_creados).toBe(2);
      const turnosInserted = mockClient.from('turnos').insert.mock.calls[0][0];
      expect(turnosInserted).toHaveLength(2);
      expect(turnosInserted.map((t: any) => t.fecha)).not.toContain('2026-06-15');
    });

    it('throws BadRequestException if usuario is not a socio', async () => {
      await buildModule({
        turnos: [{ data: [], error: null }],
        bloqueos: [{ data: [], error: null }],
        socios: [{ data: null, error: null }], // not a socio
      });

      await expect(service.create(dto, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if all dates have conflicts', async () => {
      await buildModule({
        turnos: [
          { data: [{ fecha: '2026-06-08' }, { fecha: '2026-06-15' }, { fecha: '2026-06-22' }], error: null },
        ],
        bloqueos: [{ data: [], error: null }],
      });

      await expect(service.create(dto, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancelAll', () => {
    it('cancels all future turnos and marks recurrencia as cancelada', async () => {
      const recurrente = { id: 'uuid-rec-001', estado: 'activa' };
      const futuros = [
        { id: 'turno-f1', monto_recurrente: 960 },
        { id: 'turno-f2', monto_recurrente: 960 },
      ];

      await buildModule({
        turnos_recurrentes: [
          { data: recurrente, error: null },   // single: fetch recurrente
          { data: null, error: null },          // update to cancelada (Promise.all)
        ],
        turnos: [
          { data: futuros, error: null },       // fetch futuros
          { data: null, error: null },           // update futuros to cancelado (Promise.all)
        ],
      });

      const result = await service.cancelAll('uuid-rec-001');

      expect(result.monto_liberado).toBe(1920); // 960 + 960
      expect(result.turnos_cancelados).toBe(2);

      // Verify turnos_recurrentes was updated to cancelada
      const updateCall = mockClient.from('turnos_recurrentes').update.mock.calls[0][0];
      expect(updateCall.estado).toBe('cancelada');
    });

    it('returns monto_liberado = 0 if no future turnos exist', async () => {
      const recurrente = { id: 'uuid-rec-001', estado: 'activa' };

      await buildModule({
        turnos_recurrentes: [
          { data: recurrente, error: null },
          { data: null, error: null },
        ],
        turnos: [
          { data: [], error: null },  // no future turnos
          { data: null, error: null },
        ],
      });

      const result = await service.cancelAll('uuid-rec-001');

      expect(result.monto_liberado).toBe(0);
      expect(result.turnos_cancelados).toBe(0);
    });

    it('throws NotFoundException if recurrencia does not exist', async () => {
      await buildModule({
        turnos_recurrentes: [{ data: null, error: null }],
      });

      await expect(service.cancelAll('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if recurrencia already cancelled', async () => {
      await buildModule({
        turnos_recurrentes: [{ data: { id: 'uuid-rec-001', estado: 'cancelada' }, error: null }],
      });

      await expect(service.cancelAll('uuid-rec-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('findOne — debt calculation', () => {
    it('calculates deuda, comprometido and saldo correctly', async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      const pastDate = '2026-01-15'; // always in the past
      const futureDate = '2099-01-15'; // always in the future

      const recurrente = {
        id: 'uuid-rec-001',
        nombre: 'Recurrencia Test',
        id_cancha: 1,
        canchas: { nombre: 'Cancha 1' },
        socios: { usuarios: { nombre: 'Socio Test' } },
        dias_semana: [1],
        hora_inicio: '09:00',
        hora_fin: '10:30',
        fecha_desde: '2026-01-01',
        fecha_hasta: '2099-12-31',
        precio_unitario_original: 960,
        estado: 'activa',
        created_at: '2026-01-01T00:00:00Z',
      };

      const turnos = [
        { id: 't1', fecha: pastDate, estado: 'confirmado', monto_recurrente: 960 },  // deuda
        { id: 't2', fecha: futureDate, estado: 'confirmado', monto_recurrente: 960 }, // comprometido
      ];

      const movimientos = [{ monto: 500 }]; // pagado

      await buildModule({
        turnos_recurrentes: [{ data: recurrente, error: null }],  // Promise.all[0]
        turnos: [{ data: turnos, error: null }],                   // Promise.all[1]
        movimientos_recurrentes: [{ data: movimientos, error: null }], // Promise.all[2]
      });

      const result = await service.findOne('uuid-rec-001');

      expect(result.deuda).toBe(960);
      expect(result.comprometido).toBe(960);
      expect(result.pagado).toBe(500);
      expect(result.saldo).toBe(-460); // 500 - 960
    });
  });

  // ---------------------------------------------------------------------------
  describe('addPago', () => {
    it('registers a pago movimiento for the recurrencia', async () => {
      await buildModule({
        turnos_recurrentes: [{ data: { id: 'uuid-rec-001' }, error: null }], // single: verify exists
        movimientos_recurrentes: [{ data: null, error: null }],               // insert
      });

      const result = await service.addPago(
        'uuid-rec-001',
        { monto: 960, tipo: 'pago', medio: 'efectivo' },
        USER_ID,
      );

      expect(result.success).toBe(true);
      const insertCall = mockClient.from('movimientos_recurrentes').insert.mock.calls[0][0];
      expect(insertCall.monto).toBe(960);
      expect(insertCall.tipo).toBe('pago');
    });

    it('throws NotFoundException if recurrencia does not exist', async () => {
      await buildModule({
        turnos_recurrentes: [{ data: null, error: null }],
      });

      await expect(
        service.addPago('bad-id', { monto: 960 }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
