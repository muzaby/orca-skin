# 구현 보고 — Work·Coding 제품 에이전트 계층

작성: **Codex**, 2026-09-08, r1. 기준 계약은 [plan V1](plan.md)이다. 구현·자기확인 보고이며 독립 verify를 대신하지 않는다.

## 1. 설계 리뷰

Work/Coding을 세션 출생 속성으로 추가했다. Main의 고정 프로필과 Renderer의 표현 매핑이 같은 `agentKind`를 소비한다. 기존 실행 어댑터·도구·승인·확장 빌더·작업 패널을 공유하며 신규 패키지는 없다.

| 검토 | 구현 판단 / 근거 |
|---|---|
| 제품 역할과 backend 분리 | `shared/agent-kind.ts` → Main `features/agents/profiles.ts`. 어댑터는 선택 UI를 모르고 지침과 opaque key만 받는다. |
| Coding 보존 | Coding profile은 빈 추가 지침이다. 실제 builder→Claude SDK 옵션 시험에서 Work 부분을 제거한 append가 Coding bytes와 같다. |
| 종류의 권위 | DB 이전에는 lease, 확정 이후에는 DB. mismatch는 busy 예약·runtime 획득 전에 거부하고 준비 중 await 이후에도 원본을 재확인한다. |
| 재로드 가능한 Work 표시 | `response_boundary` part를 기존 메시지 저장 경로에 추가했다. `ended`는 수신 구간 종료이며 작업 성공 판정이 아니다. |
| A/B 커밋 분리안 | 공유 part union·writer·reducer·렌더 소비처가 함께 바뀌므로 r1 구현 커밋은 함께 묶는다. A/B 검증은 아래 증거로 구분한다. 제품 계약·V1은 변경하지 않았다. |
| 보류 범위 | SRT·OpenCode adapter·뷰어·참조 컨텍스트 수집·일반 생성물 탐지·watcher는 구현하지 않았다. 기존 명시 게시 도구를 재사용한다. |

## 2. 강제 지점 전수와 V-pair 자기확인

아래 경로의 `src/`는 `app/src/` 기준이다. 표의 분모는 plan §10의 책임 지점 단위이며 함수 개수와 다르다.

| EP | 코드 연결 확인 | 관측한 지점과 시험 |
|---|---:|---|
| EP-01 | 1/1 | `shared/protocol.ts` enum→admission. `protocol.send.test.ts` invalid/omission/주입값 제거. |
| EP-02 | 3/3 | reducer 선택·잠금 / store 일반 send / busy send. `chatStore.agentKind.test.ts` 자료 보존·실패 뒤 잠금. |
| EP-03 | 4/4 | send DB/source / lease 생성 / busy 이전 비교 / resolveTurn 전후 비교. preparing 변이 RED, 원본 삭제·변경 deferred 시험 GREEN. |
| EP-04 | 3/3 | 초기·자동 TurnContext / writer insert / migration·insert 충돌. 실제 SQLite 재열기·출생값 보존 시험. |
| EP-05 | 3/3 | list·project list DTO / reader·load / store 승격·load. `agent-kind`, `dto`, `session.load`, store 시험. |
| EP-06 | 4/4 | send 최초·자동 builder / header / Claude query append. `work-profile.integration.test.ts` query 옵션·plugins·MCP·승인 동일. |
| EP-07 | 3/3 | runtime key 저장·정리 / respawn helper·policy / runtime-entry. 같은 key 재사용·다른 key 교체 시험. |
| EP-08 | 4/4 | 자동 respawn / listen / flush / coordinator retry. 자동 key 누락 변이 RED, continuation·runtime-tools 시험 GREEN. |
| EP-09 | 2/2 | 기존 승인·workspace guard / runtime tool context. Work permission-mode·worktree 및 SDK canUseTool deny 관측. |
| EP-10 | 2/2 | AssistantTurn 분기·memo / Exchange 전달·memo. 분기 교환·소비자 Coding 상수 변이 모두 RED. |
| EP-11 | 3/3 | boundary projection / result reconcile / ActivityDisclosure·공유 segment. 늦은 result·접기 unmount·질문 IPC 시험. |
| EP-12 | 2/2 | Work 최초 패널 열기·사용자 닫기 / 기존 출력·게시 카드 수명. store·ArtifactCards.lifecycle·artifactStore 전체 회귀 통과. |
| EP-13 | 5/5 | begin / run·steer 마감 / writer 주소 / event·reducer routing / reader·fork. 실제 coordinator+SQLite 통합 및 outcome 변이 시험. |
| EP-14 | 3/3 | presentation / 랜딩·Composer / ChatTile. native 모드 전환 시 같은 textarea, placeholder 변경; Work 세션 key 시험. |
| EP-D | 2/2 | plan 메타·INDEX 상태는 최종 보고와 함께 갱신하고 다시 읽어 대조한다. |

