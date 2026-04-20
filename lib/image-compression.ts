type CompressImageOptions = {
  maxLongEdge?: number
  quality?: number
}

const DEFAULT_MAX_LONG_EDGE = 1600
const DEFAULT_QUALITY = 0.82

function getTargetDimensions(width: number, height: number, maxLongEdge: number) {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) {
    return { width, height }
  }

  const scale = maxLongEdge / longEdge

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function getWebpFileName(fileName: string) {
  const trimmedName = fileName.trim()
  const dotIndex = trimmedName.lastIndexOf(".")
  const hasExtension = dotIndex > 0 && dotIndex < trimmedName.length - 1
  const baseName = hasExtension ? trimmedName.slice(0, dotIndex) : trimmedName || "image"

  return `${baseName}.webp`
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality)
  })
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  const maxLongEdge = Math.max(1, options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE)
  const quality = options.quality ?? DEFAULT_QUALITY

  let imageBitmap: ImageBitmap | null = null

  try {
    imageBitmap = await createImageBitmap(file)

    if (imageBitmap.width === 0 || imageBitmap.height === 0) {
      return file
    }

    const target = getTargetDimensions(imageBitmap.width, imageBitmap.height, maxLongEdge)
    const canvas = document.createElement("canvas")
    canvas.width = target.width
    canvas.height = target.height

    const context = canvas.getContext("2d")
    if (!context) return file

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(imageBitmap, 0, 0, target.width, target.height)

    const blob = await canvasToBlob(canvas, quality)
    if (!blob || blob.size >= file.size) return file

    return new File([blob], getWebpFileName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    imageBitmap?.close()
  }
}
