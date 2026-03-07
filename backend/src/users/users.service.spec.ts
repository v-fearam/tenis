import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';
const USER_ID = 'uuid-socio-001';
const mockConfigService = { get: jest.fn().mockReturnValue(20) };

describe('UsersService', () => {
  let service: UsersService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const { ConfigService } = await import('@nestjs/config');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  };

  // ---------------------------------------------------------------------------
  describe('getDashboardData', () => {
    it('returns nextMatch, abono and membership status when data exists', async () => {
      const jugadas = [{ id_turno: 'uuid-turno-002' }];
      const nextTurno = {
        id: 'uuid-turno-002',
        fecha: '2026-06-15',
        hora_inicio: '11:00',
        type: 'double',
        estado: 'confirmado',
        canchas: { nombre: 'Cancha 1' },
      };
      const socioData = {
        id: 'uuid-socio-row-001',
        nro_socio: 100,
        id_tipo_abono: 'uuid-tipo-001',
        creditos_disponibles: 5,
        tipos_abono: {
          id: 'uuid-tipo-001',
          nombre: 'Abono Estándar',
          creditos: 8,
          precio: 5000,
          color: '#2196F3',
        },
        usuarios: { ok_club: true },
      };

      await buildModule({
        turno_jugadores: [{ data: jugadas, error: null }],
        turnos: [{ data: [nextTurno], error: null }],
        socios: [{ data: socioData, error: null }],
      });

      const result = await service.getDashboardData(USER_ID, TOKEN);

      expect(result.nextMatch).toMatchObject({ id: 'uuid-turno-002' });
      expect(result.abono).toMatchObject({
        tipo: 'Abono Estándar',
        creditos_totales: 8,
        creditos_disponibles: 5,
      });
      expect(result.isSocio).toBe(true);
      expect(result.ok_club).toBe(true);
    });

    it('returns null nextMatch if user has no upcoming turnos', async () => {
      const socioData = {
        id: 'uuid-socio-row-001',
        creditos_disponibles: 0,
        tipos_abono: null,
        usuarios: { ok_club: true },
      };

      await buildModule({
        turno_jugadores: [{ data: [], error: null }],  // no turnos at all
        socios: [{ data: socioData, error: null }],
      });

      const result = await service.getDashboardData(USER_ID, TOKEN);

      expect(result.nextMatch).toBeNull();
    });

    it('returns null abono if socio has no tipo_abono', async () => {
      const jugadas = [{ id_turno: 'uuid-turno-002' }];
      const socioData = {
        id: 'uuid-socio-row-001',
        creditos_disponibles: 0,
        tipos_abono: null,
        usuarios: { ok_club: true },
      };

      await buildModule({
        turno_jugadores: [{ data: jugadas, error: null }],
        turnos: [{ data: [], error: null }],  // no upcoming turnos
        socios: [{ data: socioData, error: null }],
      });

      const result = await service.getDashboardData(USER_ID, TOKEN);

      expect(result.abono).toBeNull();
    });

    it('returns isSocio=false if socio row not found', async () => {
      await buildModule({
        turno_jugadores: [{ data: [], error: null }],
        socios: [{ data: null, error: null }],
      });

      const result = await service.getDashboardData(USER_ID, TOKEN);

      expect(result.isSocio).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('getHistory', () => {
    it('calculates deuda_total correctly from pending turno_jugadores', async () => {
      const debtRows = [
        { monto_generado: '600', turnos: { estado: 'confirmado' } },
        { monto_generado: '400', turnos: { estado: 'pendiente' } },
      ];
      const historyRows = [
        {
          id: 'uuid-jugador-001',
          monto_generado: '600',
          estado_pago: 'pendiente',
          uso_abono: false,
          turnos: { id: 'uuid-turno-002', fecha: '2026-06-15', hora_inicio: '11:00', hora_fin: '12:30', tipo_partido: 'double', estado: 'confirmado', canchas: { nombre: 'Cancha 1' } },
        },
      ];

      await buildModule({
        turno_jugadores: [
          { data: debtRows, error: null },                    // deuda_total query
          { data: historyRows, count: 1, error: null },       // paginated history
        ],
      });

      const result = await service.getHistory(USER_ID, { page: 1, pageSize: 20 }, TOKEN);

      expect(result.deuda_total).toBe(1000); // 600 + 400
      expect(result.turnos.data).toHaveLength(1);
      expect(result.turnos.total).toBe(1);
    });

    it('returns deuda_total = 0 when no pending rows', async () => {
      await buildModule({
        turno_jugadores: [
          { data: [], error: null },           // no debt
          { data: [], count: 0, error: null }, // no history
        ],
      });

      const result = await service.getHistory(USER_ID, {}, TOKEN);

      expect(result.deuda_total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('searchPublic', () => {
    it('searches usuarios by name and returns limited results', async () => {
      const usuarios = [
        { id: 'uuid-1', nombre: 'Carlos Lopez', email: 'carlos@test.com', dni: '12345678' },
        { id: 'uuid-2', nombre: 'Carlos Garcia', email: 'garcia@test.com', dni: '87654321' },
      ];

      await buildModule({
        usuarios: [{ data: usuarios, error: null }],
      });

      const result = await service.searchPublic('Carlos');

      expect(result).toHaveLength(2);
      expect(mockClient.from('usuarios').ilike).toHaveBeenCalled();
    });
  });
});