검색 술어: `agentKind|agent_kind|resolveAgentKind`(생성·선택·전송·저장·복원), `extensions|runtimeToolContext|requestApproval|makeWorkspaceGuardHook|runtime.send`(조립·권한·연속 실행), `response.boundary|response_boundary|parentToolRunId|user.message.committed`(표시·영속 경계), `AssistantTurn|Exchange|TaskOutputContent|ArtifactCard`(실제 소비처). 위 책임 지점의 연결을 확인했으며, 외부 SDK 동작까지 코드 검색으로 증명하지 않는다.

증거 묶음:

- **G**: [파일별 회귀 결과](evidence/regression.json). 410파일, 3,752 통과·1 live 시험 건너뜀. scripts 109 통과. 재실행 결과는 같은 파일을 교체해 집계했으며 중복 합산하지 않았다.
- **A**: `protocol.send`, `profiles`, `system-header.agent`, `agent-kind`, `migrate`, `dto`, `session.load`, `resolve-turn.agent`, `send.busy`, `send.permission-mode`, `send.worktree`, `turn-context`, `runtime-entry`, `chat-turn-continuation`, `chat-turn.runtime-tools`, `work-profile.integration` 시험.
- **B**: `response-boundary.integration`, `turn-coordinator`, `history/writer`, `history/reader`, `orchestration/fork`, `workActivity`, `workToolResults`, `TranscriptView.workResults`, `WorkActivity.render/interaction/questionIpc`, `ChatTile.workLifetime`, `chatStore.agentKind` 시험.
- **U**: [native UI 결과](evidence/native-ui.json)·[밝은 테마](evidence/work-light.png)·[어두운 테마](evidence/work-dark.png)·[좁은 창](evidence/work-narrow.png).
- **P**: [Coding React 성능 원자료](evidence/coding-performance.json), [Work selector 관측](evidence/selector-performance.log). 구체 범위는 §6.
- **W**: [Work DOM 수명 결과](evidence/work-dom-lifetime.json). 실제 Exchange/WorkActivity/ToolCard/useScrollAnchor, production CSS, Chromium offscreen에서 합성 응답 갱신·늦은 결과를 관측했다. virtualizer·전체 앱 이동·실제 모델 시험은 포함하지 않는다.

