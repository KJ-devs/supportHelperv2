import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

/**
 * Guard to validate SDK key from x-sdk-key header
 * Sets request.sdk with application and tenant information
 */
@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const sdkKey = request.headers['x-sdk-key'] as string;

    if (!sdkKey) {
      throw new UnauthorizedException('SDK key is required');
    }

    // Validate SDK key and get application
    const application = await this.prisma.application.findUnique({
      where: { sdkKey },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!application) {
      throw new UnauthorizedException('Invalid SDK key');
    }

    // Attach SDK payload to request
    request.sdk = {
      applicationId: application.id,
      tenantId: application.tenantId,
      sdkKey,
    };

    // Also set as user for tenant guard compatibility
    request.user = {
      userId: application.id,
      tenantId: application.tenantId,
      email: `sdk@${application.tenant.name}`,
      role: 'sdk',
    };

    return true;
  }
}
