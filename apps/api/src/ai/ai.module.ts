import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AiCacheService } from './ai-cache.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AIService, AIProviderFactory, AiCacheService],
  exports: [AIService, AIProviderFactory, AiCacheService],
})
export class AIModule {}
