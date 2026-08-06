// 인증 broker (0157 → 0178 분해) — 조립과 복원만 남았다.
//
// 785줄짜리 한 덩어리였던 것을 세 조각으로 나눴다. 한 파일이 "인증하는 법" 과 "요청 보내는 법"
// 을 함께 알고 있어서, 둘 중 하나를 고치려면 둘 다 읽어야 했다.
//
//   login.ts  인증 lifecycle — 재진입·체인·게이트·로그아웃·만료 재확인
//   api.ts    내부 API — 다른 모듈이 쓰는 `InternalApi` 구현(요청·토큰)
//   broker.ts 조립 + 부팅 복원 (여기)
//
// 여기 밖에서는 아무도 raw secret 을 만지지 않는다. 다른 모듈은 대상 이름으로 위임하고
// (`InternalApi.request`), renderer 는 DTO 만 받는다.

import type {
  AuthBindingInfo,
  AuthBindingStatus,
  AuthLogoutOutcome,
  AuthPlatformState,
  AuthStepInfo,
  AuthTarget
} from '../../../shared/ipc'
import type { BrowserSessionCapability } from '../../contracts/auth-method'
import type {
  InternalApi,
  InternalApiRequest,
  InternalApiResponse
} from '../../contracts/internal-api'
import { createSender, type AuthenticatedFetchDeps } from '../../infra/auth/authenticated-fetch'
import { authBindingPrefix, type CredentialVault } from '../../infra/auth/credential-vault'
import { getLogger } from '../../infra/log/registry'
import { AuthApi } from './api'
import { BindingStore, type BindingPersistence } from './bindings'
import { AuthLogin } from './login'
import type { AuthRegistry } from './registry'

export { MAX_REDIRECT_HOPS, joinUrl } from './api'

// 인증 레코드가 봉인한 credential 의 vault 키.
export const BINDING_SECRET_NAME = 'secret'

export interface BrokerDeps {
  registry: AuthRegistry
  // 네임스페이스별 vault 팩토리 — broker 는 raw SecretStore 를 보지 않는다.
  vaultFor: (prefix: string) => CredentialVault
  browserSessions: BrowserSessionCapability
  // 원격 요청 전송자 (0173). **필수** — 기본값을 두면 주입을 빠뜨린 경로가 조용히 Node 스택으로
  // 돌아가 사내 프록시·사설 CA 를 못 탄다. 프로덕션은 `netFetch`(Chromium), 테스트는 스텁.
  fetchImpl: typeof fetch
  broadcast: (state: AuthPlatformState) => void
  // 레코드 제거 뒤 연결을 정리하는 컴포지션 콜백. auth-platform 은 대상 구현을 import 하지 않고
  // 구조적 포트만 받는다.
  onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
  sender?: AuthenticatedFetchDeps
  clock?: () => number
  // 레코드 영속 (0170). 없으면 메모리 전용 — 재시작하면 재입력을 받는다.
  bindingPersistence?: BindingPersistence
}

// `restore()` 가 돌려주는 재연결 대상. 컴포지션 루트가 이것으로 대상을 다시 연결한다.
export interface RestoredConnectorBinding {
  bindingId: string
  connectorId: string
  connectionId: string
}

export class AuthBroker implements InternalApi {
  private readonly bindings: BindingStore
  private readonly login: AuthLogin
  private readonly api: AuthApi
  private readonly clock: () => number

  constructor(private readonly deps: BrokerDeps) {
    this.clock = deps.clock ?? Date.now
    this.bindings = new BindingStore(this.clock, deps.bindingPersistence)
    const logger = (event: string, meta?: Record<string, unknown>): void =>
      void getLogger().child('auth').warn(event, meta)

    this.login = new AuthLogin({
      registry: deps.registry,
      bindings: this.bindings,
      vaultFor: deps.vaultFor,
      browserSessions: deps.browserSessions,
      fetchImpl: deps.fetchImpl,
      publish: () => this.publish(),
      ...(deps.onBindingsEnded !== undefined ? { onBindingsEnded: deps.onBindingsEnded } : {}),
      clock: this.clock,
      logger
    })
    this.api = new AuthApi({
      connectors: deps.registry,
      bindings: this.bindings,
      vaultFor: deps.vaultFor,
      browserSessions: deps.browserSessions,
      sender: deps.sender ?? createSender(deps.fetchImpl),
      onStatus: (bindingId, status) => this.login.applyStatus(bindingId, status),
      logger
    })
  }

