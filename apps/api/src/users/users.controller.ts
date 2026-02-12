import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users in tenant' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: { user: { tenantId: string } }) {
    return this.usersService.findByTenant(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create/invite a new user in tenant (requires owner or admin role)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owners and admins can create users' })
  async create(
    @Body() dto: CreateUserDto,
    @Request() req: { user: { id: string; tenantId: string; role: string } }
  ) {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can create users');
    }
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (role changes require owner or admin role)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to change role or cannot change own role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { id: string; tenantId: string; role: string } }
  ) {
    // Only owners and admins can change roles
    if (dto.role !== undefined) {
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        throw new ForbiddenException('Only owners and admins can change user roles');
      }
      // Prevent users from changing their own role
      if (req.user.id === id) {
        throw new ForbiddenException('Cannot change your own role');
      }
    }
    return this.usersService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (requires owner or admin role)' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owners and admins can delete users, cannot delete yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { id: string; tenantId: string; role: string } }
  ) {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can delete users');
    }
    if (req.user.id === id) {
      throw new ForbiddenException('Cannot delete yourself');
    }
    return this.usersService.delete(id, req.user.tenantId);
  }
}
