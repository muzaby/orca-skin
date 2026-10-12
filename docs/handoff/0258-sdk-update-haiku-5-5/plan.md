# Plan — 0258-sdk-update-haiku-5-5

## 메타

| 항목 | 값 |
|---|---|
| slug | `0258-sdk-update-haiku-5-5` |
| 작성자 | Claude Code |
| 일자 | 2026-10-12 |
| 매핑 | 사용자 라이브 세션 (`/handoff-plan`) — 9개 요청 중 7번. 나머지는 0256·0257·0259 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0246 V의 표·별칭 규칙은 아래 R-02·R-05가 회귀로 다시 닫는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 동봉 SDK `0.3.286`(CLI 2.1.286)은 Haiku 5.5를 모른다. Haiku 5.5는 CLI 2.1.293에서 추가됐고 Anthropic API의 기본 Haiku가 됐다(§8). Orca의 모델별 기본 effort 표와 1M 컨텍스트 분류도 Haiku를 4.5·200k로만 안다(`model-effort.ts:37` · `claude-context-policy.ts:38-43`).
- 완료 후 달라지는 것: SDK `0.3.296`(CLI 2.1.296)으로 `haiku` 별칭이 Haiku 5.5로 해석된다. Haiku 5.5의 기본 effort는 '중간', 컨텍스트는 1M으로 다룬다. Haiku 4.5는 지금과 같다.
- 성공을 사용자 관점에서 한 문장으로: 모델 메뉴에서 Haiku를 고르면 Haiku 5.5로 대화가 되고, effort 칩은 '중간'으로 시작한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "claude-agent-sdk 버전을 최신으로 업데이트 하라. haiku 5.5 지원을 위함이다" | 사용자 턴 1 |
| 추론 의도 | "지원" = 별칭 해석 + Orca가 모델별로 하드코딩한 표(effort 기본값·1M 분류)의 Haiku 5.5 행 | 0246 D-002·D-005 · 0245 D-008 — 같은 표가 Opus/Sonnet 5.5 때 함께 갱신됐다 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `@anthropic-ai/claude-agent-sdk` 를 `0.3.296`(2026-10-09 npm `latest`, `claudeCodeVersion` 2.1.296)으로 exact pin 한다 | "최신 버전으로 업데이트 하라" — Haiku 5.5는 2.1.293부터. 2.1.296은 Haiku 5.5 토큰 집계 수정 포함 | 사용자 턴 1 / CHANGELOG | ACTIVE | — |
| D-002 | `haiku` 별칭 = Haiku 5.5로 본다 | 0246 D-005 "번들 CLI의 Anthropic API 해석 버전" 승계 · 2.1.296 probe `haiku`→`claude-haiku-5-5` | 0246 D-005 / probe | ACTIVE | — |
| D-003 | Haiku 5.5 기본 effort = `medium` 행을 표에 더한다. Haiku 4.5는 표 밖(`high` 칩, CLI는 effort 미전송) 그대로 | 0246 D-002 "Claude Code 내장값" 승계 · probe `claude-haiku-5-5` 무지정 → `medium` · 카탈로그 `default_effort:"medium"` | 0246 D-002 / probe | ACTIVE | — |
| D-004 | Haiku 5.5 이상을 네이티브 1M으로 분류한다 — 게이트웨이·3P에서는 0245 규칙대로 실행 모델에 `[1m]` 을 붙인다 | 0245 D-008 "1M인 Claude 모델명 + CLI가 1M을 인정 못 하는 연결" 승계 · probe `contextWindow` 1,000,000 · 카탈로그 `native_1m:!0` | 0245 D-008 / probe | ACTIVE | — |
| D-005 | 자동 권한 모드 규칙(정식 ID의 버전이 4.6 이상)은 바꾸지 않는다 — `claude-haiku-5-5` 는 이미 허용, 별칭 `haiku` 는 증거로 쓰지 않음(0215) | probe: CLI 2.1.296 `permissionMode:'auto'` + `claude-haiku-5-5` → init `auto` · `claude-haiku-4-5` → `default` | 0215 / probe | ACTIVE | — |
| D-006 | 제목 생성 등 1-shot 보조 경로가 `haiku` 별칭으로 Haiku 5.5를 쓰게 되는 것은 SDK 갱신의 정상 결과로 둔다 | `resolveTitleModel` 은 별칭을 넘길 뿐 — 0246 D-013 "1-shot 보조 경로 effort 비범위" 승계 | 설계자 | ACTIVE | — |
| D-007 | 비범위: Haiku 5.5 전용 UI(배지·가격) · 3P(Bedrock 등)에서 `haiku` 별칭이 4.5로 해석되는 차이 · Agent 도구의 새 `effort` 입력 표시 | 요청 밖 · 0246 D-005가 3P 해석 차이를 이미 수용 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-007 (신규 handoff).
- 변경된 결정: 없음(0246 D-005의 별칭 버전 값만 표 데이터로 갱신 — 규칙은 같다).
- 기존 ACTIVE 중 언급되지 않았지만 유지되는 결정: 0246 D-006·D-007(effort 재설정·라이브 적용) · 0245 D-008 3P sonnet≥5 예외.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC1·AC9·AC10 · D-002 ↔ AC2·AC7 · D-003 ↔ AC3·AC4·AC7 · D-004 ↔ AC5·AC6 · D-005 ↔ AC8 · D-006 ↔ §6(AC 없음) · D-007 ↔ §6.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — Haiku 5.5 인식은 번들 CLI 버전이 정한다 | CLI 2.1.296 카탈로그 `aliases.haiku.default:"claude-haiku-5-5"` |
| 이미 기존 코드가 충족하는가 | 아니오 — 2.1.286 번들은 `haiku`→`claude-haiku-4-5-20251001`(0246 §8 probe) | 0246 plan §8 |
| 더 작은 해법이 있는가 | SDK만 올리면 칩은 '높음'(표 밖), 컨텍스트 게이트웨이 경로는 200k로 남는다 — 표 2곳을 함께 고친다 | `defaultEffortForModel('haiku')` 현재 `high`(`model-effort.test.ts:39-41`) |
| 선행 자료의 주장을 코드와 대조했는가 | study 8.2의 3P `native_1m_3p` 표는 2.1.267 기준 — 2.1.296 바이너리에 그 필드 0건. 3P 동작은 바꾸지 않고(0245 규칙 유지) 실환경 확인으로 남긴다 | `grep -c native_1m_3p claude.exe` → 0 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 — 0246 D-005·D-002, 0245 D-008의 규칙에 Haiku 5.5 데이터를 넣는다 | §16 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: SDK 타입 변화는 전부 추가형이다(§8) · Orca가 바뀐 union을 전수 분기하는 곳 0건.

