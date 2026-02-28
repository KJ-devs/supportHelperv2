import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubInstallationController } from '../../../src/modules/github/controllers/github-installation.controller';
import { GithubInstallationService } from '../../../src/modules/github/services/github-installation.service';
import { GithubAppService } from '../../../src/modules/github/services/github-app.service';

describe('GithubInstallationController', () => {
  let controller: GithubInstallationController;
  let installationService: jest.Mocked<GithubInstallationService>;
  let appService: jest.Mocked<GithubAppService>;
  let mockResponse: Partial<Response>;

  const FRONTEND_URL = 'http://localhost:3000';

  beforeEach(async () => {
    mockResponse = { redirect: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GithubInstallationController],
      providers: [
        {
          provide: GithubInstallationService,
          useValue: {
            getInstallUrl: jest.fn(),
            handleInstallationCallback: jest.fn(),
            getInstallations: jest.fn(),
            removeInstallation: jest.fn(),
            syncInstallationsFromGithub: jest.fn(),
          },
        },
        {
          provide: GithubAppService,
          useValue: {
            isEnabled: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(FRONTEND_URL),
          },
        },
      ],
    }).compile();

    controller = module.get<GithubInstallationController>(GithubInstallationController);
    installationService = module.get(GithubInstallationService);
    appService = module.get(GithubAppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getInstallUrl ────────────────────────────────────────────────────────

  describe('getInstallUrl', () => {
    it('should return the install URL when GitHub App is enabled', () => {
      (appService.isEnabled as jest.Mock).mockReturnValue(true);
      (installationService.getInstallUrl as jest.Mock).mockReturnValue(
        'https://github.com/apps/my-app/installations/new?state=tenant-123',
      );

      const result = controller.getInstallUrl('tenant-123');

      expect(installationService.getInstallUrl).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual({
        url: 'https://github.com/apps/my-app/installations/new?state=tenant-123',
      });
    });

    it('should throw BadRequestException when GitHub App is not enabled', () => {
      (appService.isEnabled as jest.Mock).mockReturnValue(false);

      expect(() => controller.getInstallUrl('tenant-123')).toThrow(BadRequestException);
    });
  });

  // ─── installCallback ──────────────────────────────────────────────────────

  describe('installCallback', () => {
    it('should call handleInstallationCallback and redirect to success page', async () => {
      (installationService.handleInstallationCallback as jest.Mock).mockResolvedValue({});

      await controller.installCallback('42', 'tenant-123', mockResponse as Response);

      expect(installationService.handleInstallationCallback).toHaveBeenCalledWith(42, 'tenant-123');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/dashboard/settings/github?github_app=installed&installation_id=42`,
      );
    });

    it('should redirect with error when installation_id is missing', async () => {
      await controller.installCallback('', 'tenant-123', mockResponse as Response);

      expect(installationService.handleInstallationCallback).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/dashboard/settings/github?error=${encodeURIComponent('Missing installation_id')}`,
      );
    });

    it('should redirect with error when state (tenantId) is missing', async () => {
      await controller.installCallback('42', '', mockResponse as Response);

      expect(installationService.handleInstallationCallback).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/dashboard/settings/github?error=${encodeURIComponent('Missing tenant context. Please retry installation from the dashboard.')}`,
      );
    });

    it('should redirect with error when installation_id is not a number', async () => {
      await controller.installCallback('not-a-number', 'tenant-123', mockResponse as Response);

      expect(installationService.handleInstallationCallback).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/dashboard/settings/github?error=${encodeURIComponent('Invalid installation_id')}`,
      );
    });

    it('should redirect with error when handleInstallationCallback throws', async () => {
      (installationService.handleInstallationCallback as jest.Mock).mockRejectedValue(
        new Error('Installation not found on GitHub'),
      );

      await controller.installCallback('42', 'tenant-123', mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/dashboard/settings/github?error=${encodeURIComponent('Installation not found on GitHub')}`,
      );
    });
  });

  // ─── listInstallations ────────────────────────────────────────────────────

  describe('listInstallations', () => {
    it('should return a mapped list of installations', async () => {
      const rawInstallations = [
        {
          id: 'inst-uuid-1',
          installationId: BigInt(987654),
          accountLogin: 'my-org',
          accountType: 'Organization',
          suspendedAt: null,
          createdAt: new Date('2026-01-01'),
        },
      ];
      (installationService.getInstallations as jest.Mock).mockResolvedValue(rawInstallations);

      const result = await controller.listInstallations('tenant-123');

      expect(result).toEqual([
        {
          id: 'inst-uuid-1',
          installationId: 987654,
          accountLogin: 'my-org',
          accountType: 'Organization',
          suspended: false,
          createdAt: rawInstallations[0].createdAt,
        },
      ]);
    });
  });

  // ─── removeInstallation ───────────────────────────────────────────────────

  describe('removeInstallation', () => {
    it('should delegate to the service and return the result', async () => {
      (installationService.removeInstallation as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.removeInstallation('inst-uuid-1', 'tenant-123');

      expect(installationService.removeInstallation).toHaveBeenCalledWith('inst-uuid-1', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });
});
