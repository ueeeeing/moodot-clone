/**
 * 성능 테스트 전용 로그인 엔드포인트.
 *
 * 보안 조건 (모두 충족해야 동작):
 *   1. PERF_TEST_SECRET 환경변수가 설정되어 있을 것
 *   2. 요청 헤더 x-perf-secret 값이 PERF_TEST_SECRET와 일치할 것
 *   3. PERF_TEST_EMAIL / PERF_TEST_PASSWORD 환경변수가 설정되어 있을 것
 *
 * PERF_TEST_SECRET를 Vercel 환경변수에 추가하지 않으면
 * production 배포에서는 이 엔드포인트가 항상 403을 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function POST(req: NextRequest) {
  // ── 1. 시크릿 검증 ─────────────────────────────────────────────────────────
  const configuredSecret = process.env.PERF_TEST_SECRET
  const requestSecret    = req.headers.get("x-perf-secret")

  if (!configuredSecret || requestSecret !== configuredSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── 2. 테스트 계정 환경변수 확인 ────────────────────────────────────────────
  const email    = process.env.PERF_TEST_EMAIL
  const password = process.env.PERF_TEST_PASSWORD

  if (!email || !password) {
    return NextResponse.json(
      { error: "PERF_TEST_EMAIL / PERF_TEST_PASSWORD not configured" },
      { status: 503 },
    )
  }

  // ── 3. 로그인 + 쿠키 응답 ───────────────────────────────────────────────────
  // createServerClient가 signInWithPassword 완료 후 setAll()을 호출하면
  // response의 Set-Cookie로 Supabase 세션 쿠키가 자동 설정됨.
  // Playwright page.request는 Set-Cookie를 브라우저 컨텍스트에 자동 반영.
  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              // httpOnly를 끄면 브라우저 JS(Supabase 클라이언트)가 읽을 수 있음
              httpOnly: false,
              sameSite: "lax",
            })
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return response
}

// GET 요청은 명시적으로 차단
export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
