import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from './bookings.service';
import { AbonosService } from '../abonos/abonos.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';

const mockConfigService = { get: jest.fn().mockReturnValue(20) };
const mockAbonosService = { consumeCredit: jest.fn() };

// Future date used in create() tests to pass the "not in the past" validation
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const FUTURE_ISO = FUTURE_DATE.toISOString();
const FUTURE_END_ISO = new Date(FUTURE_DATE.getTime() + 90 * 60 * 1000).toISOString();

describe('BookingsService', () => {
  let service: BookingsService;
  let mockClient: any;

  const buildModule = async (tableMap = {}, rpcResponses: any[] = []) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap, rpcResponses);
    mockClient = mc;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: SupabaseService, useValue: mockService },
        { provide: AbonosService, useValue: mockAbonosService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<BookingsService>(BookingsService);
  };

  // ---------------------------------------------------------------------------
  describe('previewCost', () => {
    const configData = fixtures.config;

    it('assigns cost 0 (usa_abono=true) to socio with sufficient credits', async () => {
      await buildModule({
        config_sistema: [{ data: configData, error: null }],
        socios: [{ data: [fixtures.socio_con_abono], error: null }],  // has credits
        usuarios: [{ data: [fixtures.usuario_socio_con_abono], error: null }],
      });

      const result = await service.previewCost(
        [{ user_id: 'uuid-socio-001' }],
        'single',
      );

      expect(result.jugadores[0].usa_abono).toBe(true);
      expect(result.jugadores[0].monto).toBe(0);
      expect(result.costo_total).toBe(0);
    });

    it('falls back to precio_socio_sin_abono when socio has 0 credits (single)', async () => {
      await buildModule({
        config_sistema: [{ data: configData, error: null }],
        socios: [{ data: [fixtures.socio_sin_creditos], error: null }],
        usuarios: [{ data: [fixtures.usuario_socio_con_abono], error: null }], // id matches 'uuid-socio-001'
      });

      const result = await service.previewCost(
        [{ user_id: 'uuid-socio-001' }],
        'single',
      );

      expect(result.jugadores[0].usa_abono).toBe(false);
      // 1200 (precio_socio_sin_abono) / 1 player = 1200
      expect(result.jugadores[0].monto).toBe(1200);
    });

    it('charges precio_no_socio to guests (no user_id)', async () => {
      await buildModule({
        config_sistema: [{ data: configData, error: null }],
      });

      const result = await service.previewCost(
        [{ guest_name: 'Invitado Perez' }],
        'single',
      );

      // 2000 / 1 player = 2000
      expect(result.jugadores[0].monto).toBe(2000);
      expect(result.jugadores[0].tipo).toBe('invitado');
    });

    it('splits cost among players in doubles', async () => {
      await buildModule({
        config_sistema: [{ data: configData, error: null }],
        socios: [{ data: [fixtures.socio_sin_creditos, fixtures.socio_sin_abono], error: null }],
        usuarios: [{ data: [fixtures.usuario_socio_con_abono, fixtures.usuario_socio_sin_abono], error: null }],
      });

      const result = await service.previewCost(
        [{ user_id: 'uuid-socio-001' }, { user_id: 'uuid-socio-002' }],
        'double',
      );

      // 1200 (price_socio_sin_abono) / 2 players = 600 each
      expect(result.jugadores[0].monto).toBe(600);
      expect(result.jugadores[1].monto).toBe(600);
      expect(result.costo_total).toBe(1200);
    });

    it('mixes abono player and no-socio in doubles correctly', async () => {
      await buildModule({
        config_sistema: [{ data: configData, error: null }],
        socios: [{ data: [fixtures.socio_con_abono], error: null }],
        usuarios: [
          {
            data: [
              fixtures.usuario_socio_con_abono,
              fixtures.usuario_no_socio_relation,
            ],
            error: null,
          },
        ],
      });

      const result = await service.previewCost(
        [{ user_id: 'uuid-socio-001' }, { user_id: 'uuid-nosocio-001' }],
        'double',
      );

      // Player 1: socio with abono + credits → 0
      // Player 2: no-socio → 2000 / 2 = 1000
      const abonoPlayer = result.jugadores.find((j) => j.usa_abono);
      const nosocioPlayer = result.jugadores.find((j) => !j.usa_abono);

      expect(abonoPlayer?.monto).toBe(0);
      expect(nosocioPlayer?.monto).toBe(1000);
    });

    it('uses default prices when config_sistema returns no data', async () => {
      await buildModule({
        config_sistema: [{ data: null, error: null }],
      });

      const result = await service.previewCost([{ guest_name: 'Guest' }], 'single');

      // Falls back to DEFAULT_PRICES.price_no_socio = 2000
      expect(result.jugadores[0].monto).toBe(2000);
    });
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    const baseDto = {
      court_id: 1,
      start_time: FUTURE_ISO,
      end_time: FUTURE_END_ISO,
      type: 'double' as const,
      players: [
        { user_id: 'uuid-socio-001' },
        { user_id: 'uuid-socio-002' },
      ],
    };

    it('throws ConflictException if start_time is in the past', async () => {
      await buildModule();

      const pastDto = {
        ...baseDto,
        start_time: new Date(Date.now() - 1000).toISOString(),
        end_time: new Date(Date.now() + 90 * 60 * 1000 - 1000).toISOString(),
      };

      await expect(service.create(pastDto, 'uuid-admin-001', TOKEN)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException if hour is outside cancha schedule', async () => {
      const earlyCancha = { ...fixtures.cancha, hora_apertura: '10:00', hora_cierre: '22:00' };
      await buildModule({
        canchas: [{ data: earlyCancha, error: null }],
        config_sistema: [{ data: fixtures.config, error: null }],
      });

      // Start time at 08:00 AR time — before cancha opens at 10:00
      const tooEarlyDate = new Date(FUTURE_DATE);
      tooEarlyDate.setUTCHours(11, 0, 0, 0); // 08:00 AR (UTC-3)
      const tooEarlyEnd = new Date(tooEarlyDate.getTime() + 90 * 60 * 1000);

      const dto = {
        ...baseDto,
        start_time: tooEarlyDate.toISOString(),
        end_time: tooEarlyEnd.toISOString(),
      };

      await expect(service.create(dto, 'uuid-admin-001', TOKEN)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates turno and inserts players when data is valid', async () => {
      await buildModule(
        {
          canchas: [{ data: fixtures.cancha, error: null }],
          config_sistema: [{ data: fixtures.config, error: null }],
          turnos: [{ data: { ...fixtures.turno_pendiente, id: 'new-turno-id' }, error: null }],
          turno_jugadores: [{ data: [{ id: 'j1', id_persona: 'uuid-socio-001' }, { id: 'j2', id_persona: 'uuid-socio-002' }], error: null }],
          socios: [
            { data: [fixtures.socio_con_abono, fixtures.socio_sin_abono], error: null },
            { data: null, error: null }, // update costo
          ],
          usuarios: [{ data: [fixtures.usuario_socio_con_abono, fixtures.usuario_socio_sin_abono], error: null }],
        },
        [
          { data: true, error: null },  // consume_abono_credit for player 1
          { data: false, error: null }, // consume_abono_credit for player 2
        ],
      );

      // Valid time at 14:00 AR (within 08:00–22:00 range)
      const goodStart = new Date(FUTURE_DATE);
      goodStart.setUTCHours(17, 0, 0, 0); // 14:00 AR (UTC-3)
      const goodEnd = new Date(goodStart.getTime() + 90 * 60 * 1000);

      const dto = {
        ...baseDto,
        start_time: goodStart.toISOString(),
        end_time: goodEnd.toISOString(),
      };

      const result = await service.create(dto, 'uuid-socio-001', TOKEN);

      expect(mockClient.from('turnos').insert).toHaveBeenCalled();
      expect(mockClient.from('turno_jugadores').insert).toHaveBeenCalled();
      expect(result.status).toBe('confirmed'); // creatorId is set → auto-confirmed
    });
  });

  // ---------------------------------------------------------------------------
  describe('confirm', () => {
    it('generates cargo pagos for players with monto_generado > 0', async () => {
      await buildModule({
        turnos: [
          { data: fixtures.turno_con_jugadores, error: null }, // findRawBookingWithPlayers
          { data: null, error: null },                          // update estado
        ],
        socios: [{ data: [{ id: 'uuid-socio-row-001', id_usuario: 'uuid-socio-001' }], error: null }],
        pagos: [{ data: null, error: null }], // batch insert pagos
      });

      await service.confirm('uuid-turno-002', TOKEN);

      // Verify pagos insert was called
      expect(mockClient.from('pagos').insert).toHaveBeenCalled();
      const pagosInserted = mockClient.from('pagos').insert.mock.calls[0][0];
      expect(Array.isArray(pagosInserted)).toBe(true);
      pagosInserted.forEach((p: any) => {
        expect(p.tipo).toBe('cargo');
        expect(p.monto).toBeLessThan(0); // cargos are negative
      });
    });

    it('does not generate pagos for players with monto_generado = 0', async () => {
      const turnoWithAbono = {
        ...fixtures.turno_con_jugadores,
        turno_jugadores: [fixtures.jugador_con_abono], // monto_generado = 0
      };

      await buildModule({
        turnos: [
          { data: turnoWithAbono, error: null },
          { data: null, error: null },
        ],
        socios: [{ data: [], error: null }],
      });

      await service.confirm('uuid-turno-001', TOKEN);

      // pagos.insert should NOT be called since no player has monto_generado > 0
      expect(mockClient.from('pagos').insert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancel', () => {
    it('cancels turno, refunds abono credits for players who used abono', async () => {
      const booking = { ...fixtures.turno_confirmado, creado_por: 'uuid-socio-001' };
      const playersWithAbono = [{ id_persona: 'uuid-socio-001' }];

      await buildModule({
        turnos: [
          { data: booking, error: null },     // fetch booking
          { data: null, error: null },         // update to cancelado (in Promise.all)
        ],
        turno_jugadores: [
          { data: playersWithAbono, error: null }, // players with uso_abono=true
          { data: null, error: null },              // update estado_pago (in Promise.all)
        ],
      },
      [{ data: 1, error: null }]); // refund_abono_credits RPC

      const result = await service.cancel('uuid-turno-002', TOKEN);

      // Verify RPC was called with correct refund amount for double (0.5)
      expect(mockClient.rpc).toHaveBeenCalledWith('refund_abono_credits', {
        p_user_ids: ['uuid-socio-001'],
        p_amount: 0.5,
      });
      expect(result).toMatchObject({ id: 'uuid-turno-002', status: 'cancelado' });
    });

    it('does not call refund RPC if no players used abono', async () => {
      const booking = { ...fixtures.turno_confirmado, creado_por: 'uuid-socio-001' };

      await buildModule({
        turnos: [
          { data: booking, error: null },
          { data: null, error: null },
        ],
        turno_jugadores: [
          { data: [], error: null },    // no abono players
          { data: null, error: null },
        ],
      });

      await service.cancel('uuid-turno-002', TOKEN);

      expect(mockClient.rpc).not.toHaveBeenCalledWith(
        'refund_abono_credits',
        expect.anything(),
      );
    });

    it('throws NotFoundException if booking does not exist', async () => {
      await buildModule({
        turnos: [{ data: null, error: { message: 'not found' } }],
      });

      await expect(service.cancel('bad-id', TOKEN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('single turno refunds 1 credit per player', async () => {
      const singleTurno = { ...fixtures.turno_confirmado, tipo_partido: 'single', creado_por: 'uuid-socio-001' };
      const playersWithAbono = [{ id_persona: 'uuid-socio-001' }];

      await buildModule({
        turnos: [
          { data: singleTurno, error: null },
          { data: null, error: null },
        ],
        turno_jugadores: [
          { data: playersWithAbono, error: null },
          { data: null, error: null },
        ],
      },
      [{ data: 1, error: null }]);

      await service.cancel('uuid-turno-002', TOKEN);

      expect(mockClient.rpc).toHaveBeenCalledWith('refund_abono_credits', {
        p_user_ids: expect.any(Array),
        p_amount: 1, // single
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe('findCobrados — filtering logic', () => {
    it('returns only turnos where all players are paid', async () => {
      const allTurnos = [{ id: 'turno-1' }, { id: 'turno-2' }];
      const unpaidRows = [{ id_turno: 'turno-1' }]; // turno-1 has unpaid player
      const paidTurnoData = [{ ...fixtures.turno_confirmado, id: 'turno-2', canchas: fixtures.cancha, turno_jugadores: [] }];

      await buildModule({
        turnos: [
          { data: allTurnos, error: null },      // Step 1: confirmed turno ids
          { data: paidTurnoData, error: null },   // Step 3: paginated cobrados
        ],
        turno_jugadores: [
          { data: unpaidRows, error: null }, // Step 2: find turnos with unpaid players
        ],
      });

      const result = await service.findCobrados({ page: 1, pageSize: 20 }, TOKEN);

      // Only turno-2 should be returned (turno-1 had unpaid players)
      expect(result.data).toHaveLength(1);
    });

    it('returns empty if no confirmed turnos exist', async () => {
      await buildModule({
        turnos: [{ data: [], error: null }],
      });

      const result = await service.findCobrados({ page: 1, pageSize: 20 }, TOKEN);

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
    });
  });
});
