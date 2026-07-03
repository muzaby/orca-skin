// 기본 ${VAR} resolver 팩토리. 순서: safeStorage(비밀) → process.env (2단계).
// expand.ts 의 순수 Resolver 타입에 electron/secret 의존을 주입하는 얇은 어댑터.

import type { Resolver } from '../infra/vars'
import type { SecretStore } from '../infra/config/secret-store'

export function makeResolver(secrets: SecretStore): Resolver {
  return (name: string) => secrets.get(name) ?? process.env[name]
}
