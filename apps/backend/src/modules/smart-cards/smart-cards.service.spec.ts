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
