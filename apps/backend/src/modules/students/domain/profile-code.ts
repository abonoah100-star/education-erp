export type ProfileSequenceKind = 'STUDENT' | 'GUARDIAN' | 'AUTHORIZED_PICKUP';

const PROFILE_CODE_PREFIX: Readonly<Record<ProfileSequenceKind, string>> = {
  STUDENT: 'STU',
  GUARDIAN: 'GDN',
  AUTHORIZED_PICKUP: 'PUP',
};

export function formatProfileCode(kind: ProfileSequenceKind, sequenceNumber: number): string {
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new RangeError('Profile sequence number must be a positive safe integer.');
  }

  return `${PROFILE_CODE_PREFIX[kind]}-${sequenceNumber.toString().padStart(6, '0')}`;
}

export function normalizePersonName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    throw new Error('Person name cannot be blank after normalization.');
  }

  return normalized;
}
