import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SdkKeyStrategy } from './strategies/sdk-key.strategy';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { JwtAuthGuard, SdkKeyGuard, RolesGuard, TenantGuard } from '../common/guards';
import { TenantContextMiddleware } from './middleware';

@Module({
  imports: [
    UsersModule,
    TenantsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SdkKeyStrategy,
    JwtAuthGuard,
    SdkKeyGuard,
    RolesGuard,
    TenantGuard,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, SdkKeyGuard, RolesGuard, TenantGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
