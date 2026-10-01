# Plan — 0245-context-policy-cli-parity

## 메타

| 항목 | 값 |
|---|---|
| slug | `0245-context-policy-cli-parity` |
| 작성자 | Claude Code |
| 일자 | 2026-09-30 |
| 매핑 | 이슈1(폐쇄망 LLM 입력 264k 초과) — 사용자 라이브 세션 · 근거 [study 8장](../../etc/study/claude/08-컨텍스트-한도와-파일-정책.md) |
| 상태 | IMPL_DONE (ΔV1 r1 · 기계 범위) |
| V mode | `Delta V` |
| 기준 V | `V1@64fbfb35` (공유 브랜치에서 확인) |
| 이번 V revision | `ΔV1` — 서버 정상 가정: Claude Code 와 같은 큰 파일 정책으로 범위 조정 |
| 유효 V | `V1 + ΔV1` (ΔV1 절의 대체 행 우선) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 폐쇄망(LiteLLM 게이트웨이, 264k 커스텀 모델)에서 큰 PNG를 Read 하거나 큰 파일을 읽으면 입력이 한도를 넘고, 넘은 뒤에는 모델을 바꾸는 것 말고 복구 방법이 없다.
- 완료 후 달라지는 것: 모델 종류(Claude 200k · Claude 1M · 미확인 · 미확인+1M)마다 **Claude Code CLI 와 같은 컨텍스트 정책**이 적용된다. 게이트웨이가 모델명을 바꿔도 같다.
  - CLI 가 게이트웨이에서 스스로 하지 못하는 부분만 Orca가 채운다.
- 성공을 사용자 관점에서 한 문장으로: 어떤 모델을 쓰든 파일·이미지 때문에 대화가 막히지 않고, 막히면 무엇 때문인지와 어떻게 이어갈지 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Litellm쪽은 해결할 수 없다 제외하라" | 라이브 세션 |
| 명시 요구 | "클로드 cli의 사례를 모방하고 싶다. 200k, 1000k 각 모델의 사례에서 대용량 파일, 이미지가 첨부, 그리고 참조되는 사례에서 각각 어떻게 대응하고 있는지 조사하라" | 라이브 세션 |
| 명시 요구 | "study 문서 남길 것 · 조사한 내용을 바탕으로 정책으로 구현할 것 · Plan 및 impl을 모두 진행하라 · 확인이 필요한 점은 묻도록" | 라이브 세션 |
| 명시 요구 | "디폴트 200k 정책은 클로드 모델이 아닐때이다. 클로드 모델의 경우 1m suffix가 있거나 기존 1m 모델로 출시된것은 1000k 정책으로 수행돼야 한다" | 라이브 세션 |
| 명시 요구 | "베드록, 버텍스 등의 클로드 클라우드가 내부 정책에 의해 게이트웨이를 타며 모델이름도 리네임이 되는 경우 … 'opus', '4.7', '4-7' 같은 형태로 모델이름과 버전을 추출할 수 있음. 요구사항: 클로드 코드 cli와 똑같은 정책을 가져가고 싶다. 200k, 1m, 미확인된 모델, 미확인된 모델이지만 1m 등." | 라이브 세션 |
| 명시 사실 | 컴포저로 첨부한 이미지는 폐쇄망 모델이 "알아본다. 다만 컨텍스트를 너무 많이 차지한다" · 초과 시 "에러 반환을 전달 받고 있고, 더 큰 사이즈의 모델로 바꾸지 않는 한 어떠한 대처를 할 수 없다" | 라이브 세션 |
| 추론 의도 | 초과 대응의 "CLI와 똑같은 정책" = Claude 경로는 CLI 자동 복구를 그대로 쓰고, CLI가 복구하지 못하는 커스텀 경로는 원인·조치를 안내한다(추론 — §4) | study 8.7·8.8 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | LiteLLM 쪽 수정(버전·오류 문구 훅)은 하지 않는다 — 고정 제약으로 본다 | "Litellm쪽은 해결할 수 없다 제외하라" | 사용자 턴 | ACTIVE | — |
| D-002 | 조사 결과를 study 문서로 남긴다 | "study 문서 남길 것" | 사용자 턴 | ACTIVE | — |
| D-003 | 설계·구현을 이번 세션에서 모두 한다 | "Plan 및 impl을 모두 진행하라" | 사용자 턴 | SUPERSEDED | D-020 |
| D-004 | 기본 정책은 200k 로 한다 | "디폴트 200k 정책으로 기준하도록" | 사용자 턴 | SUPERSEDED | D-005 |
| D-005 | 200k 기본 정책은 **Claude 가 아닌 모델**에 적용한다. Claude 모델은 `[1m]` 접미사가 있거나 1M 으로 출시된 모델이면 1M 정책, 아니면 200k 정책 | "디폴트 200k 정책은 클로드 모델이 아닐때이다. …1000k 정책으로 수행돼야 한다" | 사용자 턴 | ACTIVE | D-004 를 구체화 |
| D-006 | 정책은 **Claude Code CLI 2.1.267 과 같은 분류**를 따른다 — Claude 200k · Claude 1M · 미확인 모델 · 미확인 모델+`[1m]` | "클로드 코드 cli와 똑같은 정책을 가져가고 싶다. 200k, 1m, 미확인된 모델, 미확인된 모델이지만 1m 등" | 사용자 턴 | ACTIVE | — |
| D-007 | 게이트웨이가 바꾼 모델명에서 계열(opus·sonnet·haiku·fable·mythos)과 버전(`4.7`·`4-7` 등)을 뽑아 Claude 여부·1M 출시 여부를 판정한다 | "'opus', '4.7', '4-7' 같은 형태로 모델이름과 버전을 추출할 수 있음" | 사용자 턴 | ACTIVE | — |
| D-008 | 1M 인 Claude 모델명에 `[1m]` 이 없고, **CLI 가 스스로 1M 을 인정하지 못하는 연결**(게이트웨이 URL · 3P)이면 Orca 가 실행 모델 문자열에만 `[1m]` 을 붙인다 | CLI 는 `api.anthropic.com` 직결에서만 네이티브 1M 을 인정한다(study 8.2). CLI 는 `[1m]` 을 떼고 원래 이름을 보낸다 | D-005·D-006 의 구현 수단 — 설계자 | ACTIVE | — |
| D-009 | Claude 가 아닌 모델 세션에서 도구 결과의 이미지·PDF 는 경로·크기 안내문으로 바꿔 모델에 보낸다 | LiteLLM 이 커스텀 백엔드로 보낼 때 도구 결과 이미지를 base64 텍스트로 바꾼다(study 8.8) — 모델은 볼 수 없고 수십만 토큰이 된다. 안내형 UX 는 사용자에게 제시 후 이견 없음 | 설계자 제안 · 사용자 UX 확인 턴 | SUPERSEDED | D-015 |
| D-010 | Claude 가 아닌 모델 세션에서 컴포저 첨부 이미지는 Claude 표준 등급(긴 변 1568px · 시각 토큰 1568, 공식 `resizedSize`)으로 줄여 보내고, 원본 보관·표시는 그대로 둔다 | "컨텍스트를 너무 많이 차지한다" · 200k 정책의 이미지 등급이 표준이다 | 사용자 턴 + 설계자 | SUPERSEDED | D-016 |
| D-011 | 줄인 이미지에는 CLI 와 같은 형식의 `[Image: original …, displayed at …]` 메모를 모델용 텍스트에 붙이고, 별도 UI 표시는 두지 않는다 | CLI 와 같은 동작(`CBe`) | 설계자 | SUPERSEDED | D-016 |
| D-012 | 초과 오류는 전용 분류 `context_overflow` 로 표시하고 원문과 조치 안내를 보인다. 자동 요약 재시도·되돌려 이어가기는 이번 범위가 아니다 | Claude 경로는 CLI 가 이미 자동 복구한다. 커스텀 경로는 CLI 도 복구하지 못한다 — CLI 동등 수준은 안내다(추론) | 설계자 권고(2회 제시) + D-006 | SUPERSEDED | D-017 |
| D-013 | 자동 요약 창 기본값 env 주입(`CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000`)은 하지 않는다 | 미확인 모델은 CLI 가 이미 200k 로 요약한다. 1M 모델은 1M 전체를 써야 한다("1m의 컨텍스트를 모두 사용할수있나?") | 사용자 질문 → 설계자 철회 | ACTIVE | — |
| D-014 | 텍스트 Read 상한은 CLI 기본값(256KB · 25,000토큰)을 유지한다 | 200k·1M 모두 CLI 기본과 같게 | D-006 | ACTIVE | — |
| D-015 | 도구 결과(Read·MCP·노트북)의 이미지·PDF 는 Orca 가 바꾸지 않는다 — CLI 동작 그대로 | "해당 문제는 서버사이드 이슈로 남겨두고, orca는 서버가 정상이라는 가정하에 큰 파일에 대한 정책을 claude 와 똑같이 가져가는 형태로 만 손대려고 한다" | 사용자 턴 (ΔV1) | ACTIVE | D-009 대체 |
| D-016 | 대화창 첨부 이미지는 Orca 가 줄이거나 메모를 붙이지 않는다 — CLI 가 SDK 입력 이미지에 자체 정책(긴 변 2000px · 512,000바이트 · 축소 메모)을 적용한다 | 같은 사용자 문장 · CLI 입력 처리 확인(study 8.5) | 사용자 턴 + 설계자 확인 (ΔV1) | ACTIVE | D-010·D-011 대체 |
| D-017 | 결과 오류는 SDK 원문(`result`·`errors`)을 그대로 표시한다. 새 분류·안내 문구는 두지 않는다 | "Claude code와 같게 맞추는 방향으로 plan 수정하라" — CLI 는 원문을 보이고 분류 라벨이 없다 | 사용자 턴 (ΔV1) | ACTIVE | D-012 대체 |
| D-018 | 대화창 텍스트 첨부는 Claude Code `@파일` 첨부와 같게 처리한다 — Orca 는 내용을 넣지 않고 저장 경로를 `@"경로"` 로 넘겨 CLI 가 처리하게 한다. 24,000자 자르기는 없앤다 | "Claude code와 같게 맞추는 방향으로 plan 수정하라" · Claude Code 는 버리지 않고 Read 로 이어 읽게 안내한다. CLI 에 넘겨야만 CLI 버전이 바뀌어도 같다 | 사용자 턴 + 설계자(방식) (ΔV1) | ACTIVE | — |
| D-019 | 1M 판정은 CLI 가 실제로 실행할 모델로 한다 — Orca 모델이 별칭이면 `ANTHROPIC_DEFAULT_<별칭>_MODEL`, 없으면 `ANTHROPIC_MODEL` → settings `model` 값으로 판정 | 700K 사례 분석에서 찾은 빈틈 — V1 은 Orca 문자열만 봤다 · D-006 | 설계자 (ΔV1) | ACTIVE | D-008 보완 |
| D-020 | 이 세션은 설계까지만 한다. 구현은 다른 모델이 한다 | "Handoff-plan 까지만 완료하라. Handoff-impl은 모델을 변경할 예정이다" | 사용자 턴 | ACTIVE | D-003 대체 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014 (신규 handoff).
- 변경된 결정: D-004 → D-005 ("디폴트 200k"의 적용 대상을 사용자가 비-Claude 로 좁혔다).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001·D-009·D-012.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-005 ↔ AC1·AC2 · D-006 ↔ AC1 · D-007 ↔ AC1 · D-008 ↔ AC2·AC3 · D-009 ↔ AC4·AC5 · D-010 ↔ AC6~AC9 · D-011 ↔ AC9 · D-012 ↔ AC10~AC13 · D-013 ↔ AC3(환경변수를 건드리지 않음) · D-014 ↔ AC 없음(변경 없음).
- ΔV1(구현 전 사용자 결정 변경): D-003·D-009·D-010·D-011·D-012 → SUPERSEDED, D-015~D-020 신설. 유효 범위와 AC 는 아래 ΔV1 절이 정한다.
- r1 구현 중 정정(AC6 예시 값): `(2000,1500)→(1269,952)` 는 `Math.round` 로 계산한 값이었다. 공식 참조 구현(Python `round` = half-to-even)은 `(1270,952)` — 1270/1.333=952.5 → 952. 동작 기준("공식 참조 구현과 같다")은 그대로다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 원인은 ① 도구 결과 이미지의 텍스트 변환(커스텀 경로) ② 초과 문구 불일치로 자동 복구 불발 ③ 게이트웨이에서 1M 미인정 | study 8.2·8.7·8.8 |
| 이미 기존 코드가 충족하는가 | 아니오 — 첨부 이미지는 원본 base64 그대로, 결과 오류 원문은 `Claude result failed (success)` 로 가려진다 | `app/src/main/adapters/claude.ts:792-830` · `claude-map.ts:806-817` |
| 더 작은 해법이 있는가 | 자동 요약 env 주입만으로는 이미지 한 장(최대 수십만 토큰)을 막지 못한다 · 1M 은 창이 아니라 모델 인정 문제다 | study 8.3·8.8 |
| 선행 자료의 주장을 코드와 대조했는가 | 이전 대화의 "1M 은 Opus·Sonnet 4.6 이상" 은 틀렸다 — 네이티브 1M 은 Opus 4.7+·Sonnet 5·Fable·Mythos | CLI 카탈로그 추출(study 8.2) |
| ACTIVE 결정과 충돌하는가 | D-001 을 지킨다 — 모든 수단이 Orca·CLI 설정 안에 있다 | §9 |

