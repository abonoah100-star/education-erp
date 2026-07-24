import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toPrismaBytes } from '../smart-cards/prisma-bytes';
import type { CreateStudentNoteDto, UploadStudentDocumentDto } from './dto/student-content.dto';
import { PersonAssetsService } from './person-assets.service';
import { isUniqueConstraintViolation } from './prisma-errors';
import { StudentAccessService } from './student-access.service';

@Injectable()
export class StudentContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assets: PersonAssetsService,
    private readonly access: StudentAccessService,
  ) {}

  async updatePhoto(
    user: RequestUser,
    studentId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    ipAddress?: string,
  ) {
    await this.access.requireStudent(user, studentId);
    const asset = await this.assets.storePhoto(user, file);
    await this.prisma.student.update({
      where: { id: studentId },
      data: { profilePhotoAssetId: asset.id },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'student.photo.update',
      entityType: 'Student',
      entityId: studentId,
      metadata: { assetId: asset.id },
      ipAddress,
    });
    return asset;
  }

  async photo(user: RequestUser, studentId: string) {
    const student = await this.access.requireStudent(user, studentId);
    if (!student.profilePhotoAssetId) throw new NotFoundException('لم يتم رفع صورة للطالب');
    return this.assets.readPhoto(user, student.profilePhotoAssetId);
  }

  async documents(user: RequestUser, studentId: string) {
    await this.access.requireStudent(user, studentId);
    return this.prisma.studentDocument.findMany({
      where: {
        studentId,
        ...(user.permissions.includes('students.manage_documents') ? {} : { isSensitive: false }),
      },
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
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  async uploadDocument(
    user: RequestUser,
    studentId: string,
    dto: UploadStudentDocumentDto,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    ipAddress?: string,
  ) {
    await this.access.requireStudent(user, studentId);
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException('صيغة المستند غير مدعومة');
    }
    if (file.size > 12_000_000) {
      throw new BadRequestException('حجم المستند يجب ألا يتجاوز 12 ميجابايت');
    }
    const bytes = toPrismaBytes(file.buffer);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    try {
      const document = await this.prisma.studentDocument.create({
        data: {
          studentId,
          documentType: dto.documentType,
          title: dto.title.trim(),
          fileName: file.originalname.slice(0, 240),
          mimeType: file.mimetype,
          byteSize: bytes.byteLength,
          sha256,
          content: bytes,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          isSensitive: dto.isSensitive ?? false,
          uploadedById: user.id,
        },
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
      });
      await this.audit.record({
        actorId: user.id,
        action: 'student.document.upload',
        entityType: 'StudentDocument',
        entityId: document.id,
        metadata: { studentId, documentType: dto.documentType, byteSize: document.byteSize },
        ipAddress,
      });
      return document;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictException('هذا المستند مرفوع للطالب بالفعل');
      throw error;
    }
  }

  async documentContent(user: RequestUser, studentId: string, documentId: string) {
    await this.access.requireStudent(user, studentId);
    const document = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, studentId },
      select: { fileName: true, mimeType: true, content: true, isSensitive: true },
    });
    if (!document) throw new NotFoundException('المستند غير موجود');
    if (document.isSensitive && !user.permissions.includes('students.manage_documents')) {
      throw new NotFoundException('المستند غير موجود');
    }
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      buffer: Buffer.from(document.content),
    };
  }

  async notes(user: RequestUser, studentId: string) {
    await this.access.requireStudent(user, studentId);
    const items = await this.prisma.studentNote.findMany({
      where: {
        studentId,
        ...(user.permissions.includes('students.manage_notes') ? {} : { isSensitive: false }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        content: true,
        isSensitive: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    return { items, total: items.length };
  }

  async createNote(
    user: RequestUser,
    studentId: string,
    dto: CreateStudentNoteDto,
    ipAddress?: string,
  ) {
    await this.access.requireStudent(user, studentId);
    const note = await this.prisma.studentNote.create({
      data: {
        studentId,
        category: dto.category ?? 'GENERAL',
        content: dto.content.trim(),
        isSensitive: dto.isSensitive ?? false,
        createdById: user.id,
      },
      select: {
        id: true,
        category: true,
        content: true,
        isSensitive: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'student.note.create',
      entityType: 'StudentNote',
      entityId: note.id,
      metadata: { studentId, category: note.category, isSensitive: note.isSensitive },
      ipAddress,
    });
    return note;
  }

}
