import queueConfig from '../queue.config';

describe('Queue Configuration', () => {
  let config: any;

  beforeEach(() => {
    // Mock environment variables
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.WORKER_CONCURRENCY = '10';

    config = queueConfig();
  });

  describe('connection', () => {
    it('should parse Redis URL correctly', () => {
      expect(config.connection).toEqual({
        host: 'localhost',
        port: 6379,
      });
    });

    it('should include password if present in URL', () => {
      process.env.REDIS_URL = 'redis://:mypassword@localhost:6379';
      config = queueConfig();

      expect(config.connection).toEqual({
        host: 'localhost',
        port: 6379,
        password: 'mypassword',
      });
    });

    it('should use default Redis URL if not provided', () => {
      delete process.env.REDIS_URL;
      config = queueConfig();

      expect(config.connection.host).toBe('localhost');
      expect(config.connection.port).toBe(6379);
    });
  });

  describe('exponential backoff', () => {
    it('should calculate correct backoff delay for attempt 1', () => {
      const delay = config.calculateBackoff(1);
      expect(delay).toBe(60 * 1000); // 1 minute
    });

    it('should calculate correct backoff delay for attempt 2', () => {
      const delay = config.calculateBackoff(2);
      expect(delay).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should calculate correct backoff delay for attempt 3', () => {
      const delay = config.calculateBackoff(3);
      expect(delay).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should calculate correct backoff delay for attempt 4', () => {
      const delay = config.calculateBackoff(4);
      expect(delay).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should cap at max delay for attempts beyond 4', () => {
      const delay5 = config.calculateBackoff(5);
      const delay10 = config.calculateBackoff(10);

      expect(delay5).toBe(60 * 60 * 1000); // Still 1 hour
      expect(delay10).toBe(60 * 60 * 1000); // Still 1 hour
    });
  });

  describe('default job options', () => {
    it('should set 4 retry attempts', () => {
      expect(config.defaultJobOptions.attempts).toBe(4);
    });

    it('should use custom backoff type', () => {
      expect(config.defaultJobOptions.backoff.type).toBe('custom');
    });

    it('should not auto-remove failed jobs', () => {
      expect(config.defaultJobOptions.removeOnFail).toBe(false);
    });

    it('should auto-remove completed jobs after 7 days', () => {
      expect(config.defaultJobOptions.removeOnComplete.age).toBe(7 * 24 * 60 * 60);
      expect(config.defaultJobOptions.removeOnComplete.count).toBe(1000);
    });
  });

  describe('dead letter queue', () => {
    it('should have correct configuration', () => {
      expect(config.deadLetterQueue.name).toBe('dead-letter');
      expect(config.deadLetterQueue.connection).toBeDefined();
      expect(config.deadLetterQueue.defaultJobOptions.attempts).toBe(1);
      expect(config.deadLetterQueue.defaultJobOptions.removeOnFail).toBe(false);
    });

    it('should retain failed jobs for 90 days', () => {
      expect(config.deadLetterQueue.defaultJobOptions.removeOnComplete.age).toBe(
        90 * 24 * 60 * 60,
      );
    });
  });

  describe('queue-specific configuration', () => {
    it('should configure video-analysis queue with priority 5', () => {
      const videoQueue = config.queues['video-analysis'];
      expect(videoQueue.defaultJobOptions.priority).toBe(5);
      expect(videoQueue.defaultJobOptions.attempts).toBe(4);
    });

    it('should configure github-sync queue with priority 3', () => {
      const githubQueue = config.queues['github-sync'];
      expect(githubQueue.defaultJobOptions.priority).toBe(3);
      expect(githubQueue.defaultJobOptions.attempts).toBe(4);
    });

    it('should configure agent-orchestration queue with priority 10 and 5 attempts', () => {
      const agentQueue = config.queues['agent-orchestration'];
      expect(agentQueue.defaultJobOptions.priority).toBe(10);
      expect(agentQueue.defaultJobOptions.attempts).toBe(5);
    });

    it('should configure integration-sync queue with priority 2', () => {
      const integrationQueue = config.queues['integration-sync'];
      expect(integrationQueue.defaultJobOptions.priority).toBe(2);
      expect(integrationQueue.defaultJobOptions.attempts).toBe(4);
    });
  });

  describe('worker configuration', () => {
    it('should use default concurrency of 10', () => {
      expect(config.worker.concurrency).toBe(10);
    });

    it('should respect WORKER_CONCURRENCY env var', () => {
      process.env.WORKER_CONCURRENCY = '20';
      config = queueConfig();

      expect(config.worker.concurrency).toBe(20);
    });

    it('should configure rate limiter', () => {
      expect(config.worker.limiter.max).toBe(100);
      expect(config.worker.limiter.duration).toBe(60000);
    });

    it('should include backoff strategy in settings', () => {
      expect(config.worker.settings.backoffStrategy).toBe(config.calculateBackoff);
    });
  });
});
