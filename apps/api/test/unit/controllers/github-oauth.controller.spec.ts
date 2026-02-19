import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubOAuthController } from '../../../src/modules/github/controllers/github-oauth.controller';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';

describe('GithubOAuthController', () => {
  let controller: GithubOAuthController;
  let oauthService: jest.Mocked<GithubOAuthService>;

  const mockConnection = {
    id: 'connection-123',
    tenantId: 'tenant-123',
    accessToken: 'gho_token',
    refreshToken: 'refresh_token',
    repos: ['owner/repo1', 'owner/repo2'],
    createdAt: new Date('2026-01-01'),
  };

  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockResponse = { redirect: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GithubOAuthController],
      providers: [
        {
          provide: GithubOAuthService,
          useValue: {
            isEnabled: jest.fn(),
            getAuthorizationUrl: jest.fn(),
            verifyStateToken: jest.fn(),
            exchangeCodeForToken: jest.fn(),
            getAuthenticatedUser: jest.fn(),
            saveConnection: jest.fn(),
            getConnection: jest.fn(),
            deleteConnection: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    controller = module.get<GithubOAuthController>(GithubOAuthController);
    oauthService = module.get(GithubOAuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('authorize', () => {
    it('should return authorization URL and state when enabled', () => {
      const mockAuthUrl = {
        url: 'https://github.com/login/oauth/authorize?client_id=abc&state=xyz',
        state: 'state-token-123',
      };
      (oauthService.isEnabled as jest.Mock).mockReturnValue(true);
      (oauthService.getAuthorizationUrl as jest.Mock).mockReturnValue(mockAuthUrl);

      const result = controller.authorize('tenant-123');

      expect(oauthService.isEnabled).toHaveBeenCalled();
      expect(oauthService.getAuthorizationUrl).toHaveBeenCalledWith('tenant-123', undefined);
      expect(result).toEqual(mockAuthUrl);
    });

    it('should pass redirect parameter', () => {
      const mockAuthUrl = { url: 'https://github.com/...', state: 'xyz' };
      (oauthService.isEnabled as jest.Mock).mockReturnValue(true);
      (oauthService.getAuthorizationUrl as jest.Mock).mockReturnValue(mockAuthUrl);

      controller.authorize('tenant-123', '/dashboard/settings');

      expect(oauthService.getAuthorizationUrl).toHaveBeenCalledWith('tenant-123', '/dashboard/settings');
    });

    it('should throw BadRequestException when not enabled', () => {
      (oauthService.isEnabled as jest.Mock).mockReturnValue(false);

      expect(() => controller.authorize('tenant-123')).toThrow(BadRequestException);
    });
  });

  describe('callback', () => {
    it('should redirect to success page on successful OAuth', async () => {
      const query = { code: 'oauth-code', state: 'state-token' } as unknown;
      (oauthService.verifyStateToken as jest.Mock).mockReturnValue({ tenantId: 'tenant-123', redirectUri: null });
      (oauthService.exchangeCodeForToken as jest.Mock).mockResolvedValue({ access_token: 'gho_token', refresh_token: 'rt', expires_in: 28800 });
      (oauthService.getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 12345, login: 'testuser' });
      (oauthService.saveConnection as jest.Mock).mockResolvedValue(undefined);

      await controller.callback(query, mockResponse as Response);

      expect(oauthService.verifyStateToken).toHaveBeenCalledWith('state-token');
      expect(oauthService.exchangeCodeForToken).toHaveBeenCalledWith('oauth-code');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/github?github=connected&user=testuser',
      );
    });

    it('should use custom redirectUri when provided', async () => {
      const query = { code: 'code', state: 'state' } as unknown;
      (oauthService.verifyStateToken as jest.Mock).mockReturnValue({ tenantId: 'tenant-123', redirectUri: 'http://localhost:3000/custom' });
      (oauthService.exchangeCodeForToken as jest.Mock).mockResolvedValue({ access_token: 'tok', expires_in: 28800 });
      (oauthService.getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 1, login: 'user' });

      await controller.callback(query, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/custom?github=connected&user=user');
    });

    it('should redirect with error when GitHub returns error', async () => {
      const query = { error: 'access_denied', error_description: 'User denied', state: 'state' } as unknown;

      await controller.callback(query, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/github?error=User%20denied',
      );
      expect(oauthService.verifyStateToken).not.toHaveBeenCalled();
    });

    it('should redirect with error when token exchange fails', async () => {
      const query = { code: 'code', state: 'state' } as unknown;
      (oauthService.verifyStateToken as jest.Mock).mockReturnValue({ tenantId: 'tenant-123' });
      (oauthService.exchangeCodeForToken as jest.Mock).mockRejectedValue(new Error('Token exchange failed'));

      await controller.callback(query, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/github?error=GitHub%20connection%20failed',
      );
    });
  });

  describe('status', () => {
    it('should return connected=true when connection exists', async () => {
      (oauthService.getConnection as jest.Mock).mockResolvedValue(mockConnection);

      const result = await controller.status('tenant-123');

      expect(result).toEqual({
        connected: true,
        connectionId: 'connection-123',
        repoCount: 2,
        createdAt: mockConnection.createdAt,
      });
    });

    it('should return connected=false when no connection', async () => {
      (oauthService.getConnection as jest.Mock).mockResolvedValue(null);

      const result = await controller.status('tenant-123');

      expect(result).toEqual({ connected: false });
    });

    it('should handle connection with no repos', async () => {
      (oauthService.getConnection as jest.Mock).mockResolvedValue({ ...mockConnection, repos: null });

      const result = await controller.status('tenant-123');

      expect(result.repoCount).toBe(0);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and return success', async () => {
      (oauthService.deleteConnection as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.disconnect('tenant-123');

      expect(oauthService.deleteConnection).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual({ success: true, message: 'GitHub disconnected successfully' });
    });
  });
});
