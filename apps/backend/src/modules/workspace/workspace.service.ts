import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CashboxStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toPrismaBytes } from '../smart-cards/prisma-bytes';
import type { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import type { CreateCashboxDto } from './dto/cashbox.dto';
import type { UpdateOrganizationSettingsDto } from './dto/organization-settings.dto';

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
          title: 'إدارة الكروت الذكية',
          description: 'QR وCode 128 وصور الكروت والطباعة الدفعية تعمل داخل وحدة مستقلة.',
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

  async organizationSettings(user: RequestUser) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        systemName: true,
        cardSubtitle: true,
        cardBackTitle: true,
        cardBackInstruction: true,
        cardBackFooter: true,
        code: true,
        brandAsset: { select: { updatedAt: true } },
      },
    });
    if (!organization) throw new NotFoundException('بيانات المؤسسة غير موجودة');
    return this.serializeOrganizationSettings(organization);
  }

  async updateOrganizationSettings(
    user: RequestUser,
    dto: UpdateOrganizationSettingsDto,
    ipAddress?: string,
  ) {
    const organization = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: dto.name.trim(),
        systemName: dto.systemName.trim(),
        cardSubtitle: dto.cardSubtitle?.trim() || null,
        cardBackTitle: dto.cardBackTitle?.trim() || null,
        cardBackInstruction: dto.cardBackInstruction?.trim() || null,
        cardBackFooter: dto.cardBackFooter?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        systemName: true,
        cardSubtitle: true,
        cardBackTitle: true,
        cardBackInstruction: true,
        cardBackFooter: true,
        code: true,
        brandAsset: { select: { updatedAt: true } },
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'organization.settings.update',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: { name: organization.name, systemName: organization.systemName },
      ipAddress,
    });
    return this.serializeOrganizationSettings(organization);
  }

  async updateOrganizationLogo(
    user: RequestUser,
    file: Express.Multer.File,
    ipAddress?: string,
  ) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('صيغة اللوجو يجب أن تكون JPG أو PNG أو WebP');
    }
    const content = await sharp(file.buffer)
      .rotate()
      .resize(900, 900, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const sha256 = createHash('sha256').update(content).digest('hex');
    await this.prisma.organizationBrandAsset.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        mimeType: 'image/png',
        byteSize: content.byteLength,
        sha256,
        content: toPrismaBytes(content),
      },
      update: {
        mimeType: 'image/png',
        byteSize: content.byteLength,
        sha256,
        content: toPrismaBytes(content),
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'organization.logo.update',
      entityType: 'Organization',
      entityId: user.organizationId,
      metadata: { sha256, byteSize: content.byteLength },
      ipAddress,
    });
    return this.organizationSettings(user);
  }

  async deleteOrganizationLogo(user: RequestUser, ipAddress?: string) {
    await this.prisma.organizationBrandAsset.deleteMany({
      where: { organizationId: user.organizationId },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'organization.logo.reset',
      entityType: 'Organization',
      entityId: user.organizationId,
      ipAddress,
    });
    return this.organizationSettings(user);
  }

  private serializeOrganizationSettings(organization: {
    id: string;
    name: string;
    systemName: string;
    cardSubtitle: string | null;
    cardBackTitle: string | null;
    cardBackInstruction: string | null;
    cardBackFooter: string | null;
    code: string;
    brandAsset: { updatedAt: Date } | null;
  }) {
    return {
      id: organization.id,
      name: organization.name,
      systemName: organization.systemName,
      cardSubtitle: organization.cardSubtitle,
      cardBackTitle: organization.cardBackTitle,
      cardBackInstruction: organization.cardBackInstruction,
      cardBackFooter: organization.cardBackFooter,
      code: organization.code,
      hasCustomLogo: Boolean(organization.brandAsset),
      logoUrl: `/api/branding/logo?v=${organization.brandAsset?.updatedAt.getTime() ?? 'default'}`,
    };
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

}
