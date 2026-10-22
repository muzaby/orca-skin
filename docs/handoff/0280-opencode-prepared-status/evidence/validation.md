# 검증 기록 — r1

## 범위와 결과

첫 입력 전 상태 타일은 컴포저 준비 owner의 native MCP/plugin 목록을 사용한다. 정상 취소는 오류 throw 대신 typed outcome으로 처리하고 실제 실패는 민감정보 없는 분류만 기록한다. nav 전역 제어는 0278 미구현 범위다.

## 실행 증거

| 명령 / 묶음 | 관측 |
|---|---|
| 직접 Vitest: main composer resolver/handler/error, SDK context/catalog/startup/persistent, preload, composer state/Controls, native tile/menu, protocol.harness | 14파일 122테스트 통과 |
| 직접 Vitest: handler + preparedResourcesView | 2파일 9테스트 통과. 앞 묶음과 중복인 handler 6개 제외, 신규 3개 포함하여 전체 고유 15파일 125개 |
| `npm run typecheck` | node/web/test 통과 |
| `npm run lint` | 수정 완료 후 오류 0, 기존 React Compiler 경고 2개(Timeline/useTranscriptVirtualizer) |
| `npm run build` | Electron ABI 유지, node/web/test 타입 검사와 main/preload/renderer 빌드 통과. 기존 SubAgentTaskDetail 정적·동적 import 중복 경고 |
| `node scripts/check-doc-inventory.mjs --check` | generated/prose 통과. 임시 upstream 참조 checkout의 기존 링크 10개 실패 |
| 변경 문서 상대 링크 검사 (`parseRelativeLinks`) | 변경 문서 8개의 상대 링크 파손 0개 |
| `git diff --check` | 통과 |

## 직접 관측

- main 등록 IPC → 실제 resolver → OpenCodeAdapter → 설치 SDK transport: 첫 메시지·session API 없이 `/config` plugin·`/agent` 완료. `/mcp`·`/provider`를 미완료로 유지해 독립성을 확인했다.
- SDK cache: 같은 directory의 두 owner는 resource flight/cache 공유, A/B의 MCP 이름 구별, 실패 재시도는 plugin을 재조회하지 않았다.
- renderer 등록 타일 → 실제 hook/state/view: plugin 먼저 렌더, 이후 dynamic MCP 렌더, 고정 새로고침은 같은 owner 사용, 첫 메시지 이후 live-mcp로 전환했다.
- A의 늦은 결과는 B에 들어가지 않았고 generation invalidation 후 초록 연결 표시가 제거됐다.
- acquisition와 native read 도중 owner release는 cancelled 결과·warn 호출 0. HTTP 503 실패는 stage/reason/httpStatus만 기록하고 SECRET 본문은 제외했다.
- 성공한 빈 종류는 제거, 실패한 다른 종류는 정적 fallback 유지, 동적 MCP 파일 열기와 draft plugin 열기는 비활성이다.

## 기존 실패 분리

기존 `NativeResourcesTile.test.ts`의 3개 실패는 HEAD의 타일/menu 구현을 임시 복원한 실행에서도 재현했다. 감시 등록 요청이 목록 조회 mock을 소비하던 이전 테스트 대역의 누락이었다. ACK와 read를 구별한 뒤 기존 4개가 통과했고 production 원본은 변경 바이트로 복원했다.

문서 링크 실패는 `.tmp/opencode-dev`·`app/.temp/opencode`의 codemode README, http-recorder examples, figma token 참조, slide-properties의 url, services updates 각각이다. 이번 변경 문서에서 생성한 링크와 구분한다.

## 남은 확인

다른 PC에서 보고된 원본 오류의 실제 원인은 기존 공통 메시지만으로 확정할 수 없다. 정상 취소 경로는 수정했으며 실제 실패가 재발하면 로컬 `application.jsonl`의 `opencode.catalog.failed`에 `stage`, `reason`, 가능한 경우 `httpStatus`가 남는다. 실제 앱 창의 시각 인수와 독립 verify는 미실행이다.
