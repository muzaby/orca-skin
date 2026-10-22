# OpenCode 준비 목록의 취소 구분과 첫 입력 전 상태 표시

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-22 |
| 상태 | 구현 완료 — 독립 검증 대기 |
| V mode / revision | Baseline V / V1 |
| 기준 V | 없음. 0276의 준비 lease를 재사용하는 후속 오류·관측 수정 |

# Part I — Product & UX Contract

## 1. 목표

OpenCode 컴포저의 정상 취소를 조회 실패와 구분하고 실제 실패의 안전한 진단 정보를 남긴다. 첫 메시지 전에도 컴포저가 준비하는 작업폴더의 MCP·플러그인을 우측 패널에 표시한다.

## 2. 요구 출처

사용자 보고: `orca:composer:catalog` 공통 오류, 우측 패널 목록 부재, 전역 on/off 미노출 여부 질의.
추가 확인: **“첫 메시지 전만 비어 있고 응답 후에는 표시됨.”**
원본 오류의 원인은 공통 catch 때문에 확정할 수 없다. 정상 owner 해제도 같은 메시지로 변환되는 경로는 현재 handler 테스트로 확인했다.

## 3. Decision Ledger

| ID | 결정·출처·조건 | 상태 |
|---|---|---|
| D1 | 준비된 native 인스턴스의 목록을 첫 입력 전 패널에도 연결 — 사용자 보고의 수정 해석 | ACTIVE |
| D2 | 서버·directory 준비 lease, agent/provider 독립 조회와 owner 정리 정책 유지 — 0275·0276 | ACTIVE |
| D3 | 팝업 안내 금지 | ACTIVE. 스피너 전면 금지는 0281 D5의 에이전트 제목 우측 예외로 대체 |
| D4 | 정상 취소는 실패 로그를 내지 않고 실제 실패는 단계·고정 분류·HTTP 상태만 기록. 설정·경로·자격증명 원문 제외 | ACTIVE |
| D5 | 전역 on/off는 0278의 미구현 정책으로 정확히 보고. 이번 오류 수정에서 실행 정책·저장소 변경 안 함 | ACTIVE |
| D6 | 우측 패널 준비 목록은 읽기 전용. 프로젝트/엔진 전환의 이전 결과를 폐기하고 첫 전송 이후 기존 runtime 상태 경로 유지 | ACTIVE |

갱신: 기존 결정을 대체하지 않는다. D1/AC1·2, D2/AC3, D3/AC5, D4/AC4, D5/비범위, D6/AC3·5 대조 충돌 없음.

## 4. 비판적 검토

| 대상 | 코드 근거 | 판단 |
|---|---|---|
| 공통 오류 | `app/handlers/composer-catalog.ts` catch | 정상 release와 HTTP/시작 실패를 구분하지 않음 |
| 첫 입력 전 패널 | `harnesses/opencode/module.ts:draftResources`, `NativeResourcesTileContent` | 파일 선언만 읽으므로 config hook의 동적 MCP는 보이지 않음 |
| 첫 입력 후 | `opencode/v1/channel.ts:nativeResources` | 실제 실행 목록 경로가 별도로 있음 |
| 전역 제어 | 0278 DRAFT, 0279 구현 범위 | 최종 정책 미구현. 숨김이 최종 의도는 아님 |

## 5. 동작·상태

| 이벤트 | 결과 |
|---|---|
| 컴포저 표시 | agent/model 준비 시작, 기존과 같은 lease 사용 |
| 첫 입력 전 상태 타일 표시 | 같은 scope의 MCP/config 목록을 독립 조회. agent/model 결과를 기다리지 않음 |
| 한 종류만 성공 | 성공한 종류부터 표시; 다른 종류의 파일 기반 항목 유지 |
| 화면 이탈·세션 전환 | owner 취소, 취소 결과 반환; 실패 로그 없음 |
| 실제 실패 | 안전한 단계·분류를 로그에 남김; 성공 목록 유지, 기존 새로고침 사용 |
| instance 종료 | 현재 연결 상태 제거. 재조회는 명시 새로고침 |
| 첫 메시지 이후 | 기존 runtime 상태 타일로 전환 |

