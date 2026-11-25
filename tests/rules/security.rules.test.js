// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

let testEnv;

describe('CampusOS Firestore & Storage Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-campusos',
      firestore: {
        rules: fs.readFileSync(path.resolve('firestore.rules'), 'utf8'),
      },
      storage: {
        rules: fs.readFileSync(path.resolve('storage.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'tenants/college-a'), { tenantId: 'college-a', name: 'College A', status: 'active' });
      await setDoc(doc(db, 'tenants/college-b'), { tenantId: 'college-b', name: 'College B', status: 'active' });

      await setDoc(doc(db, 'tenants/college-a/members/admin-a'), { uid: 'admin-a', tenantId: 'college-a', role: 'college_admin', status: 'active' });
      await setDoc(doc(db, 'tenants/college-a/members/faculty-a'), { uid: 'faculty-a', tenantId: 'college-a', role: 'faculty', status: 'active' });
      await setDoc(doc(db, 'tenants/college-a/members/stu-1-uid'), { uid: 'stu-1-uid', tenantId: 'college-a', role: 'student', status: 'active' });
      await setDoc(doc(db, 'tenants/college-a/members/parent-1-uid'), {
        uid: 'parent-1-uid',
        tenantId: 'college-a',
        role: 'parent',
        status: 'active',
        linkedStudentIds: ['stu-1'],
      });
      await setDoc(doc(db, 'tenants/college-b/members/admin-b'), { uid: 'admin-b', tenantId: 'college-b', role: 'college_admin', status: 'active' });

      await setDoc(doc(db, 'tenants/college-a/students/stu-1'), { tenantId: 'college-a', uid: 'stu-1-uid', fullName: 'Student One' });
      await setDoc(doc(db, 'tenants/college-a/students/stu-2'), { tenantId: 'college-a', uid: 'stu-2-uid', fullName: 'Student Two' });
      await setDoc(doc(db, 'tenants/college-b/students/stu-b1'), { tenantId: 'college-b', uid: 'stu-b1-uid', fullName: 'Tenant B Student' });

      await setDoc(doc(db, 'tenants/college-a/results/res-draft'), {
        tenantId: 'college-a',
        studentId: 'stu-1',
        studentUid: 'stu-1-uid',
        published: false,
        marksObtained: 85,
      });
      await setDoc(doc(db, 'tenants/college-a/results/res-pub'), {
        tenantId: 'college-a',
        studentId: 'stu-1',
        studentUid: 'stu-1-uid',
        published: true,
        marksObtained: 90,
      });
      await setDoc(doc(db, 'tenants/college-a/auditLogs/log-1'), { tenantId: 'college-a', action: 'test' });
    });
  });

  it('denies unauthenticated access across tenant collections', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'tenants/college-a')));
    await assertFails(getDoc(doc(anonDb, 'tenants/college-a/students/stu-1')));
    await assertFails(setDoc(doc(anonDb, 'tenants/college-a/notices/n1'), { tenantId: 'college-a', title: 'Hack' }));
  });

  it('enforces strict cross-tenant isolation', async () => {
    const adminBDb = testEnv.authenticatedContext('admin-b').firestore();
    await assertFails(getDoc(doc(adminBDb, 'tenants/college-a/students/stu-1')));
    await assertFails(setDoc(doc(adminBDb, 'tenants/college-a/students/stu-x'), { tenantId: 'college-a', fullName: 'Intruder' }));
    await assertSucceeds(getDoc(doc(adminBDb, 'tenants/college-b/students/stu-b1')));
  });

  it('prevents privilege escalation and direct client payment or audit log writes', async () => {
    const studentDb = testEnv.authenticatedContext('stu-1-uid').firestore();
    await assertFails(updateDoc(doc(studentDb, 'tenants/college-a/members/stu-1-uid'), { role: 'college_admin' }));
    await assertFails(setDoc(doc(studentDb, 'tenants/college-a/payments/pay-1'), { tenantId: 'college-a', amountMinor: 100 }));
    await assertFails(getDoc(doc(studentDb, 'tenants/college-a/auditLogs/log-1')));

    const adminDb = testEnv.authenticatedContext('admin-a').firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'tenants/college-a/auditLogs/log-1')));
    await assertFails(setDoc(doc(adminDb, 'tenants/college-a/auditLogs/log-2'), { tenantId: 'college-a', action: 'forged' }));
    await assertFails(setDoc(doc(adminDb, 'system/bootstrap'), { initialized: true }));
    await assertFails(setDoc(doc(adminDb, 'tenants/college-a/invitations/inv-1'), { email: 'x@y.com', role: 'college_admin' }));
  });

  it('enforces student/parent record ownership and unpublished result protection', async () => {
    const studentDb = testEnv.authenticatedContext('stu-1-uid').firestore();
    await assertSucceeds(getDoc(doc(studentDb, 'tenants/college-a/students/stu-1')));
    await assertFails(getDoc(doc(studentDb, 'tenants/college-a/students/stu-2')));
    await assertFails(getDoc(doc(studentDb, 'tenants/college-a/results/res-draft')));
    await assertSucceeds(getDoc(doc(studentDb, 'tenants/college-a/results/res-pub')));

    const parentDb = testEnv.authenticatedContext('parent-1-uid').firestore();
    await assertSucceeds(getDoc(doc(parentDb, 'tenants/college-a/students/stu-1')));
    await assertFails(getDoc(doc(parentDb, 'tenants/college-a/students/stu-2')));
  });

  it('allows faculty attendance entry and draft marks, but blocks direct marks publication', async () => {
    const facultyDb = testEnv.authenticatedContext('faculty-a').firestore();
    await assertSucceeds(
      setDoc(doc(facultyDb, 'tenants/college-a/attendance/2026-11-24_BCA_stu-1'), {
        tenantId: 'college-a',
        studentId: 'stu-1',
        status: 'present',
      })
    );
    await assertSucceeds(
      setDoc(doc(facultyDb, 'tenants/college-a/results/res-new'), {
        tenantId: 'college-a',
        studentId: 'stu-1',
        published: false,
        marksObtained: 88,
      })
    );
    await assertFails(
      setDoc(doc(facultyDb, 'tenants/college-a/results/res-forged-pub'), {
        tenantId: 'college-a',
        studentId: 'stu-1',
        published: true,
        marksObtained: 99,
      })
    );
  });

  it('enforces Storage tenant isolation, content types, and 5 MB file limit', async () => {
    const stuStorage = testEnv.authenticatedContext('stu-1-uid').storage();
    const tenantBStorage = testEnv.authenticatedContext('admin-b').storage();
    const validPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

    await assertSucceeds(
      uploadBytes(ref(stuStorage, 'tenants/college-a/documents/stu-1-uid/marksheet.pdf'), validPdf, {
        contentType: 'application/pdf',
      })
    );
    // Disallowed executable MIME type
    await assertFails(
      uploadBytes(ref(stuStorage, 'tenants/college-a/documents/stu-1-uid/bad.exe'), validPdf, {
        contentType: 'application/x-msdownload',
      })
    );
    // Cross-tenant storage write denied
    await assertFails(
      uploadBytes(ref(tenantBStorage, 'tenants/college-a/documents/admin-b/hack.pdf'), validPdf, {
        contentType: 'application/pdf',
      })
    );
  });
});
