import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import request from 'supertest';
import { UsersController } from '../../../src/users/users.controller';
import { UsersService } from '../../../src/users/users.service';
import { JwtAuthGuard } from '../../../src/common/guards';
import { TicketRelationsController } from '../../../src/modules/ticket-relations/ticket-relations.controller';

/** Regression tests for routes that were unreachable because of routing mistakes. */
describe('API routing', () => {
  describe('UsersController', () => {
    let app: INestApplication;
    const usersService = {
      updateProfile: jest.fn().mockResolvedValue({ route: 'profile' }),
      changePassword: jest.fn().mockResolvedValue({ route: 'password' }),
      updateNotifications: jest.fn().mockResolvedValue({ route: 'notifications' }),
      update: jest.fn().mockResolvedValue({ route: ':id' }),
    };

    const fakeAuth: CanActivate = {
      canActivate(ctx: ExecutionContext) {
        ctx.switchToHttp().getRequest().user = { id: 'u1', tenantId: 't1', role: 'member' };
        return true;
      },
    };

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [{ provide: UsersService, useValue: usersService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(fakeAuth)
        .compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    it.each(['profile', 'password', 'notifications'])(
      'PATCH /users/%s reaches its own handler, not PATCH /users/:id',
      async (route) => {
        const res = await request(app.getHttpServer()).patch(`/users/${route}`).send({});

        expect(res.body).toEqual({ route });
        expect(usersService.update).not.toHaveBeenCalled();
      },
    );

    it('rejects a non-UUID id with 400 instead of a 500', async () => {
      const res = await request(app.getHttpServer()).patch('/users/not-a-uuid').send({});

      expect(res.status).toBe(400);
    });
  });

  it('ticket relations are not double-prefixed with /api', () => {
    // The global "api" prefix is added in main.ts
    expect(Reflect.getMetadata(PATH_METADATA, TicketRelationsController)).toBe(
      'tickets/:ticketId/relations',
    );
  });
});
