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
  namespace: '/agent-tasks',
  cors: getWebSocketCorsConfig(),
  pingInterval: WS_PING_INTERVAL,
  pingTimeout: WS_PING_TIMEOUT,
})
@UseGuards(WsJwtGuard)
export class AgentTasksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentTasksGateway.name);

  afterInit() {
    this.logger.log('Agent Tasks WebSocket gateway initialized');
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

  // ── Client message handlers ──────────────────────────────

  @SubscribeMessage('tenant:join')
  async handleJoinTenant(@ConnectedSocket() client: Socket, @MessageBody() _data: unknown) {
    const user = client.data.user as WsUser;
    if (!user?.tenantId) {
      throw new WsException('Tenant ID not found in authentication token');
    }

    const room = this.tenantRoomName(user.tenantId);
    await client.join(room);

    this.logger.log(`User ${user.userId} joined tenant room ${user.tenantId}`);

    return { event: 'tenant:joined', data: { tenantId: user.tenantId } };
  }

  @SubscribeMessage('task:join')
  async handleJoinTask(@ConnectedSocket() client: Socket, @MessageBody() data: { taskId: string }) {
    if (!data?.taskId) {
      throw new WsException('taskId is required');
    }

    const room = this.taskRoomName(data.taskId);
    await client.join(room);

    const user = client.data.user as WsUser;
    this.logger.log(`User ${user.userId} joined task room ${data.taskId}`);

    return { event: 'task:joined', data: { taskId: data.taskId } };
  }

  @SubscribeMessage('task:leave')
  async handleLeaveTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string }
  ) {
    if (!data?.taskId) {
      throw new WsException('taskId is required');
    }

    const room = this.taskRoomName(data.taskId);
    await client.leave(room);

    const user = client.data.user as WsUser;
    this.logger.log(`User ${user.userId} left task room ${data.taskId}`);

    return { event: 'task:left', data: { taskId: data.taskId } };
  }

  // ── EventEmitter listeners → broadcast to task rooms ───

  @OnEvent('agent-task:status-changed')
  handleStatusChanged(event: {
    taskId: string;
    tenantId?: string;
    previousStatus: string;
    newStatus: string;
    metadata?: Record<string, unknown>;
  }) {
    const payload = {
      taskId: event.taskId,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      metadata: event.metadata,
      timestamp: new Date().toISOString(),
    };

    this.server.to(this.taskRoomName(event.taskId)).emit('task:status-changed', payload);

    // Also broadcast to tenant room so the list page updates in real time
    if (event.tenantId) {
      this.server.to(this.tenantRoomName(event.tenantId)).emit('task:status-changed', payload);
    }
  }

  @OnEvent('agent-task:plan-ready')
  handlePlanReady(event: { taskId: string; plan: unknown; iteration?: number }) {
    this.server.to(this.taskRoomName(event.taskId)).emit('task:plan-ready', {
      taskId: event.taskId,
      plan: event.plan,
      iteration: event.iteration ?? 1,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent-task:code-ready')
  handleCodeReady(event: { taskId: string; filesCount: number; complexity?: string }) {
    this.server.to(this.taskRoomName(event.taskId)).emit('task:code-ready', {
      taskId: event.taskId,
      filesCount: event.filesCount,
      complexity: event.complexity,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent-task:pr-created')
  handlePrCreated(event: { taskId: string; prNumber: number; prUrl: string; branchName: string }) {
    this.server.to(this.taskRoomName(event.taskId)).emit('task:pr-created', {
      taskId: event.taskId,
      prNumber: event.prNumber,
      prUrl: event.prUrl,
      branchName: event.branchName,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent-task:ci-status')
  handleCIStatus(event: {
    taskId: string;
    status: 'success' | 'failure' | 'pending';
    details?: string;
    checkRunId?: number;
  }) {
    this.server.to(this.taskRoomName(event.taskId)).emit('task:ci-status', {
      taskId: event.taskId,
      status: event.status,
      details: event.details,
      checkRunId: event.checkRunId,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('agent-task:error')
  handleError(event: { taskId: string; error: string }) {
    this.server.to(this.taskRoomName(event.taskId)).emit('task:error', {
      taskId: event.taskId,
      error: event.error,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Server-side emit helpers (for injection into services) ──

  emitStatusChanged(
    taskId: string,
    previousStatus: string,
    newStatus: string,
    metadata?: Record<string, unknown>
  ) {
    this.server.to(this.taskRoomName(taskId)).emit('task:status-changed', {
      taskId,
      previousStatus,
      newStatus,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  emitPlanReady(taskId: string, plan: unknown, iteration?: number) {
    this.server.to(this.taskRoomName(taskId)).emit('task:plan-ready', {
      taskId,
      plan,
      iteration: iteration ?? 1,
      timestamp: new Date().toISOString(),
    });
  }

  emitCodeReady(taskId: string, filesCount: number, complexity?: string) {
    this.server.to(this.taskRoomName(taskId)).emit('task:code-ready', {
      taskId,
      filesCount,
      complexity,
      timestamp: new Date().toISOString(),
    });
  }

  emitPrCreated(taskId: string, prNumber: number, prUrl: string, branchName: string) {
    this.server.to(this.taskRoomName(taskId)).emit('task:pr-created', {
      taskId,
      prNumber,
      prUrl,
      branchName,
      timestamp: new Date().toISOString(),
    });
  }

  emitCIStatus(taskId: string, status: 'success' | 'failure' | 'pending', details?: string) {
    this.server.to(this.taskRoomName(taskId)).emit('task:ci-status', {
      taskId,
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  emitError(taskId: string, error: string) {
    this.server.to(this.taskRoomName(taskId)).emit('task:error', {
      taskId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private taskRoomName(taskId: string): string {
    return `agent-task:${taskId}`;
  }

  private tenantRoomName(tenantId: string): string {
    return `agent-tenant:${tenantId}`;
  }
}
