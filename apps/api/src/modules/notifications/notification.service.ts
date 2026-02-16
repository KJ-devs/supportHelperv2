import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export interface DispatchNotificationParams {
  ticketId: string;
  tenantId: string;
  applicationId: string;
  eventType: string;
  data: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('send-notification') private readonly notificationQueue: Queue,
  ) {}

  /**
   * Dispatch notification for a ticket event.
   * Looks up notification_preferences for the tenant/app and enqueues jobs for each enabled channel.
   */
  async dispatchNotification(params: DispatchNotificationParams): Promise<void> {
    const { ticketId, tenantId, applicationId, eventType, data } = params;

    // 1. Find enabled notification preferences for this application + tenant
    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        applicationId,
        tenantId,
        enabled: true,
      },
    });

    // 2. Filter prefs where events array includes the eventType (or events is empty = all events)
    const matchingPrefs = prefs.filter(
      (p) => p.events.length === 0 || p.events.includes(eventType),
    );

    if (matchingPrefs.length === 0) {
      this.logger.debug(
        `No matching notification preferences for event ${eventType} on app ${applicationId}`,
      );
      return;
    }

    this.logger.log(
      `Dispatching ${matchingPrefs.length} notification(s) for event ${eventType} on ticket ${ticketId}`,
    );

    // 3. For each matching pref, enqueue a notification job and create a pending log entry
    for (const pref of matchingPrefs) {
      await this.notificationQueue.add(
        'send',
        {
          ticketId,
          tenantId,
          channel: pref.channel,
          eventType,
          data,
          config: pref.config,
          preferenceId: pref.id,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.notificationLog.create({
        data: {
          ticketId,
          tenantId,
          channel: pref.channel,
          eventType,
          status: 'pending',
          metadata: data,
        },
      });
    }
  }
}
