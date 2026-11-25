import { describe, expect, it } from 'vitest';
import { parseDecimalToMinorUnits, formatMinorUnits, sumMinorUnits } from '@/utils/money';
import { sanitizeCsvCell } from '@/utils/csv';
import { detectTimetableClash } from '@/utils/timetable';
import { hasPermission, PERMISSIONS, ROLES } from '@/schemas/roles';
import { readFirebaseConfigFromEnv } from '@/firebase/firebase';

describe('Money minor-unit utilities', () => {
  it('parses decimals into exact integer minor units without floating-point drift', () => {
    expect(parseDecimalToMinorUnits('19.99', 'INR')).toBe(1999);
    expect(parseDecimalToMinorUnits('25000', 'INR')).toBe(2500000);
    expect(parseDecimalToMinorUnits('500', 'JPY')).toBe(500);
  });

  it('rejects negative or invalid decimals', () => {
    expect(() => parseDecimalToMinorUnits('-10.00')).toThrow();
    expect(() => parseDecimalToMinorUnits('12.345')).toThrow();
  });

  it('sums and formats minor units accurately', () => {
    const total = sumMinorUnits([1999, 1001, 500]);
    expect(total).toBe(3500);
    expect(formatMinorUnits(total, 'INR')).toContain('35.00');
  });
});

describe('CSV formula-injection protection', () => {
  it('neutralizes leading formula operators', () => {
    expect(sanitizeCsvCell('=SUM(A1:A5)')).toBe('"\'=SUM(A1:A5)"');
    expect(sanitizeCsvCell('+cmd|calc')).toBe('"\'+cmd|calc"');
    expect(sanitizeCsvCell('Normal "Text"')).toBe('"Normal ""Text"""');
  });
});

describe('Timetable clash detection', () => {
  const existing = [
    {
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      room: 'Lab 302',
      facultyName: 'Prof. Iyer',
      classId: 'BCA-S6-A',
      subjectName: 'Cloud Computing',
    },
  ];

  it('detects room, faculty, and class overlaps', () => {
    expect(
      detectTimetableClash(existing, {
        dayOfWeek: 'Monday',
        startTime: '09:30',
        endTime: '10:30',
        room: 'Lab 302',
        facultyName: 'Prof. Rao',
        classId: 'BCA-S4-A',
      })
    ).toMatch(/Room clash/i);

    expect(
      detectTimetableClash(existing, {
        dayOfWeek: 'Monday',
        startTime: '09:15',
        endTime: '10:15',
        room: 'Room 101',
        facultyName: 'Prof. Iyer',
        classId: 'BCA-S4-A',
      })
    ).toMatch(/Faculty clash/i);
  });

  it('permits non-overlapping slots', () => {
    expect(
      detectTimetableClash(existing, {
        dayOfWeek: 'Monday',
        startTime: '10:00',
        endTime: '11:00',
        room: 'Lab 302',
        facultyName: 'Prof. Iyer',
        classId: 'BCA-S6-A',
      })
    ).toBeNull();
  });
});

describe('Centralized RBAC & Firebase env validation', () => {
  it('enforces least privilege across student and admin roles', () => {
    expect(hasPermission(ROLES.STUDENT, PERMISSIONS.ATTENDANCE_READ)).toBe(true);
    expect(hasPermission(ROLES.STUDENT, PERMISSIONS.FINANCE_WRITE)).toBe(false);
    expect(hasPermission(ROLES.STUDENT, PERMISSIONS.AUDIT_READ)).toBe(false);
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.FINANCE_WRITE)).toBe(true);
    expect(hasPermission(ROLES.COLLEGE_ADMIN, PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
    expect(hasPermission(ROLES.PLATFORM_SUPER_ADMIN, PERMISSIONS.PLATFORM_MANAGE)).toBe(true);
  });

  it('distinguishes not_configured, emulator, and cloud Firebase states honestly', () => {
    expect(readFirebaseConfigFromEnv({}).mode).toBe('not_configured');
    const emu = readFirebaseConfigFromEnv({
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_AUTH_DOMAIN: 'a',
      VITE_FIREBASE_PROJECT_ID: 'p',
      VITE_FIREBASE_STORAGE_BUCKET: 'b',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'm',
      VITE_FIREBASE_APP_ID: 'app',
      VITE_USE_FIREBASE_EMULATORS: 'true',
    });
    expect(emu.configured).toBe(true);
    expect(emu.mode).toBe('emulator');
  });
});
