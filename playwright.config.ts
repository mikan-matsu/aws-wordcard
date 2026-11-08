import { defineConfig, devices } from '@playwright/test';

// Smoke tests against `next start` on a production build. AppSync is mocked in
// the tests; in CI the build uses test/fixtures/ci-amplify-outputs.json.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4319' },
  webServer: {
    command: 'npx next start -p 4319 -H 127.0.0.1',
    url: 'http://127.0.0.1:4319/privacy',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
