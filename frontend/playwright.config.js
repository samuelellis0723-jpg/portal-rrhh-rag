import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off', screenshot: 'off', video: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'npm start --prefix ../backend', url: 'http://127.0.0.1:3001/api/v1/health', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
  ],
});
