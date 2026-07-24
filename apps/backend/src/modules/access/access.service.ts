import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async users(user: RequestUser) {
    const items = await this.prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.isOwner ? {} : { branchLinks: { some: { branchId: { in: user.branchIds } } } }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        roleLinks: { select: { role: { select: { id: true, name: true, code: true } } } },
        branchLinks: { select: { branch: { select: { id: true, name: true, code: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        status: item.status,
        createdAt: item.createdAt,
        roles: item.roleLinks.map((link) => link.role),
        branches: item.branchLinks.map((link) => link.branch),
      })),
      total: items.length,
    };
  }

  async createUser(user: RequestUser, dto: CreateUserDto, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (duplicate) throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');

    await this.validateAssignments(user, dto.roleIds, dto.branchIds);
    const created = await this.prisma.$transaction(async (transaction) => {
      const newUser = await transaction.user.create({
        data: {
          organizationId: user.organizationId,
          name: dto.name.trim(),
          email,
          passwordHash: await hash(dto.password, 12),
        },
        select: { id: true, name: true, email: true, status: true, createdAt: true },
      });
      await transaction.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: newUser.id, roleId })),
      });
      await transaction.userBranch.createMany({
        data: dto.branchIds.map((branchId) => ({ userId: newUser.id, branchId })),
      });
      return newUser;
    });

    await this.audit.record({
      actorId: user.id,
      action: 'user.create',
      entityType: 'User',
      entityId: created.id,
      metadata: { roleIds: dto.roleIds, branchIds: dto.branchIds },
      ipAddress,
    });
    return created;
  }

  async updateUser(
    actor: RequestUser,
    userId: string,
    dto: UpdateUserDto,
    ipAddress?: string,
  ) {
    await this.assertUserAccess(actor, userId);
    if (dto.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: { email: dto.email.trim().toLowerCase(), id: { not: userId } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }
    if (dto.roleIds || dto.branchIds) {
      await this.validateAssignments(actor, dto.roleIds ?? [], dto.branchIds ?? []);
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.user.update({
        where: { id: userId },
        data: {
          name: dto.name?.trim(),
          email: dto.email?.trim().toLowerCase(),
          passwordHash: dto.password ? await hash(dto.password, 12) : undefined,
        },
        select: { id: true, name: true, email: true, status: true, createdAt: true },
      });

      if (dto.roleIds) {
        await transaction.userRole.deleteMany({ where: { userId } });
        if (dto.roleIds.length) {
          await transaction.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId, roleId })),
          });
        }
      }
      if (dto.branchIds) {
        await transaction.userBranch.deleteMany({ where: { userId } });
        if (dto.branchIds.length) {
          await transaction.userBranch.createMany({
            data: dto.branchIds.map((branchId) => ({ userId, branchId })),
          });
        }
      }
      return changed;
    });

    await this.audit.record({
      actorId: actor.id,
      action: 'user.update',
      entityType: 'User',
      entityId: updated.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return updated;
  }

  async setUserStatus(
    actor: RequestUser,
    userId: string,
    status: UserStatus,
    ipAddress?: string,
  ) {
    if (actor.id === userId && status === 'SUSPENDED') {
      throw new BadRequestException('لا يمكنك إيقاف حسابك الحالي');
    }
    await this.assertUserAccess(actor, userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status, refreshTokenHash: status === 'SUSPENDED' ? null : undefined },
      select: { id: true, name: true, email: true, status: true },
    });
    await this.audit.record({
      actorId: actor.id,
      action: status === 'ACTIVE' ? 'user.activate' : 'user.suspend',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });
    return updated;
  }

  async roles(user: RequestUser) {
    const items = await this.prisma.role.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        isSystem: true,
        createdAt: true,
        permissionLinks: {
          select: { permission: { select: { id: true, code: true, name: true, module: true } } },
        },
        _count: { select: { userLinks: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        isSystem: item.isSystem,
        usersCount: item._count.userLinks,
        permissions: item.permissionLinks.map((link) => link.permission),
      })),
      total: items.length,
    };
  }

  async permissions() {
    const items = await this.prisma.permission.findMany({
      select: { id: true, code: true, name: true, module: true },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    return { items, total: items.length };
  }

  async createRole(user: RequestUser, dto: CreateRoleDto, ipAddress?: string) {
    const code = dto.code.toUpperCase();
    const duplicate = await this.prisma.role.findUnique({
      where: { organizationId_code: { organizationId: user.organizationId, code } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('كود الدور مستخدم بالفعل');
    await this.validatePermissions(dto.permissionIds);

    const role = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.role.create({
        data: { organizationId: user.organizationId, name: dto.name.trim(), code },
        select: { id: true, name: true, code: true, isSystem: true },
      });
      if (dto.permissionIds.length) {
        await transaction.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        });
      }
      return created;
    });
    await this.audit.record({
      actorId: user.id,
      action: 'role.create',
      entityType: 'Role',
      entityId: role.id,
      metadata: { permissionIds: dto.permissionIds },
      ipAddress,
    });
    return role;
  }

  async updateRolePermissions(
    user: RequestUser,
    roleId: string,
    dto: UpdateRolePermissionsDto,
    ipAddress?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: user.organizationId },
      select: { id: true, isSystem: true, code: true },
    });
    if (!role) throw new NotFoundException('الدور غير موجود');
    if (role.isSystem) throw new ForbiddenException('الأدوار النظامية لا تعدل مباشرة');
    await this.validatePermissions(dto.permissionIds);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (dto.permissionIds.length) {
        await transaction.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    });
    await this.audit.record({
      actorId: user.id,
      action: 'role.permissions.update',
      entityType: 'Role',
      entityId: roleId,
      metadata: { permissionIds: dto.permissionIds },
      ipAddress,
    });
    return { success: true };
  }

  async auditLogs(user: RequestUser) {
    const items = await this.prisma.auditLog.findMany({
      where: { actor: { organizationId: user.organizationId } },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    return { items, total: items.length };
  }

  private async validateAssignments(
    user: RequestUser,
    roleIds: string[],
    branchIds: string[],
  ): Promise<void> {
    if (roleIds.length) {
      const roleCount = await this.prisma.role.count({
        where: { id: { in: roleIds }, organizationId: user.organizationId },
      });
      if (roleCount !== new Set(roleIds).size) throw new BadRequestException('أحد الأدوار غير صالح');
    }
    if (branchIds.length) {
      if (!user.isOwner && branchIds.some((branchId) => !user.branchIds.includes(branchId))) {
        throw new BadRequestException('أحد الفروع خارج نطاق صلاحياتك');
      }
      const branchCount = await this.prisma.branch.count({
        where: { id: { in: branchIds }, organizationId: user.organizationId },
      });
      if (branchCount !== new Set(branchIds).size) {
        throw new BadRequestException('أحد الفروع غير صالح');
      }
    }
  }

  private async validatePermissions(permissionIds: string[]): Promise<void> {
    if (!permissionIds.length) return;
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== new Set(permissionIds).size) {
      throw new BadRequestException('توجد صلاحية غير صالحة');
    }
  }

  private async assertUserAccess(actor: RequestUser, userId: string): Promise<void> {
    const where: Prisma.UserWhereInput = {
      id: userId,
      organizationId: actor.organizationId,
      ...(actor.isOwner
        ? {}
        : { branchLinks: { some: { branchId: { in: actor.branchIds } } } }),
    };
    const target = await this.prisma.user.findFirst({ where, select: { id: true } });
    if (!target) throw new NotFoundException('المستخدم غير موجود أو خارج نطاق صلاحياتك');
  }
}