- 사용자에게 올릴 결정: 없음 — 적용 범위·1M·초과 대응을 세 차례 질의했고 D-005~D-008·D-012·D-013 으로 닫았다.
- 코드 조사로 닫은 사실: LiteLLM 은 이름에 `claude` 가 있는 Bedrock·Anthropic·Vertex 모델을 원형 전달한다(1.76·1.80·1.103.1) → Claude 경로는 도구 결과 이미지·초과 문구가 보존된다. CLI 는 요청 모델 ID 에서 `[1m]` 을 뗀다(`pR` → `er`).

## 5. 동작 / 사용자 흐름

```text
[턴 시작 — 모델 M]
  → Orca: M 분류 (Claude 200k / Claude 1M / 미확인 / 미확인+[1m])
  → Claude 1M + [1m] 없음 + 직결 아님 → CLI 에 M[1m] 전달 (게이트웨이에는 M 그대로)
  → Claude 가 아닌 모델이면: 첨부 이미지 표준 등급 축소 · 도구 결과 이미지/PDF 안내문 교체
  → CLI 가 모델 창·요약·요청당 미디어를 자체 정책으로 적용
  ↘ 입력 초과 오류 → '컨텍스트 한도 초과' 배너 + 원문 + 조치 안내
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 커스텀 모델이 PNG 를 Read | 결과를 안내문 텍스트로 교체 | Read 카드에 안내문 · 모델이 "첨부해 달라"고 요청 · 초과 없음 |
| 커스텀 모델 세션에 4000×3000 이미지 첨부 | 모델 전달분만 표준 등급으로 축소 + 메모 | 첨부 칩·트랜스크립트는 원본 · 모델이 이미지를 인식 · 장당 토큰 감소 |
| 이름이 바뀐 Opus 4.7(`gw-opus-4.7`) 선택 · 게이트웨이 | CLI 에 `gw-opus-4.7[1m]` | 컨텍스트 도넛 분모 1M · 200k 넘어도 계속 |
| Claude 200k 모델 | 변화 없음 | CLI 기본 동작 |
| 대화 중 모델 전환(Claude ↔ 커스텀) | 다음 요청부터 새 모델 분류 적용 | 전환 후 첨부·Read 가 새 정책을 따른다 |
| 입력 초과 오류(모든 모델) | `context_overflow` 분류 · 재시도 가능 표시 없음 | 배너 "컨텍스트 한도 초과" + 오류 원문 + 조치 안내 |

### 파생 UX / 엣지케이스

- error: 초과가 아닌 API 오류도 결과 원문이 보인다(지금은 `Claude result failed (success)`).
- 폐쇄망: 게이트웨이·Bedrock 이 네이티브 1M 모델의 1M beta 헤더를 받는지는 실환경 확인 대상(AC18).
- 축소 실패(코덱 미지원 GIF·WebP · 회전 정보 JPEG · 디코드 실패): 원본 그대로 보내고 전송은 실패하지 않는다.

## 6. 범위 / 비범위

- **범위**: 모델 분류 SSOT · `[1m]` 실행 문자열 정규화 · 커스텀 세션 도구 결과 미디어 교체 · 커스텀 세션 첨부 이미지 표준 등급 축소 · 초과 오류 분류·표시 · 결과 오류 원문 표시 · study 문서 · 계약 문서(IPC_CONTRACT §4·provider-runtime §6·adapters·폐쇄망 가이드).
- **비범위**: LiteLLM 변경(D-001) · 자동 요약 재시도 · 되돌려 이어가기(D-012) · 자동 요약 env 주입(D-013) · 텍스트 Read 상한 변경(D-014) · API 오류 assistant 말풍선 표시 방식 · 제목 생성 1회 호출(`complete`)의 모델 정규화(짧은 프롬프트라 1M 불필요).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 초과 후 되돌려 이어가기(`resumeSessionAt`) | 아니오 — 분류 `context_overflow` 가 진입점이 된다 | 후속 handoff 후보 |
| 커스텀 경로 자동 요약 재시도 | 아니오 | 후속 handoff 후보 |
| 오류 분류 값 `context_overflow` 신설 | **예 — 공개 계약·저장 형식(오류 파트 JSON)** | 지금 확정(D-012). 추가형이라 구버전 렌더러도 원문 분류명으로 표시(`ErrorCard` fallback) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 모델명 → 분류가 CLI 카탈로그와 같다. 이름이 바뀌어도 계열·버전으로 판정한다 | 표 테스트 17행 이상: `claude-opus-4-7`·`us.anthropic.claude-opus-4-7-v1:0`·`gw-opus-4.7`·`opus_4-8`·`sonnet-5`·`claude-fable-5-1`·`mythos-5` → Claude 1M / `claude-opus-4-6`·`claude-sonnet-4-5-20250929`·`claude-haiku-4-5`·`claude-3-5-sonnet`·`opus`·`claude-opus-4-20250514` → Claude 200k / `claude-opus-4-6[1m]` → Claude 1M / `my-vlm` → 미확인 / `my-vlm[1m]` → 미확인+1M | `claude.ts` `sendMessage` → `classifyContextModel` |
| R-02 | AT-02 / AC2 | 실행 모델 문자열 규칙: Claude 1M·접미사 없음·직결 아님이면 `[1m]` 부착, 그 밖은 원문 | 표 테스트: 게이트웨이 URL+`gw-opus-4.7`→`gw-opus-4.7[1m]` / 직결(URL 없음·`api.anthropic.com`)+`claude-opus-4-7`→원문 / 게이트웨이+`claude-opus-4-6`→원문 / 이미 `[1m]`→원문 / 커스텀→원문 / `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`→원문 / Bedrock 플래그+`claude-opus-4-7`→부착 / Bedrock 플래그+`claude-sonnet-5`→원문 | `modelForCli` |
| R-02 | AT-03 / AC3 | 어댑터가 실행 모델을 넘기는 **세 자리** 모두 정규화 문자열을 쓰고, env 는 바꾸지 않는다 | query mock: `options.model` · `pushTurn` 의 `setModel` 인자 · `LiveTurn.setModel` 인자 = `…[1m]` · `options.env` 불변 | `sendMessage` → `query()` · `pushTurn` · `setModel` |
| R-03 | AT-04 / AC4 | 도구 결과 교체 규칙: Read `image`·`pdf`·`parts` → Read `text` 출력(안내문), `notebook` → 이미지 출력만 제거·자리표시 텍스트, MCP 배열 → `image`·`document` 블록만 텍스트로, 그 외 → 교체 없음 | 순수 테스트 8케이스 이상 · 교체 결과를 SDK `FileReadOutput` 타입에 대입(typecheck) · 안내문에 경로·MIME·크기 포함 | `guardToolResultMedia` |
| R-03 | AT-05 / AC5 | 교체 훅은 **커스텀 모델 세션에서만** `updatedToolOutput` 을 낸다. 세션 중 모델을 바꾸면 다음 호출부터 새 분류를 따른다 | query mock: `options.hooks.PostToolUse` 콜백에 Read image 입력 → 커스텀이면 `hookSpecificOutput.updatedToolOutput`, Claude 면 `{}` · `setModel(커스텀)` 뒤 같은 입력 → 교체 | `sendMessage` hooks → CLI PostToolUse |
| R-04 | AT-06 / AC6 | 표준 등급 축소 크기가 공식 참조 구현과 같다 | 문서 예시 (1075,1520)→(924,1307) + 참조 구현(Python 원문) 계산값: (1920,1080)→(1456,819) · (2000,1500)→(1270,952) · (3840,2160)→(1456,819) · (1080,1920)→(819,1456) · (1092,1092)·(200,200) 불변 | `resizedSize` |
| R-04 | AT-07 / AC7 | PNG·JPEG 헤더에서 크기를, JPEG EXIF 에서 회전 값을 읽는다 | 합성 바이트 fixture: PNG IHDR · JPEG SOF0/SOF2 · EXIF orientation 6 · 잘린 버퍼는 `undefined` | `readImageInfo` |
| R-04 | AT-08 / AC8 | 첨부 정규화는 표준 등급을 넘는 PNG·JPEG(회전 없음)에만 축소본을 만든다. 원본 data·보관 파일·view 는 그대로다. 코덱이 `null`·예외면 축소본 없이 계속한다 | 가짜 코덱: 큰 PNG → 축소본(크기·코덱 출력) / 작은 PNG·GIF·회전 JPEG → 없음 / 코덱 throw → 없음·정규화 성공 · 원본 `data` 불변 | `send.ts` → `normalizeAttachments(…, { imageCodec })` |
| R-04 | AT-09 / AC9 | 커스텀 세션의 모델 입력은 축소본 이미지와 CLI 형식 메모를 쓰고, Claude 세션은 원본과 메모 없음을 쓴다 — 첫 입력·프렐류드·steer·`pushTurn` 네 경로 모두 | `buildTurnContent` 테스트(두 등급) + query mock: 첫 입력 이미지 data = 축소본 · `pushTurn` content 도 축소본 | `batchContent`·`buildTurnContent` |
| R-05 | AT-10 / AC10 | 초과 문구 판정: LiteLLM `ContextWindowExceededError` · `maximum context length` · `prompt is too long` · `input is too long for requested model` · `context_length_exceeded` · `exceeds the available context size` · CLI `Conversation too long` · `Autocompact is thrashing` → 참. `Too many tokens, please wait` · rate limit · 401 · overloaded · 빈 문자열 → 거짓 | 순수 표 테스트 | `isContextOverflowMessage` |
| R-05 | AT-11 / AC11 | 결과 메시지 오류는 원문을 message 로 쓴다(`is_error`+`success` → `result`, 오류 subtype → `errors`) · 초과 문구면 `context_overflow`(retryable false), 아니면 `stream_error` | `claudeToNormalized` 테스트 3케이스 + 기존 `error_max_turns`·`message` 케이스 유지 | `claude-map.ts` result 분기 |
| R-05 | AT-12 / AC12 | 던져진 예외도 초과 문구면 `context_overflow` · 취소·인증 분류는 그대로 | `claudeErrorClassifier` 테스트 | `claude.ts` catch · `classifyError` |
| R-05 | AT-13 / AC13 | 배너·오류 카드는 `context_overflow` 를 "컨텍스트 한도 초과"로 표시하고 조치 안내를 붙인다. "재시도 가능" 안내는 붙지 않는다 | 순수 `errorHintKey` 테스트 + ko/en 키 존재(typecheck) | `TurnErrorBanner` · `ErrorCard` |
| R-06 | AT-14 / AC14 | 첨부 축소 코덱이 부팅 조립에서 채팅 경로까지 실제로 전달된다 | 소스 스캔: `bootstrap.ts` 의 `registerChatHandlers({…})` 에 `imageCodec`, `send.ts` 의 `normalizeAttachments(` 인자에 `imageCodec` — 지우면 red | `bootstrap.ts` → `ChatDeps.imageCodec` → `send.ts` |
| R-06 | AT-15 / AC15 | study 문서·계약 문서가 새 정책과 분류를 서술하고 링크가 해석된다 | `check-doc-inventory.mjs --check` · IPC_CONTRACT §4 표에 `context_overflow` 행 | 문서 |
| R-03 | AT-16 / AC16 | (실기) 폐쇄망 커스텀 모델로 큰 PNG Read → 안내문 · 초과 없음 | 사람 실기 | 설치본 |
| R-04 | AT-17 / AC17 | (실기) 커스텀 모델 세션에 큰 스크린샷 첨부 → 인식되고 장당 입력 토큰이 줄어든다(사용량 패널 전후 차) | 사람 실기 — electron `nativeImage` 는 vitest 에서 못 띄운다 | 설치본 |
| R-02 | AT-18 / AC18 | (실기) 게이트웨이 뒤 이름 바뀐 네이티브 1M 모델 → 도넛 분모 1M · 200k 넘는 대화가 이어진다 | 사람 실기 — 게이트웨이가 1M beta 헤더를 받는지 확인 | 설치본 |
| R-05 | AT-19 / AC19 | (실기) 커스텀 모델 초과 → 배너 "컨텍스트 한도 초과" + 원문 + 안내 | 사람 실기 | 설치본 |

### AC 검증 주의사항

- 기존 테스트 재사용: `claude-map.test.ts` "result 에러는 telemetry 와 error 이벤트를 함께 낸다"(`error_max_turns` + `message`) 유지 · `build-turn-content.test.ts` 기존 케이스는 기본 등급 경로로 유지 · `attachments.test.ts` 기존 케이스 유지.
- 사람 실기 항목: AC16~AC19 — 실제 게이트웨이·백엔드·electron 코덱이 필요하다. 판정 로직은 AC1~AC13 가 순수하게 잠근다.
- N회/총량 기준: AC3 "세 자리" = `rg -n "setModel\(|model \? \{ model \}" app/src/main/adapters/claude.ts` 로 센 실행 모델 전달 지점 전수(§8).
- 0건 기준: AC10 음성 케이스는 throttling 문구(`Too many tokens`)를 반드시 포함한다 — LiteLLM Bedrock 매핑이 이 문구를 초과로 보기 때문이다(`exception_mapping_utils.py` Bedrock 분기).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01..R-06 | R | §7 | NEW | — |
| AT-01..AT-19 | AT | §7 | NEW | — |
| SD-01 | SD | §5 세션 수명 동안 정책 = 현재 모델 분류(전환 반영) | NEW | — |
| ST-01 | ST | AC5·AC9 의 모델 전환 시퀀스 | NEW | — |
| AR-01 | AR | §10 EP-02 실행 모델 전달 3자리 | NEW | — |
| AR-02 | AR | §10 EP-03 교체 훅 배선·활성 조건 | NEW | — |
| AR-03 | AR | §10 EP-05 축소본 생산·주입 배선 | NEW | — |
| AR-04 | AR | §10 EP-04 모델 입력 등급 선택 4경로 | NEW | — |
| AR-05 | AR | §10 EP-06 초과 분류 2자리 | NEW | — |
| AR-06 | AR | §10 EP-07 표시 2자리 | NEW | — |
| IT-01..IT-06 | IT | AC3·AC5·AC8+AC14·AC9·AC11+AC12·AC13 | NEW | — |
| MD-01 | MD | `classifyContextModel` | NEW | — |
| MD-02 | MD | `modelForCli` | NEW | — |
| MD-03 | MD | `guardToolResultMedia` | NEW | — |
| MD-04 | MD | `resizedSize` · `readImageInfo` | NEW | — |
| MD-05 | MD | `isContextOverflowMessage` | NEW | — |
| UT-01..UT-05 | UT | AC1·AC2·AC4·AC6+AC7·AC10 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | 모델 문자열 → 분류 | AC1 표 | not selected — 직접 표 | EP-01 (2) |
| VP-02 | MD-02 ↔ UT-02 | REQUIRED | 분류 + env 조회 → 실행 문자열 | AC2 표 | not selected — 직접 표 | EP-01 (2) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | `sendMessage` → `options.model` / `pushTurn` → `handle.setModel` / `LiveTurn.setModel` → `handle.setModel` | AC3 세 인자 | **required** — 자리 3개 각각에서 정규화를 원문 전달로 되돌리는 변이 → 해당 단언 red | EP-02 (3) |
| VP-04 | MD-03 ↔ UT-03 | REQUIRED | 도구 결과 → 교체 결과 | AC4 | not selected — 직접 결과 | EP-03 (1) |
| VP-05 | AR-02 ↔ IT-02 | REQUIRED | `sendMessage` hooks → PostToolUse 콜백 → 활성 판정 → `updatedToolOutput` | AC5 | **required** — ① 항상 활성 ② 항상 비활성 ③ 전환 미반영(스폰 시 값 고정) 변이 → red | EP-03 (2) |
| VP-06 | MD-04 ↔ UT-04 | REQUIRED | 바이트 → 정보 → 축소 크기 | AC6·AC7 | not selected — 공식 예시 직접 대조 | EP-05 (1) |
| VP-07 | AR-03 ↔ IT-03 | REQUIRED | `bootstrap` → `ChatDeps.imageCodec` → `send.ts` → `normalizeAttachments` → 축소본 | AC8 행동 · AC14 배선 | **required** — AC14 는 구조 proxy: 두 자리에서 `imageCodec` 전달 삭제 → red | EP-05 (3) |
| VP-08 | AR-04 ↔ IT-04 | REQUIRED | 정책 → 첫 입력·프렐류드·steer·`pushTurn` content | AC9 | **required** — 등급 인자를 한 경로에서 고정값으로 바꾸는 변이(첫 입력·`pushTurn`) → red | EP-04 (4) |
| VP-09 | MD-05 ↔ UT-05 | REQUIRED | 문구 → 판정 | AC10 참·거짓 표 | not selected — 음성 케이스 포함 직접 표 | EP-06 (1) |
| VP-10 | AR-05 ↔ IT-05 | REQUIRED | SDK result → `claudeToNormalized` → error 이벤트 / 예외 → `classify` | AC11·AC12 | **required** — 자리 2개 각각에서 판정 제거 → red | EP-06 (2) |
| VP-11 | AR-06 ↔ IT-06 | REQUIRED | `ClassifiedError.category` → 라벨·안내 키 → 배너·카드 | AC13 | not selected — 직접 키 단언 | EP-07 (2) |
| VP-12 | SD-01 ↔ ST-01 | REQUIRED | 스폰(Claude) → `setModel(커스텀)` → 훅·등급 전환 | AC5·AC9 전환 케이스 | VP-05 ③ 변이 공유 | EP-03 (2) · EP-04 (1) |
| VP-13 | R-01..R-05 ↔ AT-16..AT-19 | REQUIRED | 설치본 → 게이트웨이 → 백엔드 | 사람 실기 관측 | not selected — 실환경 직접 관측 | 0 — 실기(순수 판정은 VP-01~VP-11) |
| VP-14 | R-06 ↔ AT-15 | REQUIRED | 문서 → 인벤토리 검사 | `check-doc-inventory --check` exit 0 · 표 행 존재 | not selected | 0 — 문서 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| 관련 vitest | 수정 모듈 테스트 | `./node_modules/.bin/vitest run src/main/adapters src/main/features/chat src/main/app src/renderer/src/features/chat` | 동일 · DB 로드 스위트 ABI 실패는 환경 기인으로 분리 |
| 문서 인벤토리 | `docs/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 동일 |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 실행 모델은 `options.model`(스폰) · `handle.setModel`(`pushTurn`·`LiveTurn.setModel`) 세 자리로 CLI 에 간다 | `app/src/main/adapters/claude.ts:581` · `:769` · `:803` 부근 |
| 모델 입력 content 는 `buildTurnContent` 한 함수가 만든다 — 첫 입력·프렐류드·steer(`batchContent`)·`pushTurn` | `claude.ts:403-425` · `:753-760` · `:792` |
| PostToolUse `updatedToolOutput` 은 출력 스키마를 통과해야 적용되고, Read `text` 는 이미지로 복원되지 않는다 | CLI 2.1.267 `Zmn`(parts·pdf 끼리만 복원) · study 8.6 |
| MCP 도구 결과는 Anthropic 블록 배열(`image` = `{type,source}`) | CLI 2.1.267 MCP 변환 `Ln` |
| 노트북 셀 출력 이미지 = `outputs[].image = {image_data, media_type}` | CLI 2.1.267 `ako`·`iko` |
| 첨부 이미지는 원본 base64 로 모델에 가고, 보관 경로가 프롬프트 블록에 실린다 | `claude.ts:802-830` · `features/chat/attachments.ts:124-131` |
| 결과 오류 message 는 `r.message`·`r.error` 만 읽는다 — SDK 는 `result`·`errors` 에 싣는다 | `claude-map.ts:806-817` · `sdk.d.ts` `SDKResultSuccess.result` · `SDKResultError.errors` |
| `stream_error` 기본 retryable true → 초과에도 "다시 보내보세요" 가 붙는다 | `infra/errors.ts:32-41` · `Exchange.tsx:97-106` |
| `settings.json` env 는 `options.env` 를 만들 때만 hoist 된다 — 아니면 settings 채널 | `adapters/harness-config.ts:360-395` |
| 테스트는 electron 을 import 할 수 없다 — 채팅 테스트 3개는 electron mock 이 없다 | `app/src/main/AGENTS.md` P29 · `chat-turn.continuity.test.ts` 등 |
| Orca 의 Claude 계열 목록 SSOT | `app/src/shared/model-identity.ts:38` (`sonnet`·`opus`·`haiku`·`fable`) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 실행 모델 전달 지점 | `rg -n "setModel\(|model \? \{ model \}" app/src/main/adapters/claude.ts` | 3 | 스폰 1 · `pushTurn` 1 · `LiveTurn.setModel` 1 (`runCompletion` 은 비범위 §6) |
| `buildTurnContent` 호출 | `rg -n "buildTurnContent\(" app/src/main/adapters/claude.ts` | 3 | `batchContent`(프렐류드·steer) · 첫 입력 · `pushTurn` |
| `normalizeAttachments` 호출 | `rg -n "normalizeAttachments\(" app/src/main --glob '!*.test.ts'` | 1 | `app/chat-turn/send.ts:96` |
| `ErrorCategory` 전수 소비 | `rg -n "ErrorCategory" app/src --glob '!*.test.ts'` | 4 | `shared/ipc.ts` 정의 · `infra/errors.ts` 기본값 · `errorLabels.ts` 라벨 · `protocol.ts` 재노출 |
| 오류 표시 컴포넌트 | `rg -n "errorCategoryKey" app/src/renderer` | 3 | `Exchange.tsx`(배너) · `ErrorCard.tsx` · `PendingAssistant.tsx`(재시도 라벨) |

### 수치 / 전칭 표현 검산

- CLI 수치(1568·2000·512,000·100/600·167k/967k)는 study 8장 출처 표기로만 쓰고 코드 상수는 공식 문서 값(1568/1568)만 둔다.
- "원형 전달" 전칭: LiteLLM `get_bedrock_provider_config_for_messages_api` 반례 — `bedrock/converse/…` 명시 경로는 변환 경로다(study 8.8 에 명시).
- 기존 테스트 케이스 존재 확인: `claude-map.test.ts:809` · `build-turn-content.test.ts` · `attachments.test.ts` 열람.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `AR-01`~`AR-05`
- 현재 책임 소유자: 모델 문자열은 `resolve-turn` 이 고른 식별자를 그대로 CLI 에 넘긴다 · 도구 결과는 손대지 않는다 · 첨부 이미지는 원본.
- 현재 flow: 커스텀 모델 Read(PNG) → CLI 이미지 블록 → LiteLLM 텍스트 변환 → 수십만 토큰 → 400 → CLI 문구 불일치 → `stream_error "Claude result failed (success)"`.
- 게이트웨이 1M: `gw-opus-4.7` → CLI 미확인 모델 200k → 167k 에서 요약(1M 의 17%).

```text
resolve-turn(model) ─▶ claude.ts options.model=model ─▶ CLI(200k/미인정) ─▶ LiteLLM ─▶ backend
attachments(원본 b64) ─▶ buildTurnContent(원본)
tool_result(image) ──────────────────────────────▶ LiteLLM(text 변환) ─▶ 초과 ─▶ stream_error
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-06`
- 변경 후 책임 소유자: `adapters/claude-context-policy.ts` 가 분류·실행 문자열을 정한다 · `claude.ts` 가 세션 정책 참조(`policy.current`)를 들고 세 자리·훅·content 에 적용한다.
- 변경 후 flow: 커스텀 Read(PNG) → PostToolUse 교체 → 안내문 텍스트 · 커스텀 첨부 → 축소본 · 초과 → `context_overflow`.
- 유지: env 조립(`harness-config`) · CLI 자체 창/요약/미디어 정책 · 텍스트 Read 상한.

```text
resolve-turn(model) ─▶ claude.ts: policy=contextPolicyFor(model, env) ─▶ options.model=policy.modelForCli
                        ├─ hooks.PostToolUse: guard(active = policy.custom)
                        └─ buildTurnContent(imageTier = policy.custom ? standard : original)
send.ts ─▶ normalizeAttachments(…, {imageCodec}) ─▶ image.standardTier(축소본)
CLI result/throw ─▶ isContextOverflowMessage ─▶ context_overflow ─▶ 배너 라벨+안내
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 모델 분류 없음 | `claude-context-policy.ts` SSOT | D-005~D-008 | MD-01·MD-02 / VP-01·VP-02 |
| data/control flow | 모델 문자열 원문 3자리 | 정규화 문자열 3자리 | D-008 | AR-01 / VP-03 |
| data/control flow | 도구 결과 무처리 | 커스텀 세션 교체 | D-009 | AR-02 / VP-05 |
| state/contract | `ExtractedAttachmentImage` 원본만 | `standardTier?` 축소본 추가 | D-010 | AR-03 / VP-07 |
| state/contract | `ErrorCategory` 8값 | `context_overflow` 추가 | D-012 | AR-05·AR-06 / VP-10·VP-11 |
| error/lifecycle | 결과 오류 원문 유실 | 원문 표시 | D-012 | AR-05 / VP-10 |
| lifecycle | — | 모델 전환 시 정책 갱신 | D-006 | SD-01 / VP-12 |
| test seam | 없음 | 순수 모듈 5 + query mock + 소스 스캔 | — | UT·IT |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/claude-context-policy.ts` (신규, 순수) | 분류 · 실행 문자열 · env 조회 | 모델, env → 정책 | `claude.ts` |
| `adapters/tool-result-media.ts` (신규, 순수) | 도구 결과 미디어 교체 | 도구명·입력·응답 → 교체 결과 | `claude-adapt.ts` 훅 |
| `adapters/context-overflow.ts` (신규, 순수) | 초과 문구 판정 SSOT | 문자열 → boolean | `claude-map.ts` · `error-classifier.ts` |
| `adapters/attachment-prompt.ts` | 축소 메모 문자열(CLI 형식) | 원본·표시 크기 → 문자열 | `claude.ts` |
| `features/chat/model-image.ts` (신규, 순수) | `resizedSize` · `readImageInfo` · 축소 계획 · 코덱 포트 타입 | 바이트 → 계획 | `attachments.ts` |
| `infra/image/native-image-codec.ts` (신규, electron) | PNG/JPEG 축소 | 바이트·크기 → 바이트/null | `bootstrap.ts` 주입 |
| renderer `errorLabels.ts` | 라벨·안내 키 | category → 키 | `Exchange.tsx` · `ErrorCard.tsx` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01·MD-02 / VP-01·VP-02 | EP-01 분류 SSOT 사용 자리: ① `modelForCli` ② 어댑터 정책(`custom` 판정) | `claude-context-policy.ts` | adapter | 스폰·모델 전환 | 두 판정이 갈라지면 1M 부착과 교체 대상이 어긋난다 |
| AR-01 / VP-03 | EP-02 실행 모델 전달 ① `options.model` ② `pushTurn` `setModel` ③ `LiveTurn.setModel` | `claude.ts` | adapter | 스폰·턴·전환 | 한 자리라도 원문이면 그 경로에서 1M 이 200k 로 떨어진다 |
| AR-02 / VP-05·VP-12 | EP-03 교체 활성 ① 콜백이 호출 시점에 `policy.current` 를 읽음 ② `pushTurn`·`setModel` 이 `policy.current` 갱신 | `claude.ts` · `claude-adapt.ts` | adapter | PostToolUse 마다 | 스폰 값 고정이면 전환 후 오동작 |
| AR-04 / VP-08·VP-12 | EP-04 등급 선택 ① 첫 입력 ② 프렐류드 ③ steer ④ `pushTurn` — 모두 `contentFor()` 한 함수 경유 | `claude.ts` | adapter | content 조립 | 경로별로 원본·축소본이 섞인다 |
| AR-03 / VP-07 | EP-05 축소본 ① `normalizeAttachments` 경로·인라인 첨부 공통 ② `send.ts` 가 `imageCodec` 전달 ③ `bootstrap.ts` 가 `imageCodec` 주입 | `attachments.ts` · `send.ts` · `bootstrap.ts` | main | 첨부 정규화(busy 판정 전) | 주입이 빠지면 조용히 원본 — AC14 구조 스캔이 막는다 |
| AR-05 / VP-10 | EP-06 초과 분류 ① `claude-map` result ② `claudeErrorClassifier` | `context-overflow.ts` | adapter | 오류 이벤트 생성 | 한쪽만이면 경로에 따라 `stream_error` |
| AR-06 / VP-11 | EP-07 표시 ① `TurnErrorBanner` ② `ErrorCard` — 안내 키는 `errorHintKey` 한 함수 | `errorLabels.ts` | renderer | 렌더 | 라이브·재로드 표시가 갈라진다 |

- 같은 규칙의 SSOT: 계열 목록은 `shared/model-identity.ts` `CLAUDE_MODEL_FAMILIES` 를 가져와 `mythos` 만 더한다(CLI 카탈로그에 있고 Orca 목록엔 없음 — 모델 선택 UI 분류는 바꾸지 않는다).
- `실패 의미` 에 다른 게이트 의존: EP-05 ③ — AC14 가 막는 범위는 "주입 표현식 삭제"뿐이다. 주입 값이 무동작 코덱이면 AC17 실기만 잡는다.
- 선택적 필드: `standardTier` `undefined` = 축소 불필요 또는 불가 → 원본 사용.
- 외부 SDK 경계: `updatedToolOutput` 은 Read 에 대해 `FileReadOutput` 을 만족해야 한다 — `satisfies FileReadOutput`(`@anthropic-ai/claude-agent-sdk/sdk-tools`) 로 컴파일 시 잠근다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude-context-policy.ts` | 분류·정규화 | `parseModelName` · `classifyContextModel` · `modelForCli` · `contextPolicyFor` · `envLookup` | 순수 |
| `app/src/main/adapters/tool-result-media.ts` | 교체 | `guardToolResultMedia` · 안내문 | 순수 |
| `app/src/main/adapters/context-overflow.ts` | 판정 | 정규식 목록 · `isContextOverflowMessage` | 순수 |
| `app/src/main/adapters/claude-adapt.ts` | 훅 | `makeToolResultMediaGuardHook(isActive)` | query mock |
| `app/src/main/adapters/attachment-prompt.ts` | 메모 | `formatImageResizeNote` | 순수 |
| `app/src/main/adapters/turn.ts` | 타입 | `ExtractedAttachmentImage.standardTier?` | typecheck |
| `app/src/main/adapters/claude.ts` | 적용 | 정책 참조 · 3자리 · 훅 · `contentFor` · `buildTurnContent(…, { imageTier })` | query mock |
| `app/src/main/adapters/claude-map.ts` | 결과 오류 | 원문 추출 · 분류 | 순수 |
| `app/src/main/adapters/error-classifier.ts` | 예외 분류 | 초과 분기 | 순수 |
| `app/src/main/features/chat/model-image.ts` | 축소 계산 | `resizedSize` · `readImageInfo` · `planStandardTier` · `ImageResizeCodec` | 순수 |
| `app/src/main/features/chat/attachments.ts` | 축소본 | `normalizeAttachments(…, options?)` | 가짜 코덱 |
| `app/src/main/infra/image/native-image-codec.ts` | 코덱 | electron `nativeImage` PNG/JPEG | 사람 실기(AC17) |
| `app/src/main/app/chat-turn/deps.ts` · `send.ts` · `app/bootstrap.ts` | 주입 | `ChatDeps.imageCodec?` · 전달 · 조립 | 소스 스캔(AC14) |
| `app/src/shared/ipc.ts` · `app/src/main/infra/errors.ts` | 분류 값 | `context_overflow` · retryable false | typecheck |
| `app/src/renderer/src/features/chat/lib/errorLabels.ts` · `Exchange.tsx` · `ErrorCard.tsx` · i18n ko/en | 표시 | 라벨·`errorHintKey` | 순수 |
| docs: study 8장 · `IPC_CONTRACT.md` §4 · `arch/backend/provider-runtime.md` §6 · `arch/backend/adapters.md` · `guides/closed-network-extensions.md` | 문서 | 정책·분류·운영 안내 | 인벤토리 검사 |

### 분류 규칙 (MD-01 · MD-02)

| 단계 | 규칙 |
|---|---|
| 접미사 | `/\[1m\]/i` 이 있으면 `suffix=true` 후 제거(CLI `yf` 와 같은 식) |
| 계열 | 소문자 이름에서 앞뒤가 영문자가 아닌 `opus`·`sonnet`·`haiku`·`fable`·`mythos` 첫 출현 |
| 버전 | 계열 뒤 `[-_.:/@ ]*` 다음 한 자리 major + 선택 `[-_.]` minor 1~2자리(뒤에 숫자가 이어지면 minor 아님 — 날짜 배제). 없으면 계열 앞 `(\d)[-_.](\d{1,2})[-_.]*$`(구 `claude-3-5-sonnet`) |
| 1M 출시 | opus ≥ 4.7 · sonnet ≥ 5 · fable·mythos 전부 (CLI 2.1.267 카탈로그 `native_1m`) |
| 분류 | 계열 있음: 접미사 또는 1M 출시 → `claude/1m`, 아니면 `claude/200k` · 계열 없음: 접미사 → `custom/1m`, 아니면 `custom/200k` · 모델 없음 → `default`(CLI 기본) |
| 직결 판정 | 유효 env 에서 `CLAUDE_CODE_USE_{BEDROCK,VERTEX,FOUNDRY,MANTLE,ANTHROPIC_AWS,ANTHROPIC_GOOGLE_CLOUD}` 가 모두 거짓이고 `ANTHROPIC_BASE_URL` 이 없거나 host `api.anthropic.com` |
| `[1m]` 부착 | `claude/1m` ∧ ¬suffix ∧ ¬직결 ∧ ¬`CLAUDE_CODE_DISABLE_1M_CONTEXT` ∧ ¬(3P ∧ sonnet≥5 — `native_1m_3p`) |
| 유효 env | `req.env` 가 있으면 그것(이미 hoist 된 최종 env), 없으면 settings env 문자열 > `process.env` |

### 테스트 가능성

- electron 의존부 분리: 코덱만 `infra/image/` 에 두고 주입한다. 판정·계산은 순수 파일.
- 순서·배선 관측: query mock 으로 옵션·훅 콜백·`setModel` 인자를 직접 관측한다(`claude.live-control.test.ts` 패턴).

## 12. End-to-end 영향

### producer → consumer

```text
model(resolve-turn) → contextPolicyFor → options.model / setModel → CLI 창·미디어·요약
tool_response(CLI) → guard hook → updatedToolOutput → CLI tool_result → LiteLLM
attachment bytes → planStandardTier → codec → standardTier → contentFor → CLI 입력
SDK result/throw → isContextOverflowMessage → ClassifiedError → error 파트(DB) → 배너·카드
```

- producer 기준: 분류는 실행 모델 문자열 하나에서만 파생한다.
- consumer 파생 규칙: renderer 는 category 로 라벨·안내를 고르고 message 는 원문 그대로 쓴다.
- 합성값 우회: 없음 — UI 는 모델 분류를 보지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 도넛(context window) | `[1m]` 세션은 SDK 가 1M 을 보고한다 — 의도된 변화 | AC18 |
| 오류 파트 영속(`history/writer`) | 새 category 문자열이 저장된다 — 구버전 `ErrorCard` 는 분류명 원문 표시 | AC13 |
| `turn-coordinator` 재시도 | `context_overflow` retryable false → 자동 재시도 안 함(기존 stream_error 는 이벤트 0건일 때 재시도했다) | AC12 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 정책은 `sendMessage` 에서 계산 — 세션 수명 동안 `policy.current` 로 유지.
- 모델 전환: `pushTurn`(next.model)·`setModel` 이 갱신한 뒤 CLI 에 전달한다.
- 코덱 실패: 예외·`null` → 축소본 없음 · 전송 계속.
- 교체 훅 실패: 교체 함수는 순수·무예외 — 입력이 예상 형태가 아니면 `undefined`(교체 없음).
- 다중 저장소 쓰기: 해당 없음(보관 파일은 원본 그대로 기존 경로).

## 14. 성능 / 상한 / 최적화

- 축소: PNG/JPEG 가 표준 등급을 넘을 때만 디코드·축소 1회 — 입력 상한은 기존 첨부 상한 32MiB. `nativeImage` 는 동기라 큰 사진은 main 을 수십~수백 ms 점유한다(AC17 실기에서 관측).
- 메모리: 축소본 base64 를 원본과 함께 든다 — 축소본은 1568 등급이라 원본 이하.
- 요청 수: 변화 없음.

## 15. 외부 구현 포트 / 문서 계약

- 폐쇄망 운영자: 모델명에 계열·버전 토큰을 남기면(예: `gw-opus-4.7`) Claude 로 분류된다 — 가이드에 적는다. 커스텀 모델에 `[1m]` 을 붙이면 CLI 가 1M·선제 요약 없음으로 동작한다(미확인+1M).
- shape 검증: 교체 결과 `satisfies FileReadOutput`.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| env 조립 우선순위·hoist | `harness-config.ts` 0188/0207 | §11 유효 env 조회는 읽기만 | 유지 |
| 모델 식별자 `X` ≠ `X[1m]` | `shared/model-identity.ts` 0215 D-007 | §11 실행 문자열만 부착, 식별자·목록·저장값 불변 | 유지 |
| 첨부 정규화는 busy 판정 앞 | `app/src/main/AGENTS.md` §chat-turn 규칙 3 | §11 축소는 정규화 안에서 끝난다 | 유지 |
| ErrorCategory 8종 | `provider-runtime.md` §6 · `IPC_CONTRACT.md` §4 | §11 `context_overflow` 추가 | 변경(D-012) — 문서 동시 갱신 |
| Read·첨부 CLI 정책 | CLI | §6 D-014 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 게이트웨이가 1M beta 헤더를 거절 | AC18 실기 · 거절되면 `CLAUDE_CODE_DISABLE_1M_CONTEXT` 로 끌 수 있다(부착 안 함) |
| 이름 규칙 오판(계열 토큰 없는 Claude 별칭) | 커스텀으로 분류 → 교체·축소가 적용될 뿐 동작은 안전 · 가이드에 명명 권고 |
| `nativeImage` 가 EXIF 회전을 무시 | 회전 값 ≠ 1 JPEG 는 축소하지 않는다 |
| 커스텀 모델이 도구 결과 이미지를 못 봄 | D-009 안내형 — 첨부로 대체 |

- 되돌리기 어려운 결정: `context_overflow` 값(추가형) — D-012.
- 신규 의존성: 없음(electron `nativeImage` 사용).

## 18. 영향 받는 파일 / 문서

- §11 표 전부 + 테스트 파일(`claude-context-policy.test.ts` · `tool-result-media.test.ts` · `context-overflow.test.ts` · `model-image.test.ts` · `claude.context-policy.test.ts` · `context-policy-wiring.test.ts` · 기존 `claude-map.test.ts` · `build-turn-content.test.ts` · `attachments.test.ts` · `error-classifier` 테스트 · renderer `errorLabels.test.ts`).
- `docs/handoff/INDEX.md` · `docs/INDEX.md`.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` ABI 가이드 · `app/src/main/AGENTS.md`(boundaries: adapters 는 features 를 import 하지 않는다) · `app/src/renderer/AGENTS.md`.
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate vitest 명령.
- 사람 실기: AC16~AC19.

## READY self-review

- [x] Decision Ledger 가 세 차례 질의의 결정을 보존한다 — D-004 SUPERSEDED → D-005.
- [x] Part I 만 읽어도 완료 상태가 이해된다(§5 상태표).
- [x] 사용자 문장을 원문 인용했다(§2) · "CLI와 똑같은" 을 CLI 분류 4종으로 옮겼다(D-006).
- [x] 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 표 6행 ↔ AC4·AC9·AC3·AC11~14.
- [x] AS-IS·TO-BE 같은 축 · Delta 각 행이 파일·pair 로 추적된다.
- [x] 사라진 책임 없음.
- [x] 수치·전칭·외부 규약을 실측했다 — §8 전수 표 · study 8장.
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다.
- [x] Baseline V · NEW node 전부 REQUIRED pair.
- [x] 구조 proxy(AC14)·자리 다수(VP-03·VP-08·VP-10)·활성 조건(VP-05)에 적대 증거를 선택했다.
- [x] 운영 gate 열거.
- [x] 사람 실기로 미룬 순수 로직 없음 — 실기 4건은 실환경 관측뿐.
- [x] semantic 목표를 proxy 로만 닫지 않는다 — AC14 는 AC8·AC17 과 짝.
- [x] 신규 계약 SSOT·강제 지점·seam(§10).
- [x] 기존 소비처(§12 표).
- [x] 상한(§14).
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙.

## ΔV1 — 서버 정상 가정: Claude Code 와 같은 큰 파일 정책으로 범위 조정

READY. 구현 전 사용자 결정 변경이다. V1 이 서버(게이트웨이) 문제를 Orca 에서 우회하던 범위를 걷어 내고, Orca 가 CLI 를 거치지 않고 직접 넣던 **텍스트 첨부**만 Claude Code 와 같게 맞춘다. 유효 범위는 이 절의 표가 전부다 — V1 §5·§9~§14·§17 의 도구 결과 교체·이미지 축소·초과 분류 서술은 이 절이 대체한다.

### 근거와 결정 승계

| 발견 · 사용자 문장 | 관측 | 정정 |
|---|---|---|
| "해당 문제는 서버사이드 이슈로 남겨두고, orca는 서버가 정상이라는 가정하에 큰 파일에 대한 정책을 claude 와 똑같이 가져가는 형태로 만 손대려고 한다" | 700,342토큰 오류 = PNG 2장(427KB·327KB)의 base64 약 100만 자가 LiteLLM→OpenRouter 변환에서 글자로 토큰화(약 1.4~1.5자/토큰, study 8.8). Claude Haiku 200k 에서는 큰 이미지도 증가가 작다(사용자 관측) | D-009 → D-015 · D-010·D-011 → D-016 |
| "Claude code와 같게 맞추는 방향으로 plan 수정하라" | CLI 는 API 오류 원문을 보이고 별도 분류 라벨·안내가 없다 | D-012 → D-017 |
| 텍스트 첨부 | Orca 는 24,000자에서 자르고 한 줄 메모만 붙인다(`attachments.ts` `MAX_FILE_CONTEXT_CHARS`). Claude Code `@파일`은 256KB 초과 미첨부 · 25,000토큰 초과 앞 2,000줄 + "Read 로 더 읽어라" 안내 · 그 밖 전체(study 8.6) | D-018 |
| 1M 판정 입력 | Orca 모델이 별칭이거나 없으면 CLI 가 env 로 실제 모델을 고른다 — V1 분류는 Orca 문자열만 봤다 | D-019 |
| CLI 의 SDK 입력 처리 | 이미지 블록에는 CLI 이미지 정책을 적용한다(study 8.5) · `@` 는 사용자 메시지의 **마지막 블록이 텍스트**일 때만 확장한다 | D-016 근거 · D-018 조립 조건 |
| 첨부 저장 위치 | 첨부는 OS 임시 디렉토리의 제품 하위(`getTemporaryFilesPath`)에 저장되고, 그 경로는 대화 `additionalDirectories` 에 들어 있다 | D-018 — CLI 가 읽을 수 있다 |

- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-005~D-007 ↔ AC1 · D-008·D-019 ↔ AC2·AC3·AC20 · D-016 ↔ AC21(이미지 원본 유지) · D-017 ↔ AC11 · D-018 ↔ AC21·AC22·AC23 · D-013 ↔ AC3(env 불변) · D-014·D-015 ↔ AC 없음(변경 없음) · D-020 ↔ AC 없음(작업 분담).
- 폐기 근거: V1 AC4~AC10·AC12~AC14·AC16·AC17·AC19 는 D-015~D-017 로 대상 동작이 사라져 이관할 곳이 없다.

### AC 정정 및 추가

| AC | 대체 관계 | 행동 · oracle | production path |
|---|---|---|---|
| AC1·AC2·AC3·AC18 | 승계 | V1 그대로. AC3 의 세 자리는 AC20 의 해석을 거친 문자열을 넘긴다 | V1 |
| AC11 | V1 AC11 대체 | 결과 오류 message = SDK 원문 — 비어 있지 않은 `result` → `errors`(줄바꿈 결합) → `message` → `error` → 합성 문구 순. category 는 기존 `stream_error`. 기존 `error_max_turns`+`message` 케이스 유지 | `claude-map.ts` result 분기 |
| AC15 | V1 AC15 대체 | 문서가 ΔV1 범위만 서술한다: adapters 문서(1M 판정·텍스트 첨부 CLI 위임) · 폐쇄망 가이드(모델 이름·`[1m]`·창 env, 도구 결과 이미지 글자화는 게이트웨이 쪽 문제) · study 8.6·8.8. `check-doc-inventory --check` exit 0 | 문서 |
| AC20 | 신규 | CLI 실제 모델 해석 표 — 별칭 `opus` + `ANTHROPIC_DEFAULT_OPUS_MODEL=gw-opus-4.7` + 게이트웨이 → `opus[1m]` · 별칭 `sonnet` + `ANTHROPIC_DEFAULT_SONNET_MODEL=internal-llm` → `sonnet` · 별칭 env 값에 이미 `[1m]` → 별칭 그대로 · 모델 없음 + `ANTHROPIC_MODEL=gw-opus-4.7` + 게이트웨이 → `gw-opus-4.7[1m]` · 모델 없음 + settings `model: gw-fable-5` + 게이트웨이 → `gw-fable-5[1m]` · 모델 없음 + `ANTHROPIC_MODEL=internal-llm` → 없음 · 모델 없음 + 둘 다 없음 → 없음 | `modelForCli` |
| AC21 | 신규 | 텍스트 첨부 조립 — 첨부마다 마지막 텍스트 블록에 `@"<저장 경로>"` 한 줄, 첨부 내용·잘림 메모 없음. 이미지가 있으면 블록 순서 = 이미지들 → 텍스트(마지막)이고 이미지 data 는 첨부 원본. 첫 입력·프렐류드·steer·`pushTurn` 네 경로 모두 같다 | `buildTurnContent` · `claude.ts` 네 경로 |
| AC22 | 신규 | 텍스트 첨부 정규화는 확장자(.txt·.md)·NUL 검사만 하고 내용을 자르지 않는다. 결과에 저장 경로가 있고, 24,000자 상수와 잘림 필드는 없다 | `send.ts` → `normalizeAttachments` |
| AC23 | 신규 (실기) | 설치본: 작은 .md → 모델이 내용을 인용 · 256KB 초과 .md → 내용 없이 경로만, 모델이 Read 로 나눠 읽음 · 256KB 이하·25,000토큰 초과 → 앞 2,000줄 + CLI 안내 · 이미지와 텍스트를 함께 첨부해도 같다 · API 오류 시 배너에 원문 | 설치본 → CLI |

유효 AC 는 AC1·AC2·AC3·AC11·AC15·AC18·AC20·AC21·AC22·AC23 의 10행이다. 사람 실기는 AC18·AC23, 나머지는 기계 검증한다.

### Delta V 와 강제 지점

| Node | provenance | 변경 / 승계 |
|---|---|---|
| R-01 · MD-01 | INHERITED | 분류 규칙 V1 그대로 |
| R-02 · MD-02 | CHANGED | 1M 판정 입력 = CLI 실제 모델(D-019) |
| MD-06 | NEW | CLI 실제 모델 해석 |
| SD-01 | CHANGED | 세션 동안 실행 모델 문자열 = 현재 모델의 해석 결과(전환 반영). 훅·이미지 등급 제외 |
| R-05 · AR-05 | CHANGED | 결과 오류 원문 1자리만(D-017) |
| R-07 · AR-07 · MD-07 · MD-08 | NEW | 텍스트 첨부 CLI 위임 — 조립(MD-07)·4경로 배선(AR-07)·정규화(MD-08) |
| R-06 | CHANGED | 문서 범위 |
| R-03 · AR-02 · MD-03 | SUPERSEDED | D-015 — 대체 없음 |
| R-04 · AR-03 · AR-04 · MD-04 | SUPERSEDED | D-016 — AR-04 의 "4경로 한 함수 경유" 증거는 AR-07 로 이관 |
| AR-06 · MD-05 | SUPERSEDED | D-017 — 대체 없음 |

| Pair | V1 대체 관계 / requiredness | path · 직접 oracle | 강제 지점 / 선택 적대 증거 |
|---|---|---|---|
| VP-01 | 승계 / REGRESSION | V1 | EP-01 · not selected |
| VP-02 | V1 VP-02 대체 / REQUIRED (MD-02↔UT-02) | 해석 모델 + env → 실행 문자열, AC2·AC20 | EP-01 · not selected — 직접 표 |
| VP-03 | 승계 / REGRESSION (AR-01↔IT-01) | V1 세 자리, AC3 | EP-02 (3) · V1 등록 변이(자리마다 원문 전달) 승계 |
| VP-10 | V1 VP-10 대체 / REQUIRED (AR-05↔IT-05) | SDK result → `claudeToNormalized` → error 이벤트, AC11 | EP-06′ (1) · not selected — 직접 원문 단언 |
| VP-12 | V1 VP-12 대체 / REQUIRED (SD-01↔ST-01) | 스폰 → `pushTurn(model)`·`setModel` → 새 해석 문자열, AC3 전환 케이스 | EP-02 ②③ · 전환 때 해석 미갱신 변이 |
| VP-13 | V1 VP-13 대체 / REQUIRED (R-02·R-05·R-07↔AT) | 설치본 → CLI → 게이트웨이, AC18·AC23 | 0 — 실기 |
| VP-14 | V1 VP-14 대체 / REQUIRED (R-06↔AT-15) | 문서 → 인벤토리 검사, AC15 | 0 — 문서 |
| VP-15 | 신규 / REQUIRED (MD-06↔UT-06) | 모델·env·settings → 해석 모델, AC20 | EP-08 (1) · not selected — 직접 표 |
| VP-16 | 신규 / REQUIRED (MD-07↔UT-07) | 첨부 → content(멘션 줄·블록 순서), AC21 단위 | EP-09 · not selected — 직접 결과 |
| VP-17 | 신규 / REQUIRED (AR-07↔IT-07) | 첫 입력·프렐류드·steer·`pushTurn` → 입력 스트림 content, AC21 통합(query mock) | EP-09 (4) · **required** — 네 자리 각각에서 조립을 우회(내용 inline)하는 변이 → red. V1 VP-08 의 4경로 증거 이관 |
| VP-18 | 신규 / REQUIRED (MD-08↔UT-08) | 파일 바이트 → 정규화 결과, AC22 | EP-10 (2) · not selected — 직접 결과 |
| VP-04~VP-09 · VP-11 | SUPERSEDED | 대상 동작 폐기(D-015~D-017) | V1 VP-05·07·08·10② 의 등록 변이는 대상 코드가 없어 폐기. VP-08 의 경로별 변이는 VP-17 로 이관 |

| EP | V1 대체 관계 | 자리 · 강제 의미 |
|---|---|---|
| EP-01 | V1 2자리 → 1자리 | 분류는 `modelForCli` 만 쓴다 — V1 의 `customModel` 판정은 폐기 |
| EP-02 | 승계 | 실행 모델 3자리(스폰 `options.model` · `pushTurn` · `LiveTurn.setModel`) 모두 같은 해석 함수 결과를 넘긴다 |
| EP-06′ | V1 EP-06 대체 | `claude-map.ts` result 분기 1자리. 예외 분류기(`error-classifier.ts`)는 바꾸지 않는다 |
| EP-08 | 신규 | 해석 입력 1자리 — `sendMessage` 의 env 조회와 settings `model` 을 해석 함수에 함께 넘긴다 |
| EP-09 | 신규 (V1 EP-04 이관) | content 조립 4경로(첫 입력·프렐류드·steer·`pushTurn`) 모두 `buildTurnContent` 한 함수 경유 — 멘션 줄·블록 순서 |
| EP-10 | 신규 | ① `attachments.ts` 텍스트 자르기 제거 ② 저장 경로 보장(`send.ts` 가 storage 전달 — 현행 유지) |
| EP-03·EP-04·EP-05·EP-07 | 폐기 | D-015~D-017 |

### 기술 보완

- **해석 규칙(MD-06)**: 별칭 = `sonnet`·`opus`·`haiku`·`fable`(대소문자 무시, `[1m]` 접미사 허용)이면 `ANTHROPIC_DEFAULT_<별칭>_MODEL` 값을 분류한다. 값이 없으면 별칭 자체를 분류한다(V1 규칙상 버전 없음 → 200k). 모델이 없으면 `ANTHROPIC_MODEL` → settings `model` 순서로 고른다 — Orca `model-parser.ts` 의 기본 모델 선정과 같은 우선순위다.
- **실행 문자열**: 별칭 경로에서 1M 부착이 필요하면 별칭에 `[1m]` 을 붙인다(CLI 가 별칭을 env 모델로 풀 때 접미사를 옮긴다 — CLI 2.1.267 별칭 해석). 모델 없음 경로는 부착이 필요할 때만 해석 모델에 `[1m]` 을 붙여 명시적으로 넘기고, 아니면 지금처럼 넘기지 않는다.
- **조립(MD-07)**: 텍스트 = 사용자 본문 → 이미지 첨부 블록(현행) → 텍스트 첨부 멘션 줄(`@"<path>"`, 첨부 순서) → diff 요구 블록(현행). 이미지가 없으면 string, 있으면 `[이미지 블록들…, {type:'text'}]`. 경로는 큰따옴표로 감싼다 — 저장 경로에 큰따옴표가 들어가지 않는다는 전제는 구현자가 `attachment-files.ts` 저장 이름 규칙으로 확인하고 테스트로 잠근다.
- **텍스트 첨부 필드**: `ExtractedAttachmentText` 의 `text`·`charsOriginal`·`charsIncluded`·`truncated` 소비처는 프롬프트 조립뿐이다(`rg -n "charsIncluded|charsOriginal|MAX_FILE_CONTEXT_CHARS|formatAttachmentPromptBlock" app/src --glob '!*.test.ts'` → `turn.ts`·`attachment-prompt.ts`·`claude.ts`·`attachments.ts`). 텍스트 첨부 쪽 필드는 제거하고, 이미지용 `formatAttachmentPromptBlock` 호출은 유지한다.
- **생산자 전수**: 텍스트 첨부는 `normalizeAttachments` 한 곳에서만 만들어지고(`rg -n "attachmentTexts" app/src/main --glob '!*.test.ts'`), 유일한 호출부 `send.ts` 가 항상 storage 를 넘겨 저장 경로가 채워진다. 큐·프렐류드·연속 턴은 같은 객체를 옮길 뿐이다.
- **작업 중 추가 지시(steer)**: 같은 조립을 쓴다. CLI 가 작업 중 받은 메시지의 `@` 를 어떻게 다루는지는 CLI 동작을 따른다 — Claude Code 에서 작업 중 `@파일` 을 입력한 것과 같다.
- **바꾸지 않는 것**: 도구 결과(PostToolUse 교체 훅 없음) · 첨부 이미지(축소·메모 없음, CLI 처리) · 오류 분류 값(`ErrorCategory` 변경 없음) · env(창·자동 요약 주입 없음).
- **운영 gate**: V1 의 lint·typecheck·inventory·trailer 를 승계하고, vitest 는 **전체 스위트**로 판정한다 — 저장소 전역 위생 스위트(renderer catch 레지스트리 등)를 빠뜨리지 않기 위해서다(0244 r1 사례). electron 미설치 환경에서 electron 을 import 하는 스위트는 기준선과 같은 실패로 분리 보고한다.
- **READY 검산**: NEW·CHANGED node(R-02·MD-02·MD-06·SD-01·R-05·AR-05·R-06·R-07·AR-07·MD-07·MD-08)는 모두 REQUIRED pair(VP-02·10·12·13·14·15·16·17·18)를 갖는다. 영향받은 상위 AR-01 은 REGRESSION VP-03 이다. SUPERSEDED pair 의 등록 변이는 VP-17 로 이관하거나 폐기 근거를 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 유지 — r1 기준선은 V1+ΔV1, 유효 AC는 10행이며 REQUIRED 9·REGRESSION 2 pair다. ΔV1의 대체 표를 적용하고 폐기된 이미지 우회·초과 분류는 구현하지 않았다.
- 유지 — 사용자 현재 요청에 따라 Codex가 구현했다. 종료 상태는 이 문서 메타와 INDEX의 `impl/IMPL_DONE`·Claude 독립 검증 대기로 맞췄다.
- 유지 — 저장 모델·env·오류 분류 계약은 보존한다. `claude.context-policy.test.ts`의 요청 식별자·env 불변 단언과 `claude-map.test.ts`의 `stream_error` 단언으로 확인했다.
- PLAN_GAP 없음 — CLI 멘션 경로의 큰따옴표 전제는 `attachment-files.ts:93-101` 저장 이름 정제와 `attachments.test.ts`의 인용 이름 저장 사례로 확인했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·VP-02 | EP-01 분류 소비 | `modelForCli` | 1/1 | `rg -n 'classifyContextModel\(' app/src/main/adapters/claude-context-policy.ts` → 선언 외 호출 `:101`만. AC1 분류 표·AC2 실행 문자열 표. | — |
| VP-03·VP-12 | EP-02 실행 모델 | 스폰·`pushTurn`·라이브 전환 | 3/3 | `rg -n -e 'setModel\(' -e 'model:' app/src/main/adapters/claude.ts` → `:586·754·786`. `runCompletion :347`은 ΔV1 비범위. M1~M5 red. | — |
| VP-10 | EP-06′ 결과 오류 | result 분기 | 1/1 | `claude-map.ts:808-828`; AC11 우선순위 8사례·정상 결과 1사례·기존 `error_max_turns` 유지. | — |
| VP-02·VP-15 | EP-08 해석 입력 | env·settings model 조립 | 1/1 | `claude.ts:384-386`; query mock의 settings env+model·prepared `ANTHROPIC_MODEL` 사례, 순수 AC20 표. | — |
| VP-16·VP-17 | EP-09 입력 조립 | 첫 입력·프렐류드·steer·`pushTurn` | 4/4 | `rg -n -e 'buildTurnContent\(' -e 'batchContent\(' app/src/main/adapters/claude.ts` → 공유 seam `:419` + 경로 `:426·428·560·760`. 네 query 입력 단언·M6~M9 red. | — |
| VP-18 | EP-10 텍스트 정규화·저장 | 자르기 제거·storage 전달 | 2/2 | `attachments.ts:106-108·166·183`, `send.ts:96-98`. 300,014바이트 원본 저장·BOM 보존·NUL/확장자 거부·표시 경로 일치. | — |

전수는 source의 SDK model 전달·입력 스트림 진입·텍스트 생산자를 검색해 재열거했다. 모델 계약 집합과 관측 집합의 차집합 0행, 입력 경로 집합과 관측 집합의 차집합 0행이며 `runCompletion`은 명시 비범위다. `rg -n '24_000|MAX_FILE_CONTEXT_CHARS|truncateText' app/src/main --glob '!*.test.ts'` 출력은 0행이다.

| Pair | requiredness | 자기 상태 | 직접 관측 |
|---|---|---|---|
| VP-01 | REGRESSION | SELF_PASS | AC1 분류 표 21행·구 버전/날짜 판정 사례. |
| VP-02 | REQUIRED | SELF_PASS | AC2 표 12행·3P 플래그 5사례·AC20 해석 표. |
| VP-03 | REGRESSION | SELF_PASS | query mock의 스폰·후속 턴·라이브 setter 인자; M1~M3 검출. |
| VP-10 | REQUIRED | SELF_PASS | result 원문 우선순위·정상 결과·기존 오류 사례. |
| VP-12 | REQUIRED | SELF_PASS | `sonnet→opus→sonnet`, `internal→opus→200k→fable` 전환; M4·M5 검출. |
| VP-13 | REQUIRED | SELF_BLOCKED | AC18·AC23은 폐쇄망 설치본·실 게이트웨이가 필요하다. |
| VP-14 | REQUIRED | SELF_PASS | adapters 정책 표·가이드 3-e·study 8.6/8.8; inventory·prose·links 검사 통과. |
| VP-15 | REQUIRED | SELF_PASS | AC20 해석 표 12행·env 읽기 불변 사례·query 배선 사례. |
| VP-16 | REQUIRED | SELF_PASS | `build-turn-content.test.ts`: 멘션 줄·첨부 순서·마지막 텍스트·이미지 원본·diff 위치. |
| VP-17 | REQUIRED | SELF_PASS | 네 실제 query 입력 경로의 SDK 메시지 비교; M6~M9 검출. |
| VP-18 | REQUIRED | SELF_PASS | 파일 저장 후 원본 비교·텍스트 필드 부재·검증 거부 사례. |

합계: SELF_PASS 10·SELF_BLOCKED 1 = 유효 pair 11. 독립 verify 판정은 대기한다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 스폰에 원문 model 전달 | VP-03 / EP-02 ① | 해당 없음 — 첫 ΔV1 구현 | `claude.context-policy`: 스폰·settings model·env model / 3 | red |
| M2 `pushTurn`에 원문 model 전달 | VP-03 / EP-02 ② | 해당 없음 | 후속 턴 별칭 전환 / 1 | red |
| M3 라이브 setter에 원문 model 전달 | VP-03 / EP-02 ③ | 해당 없음 | 라이브 모델 전환·settings env / 2 | red |
| M4 `pushTurn` 해석을 스폰 값으로 고정 | VP-12 / EP-02 ② | 해당 없음 | 후속 턴 별칭 전환 / 1 | red |
| M5 라이브 setter 해석을 스폰 값으로 고정 | VP-12 / EP-02 ③ | 해당 없음 | 라이브 모델 전환·settings env / 2 | red |
| M6 첫 입력에서 첨부 조립 우회 | VP-17 / EP-09 첫 입력 | 해당 없음 | `initial delegates text…` / 1 | red |
| M7 프렐류드에서 첨부 조립 우회 | VP-17 / EP-09 프렐류드 | 해당 없음 | `prelude delegates text…` / 1 | red |
| M8 steer에서 첨부 조립 우회 | VP-17 / EP-09 steer | 해당 없음 | `steer delegates text…` / 1 | red |
| M9 후속 턴에서 첨부 조립 우회 | VP-17 / EP-09 `pushTurn` | 해당 없음 | `pushTurn delegates text…` / 1 | red |

검산: 선택 증거 9·인용 변이 0·새 구조 proxy oracle 0 = 표 행 9. 전건 실제 production `claude.ts`에 심고 query mock의 행동 단언으로 검출했으며 마지막 `source restored=true`로 원본 바이트 복원을 확인했다. 다른 pair는 해당 없음 — 직접 oracle이며, 폐기된 V1 변이는 ΔV1 폐기 표를 따른다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 큰 파일 내용이 사라지는가 | 유지 — 300,014바이트를 저장 후 다시 읽어 원본과 비교했다. 프롬프트의 본문·잘림 메모는 CLI 멘션으로 대체됐다. | CLI 상한·이어읽기 화면은 AC23 실기. |
| 이미지와 함께 보내도 멘션이 확장되는가 | 충족 — 단위·query 네 경로가 원본 image→마지막 text 순서를 단언한다. | 실 CLI 확장은 AC23 실기. |
| 오류 원문의 소비자가 있는가 | 충족 — 매퍼가 기존 `error` 이벤트의 `message`에 원문을 싣는다. 기존 배너·영속 ErrorCard 경로를 사용하며 category는 `stream_error`다. | 설치본 배너는 AC23 실기. |
| 모델 전환이 이전 정책을 쓰는가 | 충족 — 후속 턴과 라이브 전환에서 서로 다른 모델을 연속 호출했고 M4·M5를 검출했다. | 도넛·200k 초과 진행은 AC18 실기. |
| 도구 결과·이미지 자체 정책을 바꾸는가 | 유지 — `claude-adapt.ts`·이미지 정규화 코덱·오류 분류기 diff 없음. 이미지 data는 네 query 경로에서 원본과 동일하다. | D-015~D-017 유지. |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| I-01 | 텍스트 `text` 필드를 제거하면 정규화 결과의 기존 분기 기준도 사라진다. | 선조치 후 보고 — `data` 유무로 이미지·텍스트를 나누고 텍스트 `path`를 필수화했다. | `attachments.ts:182-183`, `turn.ts:63-71`; 파일·클립보드 원본/표시 테스트. |
| I-02 | SDK result 매퍼의 로컬 shape에 `result`·`errors` 필드가 빠져 있었다. | 선조치 후 보고 — unknown 필드를 선언하고 비어 있지 않은 문자열만 원문 후보로 쓴다. | `claude-map.ts:731-732·808-828`; AC11 9사례. |
| I-03 | 변경 전 전체 테스트는 SQLite Electron/Node ABI 불일치로 실패했다. | 환경 조치 — 저장소 `npm run pretest`가 Node ABI 재빌드를 성공했다. | 변경 전 601파일·187 실패 케이스는 전부 `better_sqlite3.node` 서명; `[sqlite-abi] node: rebuilt`. |
| I-04 | 워커 4 전체 실행의 renderer 소스 전수 검사 한 케이스가 41.2초 걸려 실패했다. | 환경 지연으로 판단 — 코드·시간 예산을 바꾸지 않고 단독 15/15와 워커 1 전체 실행으로 다시 확인했다. | `sparkCss.test.ts` 전수 케이스 단독 7.85초·전체 직렬 0.85초 통과; 전체 603파일·5792 pass. |

설계 대비 대체 메커니즘 없음 — ΔV1의 CLI 위임·순수 재해석을 그대로 사용했다. 신규 캐시·만료 상태·공유 가변 정책·재진입 잠금·별도 무효화 축은 만들지 않았다(`claude.ts:384-386·754·786`).

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |
| 구현일 | 2026-10-01 |
| 구현 범위 | 모델 분류/CLI 실제 모델 해석·실행 전달·텍스트 멘션 조립·저장 결과 계약·오류 원문·문서. |
| 관측한 게이트 산출 | 관련 Vitest 5파일·181케이스 통과. lint 0 error·기존 warning 1, typecheck node/web/test 통과. |
| 전체 게이트 | `vitest run --maxWorkers=1`: 603파일·5792 pass·1 skip·0 fail. 스크립트 128/128, inventory·prose·links 통과, `git diff --check` 출력 없음. |
| 환경 | `npm run pretest`로 Node ABI를 준비했다. Electron ABI로 전환하는 dev/build는 이번 운영 gate가 아니다. |
| 다음 주체 | Claude 독립 verify. 폐쇄망 설치본 AC18·AC23은 사람 실기. |

| AC | 자기 충족 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | 분류 21행과 구 버전·날짜 사례. |
| AC2 | ✅ | 실행 문자열 12행·3P 플래그 5사례. |
| AC3 | ✅ | query의 스폰·`pushTurn`·라이브 전환·env/요청 불변, M1~M5 red. |
| AC11 | ✅ | SDK 원문 후보 우선순위 8사례·정상 결과 1사례·기존 오류 유지. |
| AC15 | ✅ | 정책 표·운영 가이드·study 연결 및 inventory·prose·links 검사. |
| AC18 | ⚠️ | 실 게이트웨이의 beta 헤더·도넛·200k 초과 진행은 미실행. |
| AC20 | ✅ | CLI 실제 모델 해석 12행·env 읽기 불변·query 입력 배선. |
| AC21 | ✅ | 단위 9케이스·query 네 경로·인용 이름 저장 사례, M6~M9 red. |
| AC22 | ✅ | 300,014바이트 저장 원본·BOM·삭제 필드·NUL/확장자 거부·저장 경로. |
| AC23 | ⚠️ | 폐쇄망 설치본 CLI의 작은/큰 텍스트·동시 이미지·API 오류 화면은 미실행. |

검산: ✅8·⚠️2·❌0 = 유효 AC 10. ΔV1로 분모는 V1의 19행에서 유효 10행으로 바뀌었고 구현 커밋의 `Criteria-Met`은 8/10이다.

## [구현자 기입] Review Signals — 사실만

- 현재 라운드/턴은 r1이며 독립 verify 결과는 아직 없다. 이전 ΔV1 구현 보고·인용 red 변이가 없어 재구현 이슈는 해당 없음이다.
- 등록된 잠금은 VP-03 3자리·VP-12 2자리·VP-17 4경로의 9종이다. 모두 query에 전달된 실제 옵션·메시지 행동으로 red를 관측했다.
- SQLite ABI 불일치는 pretest로 해소했고, 병렬 소스 스윕 지연은 동일 코드의 직렬 전체 실행으로 재확인했다(I-03·I-04). 폐쇄망 게이트웨이·설치본 실기 접근은 이 환경에 없어 AC18·AC23을 남겼다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 저장 이름에 `#`가 남아 CLI `@"…"` 파서(`Q0s`)가 `#` 앞까지만 파일명으로 읽는다 — `issue#12.md` 첨부 내용이 모델에 안 간다 | VP-16 · D-018 · AC21 | 저장 이름 정제에 `#` 처리 추가 + `#` 이름 테스트. 재현은 [verify §6](verify.md#6-외부-포트--문서-계약) | BLOCKING | open |
| D2 | 모델·env 해석이 CLI project/local settings의 env·`model`을 보지 않는다 | 비귀속(plan §11 범위 밖) | 실사용 확인 후 판단 | NEXT_HANDOFF | open |
| D3 | VP-17 IT의 `additionalDirectories` 단언이 `expect.any(String)` | 비귀속 | D1 수정 때 강화 가능 | NON_BLOCKING | open |
