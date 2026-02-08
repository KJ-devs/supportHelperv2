import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users in tenant' })
  async findAll(@Request() req: { user: { tenantId: string } }) {
    return this.usersService.findByTenant(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; role?: string },
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.usersService.update(id, req.user.tenantId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.usersService.delete(id, req.user.tenantId);
  }
}