| Pair | 자기 상태 | 직접 관측 / 남은 한계 |
|---|---|---|
| VP-01 | SELF_PASS | U의 좌우·클릭·Enter·Space·textarea 보존 + A/B의 send·승격. |
| VP-02 | SELF_PASS | A의 SQLite legacy upgrade·재열기·목록/로드 + B store 복원. |
| VP-03 | SELF_PASS | A의 preparing/live mismatch에서 실행·예약 억제, 선택 변이 RED. |
| VP-04 | SELF_PASS | A/B의 fork·handoff·retry·continuation 종류 보존. |
| VP-05 | SELF_PASS | A 실제 builder→SDK 옵션, Coding append bytes 동일·Work 1회. |
| VP-06 | SELF_PASS | A 실제 MCP 서버 생성·plugin 옵션·runtime tool context. query는 mock이며 미구현 SDK 호환성 보증 아님. |
| VP-07 | SELF_PASS | A warm reuse/respawn·자동 경로 대칭, 선택 변이 RED. |
| VP-08 | SELF_PASS | A 승인 deny·workspace·worktree, G 기존 권한 회귀. |
| VP-09 | SELF_PASS | B 실제 selector/컴포넌트의 도입·작업·메모·결론 순서. |
| VP-10 | SELF_PASS | B 특수 part 분류·기존 segment 재사용, Work 질문→Composer→permission IPC→완료 Q&A. |
| VP-11 | SELF_PASS | B 실제 coordinator→DB와 live 순서 일치; aborted/failed/unknown·late result·fork. |
| VP-12 | SELF_PASS | G 게시 카드/삭제/구독 수명 + B 사용자 닫음 존중. 0223의 기존 실제 모델 인수는 별도 미완료. |
| VP-13 | SELF_PASS | G Coding·copy/fork·라우팅 회귀 + B 기존 renderer branch, 선택 변이 RED. |
| VP-14 | SELF_PASS | P의 Coding 비교·과거 재계산 없음, W의 열린 카드·과거 DOM·스크롤 유지. |
| VP-15 | SELF_BLOCKED | 실제 Claude 호출 자동 승인 검토 거부. mock을 AT-15 대체 증거로 쓰지 않았다. |
| VP-16 | SELF_PASS | A/B 최초 준비·빠른 후속·DB reopen·fork 상태 전이 통합. OS 앱 재시작을 포함한 실제 모델 시나리오는 VP-15에 남김. |
| VP-17 | SELF_PASS | A 세션별 profile·tool context·취소 경계, U 모드 안내, B 세션별 표시·패널. 실제 모델 동시 실행은 미측정. |
| VP-18 | SELF_PASS | B 경계·중단·late·재로드 및 접기 unmount, W late append 중 펼침·스크롤 유지. 재시작 후 접기 상태 영속을 약속하지 않는다. |
| VP-19 | SELF_PASS | A의 실제 IPC schema·SQLite·profile·builder→SDK query 옵션과 B store load. |
| VP-20 | SELF_PASS | A preparing/resume 거부·spawn key 기록/정리·listen/flush. |
| VP-21 | SELF_PASS | B 공유 AssistantSegment/ToolCard/질문 UI·Composer 경로, U textarea identity 유지. |
| VP-22 | SELF_PASS | A undefined/enum/mismatch 및 header bytes 단언. |
| VP-23 | SELF_PASS | A 같은 key/변경 key·listen/flush 인자·재사용 단언. |
| VP-24 | SELF_PASS | B part 분류·마지막 text 반례·완료 메시지/도구 identity. |
| VP-25 | SELF_PASS | B 실제 경계 영속·routing·outcome. 오류/중단을 ended로 만드는 변이 RED. |
| VP-26 | SELF_PASS | U 모드 안내·입력 보존, B send/load·Exchange/ChatTile·패널 종류 전달; 상수 변이 RED. |
| VP-27 | SELF_PASS | B presentation 모드별 매핑·U placeholder·store 패널 기본값. |

## 3. 이번 라운드 수정의 잠금

| 선택 변이 | 관측 | 복구 확인 |
|---|---|---|
| VP-01 Todo/Terminal 교환 | [아이콘 단언 RED](evidence/VP01-mutation.log) | 원복 후 G GREEN |
| VP-03 preparing lease 조회 제거 | acquire가 1회 호출되어 해당 시험 1 FAIL. 에이전트 도구 출력 `28f222`; 별도 로그 파일 없음 | 원본 byte 복원 후 관련 5파일/29 GREEN |
| VP-07 자동 profile key 제거 | same-key가 불필요 respawn하여 1 FAIL. 도구 출력 `ad273a`; 별도 로그 파일 없음 | 위 관련 시험 GREEN |
| VP-13 Work/Coding branch 교환 | [renderer 단언 RED](evidence/VP13-mutation.log) | 원복 후 G GREEN |
| VP-14 완료 메시지 cache 제거 | [parts 읽기 100→10,100, RED](evidence/VP14-mutation.log) | 원복 후 반복 읽기 증가 0 |
| VP-25 abort/failed를 ended로 변경 | 이벤트·throw 두 입력 축에서 4 RED. 별도 로그 파일 없음 | 원본 복원 후 coordinator·G GREEN |
| VP-26 Exchange 소비자 Coding 상수 | [Work 배선 단언 RED](evidence/VP26-mutation.log) | 원복 후 G GREEN |