## 5. 동작 / 사용자 흐름

```text
[모델 메뉴에서 Haiku 선택] → SET_MODEL → effort = defaultEffortForModel('haiku') = medium
  → 전송 → spawn options.model='haiku', options.effort='medium'
  → 번들 CLI 2.1.296 → 요청 model=claude-haiku-5-5, output_config.effort=medium, adaptive thinking
  → 도넛 분모 = SDK 보고 contextWindow 1,000,000
[게이트웨이 + gw-haiku-5.5] → modelForCli → 'gw-haiku-5.5[1m]' → CLI가 [1m] 떼고 context-1m beta
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 기본 카탈로그(별칭 4종)에서 Haiku 선택 | effort `medium` | 칩 '중간' |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5` | 표 밖 → `high`, CLI는 effort 미전송 | 칩 '높음'(현행) |
| `claude-haiku-5-5` 정식 ID + 자동 권한 | 허용 | 권한 '자동' 유지 |
| 별칭 `haiku` + 자동 권한 | 0215 강등 | '편집 자동 수락'(현행) |
| 게이트웨이 URL + Haiku 5.5 이름 | `[1m]` 부착 | 1M 컨텍스트 |
| 직결 + `claude-haiku-5-5` | 원문 | CLI가 네이티브 1M 인정 |

### 파생 UX / 엣지케이스

- 3P(Bedrock·Vertex·Foundry)에서 `haiku` 별칭은 CLI가 Haiku 4.5로 해석한다(카탈로그 `per_provider`) — Orca 칩은 '중간'(D-002 기준). 0246 D-005가 이미 수용한 차이(D-007).
- 1-shot 보조 경로(제목 생성)는 Haiku 5.5 + CLI 기본 effort로 돈다(D-006).
- 오프라인/폐쇄망: 번들 CLI 교체만 — 네트워크 정책 변화 없음.

## 6. 범위 / 비범위

