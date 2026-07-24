import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../core/authz/current-user.decorator';
import { RequirePermissions } from '../../core/authz/permissions.decorator';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import type { RequestUser } from '../../core/authz/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthorizedPickupsService } from './authorized-pickups.service';
import {
  AuthorizedPickupListQueryDto,
  CreateAuthorizedPickupDto,
  LinkAuthorizedPickupStudentDto,
  UpdateAuthorizedPickupDto,
} from './dto/authorized-pickup.dto';

@ApiTags('authorized-pickups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('authorized-pickups')
export class AuthorizedPickupsController {
  constructor(private readonly service: AuthorizedPickupsService) {}

  @Get()
  @RequirePermissions('authorized_pickups.view')
  list(@CurrentUser() user: RequestUser, @Query() query: AuthorizedPickupListQueryDto) {
    return this.service.list(user, query);
  }

  @Post()
  @RequirePermissions('authorized_pickups.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAuthorizedPickupDto,
    @Req() request: Request,
  ) {
    return this.service.create(user, dto, request.ip);
  }

  @Patch(':pickupId')
  @RequirePermissions('authorized_pickups.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('pickupId') pickupId: string,
    @Body() dto: UpdateAuthorizedPickupDto,
    @Req() request: Request,
  ) {
    return this.service.update(user, pickupId, dto, request.ip);
  }

  @Post(':pickupId/students')
  @RequirePermissions('authorized_pickups.manage')
  linkStudent(
    @CurrentUser() user: RequestUser,
    @Param('pickupId') pickupId: string,
    @Body() dto: LinkAuthorizedPickupStudentDto,
    @Req() request: Request,
  ) {
    return this.service.linkStudent(user, pickupId, dto, request.ip);
  }

  @Post(':pickupId/students/:studentId/end')
  @RequirePermissions('authorized_pickups.manage')
  unlinkStudent(
    @CurrentUser() user: RequestUser,
    @Param('pickupId') pickupId: string,
    @Param('studentId') studentId: string,
    @Req() request: Request,
  ) {
    return this.service.unlinkStudent(user, pickupId, studentId, request.ip);
  }

  @Post(':pickupId/photo')
  @RequirePermissions('authorized_pickups.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  @ApiConsumes('multipart/form-data')
  updatePhoto(
    @CurrentUser() user: RequestUser,
    @Param('pickupId') pickupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر صورة المصرح له أولًا');
    return this.service.updatePhoto(user, pickupId, file, request.ip);
  }

  @Get(':pickupId/photo')
  @RequirePermissions('authorized_pickups.view')
  async photo(
    @CurrentUser() user: RequestUser,
    @Param('pickupId') pickupId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.service.photo(user, pickupId);
    response.setHeader('Content-Type', image.mimeType);
    return new StreamableFile(image.buffer);
  }
}
