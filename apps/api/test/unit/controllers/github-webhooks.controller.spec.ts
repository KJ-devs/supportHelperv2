import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@octokit/webhooks', () => ({
  Webhooks: jest.fn().mockImplementation(() => ({ verify: jest.fn(), on: jest.fn() })),
}));

import { GithubWebhooksController } from '../../../src/modules/github/controllers/github-webhooks.controller';
import { GithubWebhooksService } from '../../../src/modules/github/services/github-webhooks.service';

describe('GithubWebhooksController', () => {
  let controller: GithubWebhooksController;
  let webhooksService: jest.Mocked<GithubWebhooksService>;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GithubWebhooksController],
      providers: [
        {
          provide: GithubWebhooksService,
          useValue: {
            processWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GithubWebhooksController>(GithubWebhooksController);
    webhooksService = module.get(GithubWebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should process valid webhook and return received status', async () => {
      (webhooksService.processWebhook as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.handleWebhook(
        'issues', 'sha256=abc123', 'delivery-123',
        { action: 'opened', issue: { number: 42 } },
        mockRequest as unknown,
      );

      expect(webhooksService.processWebhook).toHaveBeenCalledWith(
        'issues', { action: 'opened', issue: { number: 42 } }, 'sha256=abc123', 'delivery-123',
      );
      expect(result).toEqual({ received: true, event: 'issues', deliveryId: 'delivery-123' });
    });

    it('should use "unknown" when deliveryId is missing', async () => {
      (webhooksService.processWebhook as jest.Mock).mockResolvedValue(undefined);

      await controller.handleWebhook('push', 'sha256=def', undefined as unknown, {}, mockRequest as unknown);

      expect(webhooksService.processWebhook).toHaveBeenCalledWith('push', {}, 'sha256=def', 'unknown');
    });

    it('should throw UnauthorizedException when event header is missing', async () => {
      await expect(
        controller.handleWebhook(undefined as unknown, 'sha256=abc', 'del-1', {}, mockRequest as unknown),
      ).rejects.toThrow(UnauthorizedException);
      expect(webhooksService.processWebhook).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when signature header is missing', async () => {
      await expect(
        controller.handleWebhook('issues', undefined as unknown, 'del-1', {}, mockRequest as unknown),
      ).rejects.toThrow(UnauthorizedException);
      expect(webhooksService.processWebhook).not.toHaveBeenCalled();
    });

    it('should propagate errors from webhooksService', async () => {
      (webhooksService.processWebhook as jest.Mock).mockRejectedValue(new Error('Processing failed'));

      await expect(
        controller.handleWebhook('issues', 'sha256=abc', 'del-1', {}, mockRequest as unknown),
      ).rejects.toThrow('Processing failed');
    });
  });
});