  // ── 상태 ───────────────────────────────────────────────────────────────────

  status(): AuthPlatformState {
    return this.login.status()
  }

  listBindings(): AuthBindingInfo[] {
    return this.bindings.list()
  }

  getBinding(bindingId: string): AuthBindingInfo | undefined {
    return this.bindings.get(bindingId)
  }

  private publish(): void {
    this.deps.broadcast(this.status())
  }

  // ── lifecycle 위임 ─────────────────────────────────────────────────────────

  begin(methodId: string, target: AuthTarget): Promise<AuthStepInfo> {
    return this.login.begin(methodId, target)
  }

  continue(transactionId: string, input: Record<string, string>): Promise<AuthStepInfo> {
    return this.login.continue(transactionId, input)
  }

  logout(bindingId: string, cascade: boolean): Promise<AuthLogoutOutcome> {
    return this.login.logout(bindingId, cascade)
  }

  // 방식에게 유효성을 다시 묻고 **결과를 레코드에 반영한다** (0178).
  revalidate(bindingId: string): Promise<AuthBindingStatus | null> {
    return this.login.revalidate(bindingId)
  }

  revalidateAll(): Promise<void> {
    return this.login.revalidateAll()
  }

  // ── 내부 API 위임 (InternalApi — 다른 모듈이 쓰는 표면) ────────────────────

  request(req: InternalApiRequest, signal?: AbortSignal): Promise<InternalApiResponse> {
    return this.api.request(req, signal)
  }

  token(target: string): string | null {
    return this.api.token(target)
  }

  // ── 복원 ───────────────────────────────────────────────────────────────────

  // 저장된 레코드를 되살린다 (0170). **비밀이 아직 있는지 vault 에 물어보고 나서** 살린다 —
  // 레코드만 보고 살리면 "연결됨" 이라 표시해 놓고 첫 요청에서 깨지는, 조용한 거짓말이 된다.
  //
  // 복원 대상은 **서비스 연결뿐**이다. `application` 은 `RootGate` 가 화면 전체를 막는 UX 게이트라
  // 자동 통과가 사용자가 요청하지 않은 변경이고, `browser_session` 은 cookie jar 가 레코드 밖
  // (Electron session partition)에 있어 handle 만으로는 되살릴 수 없다.
  restore(): RestoredConnectorBinding[] {
    const kept: AuthBindingInfo[] = []
    const restored: RestoredConnectorBinding[] = []
    const persisted = this.bindings.loadPersisted()
    const log = getLogger().child('auth')

    for (const record of persisted) {
      if (record.target.kind !== 'connector' || record.artifact.kind !== 'vault_credential')
        continue

      const read = this.deps.vaultFor(authBindingPrefix(record.id)).read(BINDING_SECRET_NAME)
      if (read.state === 'absent') {
        // 값이 없는 레코드를 남기면 UI 가 "연결됨" 이라 거짓말한다. 레코드를 버린다.
        log.info('auth.restore.dropped', { bindingId: record.id, reason: 'secret-absent' })
        continue
      }
      // 복호화 실패는 **부재가 아니다**(키체인 잠김·다른 머신). 값이 돌아올 수 있으므로 버리지
      // 않고 unknown 으로 남긴다 — 조용한 미인증 진행을 막는 vault 계약 그대로다.
      const status: AuthBindingStatus = read.state === 'found' ? 'valid' : 'unknown'
      const binding = { ...record, status }
      kept.push(binding)
      if (status === 'valid') {
        restored.push({
          bindingId: binding.id,
          connectorId: record.target.connectorId,
          connectionId: record.target.connectionId
        })
      }
    }

    // 메모리와 저장소를 함께 맞춘다 — 버린 레코드가 파일에 남으면 다음 부팅에 또 되살아난다.
    // 다만 **버린 것도 바뀐 것도 없으면 쓰지 않는다**: 부팅마다 도는 경로라 그때의 동기 파일
    // 쓰기가 매 실행 순수 낭비다(레코드 0건인 기본 설치가 특히 그렇다).
    const unchanged =
      kept.length === persisted.length &&
      kept.every((binding, index) => {
        const source = persisted[index]
        return source?.id === binding.id && source.status === binding.status
      })
    this.bindings.adopt(kept, { persist: !unchanged })
    if (kept.length > 0) this.publish()
    return restored
  }

  shutdown(): void {
    this.login.shutdown()
  }
}
