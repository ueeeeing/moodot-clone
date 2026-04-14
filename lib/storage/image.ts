import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const BUCKET = "memory-images"

/**
 * private 버킷에 이미지 업로드.
 * 반환값은 DB의 image_url 컬럼에 저장할 path.
 * 경로 구조: {userId}/{timestamp}-{uuid}.{ext}
 */
export async function uploadImage(file: File, userId: string): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase()
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error

  return path
}

/**
 * DB에 저장된 path → signed URL (TTL 3600초).
 * 이미지 표시 시점에만 호출한다.
 */
export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
