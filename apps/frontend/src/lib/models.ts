export interface BranchRef {
  id: string;
  name: string;
  code: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branches: BranchRef[];
}

export interface CashboxRow {
  id: string;
  name: string;
  code: string;
  balance: number;
  status: 'ACTIVE' | 'CLOSED';
  branch?: BranchRef;
}

export interface OverviewData {
  branches: number;
  totalCashBalance: number;
  users: number;
  cashboxes: CashboxRow[];
  attention: { level: string; title: string; description: string }[];
  recentActivity: AuditRow[];
}

export interface BranchRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  usersCount: number;
  cashboxes: CashboxRow[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  roles: { id: string; name: string; code: string }[];
  branches: BranchRef[];
}

export interface PermissionRow {
  id: string;
  code: string;
  name: string;
  module: string;
}

export interface RoleRow {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
  usersCount: number;
  permissions: PermissionRow[];
}

export interface QrCardRow {
  id: string;
  cardType: 'STUDENT' | 'GUARDIAN' | 'STAFF';
  subjectId: string;
  publicCode: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface IssuedQrCard extends QrCardRow {
  qrPayload: string;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName?: string;
  actor?: { id: string; name: string; email: string } | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export type SmartCardType = 'STUDENT' | 'GUARDIAN' | 'TEACHER' | 'STAFF';
export type SmartCardStatus =
  | 'DRAFT'
  | 'IN_STOCK'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'LOST'
  | 'DAMAGED'
  | 'REPLACED'
  | 'EXPIRED'
  | 'REVOKED';
export type CardCodeFormat = 'QR' | 'BARCODE' | 'QR_AND_BARCODE';
export type CardPrintLayout = 'SINGLE' | 'A4_8_UP' | 'A4_10_UP';

export interface CardTemplateRow {
  id: string;
  branchId: string | null;
  name: string;
  code: string;
  cardType: SmartCardType;
  description: string | null;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  widthMm: number;
  heightMm: number;
  defaultCodeFormat: CardCodeFormat;
  defaultBarcodeType: 'CODE128';
  showPhoto: boolean;
  showBranch: boolean;
  showExpiry: boolean;
  isDefault: boolean;
  isActive: boolean;
  cardsCount: number;
  branch: BranchRef | null;
}

export interface SmartCardRow {
  id: string;
  branchId: string | null;
  templateId: string | null;
  batchId: string | null;
  cardType: SmartCardType;
  subjectId: string | null;
  ownerName: string | null;
  portraitAssetId: string | null;
  publicCode: string;
  codeFormat: CardCodeFormat;
  barcodeType: 'CODE128';
  status: SmartCardStatus;
  replacesCardId: string | null;
  expiresAt: string | null;
  assignedAt: string | null;
  activatedAt: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
  branch: BranchRef | null;
  template: Pick<CardTemplateRow, 'id' | 'name' | 'code' | 'backgroundColor' | 'accentColor' | 'textColor' | 'mutedTextColor'> | null;
  batch: { id: string; name: string; code: string } | null;
}

export interface CardBatchRow {
  id: string;
  branchId: string;
  templateId: string;
  name: string;
  code: string;
  cardType: SmartCardType;
  status: 'DRAFT' | 'GENERATED' | 'PARTIALLY_ASSIGNED' | 'COMPLETED' | 'ARCHIVED';
  prefix: string;
  startNumber: number;
  quantity: number;
  notes: string | null;
  createdAt: string;
  branch: BranchRef;
  template: { id: string; name: string; code: string };
  cardsCount: number;
  availableCount: number;
}

export interface CardPrintJobRow {
  id: string;
  name: string;
  status: 'DRAFT' | 'GENERATED' | 'PRINTED' | 'FAILED';
  layout: CardPrintLayout;
  sideSelection: CardPrintSide;
  pageCount: number;
  createdAt: string;
  printedAt: string | null;
  branch: BranchRef | null;
  template: { id: string; name: string; code: string } | null;
  cardsCount: number;
}

export interface OrganizationSettings {
  id?: string;
  name: string;
  systemName: string;
  cardSubtitle: string | null;
  cardBackTitle: string | null;
  cardBackInstruction: string | null;
  cardBackFooter: string | null;
  logoUrl: string;
  hasCustomLogo: boolean;
  code?: string;
}

export type CardPrintSide = 'FRONT' | 'BACK' | 'BOTH';

export type StudentStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'GRADUATED' | 'ARCHIVED';
export type StudentGender = 'MALE' | 'FEMALE';
export type GuardianStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type AuthorizedPickupStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER' | 'GRANDFATHER' | 'GRANDMOTHER' | 'UNCLE' | 'AUNT' | 'GUARDIAN' | 'OTHER';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface PagedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface StudentGuardianSummary {
  id: string;
  code: string;
  nameArabic: string;
  primaryPhone: string;
  whatsappPhone: string | null;
}

export interface StudentRow {
  id: string;
  branchId: string;
  code: string;
  nameArabic: string;
  nameEnglish: string | null;
  gender: StudentGender | null;
  birthDate: string | null;
  schoolName: string | null;
  gradeLevel: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  status: StudentStatus;
  registeredAt: string;
  profilePhotoAssetId: string | null;
  branch: BranchRef;
  primaryGuardian: StudentGuardianSummary | null;
  guardiansCount: number;
  authorizedPickupsCount: number;
  documentsCount: number;
  cardsCount: number;
}

export interface StudentGuardianLinkRow {
  relationship: GuardianRelationship;
  customRelationship: string | null;
  isPrimary: boolean;
  isFinancialResponsible: boolean;
  receivesNotifications: boolean;
  canPickup: boolean;
  isActive: boolean;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  guardian: {
    id: string;
    code: string;
    nameArabic: string;
    nameEnglish: string | null;
    primaryPhone: string;
    whatsappPhone: string | null;
    email: string | null;
    status: GuardianStatus;
    profilePhotoAssetId: string | null;
  };
}

export interface StudentPickupLinkRow {
  isActive: boolean;
  notes: string | null;
  authorizedPickup: {
    id: string;
    code: string;
    nameArabic: string;
    relationship: GuardianRelationship;
    customRelationship: string | null;
    phone: string;
    status: AuthorizedPickupStatus;
    validFrom: string | null;
    validUntil: string | null;
    profilePhotoAssetId: string | null;
  };
}

export interface StudentDocumentRow {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  expiresAt: string | null;
  isSensitive: boolean;
  createdAt: string;
}

export interface StudentNoteRow {
  id: string;
  category: string;
  content: string;
  isSensitive: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface StudentStatusHistoryRow {
  id: string;
  fromStatus: StudentStatus | null;
  toStatus: StudentStatus;
  reason: string | null;
  changedAt: string;
  changedBy: { id: string; name: string };
}

export interface StudentDetails extends StudentRow {
  address: string | null;
  healthNotes: string | null;
  adminNotes: string | null;
  referralSource: string | null;
  createdAt: string;
  updatedAt: string;
  guardians: StudentGuardianLinkRow[];
  authorizedPickups: StudentPickupLinkRow[];
  documents: StudentDocumentRow[];
  notes: StudentNoteRow[];
  statusHistory: StudentStatusHistoryRow[];
  cards: Array<{ id: string; publicCode: string; subjectId: string | null; status: SmartCardStatus; cardType: SmartCardType; createdAt: string; expiresAt: string | null }>;
}

export interface DuplicateStudentRow extends StudentRow {
  score: number;
  reasons: string[];
}

export interface GuardianRow {
  id: string;
  code: string;
  nameArabic: string;
  nameEnglish: string | null;
  primaryPhone: string;
  whatsappPhone: string | null;
  email: string | null;
  status: GuardianStatus;
  profilePhotoAssetId: string | null;
  createdAt: string;
  studentsCount: number;
  students: Array<{
    relationship: GuardianRelationship;
    isPrimary: boolean;
    student: { id: string; code: string; nameArabic: string; branch: BranchRef };
  }>;
}

export interface GuardianDetails extends GuardianRow {
  nationalId: string | null;
  address: string | null;
  updatedAt: string;
  cards: Array<{ id: string; publicCode: string; subjectId: string | null; status: SmartCardStatus; createdAt: string }>;
}

export interface AuthorizedPickupRow {
  id: string;
  code: string;
  nameArabic: string;
  relationship: GuardianRelationship;
  customRelationship: string | null;
  phone: string;
  status: AuthorizedPickupStatus;
  validFrom: string | null;
  validUntil: string | null;
  profilePhotoAssetId: string | null;
  studentsCount: number;
  students: Array<{ student: { id: string; code: string; nameArabic: string; branch: BranchRef } }>;
}
