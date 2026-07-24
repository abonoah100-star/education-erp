import { PrismaClient, type CardType } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash, createHmac } from 'node:crypto';

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
  ['settings.view', 'عرض إعدادات المؤسسة', 'settings'],
  ['settings.manage', 'إدارة إعدادات المؤسسة', 'settings'],
  ['students.view', 'عرض الطلاب', 'students'],
  ['students.create', 'تسجيل طالب جديد', 'students'],
  ['students.update', 'تعديل بيانات الطالب', 'students'],
  ['students.change_status', 'تغيير حالة الطالب', 'students'],
  ['students.change_branch', 'نقل الطالب بين الفروع', 'students'],
  ['students.export', 'تصدير بيانات الطلاب', 'students'],
  ['students.manage_documents', 'إدارة مستندات الطالب', 'students'],
  ['students.manage_notes', 'إدارة ملاحظات الطالب', 'students'],
  ['guardians.view', 'عرض أولياء الأمور', 'guardians'],
  ['guardians.create', 'إضافة ولي أمر', 'guardians'],
  ['guardians.update', 'تعديل بيانات ولي الأمر', 'guardians'],
  ['guardians.link_students', 'ربط ولي الأمر بالطلاب', 'guardians'],
  ['authorized_pickups.view', 'عرض المصرح لهم بالاستلام', 'authorized_pickups'],
  ['authorized_pickups.manage', 'إدارة المصرح لهم بالاستلام', 'authorized_pickups'],
  ['authorized_pickups.confirm_release', 'تأكيد استلام الطالب', 'authorized_pickups'],
  ['card_templates.view', 'عرض تصميمات الكروت', 'smart_cards'],
  ['card_templates.manage', 'إدارة تصميمات الكروت', 'smart_cards'],
  ['smart_cards.view', 'عرض الكروت الذكية', 'smart_cards'],
  ['smart_cards.issue', 'إصدار كارت جديد', 'smart_cards'],
  ['smart_cards.assign_existing', 'ربط كارت موجود بصاحب جديد', 'smart_cards'],
  ['smart_cards.manage_status', 'إدارة حالة الكارت', 'smart_cards'],
  ['smart_cards.replace', 'استبدال الكارت', 'smart_cards'],
  ['smart_cards.download_image', 'تنزيل ومشاركة صورة الكارت والرموز', 'smart_cards'],
  ['card_inventory.view', 'عرض مخزون الكروت', 'smart_cards'],
  ['card_inventory.manage', 'إنشاء دفعات الكروت', 'smart_cards'],
  ['card_print_jobs.view', 'عرض مهام الطباعة', 'smart_cards'],
  ['card_print_jobs.create', 'إنشاء مهام طباعة دفعية', 'smart_cards'],
  ['card_print_jobs.download', 'تنزيل صور الطباعة الدفعية', 'smart_cards'],
  ['card_print_jobs.mark_printed', 'اعتماد تنفيذ الطباعة', 'smart_cards'],
] as const;

const templateDefinitions: Array<{
  code: string;
  name: string;
  cardType: CardType;
  description: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  isDefault: boolean;
}> = [
  {
    code: 'STUDENT-EMERALD',
    name: 'الطالب — الزمرد الهادئ',
    cardType: 'STUDENT',
    description: 'تصميم رسمي أخضر للطلاب مع QR وCode 128.',
    backgroundColor: '#0F4B3B',
    accentColor: '#D9B56D',
    textColor: '#FFFFFF',
    mutedTextColor: '#DCEAE5',
    isDefault: true,
  },
  {
    code: 'STUDENT-NAVY',
    name: 'الطالب — الكحلي الأكاديمي',
    cardType: 'STUDENT',
    description: 'نسخة كحلية مميزة للدفعات والبرامج الخاصة.',
    backgroundColor: '#142B4A',
    accentColor: '#72C7B1',
    textColor: '#FFFFFF',
    mutedTextColor: '#D9E6F3',
    isDefault: false,
  },
  {
    code: 'GUARDIAN-SAND',
    name: 'ولي الأمر — الرملي الفاخر',
    cardType: 'GUARDIAN',
    description: 'تصميم دافئ وواضح لكروت أولياء الأمور والاستلام.',
    backgroundColor: '#5A3D2A',
    accentColor: '#E6C987',
    textColor: '#FFFDF7',
    mutedTextColor: '#F0E3CF',
    isDefault: true,
  },
  {
    code: 'TEACHER-SLATE',
    name: 'المدرس — Slate',
    cardType: 'TEACHER',
    description: 'تصميم مهني داكن للمدرسين وأعضاء الهيئة التعليمية.',
    backgroundColor: '#26343C',
    accentColor: '#63C2AE',
    textColor: '#FFFFFF',
    mutedTextColor: '#D3E0E4',
    isDefault: true,
  },
];

