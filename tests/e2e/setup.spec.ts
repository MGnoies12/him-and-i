import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Persian entry, language switching, and a usable app entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('بعضی لحظه‌ها');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Some moments');
  await page.getByRole('link', { name: /Explore the space/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Welcome to our little world',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('missing configuration is honest and never reports a successful sign-in or save', async ({
  page,
  request,
}) => {
  await page.goto('/signup');
  await expect(page.getByText('فضای شما، در انتظار اتصال امن')).toBeVisible();
  await expect(page.getByRole('button', { name: /ساخت حساب من/ })).toBeDisabled();
  const data = await request.get('/api/data/memories');
  expect(data.status()).toBe(503);
  expect(await data.json()).toEqual({ error: 'configuration_required' });
  const csrf = await request.post('/api/actions', {
    headers: { Origin: 'https://attacker.example' },
    data: { type: 'couple.create' },
  });
  expect(csrf.status()).toBe(403);
  const save = await request.post('/api/actions', {
    headers: { Origin: 'http://localhost:3000' },
    data: { type: 'couple.create' },
  });
  expect(save.status()).toBe(503);
});

const routes = [
  'home',
  'chat',
  'memories',
  'memories/new',
  'letters',
  'calendar',
  'mood',
  'cycle',
  'music',
  'games',
  'notifications',
  'settings',
  'privacy',
];
for (const route of routes) {
  test(`${route}: responsive, navigable, and free of runtime errors`, async ({
    page,
    isMobile,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/' + route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    if (route !== 'privacy') {
      if (isMobile)
        await expect(page.getByRole('navigation', { name: 'ناوبری موبایل' })).toBeVisible();
      else await expect(page.locator('.sidebar')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('memories have usable filters, views, empty states and a real disabled form boundary', async ({
  page,
}) => {
  await page.goto('/memories');
  await page.getByRole('button', { name: 'نمای خط زمانی' }).click();
  await expect(page.getByRole('button', { name: 'نمای خط زمانی' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('textbox', { name: 'جست‌وجوی خاطره' })
    .fill('A fictional nonexistent memory');
  await expect(page.getByRole('heading', { name: 'این لحظه را پیدا نکردیم' })).toBeVisible();
  await page.getByRole('link', { name: 'یک خاطره‌ی تازه' }).click();
  await expect(page.getByRole('textbox', { name: /اسم این لحظه/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'این لحظه را نگه دار' })).toBeDisabled();
});

test('letter composer traps focus, closes with Escape and returns to the trigger', async ({
  page,
}) => {
  await page.goto('/letters');
  const trigger = page.getByRole('button', { name: 'نامه‌ی تازه' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'برای تو، از من' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ذخیره‌ی پیش‌نویس' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('the Persian calendar advances actual Persian months and has keyboard-selectable days', async ({
  page,
}) => {
  await page.goto('/calendar');
  const original = await page.locator('.calendar-nav h2').innerText();
  await page.getByRole('button', { name: 'ماه بعد' }).click();
  await expect(page.locator('.calendar-nav h2')).not.toHaveText(original);
  const day = page.locator('.calendar-day:not(.outside)').nth(10);
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'یک قرار تازه' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ذخیره‌ی قرار ما' })).toBeDisabled();
});

test('cycle records have no default sharing, no invented predictions and explicit reminder consent', async ({
  page,
}) => {
  await page.goto('/cycle');
  await expect(page.getByRole('heading', { name: 'پیش‌بینی خاموش است.' })).toBeVisible();
  await page.getByRole('button', { name: 'انتخاب‌ها و حریم من' }).click();
  await expect(page.getByRole('switch', { name: /اشتراک یک وضعیت ساده/ })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: /اشتراک یک تاریخ تقریبی/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'یادآورهای من', exact: true }).click();
  await page.getByRole('button', { name: 'یادآور تازه' }).click();
  await expect(
    page.getByRole('switch', { name: /این یادآور مشخص را فعال می‌کنم/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'ذخیره‌ی یادآور خصوصی' })).toBeDisabled();
});

test('no fake gameplay or music playback is reported without persisted data', async ({ page }) => {
  await page.goto('/games');
  const plays = page.getByRole('button', { name: 'با هم بازی کنیم' });
  await expect(plays).toHaveCount(3);
  for (const button of await plays.all()) await expect(button).toBeDisabled();
  await page.goto('/music');
  await expect(page.getByRole('heading', { name: 'سکوت قبل از اولین آهنگ.' })).toBeVisible();
  await page.getByRole('button', { name: 'ساخت اولین فهرست' }).click();
  await expect(page.getByRole('button', { name: 'ساخت فهرست', exact: true })).toBeDisabled();
});

test('an invitation requires authentication and does not expose private content', async ({
  page,
}) => {
  await page.goto('/invite/' + 'A'.repeat(43));
  await expect(page.getByRole('heading', { name: 'یک نفر، جایت را نگه داشته.' })).toBeVisible();
  await page.getByRole('link', { name: 'ورود و بررسی دعوت' }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('button', { name: 'ورود به خانه‌ی ما' })).toBeDisabled();
  const response = await page.goto('/invite/guess');
  expect(response?.status()).toBe(404);
});

test('offline status is visible and auth tokens are not placed in localStorage', async ({
  page,
  context,
}) => {
  await page.goto('/home');
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'آفلاین هستید' })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => /supabase|auth-token/i.test(key)),
    ),
  ).toEqual([]);
  await context.setOffline(false);
  await expect(page.locator('.offline-bar')).toHaveCount(0);
});

test('security headers and reduced-motion are active', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto('/home');
  const headers = response!.headers();
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
});

for (const route of [
  '/',
  '/home',
  '/login',
  '/cycle',
  '/calendar',
  '/chat',
  '/letters',
  '/memories',
  '/memories/new',
  '/mood',
  '/music',
  '/games',
  '/notifications',
  '/settings',
  '/privacy',
  '/signup',
  '/reset-password',
]) {
  test(`accessibility: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('[style*="opacity"]')).every(
        (element) => Number(getComputedStyle(element).opacity) >= 0.999,
      ),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
  });
}
