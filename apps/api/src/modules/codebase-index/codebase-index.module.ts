import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { GithubModule } from '../github/github.module';
import { CodebaseIndexController } from './codebase-index.controller';
import { CodebaseIndexerService } from './services/codebase-indexer.service';
import { CodebaseSearchService } from './services/codebase-search.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => GithubModule),
    AIModule,
    BullModule.registerQueue({
      name: 'codebase-indexing',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [CodebaseIndexController],
  providers: [CodebaseIndexerService, CodebaseSearchService],
  exports: [CodebaseIndexerService, CodebaseSearchService],
})
export class CodebaseIndexModule {}
