import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../../auth/dto/auth.dto';

/**
 * WebSocket guard that validates JWT from the Socket.IO handshake.
 *
 * Clients must provide the token either as:
 *   - `auth.token` in the handshake options (preferred)
 *   - `token` query parameter
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn('WebSocket connection rejected: no token provided');
      throw new WsException('Authentication token is required');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Attach user data to the socket for downstream handlers
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        role: payload.role,
      };

      return true;
    } catch {
      this.logger.warn('WebSocket connection rejected: invalid token');
      throw new WsException('Invalid or expired token');
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Prefer auth.token from handshake options
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }

    // Fallback to query parameter
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return undefined;
  }
}
