// 비밀 캐시 (0324 MD-10 · EP-18 규칙 칸 7분기 · AC45). 가짜 셸 봉인기와 메모리 파일로 본다.

import { describe, expect, it, vi } from 'vitest'
import {
  SECRET_SEAL_UNAVAILABLE,
  SECRET_STORE_NOT_LOADED,
  SecretStore,
  type Sealer,
  type SecretFile
} from './secret-store'

function memoryFile(initial: Record<string, string> = {}): SecretFile & {
  data: Map<string, unknown>
} {
  const data = new Map<string, unknown>(Object.entries(initial))
  return {
    data,
    entries: () => [...data.entries()],
    get: (name) => data.get(name),
    set: (name, value) => {
      data.set(name, value)
    },
    delete: (name) => {
      data.delete(name)
    }
  }
}

// `enc:<평문>` 만 푼다. `locked` 에 든 암호문은 키체인이 잠긴 것처럼 실패한다.
function fakeSealer(options: { available?: boolean; locked?: Set<string> } = {}): Sealer & {
  calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    isAvailable: async () => options.available ?? true,
    encrypt: async (plain) => {
      calls.push(`encrypt:${plain}`)
      return `enc:${plain}`
    },
    decrypt: async (cipher) => {
      calls.push(`decrypt:${cipher}`)
      if (options.locked?.has(cipher)) throw new Error('locked')
      return cipher.replace(/^enc:/, '')
    }
  }
}

describe('SecretStore (EP-18)', () => {
  it('기동 해제 성공 — 모든 항목 읽기 = 평문', async () => {
    const store = new SecretStore(memoryFile({ A: 'enc:a', B: 'enc:b' }), fakeSealer())
    await store.load()
    expect(store.get('A')).toBe('a')
    expect(store.get('B')).toBe('b')
    expect(store.has('A')).toBe(true)
  })

  it('기동 해제 일부 실패 — 그 항목만 없음(저장돼 있음은 참), 나머지는 평문', async () => {
    const store = new SecretStore(
      memoryFile({ A: 'enc:a', B: 'enc:b' }),
      fakeSealer({ locked: new Set(['enc:b']) })
    )
    await store.load()
    expect(store.get('A')).toBe('a')
    expect(store.get('B')).toBeUndefined()
    expect(store.has('B')).toBe(true)
  })

  it('깨어남 재시도 — 못 푼 항목만 다시 풀고, 풀리면 변경을 1번 알린다', async () => {
    const locked = new Set(['enc:b'])
    const sealer = fakeSealer({ locked })
    const store = new SecretStore(memoryFile({ A: 'enc:a', B: 'enc:b' }), sealer)
    await store.load()
    const changed = vi.fn()
    store.onChange(changed)
    sealer.calls.length = 0
    await store.retryUndecryptable()
    // 아직 잠겨 있다 — 변경 없음.
    expect(sealer.calls).toEqual(['decrypt:enc:b'])
    expect(changed).not.toHaveBeenCalled()
    locked.clear()
    sealer.calls.length = 0
    await store.retryUndecryptable()
    expect(sealer.calls).toEqual(['decrypt:enc:b'])
    expect(store.get('B')).toBe('b')
    expect(changed).toHaveBeenCalledTimes(1)
    // 더 풀 것이 없으면 봉인기를 부르지 않는다.
    sealer.calls.length = 0
    await store.retryUndecryptable()
    expect(sealer.calls).toEqual([])
  })

  it('쓰기 — 봉인 요청 1 → 파일 기록 → 사본 갱신 순서', async () => {
    const file = memoryFile()
    const sealer = fakeSealer()
    const store = new SecretStore(file, sealer)
    await store.load()
    const pending = store.set('TOKEN', 'v1')
    // 봉인이 끝나기 전에는 파일도 사본도 그대로다.
    expect(file.data.has('TOKEN')).toBe(false)
    expect(store.get('TOKEN')).toBeUndefined()
    await pending
    expect(sealer.calls).toEqual(['encrypt:v1'])
    expect(file.data.get('TOKEN')).toBe('enc:v1')
    expect(store.get('TOKEN')).toBe('v1')
  })

  it('봉인 실패 — 파일·사본 무변경 · 거부(fail-closed)', async () => {
    const file = memoryFile({ TOKEN: 'enc:old' })
    const store = new SecretStore(file, fakeSealer({ available: false }))
    await store.load()
    await expect(store.set('TOKEN', 'new')).rejects.toThrow(SECRET_SEAL_UNAVAILABLE)
    expect(file.data.get('TOKEN')).toBe('enc:old')
    expect(store.get('TOKEN')).toBe('old')

    const failing = new SecretStore(memoryFile(), {
      ...fakeSealer(),
      encrypt: async () => {
        throw new Error('seal failed')
      }
    })
    await failing.load()
    await expect(failing.set('X', 'v')).rejects.toThrow('seal failed')
    expect(failing.has('X')).toBe(false)
  })

  // 순서의 근거: 파일 기록이 실패하면 사본도 그대로여야 한다 — 사본을 먼저 바꾸면 디스크에 없는 값이 읽힌다.
  it('쓰기 — 파일 기록이 실패하면 사본을 바꾸지 않고 거부한다', async () => {
    const file = memoryFile({ TOKEN: 'enc:old' })
    file.set = () => {
      throw new Error('disk full')
    }
    const store = new SecretStore(file, fakeSealer())
    await store.load()
    await expect(store.set('TOKEN', 'new')).rejects.toThrow('disk full')
    expect(store.get('TOKEN')).toBe('old')
    await expect(store.set('OTHER', 'x')).rejects.toThrow('disk full')
    expect(store.has('OTHER')).toBe(false)
  })

  it('삭제 — 파일·사본에서 제거 · 봉인 요청 0', async () => {
    const file = memoryFile({ TOKEN: 'enc:v', LOCKED: 'enc:l' })
    const sealer = fakeSealer({ locked: new Set(['enc:l']) })
    const store = new SecretStore(file, sealer)
    await store.load()
    sealer.calls.length = 0
    store.delete('TOKEN')
    store.delete('LOCKED')
    expect(file.data.size).toBe(0)
    expect(store.has('TOKEN')).toBe(false)
    expect(store.has('LOCKED')).toBe(false)
    expect(sealer.calls).toEqual([])
  })

  it('읽기 전에는 던지고(fail-closed), 쓰기는 들어온 차례대로 파일에 남는다', async () => {
    const file = memoryFile()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const store = new SecretStore(file, {
      isAvailable: async () => true,
      // 첫 봉인만 늦게 끝난다.
      encrypt: async (plain) => {
        if (plain === 'first') await gate
        return `enc:${plain}`
      },
      decrypt: async (cipher) => cipher
    })
    expect(() => store.get('A')).toThrow(SECRET_STORE_NOT_LOADED)
    await store.load()
    const first = store.set('K', 'first')
    const second = store.set('K', 'second')
    release()
    await Promise.all([first, second])
    expect(file.data.get('K')).toBe('enc:second')
    expect(store.get('K')).toBe('second')
  })
})
