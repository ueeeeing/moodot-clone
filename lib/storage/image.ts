import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const BUCKET = "memory-images"
const TTL_SECONDS = 3600
// 실제 만료 60초 전에 캐시 무효화 (약간의 버퍼)
const CACHE_BUFFER_MS = 60_000

const urlCache = new Map<string, { url: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<string>>()

/**
 * private 버킷에 이미지 업로드.
 * 반환값은 DB의 image_url 컬럼에 저장할 path.
 * 경로 구조: {userId}/{timestamp}-{uuid}.{ext}
 */
export async function uploadImage(file: File, userId: string): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const dotIndex = file.name.lastIndexOf(".")
  const nameExt = dotIndex > -1 && dotIndex < file.name.length - 1
    ? file.name.slice(dotIndex + 1).toLowerCase()
    : ""
  const mimeExt = file.type.split("/")[1]?.split("+")[0]?.toLowerCase() ?? ""
  const ext = nameExt || mimeExt || "jpg"
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error

  return path
}

/**
 * DB에 저장된 path → signed URL (TTL 3600초).
 * - 세션 메모리 캐시로 중복 발급 방지
 * - 동시 요청 dedup (같은 path는 요청 1회만)
 * - force=true 시 캐시 무시 (onError 재시도용)
 */
export function getSignedUrl(path: string, force = false): Promise<string> {
  if (!force) {
    const cached = urlCache.get(path)
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.url)
    const inflight = inFlight.get(path)
    if (inflight) return inflight
  } else {
    urlCache.delete(path)
    inFlight.delete(path)
  }

  const supabase = getSupabaseBrowserClient()
  const promise = supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data, error }) => {
      if (error) throw error
      urlCache.set(path, {
        url: data.signedUrl,
        expiresAt: Date.now() + TTL_SECONDS * 1000 - CACHE_BUFFER_MS,
      })
      inFlight.delete(path)
      return data.signedUrl
    })
    .catch((err) => {
      inFlight.delete(path)
      throw err
    })

  inFlight.set(path, promise)
  return promise
}
