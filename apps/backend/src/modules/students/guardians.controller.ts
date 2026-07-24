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
import {
  CreateGuardianDto,
  EndStudentGuardianLinkDto,
  GuardianListQueryDto,
  LinkGuardianToStudentDto,
  UpdateGuardianDto,
  UpdateStudentGuardianLinkDto,
} from './dto/guardian.dto';
import { GuardiansService } from './guardians.service';

@ApiTags('guardians')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {}

  @Get()
  @RequirePermissions('guardians.view')
  list(@CurrentUser() user: RequestUser, @Query() query: GuardianListQueryDto) {
    return this.service.list(user, query);
  }

  @Post()
  @RequirePermissions('guardians.create')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateGuardianDto,
    @Req() request: Request,
  ) {
    return this.service.create(user, dto, request.ip);
  }

  @Get(':guardianId')
  @RequirePermissions('guardians.view')
  details(@CurrentUser() user: RequestUser, @Param('guardianId') guardianId: string) {
    return this.service.details(user, guardianId);
  }

  @Patch(':guardianId')
  @RequirePermissions('guardians.update')
  update(
    @CurrentUser() user: RequestUser,
    @Param('guardianId') guardianId: string,
    @Body() dto: UpdateGuardianDto,
    @Req() request: Request,
  ) {
    return this.service.update(user, guardianId, dto, request.ip);
  }

  @Post(':guardianId/photo')
  @RequirePermissions('guardians.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  @ApiConsumes('multipart/form-data')
  updatePhoto(
    @CurrentUser() user: RequestUser,
    @Param('guardianId') guardianId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر صورة ولي الأمر أولًا');
    return this.service.updatePhoto(user, guardianId, file, request.ip);
  }

  @Get(':guardianId/photo')
  @RequirePermissions('guardians.view')
  async photo(
    @CurrentUser() user: RequestUser,
    @Param('guardianId') guardianId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.service.photo(user, guardianId);
    response.setHeader('Content-Type', image.mimeType);
    return new StreamableFile(image.buffer);
  }

  @Post('link/student/:studentId')
  @RequirePermissions('guardians.link_students')
  linkStudent(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: LinkGuardianToStudentDto,
    @Req() request: Request,
  ) {
    return this.service.linkStudent(user, studentId, dto, request.ip);
  }

  @Patch(':guardianId/students/:studentId')
  @RequirePermissions('guardians.link_students')
  updateStudentLink(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: UpdateStudentGuardianLinkDto,
    @Req() request: Request,
  ) {
    return this.service.updateStudentLink(user, studentId, guardianId, dto, request.ip);
  }

  @Post(':guardianId/students/:studentId/end')
  @RequirePermissions('guardians.link_students')
  endStudentLink(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: EndStudentGuardianLinkDto,
    @Req() request: Request,
  ) {
    return this.service.endStudentLink(user, studentId, guardianId, dto, request.ip);
  }
}
