# 0305 코드 비대화 감사

> 계약은 [`plan.md`](plan.md). 이 문서의 표는 `data/*.json` 에서 렌더한 생성 블록이다 — 표를 직접 고치지 않는다.
> 기준 커밋 `a0a95f7`. 재현: `node scan/volume.mjs --check && node scan/audit-check.mjs --check`.

## 진행표

| 단계 | 산출 | 상태 |
|---|---|---|
| P1 | 분량 지도 | 완료 |
| P2 | 시나리오 카탈로그 | 완료 |
| P4 | 렌즈별 후보 | 대기 |
| P5 | 경로 추적 5건 + 전 시나리오 검토 | 대기 |
| P6 | 분할안 · 승인 목록 | 대기 |

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
(대기 — 이 단계의 data 파일이 아직 없다)
<!-- /gen:candidates -->

## 4. 승인 목록

사용자 관측 능력을 없애거나 기존 채택 결정을 바꾸는 후보다. 승인한 항목만 후속 handoff 에서 제거한다(plan D-005).

<!-- gen:approvals -->
(대기 — 이 단계의 data 파일이 아직 없다)
<!-- /gen:approvals -->

## 5. 경로 추적

<!-- gen:traces -->
(대기 — 이 단계의 data 파일이 아직 없다)
<!-- /gen:traces -->

## 6. 시나리오별 경로 검토

칸의 `—` 는 그 범주에서 후보를 찾지 못했다는 뜻이다. 범주 정의는 plan §9 의 X1~X7.

<!-- gen:reviews -->
(대기 — 이 단계의 data 파일이 아직 없다)
<!-- /gen:reviews -->

## 7. 후속 handoff 분할안

<!-- gen:split -->
(대기 — 이 단계의 data 파일이 아직 없다)
<!-- /gen:split -->
