import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class StudentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  scope(user: RequestUser): Prisma.StudentWhereInput {
    return {
      organizationId: user.organizationId,
      ...(user.isOwner ? {} : { branchId: { in: user.branchIds } }),
    };
  }

  async requireStudent(user: RequestUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...this.scope(user) },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        code: true,
        nameArabic: true,
        status: true,
        profilePhotoAssetId: true,
      },
    });
    if (!student) throw new NotFoundException('ملف الطالب غير موجود');
    return student;
  }

  async assertBranchAccess(user: RequestUser, branchId: string) {
    if (!user.isOwner && !user.branchIds.includes(branchId)) {
      throw new NotFoundException('الفرع غير موجود أو غير متاح للمستخدم');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: user.organizationId },
      select: { id: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');
    if (!branch.isActive) throw new ConflictException('لا يمكن التسجيل في فرع غير نشط');
    return branch;
  }
}
