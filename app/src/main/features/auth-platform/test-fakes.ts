// 인증 테스트용 fake — 구 `conformance.ts` 에서 분리했다 (0178).
//
// 원본은 **하네스**(모든 provider 가 통과해야 하는 계약 검사)와 **fake**(메모리 vault·세션)를
// 한 파일에 담고 있었다. 하네스는 폐기했지만 — 검사하던 규약 대부분이 생산자 0인 표면이었다 —
// fake 는 provider 테스트가 계속 쓴다. 그래서 fake 만 남긴다.
//
// **런타임 코드가 아니다.** vitest 에서만 import 한다.

import type {
  AuthPluginContext,
  BrowserSessionCapability,
  CredentialVaultView
} from '../../contracts/auth-plugin'
import type { AuthTarget, CredentialMeta } from '../../../shared/ipc'

// 메모리 vault — 실제 safeStorage 없이 계약만 본다.
export function createFakeVault(): CredentialVaultView & { dump(): Map<string, string> } {
  const values = new Map<string, string>()
  const metas = new Map<string, CredentialMeta>()
  return {
    get: (name) => values.get(name) ?? null,
    set: (name, value, meta) => {
      values.set(name, value)
      metas.set(name, meta)
    },
    delete: (name) => {
      values.delete(name)
      metas.delete(name)
    },
    describe: (name) => metas.get(name) ?? null,
    dump: () => new Map(values)
  }
}

export function createFakeBrowserSessions(
  overrides: Partial<BrowserSessionCapability> = {}
): BrowserSessionCapability {
  return {
    acquire: async (group) => `handle:${group}`,
    openLoginWindow: async () => ({ finalUrl: 'https://example.invalid/done' }),
    probe: async () => ({ ok: true, status: 200, finalUrl: 'https://example.invalid/probe' }),
    clear: async () => undefined,
    ...overrides
  }
}

export interface FakeContextOptions {
  target: AuthTarget
  input?: Record<string, string>
  signal?: AbortSignal
  vault?: CredentialVaultView
  browserSessions?: BrowserSessionCapability
  fetchImpl?: AuthPluginContext['fetch']
}

export function createFakeContext(opts: FakeContextOptions): AuthPluginContext {
  const scratch = new Map<string, unknown>()
  return {
    target: opts.target,
    input: opts.input ?? {},
    signal: opts.signal ?? new AbortController().signal,
    vault: opts.vault ?? createFakeVault(),
    browserSessions: opts.browserSessions ?? createFakeBrowserSessions(),
    fetch: opts.fetchImpl ?? (async () => new Response('{}', { status: 200 })),
    store: { get: (k) => scratch.get(k), set: (k, v) => scratch.set(k, v) },
    env: () => undefined,
    logger: () => undefined,
    clock: () => 1_700_000_000_000
  }
}