기존 CascadeBody·상태 행·키보드·테마를 재사용한다. 팝업의 최신 표시 정책은 0281 ΔV1을 따른다. 이 문서의 상태 패널 읽기·재시도 정책과 구분한다.

## 6. 범위

준비 카탈로그 계약·오류 경계·MCP/plugin 독립 읽기·draft 상태 타일·회귀 검증.
전역 토글·설정 격리·nav MCP 조회 범위 UI·설정 편집·native plugin 재시작은 0277/0278 범위다.

## 7. Acceptance

| R / AT / AC | 관측 기준 | 직접 oracle / production path |
|---|---|---|
| R1 / AT1 / AC1 | 첫 메시지 없이 native config plugin·동적 MCP 표시 | 준비 adapter SDK transport → cache → IPC → draft tile 테스트 |
| R2 / AT2 / AC2 | 느린 MCP/model이 plugin/agent 표시를 지연시키지 않음 | 지연 endpoint를 가진 preparation·state 테스트 |
| R3 / AT3 / AC3 | 같은 scope 재조회 합류·화면 이탈 정리·서로 다른 scope 격리 | handler lifecycle·state cancellation·SDK session-context 테스트 |
| R4 / AT4 / AC4 | 정상 release는 취소, 실제 오류는 단계/고정 분류; 비밀 원문 노출 안 함 | handler 오류·취소·진단 spy, state 실패 보존 테스트 |
| R5 / AT5 / AC5 | 팝업 안내 없음·draft 읽기 전용·첫 응답 후 기존 패널 유지 | Controls interaction·draft tile 렌더·기존 NativeResourcesTile 테스트 |

## 7-A. Baseline V

모든 노드 NEW, pair REQUIRED. 직접 결과를 단언하므로 선택 mutation 없음.

| pair | 노드 / level | path / 강제 자리 | oracle 좌표 |
|---|---|---|---|
| VP1 | R1–R5↔AT1–AT5 / R | 준비 표시→IPC→native→타일 / EP1–4 | 아래 직접 oracle 연결 + `OpenCodeNativeResourcesTile.test.ts`: first-input list and live delegation |
| VP2 | SD1↔ST1 / SD | owner 생성→병렬 요청→전환→release / EP2·3 | `handlers/composer-catalog.test.ts`: release before acquisition; `composerCatalogState.test.ts`: parts, stale generation, unsubscribe |
| VP3 | AR1↔IT1 / AR | schema→handler→adapter→renderer / EP1–4 | protocol/preload 기존 테스트 + `app/composer-catalog.test.ts`: registered handler passes directory/provider; 신규 parts roundtrip |
| VP4 | MD1↔UT1 / MD | SDK mcp/config→정규화→독립 cache / EP3 | `composer-preparation.test.ts`: plugin before blocked MCP; refresh/scope/release |
| VP5 | MD2↔UT2 / MD | 오류→안전 분류→handler 결과→state / EP2·4 | `composer-catalog-error.test.ts`: secret input; handler/state error outcomes |

# Part II — Technical Design

## 8. 조사·AS-IS

`ComposerCatalogOwners`는 준비 lease 한 개를 owner별로 공유한다. `OpenCodeComposerCache`는 agent/model 각각 single-flight·성공 cache를 갖는다. renderer state는 같은 scope 구독을 공유하지만 상태 타일은 이 경로에 연결되지 않는다.

## 9. TO-BE

카탈로그의 준비 데이터에 `mcp`·`plugins` 읽기 part를 추가한다. 기존 agent/model 구독은 그대로 두며 상태 타일 구독에서만 두 resource part를 요청한다. SDK /mcp와 /config는 서로, agent/provider와도 독립이다.

