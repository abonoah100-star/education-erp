import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../core/authz/current-user.decorator';
import { RequirePermissions } from '../../core/authz/permissions.decorator';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import type { RequestUser } from '../../core/authz/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBranchDto, SetBranchStatusDto, UpdateBranchDto } from './dto/branch.dto';
import { CreateCashboxDto, SetCashboxStatusDto } from './dto/cashbox.dto';
import { UpdateOrganizationSettingsDto } from './dto/organization-settings.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Get('settings')
  @RequirePermissions('settings.view')
  settings(@CurrentUser() user: RequestUser) {
    return this.service.organizationSettings(user);
  }

  @Patch('settings')
  @RequirePermissions('settings.manage')
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganizationSettingsDto,
    @Req() request: Request,
  ) {
    return this.service.updateOrganizationSettings(user, dto, request.ip);
  }

  @Post('settings/logo')
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4_000_000 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  updateLogo(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر ملف لوجو صالحًا أولًا');
    return this.service.updateOrganizationLogo(user, file, request.ip);
  }

  @Delete('settings/logo')
  @RequirePermissions('settings.manage')
  deleteLogo(@CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.service.deleteOrganizationLogo(user, request.ip);
  }

  @Get('overview')
  @RequirePermissions('dashboard.view')
  overview(@CurrentUser() user: RequestUser) {
    return this.service.overview(user);
  }

  @Get('branches')
  @RequirePermissions('branches.view')
  branches(@CurrentUser() user: RequestUser) {
    return this.service.branches(user);
  }

  @Post('branches')
  @RequirePermissions('branches.manage')
  createBranch(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBranchDto,
    @Req() request: Request,
  ) {
    return this.service.createBranch(user, dto, request.ip);
  }

  @Patch('branches/:branchId')
  @RequirePermissions('branches.manage')
  updateBranch(
    @CurrentUser() user: RequestUser,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
    @Req() request: Request,
  ) {
    return this.service.updateBranch(user, branchId, dto, request.ip);
  }

  @Patch('branches/:branchId/status')
  @RequirePermissions('branches.manage')
  setBranchStatus(
    @CurrentUser() user: RequestUser,
    @Param('branchId') branchId: string,
    @Body() dto: SetBranchStatusDto,
    @Req() request: Request,
  ) {
    return this.service.setBranchStatus(user, branchId, dto.isActive, request.ip);
  }

  @Post('branches/:branchId/cashboxes')
  @RequirePermissions('cashboxes.manage')
  createCashbox(
    @CurrentUser() user: RequestUser,
    @Param('branchId') branchId: string,
    @Body() dto: CreateCashboxDto,
    @Req() request: Request,
  ) {
    return this.service.createCashbox(user, branchId, dto, request.ip);
  }

  @Patch('cashboxes/:cashboxId/status')
  @RequirePermissions('cashboxes.manage')
  setCashboxStatus(
    @CurrentUser() user: RequestUser,
    @Param('cashboxId') cashboxId: string,
    @Body() dto: SetCashboxStatusDto,
    @Req() request: Request,
  ) {
    return this.service.setCashboxStatus(user, cashboxId, dto.status, request.ip);
  }

}
