import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normalizePersonName } from './domain/profile-code';
import type { DuplicateStudentQueryDto, StudentListQueryDto } from './dto/student.dto';
import { StudentAccessService } from './student-access.service';
import {
  serializeStudentSummary,
  studentSummarySelect,
  type StudentSummary,
} from './student-selects';

@Injectable()
export class StudentsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentAccessService,
  ) {}

  async list(user: RequestUser, query: StudentListQueryDto) {
    if (query.branchId) await this.access.assertBranchAccess(user, query.branchId);
    const where = this.studentWhere(user, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: studentSummarySelect,
        orderBy: [{ registeredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items: items.map(serializeStudentSummary),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async details(user: RequestUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...this.access.scope(user) },
      select: {
        ...studentSummarySelect,
        address: true,
        healthNotes: true,
        adminNotes: true,
        referralSource: true,
        createdAt: true,
        updatedAt: true,
        guardians: {
          orderBy: [{ isActive: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
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
            createdAt: true,
            guardian: {
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
              },
            },
          },
        },
        authorizedPickups: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            isActive: true,
            notes: true,
            authorizedPickup: {
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
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            title: true,
            fileName: true,
            mimeType: true,
            byteSize: true,
            expiresAt: true,
            isSensitive: true,
            createdAt: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            category: true,
            content: true,
            isSensitive: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            changedAt: true,
            changedBy: { select: { id: true, name: true } },
          },
        },
        cards: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            publicCode: true,
            subjectId: true,
            status: true,
            cardType: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });
    if (!student) throw new NotFoundException('ملف الطالب غير موجود');

    const canSeeSensitiveNotes = user.permissions.includes('students.manage_notes');
    const canSeeSensitiveDocuments = user.permissions.includes('students.manage_documents');
    return {
      ...student,
      primaryGuardian: student.guardians.find((link) => link.isActive && link.isPrimary)?.guardian ?? null,
      guardiansCount: student._count.guardians,
      authorizedPickupsCount: student._count.authorizedPickups,
      documentsCount: student._count.documents,
      cardsCount: student._count.cards,
      documents: student.documents.filter(
        (document) => !document.isSensitive || canSeeSensitiveDocuments,
      ),
      notes: student.notes.filter((note) => !note.isSensitive || canSeeSensitiveNotes),
      _count: undefined,
    };
  }

  async duplicateCandidates(user: RequestUser, query: DuplicateStudentQueryDto) {
    if (!query.nameArabic && !query.birthDate && !query.nationalId && !query.phone) {
      throw new BadRequestException('أدخل معيارًا واحدًا على الأقل للبحث عن التكرار');
    }

    const normalizedName = query.nameArabic ? normalizePersonName(query.nameArabic) : undefined;
    const birthDate = query.birthDate ? new Date(query.birthDate) : undefined;
    const candidates = await this.prisma.student.findMany({
      where: {
        ...this.access.scope(user),
        OR: [
          ...(query.nationalId ? [{ nationalId: query.nationalId.trim() }] : []),
          ...(query.phone
            ? [
                { phone: query.phone.trim() },
                { whatsappPhone: query.phone.trim() },
                {
                  guardians: {
                    some: {
                      isActive: true,
                      guardian: {
                        OR: [
                          { primaryPhone: query.phone.trim() },
                          { whatsappPhone: query.phone.trim() },
                        ],
                      },
                    },
                  },
                },
              ]
            : []),
          ...(normalizedName
            ? [{ normalizedName: { contains: normalizedName, mode: 'insensitive' as const } }]
            : []),
          ...(birthDate ? [{ birthDate }] : []),
        ],
      },
      select: studentSummarySelect,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: candidates
        .map((student) => this.scoreDuplicate(student, query, normalizedName, birthDate))
        .sort((a, b) => b.score - a.score),
    };
  }

  private scoreDuplicate(
    student: StudentSummary,
    query: DuplicateStudentQueryDto,
    normalizedName?: string,
    birthDate?: Date,
  ) {
    const reasons: string[] = [];
    let score = 0;
    if (query.nationalId && query.nationalId.trim() === student.nationalId) {
      reasons.push('رقم الهوية مطابق');
      score += 100;
    }
    if (normalizedName && normalizePersonName(student.nameArabic) === normalizedName) {
      reasons.push('الاسم مطابق');
      score += 40;
    }
    if (birthDate && student.birthDate?.getTime() === birthDate.getTime()) {
      reasons.push('تاريخ الميلاد مطابق');
      score += 30;
    }
    if (query.phone && [student.phone, student.whatsappPhone].includes(query.phone.trim())) {
      reasons.push('هاتف الطالب مطابق');
      score += 40;
    }
    if (
      query.phone &&
      student.guardians.some((link) =>
        [link.guardian.primaryPhone, link.guardian.whatsappPhone].includes(query.phone!.trim()),
      )
    ) {
      reasons.push('هاتف ولي الأمر مطابق');
      score += 35;
    }
    return { ...serializeStudentSummary(student), score, reasons };
  }

  private studentWhere(user: RequestUser, query: StudentListQueryDto): Prisma.StudentWhereInput {
    const search = query.search?.trim();
    let normalizedSearch: string | undefined;
    if (search) {
      try {
        normalizedSearch = normalizePersonName(search);
      } catch {
        normalizedSearch = undefined;
      }
    }
    return {
      ...this.access.scope(user),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.schoolName
        ? { schoolName: { contains: query.schoolName.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.gradeLevel
        ? { gradeLevel: { contains: query.gradeLevel.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              ...(normalizedSearch
                ? [{ normalizedName: { contains: normalizedSearch, mode: 'insensitive' as const } }]
                : []),
              { nameEnglish: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { whatsappPhone: { contains: search } },
              { nationalId: { contains: search } },
              {
                guardians: {
                  some: {
                    isActive: true,
                    guardian: {
                      OR: [
                        { primaryPhone: { contains: search } },
                        { whatsappPhone: { contains: search } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }
}
