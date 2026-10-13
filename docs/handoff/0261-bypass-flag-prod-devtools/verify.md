# Verify — 0261-bypass-flag-prod-devtools

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0261-bypass-flag-prod-devtools` |
| 검증자 | Claude Code |
| 일자 | 2026-10-13 |
| 대상 커밋/range | `cd7ea1a2..fab363fd` |
| 구현 전 plan 기준 | `cd7ea1a2` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `cd7ea1a2:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC1·AC7 사람 실기 대기 |
| 자기 검증 여부 | 설계·구현·검증 동일 에이전트 — §4 에 구현 보고가 이름을 대지 않은 축 I1~I10 을 함께 적는다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: 예 — 메타 `상태` 1줄 + `[구현자 기입]` 자리표시자만. `[구현자 기입] 설계 리뷰` 앞 규범 영역을 두 판본에서 잘라 `diff` → 14행(`상태`) 1건.
- **기준선이 diff로 성립하는가**: 예 — 설계 `cd7ea1a2`(`Status: designed`)와 구현 `fab363fd` 가 분리.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음(위 diff).
- 채점에 사용할 원 기준: `cd7ea1a2:V1` 의 D-001~D-006 · AC1~AC8 · VP-01~VP-09 · EP-01~EP-04.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속 V 없음 → Baseline V1 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~R-04 ↔ AT(VP-01·06·07·08) · SD-01·02 ↔ ST(VP-02·05) · AR-01·02 ↔ IT(VP-03·04) |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | AR-03 ↔ IT-04 (VP-09) |
| pair별 path·§10 전수·직접 oracle | 유효 | 9 pair 모두 path·자리 수·좌표 기재 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | proxy oracle 인 VP-02·04·05·08 만 선택, 나머지는 직접 관측 근거 |
| `SUPERSEDED` pair 이관 | 해당 없음 | Baseline |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest·doc gate 3종·trailer |

- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-004 | 명시 모드가 있는 대화 spawn 에 `allowDangerouslySkipPermissions: true`, `complete()` 에는 없음 | `send.ts`(모드 항상 명시) → `SessionRuntime` → `ClaudeAdapter.sendMessage` options → `query()` |
| D-002·D-003·D-005 | 모든 창 생성자 `devTools: import.meta.env.DEV` → production 번들 `false` | `index.ts` createWindow · `infra/browser-session.ts` openWindow → `out/main/index.js` 두 생성자 |
| D-006 | 옛 사실 DA 행 교체 | `0260/drift-assertions.tsv` DA-SE03·AG5·CS4·CS6 교체 + 5행 신규 |

### end-to-end 흐름

