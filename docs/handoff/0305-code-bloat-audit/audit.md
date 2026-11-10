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
| P7 | 분량 상위 버킷 심화 검토 (ΔV1) | 완료 |
| P8 | 분해안 · 분할안 갱신 (ΔV1) | 완료 |
| P9 | 읽지 못한 영역 보완 (r1.3) | 완료 |

<!-- audit:complete -->

## 0. 요약

- **기계적으로 증명되는 과잉은 작다.** 미도달 채널 4 · 미사용 feature 1 · 참조 없는 export 16 · 생산자 없는 파트 1 · 죽은 설정 키 1 — 합쳐 수백 줄이다(§3 C-01~C-09).
- **복붙 중복도 작다.** Claude·OpenCode 같은 이름 파일 27쌍 중 35% 이상 겹치는 쌍은 1개(22줄)다(C-18).
- **가장 큰 단일 절감은 0225 이관 코드다** — prod 369줄 · test 465줄. 0292가 유지로 결정한 항목이라 승인이 필요하다(C-10·C-11).
- **분량의 대부분은 밀도 높은 기능 구현이다.** 전송 경로 한 곳에서 같은 세션 행을 6번 조회하고 같은 검증을 3중으로 한다(C-12). 응답 중 입력 대기는 public 메서드 26개짜리 프로토콜이다(C-14). 이런 항목은 줄 수 추정이 아니라 설계 검토가 필요해 절감을 `미추정`으로 뒀다.
- **테스트가 prod 의 1.5배다**(§1 합계 행). 감사는 테스트를 독립 대상으로 삼지 않았다(plan D-011) — 테스트는 제품 코드의 분기·상태 수를 따라 줄어든다.

### 심화 검토에서 더 나온 것 (ΔV1)

- **과도하다고 판정한 버킷은 6개다** — `chat/store` · `chat/reducer` · `main/features/chat` · `main/app/chat-turn` · `adapters/claude` · `adapters/opencode`(§7). 공통된 형태는 한 함수·한 파일에 책임이 몰린 것이다: `chatReducer` 1,295줄, `handleChatSend` 약 740줄, `openChannel` 595줄, `openCodeChannel` 약 560줄, `chatStore.ts` 2,482줄.
- **같은 사실을 두 번 드는 상태가 가장 많이 나왔다.** `listening` 은 `activityTransport` 의 파생이고(C-24), 대기열 배치의 `uuid` 와 `attemptId` 는 늘 같은 값이며(C-25), 백그라운드 작업은 정본 모델과 구 모델이 함께 산다(C-34).
- **응답 중 입력 대기는 main 과 renderer 양쪽에 프로토콜이 있다.** 예약 여부를 두 곳이 각자 판정한다(C-14 · C-19) — 한 묶음(H-D)으로 설계해야 한다.
- **분해안은 §8 에 있다.** `restructure` 후보 23건 전부에 단계를 달았다. 첫 단계는 대부분 동작을 바꾸지 않는 추출·삭제다.
- 필요하다고 판정한 버킷 7개는 조립 루트 · 작은 순수 함수 묶음 · 외부 연동 · 계약 선언이다. 다만 `chat/harnesses`(prod 최대 버킷)와 `plugins` 는 읽은 양이 적어 "과잉 없음"이 아니라 "판정할 만큼 읽지 못함"에 가깝다(§7 근거 칸).

### 보완에서 더 나온 것 (r1.3)

r1.2 가 "판정할 만큼 읽지 못함"으로 남긴 `chat/harnesses`·`plugins` 와 미독 대형 파일을 읽었다.

- **OpenCode 컴포저 목록 조회가 또 하나의 과한 프로토콜이다**(C-36). 목록 하나를 띄우는 데 낡은 응답을 거르는 축이 6개(`owner`·`previousOwner`·`generation`·`retired`·`epoch`·`disposed`)이고 renderer 275줄 · main 277줄 · 테스트 4,850줄이 걸려 있다.
- **늘 같은 값만 들어오는 인자가 나왔다.** 메일 동기화의 단계 콜백은 유일한 호출부가 `undefined` 를 넘기고(C-37), diff 리뷰의 optional props 6개는 유일한 호출 사슬이 전부 넘긴다(C-38).
- **플러그인 3벌(Confluence·Jira·메일)은 복붙이 아니다** — 같은 역할 파일 7쌍의 겹침이 최대 7%다. 과잉은 메일 쪽의 죽은 콜백과 이중 합류뿐이다.
- `FileDiffSection.tsx`(915줄)·`ComposerInputController.tsx`(516줄)·`adapters/claude/map.ts`(1,019줄)는 크지만 기능(diff 보기 · IME 조합 보호 · SDK 메시지 변환)이 요구하는 분량으로 판정했다. 줄일 것은 선언·중복 계산 수준이다(C-38·C-39).

### 재현 방법

| 근거 | 명령 |
|---|---|
| 분량 지도 | `node scan/volume.mjs --check` |
| 채널 호출부 | `cd app/src && rg -U -l '<xxxApi>\s*\??\.\s*<method>\b' renderer -g '!*.test.*' -g '!*.d.ts'` 에서 `shared/api/ipc.ts` 를 뺀 파일 수 |
| 참조 없는 export | `cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs` |
| 스키마 필드 | `cd app/src && node ../../docs/handoff/0305-code-bloat-audit/scan/lens-fields.mjs` |
| 표 일관성 | `node scan/audit-check.mjs --check` · `node --test scan/*.test.mjs` |

### 한계

- 과잉 범주 판정(§6)은 진입 핸들러와 `read` 칸의 파일까지 읽은 결과다. r1 이 진입 심볼만 본 `chatStore.ts` · `chatReducer.ts` · 어댑터 내부는 심화 검토(§7)가 읽었다.
- 심화 검토의 `읽은 파일 줄 수`는 그 파일의 전체 줄 수라 **상한**이다. 일부 구간만 읽은 파일은 근거 칸에 구간을 적었다. 전부 읽은 파일은 `chatStore.ts` · `pending-message-queue.ts` · `post-turn.ts` · `runtime-model-startup.ts` 넷이다.
- 보완(r1.3) 뒤에도 개요만 본 큰 파일: `adapters/opencode/v1/session-context.ts`(567줄) · `features/auth/store.ts`(517줄) · `chatReducer` 의 `RECV_EVENT`(378줄)·`LOAD_SESSION`(159줄) case 본문 · `chat/harnesses` 의 나머지 약 200파일 · Confluence·Jira 플러그인 본문. 이 영역의 "후보 없음"은 과잉이 없다는 뜻이 아니다.
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
| L1 | 채널: preload 메서드 → `shared/api/ipc.ts` 래퍼 → renderer 호출부(`rg -U`) · feature: import 처 · export: 식별자 일치 스캔 · 이벤트·파트: 생산자 `rg` · 설정 키·스키마 필드: 읽는 곳 `rg` · (ΔV1) 심화 검토 중 생산자 없는 이벤트 변형 1건 추가 | 채널 117 · feature 14 · prod export 중 외부 prod 참조 0인 646 · 이벤트 변형 31 · 설정 키 24 | 12 |
| L4 | 추적 5건의 단계 전수 + 시나리오 31건의 진입 핸들러·경로 파일을 읽고 과잉 범주 X1~X7 판정 · (ΔV1) prod 3,000줄 이상 버킷 12개와 `chat/reducer` 의 내부 파일을 읽는 심화 검토 | 추적 단계 46 · 시나리오 31 · 심화 버킷 13 | 25 |
| L5 | `adapters/{claude,opencode}`·`chat/harnesses/{claude,opencode}` 의 같은 이름 파일 쌍에서 12자 초과 비주석 줄의 겹침 측정(35% 이상 · 12줄 이상) · (ΔV1) 이름이 다른 같은 역할 쌍은 `claude/composer`↔`opencode/composer` 목록 대조로 1쌍 확인 | 같은 이름 파일 27쌍 | 2 |

