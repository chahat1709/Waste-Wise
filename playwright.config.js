const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 30000 },
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
  },
  reporter: 'list',
});
