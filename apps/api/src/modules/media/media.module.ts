import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';
import { FFprobeService } from './ffprobe.service';
import { MediaController } from './media.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'video-analysis',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60, // 7 days
          count: 100,
        },
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, S3Service, FFprobeService],
  exports: [MediaService, S3Service, FFprobeService],
})
export class MediaModule {}
