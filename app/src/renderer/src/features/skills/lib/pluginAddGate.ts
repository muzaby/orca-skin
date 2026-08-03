// 플러그인 **추가 버튼 노출 판정** (0164) — React 비의존.
//
// 사용자 결정(2026-08-03): 서버 목록의 정본은 **빌드타임**(`modules/confluence/servers.ts`)이다.
// 사용자가 주소를 타이핑하는 경로는 지우지 않되 **기본으로 숨기고**, 디버그 패널의 토글로만
// 연다 — "제거 빌드타임 전용, 단 디버그 패널에 … 토글 버튼 추가, 추가버튼이 노출되도록".
//
// 토글은 *만드는 입구*만 닫는다. 이미 만들어진 인스턴스는 목록에 그대로 남는다 — 숨기면
// 사용자가 그것을 지울 방법이 사라진다.

import type { CatalogTab } from './catalogSelection'

export function showsAddButton(tab: CatalogTab, pluginAddEnabled: boolean): boolean {
  // skills·mcp 는 예전부터 사용자가 직접 만드는 자리라 게이트 대상이 아니다.
  if (tab !== 'plugins') return true
  return pluginAddEnabled
}
