# Plan — 0245-context-policy-cli-parity

## 메타

| 항목 | 값 |
|---|---|
| slug | `0245-context-policy-cli-parity` |
| 작성자 | Claude Code |
| 일자 | 2026-09-30 |
| 매핑 | 이슈1(폐쇄망 LLM 입력 264k 초과) — 사용자 라이브 세션 · 근거 [study 8장](../../etc/study/claude/08-컨텍스트-한도와-파일-정책.md) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

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
| D-003 | 설계·구현을 이번 세션에서 모두 한다 | "Plan 및 impl을 모두 진행하라" | 사용자 턴 | ACTIVE | — |
| D-004 | 기본 정책은 200k 로 한다 | "디폴트 200k 정책으로 기준하도록" | 사용자 턴 | SUPERSEDED | D-005 |
| D-005 | 200k 기본 정책은 **Claude 가 아닌 모델**에 적용한다. Claude 모델은 `[1m]` 접미사가 있거나 1M 으로 출시된 모델이면 1M 정책, 아니면 200k 정책 | "디폴트 200k 정책은 클로드 모델이 아닐때이다. …1000k 정책으로 수행돼야 한다" | 사용자 턴 | ACTIVE | D-004 를 구체화 |
| D-006 | 정책은 **Claude Code CLI 2.1.267 과 같은 분류**를 따른다 — Claude 200k · Claude 1M · 미확인 모델 · 미확인 모델+`[1m]` | "클로드 코드 cli와 똑같은 정책을 가져가고 싶다. 200k, 1m, 미확인된 모델, 미확인된 모델이지만 1m 등" | 사용자 턴 | ACTIVE | — |
| D-007 | 게이트웨이가 바꾼 모델명에서 계열(opus·sonnet·haiku·fable·mythos)과 버전(`4.7`·`4-7` 등)을 뽑아 Claude 여부·1M 출시 여부를 판정한다 | "'opus', '4.7', '4-7' 같은 형태로 모델이름과 버전을 추출할 수 있음" | 사용자 턴 | ACTIVE | — |
| D-008 | 1M 인 Claude 모델명에 `[1m]` 이 없고, **CLI 가 스스로 1M 을 인정하지 못하는 연결**(게이트웨이 URL · 3P)이면 Orca 가 실행 모델 문자열에만 `[1m]` 을 붙인다 | CLI 는 `api.anthropic.com` 직결에서만 네이티브 1M 을 인정한다(study 8.2). CLI 는 `[1m]` 을 떼고 원래 이름을 보낸다 | D-005·D-006 의 구현 수단 — 설계자 | ACTIVE | — |
| D-009 | Claude 가 아닌 모델 세션에서 도구 결과의 이미지·PDF 는 경로·크기 안내문으로 바꿔 모델에 보낸다 | LiteLLM 이 커스텀 백엔드로 보낼 때 도구 결과 이미지를 base64 텍스트로 바꾼다(study 8.8) — 모델은 볼 수 없고 수십만 토큰이 된다. 안내형 UX 는 사용자에게 제시 후 이견 없음 | 설계자 제안 · 사용자 UX 확인 턴 | ACTIVE | — |
| D-010 | Claude 가 아닌 모델 세션에서 컴포저 첨부 이미지는 Claude 표준 등급(긴 변 1568px · 시각 토큰 1568, 공식 `resizedSize`)으로 줄여 보내고, 원본 보관·표시는 그대로 둔다 | "컨텍스트를 너무 많이 차지한다" · 200k 정책의 이미지 등급이 표준이다 | 사용자 턴 + 설계자 | ACTIVE | — |
| D-011 | 줄인 이미지에는 CLI 와 같은 형식의 `[Image: original …, displayed at …]` 메모를 모델용 텍스트에 붙이고, 별도 UI 표시는 두지 않는다 | CLI 와 같은 동작(`CBe`) | 설계자 | ACTIVE | — |
| D-012 | 초과 오류는 전용 분류 `context_overflow` 로 표시하고 원문과 조치 안내를 보인다. 자동 요약 재시도·되돌려 이어가기는 이번 범위가 아니다 | Claude 경로는 CLI 가 이미 자동 복구한다. 커스텀 경로는 CLI 도 복구하지 못한다 — CLI 동등 수준은 안내다(추론) | 설계자 권고(2회 제시) + D-006 | ACTIVE | — |
| D-013 | 자동 요약 창 기본값 env 주입(`CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000`)은 하지 않는다 | 미확인 모델은 CLI 가 이미 200k 로 요약한다. 1M 모델은 1M 전체를 써야 한다("1m의 컨텍스트를 모두 사용할수있나?") | 사용자 질문 → 설계자 철회 | ACTIVE | — |
| D-014 | 텍스트 Read 상한은 CLI 기본값(256KB · 25,000토큰)을 유지한다 | 200k·1M 모두 CLI 기본과 같게 | D-006 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014 (신규 handoff).
- 변경된 결정: D-004 → D-005 ("디폴트 200k"의 적용 대상을 사용자가 비-Claude 로 좁혔다).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001·D-009·D-012.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-005 ↔ AC1·AC2 · D-006 ↔ AC1 · D-007 ↔ AC1 · D-008 ↔ AC2·AC3 · D-009 ↔ AC4·AC5 · D-010 ↔ AC6~AC9 · D-011 ↔ AC9 · D-012 ↔ AC10~AC13 · D-013 ↔ AC3(환경변수를 건드리지 않음) · D-014 ↔ AC 없음(변경 없음).
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

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- (구현 턴에서 기입)

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| — | — | — | — | — |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| — | — | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| — | — | — | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- (구현 턴에서 기입)

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
