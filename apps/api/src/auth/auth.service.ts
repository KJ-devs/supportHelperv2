import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  JwtPayload,
  RefreshTokenPayload,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiry: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly configService: ConfigService
  ) {
    const configuredSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!configuredSecret) {
      const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
      if (nodeEnv === 'production') {
        throw new Error(
          'FATAL: JWT_REFRESH_SECRET must be set in production. ' +
          'Generate one with: openssl rand -hex 32',
        );
      }
      this.logger.warn(
        'JWT_REFRESH_SECRET is not set. Using a random secret — refresh tokens will not survive restarts.',
      );
      this.refreshTokenSecret = crypto.randomBytes(32).toString('hex');
    } else {
      this.refreshTokenSecret = configuredSecret;
    }
    this.refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
  }

  private generateTokens(user: { id: string; email: string; tenantId: string; role: string }): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as JwtPayload['role'],
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiry,
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create tenant
    const tenant = await this.tenantsService.create({
      name: dto.tenantName,
    });

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user as owner
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'owner',
        authProvider: 'email',
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name ?? undefined,
        role: user.role as JwtPayload['role'],
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: { include: { ssoConfig: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if password login is disabled for this tenant
    if (user.tenant.ssoConfig?.enabled && user.tenant.ssoConfig?.disablePassword) {
      throw new UnauthorizedException(
        'Password login is disabled. Please use SSO login at: ' +
        `/auth/sso/${user.tenant.ssoConfig.providerType}/login?tenant=${user.tenant.slug}`
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name ?? undefined,
        role: user.role as JwtPayload['role'],
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshTokenSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      return {
        user: {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role as JwtPayload['role'],
          createdAt: user.createdAt,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async validateSdkKey(sdkKey: string) {
    const application = await this.prisma.application.findUnique({
      where: { sdkKey },
      include: { tenant: true },
    });

    if (!application) {
      throw new UnauthorizedException('Invalid SDK key');
    }

    return application;
  }
}
