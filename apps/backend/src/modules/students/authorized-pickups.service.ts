import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthorizedPickupStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normalizePersonName } from './domain/profile-code';
import type {
  AuthorizedPickupListQueryDto,
  CreateAuthorizedPickupDto,
  LinkAuthorizedPickupStudentDto,
  UpdateAuthorizedPickupDto,
} from './dto/authorized-pickup.dto';
import { PersonAssetsService } from './person-assets.service';
import { ProfileSequenceService } from './profile-sequence.service';
import { isUniqueConstraintViolation } from './prisma-errors';
import { StudentAccessService } from './student-access.service';

@Injectable()
export class AuthorizedPickupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: ProfileSequenceService,
    private readonly assets: PersonAssetsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  async list(user: RequestUser, query: AuthorizedPickupListQueryDto) {
    if (query.studentId) await this.studentAccess.requireStudent(user, query.studentId);
    const search = query.search?.trim();
    let normalizedSearch: string | undefined;
    if (search) {
      try {
        normalizedSearch = normalizePersonName(search);
      } catch {
        normalizedSearch = undefined;
      }
    }
    const conditions: Prisma.AuthorizedPickupWhereInput[] = [];
    if (query.studentId) {
      conditions.push({ students: { some: { studentId: query.studentId, isActive: true } } });
    }
    if (!user.isOwner) {
      conditions.push({
        students: {
          some: { isActive: true, student: { branchId: { in: user.branchIds } } },
        },
      });
    }
    if (search) {
      conditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          ...(normalizedSearch
            ? [{ normalizedName: { contains: normalizedSearch, mode: 'insensitive' as const } }]
            : []),
          { phone: { contains: search } },
          { nationalId: { contains: search } },
        ],
      });
    }
    const where: Prisma.AuthorizedPickupWhereInput = {
      organizationId: user.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(conditions.length ? { AND: conditions } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.authorizedPickup.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          nameArabic: true,
          relationship: true,
          customRelationship: true,
          phone: true,
          status: true,
          validFrom: true,
          validUntil: true,
          profilePhotoAssetId: true,
          students: {
            where: {
              isActive: true,
              ...(user.isOwner ? {} : { student: { branchId: { in: user.branchIds } } }),
            },
            select: {
              student: {
                select: {
                  id: true,
                  code: true,
                  nameArabic: true,
                  branch: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.authorizedPickup.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, studentsCount: item.students.length })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async create(user: RequestUser, dto: CreateAuthorizedPickupDto, ipAddress?: string) {
    if (!dto.studentIds.length) throw new BadRequestException('حدد طالبًا واحدًا على الأقل');
    const uniqueStudentIds = [...new Set(dto.studentIds)];
    if (uniqueStudentIds.length !== dto.studentIds.length) {
      throw new BadRequestException('لا يمكن تكرار الطالب في نفس الطلب');
    }
    for (const studentId of uniqueStudentIds) await this.studentAccess.requireStudent(user, studentId);
    const customRelationship = this.relationshipText(dto.relationship, dto.customRelationship);
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (validFrom && validUntil && validUntil < validFrom) {
      throw new BadRequestException('تاريخ انتهاء التصريح يجب ألا يسبق تاريخ بدايته');
    }

    let pickup: {
      id: string;
      code: string;
      nameArabic: string;
      phone: string;
      status: AuthorizedPickupStatus;
      validFrom: Date | null;
      validUntil: Date | null;
      students: { studentId: string }[];
    };
    try {
      pickup = await this.prisma.$transaction(async (transaction) => {
      if (dto.guardianId) {
        const guardian = await transaction.guardian.findFirst({
          where: {
            id: dto.guardianId,
            organizationId: user.organizationId,
            ...(user.isOwner
              ? {}
              : {
                  OR: [
                    { students: { none: { isActive: true } } },
                    {
                      students: {
                        some: {
                          isActive: true,
                          student: { branchId: { in: user.branchIds } },
                        },
                      },
                    },
                  ],
                }),
          },
          select: { id: true },
        });
        if (!guardian) throw new BadRequestException('ولي الأمر المرتبط غير موجود أو خارج نطاق الفرع');
      }
      const sequence = await this.sequences.next(
        transaction,
        user.organizationId,
        'AUTHORIZED_PICKUP',
      );
      return transaction.authorizedPickup.create({
        data: {
          organizationId: user.organizationId,
          code: sequence.code,
          sequenceNumber: sequence.sequenceNumber,
          guardianId: dto.guardianId ?? null,
          nameArabic: dto.nameArabic.trim(),
          normalizedName: normalizePersonName(dto.nameArabic),
          relationship: dto.relationship,
          customRelationship,
          phone: dto.phone.trim(),
          nationalId: dto.nationalId?.trim() || null,
          validFrom,
          validUntil,
          securityNotes: dto.securityNotes?.trim() || null,
          students: {
            create: uniqueStudentIds.map((studentId) => ({ studentId })),
          },
        },
        select: {
          id: true,
          code: true,
          nameArabic: true,
          phone: true,
          status: true,
          validFrom: true,
          validUntil: true,
          students: { select: { studentId: true } },
        },
      });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد شخص مصرح له بنفس رقم الهوية أو الكود');
      }
      throw error;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'authorized_pickup.create',
      entityType: 'AuthorizedPickup',
      entityId: pickup.id,
      metadata: { code: pickup.code, studentIds: uniqueStudentIds },
      ipAddress,
    });
    return pickup;
  }

  async update(
    user: RequestUser,
    pickupId: string,
    dto: UpdateAuthorizedPickupDto,
    ipAddress?: string,
  ) {
    const existing = await this.requirePickup(user, pickupId);
    const relationship = dto.relationship;
    const customRelationship = relationship
      ? this.relationshipText(relationship, dto.customRelationship)
      : dto.customRelationship?.trim();
    const validFrom = dto.validFrom === undefined ? undefined : new Date(dto.validFrom);
    const validUntil = dto.validUntil === undefined ? undefined : new Date(dto.validUntil);
    const effectiveFrom = validFrom ?? existing.validFrom;
    const effectiveUntil = validUntil ?? existing.validUntil;
    if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
      throw new BadRequestException('تاريخ انتهاء التصريح يجب ألا يسبق تاريخ بدايته');
    }
    let pickup: {
      id: string;
      code: string;
      nameArabic: string;
      phone: string;
      status: AuthorizedPickupStatus;
      validFrom: Date | null;
      validUntil: Date | null;
    };
    try {
      pickup = await this.prisma.authorizedPickup.update({
        where: { id: pickupId },
        data: {
          nameArabic: dto.nameArabic?.trim(),
          normalizedName: dto.nameArabic ? normalizePersonName(dto.nameArabic) : undefined,
          relationship,
          customRelationship,
          phone: dto.phone?.trim(),
          nationalId: dto.nationalId === undefined ? undefined : dto.nationalId.trim() || null,
          validFrom,
          validUntil,
          securityNotes:
            dto.securityNotes === undefined ? undefined : dto.securityNotes.trim() || null,
          status: dto.status,
        },
        select: {
          id: true,
          code: true,
          nameArabic: true,
          phone: true,
          status: true,
          validFrom: true,
          validUntil: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد شخص مصرح له بنفس رقم الهوية');
      }
      throw error;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'authorized_pickup.update',
      entityType: 'AuthorizedPickup',
      entityId: pickup.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return pickup;
  }

  async linkStudent(
    user: RequestUser,
    pickupId: string,
    dto: LinkAuthorizedPickupStudentDto,
    ipAddress?: string,
  ) {
    await this.requirePickup(user, pickupId);
    await this.studentAccess.requireStudent(user, dto.studentId);
    await this.prisma.authorizedPickupStudent.upsert({
      where: {
        authorizedPickupId_studentId: {
          authorizedPickupId: pickupId,
          studentId: dto.studentId,
        },
      },
      update: { isActive: true, notes: dto.notes?.trim() || null },
      create: {
        authorizedPickupId: pickupId,
        studentId: dto.studentId,
        notes: dto.notes?.trim() || null,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'authorized_pickup.student.link',
      entityType: 'AuthorizedPickupStudent',
      entityId: `${pickupId}:${dto.studentId}`,
      ipAddress,
    });
    return { pickupId, studentId: dto.studentId, isActive: true };
  }

  async unlinkStudent(
    user: RequestUser,
    pickupId: string,
    studentId: string,
    ipAddress?: string,
  ) {
    await this.requirePickup(user, pickupId);
    await this.studentAccess.requireStudent(user, studentId);
    const result = await this.prisma.authorizedPickupStudent.updateMany({
      where: { authorizedPickupId: pickupId, studentId, isActive: true },
      data: { isActive: false },
    });
    if (!result.count) throw new NotFoundException('تصريح الاستلام للطالب غير موجود');
    await this.audit.record({
      actorId: user.id,
      action: 'authorized_pickup.student.unlink',
      entityType: 'AuthorizedPickupStudent',
      entityId: `${pickupId}:${studentId}`,
      ipAddress,
    });
    return { pickupId, studentId, isActive: false };
  }

  async updatePhoto(
    user: RequestUser,
    pickupId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    ipAddress?: string,
  ) {
    await this.requirePickup(user, pickupId);
    const asset = await this.assets.storePhoto(user, file);
    await this.prisma.authorizedPickup.update({
      where: { id: pickupId },
      data: { profilePhotoAssetId: asset.id },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'authorized_pickup.photo.update',
      entityType: 'AuthorizedPickup',
      entityId: pickupId,
      metadata: { assetId: asset.id },
      ipAddress,
    });
    return asset;
  }

  async photo(user: RequestUser, pickupId: string) {
    const pickup = await this.requirePickup(user, pickupId);
    if (!pickup.profilePhotoAssetId) throw new NotFoundException('لم يتم رفع صورة للمصرح له');
    return this.assets.readPhoto(user, pickup.profilePhotoAssetId);
  }

  private async requirePickup(user: RequestUser, pickupId: string) {
    const pickup = await this.prisma.authorizedPickup.findFirst({
      where: {
        id: pickupId,
        organizationId: user.organizationId,
        ...(user.isOwner
          ? {}
          : {
              students: {
                some: { isActive: true, student: { branchId: { in: user.branchIds } } },
              },
            }),
      },
      select: { id: true, profilePhotoAssetId: true, validFrom: true, validUntil: true },
    });
    if (!pickup) throw new NotFoundException('الشخص المصرح له غير موجود');
    return pickup;
  }

  private relationshipText(relationship: string, customRelationship?: string) {
    if (relationship === 'OTHER' && !customRelationship?.trim()) {
      throw new BadRequestException('اكتب صلة القرابة عند اختيار أخرى');
    }
    return relationship === 'OTHER' ? customRelationship!.trim() : null;
  }
}