- **범위**: SDK pin·lock · 설치 버전 식별 테스트 literal · effort 표 Haiku 5.5 행 · 별칭 버전 · 1M 분류 Haiku 5.5 · smoke 사례 2건 · 현행 문서 1자리.
- **비범위**: D-006 · D-007.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 3P 1M 인정 방식 재조사(2.1.296에서 `native_1m_3p` 소멸) | 아니오 — 분류 함수 1곳 | NEXT_HANDOFF 후보(폐쇄망 실환경 필요) |
| 제목 생성 effort 지정 | 아니오 | 0246 D-013 후보 그대로 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `app/package.json` 이 SDK를 정확히 `0.3.296` 으로 고정하고 lockfile이 같은 버전(플랫폼 패키지 8종 포함)으로 해석된다. 어댑터가 읽는 설치 SDK 버전이 `0.3.296` 이다 | `npm ls @anthropic-ai/claude-agent-sdk` → `0.3.296` · `claude.background.test.ts` 식별 케이스 `sdkVersion: '0.3.296'` | `sdkPackageVersion()` → `background.connection` |
| R-01 | AT-02 / AC2 | 번들 CLI가 별칭을 `CLAUDE_ALIAS_VERSION` 대로 해석한다: `opus` 5.5 · `sonnet` 5.5 · `fable` 5.1 · `haiku` **5.5** | smoke B(별칭별 루프백 요청 `model` → `parseClaudeModelName`) | `query({model: alias})` → CLI → `/v1/messages` |
| R-02 | AT-03 / AC3 | 표의 모든 행에서 번들 CLI 무지정 effort = 행 값(Haiku 5.5 `medium` 포함). Haiku 4.5는 명시 effort도 보내지 않고, Haiku 5.5는 명시 `low` 를 그대로 보낸다 | smoke A(표 11행) · smoke D(Haiku 4.5 `undefined`) · **smoke D2 신설**(Haiku 5.5 `low` → `low`) | `query({model, effort?})` → 요청 `output_config.effort` |
| R-02 | AT-04 / AC4 | `defaultEffortForModel`: `haiku` · `HAIKU` · `claude-haiku-5-5` · `haiku-5.5` · `us.anthropic.claude-haiku-5-5-v1:0` · `claude-haiku-5-5[1m]` → `medium`. `claude-haiku-4-5` → `high`. 나머지 0246 AC4 표 불변 | `model-effort.test.ts` 표 개정(`haiku` 를 `high` 목록에서 `medium` 목록으로) | reducer `SET_MODEL` · `EffortMenu` 추천 |
| R-03 | AT-05 / AC5 | `classifyContextModel`: `claude-haiku-5-5` · `gw-haiku-5.5` · `us.anthropic.claude-haiku-5-5-v1:0` → claude/1M · `claude-haiku-4-5` → 200k · `haiku`(버전 없음) → 200k. `modelForCli`: 게이트웨이 + `gw-haiku-5.5` → `gw-haiku-5.5[1m]` · 직결 + `claude-haiku-5-5` → 원문 · Bedrock 플래그 + `claude-haiku-5-5` → `claude-haiku-5-5[1m]` | `claude-context-policy.test.ts` 0245 AC1·AC2 표에 행 추가 | `modelForCli` → spawn `options.model` |
| R-03 | AT-06 / AC6 | 새 CLI에서 `gw-haiku-5.5[1m]` 요청은 `model` 에서 `[1m]` 이 떨어지고 `context-1m-2025-08-07` 베타가 붙는다 | smoke E 사례 추가 | CLI 요청 |
| R-02 | AT-07 / AC7 | 렌더러에서 Haiku(별칭)를 고르면 다음 전송 payload effort가 `medium` 이다 | store IT(0246 AC6 형태): `setModel(…,'haiku','haiku',…)` → `send` → `chatSend` payload `effort:'medium'` | `Composer` → `SET_MODEL` → `orca:chat:send` |
| R-04 | AT-08 / AC8 | 자동 권한: `supportsAutoPermission('claude-haiku-5-5')` 참 · `coercePermissionMode('auto_classified', {alias:'haiku', model:'claude-haiku-5-5'}, 'code')` = `auto_classified` · 별칭만(`model:null`)은 현행 강등 | `permission-mode.test.ts` 양성 행 추가(기존 강등 케이스 `:108-140` 유지) | 메뉴·전이·실행 공용 함수 |
| R-05 | AT-09 / AC9 | 업그레이드 후 lint·typecheck 0 오류, vitest는 업그레이드 **전** 기준선 대비 새 실패 0, 기존 bundled-CLI smoke(background·context-usage)가 통과한다 | §19 gate + 기준선 대조 | 전체 |
| R-05 | AT-10 / AC10 | 빌드가 성공하고 main 번들이 SDK를 외부 `require` 로 남긴다 | `./node_modules/.bin/electron-vite build` 성공 · `out/main/index.js` 의 SDK `require` 유지 | 패키징 |
| R-05 | AT-11 / AC11 | 현행 문서가 네이티브 1M에 Haiku 5.5 이상을 포함하고, effort 표 머리 주석이 CLI 2.1.296을 가리킨다 | `rg -n "Haiku 5.5" docs/arch/backend/adapters.md` → 1 · `rg -n "2.1.296" app/src/shared/model-effort.ts` → 1 | 문서·주석 |
| R-01·R-02 | AT-12 / AC12 | 실제 계정으로 Haiku(별칭) 대화가 끝까지 되고, 칩이 '중간'이며, 도넛 분모가 1M이다 | 사람 실기 — 실 API 자격증명 필요 | 앱 실행 |

### AC 검증 주의사항

- 기존 테스트 재사용: `model-effort.test.ts:9-60` 의 0246 AC4 표 · `claude-context-policy.test.ts:13-60` 의 0245 AC1·AC2 표 · `permission-mode.test.ts:108-140` 강등 케이스 · `claude.background.test.ts:50-66` 식별 케이스가 존재한다(열람 확인). `haiku` 기대값만 바뀌고 나머지 행은 회귀로 그대로 쓴다.
- 사람 실기 항목: AC12만 — 실 API 자격증명. 별칭·기본값·1M 처리는 smoke(루프백)로 기계 검증한다.
- smoke는 CI에 넣지 않는다(0246 선례). 검증자는 `cd app && node scripts/smoke-effort-sdk.mjs` 로 실행한다.
- 환경 주의: 이 저장소의 로컬 `app/node_modules` 는 SDK `0.3.220` 이 깔린 상태다(lock은 `0.3.286`, 설계 턴 관측). 기준선은 먼저 `npm ci` 로 lock과 맞춘 뒤 잰다.

## 7-A. V / Trace Matrix