후보 39건 · 예상 절감 합 prod 1031줄 · test 465줄

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
| C-15 | `handleChatSend` 의 상태 전달 클로저와 중복 준비 호출 | main/app/chat-turn | L4 X3 X6 | restructure | S-04 S-05 S-06 S-07 | 0188·0190·0210·0211·0301 | 전송·중단·이어 보내기의 결과가 같다 | `send.ts` `handleChatSend`:52-789 한 함수 738줄 · `getActiveTurn`/`setActiveTurn`/`getInitialBatches`/`setInitialBatches` 4개 클로저로 상태 공유 · `prepareAgentExtensionProfile` 2회 · 하네스 `instructions` 설정 2회 읽기 | 0/0 — 미추정 — 구조 변경이라 줄 수보다 분기 수가 줄어든다 | 높음 — 정리 순서(`finally` 3단)가 취소·소유자 소멸 경로에 걸려 있다 |
| C-16 | 개발용 mock 어댑터 분기가 전송 경로에 있음 | main/app/chat-turn | L4 X5 | restructure | S-04 S-31 | 0003·0134·0204·0211 | 개발 빌드의 mock 재생(S-31)은 그대로다 | `send.ts:71,102` 가 매 전송마다 `ctx.mockAdapter && ctx.debugMock.enabled` 를 2회 판정 · `bootstrap.ts:890` 은 DEV 에서만 `MockAdapter` 생성 · `mock-scenarios.ts` 828줄은 정적 import | 4/0 — 어댑터 선택을 registry 한 곳으로 옮길 때의 추정 | 낮음 |
| C-17 | 컨텍스트 파일 권한 가드 중복 | main/app/handlers | L4 X4 X6 | restructure | S-17 | 미상(rg -o '0[0-9]{3}' app/src/main/app/handlers/files.ts) | 허용되지 않은 경로는 열리지 않는다 | `handlers/files.ts` `recordedContextDirectories` 와 `recordedAttachmentFiles` 가 같은 세션 조회 + `sessionContextPolicy(…).allowContextFileOpen` 가드를 각각 가진다 | 7/0 — 가드 1벌 줄 수 | 낮음 |
| C-18 | Claude·OpenCode `AssistantSegment` 중복 | renderer/features/chat/harnesses | L5 | restructure | S-04 S-05 | 미상(rg -o '0[0-9]{3}' …/transcript/AssistantSegment.tsx) | 두 하네스의 응답 본문이 지금과 같이 보인다 | 같은 이름 파일 27쌍의 줄 겹침 측정 — 35% 이상 겹치는 쌍은 `transcript/AssistantSegment.tsx` 1쌍(22줄, 71%) | 20/0 — 겹치는 줄 수 | 낮음 — 기존 진단이 "이름이 비슷하다고 합치지 않는다"를 경계로 뒀다 |
| C-19 | 응답 중 입력 대기의 renderer 쪽 거울 프로토콜 | renderer/features/chat/store | L4 X2 X3 | restructure | S-07 S-06 | 0067·0068·0151·0153 | 응답 중 보낸 입력이 대기 버블로 보이고, 취소하면 입력창으로 돌아오며, 전달되면 정식 버블이 된다 | `chatStore.ts`: 예약 여부를 renderer 가 `shouldQueueAsPending`(:1126)로 판정하고 main 도 판정한다(:1010 주석) · 이벤트 4종 `message.queued`:802 `committed`:835 `submitted`:861 `cancelled`:875 를 낙관 `pendingSteer`·`sendNowRequested`:1335·`draftRestore`:898 와 맞춘다 | 0/0 — 미추정 — C-14(main 대기열)와 한 프로토콜의 양 끝이라 함께 설계해야 한다 | 높음 — 낙관 표시를 빼면 대기 버블이 왕복 시간만큼 늦게 뜬다 |
| C-20 | store 옆 모듈 전역 가변 상태와 전 세션 순회 패치 | renderer/features/chat/store | L4 X3 | restructure | S-01 S-04 S-15 | 0228 | 새 대화가 마지막에 고른 종류·하네스·작업 폴더로 열린다 | `chatStore.ts` 모듈 전역 가변 8개 :180 :181 :182 :191 :192 :259 :343 :345 · 전 세션을 도는 패치 3벌 `applyHarnessAvailability`:195 `seedLandingBackend`:227 `seedLandingAgentKind`:282(술어가 서로 다르다) · draft 작업 폴더 플래그 5개(`cwdCache`·`cwdSelected`:128·`projectCwdInitialized`:129·`pendingProjectId`·`draftGeneration`) | 0/0 — 미추정 — 상태를 store 안 한 곳으로 모을 때 줄 수보다 분기 수가 준다 | 중간 — 부팅 시드 순서(설정 조회가 늦게 끝나는 경우)가 바뀔 수 있다 |
| C-21 | 세션 열기의 2단 조회와 이중 rAF | renderer/features/chat/store | L4 X2 X7 | restructure | S-11 | 미상(rg -n "0[0-9]{3}" app/src/renderer/src/features/chat/store/chatStore.ts \| sed -n "/168[0-9]\\|17[0-9][0-9]/p" → 0) | 세션을 열면 저장된 대화가 뜨고, 그 사이 도착한 응답이 덮어써지지 않는다 | `chatStore.ts` `loadSession`:1686 — `sessionApi.load`:1727 뒤 `requestAnimationFrame` 2중:1741 을 거쳐 `sessionApi.refresh`:1775 를 한 번 더 부른다 · 요청 유효성을 `sessionLoads` Map + `isCurrent` 5조건:1718 + `liveChanged`:1005 로 본다 | 0/0 — 미추정 — 2차 조회가 화면에 주는 차이(네이티브 기록 동기화)를 후속 plan 에서 실측해야 한다 | 중간 — 2차 조회가 외부에서 이어 쓴 대화를 반영하는 유일한 경로일 수 있다 |
| C-22 | 권한 모드 변경의 순번 2개와 8조건 유효성 검사 | renderer/features/chat/store | L4 X2 X3 | restructure | S-08 | 미상(rg -n "0[0-9]{3}" app/src/renderer/src/features/chat/store/chatStore.ts \| sed -n "/:3[4-7][0-9]:\\|:18[5-9][0-9]:/p" → 0) | 권한 모드를 바꾸면 바로 반영되고, 적용에 실패하면 이전 모드로 돌아가며 오류 표시가 뜬다 | `chatStore.ts` `permissionUpdates{request,settlement}`:343 · `dispatchTo` 가 액션 타입 문자열 6개로 순번을 올린다:347-372 · `synchronizePermissionMode`:1852 의 `current()` 8조건:1866 과 롤백 `fail()`:1879 | 0/0 — 미추정 — 순번을 세션 상태의 요청 id 하나로 줄일 수 있는지 후속 plan 에서 판정 | 중간 — 빠르게 연달아 바꿀 때의 마지막 값 우선이 깨질 수 있다 |
| C-23 | `chatActions` 의 한 줄 전달 래퍼 | renderer/features/chat/store | L4 X5 | restructure | S-04 S-10 S-18 | 미상(rg -n "0[0-9]{3}" app/src/renderer/src/features/chat/store/chatStore.ts \| sed -n "/:20[5-9][0-9]:\\|:21[0-9][0-9]:/p" → 2136·2139 는 0211 의 개별 액션 주석뿐) | 같은 버튼이 같은 동작을 한다 | `chatStore.ts` `chatActions`:2052-2210 — 항목 약 85개 중 `dispatchActive({type:…})` 만 하는 한 줄 전달이 약 45개 · `dropSession` 래퍼 2개 `invalidateSessionCache`:1802 `handleSessionDeleted`:1808 | 90/0 — 한 줄 전달 45개 × 평균 2줄. 호출부가 액션 객체를 직접 보내는 형태로 바꿀 때 | 낮음 — 호출부 수가 많아 변경 파일이 넓다 |
| C-24 | 세션 상태 한 객체에 95필드 · 활동 상태의 파생 중복 | renderer/features/chat/reducer | L4 X3 X6 | restructure | S-04 S-06 S-11 S-18 | 0143·0167·0211 | 응답 중·대기 중·유휴 표시와 중단 버튼이 지금과 같은 때에 바뀐다 | `chatReducer.ts` `ChatState`:270-489 약 95필드(대화 + git 리뷰 12 + 우측 패널 4 + 작업 id 배열 5) · `listening`:332 은 `activityTransport`:333 의 파생(:1256 :1572), `inflight` 도 적재 때 `activity.foreground` 에서 파생(:1571) · 활동 8필드를 3곳에서 필드별 복사 :1245 :1545 :1560 · 소비 술어 2개 `chatStore.ts`:2291 :2296 · `chatReducer`:848 한 함수 1,295줄 | 20/0 — `listening` 필드와 필드별 복사 2벌 제거분만 추정. 상태 분리는 줄 수가 아니라 한 함수의 크기를 줄인다 | 높음 — 모든 화면이 이 상태를 읽는다 |
| C-25 | 대기열 배치의 이중 식별자와 쓰이지 않는 전이 메서드 | main/features/chat | L4 X1 X3 | restructure | S-07 | 0151·0154·0166 | 대기 입력이 순서대로 전달되고 전달된 것만 대화에 남는다 | `pending-message-queue.ts`: `uuid` 와 `attemptId` 가 항상 같은 값(:57-58 :481-482), 폴백 `attemptId ?? uuid` 5곳(`send.ts`:648 :774 · `turn-request.ts`:90 :114 · :541) · 제품 호출 0인 메서드 `commit`:291 `isFrozen`:158(`rg "\.commit\(\|\.isFrozen\b" app/src/main -g "!*.test.*"` 에 큐 호출 0) · `toPublic`:71 필드별 재복사 | 30/0 — `commit` 12줄 + `isFrozen` 3줄 + 폴백·재복사 정리 추정 | 낮음 — 식별자 통합은 타입 변경이라 컴파일러가 누락을 잡는다 |
| C-26 | 턴 조정기의 선택적 의존성 호출 | main/features/chat | L4 X4 | restructure | S-04 S-05 | 미상(rg -n "0[0-9]{3}" app/src/main/features/chat/turn-coordinator.ts \| rg "\?\." → 0) | 같은 화면·같은 동작. 테스트는 production 조립과 같은 의존성으로 들어간다 | `turn-coordinator.ts` `?.(` 13곳(`rg -c "\?\.\(" …` → 13): `pendingMessages?`:95 `hasCanonical?.`:140 `getState?.`:141 `commitUserMessage?.`:186 `finalizeTurn?.`:292 `markAborted?.`:308 `confirmRuntimeToolSession?.`:476 — production 조립(`bootstrap.ts`:1128)은 전부 주입한다 | 5/0 — 분기 13개가 줄고 줄 수는 거의 같다 | 낮음 — C-13 과 같은 형태. 테스트 조립을 함께 고쳐야 한다 |
| C-27 | Claude 채널의 스트림 밖 신호 5종 개별 큐 | main/adapters/claude | L4 X2 X6 | restructure | S-04 S-07 S-10 | 0064·0211 | 압축 요약·턴 종료·예약·산출 캡처가 응답 안에서 지금과 같은 순서로 보인다 | `adapter.ts` `openChannel`:493 한 메서드 595줄 · 신호마다 큐와 drain 이 따로: `compactSummaries`:584/:802 `turnEndSignals`:589/:816 `scheduleSnapshots`:590/:823 `capturedOutputs`:591/:949 `receipts`:572/:937 · drain 조합이 3곳에서 다르다 — 정상 :936-965, 종료 :968-973, 오류 :976-980(요약이 빠진다) · 배치를 :1019 에서 한 번 더 감싸 전 이벤트를 map | 0/0 — 미추정 — 신호 큐를 하나로 합칠 때 줄 수보다 drain 조합 3벌이 1벌이 된다 | 높음 — 이벤트 순서가 대화 저장 순서를 정한다 |
| C-28 | OpenCode 채널 단일 클로저의 가변 상태 | main/adapters/opencode | L4 X3 X6 | restructure | S-05 | 미상(rg -o "\b0[0-9]{3}\b" app/src/main/adapters/opencode/v1/channel.ts → 0) | OpenCode 로 보낸 메시지가 전송되고, 중단하면 멈춘다 | `v1/channel.ts` `openCodeChannel`:22 한 함수 약 560줄 · 가변 `let` 19개 :34-81 · `AbortController` 3개 :32 :34 :35 · 종료 플래그 4개 :71-74 · 전송마다 agents·models 재조회로 검증 :179-192 · 전송 경로 2벌(command :230-271 / promptAsync :273-296)이 prelude·복구 문맥 조립을 각자 한다 | 0/0 — 미추정 — 전송 경로 2벌의 공통 조립을 합치면 약 20줄, 나머지는 구조 변경 | 중간 — 슬래시 명령 경로는 실기 확인이 필요하다 |
| C-29 | 런타임 모델 배선의 호출 1곳짜리 팩토리 | main/app/(root) | L4 X5 | restructure | S-01 S-02 S-23 | 0188·0202 | 자격증명이 바뀌면 모델 목록이 다시 맞춰진다 | `runtime-model-startup.ts`(142줄) export 팩토리 7개 전부 호출 1곳(`bootstrap.ts`:565 :570 :589 :675 :837 :841 :830) · 그중 3개는 한 줄 클로저 `createRuntimeModelSnapshotReader`:64 `…ReconcileVerified`:72 `…ReconcileSnapshot`:83 | 25/0 — 한 줄 클로저 3개와 그 타입 선언 줄 수 | 중간 — 0202 가 배선 정의를 한 벌로 유지하려고 뽑은 자리다. 합치더라도 정의는 한 곳에 남겨야 한다 |
| C-30 | 로그인 서비스의 선택적 콜백 | main/features/auth | L4 X4 | restructure | S-02 | 미상(rg -n "0[0-9]{3}" app/src/main/features/auth/login.ts \| rg "onStep\|onSnapshot" → 0) | 로그인 단계와 연결 상태가 화면에 바로 반영된다 | `login.ts` `deps.onSnapshot?.(` 6곳 · `deps.onStep?.(` 3곳(`rg -o "this\.deps\.[a-zA-Z]+\?\.\(" …`) — production(`runtime.ts`:209-210)은 둘 다 항상 주입한다 | 0/0 — 분기 9개가 줄고 줄 수는 같다 | 낮음 |
| C-31 | main 내부 신호가 renderer 이벤트 타입에 섞여 있다 | shared/(root) | L4 X2 | restructure | S-04 S-10 | 0231·0239 | renderer 가 받는 이벤트와 화면 반응은 그대로다 | `shared/ipc.ts` `NormalizedEvent` 25변형 중 `session.schedules`:579 는 `turn-coordinator.ts`:353 이 버려 renderer 에 오지 않는데 no-op case 가 2곳(`chatStore.ts`:857 · `chatReducer.ts`:944) · `input.echo`:569 `input.received`:571 `tool.call.retracted`:683 은 renderer 참조 0 | 0/0 — 타입을 둘로 가르는 변경이라 이 버킷 줄 수는 같다. renderer no-op case 는 다른 버킷 | 낮음 — 타입 변경이라 컴파일러가 누락을 잡는다 |
| C-32 | 생산자 없는 이벤트 변형 `subagent.backgroundSet` | shared/(root) | L1 | remove | 없음 | 0212·0231 | 없음 — 이 이벤트를 내는 코드가 없다 | `rg -n "subagent\.backgroundSet" app/src -g "!*.test.*"` → 2: 타입 `shared/ipc.ts`:739 와 renderer no-op `chatStore.ts`:982 뿐 · 0231 plan:341 이 "생산·coordinator 소비를 제거한다"로 적었다 | 6/0 — 타입 선언 줄 수. renderer case 는 다른 버킷 | 낮음 |
| C-33 | `window.orca` 전달 래퍼 계층 | renderer/shared | L4 X5 | restructure | S-01 S-04 | 미상(rg -n "PR #29\|api/ipc" docs/arch/frontend/state.md → :121 "PR #29 에서 도입"(handoff 번호 없음)) | 모든 화면의 main 호출이 그대로 동작한다 | `renderer/src/shared/api/ipc.ts` 380줄 — `window.orca.` 를 그대로 부르는 호출 줄 113개(`grep -c "window\.orca\." …` → 116, 주석 1줄 :110 · `typeof` 타입 참조 2줄 :233 :236 제외) · 채널 하나가 스키마 → `preload/index.ts` 메서드 → 이 래퍼 → (chat 은) `chatActions` 를 거친다 | 0/0 — 미추정 — 래퍼를 없애면 최대 380줄이지만 테스트 37파일이 이 모듈을 mock 한다 | 높음 — `docs/arch/frontend/state.md`:120-121 · `ux-domains.md`:125 의 채택 규칙(직접 호출 금지)을 바꾼다 |
| C-34 | 백그라운드 작업 상태의 이중 모델 | renderer/features/chat/lib | L4 X3 X6 | restructure | S-10 S-11 | 0136·0143·0231 | 실행 중·끝난 백그라운드 작업이 목록에 보이고 멈출 수 있다. 0231 이전에 기록된 세션의 작업 표시는 승인 여부에 달렸다 | 정본 모델(main `BackgroundSessionState`)과 구 모델(메시지 파트 파생 `parts.ts` `subagentTasksFromMessages`:304 + `ChatState` id 배열 5개)이 함께 산다 · 전환 스위치 `hasCanonical`: main `settle.ts`:176 `background-controller.ts`:81 `chat-turn/index.ts`:78 :93 `turn-coordinator.ts`:140 · renderer `SubAgentTileContent.tsx`:97 :181(구 모델 계산 :87 :171 이 스위치보다 먼저 돈다) | 0/0 — 미추정 — 구 모델 표시 경로(`SubAgentTileContent.tsx` 385줄의 목록·상세)와 id 배열 5개가 대상. 유지 범위는 승인 뒤 정한다 | 높음 — 0231 plan:360 :404 가 구 모델 표시를 "과거 표시 fallback"으로 남기기로 했다 |
| C-35 | 질문 응답 UI 의 상태 로직 2벌 | renderer/features/chat/harnesses | L5 | restructure | S-08 | 미상(rg -o "\b0[0-9]{3}\b" app/src/renderer/src/features/chat/harnesses/opencode/composer/QuestionDock.tsx → 0) | 두 하네스에서 질문에 고르기·직접 입력·건너뛰기가 된다 | `claude/composer/QuestionCard.tsx`(325줄) ↔ `opencode/composer/QuestionDock.tsx`(265줄) — 같은 props(`ask`·`onSubmit`·`onSkip`)와 같은 `picks` 상태. 이름이 달라 같은 이름 쌍 비교에 잡히지 않았다. 공통 줄 13 | 0/0 — 미추정 — 선택 상태를 공용 훅으로 뽑을 때. 겉모습은 하네스별로 남는다 | 낮음 |
| C-36 | OpenCode 컴포저 목록 조회의 소유·세대 프로토콜 | renderer/features/chat/harnesses | L4 X2 X3 | restructure | S-05 | 0268·0276·0280·0281·0289 | OpenCode 컴포저의 모델·에이전트·MCP·플러그인 목록이 뜨고, 실패하면 다시 시도할 수 있으며, 새 대화가 세션으로 확정돼도 목록이 깜빡이지 않는다 | `composerCatalogState.ts` 275줄 — 낡은 응답을 거르는 축이 6개다: `owner`·`previousOwner`·`generation`·`retired`·`epoch`·`disposed`(:26-38, 판정 `stale()` :109 · `retired.has` :84 :169) · 진행 중 요청 `flights` · 지연 해제 타이머 `disposal` · 재키잉 `promote`(:100, 모듈 전역 `states` Map :219-260) · main 쪽 `composer-catalog-owner.ts` 206줄 · `handlers/composer-catalog.ts` 71줄 · 관련 테스트 4,850줄 | 0/0 — 미추정 — 무효화 축을 몇 개로 줄일 수 있는지는 main owner 의 세대 발급 규칙과 함께 후속 plan 에서 실측 | 높음 — 0281 메뉴 캐시·0289 런타임 보존이 이 축들로 낡은 목록 표시를 막는다 |
| C-37 | 메일 동기화의 쓰이지 않는 단계 콜백과 이중 합류 | main/features/plugins | L4 X1 X4 | restructure | S-04 | 0237·0303 | 메일 도구가 동기화를 한 번만 돌리고(겹친 호출은 합류) 취소·오류 결과가 지금과 같다 | `onStage`: 유일한 production 호출부 `mail/tools.ts:66` 이 `undefined` 를 넘긴다(`rg -n "onStage\|MailSyncStageEvent" app/src/main -g '!*.test.*'` → `sync-manager.ts` 10건 · `types.ts:157` 뿐, 테스트 참조 0) · 합류: `tools.ts:53-78` 이 진행 중 동기화에 합류시키는데 `sync-manager.ts:77,85-89` 도 같은 합류를 한다 — `tools.ts:40-51` 이 호출마다 manager 를 새로 만들어 manager 쪽 합류는 겹친 호출을 볼 수 없다 | 25/0 — `onStage` 호출 9줄 + 타입·시그니처 + manager 쪽 `inFlight` 분기 | 낮음 |
| C-38 | diff 리뷰의 항상 주입되는 optional props 와 3단 전달 | renderer/features/chat/harnesses | L4 X1 X5 | restructure | S-18 | 0211 | 변경사항 패널에서 줄에 요구사항을 달고·고르고·지울 수 있다 | 호출 사슬이 `DiffTileContent.tsx:96-117` → `DiffReview.tsx:158-174` → `FileDiffSection.tsx` 하나뿐이고 6개 props(`activeRequirementId`·`selectionVersion`·`onSelectRequirement`·`onDraftChange`·`onAddRequirement`·`onRemoveRequirement`)를 늘 넘긴다 · 그런데 두 컴포넌트가 전부 optional 로 선언(`DiffReview.tsx:28-30,43-49` · `FileDiffSection.tsx:52-66`)해 `?.(` 호출이 6곳(`:625,826,830,841,884,901`) · 같은 props 가 `FileDiffBody`·`InlineBody`·`SideBySideBody`·행 컴포넌트까지 내려간다(이 파일 안 언급 56회) | 15/0 — optional 선언·`?.` 분기와 중복 props 타입 선언 추정 | 낮음 |
| C-39 | 컴포저의 플러그인 멘션 목록 이중 계산 | renderer/features/chat/harnesses | L4 X6 | restructure | S-16 | 미상(rg -o '0[0-9]{3}' app/src/renderer/src/features/chat/harnesses/common/composer/ComposerInputController.tsx) | @ 멘션 자동완성에 플러그인이 뜨고 알려진 플러그인만 칩으로 인정된다 | `ComposerInputController.tsx:223-229` `observedPlugins` 와 `:238-248` `validPluginIds` 가 `nativePluginMentions(native.view)`·`nativePluginMentions(native.view, 'orca')` 를 각각 다시 계산한다 | 6/0 — 두 번째 계산을 첫 결과에서 파생 | 낮음 |
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
| C-32 | 생산자 없는 이벤트 변형 `subagent.backgroundSet` | 제거 | 없음 — 이 이벤트를 내는 코드가 없다 | 6/0 |
| C-33 | `window.orca` 전달 래퍼 계층 | 채택 결정 변경 | 모든 화면의 main 호출이 그대로 동작한다 | 0/0 |
| C-34 | 백그라운드 작업 상태의 이중 모델 | 채택 결정 변경 | 실행 중·끝난 백그라운드 작업이 목록에 보이고 멈출 수 있다. 0231 이전에 기록된 세션의 작업 표시는 승인 여부에 달렸다 | 0/0 |
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

