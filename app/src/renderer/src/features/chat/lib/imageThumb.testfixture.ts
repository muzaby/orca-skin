// 썸네일 테스트용 가짜 Image·canvas (0325 VP-30) — `imageThumb.test.ts` · `composerSubmit.test.ts` 가 쓴다.
import { vi } from 'vitest'

// 가짜 Image·canvas — `src` 를 넣으면 마이크로태스크에서 load/error 를 부른다.
export function installFakeCanvas(options: {
  load?: boolean
  context?: boolean
  draw?: 'ok' | 'throw'
  encode?: 'ok' | 'throw'
  createThrows?: boolean
}): { unhandled: unknown[] } {
  const unhandled: unknown[] = []
  class FakeImage {
    width = 4032
    height = 3024
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => {
        try {
          if (options.load === false) this.onerror?.()
          else this.onload?.()
        } catch (error) {
          unhandled.push(error)
        }
      })
    }
  }
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('document', {
    createElement: () => {
      if (options.createThrows) throw new Error('no canvas')
      return {
        width: 0,
        height: 0,
        getContext: () =>
          options.context === false
            ? null
            : {
                drawImage: () => {
                  if (options.draw === 'throw') throw new Error('draw failed')
                }
              },
        toDataURL: () => {
          if (options.encode === 'throw') throw new Error('tainted')
          return 'data:image/jpeg;base64,THUMB'
        }
      }
    }
  })
  return { unhandled }
}
