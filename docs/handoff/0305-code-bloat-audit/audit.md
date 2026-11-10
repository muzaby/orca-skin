# 0305 코드 비대화 감사

> 계약은 [`plan.md`](plan.md). 이 문서의 표는 `data/*.json` 에서 렌더한 생성 블록이다 — 표를 직접 고치지 않는다.
> 기준 커밋 `a0a95f7`. 재현: `node scan/volume.mjs --check && node scan/audit-check.mjs --check`.

## 진행표

| 단계 | 산출 | 상태 |
|---|---|---|
| P1 | 분량 지도 | 완료 |
| P2 | 시나리오 카탈로그 | 완료 |
| P4 | 렌즈별 후보 | 완료 |
| P5 | 경로 추적 5건 + 전 시나리오 검토 | 완료 |
| P6 | 분할안 · 승인 목록 | 완료 |

<!-- audit:complete -->

## 0. 요약

- **기계적으로 증명되는 과잉은 작다.** 미도달 채널 4 · 미사용 feature 1 · 참조 없는 export 16 · 생산자 없는 파트 1 · 죽은 설정 키 1 — 합쳐 수백 줄이다(§3 C-01~C-09).
- **복붙 중복도 작다.** Claude·OpenCode 같은 이름 파일 27쌍 중 35% 이상 겹치는 쌍은 1개(22줄)다(C-18).
- **가장 큰 단일 절감은 0225 이관 코드다** — prod 369줄 · test 465줄. 0292가 유지로 결정한 항목이라 승인이 필요하다(C-10·C-11).
- **분량의 대부분은 밀도 높은 기능 구현이다.** 전송 경로 한 곳에서 같은 세션 행을 6번 조회하고 같은 검증을 3중으로 한다(C-12). 응답 중 입력 대기는 public 메서드 26개짜리 프로토콜이다(C-14). 이런 항목은 줄 수 추정이 아니라 설계 검토가 필요해 절감을 `미추정`으로 뒀다.
- **테스트가 prod 의 1.5배다**(§1 합계 행). 감사는 테스트를 독립 대상으로 삼지 않았다(plan D-011) — 테스트는 제품 코드의 분기·상태 수를 따라 줄어든다.

### 재현 방법

| 근거 | 명령 |
|---|---|
| 분량 지도 | `node scan/volume.mjs --check` |
| 채널 호출부 | `cd app/src && rg -U -l '<xxxApi>\s*\??\.\s*<method>\b' renderer -g '!*.test.*' -g '!*.d.ts'` 에서 `shared/api/ipc.ts` 를 뺀 파일 수 |
| 참조 없는 export | `cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs` |
| 스키마 필드 | `cd app/src && node ../../docs/handoff/0305-code-bloat-audit/scan/lens-fields.mjs` |
| 표 일관성 | `node scan/audit-check.mjs --check` · `node --test scan/*.test.mjs` |

### 한계

- 과잉 범주 판정(§6)은 진입 핸들러와 `read` 칸의 파일까지 읽은 결과다. renderer 쪽 상태 관리(`chatStore.ts` 2,482줄 · `chatReducer.ts` 2,218줄)와 어댑터 내부(`adapters/claude/adapter.ts` 1,140줄 · `map.ts` 1,019줄)는 진입 심볼만 확인했고 내부 과잉은 판정하지 않았다 — 분량 상위 버킷이므로 후속 감사 대상이다.
- `saving` 이 0인 후보는 절감이 없다는 뜻이 아니라 추정하지 않았다는 뜻이다(`basis` 칸).

## 1. 분량 지도

버킷은 디렉토리 단위, 종류는 `scan/volume.mjs` 의 규칙 V1~V8 이다. 아래 표는 prod·test 만 보인다(지원 코드·데이터·도구는 `data/volume.json`).

