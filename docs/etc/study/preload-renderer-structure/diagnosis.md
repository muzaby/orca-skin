# Preload·Renderer 구조·성능 진단

> 조사 기준: `fbaac3fc`, 2026-09-08. 코드·실제 소비자·테스트를 확인한 연구 기록이다.
> 구현 계약과 게이트 정본은 [0222 계획](../../../handoff/0222-preload-renderer-structural-simplification/plan.md)이다.

## 1. 판단 기준

Main에서 적용한 파편화·응집/결합·중복·성능 기준을 preload와 renderer에 적용했다. 파일 길이보다 데이터와 수명의 실제 소유자, 같은 값을 반복해서 처리하는 경로, 상태를 관측하는 소비자를 기준으로 선정했다. 미래 adapter나 cowork를 위한 범용 실행·상태·조회 플랫폼은 만들지 않는다.

| 증거 | 의미 |
|---|---|
| 구조 조사 | import/배럴/호출/구독/상태 생산·소비와 큰 파일·작은 단일 소비자 파일을 확인 |
| 직접 행동 시험 | 노출 preload 객체, 실제 store·hook·callback을 구동한 결과 |
| 비용 관측 | 같은 요청의 호출 수, 같은 데이터의 참조 보존, notification 및 selector 결과 |
| 한계 | hook fixture는 실제 함수를 실행하지만 React 브라우저 스케줄러 전체를 재현하지 않는다. 앱 지연·최대 메모리·대형 데이터 성능은 측정하지 않음 |

## 2. 선택한 구조 리팩토링

| 영역 | 발견한 취약점 | 책임 재편과 보존할 동작 |
|---|---|---|
| preload 구독 | 공개 endpoint마다 listener 생성·on/off를 복제 | [index](../../../../app/src/preload/index.ts)의 private 구독 함수가 해제를 함께 소유. 각 공개 메서드의 채널/payload 타입은 명시적으로 유지 |
| chat store | committed/live/pending 갱신이 각기 entry를 복사. 완료·telemetry 한 이벤트가 중간 상태를 여러 번 발신 | [chatStore](../../../../app/src/renderer/src/features/chat/store/chatStore.ts) 안에서 entry 변경을 결집. 순수 reducer·세션 라우팅·rAF batching·다음 pending 전달은 유지 |
| 파일 자동완성 | listing의 수명이 입력 match 객체 전체에 묶여 prefix/caret 변경도 진행 IPC를 재시작 | [useFileAutocomplete](../../../../app/src/renderer/src/features/chat/hooks/useFileAutocomplete.ts)가 cwd/dir/토큰 활성으로 조회 수명을 결정. 필터·quoted/hidden·선택은 현재 입력 사용 |
| 제출 판정 | clear 조건과 실제 clear 수명, provider 차단과 제출 판정이 작은 전달 모듈로 흩어짐 | clear 판정은 composerSubmit, provider 판정은 sendAdmission으로 이동. pending 기준과 provider 경계의 서로 다른 의미는 구분 |
| 세션 목록 | 최근 조회와 프로젝트 조회가 같은 항목의 반영 방식을 달리하고, 변동 없어도 행/컨테이너를 복사 | [sessionsStore](../../../../app/src/renderer/src/features/sessions/store/sessionsStore.ts)에서 비교·병합을 공유. membership GC와 객체 열거/화면 순서를 함께 보존 |
| 프로젝트 초기화 | ProjectsProvider는 빈 cleanup을 반환하는 구독만 호출 | 실제 boot step의 초기 조회를 유지하며 no-op 호스트·구독·wrapper 제거 |
| Tweaks | 상태/저장이 hook, 효과/전체 Context 전달이 Provider에 분산. 폭과 무관한 소비자도 전체 값에 의존 | [TweakProvider](../../../../app/src/renderer/src/shared/theme/TweakProvider.tsx)가 provider별 store를 소유. 필요한 필드만 선택하며 저장 횟수·전체 snapshot rollback·DOM 효과 유지 |
| 검색 | app 셸이 query·debounce·결과 해석과 키보드 선택의 기능 로직을 소유 | sessions feature가 검색을 소유하고 app은 열림/닫힘·navigation만 연결. 같은 DOM과 선택 순서 유지 |
| 사용량 UI/선택 | 전역 UsageTab이 다른 탭 전용 SyncRow를 export. pages가 telemetry provider 정책을 소유 | SyncRow는 ProviderUsageTab 내부, telemetry usage hook은 chat으로 이동. 전역 폴백·provider 고정·boundary 이후 재조회 유지 |

preload의 invoke 메서드를 동적 dispatch나 공개 채널 registry로 일반화하지 않았다. renderer도 기존 Zustand·React와 기존 계층 안에서 작업하며, 새 공유 query/CRUD 프레임워크나 singleton settings service는 만들지 않는다.

## 3. 성능 개선의 근거와 한계

