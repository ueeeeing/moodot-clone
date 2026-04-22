import { defineConfig, devices } from "@playwright/test"

// PERF_PROFILE=mobile (default) | desktop
const PROFILE = process.env.PERF_PROFILE ?? "mobile"

const profileOptions =
  PROFILE === "desktop"
    ? { viewport: { width: 1440, height: 900 } }
    : { ...devices["iPhone 14"] } // mobile default

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.perf.spec.ts",
  timeout: 30 * 60 * 1000,  // 30분 — 20반복 × 7시나리오 기준 충분한 여유
  retries: 0,        // 재시도 없이 실패도 그대로 기록
  workers: 1,        // 순차 실행 — 병렬 실행 시 결과가 오염됨
  reporter: "list",

  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://localhost:3000",
    ...profileOptions,
    bypassCSP: true,
  },
})
