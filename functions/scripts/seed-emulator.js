/**
 * Explicit Firebase Emulator-only synthetic sample data seeder.
 * NEVER runs against production Firebase projects.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'demo-campusos';
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulator;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulator;
}

if (!firestoreEmulator.includes('127.0.0.1') && !firestoreEmulator.includes('localhost')) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST must point to local emulator.');
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const SYNTHETIC_USERS = [
  { uid: 'demo-super-admin', email: 'superadmin@campusos.test', password: 'Password@123', displayName: 'Aarav Menon (Super Admin)', platformRole: 'platform_super_admin' },
  { uid: 'demo-college-admin', email: 'admin@stxavier.test', password: 'Password@123', displayName: 'Dr. Kavita Rao (Admin)', role: 'college_admin', tenantId: 'st-xavier-bca' },
  { uid: 'demo-faculty', email: 'faculty@stxavier.test', password: 'Password@123', displayName: 'Prof. Rohan Kulkarni (Faculty)', role: 'faculty', tenantId: 'st-xavier-bca' },
  { uid: 'demo-accountant', email: 'accounts@stxavier.test', password: 'Password@123', displayName: 'Meera Nair (Accountant)', role: 'accountant', tenantId: 'st-xavier-bca' },
  { uid: 'demo-student', email: 'student@stxavier.test', password: 'Password@123', displayName: 'Diya Sharma (Student)', role: 'student', tenantId: 'st-xavier-bca' },
  { uid: 'demo-parent', email: 'parent@stxavier.test', password: 'Password@123', displayName: 'Rajesh Sharma (Parent)', role: 'parent', tenantId: 'st-xavier-bca', linkedStudentIds: ['stu-diya'] },
];

async function upsertUser(u) {
  try {
    await auth.getUser(u.uid);
    await auth.updateUser(u.uid, { email: u.email, password: u.password, displayName: u.displayName, emailVerified: true });
  } catch {
    await auth.createUser({ uid: u.uid, email: u.email, password: u.password, displayName: u.displayName, emailVerified: true });
  }
}

async function main() {
  console.log(`Seeding synthetic development data to Emulator (${projectId})...`);

  await db.collection('tenants').doc('st-xavier-bca').set({
    tenantId: 'st-xavier-bca',
    name: 'St. Xavier Institute of Computing (Demo)',
    code: 'SXIC',
    city: 'Bengaluru',
    state: 'Karnataka',
    contactEmail: 'office@stxavier.test',
    subscriptionPlan: 'enterprise',
    status: 'active',
    currency: 'INR',
    attendanceThresholdPercent: 75,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('tenants').doc('meridian-tech').set({
    tenantId: 'meridian-tech',
    name: 'Meridian School of Technology (Demo)',
    code: 'MST',
    city: 'Pune',
    state: 'Maharashtra',
    contactEmail: 'info@meridian.test',
    subscriptionPlan: 'growth',
    status: 'active',
    currency: 'INR',
    attendanceThresholdPercent: 75,
    createdAt: FieldValue.serverTimestamp(),
  });

  for (const u of SYNTHETIC_USERS) {
    await upsertUser(u);
    await db.collection('users').doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      ...(u.platformRole ? { platformRole: u.platformRole } : {}),
      defaultTenantId: u.tenantId || 'st-xavier-bca',
      tenantIds: u.tenantId ? [u.tenantId] : ['st-xavier-bca', 'meridian-tech'],
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (u.tenantId && u.role) {
      await db.collection('tenants').doc(u.tenantId).collection('members').doc(u.uid).set({
        uid: u.uid,
        tenantId: u.tenantId,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        status: 'active',
        linkedStudentIds: u.linkedStudentIds || [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  const tRef = db.collection('tenants').doc('st-xavier-bca');

  await tRef.collection('departments').doc('dept-cs').set({
    tenantId: 'st-xavier-bca',
    code: 'CS',
    name: 'Computer Applications',
    hodName: 'Prof. Rohan Kulkarni',
    createdAt: FieldValue.serverTimestamp(),
  });
  await tRef.collection('courses').doc('course-bca').set({
    tenantId: 'st-xavier-bca',
    code: 'BCA',
    name: 'Bachelor of Computer Applications',
    departmentId: 'dept-cs',
    durationSemesters: 6,
    createdAt: FieldValue.serverTimestamp(),
  });
  await tRef.collection('subjects').doc('subj-bca601').set({
    tenantId: 'st-xavier-bca',
    code: 'BCA601',
    name: 'Cloud Architecture & AI',
    courseId: 'course-bca',
    credits: 4,
    semesterId: 'sem-6',
    createdAt: FieldValue.serverTimestamp(),
  });
  await tRef.collection('classes').doc('cls-bca-s6-a').set({
    tenantId: 'st-xavier-bca',
    name: 'BCA-S6-A',
    division: 'A',
    semesterId: 'sem-6',
    academicYear: '2026-27',
    createdAt: FieldValue.serverTimestamp(),
  });
  await tRef.collection('timetables').doc('tt-mon-1').set({
    tenantId: 'st-xavier-bca',
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    classId: 'BCA-S6-A',
    subjectName: 'Cloud Architecture & AI',
    facultyName: 'Prof. Rohan Kulkarni',
    room: 'Lab 302',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('faculty').doc('fac-rohan').set({
    tenantId: 'st-xavier-bca',
    employeeCode: 'FAC-101',
    fullName: 'Prof. Rohan Kulkarni',
    email: 'faculty@stxavier.test',
    departmentId: 'dept-cs',
    designation: 'Associate Professor',
    workloadHours: 18,
    assignedSubjects: 'Cloud Architecture & AI, DBMS',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('admissions').doc('adm-demo-1').set({
    tenantId: 'st-xavier-bca',
    applicantName: 'Karan Verma',
    email: 'karan.verma@example.test',
    phone: '+91-9811001122',
    programApplied: 'Bachelor of Computer Applications',
    previousPercentage: 86.5,
    guardianName: 'Suresh Verma',
    status: 'under_review',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('students').doc('stu-diya').set({
    tenantId: 'st-xavier-bca',
    uid: 'demo-student',
    enrollmentNumber: 'SXIC-2024-001',
    fullName: 'Diya Sharma',
    email: 'student@stxavier.test',
    phone: '+91-9822003344',
    departmentId: 'dept-cs',
    courseId: 'course-bca',
    semesterId: 'sem-6',
    guardianName: 'Rajesh Sharma',
    guardianPhone: '+91-9822003300',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('attendance').doc('2026-11-24_BCA-S6-A_BCA601_stu-diya').set({
    tenantId: 'st-xavier-bca',
    date: '2026-11-24',
    classId: 'BCA-S6-A',
    subjectId: 'BCA601',
    studentId: 'stu-diya',
    studentUid: 'demo-student',
    studentName: 'Diya Sharma',
    status: 'present',
    markedByUid: 'demo-faculty',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('examinations').doc('exam-midsem-2026').set({
    tenantId: 'st-xavier-bca',
    title: 'Mid-Semester Assessment 2026',
    subjectName: 'Cloud Architecture & AI',
    semesterId: 'sem-6',
    examDate: '2026-11-18',
    maxMarks: 100,
    passMarks: 40,
    status: 'published',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('results').doc('exam-midsem-2026_stu-diya').set({
    tenantId: 'st-xavier-bca',
    examId: 'exam-midsem-2026',
    examTitle: 'Mid-Semester Assessment 2026',
    subjectName: 'Cloud Architecture & AI',
    studentId: 'stu-diya',
    studentUid: 'demo-student',
    studentName: 'Diya Sharma',
    marksObtained: 88,
    maxMarks: 100,
    passMarks: 40,
    percentage: 88,
    grade: 'A+',
    passed: true,
    published: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('feeStructures').doc('fs-sem6-tuition').set({
    tenantId: 'st-xavier-bca',
    title: 'BCA Semester 6 Tuition Fee',
    category: 'tuition',
    semesterId: 'sem-6',
    amountMinor: 2500000,
    currency: 'INR',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('invoices').doc('inv-demo-1').set({
    tenantId: 'st-xavier-bca',
    invoiceNumber: 'INV-2026-001',
    studentId: 'stu-diya',
    studentUid: 'demo-student',
    studentName: 'Diya Sharma',
    title: 'Semester 6 Tuition Fee',
    dueDate: '2026-12-15',
    totalMinor: 2500000,
    paidMinor: 1000000,
    balanceMinor: 1500000,
    currency: 'INR',
    status: 'partial',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('payments').doc('pay_demo_initial').set({
    tenantId: 'st-xavier-bca',
    invoiceId: 'inv-demo-1',
    studentId: 'stu-diya',
    studentUid: 'demo-student',
    studentName: 'Diya Sharma',
    amountMinor: 1000000,
    currency: 'INR',
    method: 'upi',
    reference: 'UPI-631920441',
    receiptNumber: 'RCP-DEMO-001',
    status: 'completed',
    recordedByUid: 'demo-accountant',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('libraryBooks').doc('book-clean-arch').set({
    tenantId: 'st-xavier-bca',
    isbn: '978-0134494166',
    title: 'Clean Architecture',
    author: 'Robert C. Martin',
    category: 'Software Engineering',
    totalCopies: 5,
    availableCopies: 4,
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('bookLoans').doc('loan-demo-1').set({
    tenantId: 'st-xavier-bca',
    bookId: 'book-clean-arch',
    bookTitle: 'Clean Architecture',
    studentId: 'stu-diya',
    studentUid: 'demo-student',
    studentName: 'Diya Sharma',
    issuedDate: '2026-11-20',
    dueDate: '2026-12-04',
    status: 'issued',
    fineMinor: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('placements').doc('drv-cloud-2026').set({
    tenantId: 'st-xavier-bca',
    companyName: 'Apex Cloud Systems',
    roleTitle: 'Associate Cloud Engineer',
    opportunityType: 'full_time',
    compensation: '7.5 LPA',
    minPercentage: 65,
    interviewDate: '2026-12-18',
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('notices').doc('notice-demo-1').set({
    tenantId: 'st-xavier-bca',
    title: 'Semester 6 Final Project Submission Schedule',
    audience: 'all',
    body: 'All BCA Sem 6 students must submit project documentation before 10th December.',
    authorName: 'Dr. Kavita Rao',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('events').doc('evt-techfest-2026').set({
    tenantId: 'st-xavier-bca',
    title: 'Annual Computing Symposium 2026',
    eventDate: '2026-12-12',
    location: 'Main Auditorium',
    description: 'Student capstone showcase and cloud security workshop.',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('tickets').doc('tkt-demo-1').set({
    tenantId: 'st-xavier-bca',
    subject: 'Bonafide Certificate Request',
    category: 'academic',
    priority: 'medium',
    description: 'Need signed bonafide certificate for internship onboarding.',
    createdByUid: 'demo-student',
    createdByName: 'Diya Sharma',
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('notifications').doc('notif-demo-1').set({
    tenantId: 'st-xavier-bca',
    recipientUid: 'demo-student',
    title: 'Results Published: Mid-Semester Assessment 2026',
    message: 'Your marks for Cloud Architecture & AI (A+, 88%) are now available.',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('knowledgeDocuments').doc('kb-attendance').set({
    tenantId: 'st-xavier-bca',
    title: 'Attendance & Examination Eligibility Policy',
    category: 'Policy',
    content: 'Students must maintain at least 75% attendance per subject to appear in end-semester university examinations.',
    createdAt: FieldValue.serverTimestamp(),
  });

  await tRef.collection('auditLogs').doc('audit-demo-seed').set({
    tenantId: 'st-xavier-bca',
    actorUid: 'demo-super-admin',
    actorRole: 'platform_super_admin',
    module: 'administration',
    action: 'emulator_seeded',
    summary: 'Synthetic development dataset initialized on local Firebase Emulator.',
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log('Emulator seed complete! Demo password for all accounts: Password@123');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
