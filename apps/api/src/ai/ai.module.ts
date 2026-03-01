import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AiCacheService } from './ai-cache.service';
import { ModelTieringService } from './model-tiering.service';
import { AiCircuitBreakerService } from './circuit-breaker.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AIService, AIProviderFactory, AiCacheService, ModelTieringService, AiCircuitBreakerService],
  exports: [AIService, AIProviderFactory, AiCacheService, ModelTieringService, AiCircuitBreakerService],
})
export class AIModule {}
