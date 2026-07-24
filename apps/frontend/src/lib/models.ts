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
