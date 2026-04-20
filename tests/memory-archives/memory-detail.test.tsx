import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { MemoryRow } from "@/lib/services/memory"
import { MemoryDetail } from "@/components/moodot/memory-detail"

const { pushMock, getMemoryByIdMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  getMemoryByIdMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@/lib/services/memory", () => ({
  getMemoryById: getMemoryByIdMock,
}))

vi.mock("@/components/moodot/signed-image", () => ({
  SignedImage: ({
    path,
    alt,
  }: {
    path: string | null
    alt: string
    className?: string
  }) => <div data-testid="signed-image">{`${alt}:${path}`}</div>,
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function makeMemory(overrides: Partial<MemoryRow> = {}): MemoryRow {
  return {
    id: 7,
    title: "봄날의 산책",
    text: "산책하며 벚꽃을 봤다.",
    image_url: null,
    emotion_id: 1,
    with_whom: "Solo",
    memory_at: "2026-04-21T10:30:00.000Z",
    place_name: null,
    location_label: null,
    location_lat: null,
    location_lng: null,
    ...overrides,
  }
}

function installLeafletMock() {
  const fakeMap = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
  }

  ;(window as Window & { L?: unknown }).L = {
    map: vi.fn(() => fakeMap),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn(),
      remove: vi.fn(),
    })),
  }
}

describe("MemoryDetail", () => {
  beforeEach(() => {
    pushMock.mockReset()
    getMemoryByIdMock.mockReset()
    installLeafletMock()
  })

  it("초기 로딩 후 단건 데이터를 렌더링한다", async () => {
    const deferred = createDeferred<MemoryRow>()
    getMemoryByIdMock.mockReturnValueOnce(deferred.promise)

    render(<MemoryDetail id={7} />)

    expect(screen.getByText("불러오는 중...")).toBeInTheDocument()

    deferred.resolve(
      makeMemory({
        id: 7,
        title: "첫 단건 기록",
      }),
    )

    expect(await screen.findByText("첫 단건 기록")).toBeInTheDocument()
    expect(getMemoryByIdMock).toHaveBeenCalledWith(7)
  })

  it("본문, 이미지, 위치 정보가 있으면 해당 섹션을 렌더링한다", async () => {
    getMemoryByIdMock.mockResolvedValueOnce(
      makeMemory({
        text: "오늘의 상세 본문",
        image_url: "memory-images/user/photo.webp",
        with_whom: "Together",
        place_name: "서울숲",
        location_label: "서울 성동구",
        location_lat: 37.544,
        location_lng: 127.037,
      }),
    )

    render(<MemoryDetail id={7} />)

    expect(await screen.findByText("오늘의 상세 본문")).toBeInTheDocument()
    expect(screen.getByTestId("signed-image")).toHaveTextContent("Memory photo:memory-images/user/photo.webp")
    expect(screen.getByText("서울숲")).toBeInTheDocument()
    expect(screen.getByText("서울 성동구")).toBeInTheDocument()
    expect(screen.getByText("TOGETHER")).toBeInTheDocument()
  })

  it("optional 값이 없으면 본문, 이미지, 위치 섹션을 숨긴다", async () => {
    getMemoryByIdMock.mockResolvedValueOnce(
      makeMemory({
        text: null,
        image_url: null,
        place_name: "숨겨져야 하는 장소",
        location_label: "숨겨져야 하는 주소",
        location_lat: null,
        location_lng: null,
      }),
    )

    render(<MemoryDetail id={7} />)

    expect(await screen.findByText("봄날의 산책")).toBeInTheDocument()
    expect(screen.queryByText("산책하며 벚꽃을 봤다.")).not.toBeInTheDocument()
    expect(screen.queryByTestId("signed-image")).not.toBeInTheDocument()
    expect(screen.queryByText("숨겨져야 하는 장소")).not.toBeInTheDocument()
    expect(screen.queryByText("숨겨져야 하는 주소")).not.toBeInTheDocument()
  })

  it("위치 섹션은 lat 와 lng 가 둘 다 있을 때만 렌더링된다", async () => {
    getMemoryByIdMock.mockResolvedValueOnce(
      makeMemory({
        place_name: "좌표 부족 장소",
        location_label: "좌표 부족 주소",
        location_lat: 37.5,
        location_lng: null,
      }),
    )

    render(<MemoryDetail id={7} />)

    expect(await screen.findByText("봄날의 산책")).toBeInTheDocument()
    expect(screen.queryByText("좌표 부족 장소")).not.toBeInTheDocument()
    expect(screen.queryByText("좌표 부족 주소")).not.toBeInTheDocument()
  })
})
