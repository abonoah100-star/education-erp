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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../core/authz/current-user.decorator';
import { RequirePermissions } from '../../core/authz/permissions.decorator';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import type { RequestUser } from '../../core/authz/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SmartCardsService } from '../smart-cards/smart-cards.service';
import { CreateStudentNoteDto, UploadStudentDocumentDto } from './dto/student-content.dto';
import { AssignStudentInventoryCardDto, IssueStudentCardDto } from './dto/student-card.dto';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  DuplicateStudentQueryDto,
  StudentListQueryDto,
  TransferStudentBranchDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { StudentContentService } from './student-content.service';
import { StudentsCommandService } from './students-command.service';
import { StudentsQueryService } from './students-query.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly queries: StudentsQueryService,
    private readonly commands: StudentsCommandService,
    private readonly content: StudentContentService,
    private readonly smartCards: SmartCardsService,
  ) {}

  @Get()
  @RequirePermissions('students.view')
  list(@CurrentUser() user: RequestUser, @Query() query: StudentListQueryDto) {
    return this.queries.list(user, query);
  }

  @Get('duplicates')
  @RequirePermissions('students.create')
  duplicateCandidates(
    @CurrentUser() user: RequestUser,
    @Query() query: DuplicateStudentQueryDto,
  ) {
    return this.queries.duplicateCandidates(user, query);
  }

  @Post()
  @RequirePermissions('students.create')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateStudentDto,
    @Req() request: Request,
  ) {
    return this.commands.create(user, dto, request.ip);
  }

  @Get(':studentId')
  @RequirePermissions('students.view')
  details(@CurrentUser() user: RequestUser, @Param('studentId') studentId: string) {
    return this.queries.details(user, studentId);
  }

  @Patch(':studentId')
  @RequirePermissions('students.update')
  update(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentDto,
    @Req() request: Request,
  ) {
    return this.commands.update(user, studentId, dto, request.ip);
  }

  @Patch(':studentId/status')
  @RequirePermissions('students.change_status')
  changeStatus(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: ChangeStudentStatusDto,
    @Req() request: Request,
  ) {
    return this.commands.changeStatus(user, studentId, dto, request.ip);
  }

  @Patch(':studentId/branch')
  @RequirePermissions('students.change_branch')
  transferBranch(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: TransferStudentBranchDto,
    @Req() request: Request,
  ) {
    return this.commands.transferBranch(user, studentId, dto, request.ip);
  }

  @Post(':studentId/photo')
  @RequirePermissions('students.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async updatePhoto(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر صورة الطالب أولًا');
    const asset = await this.content.updatePhoto(user, studentId, file, request.ip);
    await this.smartCards.syncStudentPortrait(user, studentId, request.ip);
    return asset;
  }

  @Get(':studentId/photo')
  @RequirePermissions('students.view')
  async photo(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.content.photo(user, studentId);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(image.buffer);
  }

  @Get(':studentId/documents')
  @RequirePermissions('students.view')
  documents(@CurrentUser() user: RequestUser, @Param('studentId') studentId: string) {
    return this.content.documents(user, studentId);
  }

  @Post(':studentId/documents')
  @RequirePermissions('students.manage_documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12_000_000 } }))
  @ApiConsumes('multipart/form-data')
  uploadDocument(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: UploadStudentDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر ملف المستند أولًا');
    return this.content.uploadDocument(user, studentId, dto, file, request.ip);
  }

  @Get(':studentId/documents/:documentId/content')
  @RequirePermissions('students.view')
  async documentContent(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.content.documentContent(user, studentId, documentId);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    return new StreamableFile(document.buffer);
  }


  @Post(':studentId/cards/issue')
  @RequirePermissions('smart_cards.issue')
  issueCard(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: IssueStudentCardDto,
    @Req() request: Request,
  ) {
    return this.smartCards.issueForStudent(user, studentId, dto, request.ip);
  }

  @Post(':studentId/cards/assign-existing')
  @RequirePermissions('smart_cards.assign_existing')
  assignInventoryCard(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: AssignStudentInventoryCardDto,
    @Req() request: Request,
  ) {
    return this.smartCards.assignInventoryForStudent(user, studentId, dto, request.ip);
  }

  @Get(':studentId/notes')
  @RequirePermissions('students.view')
  notes(@CurrentUser() user: RequestUser, @Param('studentId') studentId: string) {
    return this.content.notes(user, studentId);
  }

  @Post(':studentId/notes')
  @RequirePermissions('students.manage_notes')
  createNote(
    @CurrentUser() user: RequestUser,
    @Param('studentId') studentId: string,
    @Body() dto: CreateStudentNoteDto,
    @Req() request: Request,
  ) {
    return this.content.createNote(user, studentId, dto, request.ip);
  }
}