<!-- gen:volume -->
| 버킷 | prod 줄 | test 줄 | test/prod | 파일 |
|---|---|---|---|---|
| **합계** | 113757 | 175170 | 1.54 | 2116 |
| renderer/features/chat/harnesses | 17599 | 20215 | 1.15 | 338 |
| main/adapters/claude | 6588 | 13398 | 2.03 | 107 |
| main/app/(root) | 4061 | 12078 | 2.97 | 83 |
| main/adapters/opencode | 5644 | 9877 | 1.75 | 90 |
| main/app/chat-turn | 3348 | 11946 | 3.57 | 62 |
| renderer/features/chat/lib | 5240 | 7289 | 1.39 | 116 |
| main/features/auth | 4111 | 6670 | 1.62 | 36 |
| main/features/plugins | 4710 | 5222 | 1.11 | 65 |
| renderer/features/chat/store | 3261 | 6660 | 2.04 | 45 |
| renderer/shared | 5513 | 4272 | 0.77 | 123 |
| main/features/chat | 3563 | 5433 | 1.52 | 40 |
| renderer/features/chat/components | 2772 | 5727 | 2.07 | 69 |
| shared/(root) | 5395 | 2782 | 0.52 | 70 |
| main/app/handlers | 1927 | 5688 | 2.95 | 54 |
| scripts | 0 | 6908 | — | 57 |
| renderer/features/chat/reducer | 2218 | 4235 | 1.91 | 28 |
| main/features/sessions | 1813 | 3236 | 1.78 | 19 |
| renderer/app | 2148 | 2691 | 1.25 | 48 |
| main/infra/git | 1461 | 3348 | 2.29 | 37 |
| main/infra/db | 2503 | 2171 | 0.87 | 55 |
| main/features/history | 1074 | 2850 | 2.65 | 20 |
| main/app/deployment | 444 | 3456 | 7.78 | 14 |
| main/features/extensions | 1916 | 1945 | 1.02 | 36 |
| renderer/features/skills/components | 2080 | 1428 | 0.69 | 26 |
| main/features/harnesses | 1372 | 1961 | 1.43 | 20 |
| main/adapters/common | 1637 | 1384 | 0.85 | 32 |
| main/features/artifacts | 1367 | 1431 | 1.05 | 17 |
| renderer/features/chat/hooks | 1311 | 1414 | 1.08 | 24 |
| main/features/usage | 851 | 1848 | 2.17 | 12 |
| main/infra/config | 1283 | 1239 | 0.97 | 30 |
| main/infra/(root) | 1120 | 1346 | 1.20 | 26 |
| main/app/harnesses | 763 | 1601 | 2.10 | 25 |
| renderer/features/engine/common | 735 | 1400 | 1.90 | 17 |
| renderer/features/sessions/components | 1049 | 741 | 0.71 | 9 |
| renderer/features/settings/components | 1087 | 611 | 0.56 | 13 |
| main/infra/net | 824 | 845 | 1.03 | 17 |
| renderer/pages | 334 | 1114 | 3.34 | 14 |
| main/features/worktrees | 381 | 947 | 2.49 | 7 |
| main/infra/log | 617 | 625 | 1.01 | 14 |
| renderer/features/skills/hooks | 470 | 758 | 1.61 | 6 |
| preload | 468 | 592 | 1.26 | 4 |
| renderer/styles | 838 | 193 | 0.23 | 4 |
| main/(root) | 355 | 671 | 1.89 | 6 |
| renderer/features/engine/harnesses | 653 | 324 | 0.50 | 11 |
| renderer/features/sessions/store | 362 | 514 | 1.42 | 6 |
| main/features/gate | 286 | 547 | 1.91 | 4 |
| main/contracts/(root) | 775 | 18 | 0.02 | 6 |
| renderer/features/projects/components | 743 | 43 | 0.06 | 11 |
| main/infra/ipc | 312 | 419 | 1.34 | 8 |
| main/features/approvals | 304 | 397 | 1.31 | 8 |
| renderer/features/skills/lib | 236 | 385 | 1.63 | 11 |
| shared/usage | 296 | 267 | 0.90 | 6 |
| main/features/scheduler | 241 | 285 | 1.18 | 5 |
| renderer/features/sessions/lib | 149 | 335 | 2.25 | 8 |
| renderer/features/artifacts/components | 351 | 47 | 0.13 | 3 |
| renderer/features/providers/components | 233 | 83 | 0.36 | 3 |
| main/features/orchestration | 91 | 181 | 1.99 | 4 |
| main/infra/error-report | 113 | 159 | 1.41 | 4 |
| renderer/features/artifacts/store | 112 | 132 | 1.18 | 2 |
| shared/harnesses | 171 | 68 | 0.40 | 5 |
| renderer/(root) | 79 | 159 | 2.01 | 7 |
| renderer/features/update/store | 195 | 31 | 0.16 | 2 |
| shared/time | 105 | 96 | 0.91 | 6 |
| renderer/features/backend/harnesses | 180 | 0 | 0.00 | 2 |
| renderer/features/camera/components | 174 | 0 | 0.00 | 1 |
| renderer/features/providers/lib | 46 | 119 | 2.59 | 4 |
| main/features/agents | 130 | 34 | 0.26 | 3 |
| renderer/features/update/components | 150 | 0 | 0.00 | 2 |
| main/infra/bus | 74 | 64 | 0.86 | 2 |
| renderer/features/providers/store | 65 | 70 | 1.08 | 2 |
| renderer/features/providers/hooks | 132 | 0 | 0.00 | 2 |
| renderer/features/projects/store | 65 | 60 | 0.92 | 2 |
| renderer/features/debug/components | 100 | 0 | 0.00 | 1 |
| renderer/features/sessions/hooks | 81 | 0 | 0.00 | 2 |
| renderer/features/settings/hooks | 77 | 0 | 0.00 | 2 |
| renderer/features/backend/store | 74 | 0 | 0.00 | 1 |
| renderer/features/chat/providers | 20 | 53 | 2.65 | 2 |
| renderer/features/debug/hooks | 55 | 0 | 0.00 | 1 |
| renderer/features/chat/(root) | 49 | 0 | 0.00 | 3 |
| renderer/features/settings/lib | 20 | 21 | 1.05 | 2 |
| renderer/features/settings/store | 38 | 0 | 0.00 | 1 |
| renderer/features/engine/components | 31 | 0 | 0.00 | 3 |
| renderer/features/skills/store | 13 | 13 | 1.00 | 2 |
| renderer/features/captures/components | 23 | 0 | 0.00 | 1 |
| renderer/features/sessions/(root) | 14 | 0 | 0.00 | 1 |
| renderer/features/cost/providers | 12 | 0 | 0.00 | 1 |
| renderer/features/backend/providers | 10 | 0 | 0.00 | 1 |
| renderer/features/update/(root) | 10 | 0 | 0.00 | 1 |
| renderer/features/update/providers | 10 | 0 | 0.00 | 1 |
| renderer/features/backend/(root) | 9 | 0 | 0.00 | 1 |
| renderer/features/sessions/providers | 9 | 0 | 0.00 | 1 |
| renderer/features/settings/(root) | 7 | 0 | 0.00 | 1 |
| renderer/features/projects/(root) | 5 | 0 | 0.00 | 1 |
| renderer/features/providers/(root) | 5 | 0 | 0.00 | 1 |
| renderer/features/cost/(root) | 3 | 0 | 0.00 | 1 |
| renderer/features/skills/(root) | 3 | 0 | 0.00 | 1 |
| renderer/features/artifacts/(root) | 1 | 0 | 0.00 | 1 |
| renderer/features/camera/(root) | 1 | 0 | 0.00 | 1 |
| renderer/features/captures/(root) | 1 | 0 | 0.00 | 1 |
| renderer/features/debug/(root) | 1 | 0 | 0.00 | 1 |
| renderer/features/engine/(root) | 1 | 0 | 0.00 | 1 |
| .github/workflows | 0 | 0 | — | 3 |
<!-- /gen:volume -->

## 2. 시나리오 카탈로그

시나리오는 사용자 조작 1개와 그 관측 결과다. 모든 IPC 채널과 renderer feature 가 시나리오 또는 미도달 표에 속한다.

