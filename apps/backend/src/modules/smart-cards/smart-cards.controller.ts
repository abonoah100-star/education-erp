import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../core/authz/current-user.decorator';
import { RequirePermissions } from '../../core/authz/permissions.decorator';
import { PermissionsGuard } from '../../core/authz/permissions.guard';
import type { RequestUser } from '../../core/authz/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CardSelection, CodeImageKind, ImageFormat } from './card-renderer.service';
import { CreateInventoryBatchDto } from './dto/batch.dto';
import {
  AssignInventoryCardDto,
  IssueSmartCardDto,
  SetSmartCardStatusDto,
  SmartCardListQueryDto,
} from './dto/card.dto';
import { CreatePrintJobDto } from './dto/print-job.dto';
import { CreateCardTemplateDto, SetCardTemplateStatusDto } from './dto/template.dto';
import { SmartCardsService } from './smart-cards.service';

@ApiTags('smart-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('smart-cards')
export class SmartCardsController {
  constructor(private readonly service: SmartCardsService) {}

  @Post('portrait-assets')
  @RequirePermissions('smart_cards.issue')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadPortrait(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('اختر صورة صالحة أولًا');
    return this.service.createPortraitAsset(user, file, request.ip);
  }

  @Get('portrait-assets/:assetId/image')
  @RequirePermissions('smart_cards.view')
  async portraitImage(
    @CurrentUser() user: RequestUser,
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ) {
    const image = await this.service.portraitAssetImage(user, assetId);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="portrait-${assetId}.jpg"`);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.send(image.buffer);
  }

  @Get('templates')
  @RequirePermissions('card_templates.view')
  templates(@CurrentUser() user: RequestUser) {
    return this.service.templates(user);
  }

  @Post('templates')
  @RequirePermissions('card_templates.manage')
  createTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCardTemplateDto,
    @Req() request: Request,
  ) {
    return this.service.createTemplate(user, dto, request.ip);
  }

  @Patch('templates/:templateId/status')
  @RequirePermissions('card_templates.manage')
  setTemplateStatus(
    @CurrentUser() user: RequestUser,
    @Param('templateId') templateId: string,
    @Body() dto: SetCardTemplateStatusDto,
    @Req() request: Request,
  ) {
    return this.service.setTemplateStatus(user, templateId, dto.isActive, request.ip);
  }

  @Get('inventory-batches')
  @RequirePermissions('card_inventory.view')
  inventoryBatches(@CurrentUser() user: RequestUser) {
    return this.service.inventoryBatches(user);
  }

  @Post('inventory-batches')
  @RequirePermissions('card_inventory.manage')
  createInventoryBatch(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInventoryBatchDto,
    @Req() request: Request,
  ) {
    return this.service.createInventoryBatch(user, dto, request.ip);
  }

  @Get('print-jobs')
  @RequirePermissions('card_print_jobs.view')
  printJobs(@CurrentUser() user: RequestUser) {
    return this.service.printJobs(user);
  }

  @Post('print-jobs')
  @RequirePermissions('card_print_jobs.create')
  createPrintJob(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePrintJobDto,
    @Req() request: Request,
  ) {
    return this.service.createPrintJob(user, dto, request.ip);
  }

  @Get('print-jobs/:printJobId/pages/:page/image.png')
  @RequirePermissions('card_print_jobs.download')
  async printPageImage(
    @CurrentUser() user: RequestUser,
    @Param('printJobId') printJobId: string,
    @Param('page', ParseIntPipe) page: number,
    @Query('download', new DefaultValuePipe('0')) download: string,
    @Res() response: Response,
  ) {
    const image = await this.service.renderPrintPage(user, printJobId, page);
    response.setHeader('Content-Type', 'image/png');
    response.setHeader(
      'Content-Disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${image.filename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(image.buffer);
  }

  @Post('print-jobs/:printJobId/mark-printed')
  @RequirePermissions('card_print_jobs.mark_printed')
  markPrintJobPrinted(
    @CurrentUser() user: RequestUser,
    @Param('printJobId') printJobId: string,
    @Req() request: Request,
  ) {
    return this.service.markPrintJobPrinted(user, printJobId, request.ip);
  }

  @Get()
  @RequirePermissions('smart_cards.view')
  cards(@CurrentUser() user: RequestUser, @Query() query: SmartCardListQueryDto) {
    return this.service.cards(user, query);
  }

  @Post()
  @RequirePermissions('smart_cards.issue')
  issueCard(
    @CurrentUser() user: RequestUser,
    @Body() dto: IssueSmartCardDto,
    @Req() request: Request,
  ) {
    return this.service.issueCard(user, dto, request.ip);
  }

  @Post(':cardId/assign')
  @RequirePermissions('smart_cards.assign_existing')
  assignInventoryCard(
    @CurrentUser() user: RequestUser,
    @Param('cardId') cardId: string,
    @Body() dto: AssignInventoryCardDto,
    @Req() request: Request,
  ) {
    return this.service.assignInventoryCard(user, cardId, dto, request.ip);
  }

  @Patch(':cardId/status')
  @RequirePermissions('smart_cards.manage_status')
  setCardStatus(
    @CurrentUser() user: RequestUser,
    @Param('cardId') cardId: string,
    @Body() dto: SetSmartCardStatusDto,
    @Req() request: Request,
  ) {
    return this.service.setCardStatus(user, cardId, dto.status, request.ip);
  }

  @Post(':cardId/replace')
  @RequirePermissions('smart_cards.replace')
  replaceCard(
    @CurrentUser() user: RequestUser,
    @Param('cardId') cardId: string,
    @Req() request: Request,
  ) {
    return this.service.replaceCard(user, cardId, request.ip);
  }

  @Get(':cardId/image')
  @RequirePermissions('smart_cards.download_image')
  async cardImage(
    @CurrentUser() user: RequestUser,
    @Param('cardId') cardId: string,
    @Query('side', new DefaultValuePipe('front')) sideValue: string,
    @Query('format', new DefaultValuePipe('png')) formatValue: string,
    @Query('download', new DefaultValuePipe('0')) download: string,
    @Res() response: Response,
  ) {
    const selection: CardSelection = sideValue === 'back' ? 'back' : sideValue === 'both' ? 'both' : 'front';
    const format: ImageFormat = formatValue === 'svg' ? 'svg' : 'png';
    const image = await this.service.cardImage(user, cardId, selection, format);
    response.setHeader('Content-Type', format === 'svg' ? 'image/svg+xml' : 'image/png');
    response.setHeader(
      'Content-Disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${image.filename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(image.buffer);
  }

  @Get(':cardId/code-image')
  @RequirePermissions('smart_cards.download_image')
  async codeImage(
    @CurrentUser() user: RequestUser,
    @Param('cardId') cardId: string,
    @Query('kind', new DefaultValuePipe('qr')) kindValue: string,
    @Query('format', new DefaultValuePipe('png')) formatValue: string,
    @Query('download', new DefaultValuePipe('0')) download: string,
    @Res() response: Response,
  ) {
    const kind: CodeImageKind = kindValue === 'barcode' ? 'barcode' : 'qr';
    const format: ImageFormat = formatValue === 'svg' ? 'svg' : 'png';
    const image = await this.service.codeImage(user, cardId, kind, format);
    response.setHeader('Content-Type', format === 'svg' ? 'image/svg+xml' : 'image/png');
    response.setHeader(
      'Content-Disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${image.filename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(image.buffer);
  }
}
