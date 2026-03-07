import { Test, TestingModule } from '@nestjs/testing';
import { BloqueosService } from './bloqueos.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';
const CREATOR_ID = 'uuid-admin-001';

const mockConfigService = { get: jest.fn().mockReturnValue(20) };

describe('BloqueosService', () => {
  let service: BloqueosService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const { ConfigService } = await import('@nestjs/config');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloqueosService,
        { provide: SupabaseService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<BloqueosService>(BloqueosService);
  };

  describe('create — date expansion logic', () => {
    it('creates a single bloqueo for a single fecha', async () => {
      await buildModule({
        bloqueos: [{ data: [fixtures.bloqueo], error: null }],
      });

      const dto = {
        id_cancha: 1,
        hora_inicio: '08:00',
        hora_fin: '22:00',
        tipo: 'completo' as any,
        descripcion: 'Test',
        fecha: '2026-06-20',
      };

      const result = await service.create(dto, CREATOR_ID, TOKEN);

      const insertedRows = mockClient.from('bloqueos').insert.mock.calls[0][0];
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].fecha).toBe('2026-06-20');
      expect(result).toEqual([fixtures.bloqueo]);
    });

    it('expands a date range into individual bloqueos', async () => {
      await buildModule({
        bloqueos: [{ data: [{}, {}, {}], error: null }],
      });

      const dto = {
        id_cancha: 1,
        hora_inicio: '08:00',
        hora_fin: '22:00',
        tipo: 'completo' as any,
        fecha: '2026-06-20',
        fecha_fin: '2026-06-22',
      };

      await service.create(dto, CREATOR_ID, TOKEN);

      const insertedRows = mockClient.from('bloqueos').insert.mock.calls[0][0];
      expect(insertedRows).toHaveLength(3);
      expect(insertedRows[0].fecha).toBe('2026-06-20');
      expect(insertedRows[1].fecha).toBe('2026-06-21');
      expect(insertedRows[2].fecha).toBe('2026-06-22');
    });

    it('inserts exact dates from fechas array', async () => {
      await buildModule({
        bloqueos: [{ data: [{}, {}], error: null }],
      });

      const fechas = ['2026-06-20', '2026-06-25'];
      const dto = {
        id_cancha: 1,
        hora_inicio: '08:00',
        hora_fin: '22:00',
        tipo: 'completo' as any,
        fechas,
      };

      await service.create(dto, CREATOR_ID, TOKEN);

      const insertedRows = mockClient.from('bloqueos').insert.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      expect(insertedRows.map((r: any) => r.fecha)).toEqual(fechas);
    });

    it('de-duplicates dates when single fecha is also in fechas array', async () => {
      await buildModule({
        bloqueos: [{ data: [{}], error: null }],
      });

      const dto = {
        id_cancha: 1,
        hora_inicio: '08:00',
        hora_fin: '22:00',
        tipo: 'completo' as any,
        fecha: '2026-06-20',
        fechas: ['2026-06-20'], // Same date — should be deduplicated
      };

      await service.create(dto, CREATOR_ID, TOKEN);

      const insertedRows = mockClient.from('bloqueos').insert.mock.calls[0][0];
      expect(insertedRows).toHaveLength(1);
    });

    it('throws InternalServerErrorException if DB returns error', async () => {
      await buildModule({
        bloqueos: [{ data: null, error: { message: 'insert failed' } }],
      });

      const dto = { id_cancha: 1, hora_inicio: '08:00', hora_fin: '22:00', tipo: 'completo' as any, fecha: '2026-06-20' };

      await expect(service.create(dto, CREATOR_ID, TOKEN)).rejects.toThrow();
    });
  });

  describe('findByDate', () => {
    it('returns bloqueos for the given date', async () => {
      await buildModule({
        bloqueos: [{ data: [fixtures.bloqueo], error: null }],
      });

      const result = await service.findByDate('2026-06-20');

      expect(result).toEqual([fixtures.bloqueo]);
      expect(mockClient.from('bloqueos').eq).toHaveBeenCalledWith('fecha', '2026-06-20');
    });
  });

  describe('delete', () => {
    it('deletes a bloqueo and returns success', async () => {
      await buildModule({
        bloqueos: [{ data: null, error: null }],
      });

      const result = await service.delete('uuid-bloqueo-001', TOKEN);

      expect(result).toEqual({ success: true });
    });
  });

  describe('purgeByMonth', () => {
    it('deletes all bloqueos in the given month and returns count', async () => {
      await buildModule({
        bloqueos: [{ count: 5, data: null, error: null }],
      });

      const result = await service.purgeByMonth(6, 2026, TOKEN);

      expect(result.bloqueos_eliminados).toBe(5);
    });
  });
});