<!-- gen:scenarios -->
| ID | 사용자 조작 | 관측 결과 | 채널 | feature |
|---|---|---|---|---|
| S-01 | 앱을 켠다 | 부팅 단계가 끝나고 마지막 세션 또는 새 대화 화면이 뜬다 | boot:report · boot:whenReady · backend:list · agent:list · settings:get · session:cwd · harness:availability · log:emit | chat · backend · settings |
| S-02 | 로그인 게이트에서 로그인·연결·재인증·해제한다 | 게이트가 풀리고 계정·연결 상태가 표시된다 | provider:login · provider:continue · provider:reauth · provider:revoke · provider:connect · provider:state | providers |
| S-03 | Claude CLI가 없거나 인증이 만료된 상태로 앱을 쓴다 | 설치 다이얼로그·만료 안내가 뜨고 설치 진행이 보인다 | install:start · install:status · harness:recheck | backend |
| S-04 | 새 대화에서 메시지를 보낸다(Claude) | 입력이 에코되고 응답이 스트리밍된 뒤 완료된다 | chat:send · chat:event | chat |
| S-05 | 새 대화에서 메시지를 보낸다(OpenCode) | 대기 단계가 표시되고 응답이 스트리밍된 뒤 완료된다 | chat:send · chat:event · composer:catalog · composer:catalog-release · composer:catalog-invalidated · extensions:opencode-plugins-changed | chat |
| S-06 | 응답 중에 중단한다 | 스트리밍이 멈추고 취소된 메시지로 표시된다 | chat:cancel | chat |
| S-07 | 응답 중에 입력을 더 보낸다(대기·즉시 보내기·대기 취소) | 입력이 대기열에 보이고 다음 턴에 전송되거나 즉시 전송된다 | chat:steerCancel · chat:steerSendNow | chat |
| S-08 | 도구 권한 요청에 답하거나 권한 모드를 바꾼다 | 승인 카드가 닫히고 도구가 실행되거나 거부된다 | permission:respond · permission:setMode | chat |
| S-09 | 동시 실행 한도를 넘겨 전송한다 | 대기 안내가 표시되고 자리가 나면 실행된다 | concurrency:event | chat |
| S-10 | 백그라운드 작업·서브에이전트를 보고 멈추거나 백그라운드로 보낸다 | 우측 패널에 작업 상태가 갱신된다 | chat:backgroundState · chat:backgroundEvent · chat:stopBackgroundTask · chat:promoteBackgroundTask · chat:stopSubagent · chat:backgroundSubagent | chat |
| S-11 | 사이드바에서 세션을 연다·이어 쓴다 | 이전 대화가 복원되고 이어서 보낼 수 있다 | session:list · session:load · session:refresh · session:titleEvent · session:native-resources · session:native-resources-changed | sessions · chat |
| S-12 | 세션을 이름 변경·고정·삭제하거나 빈 새 세션을 버린다 | 사이드바 목록이 바뀐다 | session:rename · session:setPinned · session:delete · chat:discardSession | sessions |
| S-13 | 대화 내용을 검색한다 | 검색 결과 목록에서 세션으로 이동한다 | search:messages | sessions |
| S-14 | 프로젝트를 만들고·고치고·고정하고·지우고 프로젝트의 세션을 본다 | 프로젝트 목록과 프로젝트 랜딩이 갱신된다 | project:list · project:create · project:update · project:delete · project:setPinned · project:listSessions | projects |
| S-15 | 작업 폴더를 고르거나 세션에 폴더를 추가한다 | 컴포저에 작업 폴더가 표시된다 | files:pickDirectory · session:addDirectory | chat |
| S-16 | 파일을 첨부하거나 @로 파일을 언급한다 | 첨부 칩·자동완성 목록이 뜨고 전송에 포함된다 | files:pickAttachments · files:readAttachment · files:list | chat |
| S-17 | 대화 속 파일 경로·컨텍스트 파일을 연다 | OS 기본 앱 또는 뷰어로 열린다 | files:openPath · files:openContextFile | chat |
| S-18 | 브랜치·변경사항을 보고 브랜치를 바꾼다 | 브랜치 칩과 diff 패널이 갱신된다 | git:snapshot · git:branches · git:checkout · git:diffPatch | chat |
| S-19 | 모델이 게시한 산출물을 보고·저장·고정·휴지통 처리한다 | 산출물 카드·목록·미리보기가 갱신된다 | artifact:list · artifact:catalog · artifact:setPinned · artifact:status · artifact:preview · artifact:save · artifact:reveal · artifact:trash | artifacts · chat |
| S-20 | 스킬을 보고·만들고·올리고·켜고 끄고·열고·지운다 | 플러그인 화면의 스킬 목록이 갱신된다 | skills:list · skills:author · skills:upload · skills:setEnabled · skills:open · skills:showInFolder · skills:remove | skills |
| S-21 | 확장(플러그인·MCP)을 전역으로 켜고 끄거나 연다 | 확장 목록과 컴포저 리소스가 갱신된다 | extensions:catalog · extensions:changed · extensions:managed-mcp-changed · extensions:setEnabled · extensions:open | skills · chat |
| S-22 | MCP 서버를 추가·수정·삭제한다 | MCP 목록이 갱신된다 | mcp:list · mcp:add · mcp:update · mcp:delete | skills |
| S-23 | 엔진·모델 연결을 추가·수정·삭제·가져오기 한다 | 엔진&모델 화면과 모델 선택 목록이 갱신된다 | engine:add · engine:update · engine:delete · engine:read · engine:importUserSettings | engine |
| S-24 | 사용량을 보고 한도를 정하고 새로 고친다 | 사용량 패널·통계가 갱신된다 | cost:usage · cost:usageEvent · cost:setProviderLimit · cost:refreshUsage · cost:usageStats | cost |
| S-25 | 설정(테마·글꼴·언어·계정 지침)을 바꾼다 | 화면에 즉시 반영되고 재시작 뒤에도 유지된다 | settings:set | settings |
| S-26 | 업데이트를 확인·내려받아 재시작한다 | 업데이트 상태·진행률이 표시되고 새 버전으로 재시작된다 | update:state · update:check · update:download · update:quitAndInstall · update:stateEvent · update:progressEvent | update |
| S-27 | 창을 최소화·최대화·닫는다 | 창 상태가 바뀐다 | window:minimize · window:maximize · window:close | settings |
| S-28 | 오류가 나면 토스트를 보고 로그 위치를 연다 | 오류 토스트가 뜨고 로그 폴더가 열린다 | error:reportEvent · error:drain · error:revealLog | chat |
| S-29 | 응답이 끝났을 때 창이 비활성이다 | OS 알림이 뜬다 | notify:show | chat |
| S-30 | 캡처 화면을 연다 | 준비 중 안내 화면이 보인다 | — | captures |
| S-31 | 개발 빌드에서 디버그 패널로 mock 응답을 켠다 | mock 시나리오로 응답이 재생된다 | debug:getMock · debug:setMock | debug |