function cardFingerprint(publicCode: string): string {
  const secret = process.env.CARD_SIGNING_SECRET ?? 'staging-seed-signing-secret-change-before-production';
  const message = `v1.${publicCode}`;
  const signature = createHmac('sha256', secret).update(message).digest('base64url');
  const payload = `educore:v1:${publicCode}:${signature}`;
  return createHash('sha256').update(payload).digest('hex');
}

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { code: 'EDUCORE' },
    update: {},
    create: {
      name: 'EduCore Learning Center',
      systemName: 'EduCore ERP',
      cardSubtitle: 'منصة إدارة مركز تعليمي',
      cardBackTitle: 'هذه البطاقة ملك مركز EduCore التعليمي',
      cardBackInstruction: 'عند العثور عليها يرجى تسليمها إلى أقرب فرع',
      cardBackFooter: 'يرجى المحافظة على البطاقة وعدم مشاركتها مع الغير',
      code: 'EDUCORE',
    },
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

  await prisma.permission.deleteMany({ where: { code: { in: ['qr.view', 'qr.manage'] } } });

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
    where: { organizationId_code: { organizationId: organization.id, code: 'BRANCH_MANAGER' } },
    update: { name: 'مدير فرع', isSystem: true },
    create: {
      organizationId: organization.id,
      name: 'مدير فرع',
      code: 'BRANCH_MANAGER',
      isSystem: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: ownerRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });
  const managerCodes = new Set([
    'dashboard.view',
    'branches.view',
    'cashboxes.view',
    'users.view',
    'roles.view',
    'students.view',
    'students.create',
    'students.update',
    'students.change_status',
    'students.change_branch',
    'students.manage_documents',
    'students.manage_notes',
    'guardians.view',
    'guardians.create',
    'guardians.update',
    'guardians.link_students',
    'authorized_pickups.view',
    'authorized_pickups.manage',
    'authorized_pickups.confirm_release',
    'card_templates.view',
    'smart_cards.view',
    'smart_cards.issue',
    'smart_cards.assign_existing',
    'smart_cards.manage_status',
    'smart_cards.replace',
    'smart_cards.download_image',
    'card_inventory.view',
    'card_inventory.manage',
    'card_print_jobs.view',
    'card_print_jobs.create',
    'card_print_jobs.download',
    'card_print_jobs.mark_printed',
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

  const profileSequences = [
    { profileType: 'STUDENT' as const, lastNumber: 1 },
    { profileType: 'GUARDIAN' as const, lastNumber: 1 },
    { profileType: 'AUTHORIZED_PICKUP' as const, lastNumber: 1 },
  ];
  for (const sequence of profileSequences) {
    await prisma.profileSequence.upsert({
      where: {
        organizationId_profileType: {
          organizationId: organization.id,
          profileType: sequence.profileType,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        profileType: sequence.profileType,
        lastNumber: sequence.lastNumber,
      },
    });
  }

  const demoStudent = await prisma.student.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'STU-000001',
      },
    },
    update: {
      branchId: mainBranch.id,
      nameArabic: 'أحمد محمد علي',
      normalizedName: 'احمد محمد علي',
      schoolName: 'مدرسة المستقبل',
      gradeLevel: 'الصف الأول الإعدادي',
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      branchId: mainBranch.id,
      code: 'STU-000001',
      sequenceNumber: 1,
      nameArabic: 'أحمد محمد علي',
      normalizedName: 'احمد محمد علي',
      gender: 'MALE',
      schoolName: 'مدرسة المستقبل',
      gradeLevel: 'الصف الأول الإعدادي',
      status: 'ACTIVE',
    },
  });

  const demoGuardian = await prisma.guardian.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'GDN-000001',
      },
    },
    update: {
      nameArabic: 'محمد علي',
      normalizedName: 'محمد علي',
      primaryPhone: '01000000001',
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      code: 'GDN-000001',
      sequenceNumber: 1,
      nameArabic: 'محمد علي',
      normalizedName: 'محمد علي',
      primaryPhone: '01000000001',
      status: 'ACTIVE',
    },
  });

  await prisma.studentGuardian.upsert({
    where: {
      studentId_guardianId: {
        studentId: demoStudent.id,
        guardianId: demoGuardian.id,
      },
    },
    update: {
      relationship: 'FATHER',
      isPrimary: true,
      isFinancialResponsible: true,
      receivesNotifications: true,
      canPickup: true,
    },
    create: {
      studentId: demoStudent.id,
      guardianId: demoGuardian.id,
      relationship: 'FATHER',
      isPrimary: true,
      isFinancialResponsible: true,
      receivesNotifications: true,
      canPickup: true,
    },
  });

  const statusHistoryExists = await prisma.studentStatusHistory.findFirst({
    where: {
      studentId: demoStudent.id,
      fromStatus: null,
      toStatus: 'ACTIVE',
    },
    select: { id: true },
  });
  if (!statusHistoryExists) {
    await prisma.studentStatusHistory.create({
      data: {
        studentId: demoStudent.id,
        fromStatus: null,
        toStatus: 'ACTIVE',
        reason: 'بيانات تجريبية تأسيسية',
        changedById: admin.id,
      },
    });
  }

  const demoPickup = await prisma.authorizedPickup.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'PUP-000001',
      },
    },
    update: {
      guardianId: demoGuardian.id,
      nameArabic: 'محمد علي',
      normalizedName: 'محمد علي',
      relationship: 'FATHER',
      phone: '01000000001',
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      code: 'PUP-000001',
      sequenceNumber: 1,
      guardianId: demoGuardian.id,
      nameArabic: 'محمد علي',
      normalizedName: 'محمد علي',
      relationship: 'FATHER',
      phone: '01000000001',
      status: 'ACTIVE',
    },
  });

  await prisma.authorizedPickupStudent.upsert({
    where: {
      authorizedPickupId_studentId: {
        authorizedPickupId: demoPickup.id,
        studentId: demoStudent.id,
      },
    },
    update: { isActive: true },
    create: {
      authorizedPickupId: demoPickup.id,
      studentId: demoStudent.id,
      isActive: true,
    },
  });

  await Promise.all(
    profileSequences.map((sequence) =>
      prisma.profileSequence.updateMany({
        where: {
          organizationId: organization.id,
          profileType: sequence.profileType,
          lastNumber: { lt: sequence.lastNumber },
        },
        data: { lastNumber: sequence.lastNumber },
      }),
    ),
  );

  const templates = new Map<string, string>();
  for (const definition of templateDefinitions) {
    const template = await prisma.cardTemplate.upsert({
      where: {
        organizationId_code: { organizationId: organization.id, code: definition.code },
      },
      update: {
        name: definition.name,
        description: definition.description,
        backgroundColor: definition.backgroundColor,
        accentColor: definition.accentColor,
        textColor: definition.textColor,
        mutedTextColor: definition.mutedTextColor,
        isDefault: definition.isDefault,
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        name: definition.name,
        code: definition.code,
        cardType: definition.cardType,
        description: definition.description,
        backgroundColor: definition.backgroundColor,
        accentColor: definition.accentColor,
        textColor: definition.textColor,
        mutedTextColor: definition.mutedTextColor,
        isDefault: definition.isDefault,
        frontLayout: { renderer: 'educore-card-v1', side: 'front', cardSize: 'CR80' },
        backLayout: { renderer: 'educore-card-v1', side: 'back', cardSize: 'CR80' },
      },
    });
    templates.set(definition.code, template.id);
  }

  const sequenceTypes: CardType[] = ['STUDENT', 'GUARDIAN', 'TEACHER', 'STAFF'];
  for (const cardType of sequenceTypes) {
    await prisma.cardSequence.upsert({
      where: {
        organizationId_cardType: { organizationId: organization.id, cardType },
      },
      update: {},
      create: {
        organizationId: organization.id,
        cardType,
        lastCardNumber: 0,
        lastSubjectNumber: cardType === 'STUDENT' ? 1 : 0,
      },
    });
  }

  const studentTemplateId = templates.get('STUDENT-EMERALD');
  if (!studentTemplateId) throw new Error('Default student template was not created');
  await prisma.qrCard.upsert({
    where: { publicCode: 'QR-DEMO-0001' },
    update: {
      branchId: mainBranch.id,
      templateId: studentTemplateId,
      cardType: 'STUDENT',
      subjectId: demoStudent.code,
      studentId: demoStudent.id,
      ownerName: demoStudent.nameArabic,
      secretHash: cardFingerprint('QR-DEMO-0001'),
      codeFormat: 'QR_AND_BARCODE',
      status: 'ACTIVE',
      assignedAt: new Date(),
      activatedAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      branchId: mainBranch.id,
      templateId: studentTemplateId,
      cardType: 'STUDENT',
      subjectId: demoStudent.code,
      studentId: demoStudent.id,
      ownerName: demoStudent.nameArabic,
      publicCode: 'QR-DEMO-0001',
      secretHash: cardFingerprint('QR-DEMO-0001'),
      codeFormat: 'QR_AND_BARCODE',
      status: 'ACTIVE',
      assignedAt: new Date(),
      activatedAt: new Date(),
    },
  });
}

void main().finally(async () => prisma.$disconnect());
