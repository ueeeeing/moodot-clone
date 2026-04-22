/**
 * 테스트 전용 로그인으로 Supabase 세션을 storageState에 저장하는 설정 스크립트.
 * Google OAuth를 사용하지 않고 /api/test-login 엔드포인트를 통해 완전 자동화.
 *
 * 사전 조건:
 *   - PERF_TEST_SECRET 환경변수 설정 (로컬 .env.local 및 Vercel)
 *   - PERF_TEST_EMAIL / PERF_TEST_PASSWORD 환경변수 설정 (서버 측)
 *   - Supabase에 해당 이메일/비밀번호 계정 존재
 *
 * 실행:
 *   npm run test:perf:setup
 *   PERF_BASE_URL=https://moodot-clone.vercel.app npm run test:perf:setup
 */

import { test, expect } from "@playwright/test"
import { ensureAuthDir, AUTH_STATE_PATH } from "../utils/constants"

test("save test auth state via /api/test-login", async ({ page, context }) => {
  ensureAuthDir()

  const secret = process.env.PERF_TEST_SECRET
  if (!secret) {
    throw new Error(
      "PERF_TEST_SECRET 환경변수가 설정되지 않았습니다.\n" +
      "로컬: .env.local에 PERF_TEST_SECRET=<임의 문자열> 추가\n" +
      "Vercel: Environment Variables에 동일값 추가",
    )
  }

  // ── 1. 사이트 진입 — 도메인 확립 + anonymous auth 완료 대기 ─────────────────
  await page.goto("/")
  await page.waitForLoadState("networkidle", { timeout: 20_000 })

  // ── 2. 테스트 로그인 API 호출 ────────────────────────────────────────────────
  // page.request는 페이지 컨텍스트와 쿠키를 공유하므로
  // 응답의 Set-Cookie가 브라우저 컨텍스트에 자동 반영됨
  const apiRes = await page.request.post("/api/test-login", {
    headers: { "x-perf-secret": secret },
  })

  if (!apiRes.ok()) {
    const body = await apiRes.json().catch(() => ({}))
    throw new Error(
      `/api/test-login 실패 (HTTP ${apiRes.status()}): ${JSON.stringify(body)}\n\n` +
      "확인 사항:\n" +
      "  - 서버에 PERF_TEST_SECRET, PERF_TEST_EMAIL, PERF_TEST_PASSWORD 설정 여부\n" +
      "  - Supabase에 해당 계정 존재 여부",
    )
  }

  // ── 3. 세션 적용 확인을 위해 재진입 ──────────────────────────────────────────
  // 쿠키가 설정된 상태로 재로드 → Supabase 클라이언트가 테스트 계정 세션 인식
  await page.goto("/")
  await page.waitForLoadState("networkidle", { timeout: 20_000 })

  // ── 4. 로그인 상태 검증 (로그인 페이지로 튕기지 않는지 확인) ────────────────
  expect(page.url()).not.toContain("/login")

  // ── 5. storageState 저장 ─────────────────────────────────────────────────────
  await context.storageState({ path: AUTH_STATE_PATH })

  console.log("\n" + "─".repeat(60))
  console.log(`✅ Auth state saved → ${AUTH_STATE_PATH}`)
  console.log("   이제 npm run test:perf 를 실행할 수 있습니다.")
  console.log("─".repeat(60) + "\n")
})
