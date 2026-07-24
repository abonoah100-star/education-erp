import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CardEventType,
  CardPrintLayout,
  CardPrintStatus,
  Prisma,
  SmartCardStatus,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateInventoryBatchDto } from './dto/batch.dto';
import type {
  AssignInventoryCardDto,
  IssueSmartCardDto,
  SmartCardListQueryDto,
} from './dto/card.dto';
import type { CreatePrintJobDto } from './dto/print-job.dto';
import type { CreateCardTemplateDto } from './dto/template.dto';
import {
  CardRendererService,
  type CardSide,
  type CodeImageKind,
  type ImageFormat,
  type RenderCardInput,
} from './card-renderer.service';
import { CardSigningService } from './card-signing.service';

const cardSafeSelect = {
  id: true,
  branchId: true,
  templateId: true,
  batchId: true,
  cardType: true,
  subjectId: true,
  ownerName: true,
  publicCode: true,
  codeFormat: true,
  barcodeType: true,
  status: true,
  replacesCardId: true,
  expiresAt: true,
  assignedAt: true,
  activatedAt: true,
  printedAt: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  template: {
    select: {
      id: true,
      name: true,
      code: true,
      backgroundColor: true,
      accentColor: true,
      textColor: true,
      mutedTextColor: true,
    },
  },
  batch: { select: { id: true, name: true, code: true } },
} satisfies Prisma.QrCardSelect;

type SafeCard = Prisma.QrCardGetPayload<{ select: typeof cardSafeSelect }>;

