// `electron-store` 대역 — 실제 패키지는 `electron` 런타임을 물어 vitest 가 import 하지 못한다.
// 생성 옵션의 `cwd`·`name` 을 실제와 같은 규칙(`<cwd>/<name>.json`)으로 파일에 옮겨, 스토어가
// 주입받은 디렉토리를 그대로 넘기는지(0324 EP-13)를 파일 위치로 관측하게 한다. `cwd` 가 없으면
// `fallbackDir` 에 쓴다 — 실제 패키지가 `app` 없는 프로세스에서 조용히 다른 디렉토리에 쓰는 것과 같다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Raw = Record<string, unknown>

export class FileBackedStore {
  static fallbackDir = ''
  private readonly path: string
  private readonly defaults: Raw

  constructor(options: { name?: string; cwd?: string; defaults?: Raw } = {}) {
    const dir = options.cwd ?? FileBackedStore.fallbackDir
    mkdirSync(dir, { recursive: true })
    this.path = join(dir, `${options.name ?? 'config'}.json`)
    this.defaults = options.defaults ?? {}
  }

  get store(): Raw {
    if (!existsSync(this.path)) return { ...this.defaults }
    return JSON.parse(readFileSync(this.path, 'utf8')) as Raw
  }

  set store(value: Raw) {
    writeFileSync(this.path, JSON.stringify(value))
  }

  get(key: string): unknown {
    return this.store[key]
  }

  set(key: string, value: unknown): void {
    this.store = { ...this.store, [key]: value }
  }

  delete(key: string): void {
    const next = { ...this.store }
    delete next[key]
    this.store = next
  }
}