그 밖의 수정은 직접 oracle이다. 신규 강제 변이를 확대하지 않았다. 원본 삭제/종류 변경은 provider 준비 Promise를 보류시킨 시험에서 RED→GREEN, Work 질문 IPC는 실제 store action과 IPC spy의 정확한 payload 1회로 확인했다.

## 4. Product/UX 파생 검토

| 사용자 상황 | 결과와 근거 |
|---|---|
| 새 대화 모드 전환 | 중앙 버튼은 기존 토큰·Button/Icon을 사용한다. native에서 입력 내용과 textarea 객체가 유지되고 안내가 바뀐다. |
| 첫 전송 실패 후 재시도 | 출생 종류는 잠긴다. 빠른 후속 전송이 다른 프로필을 기존 lease에 섞지 않는다. |
| Work 작업 중 질문 | 미응답 질문은 기존 Composer 카드에 표시한다. 제출은 permission IPC, 응답 완료 후 타임라인 Q&A가 한 번 표시된다. |
| 중단·오류·불명 종료 | 부분 출력과 상태를 남긴다. 임의의 마지막 text를 완료 결론으로 승격하지 않는다. |
| 늦은 도구 결과 | toolRunId로 원래 교환에 연결하고 다른 교환의 캐시를 바꾸지 않는다. 원문 part는 이동하지 않는다. |
| 패널 닫은 뒤 응답 | Work 최초 진입에서만 작업 패널을 열고 사용자 닫기를 유지한다. 진행/출력/컨텍스트를 재사용한다. |
| 다른 세션·fork로 이동 | Work TranscriptView key가 세션 수명과 맞는다. Composer와 Coding의 기존 key는 유지한다. |
| 파일 게시/삭제 | 기존 모델 명시 게시·원본 부재 표시·삭제 확인 경로를 유지한다. Work 도입으로 자동 탐지를 추가하지 않는다. |

## 5. 놓친 잠재 문제 + 대응

| ID | 발견·판정 | 대응 / 관측 |
|---|---|---|
| I-01 | 준비 중 원본 삭제/변경, 구현 세부 | resolveTurn await 앞뒤에 출생 권위를 재확인. deferred 시험으로 잠금. |
| I-02 | telemetry가 writer 주소를 비우는 경우, 구현 세부 | boundary의 대상 message ID를 별도 보관. end-only 메시지/FTS 오염/complete 역전 없이 저장. |
| I-03 | 늦은 result가 다른 DB Message·사용자 Exchange에 저장, 구현 세부 | session result selector로 join. 무관 exchange identity·원래 결론 참조 유지 시험. |
| I-04 | 완료 part 재탐색·wrapper 교체, 구현 세부 | 메시지/결과 cache와 세션 수명 key. 과거 part 반복 읽기 증가 0. |
| I-05 | 자식 알림뿐인 listen·reasoning만 있는 구간, 구현 세부 | child-only 출력으로 boundary 생성하지 않음. 빈 활동 요약 생성하지 않음. |
| I-06 | 기존 exact DTO 기대값 누락, 시험 정정 | session.load 두 기대값에 Coding 종류 명시, 해당 5/5 GREEN. |
| I-07 | 모델 게시율·실제 파일/재시작 인수, 미확인 | AC15 보류. 명시 승인 후 가상 회의 메모 시험; watcher 우회 없음. |
| I-08 | 실제 DOM 스크롤 인수, 관측 완료 | W의 20회 tail 갱신·late result에서 펼침/DOM 보존, scrollTop·anchorTop 차이 0. 숨은 창 rAF 정지는 offscreen fixture로 해소; 생산 코드 변경 없음. |

