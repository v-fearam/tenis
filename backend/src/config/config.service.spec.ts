import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from './config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

describe('ConfigService', () => {
  let service: ConfigService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compile();
    service = module.get<ConfigService>(ConfigService);
  };

  describe('findAll', () => {
    it('fetches config from DB on first call', async () => {
      await buildModule({
        config_sistema: [{ data: fixtures.config, error: null }],
      });

      const result = await service.findAll();

      expect(mockClient.from).toHaveBeenCalledWith('config_sistema');
      expect(result).toEqual(fixtures.config);
    });

    it('returns cached data without calling DB on second call', async () => {
      await buildModule({
        config_sistema: [{ data: fixtures.config, error: null }],
      });

      await service.findAll(); // First call — hits DB
      await service.findAll(); // Second call — should use cache

      // from() was called only once (first call)
      expect(mockClient.from).toHaveBeenCalledTimes(1);
    });

    it('throws if DB returns error', async () => {
      await buildModule({
        config_sistema: [{ data: null, error: { message: 'DB error' } }],
      });

      await expect(service.findAll()).rejects.toThrow();
    });
  });

  describe('findByKey', () => {
    it('returns config entry by key', async () => {
      await buildModule({
        config_sistema: [{ data: fixtures.config, error: null }],
      });

      const result = await service.findByKey('precio_no_socio');

      expect(result.clave).toBe('precio_no_socio');
      expect(result.valor).toBe('2000');
    });

    it('throws NotFoundException if key not found', async () => {
      await buildModule({
        config_sistema: [{ data: fixtures.config, error: null }],
      });

      await expect(service.findByKey('clave_inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates config and invalidates cache', async () => {
      const updatedConfig = { clave: 'precio_no_socio', valor: '2500' };
      await buildModule({
        config_sistema: [
          { data: fixtures.config, error: null },   // findAll (first call)
          { data: updatedConfig, error: null },       // update
          { data: [updatedConfig], error: null },     // findAll after update (re-fetches DB)
        ],
      });

      await service.findAll(); // Populate cache
      await service.update('precio_no_socio', '2500');
      const afterUpdate = await service.findAll(); // Should re-fetch DB (cache invalidated)

      // 3 calls to 'config_sistema': first findAll, update, second findAll after cache clear
      expect(mockClient.from).toHaveBeenCalledTimes(3);
      expect(afterUpdate).toEqual([updatedConfig]);
    });
  });
});