| 경로 | 줄이는 작업 | 보존하거나 별도로 볼 것 |
|---|---|---|
| 무효 chat action | reducer 결과가 같으면 root/entry 복사와 store notification 생략 | 실제 상태 변화·세션 간 전달·완료/에러/권한 전이는 유지 |
| completed/telemetry | 같은 이벤트의 committed/live 중간 notification을 결집 | delta coalescer와 다음 payload 전송 순서를 바꾸지 않음 |
| 파일 listing | 같은 디렉토리에서 응답 전 입력이 변해도 진행 조회 유지 | cwd/dir 변경·토큰 제거·unmount의 stale 응답 차단, 기존 디렉토리 캐시 유지 |
| 최근/프로젝트 목록 | 값·순서가 같으면 기존 행/목록 참조와 컨테이너 보존 | 고정 시각 동률의 nav 순서는 객체 열거 순서에도 의존하므로 함께 보존 |
| Tweaks | 안정된 Context store와 좁은 selector로 무관한 설정값 의존 제거 | 저장 IPC를 debounce하지 않음. 실제 화면 렌더 횟수나 FPS 개선률은 측정하지 않음 |

최적화와 구조 정리를 함께 다루되 시간 단축률을 주장하지 않는다. 무효 작업 제거는 직접 oracle로 확인하고, 실사용 규모의 성능은 별도의 측정 문제로 둔다.

세션 목록 참조 재사용에는 항목 필드와 순서를 비교하는 비용이 든다. 비교 비용과 그 결과로 생략되는 React 갱신의 손익은 목록 규모에 따라 달라질 수 있다. 이번 시험이 입증하는 것은 같은 응답의 불필요한 상태 교체·알림 제거이며, 전체 실행 시간이 언제나 줄어든다는 주장은 아니다.

## 4. 유지한 경계와 후속 측정 후보

| 대상 | 유지 이유 / 추가 관측 조건 |
|---|---|
| chatReducer·chat store·live coalescer | 세션별 순수 전이, 전역 라우팅, 프레임 단위 live 전달의 수명이 다르다. 크기만으로 store를 여러 독립 저장소로 나누면 동기화 책임이 늘어남 |
| FileDiffSection·parts 투영 | diff 알고리즘은 이미 별도 lib에 있고 컴포넌트는 문맥 확장·스크롤 보상·요구사항 draft의 DOM 수명을 소유한다. parts는 메시지/도구 결과의 identity·표시 투영을 함께 다룬다. 기계적 분할로 wrapper를 늘리지 않음 |
| provider state 수신 | gate의 초기 fail-closed, principal 표시, skills의 명령 세대/local step·재마운트 정책이 다르다. 단일 수신 owner를 만들려면 app 주입과 각 수명을 먼저 설계해야 하므로 이번에 합치지 않음 |
| skills/MCP/provider CRUD | mutation이 최신 목록을 반환하는 경로, mutation 뒤 다시 읽는 경로, push와 requestSeq로 결과를 결정하는 경로가 다름 |
| 세션 삭제 핸들러 | 셸은 저장 성공 전 chat 상태/route를 갱신하지만 페이지는 remove 성공을 기다린다. 이름이 같아도 같은 정책으로 병합하지 않음 |
| useAgents 수명 | 여러 등록 위치만으로 동시 중복 조회가 입증되지 않음. 전역 부팅 구독으로 바꾸면 비활성 화면에도 갱신이 생기므로 유지 |
| Composer 사용자 턴 수 selector | store notification마다 messages를 순회한다. 큰 transcript에서 selector 실행 수와 비용을 측정한 뒤 같은 messages identity의 재계산 제거를 검토. 파생 count를 새 영속 상태로 추가하지 않음 |
| 로그 직렬화·목록/markdown/diff 변환 | 입력 크기에 비례하는 비용 후보다. 현재 변환의 의미·오류·정렬·보안 경계를 먼저 보존하고 대형 입력에서 구간별 비용을 측정해야 함 |

## 5. 검증 결과

변경 전 preload·renderer·shared 1,400개와 변경 후 1,443개 시험이 모두 통과했다. 기존 시험의 이관 경로를 반영한 차집합은 0이며 43개를 추가했다. 타입 검사는 모두 통과했고 lint 오류는 0, 변경하지 않은 가상화 hook의 기존 경고는 1개다. 문서 inventory·상대 링크·실-git 시간 예산·diff 검사도 통과했다. 선택한 결함을 주입해 시험 실패를 확인하고 복원했다. 상세 관측과 재실행 명령은 [0222 구현 보고](../../../handoff/0222-preload-renderer-structural-simplification/plan.md)에 기록했다.

현재 보고서는 조사와 책임 재편의 근거다. 미구현 SRT·cowork·OpenCode adapter의 실제 호환성, GUI 전체 실기, 대형 입력의 체감 성능까지 검증한 것으로 해석하지 않는다.
