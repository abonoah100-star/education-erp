export interface RequestUser {
  id: string;
  email: string;
  organizationId: string;
  branchIds: string[];
  permissions: string[];
  roleCodes: string[];
  isOwner: boolean;
}