@Injectable()
export class SmartCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signer: CardSigningService,
    private readonly renderer: CardRendererService,
  ) {}

  async templates(user: RequestUser) {
    const items = await this.prisma.cardTemplate.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.isOwner
          ? {}
          : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
      select: {
        id: true,
        branchId: true,
        name: true,
        code: true,
        cardType: true,
        description: true,
        backgroundColor: true,
        accentColor: true,
        textColor: true,
        mutedTextColor: true,
        widthMm: true,
        heightMm: true,
        defaultCodeFormat: true,
        defaultBarcodeType: true,
        showPhoto: true,
        showBranch: true,
        showExpiry: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { cards: true } },
      },
      orderBy: [{ cardType: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      items: items.map(({ _count, widthMm, heightMm, ...template }) => ({
        ...template,
        widthMm: Number(widthMm),
        heightMm: Number(heightMm),
        cardsCount: _count.cards,
      })),
      total: items.length,
    };
  }

  async createTemplate(
    user: RequestUser,
    dto: CreateCardTemplateDto,
    ipAddress?: string,
  ) {
    if (dto.branchId) await this.assertBranchAccess(user, dto.branchId);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.cardTemplate.findUnique({
      where: { organizationId_code: { organizationId: user.organizationId, code } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('كود تصميم الكارت مستخدم بالفعل');

    const template = await this.prisma.cardTemplate.create({
      data: {
        organizationId: user.organizationId,
        branchId: dto.branchId,
        name: dto.name.trim(),
        code,
        cardType: dto.cardType,
        description: dto.description?.trim() || null,
        backgroundColor: dto.backgroundColor,
        accentColor: dto.accentColor,
        textColor: dto.textColor,
        mutedTextColor: dto.mutedTextColor,
        defaultCodeFormat: dto.defaultCodeFormat,
        showPhoto: dto.showPhoto,
        showBranch: dto.showBranch,
        showExpiry: dto.showExpiry,
        frontLayout: {
          renderer: 'educore-card-v1',
          cardSize: 'CR80',
          side: 'front',
        } satisfies Prisma.InputJsonObject,
        backLayout: {
          renderer: 'educore-card-v1',
          cardSize: 'CR80',
          side: 'back',
        } satisfies Prisma.InputJsonObject,
      },
      select: { id: true, name: true, code: true, cardType: true, isActive: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'card_template.create',
      entityType: 'CardTemplate',
      entityId: template.id,
      metadata: { code, cardType: dto.cardType },
      ipAddress,
    });
    return template;
  }

  async setTemplateStatus(
    user: RequestUser,
    templateId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    const template = await this.templateForUser(user, templateId, false);
    const updated = await this.prisma.cardTemplate.update({
      where: { id: template.id },
      data: { isActive },
      select: { id: true, name: true, code: true, cardType: true, isActive: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: isActive ? 'card_template.activate' : 'card_template.deactivate',
      entityType: 'CardTemplate',
      entityId: template.id,
      ipAddress,
    });
    return updated;
  }

  async cards(user: RequestUser, query: SmartCardListQueryDto) {
    if (query.branchId) await this.assertBranchAccess(user, query.branchId);
    const branchScope = user.isOwner
      ? query.branchId
        ? { branchId: query.branchId }
        : {}
      : { branchId: query.branchId ? query.branchId : { in: user.branchIds } };
    const search = query.search?.trim();
    const where: Prisma.QrCardWhereInput = {
      organizationId: user.organizationId,
      ...branchScope,
      ...(query.cardType ? { cardType: query.cardType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { publicCode: { contains: search, mode: 'insensitive' } },
              { ownerName: { contains: search, mode: 'insensitive' } },
              { subjectId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.qrCard.findMany({
        where,
        select: cardSafeSelect,
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      this.prisma.qrCard.count({ where }),
    ]);
    return { items, total };
  }

  async issueCard(user: RequestUser, dto: IssueSmartCardDto, ipAddress?: string) {
    await this.assertBranchAccess(user, dto.branchId);
    const template = await this.templateForUser(user, dto.templateId, true);
    if (template.cardType !== dto.cardType) {
      throw new BadRequestException('نوع التصميم لا يطابق نوع صاحب الكارت');
    }

    const publicCode = await this.nextPublicCode(dto.cardType);
    const now = new Date();
    const card = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.qrCard.create({
        data: {
          organizationId: user.organizationId,
          branchId: dto.branchId,
          templateId: template.id,
          cardType: dto.cardType,
          subjectId: dto.subjectId.trim(),
          ownerName: dto.ownerName.trim(),
          publicCode,
          secretHash: this.signer.fingerprint(publicCode),
          codeFormat: dto.codeFormat ?? template.defaultCodeFormat,
          barcodeType: template.defaultBarcodeType,
          status: 'ACTIVE',
          assignedAt: now,
          activatedAt: now,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        select: cardSafeSelect,
      });
      await transaction.cardEvent.createMany({
        data: [
          { cardId: created.id, actorId: user.id, eventType: 'CREATED' },
          { cardId: created.id, actorId: user.id, eventType: 'ASSIGNED' },
          { cardId: created.id, actorId: user.id, eventType: 'ACTIVATED' },
        ],
      });
      return created;
    });

    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.issue',
      entityType: 'QrCard',
      entityId: card.id,
      metadata: { publicCode, cardType: dto.cardType, subjectId: dto.subjectId },
      ipAddress,
    });
    return card;
  }

  async inventoryBatches(user: RequestUser) {
    const items = await this.prisma.cardBatch.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { branchId: { in: user.branchIds } }),
      },
      select: {
        id: true,
        branchId: true,
        templateId: true,
        name: true,
        code: true,
        cardType: true,
        status: true,
        prefix: true,
        startNumber: true,
        quantity: true,
        notes: true,
        createdAt: true,
        branch: { select: { id: true, name: true, code: true } },
        template: { select: { id: true, name: true, code: true } },
        _count: { select: { cards: true } },
        cards: { where: { status: 'IN_STOCK' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map(({ _count, cards, ...item }) => ({
        ...item,
        cardsCount: _count.cards,
        availableCount: cards.length,
      })),
      total: items.length,
    };
  }

  async createInventoryBatch(
    user: RequestUser,
    dto: CreateInventoryBatchDto,
    ipAddress?: string,
  ) {
    await this.assertBranchAccess(user, dto.branchId);
    const template = await this.templateForUser(user, dto.templateId, true);
    if (template.cardType !== dto.cardType) {
      throw new BadRequestException('نوع التصميم لا يطابق نوع دفعة الكروت');
    }
    const code = dto.code.toUpperCase();
    const prefix = dto.prefix.toUpperCase();
    const existingBatch = await this.prisma.cardBatch.findUnique({
      where: { organizationId_code: { organizationId: user.organizationId, code } },
      select: { id: true },
    });
    if (existingBatch) throw new ConflictException('كود دفعة الكروت مستخدم بالفعل');

    const cardRows = Array.from({ length: dto.quantity }, (_, index) => {
      const serial = String(dto.startNumber + index).padStart(5, '0');
      const publicCode = `${prefix}-${serial}`;
      return {
        id: randomUUID(),
        publicCode,
        secretHash: this.signer.fingerprint(publicCode),
      };
    });
    const collisions = await this.prisma.qrCard.count({
      where: { publicCode: { in: cardRows.map((row) => row.publicCode) } },
    });
    if (collisions > 0) throw new ConflictException('توجد أرقام كروت مستخدمة داخل هذا النطاق');

    const batch = await this.prisma.$transaction(async (transaction) => {
      const createdBatch = await transaction.cardBatch.create({
        data: {
          organizationId: user.organizationId,
          branchId: dto.branchId,
          templateId: template.id,
          name: dto.name.trim(),
          code,
          cardType: dto.cardType,
          status: 'GENERATED',
          prefix,
          startNumber: dto.startNumber,
          quantity: dto.quantity,
          notes: dto.notes?.trim() || null,
        },
        select: { id: true, name: true, code: true, quantity: true, status: true },
      });
      await transaction.qrCard.createMany({
        data: cardRows.map((row) => ({
          id: row.id,
          organizationId: user.organizationId,
          branchId: dto.branchId,
          templateId: template.id,
          batchId: createdBatch.id,
          cardType: dto.cardType,
          publicCode: row.publicCode,
          secretHash: row.secretHash,
          codeFormat: template.defaultCodeFormat,
          barcodeType: template.defaultBarcodeType,
          status: 'IN_STOCK',
        })),
      });
      await transaction.cardEvent.createMany({
        data: cardRows.map((row) => ({
          cardId: row.id,
          actorId: user.id,
          eventType: 'STOCKED' as CardEventType,
          metadata: { batchCode: code },
        })),
      });
      return createdBatch;
    });

    await this.audit.record({
      actorId: user.id,
      action: 'card_inventory.create_batch',
      entityType: 'CardBatch',
      entityId: batch.id,
      metadata: { code, quantity: dto.quantity, prefix },
      ipAddress,
    });
    return batch;
  }

  async assignInventoryCard(
    user: RequestUser,
    cardId: string,
    dto: AssignInventoryCardDto,
    ipAddress?: string,
  ) {
    await this.assertBranchAccess(user, dto.branchId);
    const template = await this.templateForUser(user, dto.templateId, true);
    if (template.cardType !== dto.cardType) {
      throw new BadRequestException('نوع التصميم لا يطابق نوع صاحب الكارت');
    }
    const existing = await this.cardForUser(user, cardId);
    if (existing.status !== 'IN_STOCK') {
      throw new ConflictException('يمكن ربط الكروت المتاحة في المخزون فقط');
    }

    const now = new Date();
    const card = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.qrCard.update({
        where: { id: existing.id },
        data: {
          branchId: dto.branchId,
          templateId: template.id,
          cardType: dto.cardType,
          subjectId: dto.subjectId.trim(),
          ownerName: dto.ownerName.trim(),
          status: 'ACTIVE',
          assignedAt: now,
          activatedAt: now,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        select: cardSafeSelect,
      });
      await transaction.cardEvent.createMany({
        data: [
          { cardId: existing.id, actorId: user.id, eventType: 'ASSIGNED' },
          { cardId: existing.id, actorId: user.id, eventType: 'ACTIVATED' },
        ],
      });
      if (existing.batchId) {
        const available = await transaction.qrCard.count({
          where: { batchId: existing.batchId, status: 'IN_STOCK' },
        });
        await transaction.cardBatch.update({
          where: { id: existing.batchId },
          data: { status: available === 0 ? 'COMPLETED' : 'PARTIALLY_ASSIGNED' },
        });
      }
      return updated;
    });

    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.assign_existing',
      entityType: 'QrCard',
      entityId: card.id,
      metadata: { subjectId: dto.subjectId, publicCode: card.publicCode },
      ipAddress,
    });
    return card;
  }

  async setCardStatus(
    user: RequestUser,
    cardId: string,
    status: SmartCardStatus,
    ipAddress?: string,
  ) {
    const allowed = ['ACTIVE', 'SUSPENDED', 'LOST', 'DAMAGED', 'REVOKED'] as const;
    if (!allowed.includes(status as (typeof allowed)[number])) throw new BadRequestException('حالة الكارت المطلوبة غير مسموحة يدويًا');
    const existing = await this.cardForUser(user, cardId);
    if (existing.status === 'IN_STOCK') throw new ConflictException('الكارت غير مرتبط بصاحب حتى الآن');

    const eventMap: Record<(typeof allowed)[number], CardEventType> = {
      ACTIVE: 'ACTIVATED',
      SUSPENDED: 'SUSPENDED',
      LOST: 'MARKED_LOST',
      DAMAGED: 'MARKED_DAMAGED',
      REVOKED: 'REVOKED',
    };
    const card = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.qrCard.update({
        where: { id: existing.id },
        data: {
          status,
          activatedAt: status === 'ACTIVE' ? new Date() : undefined,
        },
        select: cardSafeSelect,
      });
      await transaction.cardEvent.create({
        data: { cardId: existing.id, actorId: user.id, eventType: eventMap[status as (typeof allowed)[number]] },
      });
      return updated;
    });
    await this.audit.record({
      actorId: user.id,
      action: `smart_card.status.${status.toLowerCase()}`,
      entityType: 'QrCard',
      entityId: card.id,
      ipAddress,
    });
    return card;
  }

  async replaceCard(user: RequestUser, cardId: string, ipAddress?: string) {
    const oldCard = await this.cardForUser(user, cardId);
    if (!oldCard.subjectId || !oldCard.ownerName) {
      throw new ConflictException('لا يمكن استبدال كارت غير مرتبط بصاحب');
    }
    if (oldCard.status === 'REPLACED' || oldCard.status === 'REVOKED') {
      throw new ConflictException('هذا الكارت منتهي بالفعل');
    }
    const publicCode = await this.nextPublicCode(oldCard.cardType);
    const now = new Date();
    const card = await this.prisma.$transaction(async (transaction) => {
      await transaction.qrCard.update({
        where: { id: oldCard.id },
        data: { status: 'REPLACED' },
      });
      const replacement = await transaction.qrCard.create({
        data: {
          organizationId: user.organizationId,
          branchId: oldCard.branchId,
          templateId: oldCard.templateId,
          cardType: oldCard.cardType,
          subjectId: oldCard.subjectId,
          ownerName: oldCard.ownerName,
          publicCode,
          secretHash: this.signer.fingerprint(publicCode),
          codeFormat: oldCard.codeFormat,
          barcodeType: oldCard.barcodeType,
          status: 'ACTIVE',
          replacesCardId: oldCard.id,
          assignedAt: now,
          activatedAt: now,
          expiresAt: oldCard.expiresAt,
        },
        select: cardSafeSelect,
      });
      await transaction.cardEvent.createMany({
        data: [
          { cardId: oldCard.id, actorId: user.id, eventType: 'REPLACED', metadata: { replacementId: replacement.id } },
          { cardId: replacement.id, actorId: user.id, eventType: 'CREATED', metadata: { replacesCardId: oldCard.id } },
          { cardId: replacement.id, actorId: user.id, eventType: 'ACTIVATED' },
        ],
      });
      return replacement;
    });
    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.replace',
      entityType: 'QrCard',
      entityId: card.id,
      metadata: { replacedCardId: oldCard.id },
      ipAddress,
    });
    return card;
  }

  async cardImage(
    user: RequestUser,
    cardId: string,
    side: CardSide,
    format: ImageFormat,
  ) {
    const input = await this.renderInputForCard(user, cardId);
    const buffer = await this.renderer.renderCard(input, side, format);
    return { buffer, filename: `${input.publicCode}-${side}.${format}`, format };
  }

  async codeImage(
    user: RequestUser,
    cardId: string,
    kind: CodeImageKind,
    format: ImageFormat,
  ) {
    const card = await this.cardForUser(user, cardId);
    const value = kind === 'qr' ? this.signer.payload(card.publicCode) : card.publicCode;
    const buffer = await this.renderer.renderCode(kind, value, format);
    return { buffer, filename: `${card.publicCode}-${kind}.${format}`, format };
  }

  async printJobs(user: RequestUser) {
    const items = await this.prisma.cardPrintJob.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
      select: {
        id: true,
        name: true,
        status: true,
        layout: true,
        pageCount: true,
        createdAt: true,
        printedAt: true,
        branch: { select: { id: true, name: true, code: true } },
        template: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map(({ _count, ...item }) => ({ ...item, cardsCount: _count.items })),
      total: items.length,
    };
  }

  async createPrintJob(user: RequestUser, dto: CreatePrintJobDto, ipAddress?: string) {
    const cardIds = [...new Set(dto.cardIds)];
    const cards = await this.prisma.qrCard.findMany({
      where: {
        id: { in: cardIds },
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { branchId: { in: user.branchIds } }),
        status: { notIn: ['REVOKED', 'REPLACED'] },
      },
      select: { id: true, branchId: true },
    });
    if (cards.length !== cardIds.length) {
      throw new BadRequestException('بعض الكروت غير موجودة أو خارج صلاحياتك أو منتهية');
    }
    if (dto.templateId) await this.templateForUser(user, dto.templateId, true);
    const branchIds = [...new Set(cards.map((card) => card.branchId).filter((id): id is string => Boolean(id)))];
    const branchId = branchIds.length === 1 ? branchIds[0] : null;
    const pageCount = Math.ceil(cardIds.length / this.cardsPerPage(dto.layout));
    const job = await this.prisma.cardPrintJob.create({
      data: {
        organizationId: user.organizationId,
        branchId,
        templateId: dto.templateId,
        name: dto.name.trim(),
        status: 'GENERATED',
        layout: dto.layout,
        pageCount,
        items: {
          create: cardIds.map((cardId, index) => ({ cardId, position: index })),
        },
      },
      select: { id: true, name: true, status: true, layout: true, pageCount: true, createdAt: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'card_print_job.create',
      entityType: 'CardPrintJob',
      entityId: job.id,
      metadata: { cardCount: cardIds.length, layout: dto.layout },
      ipAddress,
    });
    return job;
  }

  async renderPrintPage(user: RequestUser, printJobId: string, page: number) {
    const job = await this.printJobForUser(user, printJobId);
    if (!Number.isInteger(page) || page < 1 || page > job.pageCount) {
      throw new BadRequestException('رقم صفحة الطباعة غير صحيح');
    }
    const perPage = this.cardsPerPage(job.layout);
    const items = await this.prisma.cardPrintJobItem.findMany({
      where: { printJobId: job.id },
      orderBy: { position: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { cardId: true },
    });
    const cards: RenderCardInput[] = [];
    for (const item of items) cards.push(await this.renderInputForCard(user, item.cardId, job.templateId));
    const buffer = await this.renderer.renderSheet(cards, job.layout);
    return { buffer, filename: `${this.fileName(job.name)}-page-${page}.png` };
  }

  async markPrintJobPrinted(user: RequestUser, printJobId: string, ipAddress?: string) {
    const job = await this.printJobForUser(user, printJobId);
    const now = new Date();
    const items = await this.prisma.cardPrintJobItem.findMany({
      where: { printJobId: job.id },
      select: { cardId: true },
    });
    await this.prisma.$transaction(async (transaction) => {
      await transaction.cardPrintJob.update({
        where: { id: job.id },
        data: { status: 'PRINTED', printedAt: now },
      });
      await transaction.qrCard.updateMany({
        where: { id: { in: items.map((item) => item.cardId) } },
        data: { printedAt: now },
      });
      await transaction.cardEvent.createMany({
        data: items.map((item) => ({
          cardId: item.cardId,
          actorId: user.id,
          eventType: 'PRINTED' as CardEventType,
          metadata: { printJobId: job.id },
        })),
      });
    });
    await this.audit.record({
      actorId: user.id,
      action: 'card_print_job.mark_printed',
      entityType: 'CardPrintJob',
      entityId: job.id,
      ipAddress,
    });
    return { id: job.id, status: CardPrintStatus.PRINTED, printedAt: now };
  }

  private async cardForUser(user: RequestUser, cardId: string): Promise<SafeCard> {
    const card = await this.prisma.qrCard.findFirst({
      where: {
        id: cardId,
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { branchId: { in: user.branchIds } }),
      },
      select: cardSafeSelect,
    });
    if (!card) throw new NotFoundException('الكارت غير موجود أو خارج نطاق صلاحياتك');
    return card;
  }

  private async renderInputForCard(
    user: RequestUser,
    cardId: string,
    overrideTemplateId?: string | null,
  ): Promise<RenderCardInput> {
    const card = await this.prisma.qrCard.findFirst({
      where: {
        id: cardId,
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { branchId: { in: user.branchIds } }),
      },
      select: {
        publicCode: true,
        cardType: true,
        ownerName: true,
        subjectId: true,
        expiresAt: true,
        codeFormat: true,
        barcodeType: true,
        organization: { select: { name: true } },
        branch: { select: { name: true } },
        template: {
          select: {
            name: true,
            backgroundColor: true,
            accentColor: true,
            textColor: true,
            mutedTextColor: true,
            showBranch: true,
            showExpiry: true,
          },
        },
      },
    });
    if (!card) throw new NotFoundException('الكارت غير موجود أو خارج نطاق صلاحياتك');
    let template = card.template;
    if (overrideTemplateId) {
      const override = await this.templateForUser(user, overrideTemplateId, true);
      template = {
        name: override.name,
        backgroundColor: override.backgroundColor,
        accentColor: override.accentColor,
        textColor: override.textColor,
        mutedTextColor: override.mutedTextColor,
        showBranch: override.showBranch,
        showExpiry: override.showExpiry,
      };
    }
    return {
      publicCode: card.publicCode,
      cardType: card.cardType,
      ownerName: card.ownerName,
      subjectId: card.subjectId,
      expiresAt: card.expiresAt,
      codeFormat: card.codeFormat,
      barcodeType: card.barcodeType,
      qrPayload: this.signer.payload(card.publicCode),
      organizationName: card.organization.name,
      branchName: card.branch?.name ?? null,
      template,
    };
  }

  private async templateForUser(user: RequestUser, templateId: string, activeOnly: boolean) {
    const template = await this.prisma.cardTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: user.organizationId,
        ...(activeOnly ? { isActive: true } : {}),
        ...(user.isOwner
          ? {}
          : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
    });
    if (!template) throw new NotFoundException('تصميم الكارت غير موجود أو غير متاح');
    return template;
  }

  private async printJobForUser(user: RequestUser, printJobId: string) {
    const job = await this.prisma.cardPrintJob.findFirst({
      where: {
        id: printJobId,
        organizationId: user.organizationId,
        ...(user.isOwner
          ? {}
          : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
    });
    if (!job) throw new NotFoundException('مهمة الطباعة غير موجودة أو خارج نطاق صلاحياتك');
    return job;
  }

  private async assertBranchAccess(user: RequestUser, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { id: { in: user.branchIds } }),
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود أو خارج نطاق صلاحياتك');
  }

  private async nextPublicCode(cardType: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `EDU-${cardType.slice(0, 3)}-${randomBytes(6).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.qrCard.findUnique({ where: { publicCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new ConflictException('تعذر إنشاء رقم كارت فريد، حاول مرة أخرى');
  }

  private cardsPerPage(layout: CardPrintLayout): number {
    if (layout === 'A4_10_UP') return 10;
    if (layout === 'A4_8_UP') return 8;
    return 1;
  }

  private fileName(value: string): string {
    return value.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'cards';
  }
}
