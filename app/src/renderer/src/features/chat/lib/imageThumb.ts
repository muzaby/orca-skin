// 이미지 data URL 을 긴 변 maxPx 로 다운스케일한 JPEG data URL 로 변환한다(순수 DOM, 의존성 0).
// 트랜스크립트 버블/DB 영속용 썸네일 — 원본 base64 를 그대로 저장하면 DB 가 비대해지므로
// 작은 썸네일만 남긴다. 실패하면 원본을 돌려주지 않고 실패 이유를 돌려준다 — 그 첨부 뷰는 미리보기 없이
// 파일로 보인다(0325 D-012). `onload` 본문 전체(canvas 생성·`getContext`·`drawImage`·인코딩)가 예외
// 경계 안이라 어느 단계가 던져도 settle 한다 — 이벤트 콜백의 예외는 바깥 Promise 를 reject 하지 않아
// 경계가 없으면 전송이 멈춘다(0325 D-041 · EP-9 ①).
export type ThumbnailResult =
  { ok: true; dataUrl: string } | { ok: false; reason: 'load' | 'canvas' | 'draw' | 'encode' }

export function downscaleDataUrl(dataUrl: string, maxPx = 256): Promise<ThumbnailResult> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let stage: 'canvas' | 'draw' | 'encode' = 'canvas'
      try {
        const longest = Math.max(img.width, img.height)
        const scale = longest > maxPx ? maxPx / longest : 1
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({ ok: false, reason: 'canvas' })
          return
        }
        stage = 'draw'
        ctx.drawImage(img, 0, 0, w, h)
        stage = 'encode'
        resolve({ ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.8) })
      } catch {
        resolve({ ok: false, reason: stage })
      }
    }
    img.onerror = () => resolve({ ok: false, reason: 'load' })
    img.src = dataUrl
  })
}
