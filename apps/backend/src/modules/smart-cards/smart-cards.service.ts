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
  CardType,
  Prisma,
  SmartCardStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
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
  type CardSelection,
  type CardSide,
  type CodeImageKind,
  type ImageFormat,
  type RenderCardInput,
} from './card-renderer.service';
import { CardSigningService } from './card-signing.service';
import { toPrismaBytes } from './prisma-bytes';

const cardSafeSelect = {
  id: true,
  branchId: true,
  templateId: true,
  batchId: true,
  cardType: true,
  subjectId: true,
  ownerName: true,
  portraitAssetId: true,
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

  async createPortraitAsset(
    user: RequestUser,
    file: { buffer: Buffer; mimetype: string; size: number },
    ipAddress?: string,
  ) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.mimetype)) {
      throw new BadRequestException('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
    }

    let normalized: { content: Buffer; mimeType: string };
    try {
      normalized = await this.renderer.normalizePortrait(file.buffer);
    } catch {
      throw new BadRequestException('تعذر قراءة الصورة أو أن الملف غير صالح');
    }

    const storedContent = toPrismaBytes(normalized.content);
    const sha256 = createHash('sha256').update(storedContent).digest('hex');
    const asset = await this.prisma.cardPortraitAsset.upsert({
      where: {
        organizationId_sha256: {
          organizationId: user.organizationId,
          sha256,
        },
      },
      update: {},
      create: {
        organizationId: user.organizationId,
        mimeType: normalized.mimeType,
        byteSize: storedContent.byteLength,
        sha256,
        content: storedContent,
      },
      select: { id: true, mimeType: true, byteSize: true, createdAt: true },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.portrait.upload',
      entityType: 'CardPortraitAsset',
      entityId: asset.id,
      metadata: { mimeType: asset.mimeType, byteSize: asset.byteSize },
      ipAddress,
    });
    return asset;
  }

  async portraitAssetImage(user: RequestUser, assetId: string) {
    const asset = await this.prisma.cardPortraitAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId },
      select: { id: true, mimeType: true, content: true },
    });
    if (!asset) throw new NotFoundException('صورة صاحب الكارت غير موجودة');
    return { buffer: Buffer.from(asset.content), mimeType: asset.mimeType };
  }

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
    if (dto.portraitAssetId) {
      await this.assertPortraitAssetAccess(user, dto.portraitAssetId);
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const sequence = await this.nextSequence(transaction, user.organizationId, dto.cardType, {
        card: true,
        subject: !dto.subjectId?.trim(),
      });
      const publicCode = this.formatPublicCode(dto.cardType, sequence.lastCardNumber);
      const subjectId =
        dto.subjectId?.trim() || this.formatSubjectCode(dto.cardType, sequence.lastSubjectNumber);

      const card = await transaction.qrCard.create({
        data: {
          organizationId: user.organizationId,
          branchId: dto.branchId,
          templateId: template.id,
          cardType: dto.cardType,
          subjectId,
          ownerName: dto.ownerName.trim(),
          portraitAssetId: dto.portraitAssetId ?? null,
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
          { cardId: card.id, actorId: user.id, eventType: 'CREATED' },
          { cardId: card.id, actorId: user.id, eventType: 'ASSIGNED' },
          { cardId: card.id, actorId: user.id, eventType: 'ACTIVATED' },
        ],
      });
      return { card, publicCode, subjectId };
    });

    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.issue',
      entityType: 'QrCard',
      entityId: result.card.id,
      metadata: {
        publicCode: result.publicCode,
        cardType: dto.cardType,
        subjectId: result.subjectId,
        portraitAssetId: dto.portraitAssetId ?? null,
      },
      ipAddress,
    });
    return result.card;
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
    if (dto.portraitAssetId) {
      await this.assertPortraitAssetAccess(user, dto.portraitAssetId);
    }
    const existing = await this.cardForUser(user, cardId);
    if (existing.status !== 'IN_STOCK') {
      throw new ConflictException('يمكن ربط الكروت المتاحة في المخزون فقط');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      let subjectId = dto.subjectId?.trim();
      if (!subjectId) {
        const sequence = await this.nextSequence(
          transaction,
          user.organizationId,
          dto.cardType,
          { card: false, subject: true },
        );
        subjectId = this.formatSubjectCode(dto.cardType, sequence.lastSubjectNumber);
      }

      const card = await transaction.qrCard.update({
        where: { id: existing.id },
        data: {
          branchId: dto.branchId,
          templateId: template.id,
          cardType: dto.cardType,
          subjectId,
          ownerName: dto.ownerName.trim(),
          portraitAssetId: dto.portraitAssetId ?? null,
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
      return { card, subjectId };
    });

    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.assign_existing',
      entityType: 'QrCard',
      entityId: result.card.id,
      metadata: {
        subjectId: result.subjectId,
        publicCode: result.card.publicCode,
        portraitAssetId: dto.portraitAssetId ?? null,
      },
      ipAddress,
    });
    return result.card;
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
    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const sequence = await this.nextSequence(
        transaction,
        user.organizationId,
        oldCard.cardType,
        { card: true, subject: false },
      );
      const publicCode = this.formatPublicCode(oldCard.cardType, sequence.lastCardNumber);
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
          portraitAssetId: oldCard.portraitAssetId,
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
          {
            cardId: oldCard.id,
            actorId: user.id,
            eventType: 'REPLACED',
            metadata: { replacementId: replacement.id },
          },
          {
            cardId: replacement.id,
            actorId: user.id,
            eventType: 'CREATED',
            metadata: { replacesCardId: oldCard.id },
          },
          { cardId: replacement.id, actorId: user.id, eventType: 'ACTIVATED' },
        ],
      });
      return { replacement, publicCode };
    });
    await this.audit.record({
      actorId: user.id,
      action: 'smart_card.replace',
      entityType: 'QrCard',
      entityId: result.replacement.id,
      metadata: { replacedCardId: oldCard.id, publicCode: result.publicCode },
      ipAddress,
    });
    return result.replacement;
  }

  async cardImage(
    user: RequestUser,
    cardId: string,
    selection: CardSelection,
    format: ImageFormat,
  ) {
    const input = await this.renderInputForCard(user, cardId);
    const buffer = await this.renderer.renderSelection(input, selection, format);
    return { buffer, filename: `${input.publicCode}-${selection}.${format}`, format };
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
        sideSelection: true,
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
    const basePageCount = Math.ceil(cardIds.length / this.cardsPerPage(dto.layout));
    const pageCount = dto.sideSelection === 'BOTH' ? basePageCount * 2 : basePageCount;
    const job = await this.prisma.cardPrintJob.create({
      data: {
        organizationId: user.organizationId,
        branchId,
        templateId: dto.templateId,
        name: dto.name.trim(),
        status: 'GENERATED',
        layout: dto.layout,
        sideSelection: dto.sideSelection,
        pageCount,
        items: {
          create: cardIds.map((cardId, index) => ({ cardId, position: index })),
        },
      },
      select: { id: true, name: true, status: true, layout: true, sideSelection: true, pageCount: true, createdAt: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'card_print_job.create',
      entityType: 'CardPrintJob',
      entityId: job.id,
      metadata: { cardCount: cardIds.length, layout: dto.layout, sideSelection: dto.sideSelection },
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
    const itemCount = await this.prisma.cardPrintJobItem.count({ where: { printJobId: job.id } });
    const basePageCount = Math.ceil(itemCount / perPage);
    const side: CardSide = job.sideSelection === 'BACK' || (job.sideSelection === 'BOTH' && page > basePageCount)
      ? 'back'
      : 'front';
    const dataPage = job.sideSelection === 'BOTH' ? ((page - 1) % basePageCount) + 1 : page;
    const items = await this.prisma.cardPrintJobItem.findMany({
      where: { printJobId: job.id },
      orderBy: { position: 'asc' },
      skip: (dataPage - 1) * perPage,
      take: perPage,
      select: { cardId: true },
    });
    const cards: RenderCardInput[] = [];
    for (const item of items) cards.push(await this.renderInputForCard(user, item.cardId, job.templateId));
    const buffer = await this.renderer.renderSheet(cards, job.layout, side);
    return { buffer, filename: `${this.fileName(job.name)}-${side}-page-${dataPage}.png` };
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
        portraitAsset: { select: { mimeType: true, content: true } },
        organization: {
          select: {
            name: true,
            cardSubtitle: true,
            cardBackTitle: true,
            cardBackInstruction: true,
            cardBackFooter: true,
            brandAsset: { select: { mimeType: true, content: true } },
          },
        },
        branch: { select: { name: true } },
        template: {
          select: {
            name: true,
            backgroundColor: true,
            accentColor: true,
            textColor: true,
            mutedTextColor: true,
            showPhoto: true,
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
        showPhoto: override.showPhoto,
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
      organizationSubtitle: card.organization.cardSubtitle,
      cardBackTitle: card.organization.cardBackTitle,
      cardBackInstruction: card.organization.cardBackInstruction,
      cardBackFooter: card.organization.cardBackFooter,
      organizationLogo: card.organization.brandAsset
        ? {
            mimeType: card.organization.brandAsset.mimeType,
            content: Buffer.from(card.organization.brandAsset.content),
          }
        : null,
      branchName: card.branch?.name ?? null,
      portrait: card.portraitAsset
        ? { mimeType: card.portraitAsset.mimeType, content: Buffer.from(card.portraitAsset.content) }
        : null,
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

  private async assertPortraitAssetAccess(user: RequestUser, portraitAssetId: string) {
    const asset = await this.prisma.cardPortraitAsset.findFirst({
      where: { id: portraitAssetId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('صورة صاحب الكارت غير موجودة أو غير متاحة');
  }

  private async nextSequence(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    cardType: CardType,
    increment: { card: boolean; subject: boolean },
  ) {
    return transaction.cardSequence.upsert({
      where: { organizationId_cardType: { organizationId, cardType } },
      create: {
        organizationId,
        cardType,
        lastCardNumber: increment.card ? 1 : 0,
        lastSubjectNumber: increment.subject ? 1 : 0,
      },
      update: {
        ...(increment.card ? { lastCardNumber: { increment: 1 } } : {}),
        ...(increment.subject ? { lastSubjectNumber: { increment: 1 } } : {}),
      },
      select: { lastCardNumber: true, lastSubjectNumber: true },
    });
  }

  private formatPublicCode(cardType: CardType, sequence: number): string {
    return `EDU-${this.cardTypePrefix(cardType)}-${String(sequence).padStart(6, '0')}`;
  }

  private formatSubjectCode(cardType: CardType, sequence: number): string {
    return `${this.cardTypePrefix(cardType)}-${String(sequence).padStart(6, '0')}`;
  }

  private cardTypePrefix(cardType: CardType): string {
    const prefixes: Record<CardType, string> = {
      STUDENT: 'STU',
      GUARDIAN: 'GUA',
      TEACHER: 'TCH',
      STAFF: 'STF',
    };
    return prefixes[cardType];
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
