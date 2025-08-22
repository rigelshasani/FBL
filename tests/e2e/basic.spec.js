import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  
  await expect(page).toHaveTitle(/FBL Gothic Library/);
  await expect(page.getByRole('heading', { name: 'FBL Gothic Library' })).toBeVisible();
  await expect(page.getByText('The library is currently under construction')).toBeVisible();
});

test('health endpoint works', async ({ page }) => {
  const response = await page.request.get('/health');
  
  expect(response.ok()).toBeTruthy();
  
  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body).toHaveProperty('timestamp');
});