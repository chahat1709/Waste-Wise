const { test, expect } = require('@playwright/test');

// ---------- Backend API ----------

test('health check is ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('seeded Ahmedabad bins are stored', async ({ request }) => {
  const res = await request.get('/bins');
  expect(res.ok()).toBeTruthy();
  const { bins } = await res.json();
  const amd = bins.filter((b) => String(b.id).startsWith('amd-bin-'));
  expect(amd.length).toBeGreaterThanOrEqual(7);
  for (const b of amd) expect(Number(b.fullness)).toBeGreaterThanOrEqual(85);
});

test('CVRP solves Ahmedabad bins on road matrix', async ({ request }) => {
  const { bins } = await (await request.get('/bins')).json();
  const amd = bins.filter((b) => String(b.id).startsWith('amd-bin-')).slice(0, 4);
  const locations = [{ lat: 23.0225, lng: 72.5714 }, ...amd.map((b) => ({ lat: b.lat, lng: b.lng }))];
  const res = await request.post('/api/cvrp', {
    data: { locations, demands: [0, 2, 2, 2, 2], vehicle_capacities: [10], num_vehicles: 1, depot: 0 },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.routes.length).toBeGreaterThan(0);
  expect(body.total_distance).toBeGreaterThan(0);
  expect(body.data_source).toMatch(/OSRM|Mappls/);
});

test('alerts fire for full bins', async ({ request }) => {
  const res = await request.get('/alerts');
  expect(res.ok()).toBeTruthy();
  const { alerts } = await res.json();
  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts.some((a) => a.type === 'fullness')).toBeTruthy();
});

test('secrets are not served as static files', async ({ request }) => {
  expect(await (await request.get('/.env')).status()).toBe(403);
  expect(await (await request.get('/cvrp_solver.py')).status()).toBe(403);
});

test('legacy admin page redirects to control', async ({ request }) => {
  const res = await request.get('/admin.html', { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe('/admindashboard.html');
});

// ---------- Frontend ----------

test('gate driver button opens driver terminal directly', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /driver/i }).click();
  await page.waitForURL('**/dashboard.html', { timeout: 15000 });
});

test('driver terminal loads map + bins with no login wall', async ({ page }) => {
  await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#routeMap')).toBeVisible();
  await expect
    .poll(async () => page.locator('#binTableBody').innerText(), { timeout: 30000 })
    .toContain('amd-bin-001');
  expect(page.url()).not.toContain('login.html');
  // tab switching keeps map visible
  await page.locator('.tab[data-section="area-bin"]').click();
  await expect(page.locator('#area-bin')).toBeVisible();
  await expect(page.locator('#routeMap')).toBeVisible();
});

test('assigned route renders details card with next stop', async ({ page, request }) => {
  const { bins } = await (await request.get('/bins')).json();
  const three = bins
    .filter((b) => String(b.id).startsWith('amd-bin-'))
    .slice(0, 3)
    .map((b) => ({ id: b.id, lat: b.lat, lng: b.lng }));
  const created = await request.post('/assign-route', {
    data: { driverId: 'driver-123', bins: three, startLocation: { lat: 23.0225, lng: 72.5714 } },
  });
  expect(created.ok()).toBeTruthy();

  await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#routeDetailsCard')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#routeDetailsContent')).toContainText('NEXT:');
  await expect(page.locator('#routeDetailsContent')).toContainText(/km/);
});

test('bin telemetry shows live data', async ({ page }) => {
  await page.goto('/binStatus.html?binId=amd-bin-002', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#currentBinId')).toContainText('amd-bin-002', { timeout: 30000 });
  await expect(page.locator('#binFullness')).toContainText('96', { timeout: 30000 });
  expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(4);
});

test('admin control shows fleet stats', async ({ page }) => {
  await page.goto('/admindashboard.html', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => page.locator('#totalBins').innerText(), { timeout: 30000 })
    .not.toBe('0');
});

test('forgot password page is wired', async ({ page }) => {
  await page.goto('/forgot-password.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#resetEmail')).toBeVisible();
  await expect(page.locator('#resetButton')).toBeVisible();
});
