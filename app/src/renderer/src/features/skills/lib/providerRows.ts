// 카탈로그 provider 탭의 순수 판정 (0181). renderer 의 `.tsx` 는 vitest include
// (`src/**/*.test.ts`) 밖이라 기계 검증이 안 되므로, 표에서 판정 가능한 로직만 여기로 내린다.
//
// 구 `pluginCatalog.ts`·`connectorActions.ts` 두 벌이 하던 일을 하나로 접었다 — 앱 로그인과
// 서비스 연결이 같은 DTO(`ProviderInfo`)를 쓰기 때문에 행 판정도 한 벌이면 된다.

import type { ProviderGrantStatus, ProviderInfo, ProviderKind } from '../../../../../shared/ipc'
import type { MessageKey } from '../../../shared/i18n'

// 방식 선택 규칙(`authChoices`·`needsAuthChoice`·`initialAuthKind`)은 게이트 화면과 **같은
// 구현**을 써야 해서 `shared/config/providerAuth` 가 갖는다 — 소비자는 그쪽을 직접 부른다.
// 여기서 재노출하면 같은 함수에 import 경로가 두 벌 생긴다.

export interface ProviderRowMeta {
  statusKey: MessageKey
  // 지금 무엇으로 연결돼 있는가. 미인증이면 null — 화면이 "무엇으로 연결됐는지" 를 보여준다.
  activeLabel: string | null
  kindKey: MessageKey
}

const STATUS_KEYS: Record<ProviderGrantStatus, MessageKey> = {
  none: 'skills.provider.status.none',
  valid: 'skills.provider.status.valid',
  expired: 'skills.provider.status.expired',
  unknown: 'skills.provider.status.unknown'
}

const KIND_KEYS: Record<ProviderKind, MessageKey> = {
  gate: 'skills.provider.kind.gate',
  llm: 'skills.provider.kind.llm',
  service: 'skills.provider.kind.service'
}

export function providerRowMeta(provider: ProviderInfo): ProviderRowMeta {
  const active = provider.auth.find((spec) => spec.kind === provider.activeAuthKind)
  return {
    statusKey: STATUS_KEYS[provider.status],
    activeLabel: active?.label ?? null,
    kindKey: KIND_KEYS[provider.kind]
  }
}

// **재인증·해제 버튼을 보여주는가.** 재인증·해제 둘 다 이 조건 하나를 쓴다 — 이름을 나눠 두면
// 규칙이 같은 동안에도 두 벌로 보이고, 한쪽만 고쳐질 자리가 생긴다. 없으면 버튼은 "연결" 하나다.
//
// **`isConnected` 도 `hasAuthRecord` 도 아니다.** `expired`·`unknown` 에도 참이라 "연결됨" 이
// 아니고, 레코드 유무와도 어긋난다 — `status` 는 grant 레코드가 있어도 값형의 vault 값이 없으면
// `'none'` 을 주는데(`ProviderStore.status`), `activeAuthKind` 는 별도 경로로 오므로 "레코드는
// 있는데 status 는 none" 이 성립한다. 이 판정이 실제로 정하는 것은 **화면에 어떤 버튼을 낼지**
// 하나뿐이므로 이름도 그것으로 둔다. (0187 D4)
export function canManageAuth(provider: ProviderInfo): boolean {
  return provider.status !== 'none'
}
