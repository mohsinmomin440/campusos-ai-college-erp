import { expect, test } from '@playwright/test';

const LIVE = Boolean(process.env.CAMPUSOS_LIVE_AUDIT);

async function signIn(page, email, password = 'Password@123') {
  await page.goto('/login');
  await page.getByLabel(/Email Address/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function signOut(page) {
  const signOutBtn = page.getByRole('button', { name: /Sign Out/i });
  await signOutBtn.click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

test.describe('Live Multi-Role Security, Permission & Database Audit', () => {
  test.skip(!LIVE, 'Set CAMPUSOS_LIVE_AUDIT=1 with running Firebase Emulators and Vite dev server');

  test('verifies Admin, Student, Parent, and Super Admin journeys with zero permission/console errors', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. College Admin journey + live Cloud Function write + audit log check
    await signIn(page, 'admin@stxavier.test');
    await expect(page.getByText(/St\. Xavier Institute of Computing \(Demo\) Workspace/i)).toBeVisible();
    await expect(page.getByText('₹15,000.00')).toBeVisible();

    const adminRoutes = [
      ['/administration', /College Administration/i],
      ['/academics', /Academics & Timetable/i],
      ['/admissions', /Admissions & Enquiries/i],
      ['/students', /Student Directory/i],
      ['/faculty', /Faculty & Staff Directory/i],
      ['/attendance', /Attendance Management/i],
      ['/examinations', /Examinations & Results/i],
      ['/finance', /Fees & Finance/i],
      ['/library', /Library Management/i],
      ['/placements', /Placements & Internships/i],
      ['/communication', /Communication, Events & Helpdesk/i],
      ['/documents', /Documents & Certificates/i],
      ['/reports', /Reports & Analytics/i],
      ['/ai-assistant', /CampusOS Gemini AI Workspace/i],
      ['/audit-logs', /Audit Logs & Security Governance/i],
      ['/profile', /Profile & System Diagnostics/i],
    ];

    for (const [route, headingRegex] of adminRoutes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: headingRegex })).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(350);
    }

    // Live Cloud Function payment test on /finance
    await page.goto('/finance');
    await expect(page.getByText('INV-2026-001')).toBeVisible();
    await page.getByRole('button', { name: /Record Payment/i }).first().click();
    await page.getByLabel(/Amount/i).fill('5000.00');
    await page.getByLabel(/Method/i).selectOption('upi');
    await page.getByLabel(/Transaction \/ Counter Reference/i).fill('AUDIT-UPI-500');
    await page.getByRole('button', { name: /Confirm Payment/i }).click();
    await expect(page.getByText(/Payment recorded & receipt issued/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('₹10,000.00').first()).toBeVisible({ timeout: 10000 });

    // Confirm audit log entry created by Cloud Function
    await page.goto('/audit-logs');
    await expect(page.getByText('payment_recorded').first()).toBeVisible({ timeout: 10000 });

    // 2. Student journey (strictly scoped reads + blocked admin pages)
    await signOut(page);
    await signIn(page, 'student@stxavier.test');
    await expect(page.getByText(/Signed in as Student/i)).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();

    await page.goto('/examinations');
    await page.getByRole('tab', { name: /Marks & Results/i }).click();
    await expect(page.getByText(/A\+ \(PASS\)/i)).toBeVisible({ timeout: 10000 });

    await page.goto('/finance');
    await expect(page.getByText('INV-2026-001')).toBeVisible({ timeout: 10000 });

    await page.goto('/attendance');
    await expect(page.getByRole('heading', { name: /Attendance Management/i })).toBeVisible();
    await page.goto('/library');
    await page.getByRole('tab', { name: /Circulation & Fines/i }).click();
    await expect(page.getByText('Clean Architecture').first()).toBeVisible();

    await page.goto('/communication');
    await page.getByRole('tab', { name: /My Notifications/i }).click();
    await expect(page.getByText(/Results Published/i)).toBeVisible();

    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: /Documents & Certificates/i })).toBeVisible();
    await page.goto('/ai-assistant');
    await expect(page.getByText(/Gemini AI Disabled/i)).toBeVisible();

    // Restricted routes must show Access Restricted
    await page.goto('/audit-logs');
    await expect(page.getByText('Access Restricted')).toBeVisible();
    await page.goto('/platform');
    await expect(page.getByText('Access Restricted')).toBeVisible();

    // 3. Parent journey (linked student data + blocked student directory & AI)
    await signOut(page);
    await signIn(page, 'parent@stxavier.test');
    await expect(page.getByText(/Signed in as Parent \/ Guardian/i)).toBeVisible();

    await page.goto('/attendance');
    await expect(page.getByText('Diya Sharma').first()).toBeVisible({ timeout: 10000 });
    await page.goto('/examinations');
    await page.getByRole('tab', { name: /Marks & Results/i }).click();
    await expect(page.getByText('Diya Sharma').first()).toBeVisible({ timeout: 10000 });
    await page.goto('/finance');
    await expect(page.getByText('INV-2026-001')).toBeVisible({ timeout: 10000 });

    await page.goto('/ai-assistant');
    await expect(page.getByText('Access Restricted')).toBeVisible();
    await page.goto('/students');
    await expect(page.getByText('Access Restricted')).toBeVisible();

    // 4. Platform Super Admin journey
    await signOut(page);
    await signIn(page, 'superadmin@campusos.test');
    await page.goto('/platform');
    await expect(page.getByRole('cell', { name: /St\. Xavier Institute of Computing/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: /Meridian School of Technology/i })).toBeVisible({ timeout: 10000 });

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Browser console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});
