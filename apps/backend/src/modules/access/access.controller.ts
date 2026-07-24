import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../core/authz/current-user.decorator';
import { RequirePermissions } from '../../core/authz/permissions.decorator';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import type { RequestUser } from '../../core/authz/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from './access.service';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import { SetUserStatusDto } from './dto/status.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('access')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('access')
export class AccessController {
  constructor(private readonly service: AccessService) {}

  @Get('users')
  @RequirePermissions('users.view')
  users(@CurrentUser() user: RequestUser) {
    return this.service.users(user);
  }

  @Post('users')
  @RequirePermissions('users.manage')
  createUser(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateUserDto,
    @Req() request: Request,
  ) {
    return this.service.createUser(user, dto, request.ip);
  }

  @Patch('users/:userId')
  @RequirePermissions('users.manage')
  updateUser(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @Req() request: Request,
  ) {
    return this.service.updateUser(user, userId, dto, request.ip);
  }

  @Patch('users/:userId/status')
  @RequirePermissions('users.manage')
  setUserStatus(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Body() dto: SetUserStatusDto,
    @Req() request: Request,
  ) {
    return this.service.setUserStatus(user, userId, dto.status, request.ip);
  }

  @Get('roles')
  @RequirePermissions('roles.view')
  roles(@CurrentUser() user: RequestUser) {
    return this.service.roles(user);
  }

  @Get('permissions')
  @RequirePermissions('roles.view')
  permissions() {
    return this.service.permissions();
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  createRole(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRoleDto,
    @Req() request: Request,
  ) {
    return this.service.createRole(user, dto, request.ip);
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermissions('roles.manage')
  updateRolePermissions(
    @CurrentUser() user: RequestUser,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Req() request: Request,
  ) {
    return this.service.updateRolePermissions(user, roleId, dto, request.ip);
  }

  @Get('audit-logs')
  @RequirePermissions('audit.view')
  auditLogs(@CurrentUser() user: RequestUser) {
    return this.service.auditLogs(user);
  }
}
