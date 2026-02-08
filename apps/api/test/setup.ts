import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting API tests...');
});

afterAll(async () => {
  console.log('✅ API tests complete');
});

// Helper to create test module
export async function createTestingModule(imports: any[]): Promise<TestingModule> {
  return Test.createTestingModule({
    imports,
  }).compile();
}

// Helper to create test app with common config
export async function createTestApp(moduleRef: TestingModule): Promise<INestApplication> {
  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.init();
  return app;
}

// Common test utilities
export const testUtils = {
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  generateEmail: () => `test-${Date.now()}@example.com`,

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};