| 미도달 | 이름 | 근거 |
|---|---|---|
| 채널 | orca:chat:stopAllBackgroundTasks | renderer 호출부 0 — `rg -U 'chatApi\s*\??\.\s*stopAllBackgroundTasks' app/src/renderer` (api/ipc.ts 제외) |
| 채널 | orca:chat:readBackgroundOutput | renderer 호출부 0 — 같은 검색, `readBackgroundOutput` |
| 채널 | orca:artifact:openFolder | renderer 호출부 0 — 같은 검색, `artifactApi.openFolder` |
| 채널 | orca:provider:list | renderer 호출부 0 — 같은 검색, `providerApi.list` (화면은 `provider:state` 를 쓴다) |
| feature | camera | `CameraView` 를 import 하는 곳 0 — `rg 'CameraView\|features/camera' app/src/renderer -g '!*.test.*'` 는 자기 파일뿐 |
<!-- /gen:scenarios -->

## 3. 축소 후보

<!-- gen:candidates -->
| 렌즈 | 방법 | 분모 | 후보 수 |
|---|---|---|---|
| L1 | 채널: preload 메서드 → `shared/api/ipc.ts` 래퍼 → renderer 호출부(`rg -U`) · feature: import 처 · export: 식별자 일치 스캔 · 이벤트·파트: 생산자 `rg` · 설정 키·스키마 필드: 읽는 곳 `rg` | 채널 117 · feature 14 · prod export 중 외부 prod 참조 0인 646 · 이벤트 변형 31 · 설정 키 24 | 11 |
| L4 | 추적 5건의 단계 전수 + 시나리오 31건의 진입 핸들러·경로 파일을 읽고 과잉 범주 X1~X7 판정 | 추적 단계 46 · 시나리오 31 | 6 |
| L5 | `adapters/{claude,opencode}`·`chat/harnesses/{claude,opencode}` 의 같은 이름 파일 쌍에서 12자 초과 비주석 줄의 겹침 측정(35% 이상 · 12줄 이상) | 같은 이름 파일 27쌍 | 1 |

후보 18건 · 예상 절감 합 prod 809줄 · test 465줄