## 7. 분량 상위 버킷 심화 검토

prod 3,000줄 이상 버킷과 `renderer/features/chat/reducer` 의 내부를 읽은 결과다. `읽은 파일 줄 수`는 `읽은 파일` 의 전체 줄 수 합이라 상한이고, 실제로 읽은 구간은 근거 칸에 있다. 그 밖의 파일은 판정하지 않았다(plan 선언 경계 7). `밀도` 는 한 단위에 몰린 구현이 그 조작에 필요한 것보다 큰지에 대한 감사자 판단이다(선언 경계 9).

<!-- gen:deep -->
| 버킷 | X1 | X2 | X3 | X4 | X5 | X6 | X7 | 밀도 | 읽은 파일 줄 수(상한) / prod 줄 | 판정 근거 | 읽은 파일 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| renderer/features/chat/harnesses | C-38 | C-36 | C-34 C-36 | — | C-38 | C-34 C-39 | — | 필요 | 2091 / 17599 (12%) | 파일 211개·평균 83줄로 잘게 나뉜 하네스별 화면이다. r1.3 에서 가장 큰 두 파일과 상태 모듈 하나를 더 읽었다: `FileDiffSection.tsx` 1-510 전부·511-915 개요(diff 보기 기능 — 과잉은 props 선언뿐, C-38) · `ComposerInputController.tsx` 1-355(IME 조합 보호 때문에 초안 스냅샷이 필요, C-39) · `composerCatalogState.ts` 전부(프로토콜 과잉, C-36). 버킷 전체로는 한곳에 몰린 구현이 아니어서 필요로 둔다 — 나머지 약 200파일은 읽지 않았다 | SubAgentTileContent.tsx · FileDiffSection.tsx · ComposerInputController.tsx · composerCatalogState.ts |
| main/adapters/claude | — | C-27 | — | — | — | C-27 | — | 과도 | 2159 / 6588 (33%) | `openChannel` 한 메서드가 595줄이고 지역 변수 약 25개를 옵션 조립·이벤트 생성기·채널 객체가 함께 쓴다. 읽은 구간: 개요 + 572-612 · 783-1088. `map.ts`(1,019줄)는 읽지 않았다 · r1.3: `map.ts` 개요 + 373-470 + 470-900 제어 흐름 — `mapClaudeMessage` 한 함수 508줄이 SDK 메시지 5종(system·stream_event·assistant·user·result)을 변환하고 가변 `MapContext` 가 24필드다. 외부 프로토콜 변환이라 과잉 후보는 올리지 않았다 | adapter.ts · map.ts |
| main/adapters/opencode | — | — | C-28 | — | — | C-28 | — | 과도 | 584 / 5644 (10%) | `openCodeChannel` 한 클로저가 약 560줄이고 가변 `let` 19개를 연결·전송·펌프가 함께 쓴다. 읽은 구간: 1-374. `session-context.ts`·`server.ts` 는 읽지 않았다 | channel.ts |
| renderer/shared | — | — | — | — | C-33 | — | — | 필요 | 380 / 5513 (7%) | UI 부품 83파일이 대부분이고 가장 큰 파일이 380줄이다. 읽은 구간: `api/ipc.ts` 1-60 · 150-200. UI 부품(`ui/`·`theme/`)은 읽지 않았다 | ipc.ts |
| shared/(root) | — | C-31 | — | — | — | — | — | 필요 | 1974 / 5395 (37%) | 계약 스키마와 타입 선언이다(`ipc.ts` 1,974줄 · `protocol.ts` 1,069줄). 읽은 구간: `ipc.ts` 440-760 의 이벤트 변형 목록. 필드 단위 미사용은 r1 의 스키마 필드 스캔이 봤다 | ipc.ts |
| renderer/features/chat/lib | — | — | C-34 | — | — | C-34 | — | 필요 | 694 / 5240 (13%) | 작은 순수 파생 함수 묶음이다(파일 55개, 최대 694줄) — 기존 진단이 유지 경계로 둔 형태. 읽은 구간: `parts.ts` 개요 + 304-400, `canonicalBackground.ts`·`taskBoard.ts` 는 함수 목록만 | parts.ts |
| main/features/plugins | C-37 | — | — | C-37 | — | — | — | 필요 | 1166 / 4710 (25%) | 외부 서비스(Confluence·Jira·메일) 연동 3벌이고 서로 겹치는 줄이 거의 없다 — 같은 역할 파일 7쌍의 겹침이 최대 7%(r1.3 측정). `mail/sync-manager.ts` 1-230 은 POP3 동기화의 신선도·대량 유실 보호·보존 기간을 순서대로 적용하는 도메인 규칙이고 과잉은 죽은 콜백과 이중 합류뿐이다(C-37). `confluence/connector.ts` 는 r1.2 의 개요 수준 그대로다. Jira 쪽은 `rest.ts` 개요만 봤다 | connector.ts · sync-manager.ts · tools.ts |
| main/features/auth | — | — | — | C-30 | — | — | — | 필요 | 990 / 4111 (24%) | 인증 방식 3갈래가 공통 정착(`settleGrant`:610 — 확인 → 금고 쓰기 → 저장 순서)을 쓰고 메서드가 최대 110줄이다. 읽은 구간: 개요 + 140-262 · 461-500 · 610-676 | login.ts |
| main/app/(root) | — | — | — | — | C-29 | — | — | 필요 | 1507 / 4061 (37%) | `bootstrap.ts` 는 조립 루트다(기존 진단의 유지 경계). `start()` 475줄은 부팅 15단계의 나열이다. 읽은 구간: `runtime-model-startup.ts` 전부, `bootstrap.ts` 446-921 을 30자 미만 줄을 빼고 훑음 | runtime-model-startup.ts · bootstrap.ts |
| main/features/chat | C-25 | C-14 | C-14 C-25 | C-26 | — | — | — | 과도 | 1261 / 3563 (35%) | 대기열이 public 메서드 28개·상태 4개·확정 신호 2종이고, `TurnCoordinator.run` 한 메서드의 이벤트 루프가 250줄에 종류별 분기 20여 개다. 읽은 구간: 대기열 전부, 조정기 1-574 | pending-message-queue.ts · turn-coordinator.ts |
| main/app/chat-turn | — | — | C-15 | C-12 C-13 | C-16 | C-12 C-15 | — | 과도 | 296 / 3348 (9%) | `handleChatSend` 한 함수가 약 740줄·12단계이고 턴-후 루프 하나가 재개·정착·listen·flush 를 함께 든다. 읽은 구간: `post-turn.ts` 전부, `send.ts` 는 단계 개요만(r1 이 본문을 읽었다) | post-turn.ts |
| renderer/features/chat/store | — | C-19 C-21 C-22 | C-19 C-20 C-22 | — | C-23 | — | C-21 | 과도 | 2482 / 3261 (76%) | `chatStore.ts` 한 파일 2,482줄에 이벤트 라우팅·전송·세션 적재·권한 동기화·초안 관리가 함께 있고 store 밖 모듈 전역 상태가 8개다. 파일 전부 읽음 | chatStore.ts |
| renderer/features/chat/reducer | — | — | C-24 | — | — | C-24 | — | 과도 | 2218 / 2218 (100%) | `chatReducer` 한 함수 1,295줄이 액션 60종을 처리하고 상태 객체가 약 95필드다. 읽은 구간: 상태·액션 정의 270-770, `LOAD_SESSION` 1444-1605, case 목록 | chatReducer.ts |
<!-- /gen:deep -->

