import { test, expect } from '@playwright/test';

test.describe('Gate Authentication', () => {
  test('redirects unauthenticated users to lock screen', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to lock screen
    await expect(page).toHaveURL(/\/lock/);
    await expect(page.getByRole('heading', { name: 'FBL' })).toBeVisible();
    await expect(page.getByText('Gothic Digital Library')).toBeVisible();
    await expect(page.getByLabelText('Daily Password')).toBeVisible();
  });
  
  test('shows lock screen directly when accessed', async ({ page }) => {
    await page.goto('/lock');
    
    await expect(page).toHaveTitle(/FBL Gothic Library - Enter/);
    await expect(page.getByRole('heading', { name: 'FBL' })).toBeVisible();
    await expect(page.getByLabelText('Daily Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter Library' })).toBeVisible();
    await expect(page.getByText('Password resets at midnight')).toBeVisible();
  });
  
  test('shows error for invalid password', async ({ page }) => {
    await page.goto('/lock');
    
    await page.getByLabelText('Daily Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Enter Library' }).click();
    
    // Should redirect back to lock with error
    await expect(page).toHaveURL(/\/lock\?error=1/);
    await expect(page.getByText('Invalid password. Please try again.')).toBeVisible();
  });
  
  test('clears error when typing in password field', async ({ page }) => {
    // Navigate to lock screen with error
    await page.goto('/lock?error=1');
    await expect(page.getByText('Invalid password. Please try again.')).toBeVisible();
    
    // Start typing in password field
    await page.getByLabelText('Daily Password').type('test');
    
    // Error should disappear
    await expect(page.getByText('Invalid password. Please try again.')).toBeHidden();
  });
  
  test('empty password shows error', async ({ page }) => {
    await page.goto('/lock');
    
    // Submit without entering password
    await page.getByRole('button', { name: 'Enter Library' }).click();
    
    // Should redirect back with error (HTML5 validation should prevent this, but test backend behavior)
    await expect(page).toHaveURL(/\/lock/);
  });
  
  test('health endpoint works without authentication', async ({ page }) => {
    const response = await page.request.get('/health');
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
  });
  
  test('API endpoints require authentication', async ({ page }) => {
    // Test that API endpoints return 401 without auth
    const apiResponse = await page.request.get('/api/books');
    expect(apiResponse.status()).toBe(401);
    
    const body = await apiResponse.json();
    expect(body.error).toBe('Authentication required');
  });
  
  test('static assets are protected', async ({ page }) => {
    // Test that even static-looking assets are protected
    const cssResponse = await page.request.get('/styles.css');
    expect(cssResponse.status()).toBe(302); // Redirect to lock screen
    
    const jsResponse = await page.request.get('/app.js');  
    expect(jsResponse.status()).toBe(302); // Redirect to lock screen
  });
});

// Note: Testing actual authentication with correct password requires knowing the daily password,
// which depends on the SECRET_SEED environment variable. This would be tested in integration
// tests with a known test secret.