| 축 | AS-IS → TO-BE |
|---|---|
| 실패 | 모든 throw를 공통 문자열 → 취소/실패 typed outcome + 안전 진단 |
| 목록 | agent/model만 준비 cache → mcp/plugin도 같은 directory generation의 독립 cache |
| 화면 | 파일 선언만 표시 → OpenCode draft wrapper가 성공한 native part를 병합하여 기존 타일 view에 전달 |
| 실행 후 | 기존 runtime 상태 → 유지 |

## 10. 계약·강제 지점

| 자리 / pair | 계약 | 고정 자리 목록 | 검색 / 직접 oracle | 실패 의미 |
|---|---|---|---|---|
| EP1 / VP3 | IPC part·결과 union | shared 타입, protocol enum, preload/API 전달 (3) | `rg 'ComposerCatalog|composerCatalog' app/src/shared app/src/preload app/src/renderer/src/shared`; protocol/preload roundtrip | part 탈락·오류를 빈 성공으로 처리 |
| EP2 / VP2·3·5 | 취소·안전 오류·owner 수명 | prepare resolver, owner read/adopt/release, handler catch (3) | `rg 'prepareComposerCatalog|owners.read|lease.read' app/src/main/app`; main/handler tests | 정상 이탈 오류·credential 노출·누수 |
| EP3 / VP2·4 | independent native snapshot | resource SDK readers, context cache/lease, adapter prepare readers (3) | `rg 'openCodeNativeResources|OpenCodeComposerCache|prepareComposer' app/src/main/adapters/opencode`; SDK preparation tests | MCP 대기로 agent/plugin 차단·중복 startup |
| EP4 / VP1·2·3·5 | 소비·scope·display | state outcome/part subscriptions, hook scope, OpenCode tile registration/wrapper, 공통 tile view (4) | `rg 'ComposerCatalog|NativeResourcesTile' app/src/renderer/src/features/chat`; state/hook/tile rendering tests | 다른 폴더 표시·첫 입력까지 빈 목록·안내 추가 |

자리 합계 3+3+3+4=13. 목록 밖 발견은 구현 보고에 기록한다.

## 11. 구현·검증 seam

`shared/composer-catalog.ts`는 준비 데이터/결과의 정본. 내부 nativeComposer 타입은 agent/model만 유지한다. 오류 분류는 Electron 없는 app 순수 모듈, SDK 정규화는 native-resources 파일에 둔다.
OpenCode 전용 wrapper는 해당 harness의 tileRegistry에서 주입하고 공통 tile view는 특정 harness를 import하지 않는다. 성공한 resource part는 같은 종류의 정적 항목을 대체하며 실패/미완료 part는 정적 fallback을 보존한다.

## 12. 기존 소비처

Controls의 agent/model 표시·선택·고정 새로고침과 channel의 composer API는 유지한다. Claude 및 첫 메시지 이후 nativeResources 제어 경로는 유지한다. 공개 IPC의 확장은 IPC_CONTRACT와 함께 갱신한다.

## 13. 수명·저장

기존 마지막 owner release가 instance/server를 정리한다. 추가 resource HTTP는 같은 generation signal로 취소한다. generation 종료 시 과거 연결 표시는 제거하고, 늦은 응답은 폐기한다. 설정·DB 쓰기는 없다.

## 14. 성능

상태 타일의 최초 구독에만 MCP/config 각 한 종류의 조회를 추가한다. 종류별 flight/cache를 공유하고 메뉴 재열기에서 재시작하지 않는다. cold read 120초·warm retry 15초라는 기존 준비 예산을 사용하며 agent/model 대기 경로에는 추가하지 않는다.

## 15. 문서 계약

IPC_CONTRACT의 composer catalog part와 취소/실패 결과를 갱신한다. 신규 UI wrapper를 design-components에 등재한다. 원문 오류는 로거에도 전달하지 않는다.

