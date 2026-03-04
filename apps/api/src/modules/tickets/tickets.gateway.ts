import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../agent/ws-jwt.guard';
import {
  getWebSocketCorsConfig,
  WS_PING_INTERVAL,
  WS_PING_TIMEOUT,
} from '../../config/websocket-cors.config';

interface WsUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

@WebSocketGateway({
  namespace: '/tickets',
  cors: getWebSocketCorsConfig(),
  pingInterval: WS_PING_INTERVAL,
  pingTimeout: WS_PING_TIMEOUT,
})
@UseGuards(WsJwtGuard)
export class TicketsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TicketsGateway.name);

  afterInit() {
    this.logger.log('Tickets WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.log(
        `Client connected: ${client.id} (user: ${user.userId}, tenant: ${user.tenantId})`,
      );
    } else {
      this.logger.log(`Client connected: ${client.id} (unauthenticated)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ----------------------------------------------------------------
  // Client-subscribed events
  // ----------------------------------------------------------------

  @SubscribeMessage('join-tenant')
  async handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: { tenantId?: string },
  ) {
    const user = client.data.user as WsUser;

    // Use the tenant from the JWT -- ignore client-supplied tenantId for security
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new WsException('Tenant ID not found in authentication token');
    }

    const room = this.tenantRoom(tenantId);
    await client.join(room);

    this.logger.log(
      `User ${user.userId} joined tenant room ${tenantId}`,
    );

    return { event: 'joined-tenant', data: { tenantId } };
  }

  @SubscribeMessage('leave-tenant')
  async handleLeaveTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: { tenantId?: string },
  ) {
    const user = client.data.user as WsUser;
    const tenantId = user.tenantId;

    const room = this.tenantRoom(tenantId);
    await client.leave(room);

    this.logger.log(
      `User ${user.userId} left tenant room ${tenantId}`,
    );

    return { event: 'left-tenant', data: { tenantId } };
  }

  // ----------------------------------------------------------------
  // Server-side emit helpers (called by TicketsService / Controller)
  // ----------------------------------------------------------------

  emitTicketCreated(tenantId: string, ticket: Record<string, unknown>) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:created', { event: 'ticket:created', ticket, timestamp: new Date() });
  }

  emitTicketUpdated(tenantId: string, ticket: Record<string, unknown>) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:updated', { event: 'ticket:updated', ticket, timestamp: new Date() });
  }

  emitTicketAssigned(tenantId: string, ticket: Record<string, unknown>) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:assigned', { event: 'ticket:assigned', ticket, timestamp: new Date() });
  }

  emitTicketDeleted(tenantId: string, ticketId: string) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:deleted', { event: 'ticket:deleted', ticket: { id: ticketId }, timestamp: new Date() });
  }

  emitAiAnalysisCompleted(tenantId: string, ticket: Record<string, unknown>) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:ai-analysis-completed', { event: 'ticket:ai-analysis-completed', ticket, timestamp: new Date() });
  }

  emitTimelineEvent(tenantId: string, ticketId: string, event: Record<string, unknown>) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:timeline-event', {
        event: 'ticket:timeline-event',
        ticketId,
        timelineEvent: event,
        timestamp: new Date(),
      });
  }

  emitEscalation(tenantId: string, data: { ticketId: string; sessionId: string; reason: string; assignedTo?: string; summary?: string }) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('ticket:escalated', {
        event: 'ticket:escalated',
        ...data,
        timestamp: new Date(),
      });
  }

  /**
   * Emitted when N1 (DeepAnalysis) completes and the ticket is handed off to N2 (generate-action-plan).
   * Used by the dashboard timeline to display real-time pipeline progress.
   */
  emitEscalatedToN2(tenantId: string, data: { ticketId: string; sessionId: string; n1Summary: string; timestamp: string }) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('agent:escalated-to-n2', {
        event: 'agent:escalated-to-n2',
        ...data,
      });
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }
}
