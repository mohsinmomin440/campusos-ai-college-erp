import { expect, test } from '@playwright/test';

const RUN = Boolean(process.env.CAMPUSOS_BOOTSTRAP_E2E);

test.describe('Fresh Production Onboarding (Bootstrap + Invitations)', () => {
  test.skip(!RUN, 'Set CAMPUSOS_BOOTSTRAP_E2E=1 inside clean emulator');

  test('first user bootstraps Super Admin & College, invites new user, and new user claims role', async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Register very first user on completely empty Firebase database
    await page.goto('/register');
    await page.getByLabel(/Full Name/i).fill('Principal Owner');
    await page.getByLabel(/Email Address/i).fill('owner@realcollege.edu');
    await page.getByLabel(/Password/i).fill('OwnerPass@123');
    await page.getByRole('button', { name: /Create Account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // 2. First-Time Production Setup card appears automatically
    await expect(page.getByText(/First-Time Production Setup/i)).toBeVisible({ timeout: 15000 });
    await page.getByLabel(/Primary Tenant Slug ID/i).fill('real-college-main');
    await page.getByLabel(/College Code/i).fill('RCM');
    await page.getByLabel(/College Full Name/i).fill('Real College of Computing');
    await page.getByRole('button', { name: /Initialize Platform & Create College/i }).click();

    await expect(page.getByText(/Real College of Computing Workspace/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Platform Super Admin/i).first()).toBeVisible();

    // 3. Invite an unregistered faculty member by email
    await page.goto('/administration');
    await page.getByRole('button', { name: /Assign Member Role/i }).click();
    await page.getByLabel(/Registered User Email/i).fill('newfaculty@realcollege.edu');
    await page.getByLabel(/Display Name/i).fill('Prof. Meera Joshi');
    await page.getByLabel(/^Role/i).selectOption('faculty');
    await page.getByRole('button', { name: /Assign Role/i }).click();
    await expect(page.getByText(/Membership \/ invitation saved/i)).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: /Pending Invitations/i }).click();
    await expect(page.getByText('newfaculty@realcollege.edu')).toBeVisible({ timeout: 10000 });

    // 4. Sign out, register as that invited faculty email, and verify automatic role claim
    await page.getByRole('button', { name: /Sign Out/i }).click();
    await page.waitForURL(/\/login/);
    await page.goto('/register');
    await page.getByLabel(/Full Name/i).fill('Prof. Meera Joshi');
    await page.getByLabel(/Email Address/i).fill('newfaculty@realcollege.edu');
    await page.getByLabel(/Password/i).fill('FacultyPass@123');
    await page.getByRole('button', { name: /Create Account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Real College of Computing Workspace/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Signed in as Faculty/i)).toBeVisible({ timeout: 15000 });

    expect(consoleErrors).toEqual([]);
  });
});