## 16. 기존 결정 관계

0275 공유 수명·0276 독립 agent 준비·사용자 팝업 안내 금지 유지. 0278 전역 제어 정책은 별도 미구현으로 명시한다. 외부 환경의 오류 원인 해결 여부는 추가 진단 없이는 완료 주장하지 않는다.

## 17. 리스크

plugin이 config hook에서 외부 작업을 기다리는 비용은 유지된다. SDK MCP 조회 자체가 느려도 plugin/agent는 독립 표시한다. 신규 의존성·설정 저장·native 재초기화 없음.

## 18. 영향 파일

§10의 코드·관련 테스트, IPC_CONTRACT, design-components, docs/INDEX, handoff 보드.

## 19. 게이트

app/main/renderer AGENTS 준수. 직접 Vitest로 관련 비DB 테스트, typecheck 3종, lint, build, 문서 inventory/link, diff/trailer 검사. 실제 다른 PC의 원본 실패 원인·앱 시각 확인은 미확인으로 구별한다.

## READY self-review

Decision/AC 대조 완료. Product/UX→technical 순서, 명시 범위·비범위, 각 수준 V·13자리 oracle 고정. 오류 원인 추정 대신 취소 재현과 안전 진단을 계약으로 한정한다. 읽기 전용 확장이므로 새 저장 형식·승인 요청 없음.

## [구현자 기입] 설계 리뷰

동의 — r1. 기존 준비 cache/owner를 확장했으며 별도 서버·native session을 만들지 않는다. 사용자 환경의 원본 오류는 정상 취소인지 실제 조회 실패인지 확정하지 않는다.
테스트 배치는 계획의 신규 `composer-preparation.test.ts` 대신 기존 `app/composer-catalog.test.ts`의 실제 adapter/SDK 경로와 `session-context.test.ts`에 통합했다. `Controls.integration.test.ts`는 존재하지 않아 실제 `Controls.interaction.test.ts`와 신규 타일 통합 테스트로 대체했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP3 | IPC part/result | 타입·schema·preload/API (3) | 3/3 | main 등록 handler의 mcp/plugins 실제 roundtrip, `preload/index.test.ts` 공개 API 왕복 | mcp/plugins·cancelled를 그대로 수신 | — |
| VP2·3·5 | owner/오류 | resolver·owner read/adopt/release·handler (3) | 3/3 | `app/composer-catalog.test.ts:returns prepared plugin and agent parts…`, handler의 acquisition/read 취소·HTTP 진단·refresh tests | draft-project/one env·503·SECRET·두 창/owner 구별 | — |
| VP2·4 | native snapshot | SDK readers·context cache/lease·adapter readers (3) | 3/3 | `session-context.test.ts:shares resource flights per directory…`, app의 실제 adapter/SDK 연결 테스트 | A/B 폴더 MCP 이름 구별, config 1회·MCP 실패/재시도 포함 3회 | — |
| VP1·2·3·5 | 화면/scope | state·hook·등록/wrapper·공통 view (4) | 4/4 | `NativeResources.test.ts`가 실제 tileRegistry부터 렌더, state·Controls·공통 tile tests | 첫 입력 전 plugin 선표시·B-only/A-late 폐기·첫 입력 후 live-mcp 표시 | — |

13/13 SELF_PASS. §10 검색과 실제 production chain 대조에서 추가 운반 자리 없음. trace의 SDK→main boundary는 실제 adapter/SDK transport fixture, IPC→renderer 경계는 preload 왕복, renderer→view는 실제 hook/state/registry 실행으로 연결했다.

| pair | 자기 상태 | 근거 |
|---|---|---|
| VP1 | SELF_PASS | 타일 통합·Controls popup 무안내·기존 runtime 타일 |
| VP2 | SELF_PASS | 취소·화면 전환·서버 generation·release·동일 scope cache |
| VP3 | SELF_PASS | main resolver/adapter/schema와 preload 왕복 |
| VP4 | SELF_PASS | 실제 SDK transport의 독립 MCP/config 응답·재시도 |
| VP5 | SELF_PASS | 안전 오류 allowlist·handler log spy·state 실패 보존 |

