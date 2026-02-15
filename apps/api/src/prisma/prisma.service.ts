import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../common/services/encryption.service';
import { createEncryptionMiddleware } from './prisma-encryption.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    @Optional() @Inject(EncryptionService) private readonly encryptionService?: EncryptionService,
  ) {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    // Register encryption middleware if EncryptionService is available
    if (this.encryptionService) {
      this.$use(createEncryptionMiddleware(this.encryptionService));
      this.logger.log('Prisma encryption middleware registered');
    } else {
      this.logger.warn('EncryptionService not available — Prisma encryption middleware disabled');
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    const models = Reflect.ownKeys(this).filter(
      key => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$')
    );

    return Promise.all(
      models.map(modelKey => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as { deleteMany: () => Promise<unknown> }).deleteMany();
        }
        return Promise.resolve();
      })
    );
  }
}
