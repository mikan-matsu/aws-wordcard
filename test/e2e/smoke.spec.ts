import { test, expect, Page } from '@playwright/test';

const WORD = {
  __typename: 'Word',
  id: 'smoke-1',
  word: 'SMOKETESTWORD',
  meaning: 'スモークテスト用の意味',
  category: 'コンピューティング',
  description: 'テスト用の説明',
  status: 'PUBLISHED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Answer every AppSync GraphQL call with one word, so the tests never reach AWS
// and a dependency update that breaks data loading or rendering fails here.
async function prepare(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/graphql', (route) => {
    const body = route.request().postDataJSON() ?? {};
    const query: string = body.query ?? '';
    const name = /(list\w+)/.exec(query)?.[1] ?? 'listWords';
    return route.fulfill({ json: { data: { [name]: { items: [WORD], nextToken: null } } } });
  });
  return errors;
}

for (const path of ['/', '/words', '/privacy']) {
  test(`${path} が表示でき、JavaScriptエラーがない`, async ({ page }) => {
    const errors = await prepare(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}

test('トップでAPIの単語カードが表示される', async ({ page }) => {
  const errors = await prepare(page);
  await page.goto('/');
  await expect(page.getByText(WORD.word).first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('ログインボタンがある(押さない)', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  // The label text is hidden on narrow screens; the Google logo is always there.
  await expect(page.locator('button:has(path[fill="#4285F4"])').first()).toBeVisible();
});

test('robots.txt と sitemap.xml が返る', async ({ request }) => {
  for (const path of ['/robots.txt', '/sitemap.xml']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
  }
});

test('横にはみ出さない', async ({ page }) => {
  await prepare(page);
  for (const path of ['/', '/words']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, path).toBe(false);
  }
});
