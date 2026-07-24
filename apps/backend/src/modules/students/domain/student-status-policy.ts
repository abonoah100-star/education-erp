export type StudentLifecycleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'WITHDRAWN'
  | 'GRADUATED'
  | 'ARCHIVED';

const ALLOWED_TRANSITIONS: Readonly<
  Record<StudentLifecycleStatus, readonly StudentLifecycleStatus[]>
> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'WITHDRAWN', 'ARCHIVED'],
  WITHDRAWN: ['ACTIVE', 'ARCHIVED'],
  GRADUATED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionStudentStatus(
  currentStatus: StudentLifecycleStatus,
  nextStatus: StudentLifecycleStatus,
): boolean {
  if (currentStatus === nextStatus) return true;
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertStudentStatusTransition(
  currentStatus: StudentLifecycleStatus,
  nextStatus: StudentLifecycleStatus,
): void {
  if (!canTransitionStudentStatus(currentStatus, nextStatus)) {
    throw new Error(`Invalid student status transition: ${currentStatus} -> ${nextStatus}`);
  }
}
