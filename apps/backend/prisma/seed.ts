import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const permissionRows = [
  ['dashboard.view', 'عرض مساحة التشغيل', 'dashboard'],
  ['branches.view', 'عرض الفروع', 'branches'],
  ['branches.manage', 'إدارة الفروع', 'branches'],
  ['cashboxes.view', 'عرض الخزائن', 'finance'],
  ['cashboxes.manage', 'إدارة إعدادات الخزائن', 'finance'],
  ['users.view', 'عرض المستخدمين', 'access'],
  ['users.manage', 'إدارة المستخدمين', 'access'],
  ['roles.view', 'عرض الأدوار والصلاحيات', 'access'],
  ['roles.manage', 'إدارة الأدوار والصلاحيات', 'access'],
  ['audit.view', 'عرض سجل المراجعة', 'audit'],
  ['qr.view', 'عرض بطاقات QR', 'attendance'],
  ['qr.manage', 'إصدار وإيقاف بطاقات QR', 'attendance'],
] as const;

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { code: 'EDUCORE' },
    update: { name: 'EduCore Learning Center' },
    create: { name: 'EduCore Learning Center', code: 'EDUCORE' },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'MAIN' } },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'الفرع الرئيسي — مدينة نصر',
      code: 'MAIN',
      address: 'مدينة نصر، القاهرة',
    },
  });
  const helioBranch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'HELIO' } },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'فرع مصر الجديدة',
      code: 'HELIO',
      address: 'مصر الجديدة، القاهرة',
    },
  });

  await prisma.cashbox.upsert({
    where: { branchId_code: { branchId: mainBranch.id, code: 'MAIN-CASH' } },
    update: {},
    create: {
      branchId: mainBranch.id,
      name: 'الخزينة الرئيسية',
      code: 'MAIN-CASH',
      balance: 15000,
    },
  });
  await prisma.cashbox.upsert({
    where: { branchId_code: { branchId: helioBranch.id, code: 'HELIO-CASH' } },
    update: {},
    create: {
      branchId: helioBranch.id,
      name: 'خزينة الفرع',
      code: 'HELIO-CASH',
      balance: 8000,
    },
  });

  const permissions = [];
  for (const [code, name, module] of permissionRows) {
    permissions.push(
      await prisma.permission.upsert({
        where: { code },
        update: { name, module },
        create: { code, name, module },
      }),
    );
  }

  const ownerRole = await prisma.role.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'OWNER' } },
    update: { name: 'مالك النظام', isSystem: true },
    create: {
      organizationId: organization.id,
      name: 'مالك النظام',
      code: 'OWNER',
      isSystem: true,
    },
  });
  const managerRole = await prisma.role.upsert({
    where: {
      organizationId_code: { organizationId: organization.id, code: 'BRANCH_MANAGER' },
    },
    update: { name: 'مدير فرع', isSystem: true },
    create: {
      organizationId: organization.id,
      name: 'مدير فرع',
      code: 'BRANCH_MANAGER',
      isSystem: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
  const managerCodes = new Set([
    'dashboard.view',
    'branches.view',
    'cashboxes.view',
    'users.view',
    'roles.view',
    'qr.view',
  ]);
  await prisma.rolePermission.createMany({
    data: permissions
      .filter((permission) => managerCodes.has(permission.code))
      .map((permission) => ({ roleId: managerRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const passwordHash = await hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edu.local' },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'مدير النظام',
      email: 'admin@edu.local',
      passwordHash,
    },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@edu.local' },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'مدير الفرع الرئيسي',
      email: 'manager@edu.local',
      passwordHash,
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: admin.id, roleId: ownerRole.id },
      { userId: manager.id, roleId: managerRole.id },
    ],
    skipDuplicates: true,
  });
  await prisma.userBranch.createMany({
    data: [
      { userId: admin.id, branchId: mainBranch.id },
      { userId: admin.id, branchId: helioBranch.id },
      { userId: manager.id, branchId: mainBranch.id },
    ],
    skipDuplicates: true,
  });

  await prisma.qrCard.upsert({
    where: { publicCode: 'QR-DEMO-0001' },
    update: {},
    create: {
      organizationId: organization.id,
      cardType: 'STUDENT',
      subjectId: 'STU-0001',
      publicCode: 'QR-DEMO-0001',
      secretHash: await hash('QR-DEMO-0001:STU-0001', 12),
    },
  });
}

void main().finally(async () => prisma.$disconnect());