| ID | 후보 | 버킷 | 렌즈·범주 | 유형 | 시나리오 | 출처 | 보존할 개념 요구 | 근거 | 절감 prod/test | 위험 |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | 백그라운드 작업 "전체 중단" 경로 | main/features/chat | L1 | remove | 없음 | 0231 | 개별 작업 중단(S-10)은 그대로 동작한다. 전체 중단 버튼은 화면에 없다 | `chatApi.stopAllBackgroundTasks` renderer 호출부 0 · `background-controller.ts:259-336` `stopAll` · `send.ts:115` `isStoppingAll` 게이트 · `docs/arch/backend/background-tasks.md:25` "현재 renderer에는" 호출 없음 | 80/0 — `stopAll` 78줄 + `stoppingAll` 집합·게이트. 채널·스키마·preload·api 래퍼는 다른 버킷이라 미산입, 테스트 미산정 | 중간 — main·preload API를 남긴 결정을 뒤집는다 |
| C-02 | 백그라운드 원본 출력 읽기 경로 | main/infra/(root) | L1 | remove | 없음 | 0231 | 작업 상태·요약 표시(S-10)는 그대로다. 원본 출력 읽기 화면은 없다 | `chatApi.readBackgroundOutput` renderer 호출부 0 · `background-controller.ts:338-355` `read` · `infra/background-output.ts:101-119,171-193` `read`·`readSnapshot` 은 그 경로만 호출 | 42/0 — `BackgroundOutputStore.read`·`readSnapshot` 줄 수. `capture`·`removeSnapshot` 은 다른 호출부가 있어 제외, 테스트 미산정 | 중간 — 캡처된 스냅샷을 읽는 유일한 경로다 |
| C-03 | 산출물 폴더 열기 채널 | main/app/handlers | L1 | remove | 없음 | 0223 | 산출물 개별 보기·저장·탐색기에서 보기(S-19)는 그대로다 | `artifactApi.openFolder` renderer 호출부 0 · `handlers/artifacts.ts:96` · i18n 문자열만 남음 | 9/0 — 핸들러 9줄 | 낮음 |
| C-04 | `provider:list` 채널 | main/app/handlers | L1 | remove | 없음 | 미상(rg -o '0[0-9]{3}' app/src/main/app/handlers/providers.ts → 0건) | 연결 상태 표시(S-02)는 `provider:state` 로 그대로다 | `providerApi.list` renderer 호출부 0(`rg -U 'providerApi\s*\??\.\s*list\b'`) · `handlers/providers.ts:46` | 2/0 — 핸들러 1문장 + import | 낮음 |
| C-05 | 미사용 camera feature | renderer/features/camera/components | L1 | remove | 없음 | 미상(rg -o '0[0-9]{3}' app/src/renderer/src/features/camera → 0건) | 없음 — 화면 어디에서도 열리지 않는다 | `rg 'CameraView\|features/camera' app/src/renderer -g '!*.test.*'` → 자기 파일 2건뿐 · 라우터에 경로 없음(`app/router.tsx`) | 174/0 — `CameraView.tsx` 174줄(버킷 prod 전체) | 낮음 — PRD 향후 범위일 수 있다 |
| C-06 | 어디서도 참조하지 않는 export 16개 | shared/(root) | L1 | remove | 없음 | 미상(cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs) | 없음 — 참조가 없다 | `relativeToDownloads`·`gitExecutable`·`branchExists`·`useBackendState`·`VISIBLE_TILE_REGISTRY`·`PanelButton`·`DISABLED_HATCH_CLASS`·`ArtifactTrashRequest`·`LOG_LEVELS`·`shared/plugin-catalog.ts` 타입 6·`PluginPresentation` — 식별자 일치 스캔 16/646 | 20/0 — 이 버킷(shared)에 속한 8개의 선언 줄 수 추정. 나머지 8개는 다른 버킷이라 미산입 | 낮음 |
| C-07 | 테스트만 쓰는 prod export 50개 | main/features/auth | L1 | remove | 없음 | 미상(cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs) | 없음 — 제품 경로에서 불리지 않는다. 테스트가 같은 동작을 공개 진입점으로 단언해야 한다 | 예: `createMemoryGrantPersistence`(tests 15)·`patSpec`(5)·`warmFileSqlite`(8)·`confluenceTools`(4)·`jiraTools`(3)·`scanOffenders`(4) 등 50/646. `*.testlib.ts` 의 7개는 테스트 지원 파일이라 제외 대상 | 0/0 — 미추정 — 항목마다 테스트 전용 seam인지 죽은 코드인지 후속 plan에서 분류 | 중간 — 테스트 seam으로 의도된 것이 섞여 있다 |
| C-08 | 생산자 없는 `structured_output` 파트 | renderer/features/chat/harnesses | L1 | remove | 없음 | 미상(rg -o '0[0-9]{3}' StructuredOutputCard.tsx → 0건) | 없음 — 어떤 하네스도 이 파트를 내지 않는다 | `rg "type: 'structured_output'" app/src/main -g '!*.test.*'` → 0 · `shared/ipc.ts:1533` "모델 정의만 두고 … 도입 시 채운다(seam)" · `StructuredOutputCard.tsx` 24줄 · `parts.ts:558` | 24/0 — 카드 컴포넌트 줄 수. `parts.ts`·registry·DB 타입의 분기는 다른 버킷 | 낮음 — 향후 seam을 지운다 |
| C-09 | 읽는 곳·쓰는 곳 없는 설정 키 `projectMcpChoices` | shared/(root) | L1 | remove | 없음 | 미상(rg -n 'projectMcpChoices' app/src -g '!*.test.*' → 스키마·타입 3건뿐) | 없음 | `shared/protocol.ts:778` · `shared/ipc.ts:1157,1179` 외 참조 0 | 3/0 — 선언 3줄 | 낮음 — 저장 파일에 남은 값은 스키마가 무시 |
| C-10 | 0225 이관 코드(DB·git 단계) | main/app/(root) | L1 | remove | 없음 | 0225·0292 | 이미 이관을 마친 설치본은 그대로 동작한다. 0225 이전 데이터 폴더에서 직접 올라오는 사용자는 이관을 받지 못한다 | `main/app/legacy-paths.ts` 163줄 · `legacy-paths.test.ts` 250줄 · 부팅마다 실행되는 일회성 이관 | 163/250 — 파일 줄 수 | 높음 — 0292가 "유지"로 결정했다 |
| C-11 | 0225 이관 코드(파일시스템 단계) | main/infra/config | L1 | remove | 없음 | 0225·0292 | C-10 과 같다 | `infra/config/migrate-legacy.ts` 206줄 · `migrate-legacy.test.ts` 215줄 | 206/215 — 파일 줄 수 | 높음 — C-10 과 한 묶음 |
| C-12 | 전송 1회에 같은 세션 행을 6번 조회·3중 검증 | main/app/chat-turn | L4 X4 X6 | restructure | S-04 S-05 S-11 | 0179·0188·0211 | 없는 원본·다른 하네스·다른 작업 종류로 보내면 오류 문구가 뜨고 전송되지 않는다 | `getSessionById`: `send.ts:83,163` · `resolve-turn.ts:72,74,104,160` (+`:248`) · 원본 존재 검증이 `send.ts:164`·`resolve-turn.ts:77`·`:85 checkContinuitySource`·`:160` 에 중복 · 하네스 불일치가 `send.ts:86` 과 `:176` 에 중복 | 40/0 — 중복 조회·검증 분기를 한 번의 조회 결과로 합칠 때의 추정. 테스트 미산정 | 중간 — 오류 문구가 분기마다 다르다(문구 통일은 사용자 관측 변화) |
| C-13 | production 이 항상 주입하는 의존성의 optional 선언과 fallback 분기 | main/app/chat-turn | L4 X4 | restructure | S-01 S-04 S-11 S-12 | 0262 | 같은 화면·같은 동작. 테스트는 production 조립과 같은 의존성으로 들어간다 | `context.ts:55-56` `harnessRuntime?`·`runtimeModelCatalog?` · `chat-turn/deps.ts:35,41` · `runtimeModelCatalog?.` 6건·`activity?.` 6건·`deps.background?.` 2건·`ctx.settings?.` 2건 · `handlers/misc.ts` agentList 의 `ctx.harnessRuntime ? … : fallback` · `handlers/session.ts` hooks 4개 전부 optional — 주입은 `bootstrap.ts:686,833,894,1159,1161,1289` | 15/0 — 이 버킷의 `?.`·fallback 분기 추정. 다른 버킷(handlers) 몫은 미산입 | 낮음 — 테스트 조립을 고쳐야 한다 |
| C-14 | 응답 중 입력 대기 프로토콜의 표면 | main/features/chat | L4 X2 X3 | restructure | S-07 S-09 | 0056·0060·0066·0067·0151·0152·0154·0250 | 응답 중 보낸 입력이 대기열에 보이고, 취소·즉시 보내기가 되며, 다음 턴에 순서대로 전달된다 | `pending-message-queue.ts` 610줄 · public 메서드 26개(`rg -n "^  (async )?[a-zA-Z]+\(" …`) · 테스트 742줄 · 호출 파일은 `chat-turn/*` 와 `turn-coordinator.ts` | 0/0 — 미추정 — 시나리오가 요구하는 전이(대기·취소·즉시 보내기·전달·되돌림)와 26개 메서드의 대응을 후속 plan에서 실측 | 높음 — 0151~0154가 고친 순서·고아 결함이 이 상태들에 걸려 있다 |
| C-15 | `handleChatSend` 의 상태 전달 클로저와 중복 준비 호출 | main/app/chat-turn | L4 X3 X6 | restructure | S-04 S-05 S-06 S-07 | 0188·0190·0210·0211·0301 | 전송·중단·이어 보내기의 결과가 같다 | `send.ts` 한 함수가 약 560줄 · `getActiveTurn`/`setActiveTurn`/`getInitialBatches`/`setInitialBatches` 4개 클로저로 상태 공유 · `prepareAgentExtensionProfile` 2회 · 하네스 `instructions` 설정 2회 읽기 | 0/0 — 미추정 — 구조 변경이라 줄 수보다 분기 수가 줄어든다 | 높음 — 정리 순서(`finally` 3단)가 취소·소유자 소멸 경로에 걸려 있다 |
| C-16 | 개발용 mock 어댑터 분기가 전송 경로에 있음 | main/app/chat-turn | L4 X5 | restructure | S-04 S-31 | 0003·0134·0204·0211 | 개발 빌드의 mock 재생(S-31)은 그대로다 | `send.ts:71,102` 가 매 전송마다 `ctx.mockAdapter && ctx.debugMock.enabled` 를 2회 판정 · `bootstrap.ts:890` 은 DEV 에서만 `MockAdapter` 생성 · `mock-scenarios.ts` 828줄은 정적 import | 4/0 — 어댑터 선택을 registry 한 곳으로 옮길 때의 추정 | 낮음 |
| C-17 | 컨텍스트 파일 권한 가드 중복 | main/app/handlers | L4 X4 X6 | restructure | S-17 | 미상(rg -o '0[0-9]{3}' app/src/main/app/handlers/files.ts) | 허용되지 않은 경로는 열리지 않는다 | `handlers/files.ts` `recordedContextDirectories` 와 `recordedAttachmentFiles` 가 같은 세션 조회 + `sessionContextPolicy(…).allowContextFileOpen` 가드를 각각 가진다 | 7/0 — 가드 1벌 줄 수 | 낮음 |
| C-18 | Claude·OpenCode `AssistantSegment` 중복 | renderer/features/chat/harnesses | L5 | restructure | S-04 S-05 | 미상(rg -o '0[0-9]{3}' …/transcript/AssistantSegment.tsx) | 두 하네스의 응답 본문이 지금과 같이 보인다 | 같은 이름 파일 27쌍의 줄 겹침 측정 — 35% 이상 겹치는 쌍은 `transcript/AssistantSegment.tsx` 1쌍(22줄, 71%) | 20/0 — 겹치는 줄 수 | 낮음 — 기존 진단이 "이름이 비슷하다고 합치지 않는다"를 경계로 뒀다 |
<!-- /gen:candidates -->