- V mode 판정: 이 handoff의 계약은 새로 정의한다(Baseline V). 0246·0245 표의 기존 행은 R-05(AC4·AC5 기존 행)로 회귀를 닫는다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 Haiku 5.5 인식(D-001·D-002) | NEW | — |
| R-02 | R | §5 Haiku 5.5 기본 effort(D-003) | NEW | — |
| R-03 | R | §5 Haiku 5.5 1M 처리(D-004) | NEW | — |
| R-04 | R | §5 자동 권한 불변(D-005) | NEW | — |
| R-05 | R | §6 업그레이드 무회귀·문서 | NEW | — |
| AT-01..AT-12 | AT | §7 | NEW | — |
| SD-01 | SD | §5 선택 → effort → spawn → 번들 CLI 요청 | NEW | — |
| ST-01 | ST | smoke A·B·D·D2·E | NEW | — |
| AR-01 | AR | §10 EP-01·EP-02 SDK 패키지 경계(pin·lock·설치 식별·타입) | NEW | — |
| IT-01 | IT | `npm ls` · typecheck · 식별 테스트 | NEW | — |
| MD-01 | MD | §10 EP-03 effort 표·별칭 | NEW | — |
| MD-02 | MD | §10 EP-04 1M 분류 | NEW | — |
| MD-03 | MD | 자동 권한 판정(불변) | NEW | — |
| UT-01..UT-03 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02 | REQUIRED | `package.json` pin → 설치 SDK → 번들 CLI → `query({model:'haiku'})` → 요청 `model` | AC1 `npm ls`·식별 테스트 · AC2 smoke B | **required** — M4 pin을 `0.3.286` 에 둔 채 smoke B 실행(요청 `claude-haiku-4-5-20251001` → red) | EP-01 (11) · EP-02 (3) |
| VP-02 | R-02 ↔ AT-03·AT-04·AT-07 | REQUIRED | `setModel('haiku')` → `SET_MODEL` → `defaultEffortForModel` → payload → spawn `options.effort` → 요청 | AC3 smoke · AC4 UT · AC7 store IT | **required** — 하드코딩 데이터. M1 Haiku 5.5 행 삭제 · M2 `CLAUDE_ALIAS_VERSION.haiku` 를 4.5로 | EP-03 (3) · EP-05 ① (1) |
| VP-03 | R-03 ↔ AT-05·AT-06 | REQUIRED | `modelForCli` → `classifyContextModel` → 실행 모델 `[1m]` → CLI 베타 | AC5 UT · AC6 smoke E | **required** — M3 native1m에서 haiku 분기 삭제 | EP-04 (1) · EP-05 ② (1) |
| VP-04 | R-04 ↔ AT-08 | REQUIRED | `coercePermissionMode` → `supportsAutoPermission` | AC8 UT | not selected — 규칙 불변, 양성 행 직접 관측 | 0 — 코드 변경 없음(회귀만) |
| VP-05 | R-05 ↔ AT-09·AT-10·AT-11 | REQUIRED | 업그레이드 산출 전체 | gate 기준선 대조 · build · `rg` | not selected — gate·빌드·문서 직접 관측 | EP-06 (2) |
| VP-06 | R-01·R-02 ↔ AT-12 | REQUIRED | 앱 실행 → 실 API | 사람 실기 | not selected | 0 — 기계 경로는 VP-01~VP-03 |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | 별칭·정식 ID → 번들 CLI → 요청 `model`·`effort`·베타 | smoke A·B·D·D2·E | **required** — M2·M4 | EP-05 (2) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `npm install --save-exact` → lock → `sdk.d.ts`/`sdk-tools.d.ts` → typecheck · `sdkPackageVersion` | typecheck 0 오류 · 식별 테스트 | not selected — 컴파일러·버전 직접 관측 | EP-01 (11) · EP-02 (3) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | 입력 문자열 → 별칭 판정 → 파서 → 표 → 상수 | AC4 표 | **required** — M1·M2 | EP-03 (3) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | `classifyContextModel` → `modelForCli` | AC5 표 | **required** — M3 | EP-04 (1) |
| VP-11 | MD-03 ↔ UT-03 | REQUIRED | `supportsAutoPermission` | AC8 표 | not selected | 0 — 규칙 불변 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 기준선 확보 | 로컬 SDK가 lock과 다르다(0.3.220 관측) | `cd app && npm ci` → `./node_modules/.bin/vitest run` 결과 기록 | 기록만 |
| app lint · typecheck | `app/src/**`·`app/scripts/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| vitest 전체(기준선 대조) | SDK 갱신은 전 범위에 닿는다 | 업그레이드 후 같은 명령 → 새 실패 0 | 기준선에 없던 실패만 blocking |
| smoke | 번들 CLI 대조 | `cd app && node scripts/smoke-effort-sdk.mjs` · `node scripts/smoke-background-sdk.mjs` · `node scripts/smoke-context-usage-sdk.mjs` → 각 exit 0 | 불일치 1건이라도 blocking |
| 빌드 산출 | SDK 청크 이름 변화(`core-*.mjs`) | `cd app && ./node_modules/.bin/electron-vite build` | 빌드 실패만 blocking |
| 문서 인벤토리 | `docs/**` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 동일 |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| SDK `0.3.286` exact pin · npm `latest` = `0.3.296`(2026-10-09, `claudeCodeVersion` 2.1.296) · 0.3.287~0.3.296 매일 배포 | `app/package.json:35` · `npm view @anthropic-ai/claude-agent-sdk time` |
| 2.1.293 "Added Claude Haiku 5.5 (`claude-haiku-5-5`), now the default Haiku model on the Anthropic API — 1M context" · 2.1.296 "Fixed token counts for Haiku 5.5 …" | CHANGELOG(GitHub raw) · CLI 바이너리 내장 changelog 문자열 |
| CLI 2.1.296 카탈로그: `claude-haiku-5-5` context `{window:1e6,native_1m:!0,supports_1m_beta:!0}` · `max_output_tokens.default 128000` · `default_effort:"medium"` · capabilities `effort`·`max_effort`·`xhigh_effort`·`adaptive_thinking` · 별칭 `haiku.default:"claude-haiku-5-5"`, 3P `per_provider` → `claude-haiku-4-5` | `claude.exe` 문자열(설계 턴 scratch 설치) |
| 타입 diff 0.3.286→0.3.296: `sdk.d.ts` 236줄 · `sdk-tools.d.ts` 39줄 · `bridge.d.ts` 8줄, 전부 추가(선택 필드·`SDKStartupFailureReason` +2·도구 union +`OfferChromeSetup*`) · export 제거 0 | scratch 두 버전 `diff` |
| Orca가 바뀐 union을 소비하는 곳 0 | `rg -n "SDKStartupFailureReason\|ToolInputSchemas\|OfferChromeSetup" app/src --glob '!*.test.*'` → 주석 1(`file-edit-tool.ts:15`) |
| effort 표 머리 주석 = "Claude Code 2.1.286 defaults" · 별칭 `haiku: {4,5}` | `model-effort.ts:16,37` |
| 1M 분류 = fable·mythos·opus≥4.7·sonnet≥5, haiku 없음 · 3P sonnet≥5 예외 | `claude-context-policy.ts:38-43,103` |
| 자동 권한 = 정식 ID 버전 > 4.5 | `model-identity.ts:77-92` |
| 식별 테스트는 설치 SDK 버전을 실제로 읽는다(`sdkVersion`) · `cliVersion` 은 fixture init literal | `claude.background.test.ts:54,62-63` |
| smoke A는 표 행을, B는 별칭 맵을 순회 — 데이터만 바꾸면 사례가 따라 늘어난다 | `smoke-effort-sdk.mjs:169-181` |
| 로컬 `app/node_modules` SDK = `0.3.220`(lock `0.3.286`) | `node -e require(…/package.json).version` |

### 번들 CLI probe (설계 턴 실측 — CLI 2.1.296, 루프백 픽스처)

| 요청 모델 · effort | 요청 `model` / effort / thinking | `modelUsage.contextWindow` |
|---|---|---|
| `haiku` · 무지정 | `claude-haiku-5-5` / `medium` / adaptive | 1,000,000 |
| `claude-haiku-5-5` · 무지정 / `low` / `max` | 같음 / `medium` / `low` / `max` | 1,000,000 |
| `claude-haiku-4-5` · 무지정 | 같음 / 없음 / enabled | 200,000 |
| `opus` · `sonnet` · `fable` | `claude-opus-5-5`·`claude-sonnet-5-5`·`claude-fable-5-1` / `medium`·`medium`·`high` | 1M |
| 0246 표 나머지 9행 | 행 값과 같음(fable 5·opus 5·sonnet 5·opus 4.8·4.6·sonnet 4.6 `high`, opus 4.7 `xhigh`) | — |
| `claude-haiku-5-5[1m]` · `gw-haiku-5.5[1m]` | `[1m]` 제거 + `context-1m-2025-08-07` · gw는 effort `high`(CLI가 이름 미인식) | — |
| `gw-haiku-5.5` | 1M 베타 없음 | — |
| `permissionMode:'auto'` + `claude-haiku-5-5` / `claude-opus-5-5` / `claude-haiku-4-5` | init `auto` / `auto` / `default` | — |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| SDK 버전 literal | `rg -n "0\.3\.286\|2\.1\.286" app/src app/scripts` | 5 | 식별 테스트 3(설치 판정 `:62` + fixture `:54,:63`) · `model-effort.ts:16` 주석 1 → 갱신 · `background.monitor.test.ts:1` 관측 주석 1 → 0246 선례대로 유지 |
| `CLAUDE_ALIAS_VERSION` 소비 | `rg -n CLAUDE_ALIAS_VERSION app/src app/scripts --glob '!*.test.*'` | 3 | 정의 · `defaultEffortForModel` · smoke B |
| `classifyContextModel` 프로덕션 호출부 | `rg -n "classifyContextModel\(" app/src --glob '!*.test.*'` | 1 | `modelForCli` |
| 현행 문서의 1M 목록 | `rg -n "네이티브 1M" docs/arch` | 1 | `adapters.md:48` |

### 수치 / 전칭 표현 검산

- 표 행 수 10 → 11(Haiku 5.5 추가). smoke A 사례 수 = 행 수(순회).
- "타입 변화 전부 추가형" — 반례 검색: 두 버전 `sdk.d.ts` export 이름 목록 `comm` → 제거 0·추가 0(이름 단위), 변경은 멤버 추가.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`
- 현재 책임 소유자: 별칭 해석 = 번들 CLI · 기본 effort·1M 분류 = Orca 표.

```text
SDK 0.3.286 → CLI 2.1.286: haiku → claude-haiku-4-5-20251001 (effort 없음)
model-effort: haiku alias = 4.5 → 표 밖 → 칩 'high'
classifyContextModel: haiku → 200k → 게이트웨이 경로 [1m] 미부착
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`, `MD-02`
- 변경 후 책임: 같음(데이터 갱신).

```text
SDK 0.3.296 → CLI 2.1.296: haiku → claude-haiku-5-5 (effort medium, adaptive, 1M)
model-effort: alias haiku = 5.5 · 표 행 {haiku,5,5,medium} → 칩 '중간'
classifyContextModel: haiku ≥ 5.5 → 1M → 게이트웨이/3P에서 [1m]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 변화 없음 | 변화 없음 | — | — |
| data/control flow | 별칭 → 4.5 | 별칭 → 5.5 | D-001·D-002 | SD-01 / VP-07 · smoke B |
| state/contract | 표 10행 · 별칭 4.5 | 11행 · 별칭 5.5 | D-003 | MD-01 / VP-09 |
| 1M 분류 | haiku 200k | haiku ≥ 5.5 1M | D-004 | MD-02 / VP-10 |
| test seam | — | smoke D2·E 사례 | 검증 | ST-01 / VP-07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/model-effort.ts` | 기본 effort 표·별칭 버전 | 모델 이름 → effort | reducer · Composer · smoke |
| `main/adapters/claude-context-policy.ts` | 1M 분류·실행 모델 | 모델·env → 문자열 | `ClaudeAdapter` spawn |
| `scripts/smoke-effort-sdk.mjs` | 번들 CLI 대조 | 표·맵 → 요청 관측 | 검증자 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-01·VP-08 · EP-01 | SDK pin (11자리) | `package.json` | ① `package.json:35` ② lock `packages[""]` 의존 ③ lock `node_modules/@anthropic-ai/claude-agent-sdk` ④~⑪ 플랫폼 optional 8종 — 모두 `npm install @anthropic-ai/claude-agent-sdk@0.3.296 --save-exact` 한 번이 쓴다 | 설치 | 일부만 갱신 = 플랫폼별 다른 CLI |
| AR-01 / VP-01 · EP-02 | 버전 literal (3자리) | 설치 SDK | `claude.background.test.ts:54` `claude_code_version` · `:62` `sdkVersion` · `:63` `cliVersion` | 테스트 | `:62` 미갱신 = 식별 테스트 red |
| MD-01 / VP-02·VP-09 · EP-03 | effort 표 (3자리) | `model-effort.ts` | ① 머리 주석 2.1.296 ② 행 `{ family:'haiku', major:5, minor:5, effort:'medium' }` ③ `CLAUDE_ALIAS_VERSION.haiku = {5,5}` | 모델 선택 | ② 누락 = 칩 '높음' · ③ 누락 = 별칭 칩 '높음' |
| MD-02 / VP-03·VP-10 · EP-04 | 1M 분류 (1자리) | `claude-context-policy.ts` | `native1m` 에 `family === 'haiku' && major !== undefined && (major > 5 \|\| (major === 5 && minor >= 5))` | spawn | 게이트웨이에서 200k |
| ST-01 / VP-07 · EP-05 | smoke 사례 (2자리) | smoke | ① D2: `claude-haiku-5-5` + `low` → `low` ② E 목록에 `gw-haiku-5.5[1m]` | 검증 | Haiku 5.5 명시 effort·1M 경로 미관측 |
| R-05 / VP-05 · EP-06 | 현행 문서 (2자리) | 문서 | `docs/arch/backend/adapters.md:48` 1M 목록 · (EP-03 ① 주석) | 커밋 | 문서와 코드 불일치 |

### 등록 변이 (선택 적대 증거 정본)

| ID | 심을 자리 | 결함 | red여야 할 oracle |
|---|---|---|---|
| M1 | `model-effort.ts` 표 | Haiku 5.5 행 삭제 | AC4 UT(`claude-haiku-5-5` → `medium`) |
| M2 | `model-effort.ts` 별칭 맵 | `haiku: {4,5}` | AC4 UT(`haiku` → `medium`) · smoke B |
| M3 | `claude-context-policy.ts` | haiku 분기 삭제 | AC5 UT |
| M4 | `package.json` | `0.3.286` 유지 | smoke B · 식별 테스트 |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 이름 파서는 `parseClaudeModelName` 하나(0246 D-009) — effort·1M 분류가 함께 쓴다.
- `실패 의미`에 "다른 게이트가 막는다": 해당 없음.
- 선택적 필드: 해당 없음.
- 외부 SDK 경계의 실제 요구 타입/의미: `options.effort` 는 `EffortLevel` 그대로 · `options.model` 은 `[1m]` 포함 문자열을 CLI가 해석(probe).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/package.json` · `app/package-lock.json` | pin | `npm install @anthropic-ai/claude-agent-sdk@0.3.296 --save-exact` | `npm ls` |
| `app/src/main/adapters/claude.background.test.ts` | 식별 | `0.3.296` · `2.1.296` | UT |
| `app/src/shared/model-effort.ts` | 표 | EP-03 3자리 | `model-effort.test.ts` |
| `app/src/shared/model-effort.test.ts` | AC4 | `medium` 목록에 Haiku 5.5 형태 6개 · `haiku`·`HAIKU` 이동 · `high` 목록의 `claude-haiku-4-5` 유지 | UT |
| `app/src/main/adapters/claude-context-policy.ts` | 1M | EP-04 | UT |
| `app/src/main/adapters/claude-context-policy.test.ts` | AC5 | AC1 표 3행 · AC2 표 3행 추가 | UT |
| `app/src/shared/permission-mode.test.ts` | AC8 | 양성 2행 | UT |
| `app/src/renderer/src/features/chat/store/chatStore.effort.test.ts`(0246 AC6 store IT) | AC7 | `haiku` 선택 → payload `medium` | IT |
| `app/scripts/smoke-effort-sdk.mjs` | smoke | 그룹 D에 D2 사례 · 그룹 E 목록에 `gw-haiku-5.5[1m]` | smoke |
| `docs/arch/backend/adapters.md` | 문서 | `:48` 1M 목록에 "Haiku 5.5 이상" | AC11 |

### 테스트 가능성

- 별도 순수 파일: `model-effort.ts`·`claude-context-policy.ts` 는 이미 electron 비의존.
- 기존 메커니즘 재사용: smoke A/B 순회가 표·맵 데이터를 따라간다 — 새 행이 자동 사례가 된다.
- 순서 관측: 해당 없음.

## 12. End-to-end 영향

### producer → consumer

```text
model-effort table → defaultEffortForModel → SET_MODEL → payload.effort → spawn options.effort → CLI
classifyContextModel → modelForCli → spawn options.model → CLI betas
```

- producer 기준: 표·분류는 Anthropic API 해석 기준(D-002·D-004).
- consumer 파생 규칙: 도넛 분모는 SDK 보고값 우선(`contextWindow.ts:27-35`) — Haiku 5.5는 1M을 보고한다(probe).
- 파생 가능한 합성값이 정본을 우회하지 않는가: 해당 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `resolveTitleModel`(`models.ts:56-59`) | 별칭 `haiku` → Haiku 5.5 | D-006 · AC9 |
| 기존 대화 재개(이전 Haiku 4.5 세션) | 새 턴은 별칭 해석으로 5.5 — 같은 세션 안 모델 전환은 CLI 소관 | AC12 |
| 백그라운드·컨텍스트 smoke | 번들 CLI 변경 | AC9 smoke |

## 13. Lifecycle / 오류 / 정리

- 생성/시작·취소·종료: 변화 없음(어댑터 코드 무변경).
- retry/timeout/partial failure: 설치 중 플랫폼 패키지 실패 시 `npm ci` 가 실패한다 — lock 재생성 후 재시도.
- **다중 저장소 쓰기**: `package.json` + `package-lock.json` 은 한 npm 명령이 쓴다 — 둘 중 하나만 커밋하지 않는다(EP-01). 문서 산출 사본은 이 plan과 `INDEX.md`.

## 14. 성능 / 상한 / 최적화

- 번들 크기: CLI 바이너리 교체(win32-x64 ≈ 260MB, 설계 턴 scratch 관측) — 설치본 크기 변화는 빌드 산출에서 확인(AC10).
- 요청 수: 변화 없음.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 외부/배포가 구현할 port: 없음. 배포 settings의 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 은 그대로 동작한다(정식 ID면 표·분류가 이름으로 판정).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0246 D-002 기본값 = Claude Code 내장값 | 0246 plan | D-003 | 유지 — 데이터 추가 |
| 0246 D-005 별칭 = 번들 CLI Anthropic API 해석 | 0246 plan | D-002 | 유지 — 값 갱신 |
| 0246 D-012 smoke로 표 드리프트 감시 | 0246 plan | EP-05 | 유지 — 사례 추가 |
| 0245 D-008 1M 모델 + 비직결 → `[1m]` | 0245 plan | D-004 | 유지 — Haiku 5.5 편입 |
| 0215 자동 권한: 별칭은 증거 아님 | `model-identity.ts:81-83` | D-005 | 유지 |
| 의존성 정책: 채택 패키지 버전 갱신 | `app/AGENTS.md §의존성 정책` | D-001 | 유지 — 신규 패키지 아님, 사용자 요청 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 0.3.287~0.3.296 사이 CLI 동작 변화(백그라운드 명령 제한 범위·SDK 시작 시 MCP 대기 제거 등) | smoke background·context-usage + vitest 기준선 대조(AC9) |
| 3P에서 `native_1m_3p` 소멸 — Orca의 3P 규칙과 CLI가 어긋날 수 있다 | 규칙 유지 + NEXT_HANDOFF 후보(§6) |
| 제목 생성이 adaptive thinking 모델로 바뀜 | D-006 수용, AC12 실기에서 체감 확인 |

- 되돌리기 어려운 결정: 없음(pin은 되돌릴 수 있다).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/package.json` · `app/package-lock.json`
- `app/src/shared/{model-effort.ts,model-effort.test.ts,permission-mode.test.ts}`
- `app/src/main/adapters/{claude-context-policy.ts,claude-context-policy.test.ts,claude.background.test.ts}`
- `app/src/renderer/src/features/chat/store/chatStore.effort.test.ts`
- `app/scripts/smoke-effort-sdk.mjs`
- `docs/arch/backend/adapters.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- ABI/네트워크 등 환경 제약: `npm ci` 는 postinstall로 Electron ABI를 맞춘다. vitest 전체는 DB 스위트를 포함하므로 Node ABI가 필요하다 — `npm test` 대신 `./node_modules/.bin/vitest run` 을 쓰고 DB 로드 실패는 ABI 서명으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A gate 표.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger가 0246·0245·0215 승계 결정을 출처와 함께 보존한다.
- [x] Part I만 읽어도 완료 상태가 이해된다.
- [x] "최신 버전"을 설계 턴의 npm `latest`(0.3.296)로 고정했다.
- [x] 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] AS-IS와 TO-BE가 같은 축으로 있다.
- [x] Delta 각 행이 파일·AC로 이어진다.
- [x] 사라지는 책임 없음.
- [x] 수치·외부 규약(CHANGELOG·카탈로그·probe)을 실측했다.
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다.
- [x] Baseline V, NEW node마다 REQUIRED pair.
- [x] 적대 증거는 하드코딩 데이터·pin pair만 선택했다.
- [x] 운영 gate(기준선 대조·smoke·build)가 열거됐다.
- [x] 사람 실기는 실 API(AC12)만.
- [x] "Haiku 5.5 행이 쓰인다"는 지우면(M1) red.
- [x] SSOT·강제 지점·seam이 있다.
- [x] 기존 소비처(제목 생성·smoke)를 확인했다.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: pin 0.3.296 · 표 Haiku 5.5 `medium` · 별칭 5.5 · 1M 분류 · smoke D2·E 사례 모두 Part II 그대로.
- 이견 / 현실성 문제: 없음. 타입 변화가 추가형이라는 설계 턴 판단대로 typecheck 0 오류.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·VP-08 | EP-01 SDK pin | 11 | 11/11 | `package.json:35` `0.3.296` · `grep -c '"version": "0.3.296"' package-lock.json` → 9(본체 + 플랫폼 8) · lock 루트 의존 1 · `npm ls` → `0.3.296` | — |
| VP-01 | EP-02 버전 literal | 3 | 3/3 | `claude.background.test.ts:54,62,63` → `2.1.296`·`0.3.296`·`2.1.296` | — |
| VP-02·VP-09 | EP-03 effort 표 | 3 | 3/3 | `model-effort.ts:16` 주석 · Haiku 5.5 행 · `haiku: {5,5}` | — |
| VP-03·VP-10 | EP-04 1M 분류 | 1 | 1/1 | `claude-context-policy.ts` haiku 분기 | — |
| VP-07 | EP-05 smoke 사례 | 2 | 2/2 | smoke D `Haiku 5.5 honors explicit effort` ok · E `gw-haiku-5.5[1m]` ok | — |
| VP-05 | EP-06 문서 | 2 | 2/2 | `rg "Haiku 5.5" docs/arch/backend/adapters.md` → `:48` · `rg 2.1.296 model-effort.ts` → `:16` | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음 — `rg -n "0\.3\.286\|2\.1\.286" app/src app/scripts` → `background.monitor.test.ts:1` 관측 주석 1(plan대로 유지).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `npm ls` 0.3.296 · 식별 테스트 green · smoke B haiku ok | M4 red |
| VP-02 | REQUIRED | SELF_PASS | smoke A 11행 ok · AC4 UT · AC7 store IT | M1·M2 red |
| VP-03 | REQUIRED | SELF_PASS | AC5 UT · smoke E ok | M3 red |
| VP-04 | REQUIRED | SELF_PASS | `permission-mode.test.ts` 양성 2 | not selected |
| VP-05 | REQUIRED | SELF_PASS | 기준선 대조 · build · `rg` | not selected |
| VP-06 | REQUIRED | SELF_BLOCKED | 실 API 사람 실기(AC12) | not selected |
| VP-07 | REQUIRED | SELF_PASS | smoke A·B·C·D·E 21/21 ok | M2·M4 red |
| VP-08 | REQUIRED | SELF_PASS | typecheck exit 0 · 식별 테스트 | not selected |
| VP-09 | REQUIRED | SELF_PASS | AC4 표 | M1·M2 red |
| VP-10 | REQUIRED | SELF_PASS | AC5 표 | M3 red |
| VP-11 | REQUIRED | SELF_PASS | AC8 표 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `model-effort.ts` Haiku 5.5 행 삭제 | M1 | 최초 | `model-effort` 6 failed | 잠김 |
| `CLAUDE_ALIAS_VERSION.haiku` 4.5 | M2 | 최초 | `model-effort`·`chatStore.effort` 4 failed | 잠김 |
| 1M 분류 haiku 분기 삭제 | M3 | 최초 | `claude-context-policy` 5 failed | 잠김 |
| SDK `0.3.286` 설치(`--no-save`) | M4 | 최초 | smoke B `haiku` ok:false · `claude.background` 1 failed | 잠김 — 이후 `npm ci` 로 0.3.296 복원 |

- **분모 검산**: `선택 증거 4 · 인용 변이 0 · 새 oracle 0 = 표 행 4`.
- **덮개 회귀**: 해당 없음 — 최초 라운드.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음 — 칩 값(`medium`)만 바뀐다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 해당 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `npm install`(설치·복원)이 better-sqlite3 를 Electron ABI 로 되돌린다 — DB 스위트는 `npm run pretest` 후 실행 | ⚠️ 보고만 — 환경 절차 | `[sqlite-abi] node: rebuilt` 후 전체 green |
| 2 | 0.3.287~0.3.296 CLI 변화(백그라운드 제한·SDK 시작 MCP 대기 등) | ✅ smoke background·context-usage exit 0 으로 확인 | smoke 로그 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체물 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체물 없음 | — |
| 재진입 | 해당 없음 — 대체물 없음 | — |
| 다른 무효화 축 | 해당 없음 — 대체물 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/package.json` · `app/package-lock.json` · `app/src/shared/{model-effort.ts,model-effort.test.ts,permission-mode.test.ts}` · `app/src/main/adapters/{claude-context-policy.ts,claude-context-policy.test.ts,claude.background.test.ts}` · `chatStore.effort.test.ts` · `app/scripts/smoke-effort-sdk.mjs` · `docs/arch/backend/adapters.md` |
| 실행 명령 | 기준선 `npm run pretest && vitest run`(0.3.286) · `npm install --save-exact …@0.3.296` · `npm run typecheck` · `npm run lint` · `vitest run` · smoke effort·background·context-usage · `electron-vite build` · 변이 4 |
| **관측한 게이트 산출** | 기준선 649파일: 648 pass·1 skip / 6599 pass·1 skip → 변경 후 648 pass·1 skip / 6614 pass·1 skip(신규 실패 0, +15 신규 케이스) · typecheck exit 0 · lint 0 error/1 warning(기존) · smoke effort 21/21 · background exit 0 · context-usage exit 0 · build ✓(`out/main/index.js` `require("@anthropic-ai/claude-agent-sdk")` 유지) |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1(VP-06 실기)` |
| 강제 지점 전수 | 6행 모두 N/N |
| **AC 자기보고**(`Criteria-Met`) | AC1 `npm ls`·식별 · AC2 smoke B · AC3 smoke A·D·D2 · AC4 UT · AC5 UT · AC6 smoke E · AC7 store IT · AC8 UT · AC9 기준선 대조·smoke · AC10 build · AC11 `rg` ✅ / AC12 실 API ⚠️ |
| **합계 검산** | `✅ 11 · ⚠️ 1 · ❌ 0 = 총 12` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(최초).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 없음.
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI 전환(설치 명령마다 Electron ABI).
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | 없음 (r1 verify — 등록 변이 4/4 red, 독립 축 red) | — | — | — | — |