현재 구현 계약을 바꿔야 하는 PLAN_GAP은 발견하지 않았다. I-07의 외부 호출 승인은 남아 있다. 컨텍스트·뷰어·미구현 adapter는 후속 핸드오프 범위다.

## 6. 구현 보고

| AC | 자기 판정 | 관측 |
|---|---|---|
| AC1 | ✅ | 중앙 좌 Work/우 Coding, 클릭·Enter·Space·테마·폭·초안 보존(U), send(B). |
| AC2 | ✅ | legacy DB migration·reopen·목록/로드(A/B). |
| AC3 | ✅ | 준비/확정 종류 mismatch 부작용 거부(A). |
| AC4 | ✅ | fork/handoff/retry/continuation 상속(A/B). |
| AC5 | ✅ | Coding append 동일, Work 지침 1회(A). |
| AC6 | ✅ | 기존 MCP·plugins·runtime tool 경계 유지(A/G). 실제 임의 플러그인 전수 실기는 아님. |
| AC7 | ✅ | profile key 재사용·교체 및 자동 경로 대칭(A). |
| AC8 | ✅ | Work 승인·workspace/worktree 회귀(A/G). |
| AC9 | ✅ | Work 도입·작업·중간 메모·결론 순서(B). |
| AC10 | ✅ | 특수 part 분류·질문 IPC·완료 Q&A(B/G). |
| AC11 | ✅ | 경계 DB/live 동일·중단·늦은 결과·재로드(B). |
| AC12 | ✅ | 기존 패널·게시 카드 수명 회귀, 사용자 닫기 보존(B/G). |
| AC13 | ✅ | Coding 기존 렌더·라우팅·copy/fork·권한 회귀(G). |
| AC14 | ✅ | Coding 성능 비교·Work 캐시 및 실제 DOM 펼침/스크롤 유지(P/W). |
| AC15 | ⚠️ | 실제 Claude 호출 미실행: 자동 승인 검토 거부. |
| AC16 | ✅ | native 모드별 안내·같은 Composer, store send/load·본문/패널 조립(B/U). |

검산: **✅ 15 · ⚠️ 1 · ❌ 0 = 16**. 자기보고이며 AC15를 포함한 Cowork 전체 인수 완료로 표현하지 않는다.

| Gate | 실제 실행 결과 |
|---|---|
| ESLint | `app`: `./node_modules/.bin/eslint --quiet ./src ./scripts` exit 0. 후속 질문 시험은 scoped ESLint exit 0. 자동 fix는 사용하지 않음. |
| 타입·빌드 | `npm run build` exit 0. node/web/test 타입 구성과 main/preload/renderer bundle 생성. `prebuild` Electron ABI already ok. |
| Vitest | G의 410파일, 3,752 PASS·live 1 skip·실패 0. 단일 Node run 실패 파일은 Electron ABI 또는 격리 TEMP/USERPROFILE로 재실행. |
| Node scripts | 전체 109 중 sandbox realpath EPERM 8건. 해당 `ensure-sqlite-abi.test.mjs` 13/13 승인 실행으로 재확인, 최종 109/109. 바이너리 재빌드 없음. |
| migration·시험 예산 | sync/no-copies/append-only 및 real-git budget 검사 exit 0. legacy raw schema 시험은 허용 owner인 migrate.test.ts로 이동. |
| 문서·패치 | `check-doc-inventory.mjs --check`: generated/prose/link 통과. `git diff --check` 통과. |
| native UI | 모델 호출 없는 실제 production app. U의 5 checks true, errors 없음. 이미지 직접 확인. |
| Work DOM 수명 | W success=true, errors 없음. 펼친 활동/도구와 과거 DOM·결론 유지, 늦은 결과 실제 표시·root unmount 확인. |
| 실제 모델 | AC15 미실행. 자동 승인 검토 거부를 다른 경로로 우회하지 않음. |