## 4. 승인 목록

사용자 관측 능력을 없애거나 기존 채택 결정을 바꾸는 후보다. 승인한 항목만 후속 handoff 에서 제거한다(plan D-005).

<!-- gen:approvals -->
| ID | 후보 | 승인이 필요한 이유 | 없어지는 것 | 절감 prod/test |
|---|---|---|---|---|
| C-01 | 백그라운드 작업 "전체 중단" 경로 | 제거 | 개별 작업 중단(S-10)은 그대로 동작한다. 전체 중단 버튼은 화면에 없다 | 80/0 |
| C-02 | 백그라운드 원본 출력 읽기 경로 | 제거 | 작업 상태·요약 표시(S-10)는 그대로다. 원본 출력 읽기 화면은 없다 | 42/0 |
| C-03 | 산출물 폴더 열기 채널 | 제거 | 산출물 개별 보기·저장·탐색기에서 보기(S-19)는 그대로다 | 9/0 |
| C-04 | `provider:list` 채널 | 제거 | 연결 상태 표시(S-02)는 `provider:state` 로 그대로다 | 2/0 |
| C-05 | 미사용 camera feature | 제거 | 없음 — 화면 어디에서도 열리지 않는다 | 174/0 |
| C-06 | 어디서도 참조하지 않는 export 16개 | 제거 | 없음 — 참조가 없다 | 20/0 |
| C-07 | 테스트만 쓰는 prod export 50개 | 제거 | 없음 — 제품 경로에서 불리지 않는다. 테스트가 같은 동작을 공개 진입점으로 단언해야 한다 | 0/0 |
| C-08 | 생산자 없는 `structured_output` 파트 | 제거 | 없음 — 어떤 하네스도 이 파트를 내지 않는다 | 24/0 |
| C-09 | 읽는 곳·쓰는 곳 없는 설정 키 `projectMcpChoices` | 제거 | 없음 | 3/0 |
| C-10 | 0225 이관 코드(DB·git 단계) | 제거 · 채택 결정 변경 | 이미 이관을 마친 설치본은 그대로 동작한다. 0225 이전 데이터 폴더에서 직접 올라오는 사용자는 이관을 받지 못한다 | 163/250 |
| C-11 | 0225 이관 코드(파일시스템 단계) | 제거 · 채택 결정 변경 | C-10 과 같다 | 206/215 |
<!-- /gen:approvals -->

## 5. 경로 추적

<!-- gen:traces -->
**T1 — 메시지 전송 → 스트리밍 → 완료(Claude) (S-04)**

| # | 파일:심볼 | 하는 일 | 효과 | 과잉 → 후보 | 유지 근거 |
|---|---|---|---|---|---|
| 1 | `main/app/chat-turn/index.ts`:`CHANNELS.chatSend` | IPC 수신. 검증 실패를 error 이벤트로 회신 | 있음 | — | — |
| 2 | `main/app/chat-turn/admission.ts`:`admitChatSend` | payload 스키마·업데이트 설치 대기·활성 어댑터 확인 | 있음 | — | — |
| 3 | `main/app/chat-turn/send.ts`:`ctx.mockAdapter && ctx.debugMock.enabled` | 개발 mock 어댑터 선택 | 없음 | X5→C-16 | — |
| 4 | `main/app/chat-turn/send.ts`:`ctx.db.getSessionById(boundId)` | 묶인 세션 조회, 하네스 변경 거부 | 있음 | X4→C-12 X6→C-12 | — |
| 5 | `main/app/chat-turn/send.ts`:`isStoppingAll` | 전체 중단 중이면 전송 거부 | 없음 | — | C-01 승인 전에는 유지 — 호출부가 없어 지금은 항상 false |
| 6 | `main/app/chat-turn/send.ts`:`normalizeAttachments` | 첨부를 읽어 정규화 | 있음 | — | — |
| 7 | `main/app/chat-turn/send.ts`:`ctx.db.getSessionById(sourceId)` | 같은 세션을 다시 조회, 원본 존재·작업 종류 검증 | 있음 | X4→C-12 X6→C-12 | — |
| 8 | `main/app/chat-turn/send.ts`:`supervisor.acquireChain` | 세션 임대. 바쁘면 입력을 대기열로 | 있음 | — | — |
| 9 | `main/app/chat-turn/enqueue.ts`:`reserveOnBusySession` | 바쁜 세션의 입력을 대기열에 예약 | 있음 | X2→C-14 X3→C-14 | — |
| 10 | `main/app/chat-turn/resolve-turn.ts`:`resolveTurn` | 모델·공급자·원본 기록 해석 | 있음 | X4→C-12 X6→C-12 | — |
| 11 | `main/app/chat-turn/prepare-worktree.ts`:`prepareTurnExecution` | worktree 격리·실행 폴더 준비 | 있음 | — | — |
| 12 | `main/app/chat-turn/runtime-entry.ts`:`acquireTurnRuntime` | 세션 런타임 획득·확장 구성 | 있음 | — | — |
| 13 | `main/app/chat-turn/enqueue.ts`:`enqueueTurnPrompt` | 첫 입력을 대기열에 넣고 제출 배치 구성 | 있음 | X2→C-14 | — |
| 14 | `main/features/chat/turn-coordinator.ts`:`class TurnCoordinator` | 어댑터 이벤트를 영속화·전달·재시도 | 있음 | — | — |
| 15 | `main/app/chat-turn/turn-request.ts`:`buildTurnRequest` | 어댑터에 넘길 요청 조립 | 있음 | — | — |
| 16 | `main/app/chat-turn/send.ts`:`runTurnWithContinuations` | 턴 실행과 자동 이어 보내기 | 있음 | X3→C-15 X6→C-15 | — |
| 17 | `main/adapters/claude/adapter.ts`:`sendMessage(req: TurnRequest)` | SDK 세션에 입력을 넣고 스트림을 연다 | 있음 | — | — |
| 18 | `main/adapters/claude/map.ts`:`claudeToNormalized` | SDK 메시지를 NormalizedEvent 로 변환 | 있음 | — | — |
| 19 | `renderer/src/features/chat/store/chatStore.ts`:`ingestChatEvent` | 이벤트를 세션 상태로 반영해 화면에 그린다 | 있음 | — | — |

