
import { test, expect } from '@playwright/test';

const MASTER_EMAIL = 'paulo.santos@teste';
const MASTER_PASSWORD = '050200@Pa';

test.describe('Security and Performance Validation (T01 & T02)', () => {

  test('T02: Dashboard Aggregate Endpoint Performance and Content', async ({ page }) => {
    // Login as Master
    await page.goto('/login');
    await page.fill('input[type="email"]', MASTER_EMAIL);
    await page.fill('input[type="password"]', MASTER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForURL('/');
    
    // Check for dashboard elements
    await expect(page.locator('h1')).toContainText('Bem-vindo');
    
    // Verify specific T02 elements (Overview cards)
    const cards = page.locator('.grid-cols-2 .bg-card');
    await expect(cards).toHaveCount(6);
    
    // Intercept the dashboard report call and verify it's the new aggregate endpoint
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/reports/dashboard')),
      page.reload()
    ]);
    
    const data = await response.json();
    expect(data.overview).toBeDefined();
    expect(data.overview.totalPlans).toBeDefined();
    expect(data.execStats).toBeDefined();
    expect(data.planProgress).toBeDefined();
    expect(data.recent).toBeDefined();
    
    console.log('Dashboard Aggregate API response time: ', response.request().timing().duration, 'ms');
    expect(response.request().timing().duration).toBeLessThan(500); // Expecting under 500ms
  });

  test('T01: RBAC & IDOR Mitigation for Viewer Role', async ({ page, request }) => {
    // 1. Register a new user (default role is viewer)
    const viewerEmail = `viewer_${Date.now()}@test.com`;
    await page.goto('/register');
    await page.fill('input[placeholder="Seu nome completo"]', 'Test Viewer');
    await page.fill('input[type="email"]', viewerEmail);
    await page.fill('input[type="password"]', 'Viewer123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    
    // Get the auth token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('krg_local_auth_token'));
    expect(token).toBeDefined();

    // 2. Attempt unauthorized mutation (T01 Protection)
    // Try to delete a project (should fail with 403)
    const deleteResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'projects',
        action: 'delete',
        filters: [{ column: 'id', value: 'any-id', type: 'eq' }]
      }
    });
    
    expect(deleteResponse.status()).toBe(403);
    const errorBody = await deleteResponse.json();
    expect(errorBody.error.message).toContain('Permissão negada');
    
    // 3. Attempt IDOR: edit someone else's api_keys (should fail with 403)
    const idorResponse = await request.post('/api/db/mutate', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        table: 'api_keys',
        action: 'update',
        values: { key_encrypted: 'hacked' },
        filters: [{ column: 'user_id', value: 'other-user-id', type: 'eq' }]
      }
    });
    
    expect(idorResponse.status()).toBe(403);
    expect(await idorResponse.json()).toMatchObject({
      error: { message: expect.stringContaining('IDOR') }
    });
  });

  test('Red Team: Brute Force Protection on Login', async ({ request }) => {
    // Attempt multiple logins with wrong password
    const loginAttempts = 15;
    let lastStatus = 0;
    
    for (let i = 0; i < loginAttempts; i++) {
      const response = await request.post('/api/auth/login', {
        data: { email: 'fake@user.com', password: 'wrong' }
      });
      lastStatus = response.status();
      if (lastStatus === 429) break;
    }
    
    expect(lastStatus).toBe(429);
  });
});
