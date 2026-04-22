import { test } from "@playwright/test"
import { measureScenario, printSummary, saveResults } from "./utils/measure"
import { AUTH_STATE_PATH, authStateExists } from "./utils/constants"
import type { ScenarioResult } from "./utils/measure"

const REPEAT = Number(process.env.PERF_REPEAT ?? "20")

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 1 — public baseline
// 매 반복마다 쿠키/localStorage 초기화 → cold-ish load 측정
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("public baseline", () => {
  test("screens", async ({ page }) => {
    const results: ScenarioResult[] = []

    // ── 1. 홈 화면 (/) ─────────────────────────────────────────────────────────
    // JournalEntry의 "New Memory" 버튼이 노출되면 핵심 컨텐츠 렌더 완료로 판단
    results.push(
      await measureScenario(
        page,
        "Home (/)",
        async (p) => {
          await p.goto("/")
          await p.waitForLoadState("networkidle", { timeout: 20_000 })
          await p.waitForSelector("text=New Memory", { timeout: 15_000 })
        },
        REPEAT,
        { group: "public" },
      ),
    )

    // ── 2. 아카이브(기록) 화면 (/records) ──────────────────────────────────────
    // 검색창 노출 → 컴포넌트 마운트 완료
    // "메모리를 불러오는 중..." 사라짐 → 데이터 fetch 완료 (빈 목록도 성공)
    results.push(
      await measureScenario(
        page,
        "Records (/records)",
        async (p) => {
          await p.goto("/records")
          await p.waitForLoadState("networkidle", { timeout: 20_000 })
          await p.waitForSelector('input[placeholder="Search your memories..."]', { timeout: 15_000 })
          await p.waitForSelector("text=메모리를 불러오는 중...", {
            state: "hidden",
            timeout: 15_000,
          })
        },
        REPEAT,
        { group: "public" },
      ),
    )

    // ── 3. 캘린더 화면 (/calendar) ─────────────────────────────────────────────
    // CalendarView는 즉시 렌더(props 기반) → 요일 헤더 "토"가 노출되면 완료
    // 데이터(mood record)는 networkidle로 확인
    results.push(
      await measureScenario(
        page,
        "Calendar (/calendar)",
        async (p) => {
          await p.goto("/calendar")
          await p.waitForLoadState("networkidle", { timeout: 20_000 })
          // 요일 헤더 행 — CalendarView가 마운트되면 항상 렌더됨
          await p.waitForSelector("text=토", { timeout: 15_000 })
        },
        REPEAT,
        { group: "public" },
      ),
    )

    // ── 4. 컬렉션 화면 (/collection) ───────────────────────────────────────────
    // h1("컬렉션") 노출 → 컴포넌트 마운트 완료
    // animate-pulse 스켈레톤 사라짐 → 데이터 fetch 완료 (빈 목록도 성공)
    results.push(
      await measureScenario(
        page,
        "Collection (/collection)",
        async (p) => {
          await p.goto("/collection")
          await p.waitForLoadState("networkidle", { timeout: 20_000 })
          await p.waitForSelector('h1:has-text("컬렉션")', { timeout: 15_000 })
          await p.waitForSelector(".animate-pulse", {
            state: "hidden",
            timeout: 15_000,
          })
        },
        REPEAT,
        { group: "public" },
      ),
    )

    // ── 5. 메모리 생성 화면 (/memory-create) ───────────────────────────────────
    // 저장 버튼("기록하기") + 감정 선택 버튼("Good") 노출 → 폼 렌더 완료
    results.push(
      await measureScenario(
        page,
        "Memory Create (/memory-create)",
        async (p) => {
          await p.goto("/memory-create")
          await p.waitForLoadState("networkidle", { timeout: 20_000 })
          await p.waitForSelector("text=기록하기", { timeout: 15_000 })
          await p.waitForSelector("text=Good", { timeout: 15_000 })
        },
        REPEAT,
        { group: "public" },
      ),
    )

    printSummary(results)
    saveResults(results)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 2 — authenticated baseline
// storageState로 Google 로그인 세션 재사용 (매 반복마다 세션 유지)
// 사전 조건: npm run test:perf:setup 실행 필요
// ═══════════════════════════════════════════════════════════════════════════════

// authStateExists()를 모듈 로드 시점에 1회만 평가
const _authReady = authStateExists()

// storageState는 파일이 존재할 때만 적용 (없으면 test.skip으로 건너뜀)
if (_authReady) {
  test.describe("authenticated baseline", () => {
    test.use({ storageState: AUTH_STATE_PATH })

    test("actions", async ({ page }) => {
      const results: ScenarioResult[] = []

      // ── 6. 메모리 저장 완료 (form submit → /memory/[id] redirect) ────────────
      // 저장 성공 = /memory/[id] 로 redirect + networkidle
      // 제목에 [perf] prefix를 달아 테스트 데이터임을 식별 가능하게 함
      results.push(
        await measureScenario(
          page,
          "Memory Save (submit → detail)",
          async (p) => {
            await p.goto("/memory-create")
            // 저장 버튼 + 감정 버튼 노출까지 대기 (폼 완전 렌더)
            await p.waitForSelector("text=기록하기", { timeout: 20_000 })
            await p.waitForSelector("text=Good", { timeout: 10_000 })

            // 제목 입력 (테스트 데이터 식별용 prefix)
            await p.fill('input[placeholder="Memory Title"]', "[perf] baseline test")

            // 기본 mood=good 선택된 상태로 저장
            await p.click("text=기록하기")

            // 저장 성공 → /memory/[id] redirect
            await p.waitForURL(/\/memory\/\d+$/, { timeout: 20_000 })
            await p.waitForLoadState("networkidle", { timeout: 15_000 })
          },
          REPEAT,
          { preserveAuthSession: true, group: "authenticated" },
        ),
      )

      // ── 7. 메모리 상세 진입 (/memory/[id]) ─────────────────────────────────
      // Records에서 첫 번째 항목 클릭 → 상세 페이지 로드 측정
      // (시나리오 6에서 생성한 항목이 최신순으로 상단에 위치)
      results.push(
        await measureScenario(
          page,
          "Memory Detail (records → detail)",
          async (p) => {
            await p.goto("/records")
            await p.waitForLoadState("networkidle", { timeout: 20_000 })
            // 검색창 노출 = 컴포넌트 마운트, 로딩 텍스트 사라짐 = fetch 완료
            await p.waitForSelector('input[placeholder="Search your memories..."]', {
              timeout: 15_000,
            })
            await p.waitForSelector("text=메모리를 불러오는 중...", {
              state: "hidden",
              timeout: 15_000,
            })

            // 첫 번째 메모리 카드 클릭 (article 태그, onClick으로 navigate)
            const firstCard = p.locator("article").first()
            await firstCard.waitFor({ state: "visible", timeout: 10_000 })
            await firstCard.click()

            // 상세 페이지로 이동 완료
            await p.waitForURL(/\/memory\/\d+$/, { timeout: 15_000 })
            await p.waitForLoadState("networkidle", { timeout: 15_000 })
          },
          REPEAT,
          { preserveAuthSession: true, group: "authenticated" },
        ),
      )

      printSummary(results)
      saveResults(results)
    })
  })
} else {
  // storageState 파일이 없으면 authenticated 그룹 전체를 skip
  test.describe("authenticated baseline", () => {
    test("actions", async () => {
      test.skip(
        true,
        `Auth state not found at:\n  ${AUTH_STATE_PATH}\n\nRun first:\n  npm run test:perf:setup`,
      )
    })
  })
}
