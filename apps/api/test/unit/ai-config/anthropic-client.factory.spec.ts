import { Test, TestingModule } from '@nestjs/testing';
import { AnthropicClientFactory } from '../../../src/modules/ai-config/anthropic-client.factory';
import { AiConfigService } from '../../../src/modules/ai-config/ai-config.service';

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((opts: any) => ({
      _apiKey: opts.apiKey,
    })),
  };
});

describe('AnthropicClientFactory', () => {
  let factory: AnthropicClientFactory;
  let aiConfigService: jest.Mocked<AiConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnthropicClientFactory,
        {
          provide: AiConfigService,
          useValue: {
            getDecryptedApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    factory = module.get<AnthropicClientFactory>(AnthropicClientFactory);
    aiConfigService = module.get(AiConfigService);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should return null when no API key configured', async () => {
    aiConfigService.getDecryptedApiKey.mockResolvedValue(null);

    const client = await factory.createForTenant('tenant-123');

    expect(client).toBeNull();
  });

  it('should create an Anthropic client with the tenant key', async () => {
    aiConfigService.getDecryptedApiKey.mockResolvedValue('sk-ant-api03-test');

    const client = await factory.createForTenant('tenant-123');

    expect(client).not.toBeNull();
    expect((client as unknown)._apiKey).toBe('sk-ant-api03-test');
  });
});
