import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { GracefulShutdownService } from '../../../../src/common/services/graceful-shutdown.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let moduleRef: ModuleRef;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    // Create mock queue
    mockQueue = {
      pause: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getActiveCount: jest.fn().mockResolvedValue(0),
    } as unknown;

    // Mock ModuleRef
    const mockModuleRef = {
      get: jest.fn((token, options) => {
        // Only return queue for 'ticket-analysis'
        if (token === getQueueToken('ticket-analysis')) {
          return mockQueue;
        }
        throw new Error('Queue not found');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
      ],
    }).compile();

    service = module.get<GracefulShutdownService>(GracefulShutdownService);
    moduleRef = module.get<ModuleRef>(ModuleRef);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onApplicationShutdown', () => {
    it('should complete shutdown when no queues are found', async () => {
      // Mock moduleRef to return no queues
      jest.spyOn(moduleRef, 'get').mockImplementation(() => {
        throw new Error('Queue not found');
      });

      await expect(service.onApplicationShutdown('SIGTERM')).resolves.toBeUndefined();
    });

    it('should pause, wait, and close queues on shutdown', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(mockQueue.pause).toHaveBeenCalled();
      expect(mockQueue.getActiveCount).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should wait for active jobs to complete', async () => {
      // Simulate 2 active jobs that complete after 2 checks
      let callCount = 0;
      mockQueue.getActiveCount.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount <= 2 ? 2 : 0);
      });

      await service.onApplicationShutdown('SIGTERM');

      expect(mockQueue.getActiveCount).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should timeout if jobs take too long', async () => {
      // Simulate jobs that never complete
      mockQueue.getActiveCount.mockResolvedValue(5);

      // Mock sleep to speed up test
      jest.spyOn(service as unknown, 'sleep').mockResolvedValue(undefined);

      await service.onApplicationShutdown('SIGTERM');

      // Should still close queues even after timeout
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle errors during pause gracefully', async () => {
      mockQueue.pause.mockRejectedValue(new Error('Pause failed'));

      await expect(service.onApplicationShutdown('SIGTERM')).resolves.toBeUndefined();

      // Should still attempt to close
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle errors during close gracefully', async () => {
      mockQueue.close.mockRejectedValue(new Error('Close failed'));

      await expect(service.onApplicationShutdown('SIGTERM')).resolves.toBeUndefined();
    });
  });
});
