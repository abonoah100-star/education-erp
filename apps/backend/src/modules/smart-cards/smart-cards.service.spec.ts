import type { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import type { PrismaService } from '../../core/prisma/prisma.service';
import type { CardRendererService } from './card-renderer.service';
import type { CardSigningService } from './card-signing.service';
import { SmartCardsService } from './smart-cards.service';

describe('SmartCardsService security contracts', () => {
  it('never selects or returns secretHash in card listings', async () => {
    const safeCard = {
      id: 'card-id',
      branchId: 'branch-id',
      templateId: 'template-id',
      batchId: null,
      cardType: 'STUDENT',
      subjectId: 'STU-0001',
      ownerName: 'طالب تجريبي',
      publicCode: 'EDU-STU-0001',
      codeFormat: 'QR_AND_BARCODE',
      barcodeType: 'CODE128',
      status: 'ACTIVE',
      replacesCardId: null,
      expiresAt: null,
      assignedAt: new Date(),
      activatedAt: new Date(),
      printedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branch: { id: 'branch-id', name: 'الفرع الرئيسي', code: 'MAIN' },
      template: {
        id: 'template-id',
        name: 'الطالب — الزمرد',
        code: 'STUDENT-EMERALD',
        backgroundColor: '#0F4B3B',
        accentColor: '#D9B56D',
        textColor: '#FFFFFF',
        mutedTextColor: '#DCEAE5',
      },
      batch: null,
    };
    const findMany = jest.fn().mockResolvedValue([safeCard]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      qrCard: { findMany, count },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    } as unknown as PrismaService;
    const service = new SmartCardsService(
      prisma,
      { record: jest.fn() } as unknown as AuditService,
      {} as CardSigningService,
      {} as CardRendererService,
    );
    const user: RequestUser = {
      id: 'user-id',
      email: 'admin@edu.local',
      organizationId: 'organization-id',
      branchIds: ['branch-id'],
      permissions: ['smart_cards.view'],
      roleCodes: ['OWNER'],
      isOwner: true,
    };

    const result = await service.cards(user, {});

    expect(JSON.stringify(result)).not.toContain('secretHash');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ secretHash: true }),
      }),
    );
  });
});

describe('SmartCardsService sequential identifiers', () => {
  it('increments database-backed card and subject sequences atomically', async () => {
    const createdCard = {
      id: 'card-id',
      branchId: 'branch-id',
      templateId: 'template-id',
      batchId: null,
      cardType: 'STUDENT',
      subjectId: 'STU-000007',
      ownerName: 'طالب جديد',
      portraitAssetId: null,
      publicCode: 'EDU-STU-000042',
      codeFormat: 'QR_AND_BARCODE',
      barcodeType: 'CODE128',
      status: 'ACTIVE',
      replacesCardId: null,
      expiresAt: null,
      assignedAt: new Date(),
      activatedAt: new Date(),
      printedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branch: { id: 'branch-id', name: 'الفرع الرئيسي', code: 'MAIN' },
      template: {
        id: 'template-id',
        name: 'تصميم الطالب',
        code: 'STUDENT-EMERALD',
        backgroundColor: '#0F4B3B',
        accentColor: '#D9B56D',
        textColor: '#FFFFFF',
        mutedTextColor: '#DCEAE5',
      },
      batch: null,
    };
    const transaction = {
      cardSequence: {
        upsert: jest.fn().mockResolvedValue({ lastCardNumber: 42, lastSubjectNumber: 7 }),
      },
      qrCard: { create: jest.fn().mockResolvedValue(createdCard) },
      cardEvent: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-id' }) },
      cardTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-id',
          cardType: 'STUDENT',
          defaultCodeFormat: 'QR_AND_BARCODE',
          defaultBarcodeType: 'CODE128',
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)),
    } as unknown as PrismaService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const signer = { fingerprint: jest.fn().mockReturnValue('fingerprint') } as unknown as CardSigningService;
    const service = new SmartCardsService(
      prisma,
      audit,
      signer,
      {} as CardRendererService,
    );
    const user: RequestUser = {
      id: 'user-id',
      email: 'admin@edu.local',
      organizationId: 'organization-id',
      branchIds: ['branch-id'],
      permissions: ['smart_cards.issue'],
      roleCodes: ['OWNER'],
      isOwner: true,
    };

    await service.issueCard(user, {
      cardType: 'STUDENT',
      branchId: 'branch-id',
      templateId: 'template-id',
      ownerName: 'طالب جديد',
    });

    expect(transaction.cardSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          lastCardNumber: { increment: 1 },
          lastSubjectNumber: { increment: 1 },
        },
      }),
    );
    expect(transaction.qrCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicCode: 'EDU-STU-000042',
          subjectId: 'STU-000007',
        }),
      }),
    );
  });
});