**T2 — 메시지 전송(OpenCode) (S-05)**

| # | 파일:심볼 | 하는 일 | 효과 | 과잉 → 후보 | 유지 근거 |
|---|---|---|---|---|---|
| 1 | `main/app/chat-turn/send.ts`:`reportWaitPhase` | 대기 단계(준비·기록 확인)를 화면에 알린다 | 있음 | — | — |
| 2 | `main/app/chat-turn/send.ts`:`activity?.setWaitPhase?.` | 필수 의존성을 optional 호출로 부른다 | 있음 | X4→C-13 | — |
| 3 | `main/app/handlers/composer-catalog.ts`:`registerComposerCatalogHandlers` | 컴포저 모델·에이전트 목록을 창 단위로 읽고 무효화 | 있음 | — | — |
| 4 | `main/adapters/opencode/v1/adapter.ts`:`sendMessage(req: TurnRequest)` | OpenCode 서버 세션에 프롬프트 전송 | 있음 | — | — |
| 5 | `main/adapters/opencode/v1/map.ts`:`normalizeOpenCodeTool` | OpenCode 도구 이벤트를 공통 형태로 변환 | 있음 | — | — |
| 6 | `renderer/src/features/chat/store/chatStore.ts`:`ingestChatEvent` | 이벤트를 세션 상태로 반영 | 있음 | — | — |

**T3 — 세션 열기·재개 (S-11)**

| # | 파일:심볼 | 하는 일 | 효과 | 과잉 → 후보 | 유지 근거 |
|---|---|---|---|---|---|
| 1 | `main/app/handlers/session.ts`:`CHANNELS.sessionList` | 사이드바 목록 조회 | 있음 | — | — |
| 2 | `main/app/handlers/session.ts`:`CHANNELS.sessionLoad` | 세션 기록 로드 | 있음 | — | — |
| 3 | `main/app/handlers/session.ts`:`compactLegacyRaw` | 옛 raw 보관분을 열 때마다 압축 시도 | 없음 | — | 0292 raw 분리 보관 결정의 이행 경로 — 한 번 압축되면 no-op |
| 4 | `main/features/history/reader.ts`:`loadSession` | 메시지·파트를 조립해 화면용 세션으로 | 있음 | — | — |
| 5 | `main/app/handlers/session.ts`:`hooks.getActivity ?` | 활동 스냅샷을 optional hook 으로 붙인다 | 있음 | X4→C-13 | — |
| 6 | `main/app/handlers/session.ts`:`CHANNELS.sessionRefresh` | 원본 기록과 대조해 갱신 | 있음 | — | — |
| 7 | `main/app/chat-turn/resolve-turn.ts`:`getSessionById(payload.sessionId)` | 이어 보낼 때 세션을 다시 조회 | 있음 | X6→C-12 | — |

**T4 — 앱 부팅 → 첫 화면 (S-01)**

| # | 파일:심볼 | 하는 일 | 효과 | 과잉 → 후보 | 유지 근거 |
|---|---|---|---|---|---|
| 1 | `main/index.ts`:`CHANNELS.bootWhenReady` | renderer 가 main 준비를 기다린다 | 있음 | — | — |
| 2 | `main/app/bootstrap.ts`:`async start()` | DB·설정·인증·하네스·핸들러를 조립 | 있음 | — | — |
| 3 | `main/app/legacy-paths.ts`:`repairWorktree` | 0225 이전 경로를 새 루트로 다시 적는다 | 없음 | — | C-10 승인 전에는 유지 — 0292 결정 |
| 4 | `main/app/bootstrap.ts`:`new MockAdapter` | 개발 빌드에서만 mock 어댑터 생성 | 없음 | X5→C-16 | — |
| 5 | `main/app/handlers/boot.ts`:`CHANNELS.bootReport` | 부팅 보고서 전달 | 있음 | — | — |
| 6 | `renderer/src/app/boot/steps.ts`:`createBootSteps` | main-ready → 보고 → 하네스 → 랜딩 → 세션 → 프로젝트·사용량 순서로 실행 | 있음 | — | — |
| 7 | `main/app/handlers/misc.ts`:`ctx.harnessRuntime` | agent 목록에서 runtime 유무로 분기 | 있음 | X4→C-13 | — |
| 8 | `main/app/handlers/session.ts`:`CHANNELS.sessionCwd` | 마지막 작업 폴더 확인 | 있음 | — | — |

**T5 — 플러그인·확장 켜기/끄기 (S-21)**

