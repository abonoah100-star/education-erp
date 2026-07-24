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
