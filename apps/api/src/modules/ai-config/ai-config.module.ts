import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AnthropicClientFactory } from './anthropic-client.factory';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiConfigController],
  providers: [AiConfigService, AnthropicClientFactory],
  exports: [AiConfigService, AnthropicClientFactory],
})
export class AiConfigModule {}
