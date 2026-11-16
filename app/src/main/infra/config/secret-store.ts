// MCP·provider vault 공용 비밀 저장소 (0324 MD-10 · EP-18 · D-040 · AC45).
//
// 값은 env-var **이름**으로 키잉한다(서버 id 아님) — 여러 서버가 같은 ${TOKEN} 을 공유할 수 있게.
// 디스크 형태는 { [VAR]: 암호문 base64 } 그대로다(형식 불변). mcp.json 에는 ${VAR} 플레이스홀더만 남는다.
//
// 봉인·해제는 셸만 한다(D-018) — 이 저장소는 `Sealer` 로 셸 서비스에 부탁한다.
// - 기동 때 `load()` 가 모든 항목을 한 번 풀어 메모리에 둔다. 못 푼 항목은 `undecryptable` 이다.
// - 깨어남(절전 해제·화면 잠금 해제)마다 `retryUndecryptable()` 가 못 푼 항목만 다시 푼다.
// - 읽기(`get`·`has`)는 동기 — 메모리 사본만 본다. `load()` 전에 읽으면 던진다(fail-closed).
// - 쓰기는 **봉인한 뒤에만** 파일 → 사본 순서로 저장한다. 봉인이 실패하면 둘 다 그대로 두고 거부한다.
// - 삭제는 봉인이 필요 없다 — 파일·사본에서 바로 지운다.
// - 쓰기는 한 줄로 세운다 — 앞 쓰기가 끝나기 전에 뒤 쓰기의 봉인이 끝나도 파일 순서가 바뀌지 않는다.

// 셸 서비스의 `secrets.*` 세 가지.
export interface Sealer {
  isAvailable(): Promise<boolean>
  encrypt(plain: string): Promise<string>
  decrypt(cipher: string): Promise<string>
}

// 디스크 접근 — 실제는 `secret-file.ts` 의 `electron-store`, 테스트는 메모리.
export interface SecretFile {
  entries(): Array<[string, unknown]>
  get(name: string): unknown
  set(name: string, value: string): void
  delete(name: string): void
}

export const SECRET_STORE_NOT_LOADED = '비밀 저장소를 아직 읽지 않았다'
export const SECRET_SEAL_UNAVAILABLE = '암호화를 사용할 수 없어 인증값을 저장할 수 없습니다.'

export class SecretStore {
  private readonly plain = new Map<string, string>()
  private readonly undecryptable = new Set<string>()
  private loaded = false
  private writes: Promise<unknown> = Promise.resolve()
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly file: SecretFile,
    private readonly sealer: Sealer
  ) {}

  // 기동 때 한 번 — 모든 항목을 푼다.
  async load(): Promise<void> {
    this.plain.clear()
    this.undecryptable.clear()
    for (const [name, cipher] of this.file.entries()) {
      if (typeof cipher !== 'string') continue
      await this.unseal(name, cipher)
    }
    this.loaded = true
  }

  // 깨어남 — 못 푼 항목만 다시 푼다. 하나라도 풀리면 변경을 알린다.
  async retryUndecryptable(): Promise<void> {
    if (!this.loaded || this.undecryptable.size === 0) return
    let recovered = false
    for (const name of [...this.undecryptable]) {
      const cipher = this.file.get(name)
      if (typeof cipher !== 'string') {
        this.undecryptable.delete(name)
        continue
      }
      if (await this.unseal(name, cipher)) recovered = true
    }
    if (recovered) for (const listener of [...this.listeners]) listener()
  }

  // env-var 이름 → 평문 비밀. 미존재·못 푼 항목은 undefined.
  get(name: string): string | undefined {
    this.assertLoaded()
    return this.plain.get(name)
  }

  // 저장돼 있는가(풀었든 못 풀었든).
  has(name: string): boolean {
    this.assertLoaded()
    return this.plain.has(name) || this.undecryptable.has(name)
  }

  set(name: string, plain: string): Promise<void> {
    this.assertLoaded()
    return this.serial(async () => {
      if (!(await this.sealer.isAvailable())) throw new Error(SECRET_SEAL_UNAVAILABLE)
      const cipher = await this.sealer.encrypt(plain)
      this.file.set(name, cipher)
      this.plain.set(name, plain)
      this.undecryptable.delete(name)
    })
  }

  delete(name: string): void {
    this.assertLoaded()
    this.file.delete(name)
    this.plain.delete(name)
    this.undecryptable.delete(name)
  }

  // 못 푼 항목이 다시 풀렸다. 반환값은 구독 해제다.
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private async unseal(name: string, cipher: string): Promise<boolean> {
    try {
      this.plain.set(name, await this.sealer.decrypt(cipher))
      this.undecryptable.delete(name)
      return true
    } catch {
      this.plain.delete(name)
      this.undecryptable.add(name)
      return false
    }
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.writes.then(run, run)
    this.writes = next.catch(() => {})
    return next
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error(SECRET_STORE_NOT_LOADED)
  }
}
