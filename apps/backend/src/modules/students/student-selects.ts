import type { Prisma } from '@prisma/client';

export const studentSummarySelect = {
  id: true,
  branchId: true,
  code: true,
  nameArabic: true,
  normalizedName: true,
  nameEnglish: true,
  gender: true,
  birthDate: true,
  nationalId: true,
  schoolName: true,
  gradeLevel: true,
  phone: true,
  whatsappPhone: true,
  status: true,
  registeredAt: true,
  profilePhotoAssetId: true,
  branch: { select: { id: true, name: true, code: true } },
  guardians: {
    where: { isActive: true },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 1,
    select: {
      isPrimary: true,
      guardian: {
        select: {
          id: true,
          code: true,
          nameArabic: true,
          primaryPhone: true,
          whatsappPhone: true,
        },
      },
    },
  },
  _count: {
    select: {
      guardians: { where: { isActive: true } },
      authorizedPickups: { where: { isActive: true } },
      documents: true,
      cards: true,
    },
  },
} satisfies Prisma.StudentSelect;

export type StudentSummary = Prisma.StudentGetPayload<{ select: typeof studentSummarySelect }>;

export function serializeStudentSummary(student: StudentSummary) {
  return {
    id: student.id,
    branchId: student.branchId,
    code: student.code,
    nameArabic: student.nameArabic,
    nameEnglish: student.nameEnglish,
    gender: student.gender,
    birthDate: student.birthDate,
    schoolName: student.schoolName,
    gradeLevel: student.gradeLevel,
    phone: student.phone,
    whatsappPhone: student.whatsappPhone,
    status: student.status,
    registeredAt: student.registeredAt,
    profilePhotoAssetId: student.profilePhotoAssetId,
    branch: student.branch,
    primaryGuardian: student.guardians[0]?.guardian ?? null,
    guardiansCount: student._count.guardians,
    authorizedPickupsCount: student._count.authorizedPickups,
    documentsCount: student._count.documents,
    cardsCount: student._count.cards,
  };
}
