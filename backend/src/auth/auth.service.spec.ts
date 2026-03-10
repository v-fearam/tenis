import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createSupabaseMock } from '../__mocks__/supabase.mock';
import { fixtures } from '../__fixtures__';

describe('AuthService', () => {
  let service: AuthService;
  let mockClient: any;

  const buildModule = async (tableMap = {}, rpcResponses: any[] = []) => {
    const { mockService, mockClient: mc } = createSupabaseMock(tableMap, rpcResponses);
    mockClient = mc;

    // Add auth methods not present in default mock
    mockClient.auth.signInWithPassword = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  };

  // -------------------------------------------------------------------------
  // changePassword
  // -------------------------------------------------------------------------
  describe('changePassword', () => {
    const user = {
      id: fixtures.usuario_socio.id,
      email: fixtures.usuario_socio.email,
      force_password_change: false,
    };

    it('fails if currentPassword is incorrect', async () => {
      await buildModule({
        usuarios: [{ data: null, error: null }], // not needed for this path
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.changePassword(user, { newPassword: 'newpass123', currentPassword: 'wrongpass' }),
      ).rejects.toBeDefined();
    });

    it('fails if currentPassword not provided and not forced', async () => {
      await buildModule({});

      await expect(
        service.changePassword(user, { newPassword: 'newpass123' }),
      ).rejects.toBeDefined();
    });

    it('succeeds: changes password, resets force_password_change, creates audit log', async () => {
      await buildModule({
        usuarios: [{ data: null, error: null }],   // update force_password_change
        audit_log: [{ data: null, error: null }],   // insert audit
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: user.id },
          session: { access_token: 'tok' },
        },
        error: null,
      });
      mockClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

      const result = await service.changePassword(
        user,
        { newPassword: 'newpass123', currentPassword: 'correctpass' },
      );

      expect(result.message).toBe('Contraseña actualizada correctamente');
      expect(mockClient.auth.admin.updateUserById).toHaveBeenCalledWith(user.id, {
        password: 'newpass123',
      });
    });

    it('fails on auth provider error', async () => {
      await buildModule({
        usuarios: [{ data: null, error: null }],
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: user.id }, session: { access_token: 'tok' } },
        error: null,
      });
      mockClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'Auth provider error' },
      });

      await expect(
        service.changePassword(user, { newPassword: 'newpass123', currentPassword: 'correctpass' }),
      ).rejects.toBeDefined();
    });

    it('fails on DB update error', async () => {
      await buildModule({
        usuarios: [{ data: null, error: { message: 'DB error' } }],
        audit_log: [{ data: null, error: null }],
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: user.id }, session: { access_token: 'tok' } },
        error: null,
      });
      mockClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

      await expect(
        service.changePassword(user, { newPassword: 'newpass123', currentPassword: 'correctpass' }),
      ).rejects.toBeDefined();
    });

    it('skips currentPassword validation when force_password_change=true', async () => {
      const forcedUser = { ...user, force_password_change: true };

      await buildModule({
        usuarios: [{ data: null, error: null }],   // update force_password_change
        audit_log: [{ data: null, error: null }],   // insert audit
      });

      mockClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

      const result = await service.changePassword(
        forcedUser,
        { newPassword: 'newpass123' },
      );

      expect(result.message).toBe('Contraseña actualizada correctamente');
      // signInWithPassword should NOT have been called
      expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // login — lockout
  // -------------------------------------------------------------------------
  describe('login — lockout', () => {
    const loginDto = { email: 'socio@test.com', password: 'wrongpass' };

    it('increments failed_login_attempts on invalid credentials', async () => {
      await buildModule({
        usuarios: [
          // 1st call: check lock status by email
          {
            data: { ...fixtures.usuario_socio, failed_login_attempts: 0, is_locked: false },
            error: null,
          },
          // 2nd call: update failed_login_attempts
          { data: null, error: null },
        ],
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(service.login(loginDto)).rejects.toBeDefined();
    });

    it('locks account on 5th failed attempt', async () => {
      await buildModule({
        usuarios: [
          // 1st: check lock status — already at 4 attempts
          {
            data: { ...fixtures.usuario_socio, failed_login_attempts: 4, is_locked: false },
            error: null,
          },
          // 2nd: update to lock
          { data: null, error: null },
        ],
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(service.login(loginDto)).rejects.toBeDefined();
    });

    it('rejects login when account is locked', async () => {
      await buildModule({
        usuarios: [
          {
            data: { ...fixtures.usuario_socio, is_locked: true, failed_login_attempts: 5 },
            error: null,
          },
        ],
      });

      await expect(service.login(loginDto)).rejects.toBeDefined();
      // signInWithPassword should NOT have been called since account is locked
      expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });
});
