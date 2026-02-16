import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../../auth/auth.module';
import { LicenseModule } from '../../license/license.module';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { SsoAuthController } from './sso-auth.controller';
import { SsoCryptoService } from './sso-crypto.service';
import { SamlStrategy } from './strategies/saml.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LicenseModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [SsoController, SsoAuthController],
  providers: [
    SsoService,
    SsoCryptoService,
    SamlStrategy,
    OidcStrategy,
  ],
  exports: [SsoService],
})
export class SsoModule {}
