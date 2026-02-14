import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiConsumes } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { TicketsSearchService } from './tickets-search.service';
import { TicketsAIService } from './tickets-ai.service';
import { TicketsGateway } from './tickets.gateway';
import { AIService } from '../../ai/ai.service';
import { CreateTicketDto, createTicketSchema } from './dto';
import { SdkAuth } from '../../common/decorators/sdk-auth.decorator';
import { SdkKeyGuard } from '../../common/guards/sdk-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { IntegrationsSyncService } from '../integrations/integrations-sync.service';

// Map AI-returned types to valid ticket schema types
const AI_TYPE_MAP: Record<string, string> = {
  bug: 'bug',
  crash: 'bug',
  ui: 'bug',
  'data-loss': 'bug',
  performance: 'performance',
  security: 'security',
  feature_request: 'feature_request',
  'feature-request': 'feature_request',
  question: 'question',
  documentation: 'documentation',
  other: 'bug',
};

function mapAiType(aiType: string): string {
  return AI_TYPE_MAP[aiType] || 'bug';
}

@ApiTags('SDK - Tickets')
@ApiSecurity('sdk-key')
@Controller('sdk/tickets')
export class SdkTicketsController {
  private readonly logger = new Logger(SdkTicketsController.name);
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketsSearchService: TicketsSearchService,
    private readonly ticketsAIService: TicketsAIService,
    private readonly ticketsGateway: TicketsGateway,
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly integrationsSyncService: IntegrationsSyncService,
  ) {
    // Initialize S3 client
    const endpoint = this.configService.get('s3.endpoint') || this.configService.get('S3_ENDPOINT');
    const accessKeyId = this.configService.get('s3.accessKeyId') || this.configService.get('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get('s3.secretAccessKey') || this.configService.get('S3_SECRET_KEY');
    this.s3Bucket = this.configService.get('s3.bucket') || this.configService.get('S3_BUCKET') || 'videos';
    const region = this.configService.get('s3.region') || this.configService.get('S3_REGION') || 'us-east-1';

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  @Post()
  @SdkAuth()
  @UseGuards(SdkKeyGuard)
  @ApiOperation({ summary: 'Create a ticket from SDK (client application)' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 401, description: 'Invalid SDK key' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createTicketSchema))
    createTicketDto: CreateTicketDto
  ) {
    // Note: Reporter ID is not set for SDK tickets (anonymous)
    const ticket = await this.ticketsService.create(tenantId, createTicketDto, undefined);

    // Index in Meilisearch
    if (this.ticketsSearchService.isEnabled()) {
      await this.ticketsSearchService.indexTicket(ticket);
    }

    // Enqueue AI analysis with high priority for SDK tickets
    await this.ticketsAIService.enqueueAnalysis(ticket.id, 3);

    // Trigger integration syncs
    await this.integrationsSyncService.syncTicketToAllEnabledIntegrations(ticket.id, tenantId, { priority: 2 });

    // Emit real-time event
    this.ticketsGateway.emitTicketCreated(tenantId, ticket);

    return {
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    };
  }

  @Post('report')
  @SdkAuth()
  @UseGuards(SdkKeyGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit a full bug report with video, description, and AI processing',
  })
  @ApiResponse({ status: 201, description: 'Bug report created and analyzed' })
  @ApiResponse({ status: 401, description: 'Invalid SDK key' })
  async report(
    @Req() req: RequestWithUser,
    @CurrentTenant() tenantId: string,
    @UploadedFile() video: Express.Multer.File | undefined,
    @Body()
    body: {
      title?: string;
      description?: string;
      userContext?: string;
    }
  ) {
    const applicationId = req.sdk?.applicationId;
    if (!applicationId) {
      throw new InternalServerErrorException('Application ID not found from SDK key');
    }

    // Parse userContext (sent as JSON string from FormData)
    let userContext: Record<string, any> | undefined;
    if (body.userContext) {
      try {
        userContext =
          typeof body.userContext === 'string' ? JSON.parse(body.userContext) : body.userContext;
      } catch {
        userContext = { raw: body.userContext };
      }
    }

    const description = body.description || '';
    const title = body.title || 'Bug Report from SDK';

    // Process description with AI (inline, not queued)
    this.logger.log(`Processing bug report with AI for tenant ${tenantId}`);
    const aiResult = await this.aiService.processUserDescription(description, userContext);

    // Create ticket with AI-enriched data
    const ticketDto: CreateTicketDto = {
      title,
      description: aiResult.enrichedDescription,
      applicationId,
      userContext,
      reproductionSteps: aiResult.reproductionSteps,
    };

    const ticket = await this.ticketsService.create(tenantId, ticketDto, undefined);

    // Emit real-time event for ticket creation
    this.ticketsGateway.emitTicketCreated(tenantId, ticket);

    // Update ticket with AI analysis fields
    const mappedType = mapAiType(aiResult.type);
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    const mappedSeverity = validSeverities.includes(aiResult.severity) ? aiResult.severity : 'medium';

    await this.ticketsService.update(ticket.id, tenantId, {
      aiSummary: aiResult.summary,
      aiAnalysis: {
        severity: aiResult.severity,
        severityConfidence: aiResult.severityConfidence,
        type: aiResult.type,
        typeConfidence: aiResult.typeConfidence,
        keywords: aiResult.keywords,
        reproductionSteps: aiResult.reproductionSteps,
        processedAt: new Date().toISOString(),
        hasVideo: !!video,
        videoSize: video?.size,
      },
      type: mappedType as any,
      severity: mappedSeverity as any,
    });

    // Update keywords
    if (aiResult.keywords?.length > 0) {
      await this.ticketsAIService.updateKeywords(ticket.id, aiResult.keywords);
    }

    // Index in Meilisearch
    if (this.ticketsSearchService.isEnabled()) {
      const updatedTicket = await this.ticketsService.findOne(ticket.id, tenantId);
      await this.ticketsSearchService.indexTicket(updatedTicket);
    }

    // Emit AI analysis completed event
    const analyzedTicket = await this.ticketsService.findOne(ticket.id, tenantId);
    this.ticketsGateway.emitAiAnalysisCompleted(tenantId, analyzedTicket);

    // If video was uploaded, save to S3 and create Media record
    let mediaRecord = null;
    if (video) {
      this.logger.log(
        `Video received: ${video.originalname} (${(video.size / 1024 / 1024).toFixed(2)}MB)`
      );

      try {
        // Generate storage key: tenantId/ticketId/filename
        const fileExt = video.originalname.split('.').pop() || 'webm';
        const storageKey = `${tenantId}/${ticket.id}/video-${Date.now()}.${fileExt}`;

        // Upload to S3/MinIO
        const uploadCommand = new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: storageKey,
          Body: video.buffer,
          ContentType: video.mimetype,
          Metadata: {
            ticketId: ticket.id,
            tenantId: tenantId,
            originalFilename: video.originalname,
          },
        });

        await this.s3Client.send(uploadCommand);
        this.logger.log(`Video uploaded to S3: ${storageKey}`);

        // Create Media record in database
        mediaRecord = await this.prisma.media.create({
          data: {
            ticketId: ticket.id,
            type: 'video',
            storageKey,
            fileSize: BigInt(video.size),
            mimeType: video.mimetype,
            processingStatus: 'completed', // Mark as completed since upload succeeded
            metadata: {
              originalFilename: video.originalname,
              uploadedAt: new Date().toISOString(),
              source: 'sdk',
            },
          },
        });

        this.logger.log(`Media record created: ${mediaRecord.id}`);

        // Enqueue for deeper video analysis
        await this.ticketsAIService.enqueueAnalysis(ticket.id, 2);

        // Trigger integration syncs
        await this.integrationsSyncService.syncTicketToAllEnabledIntegrations(ticket.id, tenantId, { priority: 2 });
      } catch (error) {
        this.logger.error(`Failed to save video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Don't fail the entire request if video upload fails
      }
    }

    return {
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      aiAnalysis: {
        summary: aiResult.summary,
        enrichedDescription: aiResult.enrichedDescription,
        severity: aiResult.severity,
        severityConfidence: aiResult.severityConfidence,
        type: aiResult.type,
        typeConfidence: aiResult.typeConfidence,
        keywords: aiResult.keywords,
        reproductionSteps: aiResult.reproductionSteps,
      },
      video: video && mediaRecord
        ? {
            received: true,
            filename: video.originalname,
            size: video.size,
            mimeType: video.mimetype,
            mediaId: mediaRecord.id,
            storageKey: mediaRecord.storageKey,
          }
        : { received: false },
    };
  }
}
