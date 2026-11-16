// 메모리 비밀 저장소 — `McpStore`·vault 테스트가 봉인 없이 쓴다(0324 EP-18 의 소비자 대역).
import type { SecretStore } from './secret-store'

export type MemorySecrets = Pick<SecretStore, 'get' | 'has' | 'set' | 'delete'>

export function memorySecrets(map: Map<string, string> = new Map()): MemorySecrets {
  return {
    get: (name) => map.get(name),
    has: (name) => map.has(name),
    set: async (name, plain) => {
      map.set(name, plain)
    },
    delete: (name) => {
      map.delete(name)
    }
  }
}
