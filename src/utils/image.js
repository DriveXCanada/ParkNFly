/**
 * Image helpers — read a picked file, downscale it, and return a compressed
 * data URL. Photos are stored as data URLs in the prototype (localStorage /
 * mock store). Downscaling keeps localStorage from filling up.
 *
 * BACKEND: replace data-URL storage with uploads to an attachment field
 * object storage (e.g. S3); store the returned URL.
 */

const MAX_DIM = 900
const QUALITY = 0.72

export function readImageResized(file, maxDim = MAX_DIM, quality = QUALITY) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load image'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        try {
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (e) {
          reject(e)
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/** Read several files in parallel → array of data URLs. */
export async function readImagesResized(fileList, maxDim, quality) {
  const files = Array.from(fileList || [])
  const out = []
  for (const f of files) {
    try {
      out.push(await readImageResized(f, maxDim, quality))
    } catch {
      /* skip non-images */
    }
  }
  return out
}
