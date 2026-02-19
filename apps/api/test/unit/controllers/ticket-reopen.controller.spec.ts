import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketReopenController } from '../../../src/modules/tickets/controllers/ticket-reopen.controller';
import { TicketTimelineService } from '../../../src/modules/tickets/services/ticket-timeline.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('TicketReopenController', () => {
  let controller: TicketReopenController;
  let prismaService: PrismaService;
  let ticketTimelineService: TicketTimelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketReopenController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            ticketMessage: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: TicketTimelineService,
          useValue: {
            recordEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketReopenController>(TicketReopenController);
    prismaService = module.get<PrismaService>(PrismaService);
    ticketTimelineService = module.get<TicketTimelineService>(TicketTimelineService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reopen', () => {
    const mockTicket = {
      id: 'ticket-123',
      tenantId: 'tenant-123',
      status: 'merged',
      reopenToken: 'valid-token-123',
    };

    it('should reopen ticket with valid token', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(mockTicket as unknown);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue([null, null] as unknown);
      jest.spyOn(ticketTimelineService, 'recordEvent').mockResolvedValue(undefined);

      const result = await controller.reopen('ticket-123', 'valid-token-123');

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe('ticket-123');
      expect(result.status).toBe('open');
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(ticketTimelineService.recordEvent).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
        'ticket_reopened',
        { previousStatus: 'merged' },
      );
    });

    it('should throw BadRequestException when token is missing', async () => {
      await expect(controller.reopen('ticket-123', '')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(null);

      await expect(controller.reopen('ticket-123', 'any-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when token is invalid', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(mockTicket as unknown);

      await expect(controller.reopen('ticket-123', 'wrong-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ticket is not reopenable', async () => {
      const newTicket = { ...mockTicket, status: 'new' };
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(newTicket as unknown);

      await expect(controller.reopen('ticket-123', 'valid-token-123')).rejects.toThrow(BadRequestException);
    });

    it('should allow reopening from resolved status', async () => {
      const resolvedTicket = { ...mockTicket, status: 'resolved' };
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(resolvedTicket as unknown);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue([null, null] as unknown);

      const result = await controller.reopen('ticket-123', 'valid-token-123');

      expect(result.success).toBe(true);
    });

    it('should allow reopening from closed status', async () => {
      const closedTicket = { ...mockTicket, status: 'closed' };
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(closedTicket as unknown);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue([null, null] as unknown);

      const result = await controller.reopen('ticket-123', 'valid-token-123');

      expect(result.success).toBe(true);
    });
  });
});
