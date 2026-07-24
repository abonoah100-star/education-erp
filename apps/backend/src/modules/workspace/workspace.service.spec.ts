import type { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import type { PrismaService } from '../../core/prisma/prisma.service';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService security contracts', () => {
  it('never returns a QR secret hash from the list endpoint', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'card-id',
        cardType: 'STUDENT',
        subjectId: 'STU-0001',
        publicCode: 'QR-DEMO-0001',
        isActive: true,
        expiresAt: null,
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
      },
    ]);
    const prisma = { qrCard: { findMany } } as unknown as PrismaService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new WorkspaceService(prisma, audit);
    const user: RequestUser = {
      id: 'user-id',
      email: 'admin@edu.local',
      organizationId: 'organization-id',
      branchIds: [],
      permissions: ['qr.view'],
      roleCodes: ['OWNER'],
      isOwner: true,
    };

    const result = await service.qrCards(user);

    expect(JSON.stringify(result)).not.toContain('secretHash');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ secretHash: true }),
      }),
    );
  });
});
