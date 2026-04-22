import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./",
  testMatch: "save-auth.setup.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://localhost:3000",
    bypassCSP: true,
    // Google OAuth가 필요 없으므로 기본 Chromium headless로 충분
  },
})
