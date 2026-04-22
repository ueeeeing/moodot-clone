import type { Page } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RunResult {
  duration: number     // 시나리오 총 소요 시간 (ms)
  ttfb: number | null  // Time to First Byte (ms)
  fcp: number | null   // First Contentful Paint (ms)
  requestCount: number // 페이지 로드 중 네트워크 요청 수
  success: boolean
  error?: string
}

export interface ScenarioResult {
  scenario: string
  group: "public" | "authenticated"
  env: string
  timestamp: string
  runs: RunResult[]
  avg: number
  p95: number
  successRate: number
  avgFcp: number | null
  avgTtfb: number | null
  failures: RunResult[]
}

export interface ReportFile {
  env: string
  profile: string
  baseURL: string
  measuredAt: string
  scenarios: ScenarioResult[]
}

export interface MeasureOptions {
  /**
   * true: 반복 실행 간 쿠키/localStorage를 초기화하지 않음.
   * 로그인 세션을 유지해야 하는 authenticated 시나리오에 사용.
   */
  preserveAuthSession?: boolean
  /** 결과 분류용 그룹 레이블 */
  group?: "public" | "authenticated"
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function nullableAvg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  return valid.length > 0 ? avg(valid) : null
}

// ─── Web vitals 수집 ──────────────────────────────────────────────────────────

async function collectWebVitals(
  page: Page,
): Promise<{ fcp: number | null; ttfb: number | null }> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined
    const ttfb = nav
      ? Math.round(nav.responseStart - nav.requestStart)
      : null

    const paintEntries = performance.getEntriesByType("paint")
    const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint")
    const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : null

    return { fcp, ttfb }
  })
}

// ─── 핵심 측정 함수 ───────────────────────────────────────────────────────────

/**
 * 단일 시나리오를 한 번 실행하고 RunResult를 반환합니다.
 */
export async function measureOnce(
  page: Page,
  scenarioFn: (page: Page) => Promise<void>,
): Promise<RunResult> {
  const requests: string[] = []
  const onRequest = (req: { url: () => string }) => requests.push(req.url())
  page.on("request", onRequest)

  const start = Date.now()
  let success = true
  let error: string | undefined

  try {
    await scenarioFn(page)
  } catch (e) {
    success = false
    error = e instanceof Error ? e.message : String(e)
  }

  const duration = Date.now() - start
  page.off("request", onRequest)

  const { fcp, ttfb } = success
    ? await collectWebVitals(page).catch(() => ({ fcp: null, ttfb: null }))
    : { fcp: null, ttfb: null }

  return {
    duration,
    ttfb,
    fcp,
    requestCount: requests.length,
    success,
    error,
  }
}

/**
 * 시나리오를 repeat 회 반복 실행하고 통계를 계산합니다.
 *
 * @param options.preserveAuthSession - true면 반복 간 쿠키/localStorage를 초기화하지 않음
 * @param options.group - 결과 분류 레이블 ("public" | "authenticated")
 */
export async function measureScenario(
  page: Page,
  name: string,
  scenarioFn: (page: Page) => Promise<void>,
  repeat = 20,
  options: MeasureOptions = {},
): Promise<ScenarioResult> {
  const { preserveAuthSession = false, group = "public" } = options
  const env = process.env.PERF_ENV ?? "vercel"
  const runs: RunResult[] = []

  for (let i = 0; i < repeat; i++) {
    if (!preserveAuthSession) {
      // cold-ish load 측정: auth가 없는 public 시나리오는 매번 초기화
      await page.context().clearCookies()
      await page.evaluate(() => {
        try { localStorage.clear() } catch {}
      })
    }

    const result = await measureOnce(page, scenarioFn)
    runs.push(result)

    const status = result.success ? "✅" : "❌"
    console.log(
      `  ${status} [${name}] run ${i + 1}/${repeat} — ${result.duration}ms` +
      (result.fcp != null ? ` | FCP ${result.fcp}ms` : "") +
      (result.error ? ` | ${result.error}` : ""),
    )

    // 연속 요청 사이 짧은 대기 (서버 부하 방지)
    await page.waitForTimeout(500)
  }

  const successRuns = runs.filter((r) => r.success)
  const durations = successRuns.map((r) => r.duration).sort((a, b) => a - b)

  return {
    scenario: name,
    group,
    env,
    timestamp: new Date().toISOString(),
    runs,
    avg: avg(durations),
    p95: durations.length > 0 ? percentile(durations, 95) : 0,
    successRate: Math.round((successRuns.length / runs.length) * 100),
    avgFcp: nullableAvg(successRuns.map((r) => r.fcp)),
    avgTtfb: nullableAvg(successRuns.map((r) => r.ttfb)),
    failures: runs.filter((r) => !r.success),
  }
}

// ─── 결과 저장 및 출력 ────────────────────────────────────────────────────────

export function printSummary(results: ScenarioResult[]) {
  const COL = { scenario: 32, stat: 8, success: 9 }
  const LINE = "=".repeat(74)
  const DIVIDER = "-".repeat(74)
  const header =
    `${"Scenario".padEnd(COL.scenario)} ` +
    `${"Avg".padStart(COL.stat)} ` +
    `${"p95".padStart(COL.stat)} ` +
    `${"FCP".padStart(COL.stat)} ` +
    `${"TTFB".padStart(COL.stat)} ` +
    `${"Success".padStart(COL.success)}`

  console.log("\n" + LINE)
  console.log("📊 Performance Baseline Summary")

  for (const group of ["public", "authenticated"] as const) {
    const groupResults = results.filter((r) => r.group === group)
    if (groupResults.length === 0) continue

    console.log(LINE)
    console.log(`[${group}]`)
    console.log(header)
    console.log(DIVIDER)

    for (const r of groupResults) {
      const fcp  = r.avgFcp  != null ? `${r.avgFcp}ms`  : "N/A"
      const ttfb = r.avgTtfb != null ? `${r.avgTtfb}ms` : "N/A"
      console.log(
        `${r.scenario.padEnd(COL.scenario)} ` +
        `${`${r.avg}ms`.padStart(COL.stat)} ` +
        `${`${r.p95}ms`.padStart(COL.stat)} ` +
        `${fcp.padStart(COL.stat)} ` +
        `${ttfb.padStart(COL.stat)} ` +
        `${`${r.successRate}%`.padStart(COL.success)}`,
      )
    }
  }

  console.log(LINE + "\n")
}

export function saveResults(results: ScenarioResult[]) {
  const env = process.env.PERF_ENV ?? "vercel"
  const profile = process.env.PERF_PROFILE ?? "mobile"
  const baseURL = process.env.PERF_BASE_URL ?? "http://localhost:3000"
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `perf-${env}-${profile}-${timestamp}.json`
  const outputDir = path.join(process.cwd(), "tests/performance/results")

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const report: ReportFile = {
    env,
    profile,
    baseURL,
    measuredAt: new Date().toISOString(),
    scenarios: results,
  }

  const filepath = path.join(outputDir, filename)
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8")
  console.log(`💾 Results saved → ${filepath}`)
}
