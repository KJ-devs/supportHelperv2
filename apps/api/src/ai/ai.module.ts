import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AIService, AIProviderFactory],
  exports: [AIService, AIProviderFactory],
})
export class AIModule {}