| # | 파일:심볼 | 하는 일 | 효과 | 과잉 → 후보 | 유지 근거 |
|---|---|---|---|---|---|
| 1 | `main/app/handlers/extension-catalog.ts`:`CHANNELS.extensionCatalog` | 하네스의 전역 리소스 목록에 사용자 선택을 덮어 반환 | 있음 | — | — |
| 2 | `main/app/handlers/extension-catalog.ts`:`CHANNELS.extensionSetEnabled` | 토글 저장. Claude 플러그인이면 실행 중 프로세스 확인 후 닫기 | 있음 | — | — |
| 3 | `main/app/handlers/extension-catalog.ts`:`await read(request.backend)` | 토글 전후로 목록을 두 번 읽는다 | 있음 | — | 앞은 권한 확인, 뒤는 결과 반환 — 사이에 상태가 바뀐다 |
| 4 | `main/app/handlers/extension-catalog.ts`:`changed(request.backend)` | 다른 창·컴포저에 변경 알림 | 있음 | — | — |
| 5 | `main/app/handlers/skills.ts`:`CHANNELS.skillsSetEnabled` | 스킬 토글을 설정에 저장하고 목록 갱신 | 있음 | — | — |
| 6 | `main/app/handlers/mcp.ts`:`ctx.deployExtensions()` | MCP 변경 뒤 확장 재배포 | 있음 | — | — |
<!-- /gen:traces -->

## 6. 시나리오별 경로 검토

칸의 `—` 는 그 범주에서 후보를 찾지 못했다는 뜻이다. 범주 정의는 plan §9 의 X1~X7.

<!-- gen:reviews -->
| 시나리오 | X1 | X2 | X3 | X4 | X5 | X6 | X7 | 읽은 파일 |
|---|---|---|---|---|---|---|---|---|
| S-01 | — | — | — | C-13 | C-16 | — | — | main/app/bootstrap.ts · renderer/src/app/boot/steps.ts · main/app/handlers/boot.ts · main/app/handlers/misc.ts · main/app/handlers/session.ts · main/app/handlers/settings.ts · main/app/handlers/log.ts · main/app/legacy-paths.ts |
| S-02 | — | — | — | — | — | — | — | main/app/handlers/providers.ts |
| S-03 | — | — | — | — | — | — | — | main/app/handlers/misc.ts |
| S-04 | — | — | C-15 | C-12 C-13 | C-16 | C-12 C-15 | — | main/app/chat-turn/send.ts · main/app/chat-turn/admission.ts · main/app/chat-turn/resolve-turn.ts · shared/protocol.ts |
| S-05 | — | — | C-15 | C-12 | — | C-12 C-15 | — | main/app/chat-turn/send.ts · main/app/handlers/composer-catalog.ts |
| S-06 | — | — | C-15 | — | — | — | — | main/app/chat-turn/send.ts |
| S-07 | — | C-14 | C-14 C-15 | — | — | — | — | main/features/chat/pending-message-queue.ts · main/app/chat-turn/admission.ts · main/app/chat-turn/send.ts |
| S-08 | — | — | — | — | — | — | — | main/app/chat-turn/send.ts |
| S-09 | — | C-14 | — | — | — | — | — | main/app/chat-turn/send.ts · main/features/chat/pending-message-queue.ts |
| S-10 | — | — | — | — | — | — | — | main/features/chat/background-controller.ts · main/app/chat-turn/background.ts · main/infra/background-output.ts |
| S-11 | — | — | — | C-12 C-13 | — | C-12 | — | main/app/handlers/session.ts · main/app/chat-turn/resolve-turn.ts |
| S-12 | — | — | — | C-13 | — | — | — | main/app/handlers/session.ts |
| S-13 | — | — | — | — | — | — | — | main/app/handlers/files.ts |
| S-14 | — | — | — | — | — | — | — | main/app/handlers/project.ts |
| S-15 | — | — | — | — | — | — | — | main/app/handlers/files.ts · main/app/handlers/session.ts |
| S-16 | — | — | — | — | — | — | — | main/app/handlers/files.ts |
| S-17 | — | — | — | C-17 | — | C-17 | — | main/app/handlers/files.ts |
| S-18 | — | — | — | — | — | — | — | main/app/handlers/git.ts |
| S-19 | — | — | — | — | — | — | — | main/app/handlers/artifacts.ts |
| S-20 | — | — | — | — | — | — | — | main/app/handlers/skills.ts |
| S-21 | — | — | — | — | — | — | — | main/app/handlers/extension-catalog.ts |
| S-22 | — | — | — | — | — | — | — | main/app/handlers/mcp.ts |
| S-23 | — | — | — | — | — | — | — | main/app/handlers/engine.ts |
| S-24 | — | — | — | — | — | — | — | main/app/handlers/cost.ts |
| S-25 | — | — | — | — | — | — | — | main/app/handlers/settings.ts · shared/protocol.ts |
| S-26 | — | — | — | — | — | — | — | main/app/handlers/update.ts |
| S-27 | — | — | — | — | — | — | — | main/index.ts |
| S-28 | — | — | — | — | — | — | — | main/app/handlers/error.ts |
| S-29 | — | — | — | — | — | — | — | main/app/handlers/misc.ts |
| S-30 | — | — | — | — | — | — | — | renderer/src/features/captures/components/CapturesView.tsx · renderer/src/app/router.tsx |
| S-31 | — | — | — | — | C-16 | — | — | main/app/handlers/misc.ts · main/app/chat-turn/send.ts |
<!-- /gen:reviews -->

## 7. 후속 handoff 분할안

<!-- gen:split -->
| 순위 | 후속 handoff | 후보 | 예상 절감 prod/test | 회귀 판정 시나리오 | 비고 |
|---|---|---|---|---|---|
| 1 | H-A 미도달 코드 제거(승인분) | C-01 C-02 C-03 C-04 C-05 C-06 C-08 C-09 | 354/0 | S-10 S-19 S-02 S-04 S-25 | 승인된 항목만. 근거가 기계적이라 위험이 가장 낮다 |
| 2 | H-B 전송 경로의 중복 조회·검증·optional 분기 정리 | C-12 C-13 C-16 C-17 | 66/0 | S-01 S-04 S-05 S-11 S-12 S-17 S-31 | — |
| 3 | H-C 0225 이관 코드 제거 | C-10 C-11 | 369/465 | S-01 S-11 | 0292 결정 변경 — 승인 필요. 절감이 가장 크다 |
| 4 | H-D 응답 중 입력 대기 프로토콜과 `handleChatSend` 구조 축소 | C-14 C-15 | 0/0 | S-04 S-05 S-06 S-07 S-09 | 설계 검토가 먼저다 — 절감 미추정 |
| 5 | H-E 테스트 전용 export 분류·정리 | C-07 | 0/0 | S-02 S-04 | — |

| 보류 후보 | 사유 |
|---|---|
| C-18 | 겹침이 22줄뿐이고 기존 진단이 하네스별 정책 분리를 경계로 뒀다 — 절감 대비 위험이 크다 |
<!-- /gen:split -->
