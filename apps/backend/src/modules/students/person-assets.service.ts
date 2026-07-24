import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { RequestUser } from '../../core/authz/request-user';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toPrismaBytes } from '../smart-cards/prisma-bytes';

@Injectable()
export class PersonAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async storePhoto(
    user: RequestUser,
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
    }

    let content: Buffer;
    try {
      content = await sharp(file.buffer)
        .rotate()
        .resize(640, 640, { fit: 'cover', position: 'attention' })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch {
      throw new BadRequestException('تعذر قراءة الصورة أو أن الملف غير صالح');
    }

    const storedContent = toPrismaBytes(content);
    const sha256 = createHash('sha256').update(storedContent).digest('hex');
    return this.prisma.personPhotoAsset.upsert({
      where: {
        organizationId_sha256: {
          organizationId: user.organizationId,
          sha256,
        },
      },
      update: {},
      create: {
        organizationId: user.organizationId,
        mimeType: 'image/png',
        byteSize: storedContent.byteLength,
        sha256,
        content: storedContent,
      },
      select: { id: true, mimeType: true, byteSize: true, createdAt: true },
    });
  }

  async readPhoto(user: RequestUser, assetId: string) {
    const asset = await this.prisma.personPhotoAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId },
      select: { mimeType: true, content: true },
    });
    if (!asset) throw new NotFoundException('الصورة غير موجودة');
    return { mimeType: asset.mimeType, buffer: Buffer.from(asset.content) };
  }
}
