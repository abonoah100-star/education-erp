import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normalizePersonName } from './domain/profile-code';
import { assertStudentStatusTransition } from './domain/student-status-policy';
import type {
  ChangeStudentStatusDto,
  CreateStudentDto,
  StudentGuardianLinkInputDto,
  TransferStudentBranchDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { ProfileSequenceService } from './profile-sequence.service';
import { isUniqueConstraintViolation } from './prisma-errors';
import { StudentAccessService } from './student-access.service';
import {
  serializeStudentSummary,
  studentSummarySelect,
  type StudentSummary,
} from './student-selects';
import { StudentsQueryService } from './students-query.service';

@Injectable()
export class StudentsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: ProfileSequenceService,
    private readonly access: StudentAccessService,
    private readonly queries: StudentsQueryService,
  ) {}

  async create(user: RequestUser, dto: CreateStudentDto, ipAddress?: string) {
    await this.access.assertBranchAccess(user, dto.branchId);
    if (dto.status && !['DRAFT', 'ACTIVE'].includes(dto.status)) {
      throw new BadRequestException('يمكن إنشاء الطالب كمسودة أو كطالب نشط فقط');
    }
    this.validateGuardianLinks(dto.guardianLinks ?? []);

    let result: StudentSummary;
    try {
      result = await this.prisma.$transaction(async (transaction) => {
        const sequence = await this.sequences.next(transaction, user.organizationId, 'STUDENT');
        if (dto.guardianLinks?.length) {
          await this.assertGuardiansExist(transaction, user.organizationId, dto.guardianLinks);
        }

        const student = await transaction.student.create({
          data: {
            organizationId: user.organizationId,
            branchId: dto.branchId,
            code: sequence.code,
            sequenceNumber: sequence.sequenceNumber,
            nameArabic: dto.nameArabic.trim(),
            normalizedName: normalizePersonName(dto.nameArabic),
            nameEnglish: this.optionalText(dto.nameEnglish),
            gender: dto.gender,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            nationalId: this.optionalText(dto.nationalId),
            schoolName: this.optionalText(dto.schoolName),
            gradeLevel: this.optionalText(dto.gradeLevel),
            phone: this.optionalText(dto.phone),
            whatsappPhone: this.optionalText(dto.whatsappPhone),
            address: this.optionalText(dto.address),
            healthNotes: this.optionalText(dto.healthNotes),
            adminNotes: this.optionalText(dto.adminNotes),
            referralSource: this.optionalText(dto.referralSource),
            status: dto.status ?? 'ACTIVE',
            guardians: dto.guardianLinks?.length
              ? {
                  create: dto.guardianLinks.map((link) => ({
                    guardianId: link.guardianId,
                    relationship: link.relationship,
                    customRelationship: this.relationshipText(
                      link.relationship,
                      link.customRelationship,
                    ),
                    isPrimary: link.isPrimary ?? false,
                    isFinancialResponsible: link.isFinancialResponsible ?? false,
                    receivesNotifications: link.receivesNotifications ?? true,
                    canPickup: link.canPickup ?? true,
                  })),
                }
              : undefined,
          },
          select: studentSummarySelect,
        });

        await transaction.studentStatusHistory.create({
          data: {
            studentId: student.id,
            fromStatus: null,
            toStatus: dto.status ?? 'ACTIVE',
            reason: 'إنشاء ملف الطالب',
            changedById: user.id,
          },
        });
        return student;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد ملف طالب بنفس رقم الهوية أو الكود');
      }
      throw error;
    }

    await this.audit.record({
      actorId: user.id,
      action: 'student.create',
      entityType: 'Student',
      entityId: result.id,
      metadata: { code: result.code, branchId: result.branchId },
      ipAddress,
    });
    return serializeStudentSummary(result);
  }

  async update(user: RequestUser, studentId: string, dto: UpdateStudentDto, ipAddress?: string) {
    const existing = await this.access.requireStudent(user, studentId);
    let student: StudentSummary;
    try {
      student = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.student.update({
          where: { id: existing.id },
          data: {
            nameArabic: dto.nameArabic?.trim(),
            normalizedName: dto.nameArabic ? normalizePersonName(dto.nameArabic) : undefined,
            nameEnglish:
              dto.nameEnglish === undefined ? undefined : this.optionalText(dto.nameEnglish),
            gender: dto.gender,
            birthDate: dto.birthDate === undefined ? undefined : new Date(dto.birthDate),
            nationalId:
              dto.nationalId === undefined ? undefined : this.optionalText(dto.nationalId),
            schoolName:
              dto.schoolName === undefined ? undefined : this.optionalText(dto.schoolName),
            gradeLevel:
              dto.gradeLevel === undefined ? undefined : this.optionalText(dto.gradeLevel),
            phone: dto.phone === undefined ? undefined : this.optionalText(dto.phone),
            whatsappPhone:
              dto.whatsappPhone === undefined ? undefined : this.optionalText(dto.whatsappPhone),
            address: dto.address === undefined ? undefined : this.optionalText(dto.address),
            healthNotes:
              dto.healthNotes === undefined ? undefined : this.optionalText(dto.healthNotes),
            adminNotes:
              dto.adminNotes === undefined ? undefined : this.optionalText(dto.adminNotes),
            referralSource:
              dto.referralSource === undefined ? undefined : this.optionalText(dto.referralSource),
          },
          select: studentSummarySelect,
        });
        if (dto.nameArabic) {
          await transaction.qrCard.updateMany({
            where: { studentId: existing.id, organizationId: user.organizationId },
            data: { ownerName: dto.nameArabic.trim() },
          });
        }
        return updated;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('يوجد ملف طالب بنفس رقم الهوية');
      }
      throw error;
    }
    await this.audit.record({
      actorId: user.id,
      action: 'student.update',
      entityType: 'Student',
      entityId: student.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress,
    });
    return serializeStudentSummary(student);
  }

  async changeStatus(
    user: RequestUser,
    studentId: string,
    dto: ChangeStudentStatusDto,
    ipAddress?: string,
  ) {
    const existing = await this.access.requireStudent(user, studentId);
    try {
      assertStudentStatusTransition(existing.status, dto.status);
    } catch {
      throw new ConflictException('الانتقال بين حالتي الطالب غير مسموح وفق دورة حياته');
    }
    if (existing.status === dto.status) return this.queries.details(user, studentId);

    await this.prisma.$transaction([
      this.prisma.student.update({ where: { id: studentId }, data: { status: dto.status } }),
      this.prisma.studentStatusHistory.create({
        data: {
          studentId,
          fromStatus: existing.status,
          toStatus: dto.status,
          reason: this.optionalText(dto.reason),
          changedById: user.id,
        },
      }),
    ]);
    await this.audit.record({
      actorId: user.id,
      action: 'student.status.change',
      entityType: 'Student',
      entityId: studentId,
      metadata: { from: existing.status, to: dto.status, reason: dto.reason ?? null },
      ipAddress,
    });
    return this.queries.details(user, studentId);
  }

  async transferBranch(
    user: RequestUser,
    studentId: string,
    dto: TransferStudentBranchDto,
    ipAddress?: string,
  ) {
    const existing = await this.access.requireStudent(user, studentId);
    await this.access.assertBranchAccess(user, dto.branchId);
    if (existing.branchId === dto.branchId) {
      throw new ConflictException('الطالب مسجل بالفعل في الفرع المحدد');
    }
    await this.prisma.$transaction([
      this.prisma.student.update({ where: { id: studentId }, data: { branchId: dto.branchId } }),
      this.prisma.qrCard.updateMany({
        where: { studentId, organizationId: user.organizationId },
        data: { branchId: dto.branchId },
      }),
    ]);
    await this.audit.record({
      actorId: user.id,
      action: 'student.branch.transfer',
      entityType: 'Student',
      entityId: studentId,
      metadata: { fromBranchId: existing.branchId, toBranchId: dto.branchId, reason: dto.reason },
      ipAddress,
    });
    return this.queries.details(user, studentId);
  }

  private validateGuardianLinks(links: StudentGuardianLinkInputDto[]) {
    const ids = new Set(links.map((link) => link.guardianId));
    if (ids.size !== links.length) throw new BadRequestException('لا يمكن تكرار ولي الأمر في نفس الطلب');
    if (links.filter((link) => link.isPrimary).length > 1) {
      throw new BadRequestException('يمكن تحديد ولي أمر رئيسي واحد فقط');
    }
    if (links.filter((link) => link.isFinancialResponsible).length > 1) {
      throw new BadRequestException('يمكن تحديد مسؤول مالي واحد فقط');
    }
    for (const link of links) this.relationshipText(link.relationship, link.customRelationship);
  }

  private async assertGuardiansExist(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    links: StudentGuardianLinkInputDto[],
  ) {
    const count = await transaction.guardian.count({
      where: { id: { in: links.map((link) => link.guardianId) }, organizationId },
    });
    if (count !== links.length) throw new BadRequestException('أحد أولياء الأمور غير موجود في المؤسسة');
  }

  private relationshipText(relationship: string, customRelationship?: string) {
    if (relationship === 'OTHER' && !customRelationship?.trim()) {
      throw new BadRequestException('اكتب صلة القرابة عند اختيار أخرى');
    }
    return relationship === 'OTHER' ? customRelationship!.trim() : null;
  }

  private optionalText(value?: string) {
    return value?.trim() || null;
  }

}
