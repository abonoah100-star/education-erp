export type Identifier = string;
export type PermissionCode = string;
export interface ApiEnvelope<T> { data: T; meta?: Record<string, unknown>; }
export interface SessionUser { id:string; name:string; email:string; role:string; branches:{id:string;name:string;code:string}[]; permissions:string[]; }

export type StudentStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'WITHDRAWN'
  | 'GRADUATED'
  | 'ARCHIVED';

export type StudentGender = 'MALE' | 'FEMALE';
export type GuardianStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type GuardianRelationship =
  | 'FATHER'
  | 'MOTHER'
  | 'LEGAL_GUARDIAN'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'SIBLING'
  | 'OTHER';
export type AuthorizedPickupStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface StudentSummary {
  id: Identifier;
  branchId: Identifier;
  code: string;
  nameArabic: string;
  nameEnglish?: string;
  status: StudentStatus;
  schoolName?: string;
  gradeLevel?: string;
}
