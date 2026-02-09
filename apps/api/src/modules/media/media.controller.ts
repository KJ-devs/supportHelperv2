import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  UsePipes,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { RequestUploadUrlDto, CompleteUploadDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  requestUploadUrlSchema,
  completeUploadSchema,
} from './schemas/media.schema';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-url')
  @ApiOperation({
    summary: 'Request presigned URL for file upload',
    description:
      'Generate a presigned S3 URL for direct upload. File is validated against tenant plan limits.',
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully',
    schema: {
      properties: {
        mediaId: { type: 'string', format: 'uuid' },
        uploadUrl: { type: 'string', format: 'uri' },
        storageKey: { type: 'string' },
        expiresIn: { type: 'number' },
        maxSize: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request or file too large' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async requestUploadUrl(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(requestUploadUrlSchema))
    dto: RequestUploadUrlDto,
  ) {
    return this.mediaService.requestUploadUrl(tenantId, dto);
  }

  @Post('complete')
  @ApiOperation({
    summary: 'Complete upload and trigger AI analysis',
    description:
      'Callback after successful S3 upload. Verifies file existence and enqueues AI analysis job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed, AI analysis enqueued',
  })
  @ApiResponse({ status: 400, description: 'Invalid request or file not found' })
  @ApiResponse({ status: 404, description: 'Media record not found' })
  async completeUpload(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(completeUploadSchema)) dto: CompleteUploadDto,
  ) {
    return this.mediaService.completeUpload(tenantId, dto);
  }

  @Get('ticket/:ticketId')
  @ApiOperation({ summary: 'Get all media for a ticket' })
  @ApiResponse({ status: 200, description: 'Media list retrieved' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findByTicket(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.mediaService.findByTicket(ticketId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media by ID with download URL' })
  @ApiResponse({ status: 200, description: 'Media retrieved' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.mediaService.findOne(id, tenantId);
  }

  @Get('download/*')
  @ApiOperation({ summary: 'Stream or redirect to media file by storage key' })
  @ApiResponse({ status: 302, description: 'Redirect to presigned URL' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async download(
    @Param('0') storageKey: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    const downloadUrl = await this.mediaService.getDownloadUrlByStorageKey(storageKey, tenantId);
    return res.redirect(downloadUrl);
  }

  @Get(':mediaId/events')
  @ApiOperation({ summary: 'Get video events for a media item' })
  @ApiResponse({ status: 200, description: 'Video events retrieved' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async getVideoEvents(
    @CurrentTenant() tenantId: string,
    @Param('mediaId') mediaId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.mediaService.getVideoEvents(mediaId, tenantId, {
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete media file and record' })
  @ApiResponse({ status: 200, description: 'Media deleted' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.mediaService.remove(id, tenantId);
  }
}
