import type { AuditService } from '../../core/audit/audit.service';
import type { RequestUser } from '../../core/authz/request-user';
import type { PrismaService } from '../../core/prisma/prisma.service';
import { AccessService } from './access.service';

describe('AccessService security contracts', () => {
  it('returns users without password or refresh token hashes', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'user-id',
        name: 'مدير النظام',
        email: 'admin@edu.local',
        status: 'ACTIVE',
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        roleLinks: [],
        branchLinks: [],
      },
    ]);
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new AccessService(prisma, audit);
    const user: RequestUser = {
      id: 'owner-id',
      email: 'admin@edu.local',
      organizationId: 'organization-id',
      branchIds: [],
      permissions: ['users.view'],
      roleCodes: ['OWNER'],
      isOwner: true,
    };

    const result = await service.users(user);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshTokenHash');
  });
});
