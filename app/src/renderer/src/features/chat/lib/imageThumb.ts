// 이미지 data URL 을 긴 변 maxPx 로 다운스케일한 JPEG data URL 로 변환한다(순수 DOM, 의존성 0).
// 트랜스크립트 버블/DB 영속용 썸네일 — 원본 base64 를 그대로 저장하면 DB 가 비대해지므로
// 작은 썸네일만 남긴다. 로드 실패/canvas 미지원이면 원본을 그대로 돌려준다(graceful).
export function downscaleDataUrl(dataUrl: string, maxPx = 256): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const longest = Math.max(img.width, img.height)
      const scale = longest > maxPx ? maxPx / longest : 1
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
