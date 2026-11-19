// NEON XI QA suite. Run from the repository root:
//   npx playwright test -c qa-suite                 # all specs once
//   npx playwright test -c qa-suite --repeat-each 5  # five independent repetitions
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './.artifacts/test-results',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: './.artifacts/results.json' }]],
  use: { trace: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000 },
});
