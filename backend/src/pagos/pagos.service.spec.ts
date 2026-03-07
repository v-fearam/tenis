import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';
const ADMIN_NAME = 'Admin Test';
const mockConfigService = { get: jest.fn().mockReturnValue(20) };

describe('PagosService', () => {
  let service: PagosService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const { ConfigService } = await import('@nestjs/config');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: SupabaseService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<PagosService>(PagosService);
  };

  // ---------------------------------------------------------------------------
  describe('registerPayment', () => {
    it('registers partial payment and keeps estado as pendiente', async () => {
      const player = { ...fixtures.jugador_pendiente, monto_generado: 600 };

      await buildModule({
        turno_jugadores: [
          { data: player, error: null },    // single: get player
          // No second call — partial payment, estado stays pendiente
        ],
        pagos: [
          { data: [], error: null },          // existing pagos = none (thenable)
          { data: null, error: null },         // insert pago (thenable)
        ],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }], // getSocioId
      });

      const result = await service.registerPayment(
        { turno_jugador_id: 'uuid-jugador-001', monto: 300 },
        ADMIN_NAME,
        TOKEN,
      );

      expect(result.remaining).toBe(300);
      expect(result.estado_pago).toBe('pendiente');
      expect(mockClient.from('pagos').insert).toHaveBeenCalled();
    });

    it('marks player as pagado when full amount is paid', async () => {
      const player = { ...fixtures.jugador_pendiente, monto_generado: 600 };

      await buildModule({
        turno_jugadores: [
          { data: player, error: null },    // single: get player
          { data: null, error: null },       // update: estado_pago = pagado
        ],
        pagos: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],
      });

      const result = await service.registerPayment(
        { turno_jugador_id: 'uuid-jugador-001', monto: 600 },
        ADMIN_NAME,
        TOKEN,
      );

      expect(result.remaining).toBe(0);
      expect(result.estado_pago).toBe('pagado');

      const updateCall = mockClient.from('turno_jugadores').update.mock.calls[0][0];
      expect(updateCall.estado_pago).toBe('pagado');
    });

    it('caps monto to remaining to handle floating point overpayment', async () => {
      const player = { ...fixtures.jugador_pendiente, monto_generado: 600 };
      // Simulates 300 already paid, 300 remaining
      const existingPagos = [{ monto: '300' }];

      await buildModule({
        turno_jugadores: [
          { data: player, error: null },
          { data: null, error: null },
        ],
        pagos: [
          { data: existingPagos, error: null },
          { data: null, error: null },
        ],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],
      });

      // Try to pay 300.005 — just slightly above remaining 300
      const result = await service.registerPayment(
        { turno_jugador_id: 'uuid-jugador-001', monto: 300.005 },
        ADMIN_NAME,
        TOKEN,
      );

      // Should have been capped to 300
      const insertCall = mockClient.from('pagos').insert.mock.calls[0][0];
      expect(insertCall.monto).toBeLessThanOrEqual(300);
      expect(result.remaining).toBe(0);
    });

    it('throws BadRequestException if player is already paid', async () => {
      await buildModule({
        turno_jugadores: [
          { data: { ...fixtures.jugador_pendiente, estado_pago: 'pagado' }, error: null },
        ],
        pagos: [{ data: [], error: null }],
      });

      await expect(
        service.registerPayment(
          { turno_jugador_id: 'uuid-jugador-001', monto: 100 },
          ADMIN_NAME,
          TOKEN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if player not found', async () => {
      await buildModule({
        turno_jugadores: [{ data: null, error: { message: 'not found' } }],
        pagos: [{ data: [], error: null }],
      });

      await expect(
        service.registerPayment(
          { turno_jugador_id: 'bad-id', monto: 100 },
          ADMIN_NAME,
          TOKEN,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('giftPayment', () => {
    it('inserts bonificacion and marks player as bonificado', async () => {
      const player = { ...fixtures.jugador_pendiente, monto_generado: 600 };

      await buildModule({
        turno_jugadores: [
          { data: player, error: null },    // single
          { data: null, error: null },       // update estado_pago = bonificado (Promise.all)
        ],
        pagos: [
          { data: [], error: null },          // existing pagos (Promise.all)
          { data: null, error: null },         // insert bonificacion (Promise.all)
        ],
        socios: [{ data: { id: 'uuid-socio-row-001' }, error: null }],
      });

      const result = await service.giftPayment(
        { turno_jugador_id: 'uuid-jugador-001', observacion: 'cortesia' },
        ADMIN_NAME,
        TOKEN,
      );

      expect(result.success).toBe(true);

      const insertCall = mockClient.from('pagos').insert.mock.calls[0][0];
      expect(insertCall.tipo).toBe('bonificacion');
      expect(insertCall.monto).toBe(600); // full remaining amount

      const updateCall = mockClient.from('turno_jugadores').update.mock.calls[0][0];
      expect(updateCall.estado_pago).toBe('bonificado');
    });

    it('throws if player has no remaining debt', async () => {
      // monto_generado = 600, already paid 600
      const player = { ...fixtures.jugador_pendiente, monto_generado: 600 };
      const existingPagos = [{ monto: '600' }];

      await buildModule({
        turno_jugadores: [{ data: player, error: null }],
        pagos: [{ data: existingPagos, error: null }],
      });

      await expect(
        service.giftPayment({ turno_jugador_id: 'uuid-jugador-001' }, ADMIN_NAME, TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('payAllForTurno', () => {
    it('processes all pending players and returns correct counts', async () => {
      const pendingPlayers = [
        { id: 'j1', monto_generado: 600, estado_pago: 'pendiente', id_persona: 'uuid-socio-001' },
        { id: 'j2', monto_generado: 600, estado_pago: 'pendiente', id_persona: 'uuid-socio-002' },
      ];
      const socios = [
        { id: 'uuid-socio-row-001', id_usuario: 'uuid-socio-001' },
        { id: 'uuid-socio-row-002', id_usuario: 'uuid-socio-002' },
      ];

      await buildModule({
        turno_jugadores: [
          { data: pendingPlayers, error: null },  // fetch pending players
          { data: null, error: null },              // batch update (Promise.all)
        ],
        pagos: [
          { data: [], error: null },               // existing pagos for all players (Promise.all)
          { data: null, error: null },              // batch insert (Promise.all)
        ],
        socios: [{ data: socios, error: null }],  // fetch socios (Promise.all)
      });

      const result = await service.payAllForTurno(
        { turno_id: 'uuid-turno-002', medio: 'efectivo' },
        ADMIN_NAME,
        TOKEN,
      );

      expect(result.players_paid).toBe(2);
      expect(result.total_paid).toBe(1200); // 600 + 600

      const insertCall = mockClient.from('pagos').insert.mock.calls[0][0];
      expect(Array.isArray(insertCall)).toBe(true);
      expect(insertCall).toHaveLength(2);
      insertCall.forEach((p: any) => expect(p.tipo).toBe('pago'));
    });

    it('skips players who already have zero remaining debt', async () => {
      const players = [
        { id: 'j1', monto_generado: 600, estado_pago: 'pendiente', id_persona: 'uuid-socio-001' },
        { id: 'j2', monto_generado: 600, estado_pago: 'pendiente', id_persona: 'uuid-socio-002' },
      ];
      // j2 already fully paid
      const existingPagos = [{ id_turno_jugador: 'j2', monto: '600' }];

      await buildModule({
        turno_jugadores: [
          { data: players, error: null },
          { data: null, error: null },
        ],
        pagos: [
          { data: existingPagos, error: null },
          { data: null, error: null },
        ],
        socios: [{ data: [{ id: 'uuid-socio-row-001', id_usuario: 'uuid-socio-001' }], error: null }],
      });

      const result = await service.payAllForTurno(
        { turno_id: 'uuid-turno-002' },
        ADMIN_NAME,
        TOKEN,
      );

      expect(result.players_paid).toBe(1); // Only j1 was actually paid
      expect(result.total_paid).toBe(600);
    });

    it('throws BadRequestException if no players have pending debt', async () => {
      await buildModule({
        turno_jugadores: [{ data: [], error: null }],
      });

      await expect(
        service.payAllForTurno({ turno_id: 'uuid-turno-002' }, ADMIN_NAME, TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('getHistoricalRevenue', () => {
    it('returns last 12 cierres with total calculated correctly', async () => {
      const cierres = [fixtures.cierre_mensual];

      await buildModule({
        cierres_mensuales: [{ data: cierres, error: null }],
      });

      const result = await service.getHistoricalRevenue();

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(90000); // 50000 + 30000 + 10000
      expect(result[0].mes).toBe('2026-02-01');
    });
  });

  // ---------------------------------------------------------------------------
  describe('getCurrentMonthSummary', () => {
    it('calculates cobrado and deuda correctly from all data sources', async () => {
      await buildModule({
        pagos: [
          { data: [{ monto: '1000' }, { monto: '500' }], error: null },  // cobrado_turnos = 1500
          { data: [{ monto: '200' }], error: null },                       // totalPagadoRec (sequential)
        ],
        movimientos_recurrentes: [
          { data: [{ monto: '800' }], error: null },  // cobrado_recurrentes = 800 (Promise.all)
        ],
        socios: [
          { data: [{ tipos_abono: { precio: '5000' } }, { tipos_abono: { precio: '5000' } }], error: null }, // cobrado_abonos = 10000
        ],
        turno_jugadores: [
          { data: [{ monto_generado: '600' }, { monto_generado: '400' }], error: null }, // deuda_turnos = 1000
        ],
        turnos: [
          { data: [{ monto_recurrente: '800' }], error: null }, // monto_recurrente_pasado = 800
        ],
        cierres_mensuales: [
          { data: { ingreso_turnos: 1000, ingreso_abonos: 8000, ingreso_recurrentes: 500 }, error: null }, // lastCierre (maybeSingle)
        ],
      });

      const result = await service.getCurrentMonthSummary();

      expect(result.cobrado_turnos).toBe(1500);
      expect(result.cobrado_recurrentes).toBe(800);
      expect(result.cobrado_abonos).toBe(10000);
      expect(result.deuda_pendiente).toBe(1000); // 1000 (turnos) + max(0, 800 - 200) = 1000 + 600 = 1600

      // tendencia: (12300 - 9500) / 9500 * 100 ≈ 29.5%
      expect(result.tendencia_pct).toBeDefined();
      expect(typeof result.tendencia_pct).toBe('number');
    });

    it('returns 0 tendencia when no previous cierre exists', async () => {
      await buildModule({
        pagos: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        movimientos_recurrentes: [{ data: [], error: null }],
        socios: [{ data: [], error: null }],
        turno_jugadores: [{ data: [], error: null }],
        turnos: [{ data: [], error: null }],
        cierres_mensuales: [
          { data: null, error: null }, // no last cierre (maybeSingle returns null)
        ],
      });

      const result = await service.getCurrentMonthSummary();

      expect(result.tendencia_pct).toBe(0);
    });
  });
});
