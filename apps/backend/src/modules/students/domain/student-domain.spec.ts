import { formatProfileCode, normalizePersonName } from './profile-code';
import { assertStudentStatusTransition, canTransitionStudentStatus } from './student-status-policy';

describe('student and guardian domain foundations', () => {
  describe('profile codes', () => {
    it('formats deterministic six-digit student, guardian and pickup codes', () => {
      expect(formatProfileCode('STUDENT', 1)).toBe('STU-000001');
      expect(formatProfileCode('GUARDIAN', 42)).toBe('GDN-000042');
      expect(formatProfileCode('AUTHORIZED_PICKUP', 999999)).toBe('PUP-999999');
    });

    it('rejects invalid sequence values', () => {
      expect(() => formatProfileCode('STUDENT', 0)).toThrow(RangeError);
      expect(() => formatProfileCode('STUDENT', 1.5)).toThrow(RangeError);
    });
  });

  describe('search normalization', () => {
    it('normalizes common Arabic letter variants and spacing', () => {
      expect(normalizePersonName('  أَحْمَد   مُحَمَّد  ')).toBe('احمد محمد');
      expect(normalizePersonName('هدى  إبراهيم')).toBe('هدي ابراهيم');
    });
  });

  describe('student lifecycle', () => {
    it('permits documented transitions', () => {
      expect(canTransitionStudentStatus('DRAFT', 'ACTIVE')).toBe(true);
      expect(canTransitionStudentStatus('SUSPENDED', 'ACTIVE')).toBe(true);
      expect(canTransitionStudentStatus('GRADUATED', 'ARCHIVED')).toBe(true);
    });

    it('rejects reopening an archived student', () => {
      expect(canTransitionStudentStatus('ARCHIVED', 'ACTIVE')).toBe(false);
      expect(() => assertStudentStatusTransition('ARCHIVED', 'ACTIVE')).toThrow(
        'Invalid student status transition',
      );
    });
  });
});
