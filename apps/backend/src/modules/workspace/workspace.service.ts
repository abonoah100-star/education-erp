import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CashboxStatus, CardType, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import type { CreateCashboxDto } from './dto/cashbox.dto';
import type { IssueQrCardDto } from './dto/qr-card.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async overview(user: RequestUser) {
    const branchWhere = this.branchWhere(user);
    const [branches, cashboxes, users, audits] = await Promise.all([
      this.prisma.branch.count({ where: { ...branchWhere, isActive: true } }),
      this.prisma.cashbox.findMany({
        where: { branch: branchWhere },
        select: {
          id: true,
          name: true,
          code: true,
          balance: true,
          status: true,
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ branch: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.prisma.user.count({
        where: { organizationId: user.organizationId, status: 'ACTIVE' },
      }),
      this.prisma.auditLog.findMany({
        where: { actor: { organizationId: user.organizationId } },
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      }),
    ]);

    return {
      branches,
      totalCashBalance: cashboxes.reduce((sum, cashbox) => sum + Number(cashbox.balance), 0),
      users,
      cashboxes: cashboxes.map((cashbox) => ({
        id: cashbox.id,
        name: cashbox.name,
        code: cashbox.code,
        balance: Number(cashbox.balance),
        branch: cashbox.branch,
        status: cashbox.status,
      })),
      attention: [
        {
          level: 'warning',
          title: 'إعداد قنوات إشعارات ولي الأمر',
          description: 'طبقة الإشعارات مستقلة وجاهزة لربط WhatsApp وSMS في مرحلة لاحقة.',
        },
        {
          level: 'info',
          title: 'تأمين بطاقات QR',
          description: 'الرموز السرية لا تظهر في القوائم أو استجابات القراءة.',
        },
      ],
      recentActivity: audits.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorName: entry.actor?.name ?? 'النظام',
        createdAt: entry.createdAt,
      })),
    };
  }

  async branches(user: RequestUser) {
    const items = await this.prisma.branch.findMany({
      where: this.branchWhere(user),
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        isActive: true,
        createdAt: true,
        cashboxes: {
          select: { id: true, name: true, code: true, balance: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: items.map((branch) => ({
        ...branch,
        cashboxes: branch.cashboxes.map((cashbox) => ({
          ...cashbox,
          balance: Number(cashbox.balance),
        })),
        usersCount: branch._count.memberships,
        _count: undefined,
      })),
      total: items.length,
    };
  }

  async createBranch(user: RequestUser, dto: CreateBranchDto, ipAddress?: string) {
    const existing = await this.prisma.branch.findUnique({
      where: {
        organizationId_code: {
          organizationId: user.organizationId,
          code: dto.code.toUpperCase(),
        },
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('كود الفرع مستخدم بالفعل');

    const branch = await this.prisma.branch.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name.trim(),
        code: dto.code.toUpperCase(),
        address: dto.address?.trim() || null,
        phone: dto.phone?.trim() || null,
      },
      select: { id: true, name: true, code: true, address: true, phone: true, isActive: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'branch.create',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { code: branch.code, name: branch.name },
      ipAddress,
    });
    return branch;
  }

  async updateBranch(
    user: RequestUser,
    branchId: string,
    dto: UpdateBranchDto,
    ipAddress?: string,
  ) {
    await this.assertBranchAccess(user, branchId);
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        name: dto.name?.trim(),
        address: dto.address === undefined ? undefined : dto.address.trim() || null,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
      },
      select: { id: true, name: true, code: true, address: true, phone: true, isActive: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'branch.update',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return branch;
  }

  async setBranchStatus(
    user: RequestUser,
    branchId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    await this.assertBranchAccess(user, branchId);
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: { isActive },
      select: { id: true, name: true, code: true, isActive: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: isActive ? 'branch.activate' : 'branch.deactivate',
      entityType: 'Branch',
      entityId: branch.id,
      ipAddress,
    });
    return branch;
  }

  async createCashbox(
    user: RequestUser,
    branchId: string,
    dto: CreateCashboxDto,
    ipAddress?: string,
  ) {
    await this.assertBranchAccess(user, branchId);
    const existing = await this.prisma.cashbox.findUnique({
      where: { branchId_code: { branchId, code: dto.code.toUpperCase() } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('كود الخزينة مستخدم داخل هذا الفرع');

    const cashbox = await this.prisma.cashbox.create({
      data: { branchId, name: dto.name.trim(), code: dto.code.toUpperCase() },
      select: { id: true, name: true, code: true, balance: true, status: true, branchId: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'cashbox.create',
      entityType: 'Cashbox',
      entityId: cashbox.id,
      metadata: { branchId, code: cashbox.code },
      ipAddress,
    });
    return { ...cashbox, balance: Number(cashbox.balance) };
  }

  async setCashboxStatus(
    user: RequestUser,
    cashboxId: string,
    status: CashboxStatus,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.cashbox.findUnique({
      where: { id: cashboxId },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException('الخزينة غير موجودة');
    await this.assertBranchAccess(user, existing.branchId);

    const cashbox = await this.prisma.cashbox.update({
      where: { id: cashboxId },
      data: { status },
      select: { id: true, name: true, code: true, balance: true, status: true, branchId: true },
    });
    await this.audit.record({
      actorId: user.id,
      action: status === 'ACTIVE' ? 'cashbox.open' : 'cashbox.close',
      entityType: 'Cashbox',
      entityId: cashbox.id,
      ipAddress,
    });
    return { ...cashbox, balance: Number(cashbox.balance) };
  }

  async qrCards(user: RequestUser) {
    const items = await this.prisma.qrCard.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        cardType: true,
        subjectId: true,
        publicCode: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items, total: items.length };
  }

  async issueQrCard(user: RequestUser, dto: IssueQrCardDto, ipAddress?: string) {
    const issued = await this.createQrRecord(user.organizationId, dto.cardType, dto.subjectId, dto.expiresAt);
    await this.audit.record({
      actorId: user.id,
      action: 'qr.issue',
      entityType: 'QrCard',
      entityId: issued.card.id,
      metadata: { cardType: dto.cardType, subjectId: dto.subjectId },
      ipAddress,
    });
    return { ...issued.card, qrPayload: issued.qrPayload };
  }

  async revokeQrCard(user: RequestUser, cardId: string, ipAddress?: string) {
    const existing = await this.prisma.qrCard.findFirst({
      where: { id: cardId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('بطاقة QR غير موجودة');

    const card = await this.prisma.qrCard.update({
      where: { id: cardId },
      data: { isActive: false },
      select: {
        id: true,
        cardType: true,
        subjectId: true,
        publicCode: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'qr.revoke',
      entityType: 'QrCard',
      entityId: card.id,
      ipAddress,
    });
    return card;
  }

  async replaceQrCard(user: RequestUser, cardId: string, ipAddress?: string) {
    const oldCard = await this.prisma.qrCard.findFirst({
      where: { id: cardId, organizationId: user.organizationId },
      select: { id: true, cardType: true, subjectId: true, expiresAt: true },
    });
    if (!oldCard) throw new NotFoundException('بطاقة QR غير موجودة');

    const issued = await this.createQrRecord(
      user.organizationId,
      oldCard.cardType,
      oldCard.subjectId,
      oldCard.expiresAt?.toISOString(),
      async (data) =>
        this.prisma.$transaction(async (transaction) => {
          await transaction.qrCard.update({ where: { id: oldCard.id }, data: { isActive: false } });
          return transaction.qrCard.create({ data, select: this.qrSafeSelect() });
        }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'qr.replace',
      entityType: 'QrCard',
      entityId: issued.card.id,
      metadata: { replacedCardId: oldCard.id },
      ipAddress,
    });
    return { ...issued.card, qrPayload: issued.qrPayload };
  }

  private branchWhere(user: RequestUser): Prisma.BranchWhereInput {
    return {
      organizationId: user.organizationId,
      ...(user.isOwner ? {} : { id: { in: user.branchIds } }),
    };
  }

  private async assertBranchAccess(user: RequestUser, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { AND: [{ id: branchId }, this.branchWhere(user)] },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود أو خارج نطاق صلاحياتك');
  }

  private qrSafeSelect() {
    return {
      id: true,
      cardType: true,
      subjectId: true,
      publicCode: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
    } satisfies Prisma.QrCardSelect;
  }

  private async createQrRecord(
    organizationId: string,
    cardType: CardType,
    subjectId: string,
    expiresAt?: string,
    creator?: (data: Prisma.QrCardCreateInput) => Promise<{
      id: string;
      cardType: CardType;
      subjectId: string;
      publicCode: string;
      isActive: boolean;
      expiresAt: Date | null;
      createdAt: Date;
    }>,
  ) {
    const publicCode = `QR-${cardType}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const token = randomBytes(32).toString('base64url');
    const data: Prisma.QrCardCreateInput = {
      organizationId,
      cardType,
      subjectId: subjectId.trim(),
      publicCode,
      secretHash: await hash(token, 12),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
    const card = creator
      ? await creator(data)
      : await this.prisma.qrCard.create({ data, select: this.qrSafeSelect() });
    return { card, qrPayload: `educore:${publicCode}:${token}` };
  }
}
