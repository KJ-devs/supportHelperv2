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
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { DeepAnalysisService } from './deep-analysis.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  namespace: '/agent-v2',
  cors: getWebSocketCorsConfig(),
  pingInterval: WS_PING_INTERVAL,
  pingTimeout: WS_PING_TIMEOUT,
})
@UseGuards(WsJwtGuard)
export class AgentV2Gateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentV2Gateway.name);

  constructor(
    private readonly deepAnalysisService: DeepAnalysisService,
    private readonly prisma: PrismaService
  ) {}

  afterInit() {
    this.logger.log('Agent V2 WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.log(
        `Client connected: ${client.id} (user: ${user.userId}, tenant: ${user.tenantId})`
      );
    } else {
      this.logger.log(`Client connected: ${client.id} (unauthenticated)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── WebSocket message handlers ────────────────────────────

  @SubscribeMessage('agent:join_session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; ticketId?: string }
  ) {
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    const user = client.data.user as WsUser;

    // Verify the session belongs to the user's tenant
    const session = await this.prisma.agentSession.findFirst({
      where: { id: data.sessionId },
      include: { ticket: { select: { tenantId: true } } },
    });

    if (!session || session.ticket.tenantId !== user.tenantId) {
      throw new WsException('Session not found or access denied');
    }

    const sessionRoom = this.sessionRoomName(data.sessionId);
    await client.join(sessionRoom);

    if (data.ticketId) {
      // Verify the ticket belongs to the user's tenant
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: data.ticketId, tenantId: user.tenantId },
        select: { id: true },
      });

      if (!ticket) {
        throw new WsException('Ticket not found or access denied');
      }

      const ticketRoom = this.ticketRoomName(data.ticketId);
      await client.join(ticketRoom);
    }

    this.logger.log(`User ${user.userId} joined session room ${data.sessionId}`);

    return {
      event: 'joined-session',
      data: { sessionId: data.sessionId, ticketId: data.ticketId },
    };
  }

  @SubscribeMessage('agent:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; content: string }
  ) {
    const user = client.data.user as WsUser;
    if (!data?.sessionId || !data?.content) {
      throw new WsException('sessionId and content are required');
    }

    try {
      const result = await this.deepAnalysisService.handleUserMessage(
        data.sessionId,
        data.content,
        user.tenantId,
        user.userId
      );

      client.to(this.sessionRoomName(data.sessionId)).emit('agent:message', {
        sessionId: data.sessionId,
        role: 'assistant',
        content: result.content,
        toolsUsed: result.toolsUsed,
        timestamp: new Date().toISOString(),
      });

      client.emit('agent:typing', { isTyping: false });

      return { event: 'message-sent', data: result };
    } catch (error) {
      throw new WsException(error instanceof Error ? error.message : 'Failed to process message');
    }
  }

  @SubscribeMessage('join-session')
  async handleJoinSessionLegacy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ) {
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    const user = client.data.user as WsUser;

    // Verify the session belongs to the user's tenant
    const session = await this.prisma.agentSession.findFirst({
      where: { id: data.sessionId },
      include: { ticket: { select: { tenantId: true } } },
    });

    if (!session || session.ticket.tenantId !== user.tenantId) {
      throw new WsException('Session not found or access denied');
    }

    const room = this.sessionRoomName(data.sessionId);
    await client.join(room);

    this.logger.log(`User ${user.userId} joined session room ${data.sessionId}`);

    return { event: 'joined-session', data: { sessionId: data.sessionId } };
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ) {
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    const room = this.sessionRoomName(data.sessionId);
    await client.leave(room);

    const user = client.data.user as WsUser;
    this.logger.log(`User ${user.userId} left session room ${data.sessionId}`);

    return { event: 'left-session', data: { sessionId: data.sessionId } };
  }

  // ── EventEmitter listeners → broadcast to rooms ───────────

  @OnEvent('agent:tool_call')
  handleAgentToolCallEvent(event: {
    ticketId?: string;
    sessionId?: string;
    toolName: string;
    input: Record<string, unknown>;
    agentLevel?: string;
    model?: string;
  }) {
    if (!event.sessionId) return;
    this.server.to(this.sessionRoomName(event.sessionId)).emit('agent:tool_call', {
      sessionId: event.sessionId,
      toolName: event.toolName,
      input: event.input,
      agentLevel: event.agentLevel,
      model: event.model,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent:tool_result')
  handleAgentToolResultEvent(event: {
    ticketId?: string;
    sessionId?: string;
    toolName: string;
    durationMs: number;
    hasError: boolean;
  }) {
    if (!event.sessionId) return;
    this.server.to(this.sessionRoomName(event.sessionId)).emit('agent:tool_result', {
      sessionId: event.sessionId,
      toolName: event.toolName,
      durationMs: event.durationMs,
      hasError: event.hasError,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent:thinking')
  handleAgentThinkingEvent(event: {
    ticketId?: string;
    sessionId?: string;
    iteration: number;
    agentLevel?: string;
    model?: string;
  }) {
    if (!event.sessionId) return;
    this.server.to(this.sessionRoomName(event.sessionId)).emit('agent:thinking', {
      sessionId: event.sessionId,
      iteration: event.iteration,
      isThinking: true,
      agentLevel: event.agentLevel,
      model: event.model,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent.level_changed')
  handleAgentLevelChanged(data: {
    sessionId: string;
    level: string;
    model: string;
    reason: string;
  }) {
    this.server.to(this.sessionRoomName(data.sessionId)).emit('agent:level_changed', data);
  }

  @OnEvent('agent.activity')
  handleAgentActivity(data: {
    sessionId: string;
    agentLevel: string;
    model: string;
    currentAction: string;
    toolName?: string;
    iteration: number;
    timestamp: Date;
  }) {
    this.server.to(this.sessionRoomName(data.sessionId)).emit('agent:activity', data);
  }

  @OnEvent('agent.checkpoint')
  handleAgentCheckpoint(data: {
    sessionId: string;
    checkpointType: string;
    summary: string;
    proposedNextSteps?: string[];
    proposedChanges?: string[];
    message: string;
  }) {
    this.server.to(this.sessionRoomName(data.sessionId)).emit('agent:checkpoint', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent:complete')
  handleAgentCompleteEvent(event: { ticketId?: string; sessionId?: string; finalContent: string }) {
    if (!event.sessionId) return;
    this.server.to(this.sessionRoomName(event.sessionId)).emit('agent:complete', {
      sessionId: event.sessionId,
      finalContent: event.finalContent,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('ticket:fix_proposed')
  handleTicketFixProposedEvent(event: {
    ticketId: string;
    tenantId: string;
    sessionId?: string;
    prUrl: string;
    prNumber: number;
    prTitle: string;
  }) {
    const payload = {
      ticketId: event.ticketId,
      prUrl: event.prUrl,
      prNumber: event.prNumber,
      prTitle: event.prTitle,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients watching this ticket
    this.server.to(this.ticketRoomName(event.ticketId)).emit('ticket:fix_proposed', payload);

    // Also notify the active session room if available
    if (event.sessionId) {
      this.server.to(this.sessionRoomName(event.sessionId)).emit('ticket:fix_proposed', payload);
    }

    this.logger.log(
      `Broadcast ticket:fix_proposed for ticket ${event.ticketId} (PR #${event.prNumber})`
    );
  }

  // ── Server-side emit helpers ──────────────────────────────

  emitToolCall(sessionId: string, toolName: string, input: Record<string, unknown>) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:tool_call', {
      sessionId,
      toolName,
      input,
      timestamp: new Date().toISOString(),
    });
  }

  emitToolResult(sessionId: string, toolName: string, durationMs: number, hasError: boolean) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:tool_result', {
      sessionId,
      toolName,
      durationMs,
      hasError,
      timestamp: new Date().toISOString(),
    });
  }

  emitThinking(sessionId: string, isThinking: boolean) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:thinking', {
      sessionId,
      isThinking,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewMessage(sessionId: string, message: { role: string; content: string }) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:message', {
      sessionId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  emitDiagnosisUpdate(sessionId: string, diagnosis: unknown) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:diagnosis', {
      sessionId,
      diagnosis,
      timestamp: new Date().toISOString(),
    });
  }

  emitComplete(sessionId: string, summary: { iterations: number; toolsUsed: string[] }) {
    this.server.to(this.sessionRoomName(sessionId)).emit('agent:complete', {
      sessionId,
      summary,
      timestamp: new Date().toISOString(),
    });
  }

  private sessionRoomName(sessionId: string): string {
    return `v2-session:${sessionId}`;
  }

  private ticketRoomName(ticketId: string): string {
    return `v2-ticket:${ticketId}`;
  }
}
