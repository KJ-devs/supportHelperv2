import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  AuthResponse,
  JwtPayload,
  UserEntity
} from './dto/auth.dto';

/**
 * Authentication Service
 *
 * Handles user authentication, registration, and token management
 * Supports both JWT (for dashboard users) and API Key (for SDK clients)
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user and create their tenant
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate unique tenant slug
    const slug = this.generateSlug(dto.tenantName);
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException('Tenant name already taken');
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug,
        plan: 'free',
      },
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
      include: {
        tenant: true,
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

  /**
   * Login with email and password
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
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

  /**
   * Refresh access token using refresh token
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Check token type
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Fetch user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
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
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate JWT payload and return user
   */
  async validateUser(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Validate API key and return application
   */
  async validateApiKey(apiKey: string) {
    const application = await this.prisma.application.findUnique({
      where: { sdkKey: apiKey },
      include: { tenant: true },
    });

    if (!application) {
      throw new UnauthorizedException('Invalid API key');
    }

    return application;
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(user: UserEntity): { accessToken: string; refreshToken: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as JwtPayload['role'],
    };

    // Access token - expires in 7 days
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d') },
    );

    // Refresh token - expires in 30 days
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: '30d' },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generate URL-friendly slug from tenant name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}
