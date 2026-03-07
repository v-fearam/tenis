import { Test, TestingModule } from '@nestjs/testing';
import { CanchasService } from './canchas.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';

describe('CanchasService', () => {
  let service: CanchasService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanchasService,
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compile();
    service = module.get<CanchasService>(CanchasService);
  };

  describe('findAll', () => {
    it('returns all canchas ordered by id', async () => {
      await buildModule({
        canchas: [{ data: fixtures.canchas, error: null }],
      });

      const result = await service.findAll();

      expect(result).toEqual(fixtures.canchas);
      expect(mockClient.from).toHaveBeenCalledWith('canchas');
    });

    it('throws if DB returns error', async () => {
      await buildModule({
        canchas: [{ data: null, error: { message: 'DB error' } }],
      });

      await expect(service.findAll()).rejects.toBeDefined();
    });
  });

  describe('create', () => {
    it('inserts a new cancha and returns it', async () => {
      const newCancha = { nombre: 'Cancha 3', hora_apertura: '08:00', hora_cierre: '22:00' };
      await buildModule({
        canchas: [{ data: { id: 3, ...newCancha }, error: null }],
      });

      const result = await service.create(newCancha as any, TOKEN);

      expect(result).toMatchObject({ id: 3, nombre: 'Cancha 3' });
      expect(mockClient.from('canchas').insert).toHaveBeenCalledWith([newCancha]);
    });
  });

  describe('update', () => {
    it('updates a cancha and returns updated data', async () => {
      const updated = { ...fixtures.cancha, nombre: 'Cancha Actualizada' };
      await buildModule({
        canchas: [{ data: updated, error: null }],
      });

      const result = await service.update(1, { nombre: 'Cancha Actualizada' }, TOKEN);

      expect(result.nombre).toBe('Cancha Actualizada');
    });
  });

  describe('remove', () => {
    it('deletes a cancha and returns success message', async () => {
      await buildModule({
        canchas: [{ data: null, error: null }],
      });

      const result = await service.remove(1, TOKEN);

      expect(result.message).toContain('eliminada');
    });

    it('throws if DB returns error on delete', async () => {
      await buildModule({
        canchas: [{ data: null, error: { message: 'FK violation' } }],
      });

      await expect(service.remove(1, TOKEN)).rejects.toBeDefined();
    });
  });
});