```text
Composer bypass → orca:permission:setMode / chat:send
  → ApprovalCoordinator.live.setPermissionMode / SessionRuntime.pushTurn
  → ClaudeAdapter handle.setPermissionMode → CLI(spawn 플래그로 가용) → 수락
createWindow / openWindow → BrowserWindow(webPreferences.devTools = DEV) → production false
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 정책 disable 환경은 CLI 가 계속 거부 — 기존 실패 계약 | probe C · `coordinator.permission.test.ts:'SDK failure does not report or store success'` |
| false success 가능성 | 없음 — 플래그가 SDK argv 로 가지 않으면 probe B 가 실패 | `sdk.mjs` `if(b)K.push("--allow-dangerously-skip-permissions")` · probe B ok |
| partial failure/rollback | 해당 없음 — spawn 인자 1개, 창 옵션 1키 | diff 3 hunk |
| Product/UX의 A가 아닌 B | 아니오 — 플래그는 명시 모드와만, devTools 는 빌드 상수 | D-003·D-004 대로 |
| 증상만 제거 | 아니오 — CLI 가용성 자체를 연다 | probe A↔B |
| 최적화가 잃은 관측 | 해당 없음 | — |
| 출력/요청 worst-case | 해당 없음 | — |
| 창 생성자 밖 진입 | 자식 창 없음 — 두 창의 `setWindowOpenHandler` 가 항상 `deny` | `index.ts` `return { action: 'deny' }` · `browser-session.ts` `() => ({ action: 'deny' })` |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh cd7ea1a2..fab363fd
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 1b `LoginWindowOptions`(타입 export) | 정상 | 기존 시그니처 타입 — 0261 이 바꾸지 않음 |
| 2 `buildTurnContent`(테스트 참조만) | 정상 | `claude.ts` `pushTurn` 이 같은 파일에서 호출 — 파일 간 참조 0 이 정상, 0261 무관 |
| 형제 정책 비대칭 | 없음 | 두 창 모두 같은 4키(스캔 3케이스 green) |
| 신규 등록값의 기존 소비처 | 무영향 | optimizer F12 는 production 번들에서 no-op(문서화) |
| producer ↔ consumer | 불변 | IPC·renderer 무변경 |
| 동일 규칙 중복 | SSOT 유지 | 창 리터럴 + 스캔 한 곳 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 실재: `coordinator.permission.test.ts:'%s %s settles %s'`(it.each 65행) · `claude.executable-option.test.ts` `queryMock`·`optionsOfFirstCall` 하네스.
- **선택된 적대 증거 재측정**: 등록 26자리(14행) 전부 검출 — M1~M8b 9/9 · M9a·M9b 2/2 · M10 9/9 · M11 5/5 · probe A 거부 관측.
- **자리 미지정 등록 변이**: 해당 없음 — 모든 변이가 자리를 적었다.
- **이전 라운드 대조**: 최초 라운드 — 해당 없음.
- **자기검증 분모** — 구현자 = 검증자: 보고에 없던 축 10건, 결과는 아래 표.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1~M8b(창 9자리) | 스캔·행동 3파일 25케이스 | 최초 | 9/9 red · 복원 25/25 | VP-04 등록 변이 |
| M9a·M9b → `electron-vite build` | 번들 gate | 최초 | 2/2 red(`index.js:15186`·`:23124`) · 복원 exit 0 | VP-05 등록 변이 |
| M10(DA 9행 must 훼손) · M11(옛 사실 5자리 복원) | drift-check | 최초 | 9/9 · 5/5 red · 복원 공집합 | VP-08 등록 변이 |
| **I1** 플래그를 대화 → `complete()` 로 맞바꿈(형제 슬롯) | 대상 3파일 | — | red 3(대화 2 + complete 1) | VP-03 독립 축 |
| **I2** 플래그를 조건 밖 무조건 전달 | 같음 | — | red 1('모드를 명시하지 않은…') | VP-03 독립 축 |
| **I3** 네임스페이스 `new electron.BrowserWindow(...)` devTools 없음 | 같음 | — | red 1(`app/i3-window.ts`) | VP-04 독립 축 |
| **I4** `devTools: import.meta.env.DEV \|\| true` | 같음 | — | red 1(index.ts) | VP-04 독립 축 |
| **I5** import 안 된 새 파일의 올바른 생성자 → 빌드 | 번들 gate | — | red(소스 3 · 번들 2) · 스캔 4/4 green | VP-05 수 대조 축 |
| **I6** 플래그 없이 bypass 시작 → default → bypass | 실제 CLI | — | 둘 다 ok — 문서 "(또는 bypass 시작)" 참 | VP-02 · DA-CS12 |
| **I7** 플래그 계층 `settings` defaultMode=bypass + 플래그 + 명시 default | 실제 CLI('hi' 1턴) | — | `init.permissionMode = default` | D-004 안전 근거 |
| **I8** 엄격 sweep — 플래그 부정·DevTools 옛 표현 | scope 50파일 | — | 옛 사실 0 · 일치 2줄은 새 행의 "complete() 는 넘기지 않는다" | VP-08 |
| **I9** 추가 문서 줄 ↔ DA must 독립 대조 | 5문서 | — | 13줄 중 미대응 4줄 → N1 | VP-08 · N1 |
| **I10** doc-gate 승계 — 이동 판정의 문장 동일성 | baselines 2파일 | — | 이동 14행 문장 동일·판정 승계 14/14 · 신규 2건 타당 | 운영 gate |

- 동작 보존 추출 라운드인가: 아니오.
- 소거 변이의 잔여물 수렴: 해당 없음 — 스캔은 리터럴 키를 직접 보며 타입 진단에 기대지 않는다.
- 형제 슬롯 맞바꿈: M6(webPreferences ↔ 최상위 옵션) · I1(대화 ↔ complete) red.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-03 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | ① `claude.executable-option.test.ts:'대화 query 는 명시 모드(%s)와 함께 플래그를 싣는다'`·`'모드를 명시하지 않은 대화 query 는 플래그도 싣지 않는다'` · ② `'제목 생성 complete() 는 플래그를 싣지 않는다'` · I1·I2 red | `ClaudeAdapter` 실코드 → `query` mock options / 2/2 |
| VP-04 | AR-02 ↔ IT-02·IT-03 / IT | REQUIRED | PASS | ① `browser-window-devtools.test.ts:'%s — webPreferences 보안 베이스라인'`(index.ts) · ② 같은 케이스 + `browser-session.devtools.test.ts` 2케이스 · M1~M8b·I3·I4 red | 생성자 리터럴 → Electron / 2/2 |
| VP-07 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | ② `'dev 빌드(DEV=true)에서는 devTools 를 연다'` · ① 스캔의 `/^import\.meta\.env\.DEV$/` 단언 | DEV=true → devTools true / 2/2 |
| VP-09 | AR-03 ↔ IT-04 / IT | REGRESSION | PASS | `src/main/{adapters,infra,features/approvals,features/sessions}` 120파일 green · `infra/db` 밖 실패 0 | 기존 options 조립 / 0 + 계약 불변 |
| VP-02 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | `gate:node docs/handoff/0261-bypass-flag-prod-devtools/probe-live-bypass.mjs` A·B·C PASS · I6·I7 | SDK → CLI argv → set_permission_mode / 1/1 |
| VP-05 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | `gate:(cd app && npx electron-vite build) && node …/check-prod-bundle.mjs` exit 0 · M9a·M9b·I5 red | define → 번들 2자리 / 2/2 |
| VP-08 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | `gate:drift-check.sh check` 206행 공집합 · I8 0 · M10·M11 red | 문서 9자리 + 옛 5자리 + DA 9 / 전부 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **실기 대기** — 기계 사슬 PASS | edge (a) `coordinator.permission.test.ts:'%s %s settles %s'` · spawn 플래그 VP-03 · CLI 수락 VP-02 | 사람: 앱에서 턴 중·다음 턴 bypass 전환 |
| VP-06 | R-02 ↔ AT-02 / AT | REQUIRED | **실기 대기** — 기계 사슬 PASS | 하위 VP-04·VP-05 | 사람: 설치본 메뉴·단축키 |

- root `PAIR_FAIL`: 없음. 종속 `BLOCKED_BY`: 없음.
- 좌표의 실행 구간: AC5 는 `openLoginWindow` 실코드로 들어가 mock `BrowserWindow`(Electron 경계 끝점)의 생성자 인자를 본다 — `webPreferences` 리터럴 자리는 구간 안. 본창 자리는 import 테스트가 없어 스캔(민감도 M1·M2·M5·M6·M8·I4)과 번들 gate 로 닫는다.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 세션 도중 bypass 전환 적용 | ⚠️ 사람 실기 | 기계 사슬 VP-02·03 PASS | 앱 UI |
| ST-01 / AC2 | 실제 CLI A·B·C | ✅ | probe exit 0 · I6 | SDK → CLI |
| IT-01 / AC3 | 대화만·명시 모드와만 | ✅ | 4케이스 green · I1·I2 red | sendMessage/complete → query |
| IT-02 / AC4 | 전 생성자 4키 단일·최종 | ✅ | 스캔 3케이스 · M1~M8b·I3·I4 red | 소스 리터럴 |
| IT-03·AT-03 / AC5 | 로그인 창 DEV 양값 | ✅ | 2케이스 · M3·M4 red | openLoginWindow → BrowserWindow |
| ST-02 / AC6 | 번들 2자리 false | ✅ | exit 0 · M9a·M9b·I5 red | 번들 |
| AT-02 / AC7 | 설치본 DevTools 무반응 | ⚠️ 사람 실기 | 하위 VP-04·05 PASS | 설치본 |
| AT-04 / AC8 | 문서 새 사실·옛 사실 0 | ✅ | drift 공집합 · I8 0 · M10·M11 red | 문서 |

- **합계 재측정**: `✅ 6 · ⚠️ 2 · ❌ 0 = 총 8` (plan §7 `/ AC` 고유 8) · 자기보고 6/8 · 일치.
- **합계 사본 대조**: plan 구현 보고 `✅ 6 · ⚠️ 2 · ❌ 0 = 총 8` ↔ trailer `Criteria-Met: 6/8` ↔ INDEX 비고 `✅6·⚠️2·❌0` — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-03 | EP-01 | sendMessage · runCompletion (2) | `rg -n 'query\(\{' app/src/main -g '!*.test.ts'` → 2 · 플래그 production 1(`claude.ts`) | PASS 2/2 |
| VP-04 | EP-02 | index.ts · browser-session.ts (2) | 생성자 정규식 → 2 · `BrowserView`·`WebContentsView`·`<webview` 0 | PASS 2/2 |
| VP-05 | EP-03 | 번들 생성자 (2) | 번들 2 = 소스 2 | PASS 2/2 |
| VP-08 | EP-04 | 새 9 · 옛 5 · DA 9 | 새 사실 9자리 DA 대응 · 옛 사실 scope 0 · DA 9행 | PASS — 표 밖 새 사실 4줄은 N1 |

- 표에 없는데 같은 불변식이 필요한 지점: 없음(현재 계약 기준). 표 밖 새 사실 4줄(I9)은 AC8 기준(9자리)을 깨지 않아 NON_BLOCKING N1.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| lint | app 수정 | PASS | 0 error · 1 warning(`renderer/…/useTranscriptVirtualizer.ts`, 마지막 변경 `907bc7bd` — 0261 무관) · 트리 무변경 |
| typecheck | app 수정 | PASS | 3구성(`node`·`web`·`test`) 실행 · `error TS` 0 |
| vitest 관련 스위트 | 신규·회귀 | PASS(환경 분리) | 129파일 중 120 green · 1364 통과 · 실패 9파일 전부 `infra/db/*` — `NODE_MODULE_VERSION 140 vs 127` 9건 |
| doc-gate · drift-check · inventory | 문서 수정 | PASS | 세 축 공집합 · 206행/82/67 공집합 · prose·links ok |
| message bus | 커밋 | PASS | `cd7ea1a2`·`fab363fd` trailer 파싱 · 원격 존재 |

## 6. 외부 포트 / 문서 계약 (해당 시)

해당 없음 — 배포 확장점이 창·SDK 권한 옵션을 노출하지 않는다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- 창 생성자 2 · SDK `query(` 2 · 라이브 setter 4 — plan §8 과 같다.
- 0건 게이트: 옛 사실 sweep 0 — 같은 줄의 "complete() 는 넘기지 않는다"(현재 사실) 2줄은 정당한 잔존(I8).
- 상한: 해당 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC1 | 옵션 조립(VP-03) · CLI 가용성(VP-02·I6·I7) · 코디네이터 edge | 앱 UI 전 경로 | 세션을 default 로 시작 → 응답 중 bypass 선택(확인 수락) → 표시 bypass 유지 · 다음 메시지 전송 → 오류 없이 진행 |
| AC7 | 소스 리터럴(VP-04) · 번들 상수(VP-05) | Electron 런타임 | Windows 설치본: 본창 F12·Ctrl+Shift+I 무반응 · 로그인 창 Alt → View → Toggle Developer Tools 무반응. `npm run dev` 에서는 F12 로 열림 |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/main/adapters src/main/infra src/main/features/approvals src/main/features/sessions` · doc gate 3종 · probe · `npx electron-vite build` + 번들 검사 · 변이 러너(scratch, 매번 원본 복원).
- **관측한 실행 산출**: §5 운영 gate 표.
- `npm test` 사용: 없음 — DB 동작 무관.
- 환경 분리 근거: 실패 9파일이 전부 `infra/db/*` 이고 0261 변경 파일을 import 하지 않으며 ABI 서명 9건.
- **게이트가 작업 트리를 바꿨는가**: 아니오 — 검증자 lint 전후 `git status --porcelain` 동일(빈 출력).
- **검증 중 실행한 명령이 남긴 잔여물**: `app/out/`(gitignore 대상 빌드 산출) — 삭제함. probe 임시 디렉토리는 스크립트가 정리.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/관련 자동 테스트 | 실행·출력 증거 | — | PASS |
| AC ↔ 코드/production path | 1:1 대조 | — | ✅ 6 |
| 문서 형식·링크·사실 | doc gate 3종 + I8~I10 | — | PASS |
| AGENTS 위생 | 민감 패턴 0 | — | PASS |
| UI·Electron 런타임 | 로직·번들 기계 검증 | **AC1·AC7 실기** | 대기 |

## 11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md` 추가 줄에서 IP·이메일·키/토큰 패턴 0. 부모·자식 명령 충돌 없음.
- INDEX: 이번 턴에 `verify/PASS`·다음 주체 `사람`·대상 커밋 `cd7ea1a2`(V1 설계) · `fab363fd`(r1)(`git cat-file -t` = commit, 원격 존재)로 갱신. 비고 5줄 이내.
- trailer: 두 커밋 모두 허용값·파싱 정상.
- `[구현자 기입]` 7필드: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals — 7/7.
- reference/script: 신규 2개(`probe-live-bypass.mjs` · `check-prod-bundle.mjs`) — 소비처는 plan §19·DA-CS12 anchor·claude-code-spec §5.5.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| DA-CS6 `[를는]` → `(를\|는)` | 타당 — 구현 세부 보완. 재측정 M11 5/5 | 유지 |
| doc-gate 판정 승계 14건 + 신규 2건 | 타당 — I10 문장 동일 14/14 | 유지 |
| VP-03 케이스 이름 `(%s)` 표기 | 타당 — 단언 행동 동일 | 유지 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| N1 | DA 행 없이 추가된 새 사실 4줄 — claude-code-spec §5.5 글머리 3 · security.md §1.1 아래 문장(I9). 내용은 실측과 일치 | VP-08 · AC8 기준(9자리) 밖 | NON_BLOCKING | — | 다음 문서 handoff 에서 DA 행 추가 후보 |
| N2 | security.md §1.5 단축키 표기가 Windows 기준(Ctrl+Shift+I·Ctrl+R) — macOS 는 Alt+Cmd+I·Cmd+R(toolkit `input.alt && input.meta`) | 비귀속(문서 정밀도) | NON_BLOCKING | — | 기록 |
| N3 | drift-check `LC_ALL=C` 가 ERE 문자 클래스의 비ASCII 문자를 바이트로 읽는다 — 0261 행은 교대식으로 우회, 장치 헤더에는 경고 없음 | 0260 장치(비귀속) | NON_BLOCKING | — | 장치 헤더 경고 후보 |
| X1 | 원격 디버깅·Node inspect 진입(Electron fuses) | plan §6 비범위 | NEXT_HANDOFF | — | 사용자 결정 후 |
| X2 | bypass 모드에서 `canUseTool` 게이트(승인 카드·중단 서브에이전트 재호출 차단) 미적용 — 세션 도중 진입이 가능해져 구간 확대 | plan §17 | NEXT_HANDOFF | — | 사용자 보고 |
| X3 | 정책 disable 환경의 bypass 메뉴 노출(선택 시 미적용·다음 턴 오류) | plan §6 | NEXT_HANDOFF | — | 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(최초 라운드).
- 관련 plan 지침/AC: VP-08 의 등록 변이 M11 이 DA-CS6 바이트 클래스 결함을 구현 턴에 잡았다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: Electron 바이너리 없음(AC1·AC7) · better-sqlite3 ABI(DB 9파일).

## 15. 결론

**PASS (기계 범위)** — REQUIRED 8 pair 중 6 PASS · REGRESSION 1 pair PASS, 사람 실기 pair 2(VP-01·VP-06)는 기계 사슬 PASS 상태로 대기. 운영 gate 전부 PASS(환경 분리 9파일), PLAN_GAP 0, AC `✅ 6 · ⚠️ 2 · ❌ 0`. 다음 주체는 사람(AC1·AC7 실기).