## 8. 분해안

`restructure` 후보를 어떤 순서로 떼어낼지다. 단계는 앞에서부터 하나씩 따로 병합할 수 있는 순서로 적었고, 제안이다 — 실제 보존 여부는 후속 handoff 가 검증한다(plan 선언 경계 10).

<!-- gen:decomposition -->
| 후보 | 단계 | 떼어내는 것 | 그 뒤에도 같아야 하는 동작 | 파일 | 회귀 시나리오 |
|---|---|---|---|---|---|
| C-12 전송 1회에 같은 세션 행을 6번 조회·3중 검증 | 1 | 세션 행 조회를 진입에서 1회로 — 결과를 이후 단계에 넘긴다 | 없는 원본·다른 하네스로 보내면 지금과 같은 오류 문구가 뜬다 | `main/app/chat-turn/send.ts` · `main/app/chat-turn/resolve-turn.ts` | S-04 S-11 |
| C-12 | 2 | 원본 존재·하네스 불일치 검증을 한 판정 함수로 합친다 | 오류 문구가 분기마다 지금과 같다 | `main/app/chat-turn/resolve-turn.ts` · `main/app/chat-turn/admission.ts` | S-04 S-05 |
| C-13 production 이 항상 주입하는 의존성의 optional 선언과 fallback 분기 | 1 | 테스트 조립을 production 과 같은 의존성으로 맞춘다 | 기존 테스트가 같은 동작을 단언한다 | `main/app/chat-turn/deps.ts` | S-04 |
| C-13 | 2 | `?.`·fallback 분기를 필수 호출로 바꾼다 | 전송·세션 열기가 지금과 같다 | `main/app/chat-turn/send.ts` · `main/app/chat-turn/resolve-turn.ts` | S-01 S-04 |
| C-14 응답 중 입력 대기 프로토콜의 표면 | 1 | 제품 호출 0인 메서드와 이중 식별자를 먼저 걷는다(C-25) | 대기 입력이 순서대로 전달된다 | `main/features/chat/pending-message-queue.ts` | S-07 |
| C-14 | 2 | 시나리오가 요구하는 전이(대기·취소·즉시 보내기·전달·되돌림)와 메서드를 표로 대응시키고 대응 없는 메서드를 합친다 | 취소한 입력이 입력창으로 돌아오고 전달된 입력만 대화에 남는다 | `main/features/chat/pending-message-queue.ts` · `main/app/chat-turn/post-turn.ts` | S-06 S-07 |
| C-14 | 3 | renderer 의 예약 판정을 main 판정 하나로 모은다(C-19) | 대기 버블이 지금과 같은 때에 뜬다 | `renderer/src/features/chat/store/chatStore.ts` · `main/app/chat-turn/admission.ts` | S-07 |
| C-15 `handleChatSend` 의 상태 전달 클로저와 중복 준비 호출 | 1 | 번호 붙은 12단계 중 아직 인라인인 단계를 단계 함수로 옮긴다(동작 보존) — 1 진입 게이트, 6·7 턴·런타임 확보, 10·11 구동체·요청 조립 | 전송 결과가 같다 | `main/app/chat-turn/send.ts` | S-04 S-05 |
| C-15 | 2 | try 바깥 공유 `let` 8개를 단계 결과 객체로 바꾼다 | 중단·오류 때 정리가 지금과 같다 | `main/app/chat-turn/send.ts` | S-06 S-09 |
| C-15 | 3 | 턴-후 루프를 중단 재개 · 채널 사망 정착 · 다음 스텝(listen/flush)으로 가른다 | 이어 보내기와 백그라운드 대기가 지금과 같다 | `main/app/chat-turn/post-turn.ts` | S-07 S-10 |
| C-16 개발용 mock 어댑터 분기가 전송 경로에 있음 | 1 | 어댑터 선택을 registry 한 곳으로 옮긴다 | 개발 빌드의 mock 재생이 그대로다 | `main/app/chat-turn/send.ts` | S-31 |
| C-17 컨텍스트 파일 권한 가드 중복 | 1 | 경로 가드 2벌을 하나로 합친다 | 허용되지 않은 경로는 열리지 않는다 | `main/app/handlers/files.ts` | S-17 |
| C-18 Claude·OpenCode `AssistantSegment` 중복 | 1 | 겹치는 22줄을 공용 조각으로 뽑는다 | 두 하네스의 응답 본문이 지금과 같이 보인다 | `renderer/src/features/chat/harnesses/claude/transcript/AssistantSegment.tsx` · `renderer/src/features/chat/harnesses/opencode/transcript/AssistantSegment.tsx` | S-04 S-05 |
| C-19 응답 중 입력 대기의 renderer 쪽 거울 프로토콜 | 1 | main 대기열의 전이 표(C-14 2단계)를 먼저 확정한다 | 대기·취소·즉시 보내기가 지금과 같다 | `main/features/chat/pending-message-queue.ts` | S-07 |
| C-19 | 2 | 예약 여부를 main 응답으로만 정하고 renderer 판정을 지운다 | 응답 중 보낸 입력이 대기 버블로 뜬다 | `renderer/src/features/chat/store/chatStore.ts` | S-07 |
| C-19 | 3 | 이벤트 4종의 처리와 낙관 항목을 한 reducer 조각으로 모은다 | 취소하면 입력창으로 돌아온다 | `renderer/src/features/chat/store/chatStore.ts` · `renderer/src/features/chat/reducer/chatReducer.ts` | S-06 S-07 |
| C-20 store 옆 모듈 전역 가변 상태와 전 세션 순회 패치 | 1 | 모듈 전역 값을 store 의 한 조각(landing)으로 옮긴다 | 새 대화가 마지막 선택으로 열린다 | `renderer/src/features/chat/store/chatStore.ts` | S-01 S-04 |
| C-20 | 2 | 전 세션 순회 패치 3벌을 "보내지 않은 초안" 술어 하나로 합친다 | 하네스가 없어지면 초안이 Claude 로 바뀐다 | `renderer/src/features/chat/store/chatStore.ts` | S-01 S-03 |
| C-20 | 3 | draft 작업 폴더 플래그 5개를 출처 하나(기본·프로젝트·사용자 선택)로 바꾼다 | 고른 폴더가 유지된다 | `renderer/src/features/chat/store/chatStore.ts` | S-15 |
| C-21 세션 열기의 2단 조회와 이중 rAF | 1 | 2차 조회가 바꾸는 화면을 실측한다(없으면 제거, 있으면 1차 응답에 합친다) | 세션을 열면 저장된 대화가 뜬다 | `renderer/src/features/chat/store/chatStore.ts` · `main/app/handlers/session.ts` | S-11 |
| C-21 | 2 | 요청 유효성 검사를 요청 id 하나로 줄인다 | 여는 중 도착한 응답이 덮어써지지 않는다 | `renderer/src/features/chat/store/chatStore.ts` | S-11 |
| C-22 권한 모드 변경의 순번 2개와 8조건 유효성 검사 | 1 | 순번 2개를 세션 상태의 요청 id 하나로 바꾼다 | 연달아 바꾸면 마지막 값이 남는다 | `renderer/src/features/chat/store/chatStore.ts` | S-08 |
| C-22 | 2 | 액션 타입 문자열 목록을 reducer 안의 전이로 옮긴다 | 적용 실패 때 이전 모드로 돌아간다 | `renderer/src/features/chat/store/chatStore.ts` · `renderer/src/features/chat/reducer/chatReducer.ts` | S-08 |
| C-23 `chatActions` 의 한 줄 전달 래퍼 | 1 | 상태 조각 하나(git 리뷰)부터 호출부가 액션을 직접 보내게 바꾼다 | 변경사항 화면의 버튼이 같은 동작을 한다 | `renderer/src/features/chat/store/chatStore.ts` | S-18 |
| C-23 | 2 | 나머지 한 줄 전달을 같은 방식으로 걷는다 | 같은 버튼이 같은 동작을 한다 | `renderer/src/features/chat/store/chatStore.ts` | S-04 S-10 |
| C-24 세션 상태 한 객체에 95필드 · 활동 상태의 파생 중복 | 1 | `listening` 을 `activityTransport` 파생 selector 로 바꾸고 필드를 지운다 | 중단 버튼과 대기 표시가 같은 때에 바뀐다 | `renderer/src/features/chat/reducer/chatReducer.ts` · `renderer/src/features/chat/store/chatStore.ts` | S-06 S-07 |
| C-24 | 2 | 활동 8필드를 `activity` 객체 하나로 묶어 필드별 복사 3벌을 없앤다 | 세션을 다시 열어도 진행 표시가 맞다 | `renderer/src/features/chat/reducer/chatReducer.ts` | S-11 |
| C-24 | 3 | git 리뷰 상태(12필드·액션 15종)를 자기 reducer 로 뗀다 | 변경사항 화면이 지금과 같다 | `renderer/src/features/chat/reducer/chatReducer.ts` | S-18 |
| C-24 | 4 | 우측 패널·작업 선택 상태를 같은 방식으로 뗀다 | 타일 열기·닫기가 지금과 같다 | `renderer/src/features/chat/reducer/chatReducer.ts` | S-10 |
| C-25 대기열 배치의 이중 식별자와 쓰이지 않는 전이 메서드 | 1 | `commit`·`isFrozen` 을 지운다 | 대기 입력 전달이 그대로다 | `main/features/chat/pending-message-queue.ts` | S-07 |
| C-25 | 2 | `uuid` 를 `attemptId` 하나로 합치고 폴백 5곳을 지운다 | 전달된 입력만 대화에 남는다 | `main/features/chat/pending-message-queue.ts` · `main/app/chat-turn/send.ts` · `main/app/chat-turn/turn-request.ts` | S-07 |
| C-26 턴 조정기의 선택적 의존성 호출 | 1 | 테스트 조립이 빠뜨리는 의존성을 채운다 | 기존 테스트가 같은 동작을 단언한다 | `main/features/chat/turn-coordinator.ts` | S-04 |
| C-26 | 2 | 선택 표시(`?`)와 `?.` 호출을 필수로 바꾼다 | 전송·중단이 지금과 같다 | `main/features/chat/turn-coordinator.ts` · `main/features/chat/turn-sinks.ts` | S-04 S-05 S-06 |
| C-27 Claude 채널의 스트림 밖 신호 5종 개별 큐 | 1 | 이벤트 생성기 `eventBatches` 를 파일로 뗀다(동작 보존) | 응답이 지금과 같은 순서로 보인다 | `main/adapters/claude/adapter.ts` | S-04 |
| C-27 | 2 | 신호 5종의 큐를 순서 있는 큐 하나와 drain 하나로 합친다 | 압축 요약·턴 종료·예약 표시 순서가 같다 | `main/adapters/claude/adapter.ts` · `main/adapters/claude/input-receipts.ts` | S-04 S-07 S-10 |
| C-27 | 3 | SDK 옵션 조립을 순수 함수로 뗀다 | 권한·작업 폴더 제한이 지금과 같다 | `main/adapters/claude/adapter.ts` | S-04 S-08 |
| C-28 OpenCode 채널 단일 클로저의 가변 상태 | 1 | 전송 경로 2벌의 prelude·복구 문맥 조립을 한 함수로 합친다 | 슬래시 명령과 일반 전송이 모두 된다 | `main/adapters/opencode/v1/channel.ts` | S-05 |
| C-28 | 2 | 종료 플래그 4개를 상태 값 하나로 바꾼다 | 중단하면 멈춘다 | `main/adapters/opencode/v1/channel.ts` | S-05 S-06 |
| C-28 | 3 | 연결·전송·이벤트 펌프를 함수 셋으로 가른다 | OpenCode 응답이 지금과 같이 보인다 | `main/adapters/opencode/v1/channel.ts` | S-05 |
| C-29 런타임 모델 배선의 호출 1곳짜리 팩토리 | 1 | 한 줄 클로저 3개를 호출 자리의 식으로 되돌리되 정의는 이 파일 한 곳에 둔다 | 자격증명이 바뀌면 모델 목록이 다시 맞춰진다 | `main/app/runtime-model-startup.ts` · `main/app/bootstrap.ts` | S-02 S-23 |
| C-30 로그인 서비스의 선택적 콜백 | 1 | `onStep`·`onSnapshot` 을 필수 의존성으로 바꾼다 | 로그인 단계가 화면에 바로 뜬다 | `main/features/auth/login.ts` · `main/features/auth/runtime.ts` | S-02 |
| C-31 main 내부 신호가 renderer 이벤트 타입에 섞여 있다 | 1 | 이벤트 타입을 main 내부용과 renderer 전달용으로 가른다 | renderer 가 받는 이벤트가 그대로다 | `shared/ipc.ts` | S-04 |
| C-31 | 2 | renderer 의 no-op case 3개를 지운다 | 화면 반응이 그대로다 | `renderer/src/features/chat/store/chatStore.ts` · `renderer/src/features/chat/reducer/chatReducer.ts` | S-04 S-10 |
| C-33 `window.orca` 전달 래퍼 계층 | 1 | 채택 규칙 변경을 먼저 결정한다(승인 대상) | 결정 전에는 바꾸지 않는다 | `renderer/src/shared/api/ipc.ts` | S-01 |
| C-33 | 2 | 타입만 다시 적는 래퍼를 `window.orca` 재수출로 바꾸고 테스트 mock 지점을 유지한다 | 모든 화면의 main 호출이 그대로다 | `renderer/src/shared/api/ipc.ts` | S-01 S-04 |
| C-34 백그라운드 작업 상태의 이중 모델 | 1 | 구 모델 표시를 남길 범위를 결정한다(승인 대상) | 결정 전에는 바꾸지 않는다 | `renderer/src/features/chat/harnesses/claude/rightpanel/SubAgentTileContent.tsx` | S-10 |
| C-34 | 2 | 구 모델 계산을 스위치 뒤로 옮긴다(정본이 있으면 계산하지 않는다) | 백그라운드 목록이 지금과 같다 | `renderer/src/features/chat/harnesses/claude/rightpanel/SubAgentTileContent.tsx` | S-10 |
| C-34 | 3 | main 의 `hasCanonical` 스위치 5곳을 정본 한 경로로 합친다 | 작업을 멈추면 멈춘 것으로 표시된다 | `main/features/chat/settle.ts` · `main/features/chat/background-controller.ts` · `main/app/chat-turn/index.ts` | S-10 |
| C-34 | 4 | 구 모델 전용 id 배열과 파생 함수를 걷는다 | 지난 세션을 열어도 작업 표시가 승인한 범위대로 보인다 | `renderer/src/features/chat/reducer/chatReducer.ts` · `renderer/src/features/chat/lib/parts.ts` | S-10 S-11 |
| C-35 질문 응답 UI 의 상태 로직 2벌 | 1 | 선택 상태(`picks`·제출 가능 판정)를 공용 훅으로 뽑는다 | 두 하네스에서 고르기·직접 입력·건너뛰기가 된다 | `renderer/src/features/chat/harnesses/claude/composer/QuestionCard.tsx` · `renderer/src/features/chat/harnesses/opencode/composer/QuestionDock.tsx` | S-08 |
| C-36 OpenCode 컴포저 목록 조회의 소유·세대 프로토콜 | 1 | 낡은 응답 판정을 한 함수로 모은다 — `stale()`·`retired.has()` 두 갈래를 하나로 | 목록·오류·재시도 표시가 지금과 같다 | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts` | S-05 |
| C-36 | 2 | `generation`·`retired`·`epoch` 중 겹치는 축을 걷는다(같은 사건에서 함께 바뀌는 것 — :73-76 · :85-88) | 에이전트 개정·무효화 뒤 새 목록으로 바뀐다 | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts` · `main/app/composer-catalog-owner.ts` | S-05 |
| C-36 | 3 | 세션 확정 시 재키잉(`promote`·`previousOwner`)을 재조회 한 번으로 바꿀 수 있는지 판정하고, 가능하면 걷는다 | 새 대화의 첫 전송 뒤에도 모델 목록이 비지 않는다 | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts` · `main/app/handlers/composer-catalog.ts` | S-05 |
| C-37 메일 동기화의 쓰이지 않는 단계 콜백과 이중 합류 | 1 | `onStage` 인자와 `MailSyncStageEvent` 를 지운다 | 동기화 결과가 같다 | `main/features/plugins/mail/sync-manager.ts` · `main/features/plugins/mail/types.ts` · `main/features/plugins/mail/tools.ts` | S-04 |
| C-37 | 2 | manager 쪽 `inFlight` 합류를 지우고 합류를 `tools.ts` 한 곳에 둔다 | 겹친 동기화 요청이 한 번만 실행된다 | `main/features/plugins/mail/sync-manager.ts` | S-04 |
| C-38 diff 리뷰의 항상 주입되는 optional props 와 3단 전달 | 1 | 6개 props 를 필수로 바꾸고 `?.(` 를 걷는다 | 요구사항 추가·선택·삭제가 지금과 같다 | `renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` · `renderer/src/features/chat/harnesses/common/rightpanel/DiffReview.tsx` | S-18 |
| C-38 | 2 | 요구사항 관련 props 를 한 객체(또는 context)로 묶어 중간 컴포넌트의 전달 선언을 줄인다 | 나란히 보기·한 줄 보기 양쪽에서 요구사항 표시가 같다 | `renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` · `renderer/src/features/chat/harnesses/common/rightpanel/DiffTileContent.tsx` | S-18 |
| C-39 컴포저의 플러그인 멘션 목록 이중 계산 | 1 | `validPluginIds` 를 `observedPlugins` 에서 파생한다 | 멘션 자동완성·칩 판정이 같다 | `renderer/src/features/chat/harnesses/common/composer/ComposerInputController.tsx` | S-16 |
<!-- /gen:decomposition -->

## 9. 후속 handoff 분할안

<!-- gen:split -->
| 순위 | 후속 handoff | 후보 | 예상 절감 prod/test | 회귀 판정 시나리오 | 비고 |
|---|---|---|---|---|---|
| 1 | H-A 미도달 코드 제거(승인분) | C-01 C-02 C-03 C-04 C-05 C-06 C-08 C-09 C-32 | 360/0 | S-10 S-19 S-02 S-04 S-25 | 승인된 항목만. 근거가 기계적이라 위험이 가장 낮다 |
| 2 | H-B 전송 경로의 중복 조회·검증·선택적 의존성 정리 | C-12 C-13 C-16 C-17 C-26 C-30 | 71/0 | S-01 S-02 S-04 S-05 S-06 S-11 S-12 S-17 S-31 | — |
| 3 | H-C 0225 이관 코드 제거 | C-10 C-11 | 369/465 | S-01 S-11 | 0292 결정 변경 — 승인 필요. 절감이 가장 크다 |
| 4 | H-D 응답 중 입력 대기 프로토콜과 `handleChatSend` 구조 축소 | C-14 C-15 C-19 C-25 | 30/0 | S-04 S-05 S-06 S-07 S-09 S-10 | 설계 검토가 먼저다 — 절감 미추정. C-25 가 첫 단계(위험 낮음) |
| 5 | H-E 테스트 전용 export 분류·정리 | C-07 | 0/0 | S-02 S-04 | — |
| 6 | H-F renderer 대화 상태 분해(상태 객체·store) | C-24 C-20 C-22 C-21 C-23 C-31 | 110/0 | S-01 S-04 S-06 S-08 S-11 S-15 S-18 | C-24 의 `listening` 제거가 첫 단계. 조각마다 따로 병합한다 |
| 7 | H-G 하네스 채널 분해(Claude·OpenCode) | C-27 C-28 | 0/0 | S-04 S-05 S-06 S-07 S-10 | 이벤트 순서가 걸려 있어 동작 보존 추출을 먼저 한다 |
| 8 | H-H 백그라운드 작업 이중 모델 정리 | C-34 | 0/0 | S-10 S-11 | 0231 결정 변경 — 승인 필요 |
| 9 | H-I 런타임 모델 배선 팩토리 정리 | C-29 | 25/0 | S-01 S-02 S-23 | — |
| 10 | H-J OpenCode 컴포저 목록 프로토콜 축소 | C-36 | 0/0 | S-05 | 설계 검토가 먼저다 — 절감 미추정. main owner 와 한 묶음 |
| 11 | H-K 늘 같은 값이 들어오는 인자·optional props 정리 | C-37 C-38 C-39 | 46/0 | S-04 S-16 S-18 | 근거가 호출부 전수라 위험이 낮다 — H-B 와 합쳐도 된다 |

| 보류 후보 | 사유 |
|---|---|
| C-18 | 겹침이 22줄뿐이고 기존 진단이 하네스별 정책 분리를 경계로 뒀다 — 절감 대비 위험이 크다 |
| C-33 | 채택 규칙(직접 호출 금지) 변경이고 테스트 37파일의 mock 지점이라 절감 대비 변경 범위가 넓다 — 승인 여부부터 정한다 |
| C-35 | 겉모습이 하네스별로 달라 공통 줄이 13뿐이다 — C-18 과 같은 이유 |
<!-- /gen:split -->
