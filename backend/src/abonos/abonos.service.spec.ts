import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbonosService } from './abonos.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

const TOKEN = 'test-token';
const ADMIN_ID = 'uuid-admin-001';
const mockConfigService = { get: jest.fn().mockReturnValue(20) };

describe('AbonosService', () => {
  let service: AbonosService;
  let mockClient: any;

  const buildModule = async (tableMap = {}) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap);
    mockClient = mc;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbonosService,
        { provide: SupabaseService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<AbonosService>(AbonosService);
  };

  // ---------------------------------------------------------------------------
  describe('assign', () => {
    it('assigns the tipo_abono to the socio with correct credits', async () => {
      const updatedSocio = {
        ...fixtures.socio_con_abono,
        creditos_disponibles: fixtures.tipo_abono.creditos,
      };

      await buildModule({
        tipos_abono: [{ data: fixtures.tipo_abono, error: null }],
        socios: [{ data: updatedSocio, error: null }],
      });

      const result = await service.assign(
        { tipo_abono_id: 'uuid-tipo-001', socio_id: 'uuid-socio-row-001' },
        TOKEN,
      );

      // Verify the update was called with the correct credits (tipo.creditos = 8)
      const updateCall = mockClient.from('socios').update.mock.calls[0][0];
      expect(updateCall.id_tipo_abono).toBe('uuid-tipo-001');
      expect(updateCall.creditos_disponibles).toBe(8);
      expect(result).toMatchObject({ creditos_disponibles: 8 });
    });

    it('throws BadRequestException if tipo_abono not found', async () => {
      await buildModule({
        tipos_abono: [{ data: null, error: { message: 'not found' } }],
      });

      await expect(
        service.assign({ tipo_abono_id: 'bad-id', socio_id: 'uuid-socio-row-001' }, TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('consumeCredit', () => {
    it('returns true and decrements credits when sufficient balance', async () => {
      const updatedSocio = { ...fixtures.socio_con_abono, creditos_disponibles: 4 };

      await buildModule({
        socios: [
          { data: fixtures.socio_con_abono, error: null }, // SELECT
          { data: updatedSocio, error: null },              // UPDATE
        ],
      });

      const result = await service.consumeCredit('uuid-socio-row-001');

      expect(result).toBe(true);
      const updateCall = mockClient.from('socios').update.mock.calls[0][0];
      expect(updateCall.creditos_disponibles).toBe(4); // 5 - 1
    });

    it('returns false if socio has no abono type', async () => {
      await buildModule({
        socios: [{ data: fixtures.socio_sin_abono, error: null }],
      });

      const result = await service.consumeCredit('uuid-socio-row-002');

      expect(result).toBe(false);
    });

    it('returns false if credits are insufficient', async () => {
      await buildModule({
        socios: [{ data: fixtures.socio_sin_creditos, error: null }],
      });

      const result = await service.consumeCredit('uuid-socio-row-003');

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('deleteType', () => {
    it('deletes the tipo_abono if no socios are assigned', async () => {
      await buildModule({
        socios: [{ count: 0, data: null, error: null }],
        tipos_abono: [{ data: null, error: null }],
      });

      const result = await service.deleteType('uuid-tipo-001', TOKEN);

      expect(result.message).toContain('eliminado');
    });

    it('throws BadRequestException if socios are assigned to the type', async () => {
      await buildModule({
        socios: [{ count: 3, data: null, error: null }],
      });

      await expect(
        service.deleteType('uuid-tipo-001', TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('ejecutarCierreMensual', () => {
    it('calculates ingreso_abonos correctly from socios with abono', async () => {
      const sociosConAbono = [
        { id: 's1', id_tipo_abono: 'uuid-tipo-001', tipo_abono: { id: 'uuid-tipo-001', nombre: 'Estándar', precio: 5000 } },
        { id: 's2', id_tipo_abono: 'uuid-tipo-001', tipo_abono: { id: 'uuid-tipo-001', nombre: 'Estándar', precio: 5000 } },
      ];
      const cierre = { id: 'uuid-cierre-new', mes_anio: '2026-02-01', ingreso_abonos: 10000, ingreso_turnos: 0, ingreso_recurrentes: 0 };

      await buildModule({
        cierres_mensuales: [
          { data: null, error: null },   // maybeSingle: check existing → none
          { data: cierre, error: null }, // single: inserted cierre
        ],
        socios: [
          { data: sociosConAbono, error: null }, // socios con abono
          { data: null, error: null },            // update: clear abonos
        ],
        pagos: [{ data: [], error: null }],                    // ingreso_turnos = 0
        movimientos_recurrentes: [{ data: [], error: null }],  // ingreso_recurrentes = 0
      });

      const result = await service.ejecutarCierreMensual(TOKEN, ADMIN_ID);

      // Verify the INSERT call had correct ingreso_abonos (2 socios × $5000 = $10000)
      const insertCall = mockClient.from('cierres_mensuales').insert.mock.calls[0][0];
      expect(insertCall.ingreso_abonos).toBe(10000);
      expect(insertCall.cantidad_socios_con_abono).toBe(2);
      expect(result).toMatchObject({ id: 'uuid-cierre-new' });
    });

    it('calculates ingreso_turnos from pagos of tipo=pago', async () => {
      const pagosDelMes = [{ monto: '1000' }, { monto: '2000' }, { monto: '500' }];

      await buildModule({
        cierres_mensuales: [
          { data: null, error: null },
          { data: { id: 'uuid-cierre-new', ingreso_turnos: 3500 }, error: null },
        ],
        socios: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        pagos: [{ data: pagosDelMes, error: null }],
        movimientos_recurrentes: [{ data: [], error: null }],
      });

      const result = await service.ejecutarCierreMensual(TOKEN, ADMIN_ID);

      const insertCall = mockClient.from('cierres_mensuales').insert.mock.calls[0][0];
      expect(insertCall.ingreso_turnos).toBe(3500); // 1000 + 2000 + 500
    });

    it('calculates ingreso_recurrentes from movimientos_recurrentes of tipo=pago', async () => {
      const movimientos = [{ monto: '800' }, { monto: '1200' }];

      await buildModule({
        cierres_mensuales: [
          { data: null, error: null },
          { data: { id: 'uuid-cierre-new', ingreso_recurrentes: 2000 }, error: null },
        ],
        socios: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        pagos: [{ data: [], error: null }],
        movimientos_recurrentes: [{ data: movimientos, error: null }],
      });

      await service.ejecutarCierreMensual(TOKEN, ADMIN_ID);

      const insertCall = mockClient.from('cierres_mensuales').insert.mock.calls[0][0];
      expect(insertCall.ingreso_recurrentes).toBe(2000); // 800 + 1200
    });

    it('throws BadRequestException if cierre already exists for the month', async () => {
      await buildModule({
        cierres_mensuales: [
          { data: { id: 'existing-cierre' }, error: null }, // maybeSingle: existing found
        ],
      });

      await expect(
        service.ejecutarCierreMensual(TOKEN, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears all socios abono assignments after inserting cierre', async () => {
      await buildModule({
        cierres_mensuales: [
          { data: null, error: null },
          { data: { id: 'uuid-cierre-new' }, error: null },
        ],
        socios: [
          { data: [], error: null },
          { data: null, error: null },
        ],
        pagos: [{ data: [], error: null }],
        movimientos_recurrentes: [{ data: [], error: null }],
      });

      await service.ejecutarCierreMensual(TOKEN, ADMIN_ID);

      // The update call on socios should clear id_tipo_abono and creditos
      const updateCall = mockClient.from('socios').update.mock.calls[0][0];
      expect(updateCall.id_tipo_abono).toBeNull();
      expect(updateCall.creditos_disponibles).toBe(0);
    });
  });
});
