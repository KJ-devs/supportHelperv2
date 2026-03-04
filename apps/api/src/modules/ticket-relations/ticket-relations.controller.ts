import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TicketRelationsService } from './ticket-relations.service';
import { CreateTicketRelationDto } from './dto/create-ticket-relation.dto';

@Controller('api/tickets/:ticketId/relations')
@UseGuards(JwtAuthGuard)
export class TicketRelationsController {
  constructor(private readonly relationsService: TicketRelationsService) {}

  @Get()
  async getRelations(
    @Param('ticketId') ticketId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.relationsService.getRelations(ticketId, req.user.tenantId);
  }

  @Post()
  async createRelation(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateTicketRelationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.relationsService.createManual(
      ticketId,
      dto.targetTicketId,
      dto.relationType,
      req.user.tenantId,
      dto.confidence,
    );
  }

  @Delete(':relationId')
  async removeRelation(
    @Param('relationId') relationId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    await this.relationsService.remove(relationId, req.user.tenantId);
    return { success: true };
  }
}