전체 Electron Vitest 시도의 fork 종료 timeout과 JSON 없는 종료는 통과 근거에서 제외했다. 실제 SQLite 시험은 Electron RunAsNode로 실행하고 나머지는 Node로 실행하여 설치 ABI를 바꾸지 않았다. 숨은 native 창 시험은 sandbox의 GPU child 로드 제약 때문에 승인된 프로세스 실행으로 수행했다.

성능은 동일 Windows PC에서 기준 `04953cf7`과 변경 working tree를 5회 A/B·B/A 교대로 측정했다. 각 run은 이전 교환 100개·현재 완료 메시지 100개·tail 갱신 100회와 예열 20회다. 실제 Exchange/AssistantTurn/AssistantMessage·production profiling React를 쓰며 합성 Markdown·고정 CSS와 숨은 창을 사용했다.

| Coding 관측 | 기준 median / p95 | 변경 median / p95 |
|---|---:|---:|
| 동기 React 반영+layout | 2.70 / 4.20 ms | 2.40 / 3.70 ms |
| React actualDuration | 1.70 / 2.70 ms | 1.40 / 2.40 ms |

각 군 500회 측정이다. 모든 run에서 Exchange/AssistantTurn/AssistantMessage 렌더가 각각 갱신 횟수와 같은 100회이며, 과거 DOM identity가 유지됐다. 지속적인 10% 초과 악화는 관측되지 않았다. 이는 앱 전체 FPS·SDK 응답시간의 개선을 의미하지 않는다. 원자료 `manifest.current`는 준비 시 HEAD이고 실제 변경본은 `manifests.current.hashes`로 식별한다. 저장된 세 생산 파일 SHA256을 최종 소스와 대조하여 일치를 확인했다.

Work selector 시험은 과거/완료 parts 반복 읽기 증가 0을 관측했다. 이 시간은 React commit과 별개이며, CPU 부하가 있는 단일 selector p95를 제품 성능으로 일반화하지 않는다. 새로운 모델 분류·watcher·polling 등록은 추가하지 않았고 SDK 옵션 시험의 query 수는 입력 두 번에 두 번, 제목 complete 후 세 번이다.

W는 actual useScrollAnchor와 실제 클릭으로 읽기 위치를 바닥에서 분리한 후 검사했다. scrollTop 3409.6001px, 활동 anchorTop 80.1750px가 20회 tail 갱신과 원래 도구의 늦은 결과 반영까지 변하지 않았다. 동일 tool DOM·열림 상태에서 새 결과가 표시됐고 종료 시 root가 비었다. 일반 숨은 창의 45초 timeout은 통과 근거에서 제외하고 offscreen 결과만 사용했다. 저장된 생산 파일 SHA256도 최종 소스와 일치했다.

재현 fixture와 제한은 [실행 안내](fixtures/README.md)에 기록한다. plan·INDEX는 `impl/IMPL_DONE`, 다음 검증자로 맞추되 미완료 AC를 남기며 커밋은 `Status: partial`, `Verified-By: pending`으로 기록한다.

## 7. Review Signals

- 현재 r1. 이전 verify FAIL을 덮는 재구현이 아니다.
- V1의 preparing 종류 고정·stream/reload 동등성·과거 identity 요구가 실제 수정의 기준이었다.
- 전체 회귀에서 새 DTO 기대값과 migration 시험 owner를 바로잡았으며 guard를 약화하지 않았다.
- Node/Electron ABI 혼용, 사용자 홈의 sandbox realpath 제한, native 창 수명, child 에이전트 승인 대기가 검사 지연의 원인이었다. 미관측 실행을 exit code만으로 통과 처리하지 않았다.
- 다음 검증자는 위 SELF 상태를 독립 확인하고 실제 모델 게시·파일 bytes·DB 참조·출력 카드·재시작 인수를 마무리해야 한다.
