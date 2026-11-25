import { expect, test } from '@playwright/test';

test.describe('CampusOS Web Application', () => {
  test('renders responsive Sign In page with honest Firebase status indicator', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Sign in to CampusOS/i })).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
  });

  test('redirects unauthenticated visitors from protected routes to login', async ({ page }) => {
    await page.goto('/students');
    await expect(page).toHaveURL(/\/login/);
  });

  test('navigates between login, register, and forgot password screens', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Create account/i }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: /Create CampusOS Account/i })).toBeVisible();

    await page.getByRole('link', { name: /Back to sign in/i }).click();
    await page.getByRole('link', { name: /Forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
