import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GuardianStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normalizePersonName } from './domain/profile-code';
import type {
  CreateGuardianDto,
  EndStudentGuardianLinkDto,
  GuardianListQueryDto,
  LinkGuardianToStudentDto,
  UpdateGuardianDto,
  UpdateStudentGuardianLinkDto,
} from './dto/guardian.dto';
import { PersonAssetsService } from './person-assets.service';
import { ProfileSequenceService } from './profile-sequence.service';
import { isUniqueConstraintViolation } from './prisma-errors';
import { StudentAccessService } from './student-access.service';
import { StudentsQueryService } from './students-query.service';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: ProfileSequenceService,
    private readonly assets: PersonAssetsService,
    private readonly studentAccess: StudentAccessService,
    private readonly studentQueries: StudentsQueryService,
  ) {}

  async list(user: RequestUser, query: GuardianListQueryDto) {
    const search = query.search?.trim();
    let normalizedSearch: string | undefined;
    if (search) {
      try {
        normalizedSearch = normalizePersonName(search);
      } catch {
        normalizedSearch = undefined;
      }
    }
    const where: Prisma.GuardianWhereInput = {
      organizationId: user.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(user.isOwner
        ? {}
        : {
            students: {
              some: {
                isActive: true,
                student: { branchId: { in: user.branchIds } },
              },
            },
          }),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              ...(normalizedSearch
                ? [{ normalizedName: { contains: normalizedSearch, mode: 'insensitive' as const } }]
                : []),
              { nameEnglish: { contains: search, mode: 'insensitive' } },
              { nationalId: { contains: search } },
              { primaryPhone: { contains: search } },
              { whatsappPhone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.guardian.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          nameArabic: true,
          nameEnglish: true,
          primaryPhone: true,
          whatsappPhone: true,
          email: true,
          status: true,
          profilePhotoAssetId: true,
          createdAt: true,
          students: {
            where: {
              isActive: true,
              ...(user.isOwner ? {} : { student: { branchId: { in: user.branchIds } } }),
            },
            select: {
              relationship: true,
              isPrimary: true,
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
      this.prisma.guardian.count({ where }),
    ]);
    return {
      items: items.map((guardian) => ({
        ...guardian,
        studentsCount: guardian.students.length,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async details(user: RequestUser, guardianId: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        id: guardianId,
        organizationId: user.organizationId,
        ...(user.isOwner
          ? {}
          : {
              students: {
                some: { isActive: true, student: { branchId: { in: user.branchIds } } },
              },
            }),
      },
      select: {
        id: true,
        code: true,
        nameArabic: true,
        nameEnglish: true,
        nationalId: true,
        primaryPhone: true,
        whatsappPhone: true,
        email: true,
        address: true,
        status: true,
        profilePhotoAssetId: true,
        createdAt: true,
        updatedAt: true,
        students: {
          where: user.isOwner ? {} : { student: { branchId: { in: user.branchIds } } },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
          select: {
            relationship: true,
            customRelationship: true,
            isPrimary: true,
            isFinancialResponsible: true,
            receivesNotifications: true,
            canPickup: true,
            isActive: true,
            endedAt: true,
            endReason: true,
            student: {
              select: {
                id: true,
                code: true,
                nameArabic: true,
                status: true,
                branch: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        cards: {
          where: user.isOwner ? {} : { branchId: { in: user.branchIds } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, publicCode: true, subjectId: true, status: true, createdAt: true },
        },
      },
    });
    if (!guardian) throw new NotFoundException('ملف ولي الأمر غير موجود');
    return guardian;
  }

  async create(user: RequestUser, dto: CreateGuardianDto, ipAddress?: string) {
    let guardian: {
      id: string;
      code: string;
      nameArabic: string;
      primaryPhone: string;
      status: GuardianStatus;
      createdAt: Date;
    };
    try {
      guardian = await this.prisma.$transaction(async (transaction) => {
        const sequence = await this.sequences.next(transaction, user.organizationId, 'GUARDIAN');
        return transaction.guardian.create({
          data: {
            organizationId: user.organizationId,
            code: sequence.code,
            sequenceNumber: sequence.sequenceNumber,
            nameArabic: dto.nameArabic.trim(),
            normalizedName: normalizePersonName(dto.nameArabic),
            nameEnglish: this.optionalText(dto.nameEnglish),
            nationalId: this.optionalText(dto.nationalId),
            primaryPhone: dto.primaryPhone.trim(),
            whatsappPhone: this.optionalText(dto.whatsappPhone),
            email: dto.email?.trim().toLowerCase() || null,
            address: this.optionalText(dto.address),
          },
          select: {
            id: true,
            code: true,
            nameArabic: true,
            primaryPhone: true,
            status: true,
            createdAt: true,
          },
        });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد ولي أمر بنفس رقم الهوية أو الكود');
      }
      throw error;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.create',
      entityType: 'Guardian',
      entityId: guardian.id,
      metadata: { code: guardian.code },
      ipAddress,
    });
    return guardian;
  }

  async update(user: RequestUser, guardianId: string, dto: UpdateGuardianDto, ipAddress?: string) {
    await this.requireGuardian(user, guardianId, false);
    let guardian: {
      id: string;
      code: string;
      nameArabic: string;
      primaryPhone: string;
      status: GuardianStatus;
      updatedAt: Date;
    };
    try {
      guardian = await this.prisma.guardian.update({
        where: { id: guardianId },
        data: {
          nameArabic: dto.nameArabic?.trim(),
          normalizedName: dto.nameArabic ? normalizePersonName(dto.nameArabic) : undefined,
          nameEnglish: dto.nameEnglish === undefined ? undefined : this.optionalText(dto.nameEnglish),
          nationalId: dto.nationalId === undefined ? undefined : this.optionalText(dto.nationalId),
          primaryPhone: dto.primaryPhone?.trim(),
          whatsappPhone:
            dto.whatsappPhone === undefined ? undefined : this.optionalText(dto.whatsappPhone),
          email: dto.email === undefined ? undefined : dto.email.trim().toLowerCase() || null,
          address: dto.address === undefined ? undefined : this.optionalText(dto.address),
          status: dto.status,
        },
        select: {
          id: true,
          code: true,
          nameArabic: true,
          primaryPhone: true,
          status: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد ولي أمر بنفس رقم الهوية');
      }
      throw error;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.update',
      entityType: 'Guardian',
      entityId: guardian.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return guardian;
  }

  async updatePhoto(
    user: RequestUser,
    guardianId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    ipAddress?: string,
  ) {
    await this.requireGuardian(user, guardianId, false);
    const asset = await this.assets.storePhoto(user, file);
    await this.prisma.guardian.update({
      where: { id: guardianId },
      data: { profilePhotoAssetId: asset.id },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.photo.update',
      entityType: 'Guardian',
      entityId: guardianId,
      metadata: { assetId: asset.id },
      ipAddress,
    });
    return asset;
  }

  async photo(user: RequestUser, guardianId: string) {
    const guardian = await this.requireGuardian(user, guardianId, false);
    if (!guardian.profilePhotoAssetId) throw new NotFoundException('لم يتم رفع صورة لولي الأمر');
    return this.assets.readPhoto(user, guardian.profilePhotoAssetId);
  }

  async linkStudent(
    user: RequestUser,
    studentId: string,
    dto: LinkGuardianToStudentDto,
    ipAddress?: string,
  ) {
    await this.studentAccess.requireStudent(user, studentId);
    await this.requireGuardian(user, dto.guardianId, true);
    const customRelationship = this.relationshipText(dto.relationship, dto.customRelationship);

    await this.prisma.$transaction(async (transaction) => {
      if (dto.isPrimary) {
        await transaction.studentGuardian.updateMany({
          where: { studentId, isActive: true, isPrimary: true, guardianId: { not: dto.guardianId } },
          data: { isPrimary: false },
        });
      }
      if (dto.isFinancialResponsible) {
        await transaction.studentGuardian.updateMany({
          where: {
            studentId,
            isActive: true,
            isFinancialResponsible: true,
            guardianId: { not: dto.guardianId },
          },
          data: { isFinancialResponsible: false },
        });
      }
      await transaction.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId, guardianId: dto.guardianId } },
        update: {
          relationship: dto.relationship,
          customRelationship,
          isPrimary: dto.isPrimary ?? false,
          isFinancialResponsible: dto.isFinancialResponsible ?? false,
          receivesNotifications: dto.receivesNotifications ?? true,
          canPickup: dto.canPickup ?? true,
          isActive: true,
          endedAt: null,
          endReason: null,
        },
        create: {
          studentId,
          guardianId: dto.guardianId,
          relationship: dto.relationship,
          customRelationship,
          isPrimary: dto.isPrimary ?? false,
          isFinancialResponsible: dto.isFinancialResponsible ?? false,
          receivesNotifications: dto.receivesNotifications ?? true,
          canPickup: dto.canPickup ?? true,
        },
      });
    });
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.student.link',
      entityType: 'StudentGuardian',
      entityId: `${studentId}:${dto.guardianId}`,
      metadata: { relationship: dto.relationship },
      ipAddress,
    });
    return this.studentQueries.details(user, studentId);
  }

  async updateStudentLink(
    user: RequestUser,
    studentId: string,
    guardianId: string,
    dto: UpdateStudentGuardianLinkDto,
    ipAddress?: string,
  ) {
    await this.studentAccess.requireStudent(user, studentId);
    const existing = await this.prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
    });
    if (!existing?.isActive) throw new NotFoundException('علاقة ولي الأمر بالطالب غير موجودة');
    const relationship = dto.relationship ?? existing.relationship;
    const customRelationship = this.relationshipText(
      relationship,
      dto.customRelationship ?? existing.customRelationship ?? undefined,
    );
    await this.prisma.$transaction(async (transaction) => {
      if (dto.isPrimary) {
        await transaction.studentGuardian.updateMany({
          where: { studentId, isActive: true, isPrimary: true, guardianId: { not: guardianId } },
          data: { isPrimary: false },
        });
      }
      if (dto.isFinancialResponsible) {
        await transaction.studentGuardian.updateMany({
          where: {
            studentId,
            isActive: true,
            isFinancialResponsible: true,
            guardianId: { not: guardianId },
          },
          data: { isFinancialResponsible: false },
        });
      }
      await transaction.studentGuardian.update({
        where: { studentId_guardianId: { studentId, guardianId } },
        data: {
          relationship,
          customRelationship,
          isPrimary: dto.isPrimary,
          isFinancialResponsible: dto.isFinancialResponsible,
          receivesNotifications: dto.receivesNotifications,
          canPickup: dto.canPickup,
        },
      });
    });
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.student.link.update',
      entityType: 'StudentGuardian',
      entityId: `${studentId}:${guardianId}`,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return this.studentQueries.details(user, studentId);
  }

  async endStudentLink(
    user: RequestUser,
    studentId: string,
    guardianId: string,
    dto: EndStudentGuardianLinkDto,
    ipAddress?: string,
  ) {
    await this.studentAccess.requireStudent(user, studentId);
    const result = await this.prisma.studentGuardian.updateMany({
      where: { studentId, guardianId, isActive: true },
      data: {
        isActive: false,
        isPrimary: false,
        isFinancialResponsible: false,
        endedAt: new Date(),
        endReason: dto.reason.trim(),
      },
    });
    if (!result.count) throw new NotFoundException('علاقة ولي الأمر بالطالب غير موجودة');
    await this.audit.record({
      actorId: user.id,
      action: 'guardian.student.link.end',
      entityType: 'StudentGuardian',
      entityId: `${studentId}:${guardianId}`,
      metadata: { reason: dto.reason },
      ipAddress,
    });
    return this.studentQueries.details(user, studentId);
  }

  private async requireGuardian(user: RequestUser, guardianId: string, allowUnlinked: boolean) {
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        id: guardianId,
        organizationId: user.organizationId,
        ...(!user.isOwner && !allowUnlinked
          ? {
              students: {
                some: { isActive: true, student: { branchId: { in: user.branchIds } } },
              },
            }
          : !user.isOwner && allowUnlinked
            ? {
                OR: [
                  { students: { none: { isActive: true } } },
                  {
                    students: {
                      some: { isActive: true, student: { branchId: { in: user.branchIds } } },
                    },
                  },
                ],
              }
            : {}),
      },
      select: { id: true, organizationId: true, profilePhotoAssetId: true },
    });
    if (!guardian) throw new NotFoundException('ملف ولي الأمر غير موجود');
    return guardian;
  }

  private relationshipText(relationship: string, customRelationship?: string | null) {
    if (relationship === 'OTHER' && !customRelationship?.trim()) {
      throw new BadRequestException('اكتب صلة القرابة عند اختيار أخرى');
    }
    return relationship === 'OTHER' ? customRelationship!.trim() : null;
  }

  private optionalText(value?: string) {
    return value?.trim() || null;
  }
}