## [구현자 기입] 이번 라운드 수정의 잠금

선택 mutation 없음 — 모두 직접 응답·상태·렌더 결과 oracle. 선택 증거 0 + 인용 변이 0 + 새 구조 proxy 0 = 잠금 표 행 0.
기존 상태 타일 테스트의 3개 실패는 HEAD 구현을 임시 복원해도 동일하게 발생했다. 이전 감시 등록 계약을 테스트 대역이 목록 조회로 소비하던 문제로, 대역에서 관측 등록 ACK와 실제 read를 분리한 뒤 공통 타일 4개 테스트가 통과했다. production 파일은 복원 후 원래 변경 바이트로 되돌렸다.

## [구현자 기입] Product/UX 파생 검토

첫 입력 전 목록은 읽기 전용이다. 부분 실패에도 성공 목록·정적 fallback을 유지하며 고정 새로고침 아이콘으로 재조회한다. popup에는 안내·스피너를 추가하지 않았고 `Controls.interaction.test.ts`가 loading/error/ready 메뉴에서 이를 단언한다.
동적 MCP에는 설정 파일이 없을 수 있어 `canOpen=false`를 추가했다. draft plugin 디렉터리 opener도 미지원이므로 동작과 잘못된 열기 tooltip을 비활성화한다. 실제 프로그램 창의 시각 검토는 미실행이며 기존 Button/CascadeBody/시맨틱 스타일을 재사용했다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| 발견 | 처리·근거 |
|---|---|
| 첫 메시지 이후 channel의 metadata 결합 대기 | 이번 사용자 확인에서 응답 후는 정상. 기존 경로를 유지하며 전체 runtime 관측 개선은 별도 범위 |
| nav 전역 토글 미구현 | 0278 DRAFT에 남아 있음. 이번 변경을 전역 제어 완료로 보고하지 않음 |
| 원본 오류 구분 불가 | `opencode.catalog.failed`에 stage/reason/httpStatus를 남김. 다른 PC에서 재발 시 이 레코드로 진단 가능 |
| 새 resource part cache의 공유·만료·재진입 | 기존 generation과 동일 수명, TTL 없음. mcp/plugins 독립 flight와 수동 refresh. A/B·중복·release·invalidate tests로 확인 |

## [구현자 기입] 구현 보고

| AC | 자기 결과 | 관측 |
|---|---|---|
| AC1 | ✅ | actual adapter/SDK 응답을 main handler가 반환; 등록 타일이 첫 입력 전 Superpowers/dynamic-mcp 렌더 |
| AC2 | ✅ | provider/MCP promise가 pending인 동안 plugin/agent 완료 |
| AC3 | ✅ | directory cache 공유·scope 전환 폐기·generation 종료·owner release tests |
| AC4 | ✅ | 준비 중/조회 중 취소는 cancelled·warn 0. 503은 mcp/http/503만 기록, SECRET 없음 |
| AC5 | ✅ | popup 무안내, draft 제어 없음, 동적 파일 열기 비활성, sessionId 이후 live 경로 |

✅5 · ⚠️0 · ❌0 = 총 5. 이는 자기검증이며 독립 verify와 다른 PC의 원본 오류 재현은 남아 있다.

검증 명령·산출과 환경 한계는 [validation.md](evidence/validation.md)에 기록한다.

## [구현자 기입] Review Signals

r1. 이전 구현에서 첫 입력 전 agent만 준비하고 상태 패널은 파일 discovery에 남겨 두어 사용자에게 표시 시점이 달랐다. 공통 catch는 정상 취소까지 실패로 덮어 원인 구분을 막았다. 독립 검증은 이 턴에서 수행하지 않는다.
