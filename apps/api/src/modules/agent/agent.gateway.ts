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
import { Inject, Logger, UseGuards, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from './ws-jwt.guard';
import { AgentService } from './agent.service';
import { getWebSocketCorsConfig } from '../../config/websocket-cors.config';

interface WsUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

@WebSocketGateway({
  namespace: '/agent',
  cors: getWebSocketCorsConfig(),
})
@UseGuards(WsJwtGuard)
export class AgentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentGateway.name);

  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
  ) {}

  afterInit() {
    this.logger.log('Agent WebSocket gateway initialized');
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

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const user = client.data.user as WsUser;
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    try {
      // Verify the session belongs to the caller's tenant
      const session = await this.agentService.getSession(
        data.sessionId,
        user.tenantId,
      );

      // Join the Socket.IO room scoped to this session
      const room = this.roomName(data.sessionId);
      await client.join(room);

      this.logger.log(
        `User ${user.userId} joined session room ${data.sessionId}`,
      );

      return { event: 'joined-session', data: session };
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Failed to join session',
      );
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; content: string },
  ) {
    const user = client.data.user as WsUser;
    if (!data?.sessionId || !data?.content) {
      throw new WsException('sessionId and content are required');
    }

    try {
      // Emit typing indicator while the agent processes
      this.emitAgentTyping(data.sessionId, true);

      const agentMessage = await this.agentService.sendMessage(
        data.sessionId,
        user.tenantId,
        data.content,
        user.userId,
      );

      // Stop typing and broadcast the new message
      this.emitAgentTyping(data.sessionId, false);
      this.emitNewMessage(data.sessionId, agentMessage);

      return { event: 'message-sent', data: agentMessage };
    } catch (error) {
      this.emitAgentTyping(data.sessionId, false);
      throw new WsException(
        error instanceof Error ? error.message : 'Failed to send message',
      );
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; isTyping: boolean },
  ) {
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    const user = client.data.user as WsUser;
    const room = this.roomName(data.sessionId);

    // Broadcast to everyone in the room except the sender
    client.to(room).emit('user-typing', {
      sessionId: data.sessionId,
      userId: user.userId,
      isTyping: data.isTyping ?? true,
    });
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (!data?.sessionId) {
      throw new WsException('sessionId is required');
    }

    const room = this.roomName(data.sessionId);
    await client.leave(room);

    const user = client.data.user as WsUser;
    this.logger.log(
      `User ${user.userId} left session room ${data.sessionId}`,
    );

    return { event: 'left-session', data: { sessionId: data.sessionId } };
  }

  // ----------------------------------------------------------------
  // Server-side emit helpers (called by AgentService)
  // ----------------------------------------------------------------

  emitNewMessage(sessionId: string, message: any) {
    this.server
      .to(this.roomName(sessionId))
      .emit('new-message', { sessionId, message });
  }

  emitAgentTyping(sessionId: string, isTyping: boolean) {
    this.server
      .to(this.roomName(sessionId))
      .emit('agent-typing', { sessionId, isTyping });
  }

  emitSessionUpdate(sessionId: string, state: any) {
    this.server
      .to(this.roomName(sessionId))
      .emit('session-update', { sessionId, state });
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private roomName(sessionId: string): string {
    return `session:${sessionId}`;
  }
}
