# Plan — 0301-session-resume-cwd-retry

## 메타

| 항목 | 값 |
|---|---|
| slug | `0301-session-resume-cwd-retry` |
| 작성자 | Claude Code |
| 일자 | 2026-11-09 |
| 매핑 | 버그수정(비기능) — 구현 주체 Claude |
| 상태 | READY |
| V mode | `Delta V` (V1 = Baseline) |
| 기준 V | `0301-session-resume-cwd-retry:V1@01ca522` |
| 이번 V revision | `ΔV1` — verify r1 D2(PLAN_GAP) 정정 · 사용자 결정 D-017. 대체 노드 없음 |
| 유효 V | `V1 + ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0259 시기 빌드에서 0299 빌드로 업데이트한 뒤, 최근 Claude 세션을 이어 보내면 두 가지 실패가 난다. 하나는 "작업 경로가 저장된 세션과 일치하지 않습니다"이고, 다른 하나는 "재시도 1/2" 뒤 `submission_stale:before-spawn`이다. 같은 PC에서 nav→플러그인 탭에는 "목록을 갱신하지 못했습니다" 배너가 레이아웃을 밀고 들어온다.
- 원인(§8): 원인은 세 가지다. (1) Claude 기록의 셸 이동을 세션 경로 변경으로 오판한다. (2) 이미 확정된 입력을 재시도가 다시 보내지 못한다. (3) 비어 있거나 깨진 Claude 설정 JSON 하나가 Claude 실행과 플러그인 목록을 통째로 멈춘다.
- 완료 후 달라지는 것: 하위 폴더로 이동했던 세션도 그대로 이어진다. 재시도는 실제로 다시 보내고, 못 보내면 원래 오류를 보인다. 설정이 없거나 비면 아무 알림이 없고, 깨진 파일만 건너뛰며 어느 파일인지 한 번 알린다. 플러그인 탭은 실패해도 레이아웃이 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 업데이트 뒤에도 최근 Claude 세션이 이어지고, 실패하면 무엇이 원인인지 알 수 있으며, 그 안내가 화면 배치를 바꾸지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 케이스 1 "에러: 입력 검증 오류 / Claude 원본 세션의 작업 경로가 지정된 세션과 일치하지 않습니다." | 라이브 세션 2026-11-09 버그리포트 |
| 명시 요구 | 케이스 2 "재시도 1/2 스트림 오류 … 백앤드 영결 오류 재시도 가능 submissiom_stale:before-spawn 일시적 오류일 수 있습니다" | 라이브 세션 2026-11-09 |
| 명시 요구 | "nav->플러그인 이동 후 각 탭의 상단에 … 이런 안내는 출구가 토스트에러로 가야한다. 앱 레이아웃에 영향을 주면 안된다. 또한 어떤 에러인지도 검토하라" | 라이브 세션 2026-11-09 추가 리포트 |
| 명시 요구 | 로그 순서 `chat.native-resources.load-failed`(하네스 목록) → `engine.spawn.failed`(Claude 네이티브 확장 설정) → `chat.turn.failed`(stale). "테스트 환경에서는 opencode 설치를 안 한 pc" | 라이브 세션 2026-11-09 |
| 명시 요구 | "engine.spawn.started -> engine.spawn.failed (네이티브 확장 설정을 읽을 수 없습니다.) -> engine.spawn.started -> engine.spawn.failed (submission_stale:before-spawn) 순서로 2번 재시도 된거다" | 라이브 세션 2026-11-09 |
| 명시 결정 | 설정 파일을 읽지 못할 때 "CLI처럼 건너뛰기" | AskUserQuestion 응답 2026-11-09 |
| 명시 결정 | "플러그인 설치가 없어 확인할 수 없는 경우라면 이것은 경고도 에러도 아니지 않느냐" | AskUserQuestion 응답 2026-11-09 |
| 추론 의도 | 업데이트 직후 증상이 몰린 이유는 재시작으로 살아 있던 채널이 사라져 모든 이어가기가 원본 확인·새 spawn을 지나기 때문이다 | §8 R-03·R-10 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 보고된 네 증상(케이스 1·2, 추가 1·2)의 원인을 확정하고 고친다 | 버그리포트 | 사용자 2026-11-09 | ACTIVE | — |
| D-002 | Claude 세션의 작업경로는 CLI 규칙으로 판정한다 — 마지막 유효 `relocated` 스탬프, 없으면 처음 기록된 `cwd` | 항목별 `cwd`는 셸 현재 경로라 이동하면 바뀐다(§8 R-01·R-02) | 설계(벤더 1차 근거) | ACTIVE | — |
| D-003 | 실제로 다른 경로로 옮겨진 세션(`relocated` ≠ 저장 경로)은 지금처럼 `unavailable`이며 재생성·재전송하지 않는다 | 원문: "unavailable·인증·경로 충돌에는 재생성·재전송하지 않는다" | `app/AGENTS.md` DB 정책 · 0265 | ACTIVE | — |
| D-004 | 원본 JSONL이 있으면 기록된 작업경로를 찾을 수 없어도 `missing`이 아니라 `unavailable`이다 | 원문: "명시 전송에서 원본 부재가 확인되면 … 복구" — 원본은 있다 | `persistence.md:188` 적용 | ACTIVE | — |
| D-005 | 턴 재시도는 같은 입력으로 새 채널을 열어 다시 보낸다 | 원문: "프레임 에러 시 `send()` 재호출(respawn+resume 콜드 패스)" · 이벤트 0건을 미전달로 보는 기존 가정 | `runtime-ipc.md:94` · 0154 재주입 | ACTIVE | — |
| D-006 | 입력 예약이 되돌려졌거나 다른 경로로 넘어가 재시도할 수 없으면, 재시도 표시 없이 원래 오류로 끝낸다 | 내부 토큰이 원인을 가리고 헛된 "재시도 N/M"을 띄운다(§8 R-06) | 설계 | ACTIVE | — |
| D-007 | 재시도 가능 여부는 backoff 전에 상태를 바꾸지 않고 확인하고, 재개방은 backoff 뒤 재전송 직전에 한다 | backoff 중 Stop·예약 유지 Stop 경로를 현재 동작 그대로 둔다(§13) | 설계 | ACTIVE | — |
| D-008 | 커밋된 예약은 새 전송의 admission에서 거부하는 fence를 유지한다. 재개방은 같은 coordinator 실행의 재시도에서만 한다 | 원문: "A committed claim is deliberately no longer eligible for admission." | `opencode-runtime.test.ts:337` | ACTIVE | — |
| D-009 | 재시도한 실패도 원인을 로그에 남긴다. Claude를 띄우지 않은 시도는 `engine.spawn.started`로 기록하지 않는다 | 사용자 로그에서 두 번째 started가 실제 spawn 없이 찍혔다 | 사용자 로그 관측 + 설계 | ACTIVE | — |
| D-010 | Claude 설정 JSON이 없거나 내용이 비었으면(0바이트·공백·BOM만·`null`) 설정 없음으로 보고 알리지 않는다 | 원문: "플러그인 설치가 없어 확인할 수 없는 경우라면 이것은 경고도 에러도 아니지 않느냐" | 사용자 2026-11-09 | ACTIVE | — |
| D-011 | 내용이 있는데 읽을 수 없는 Claude 설정 파일은 CLI처럼 그 파일만 빼고 계속한다(`plugin.json`이면 그 플러그인만 제외). 파일 경로를 담은 경고는 같은 파일 상태당 1회 낸다 | 원문 선택: "CLI처럼 건너뛰기". CLI는 "could not be parsed … 적용되지 않음"으로 건너뛴다 | 사용자 2026-11-09 | ACTIVE | — |
| D-012 | nav→플러그인 탭의 목록 갱신 실패는 탭 영역에 표시하지 않는다(레이아웃 불변). 실패 상태에 들어설 때 토스트로 1회 알린다 | 원문: "이런 안내는 출구가 토스트에러로 가야한다. 앱 레이아웃에 영향을 주면 안된다." | 사용자 2026-11-09 | ACTIVE | — |
| D-013 | 토스트 전환 범위는 이 배너로 한정한다 | 설계자 제안 "4. 토스트 전환 범위는 이 배너로 한정" 뒤 사용자 "plan 작성 진행해" | 사용자 2026-11-09 | ACTIVE | — |
| D-014 | 쓰기를 지배하는 읽기(`project-settings.ts`, `plugin-state.ts`)는 내용이 있는 깨진 파일에 대해 엄격을 유지한다. 빈 내용 규칙(D-010)만 공유한다 | 깨진 파일을 `{}`로 보고 덮어쓰면 사용자 설정이 사라진다 | 설계(D-011 적용 경계) | ACTIVE | — |
| D-015 | 설정 경고·로그에는 파일 경로와 사유만 싣고 파일 내용은 싣지 않는다 | 원문 테스트명: "reports invalid configuration without its contents" · "with a redacted error" | `plugin-catalog.test.ts` · `configured-resources.test.ts` | ACTIVE | — |
| D-016 | 하네스 목록 조회 실패 메시지에 원래 원인을 붙인다 | 원문: "어떤 에러인지도 검토하라" — 현재 main이 원인을 지운다(§8 R-14) | 사용자 2026-11-09 | ACTIVE | — |
| D-017 | 시작 단계에서 보내지 못한 턴의 자기 입력(직전 턴이 연 입력 배치 중 held에 남은 항목)은 같은 체인에서 자동 재전송하지 않고, 체인이 끝날 때 대기열에서 빼 입력창으로 되돌린다. 보낸 말풍선은 지운다 | 원문 선택 "입력창으로 되돌림": "대기열에서 빼고 원문을 입력창에 되돌린다(Stop 버튼의 복원과 같은 방식). 나중에 자동으로 나가지 않는다. 대화 화면에 남은 사용자 말풍선을 어떻게 할지까지 범위에 들어온다." | 사용자 2026-11-09 (verify r1 D2 질의) | ACTIVE | — (D-006 보완) |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-016(V1).
- 변경된 결정: 없음. 기존 잠금 테스트 3건(§8 R-17)이 지키던 "깨진 설정은 reject" 동작을 D-011이 사용자 결정으로 바꾼다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-003(0265)·D-008(0262)·D-015(0279 계열 테스트).
- **ΔV1(verify r1 D2)**: D-017 추가, 대체 없음. r1 선조치(`post-turn.ts` 재flush 차단)가 남긴 "held에 남아 다음 전송 응답 뒤 자동 전송"을 사용자에게 물어 정했다.
  - `ACTIVE 결정 ↔ AC` 대조(ΔV1): D-017 ↔ AC18·AC19·AC20·AC21, 충돌 0.
  - AC6 "동기 실패는 held"는 post-turn 시점 관측이라 그대로 성립한다(AC20 i). 체인 종료 뒤 상태는 AC18이 정한다.
  - D-006 "원래 오류로 끝낸다" ↔ AC18: 오류 이벤트는 그대로 1회이고 회수는 그 뒤다 — 충돌 없음.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 대응은 아래와 같다.
  - D-002 ↔ AC1·AC3 · D-003 ↔ AC2 · D-004 ↔ AC2 · D-005 ↔ AC4
  - D-006 ↔ AC5 · D-007 ↔ AC6 · D-008 ↔ AC7 · D-009 ↔ AC8·AC9
  - D-010 ↔ AC10 · D-011 ↔ AC11·AC12 · D-012 ↔ AC14 · D-013 ↔ §6
  - D-014 ↔ AC13 · D-015 ↔ AC11 · D-016 ↔ AC15

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당. 증상 넷의 원인은 셋이고, 케이스 2와 추가 리포트는 한 사슬이다 | §8 R-06·R-11·R-12 |
| 이미 기존 코드가 충족하는가 | 아니오. 재시도는 초기 입력이 있는 요청에서 한 번도 다시 spawn하지 못한다 | §8 R-07 재현 |
| 더 작은 해법이 있는가 | 재시도를 아예 끄면 작지만 D-005(기존 설계)를 버린다. 엄격 읽기를 유지하고 경로만 보이면 작지만 D-011과 어긋난다 | §8 R-05·R-13 |
| 선행 자료의 주장을 코드와 대조했는가 | `runtime-ipc.md:94` "respawn+resume"은 코드가 지키지 못하고 있었다. `send.ts:713-715` 주석의 "재시도 한도 소진 시에만 복구" 전제도 성립하지 않았다 | §8 R-07 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | D-011은 기존 잠금 테스트 3건의 기대를 바꾼다(사용자 결정). 디자인 시스템 error 행 "설명과 복구 동작을 해당 영역에 둔다"는 D-012·D-013으로 이 카탈로그만 예외다 | §16 |

- 사용자에게 올릴 결정: 없음. D-011·D-012·D-013은 2026-11-09 응답으로 닫았다.
- 코드 조사로 닫은 사실: CLI의 세션 경로 규칙, 항목별 `cwd`의 의미, 재시도·fence 충돌, 빈 파일 실패, OpenCode 미설치 무관(§8).

## 5. 동작 / 사용자 흐름

```text
[케이스 1] 재시작 뒤 저장 Claude 세션으로 전송
  → 원본 JSONL 확인: 세션 경로 = 마지막 relocated ?? 처음 cwd
  → 저장 경로와 같으면 resume ↘ 다르면 "작업 경로…" (재생성 없음)

[케이스 2] 전송 → 첫 시도가 이벤트 0건으로 재시도 가능 실패
  → 예약이 아직 이 턴 소유인가? (상태 불변 검사)
      예 → "재시도 1/2" → backoff → 예약 재개방 → 같은 입력으로 새 spawn
      아니오 → 재시도 표시 없이 원래 오류
  → 재시도도 다 실패하면 마지막 원래 오류 (submission_stale 아님)

[추가] Claude 설정 JSON 읽기 (spawn·목록 공통)
  → 없음/빈 내용 → 설정 없음, 알림 없음
  → 내용 있는데 읽기·파싱 실패 → 그 파일(plugin.json이면 그 플러그인)만 빼고 계속 + 경고 토스트 1회
[추가] nav→플러그인 탭: 목록 조회 실패 → 탭 영역 그대로, 실패 진입 시 토스트 1회
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 하위 폴더로 `cd`한 기록이 있는 세션을 재시작 뒤 이어 보냄 | 처음 `cwd`로 판정 → ready → resume | 정상 응답 (AS-IS: 입력 검증 오류) |
| 이동한 하위 폴더가 삭제된 세션 | 같음 | 정상 응답 (AS-IS: `missing` → 보관 대화 재전송으로 새 세션) |
| CLI에서 다른 경로로 옮겨진(relocated) 세션 | `unavailable` | "작업 경로가 저장된 세션과 일치하지 않습니다" (기존과 같음) |
| relocated 경로가 지금은 없음 | `unavailable` | 같은 문구 (AS-IS: `missing` → 새 세션 복구) |
| 첫 시도: spawn 뒤 이벤트 0건 스트림 실패 | 재개방 → 재spawn | "재시도 1/2" 뒤 정상 응답 (AS-IS: stale 오류) |
| 첫 시도: spawn 단계 동기 실패(입력이 held로 복귀) | 재시도 없음 | 원래 오류 즉시 표시. "재시도 N/M" 없음 |
| 재시도 2회 모두 실패 | 마지막 원래 오류 | 원래 분류·문구 (AS-IS: stale) |
| backoff 중 Stop | 재개방 전이라 상태 불변 | 현재와 같음 |
| backoff 중 다른 경로가 예약을 가져감 | 재개방 실패 | "재시도 1/2" 뒤 원래 오류 |
| `~/.claude/settings.json`이 0바이트·공백·BOM·`null` | `{}` | 알림 없음, 전송·목록 정상 (AS-IS: 실행 실패·배너) |
| 설정 파일 내용이 깨짐(끝 쉼표·UTF-16 등) | 그 파일 제외 | 전송·목록 정상 + "설정을 읽거나 적용하지 못했습니다 — Claude 설정 파일을 읽지 못해 이 파일 없이 진행합니다: <경로>" 1회 |
| 설치된 플러그인의 `plugin.json`이 깨짐 | 그 플러그인 제외 | 나머지 정상 + "…이 플러그인을 제외했습니다: <경로>" 1회 |
| 같은 깨진 파일을 다시 읽음(다음 전송·창 포커스) | 같은 상태 | 추가 알림 없음 |
| 플러그인 탭 목록 조회 실패 | 탭 영역 변화 없음 | "정보를 불러오지 못했습니다" 토스트 1회. 실패가 이어지는 동안 반복 없음 |
| (ΔV1) 기존 세션의 첫 시도가 spawn 단계 동기 실패 → 체인 종료 | 그 입력을 대기열에서 빼고 `message.cancelled` | 원래 오류 + 보낸 말풍선이 사라지고 원문이 입력창으로 돌아옴. 다음 전송 뒤에도 자동으로 나가지 않음 (r1: held에 남아 다음 전송 응답 뒤 자동 전송) |
| (ΔV1) flush 턴(응답 중 예약했던 입력)이 동기 실패 | 같음 — 그 flush 입력이 대상 | 원래 오류 + 그 예약 원문이 입력창으로 돌아옴 |
| (ΔV1) 동기 실패와 같은 순간 사용자가 즉시 보내기 | 기존 flush | 실패한 입력과 새 입력이 다음 턴으로 함께 나감(기존과 같음) |
| (ΔV1) 새 대화(세션 ID 발급 전) 동기 실패 | 대기열에서만 뺌 | 원래 오류 + 말풍선 유지, 입력창 복원 없음 — 선언 경계(§10 ΔV1) |
| (ΔV1) 준비 중 Stop·준비 실패·세션 폐기로 회수된 턴 시작 입력 | 기존 `message.cancelled` | 말풍선도 사라지고 입력창으로 돌아옴 (r1: 말풍선 유지·복원 없음). 같은 소비 규칙의 효과(§12) |

### 파생 UX / 엣지케이스

- loading / empty / error: 플러그인 탭은 실패해도 빈 상태 문구를 띄우지 않는다(`suppressEmpty` 유지).
- cancel / retry / close / restart: 재시도 backoff는 그대로다(1초·2초, 최대 2회). 재시작마다 깨진 파일 경고는 다시 1회 난다.
- concurrency / multi-session: 재개방은 같은 세션 키·같은 claim만 다룬다(§10 B행).
- 외부환경: OpenCode 미설치는 원인이 아니다. OpenCode 전역 목록은 빈 목록으로 정상 반환된다(§8 R-12).

## 6. 범위 / 비범위

- **범위**: 케이스 1 세션 경로 판정 · 케이스 2 재시도와 spawn 기록 순서 · Claude 설정 읽기 정책(빈 내용·건너뛰기·경고) · 플러그인 탭 실패 표시 · 하네스 목록 실패 메시지의 원인 · 현재 상태 문서.
- **ΔV1 범위**: 시작 단계에서 보내지 못한 입력의 회수·말풍선 제거·입력창 복원(D-017). ΔV1 비범위: 새 대화(세션 ID 전)의 화면 복원 · 첨부 복원 · 비동기 실패로 orphaned 된 입력 · 실패한 턴 동안 예약된 다른 held.
- **비범위**: relocated 세션을 따라 저장 경로를 바꾸는 기능 · 경합으로 생긴 정당한 `submission_stale:*`의 화면 분류 · 플러그인 스킬 `.md` 읽기 실패 정책 · OpenCode 설정 읽기 정책 · 앱 전체 인라인 안내의 토스트 전환(D-013) · 토스트 문구의 Electron IPC 접두어.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 정당한 stale 경합의 분류(`/\bspawn\b/`가 `before-spawn`에 걸려 연결 오류로 표시) | 아니오 | 후속. 재시도 경로에서는 더 생기지 않는다(AC5) |
| 플러그인 스킬 파일 읽기 실패("Claude 플러그인 스킬을 읽을 수 없습니다")도 실행을 막음 | 아니오 | 후속 후보. 이번 보고 원인 아님 |
| 앱 전체 갱신 실패 안내 토스트화 | 아니오 | 사용자 요청 시 별도 handoff |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 기록 중간에 하위 폴더 `cwd`가 있는(그 폴더가 삭제된 경우 포함) Claude 세션을 채널 없이 보내면, 원본 확인이 통과하고 같은 native ID·저장 cwd로 resume한다 | 실제 `ClaudeAdapter` + `prepareNativeSession`: `ok:true`, `nativeSessionId`=원본 ID, `recoverSession` 0회, 이어진 `sendMessage` 옵션 `resume`·`cwd` | `chat:send` → `resolveTurn` → `prepareNativeSession` → `readHistory` → `sendMessage` |
| R-01 | AT-01 / AC2 | 다른 경로로 relocated된 세션과 relocated 경로가 없는 세션은 `unavailable`이며 복구(새 세션)를 만들지 않는다 | 같은 seam에서 `ok:false`·`schema_validation_error`·작업 경로 문구, `recoverSession` 0회 | 같음 |
| R-01 | UT-01 / AC3 | 세션 경로 = 마지막 유효 relocated, 없으면 처음 문자열 `cwd`, 둘 다 없으면 없음 | 규칙 함수 분기 입력 C1~C7(§7-A VP-10) | `readClaudeNativeHistory` → 규칙 함수 |
| R-02 | AT-02 / AC4 | 첫 spawn이 이벤트 0건으로 재시도 가능 실패하면 "재시도 1/2" 뒤 같은 입력으로 다시 spawn해 응답이 끝난다 | 실제 조립(buildTurnRequest·SessionRuntime·coordinator·queue)에서 전달 이벤트 = `turn.retrying` → 응답 → 종료, `error` 없음, `sendMessage` 2회·같은 `promptUuid` | coordinator 재시도 → runtime 재spawn |
| R-02 | AT-02 / AC5 | 재시도할 수 없거나 다 쓰면 원래 오류로 끝나고, 어느 전달 오류도 `submission_stale:`로 시작하지 않는다. 동기 spawn 실패에는 `turn.retrying`이 없다 | 같은 seam 스크립트 B·C·D(§7-A VP-02) | 같음 |
| R-02 | ST-01 / AC6 | 예약 수명주기: 실패 직후 `submitted` 유지 → backoff 뒤 `submitting` → 재commit `submitted`. backoff 중 Stop은 재spawn 없이 `submitted` 유지. 동기 실패는 held | 같은 seam의 queue 관측(`canCommitMany`·`hasSubmitted`·`pending`) 시점별 단언 | 같음 + `chatCancel` 핸들러 |
| R-02 | IT-02·UT-02 / AC7 | 재개방은 commit과 같은 세션 키·claim을 쓴다(새 세션 큐 키·저장 세션 ID·flush 턴 게터). claim이 `submitting`·`submitted`일 때만 되고, 하나라도 아니면 아무것도 바꾸지 않는다. 새 전송 admission fence는 그대로다 | `buildTurnRequest`+실제 queue W1~W4, queue Q1~Q8, 기존 fence 테스트 2건 green | send.ts → buildTurnRequest → queue |
| R-02 | UT-03 / AC8 | coordinator는 재시도 조건이 모두 참일 때만 재개방 가능 여부를 묻고, backoff 뒤 재개방한다. 재시도마다 `chat.turn.retrying` warn(시도 번호·분류·메시지)을 남긴다 | fakeRuntime + 위임 spy B1~B10, 로그 spy | coordinator |
| R-02 | UT-06 / AC9 | spawn 경로에서 admission이 거부되면 `engine.spawn.started`를 남기지 않고, 도구 컨텍스트를 만들지 않고, `sendMessage`를 부르지 않는다 | `SessionRuntime` + 로그 spy | runtime spawn 경로 |
| R-03 | AT-03·UT-04·UT-05 / AC10 | Claude 설정 파일이 없거나 0바이트·공백·BOM·`null`이면 `{}`와 같은 결과이고 경고가 없다 | spawn·nav 실제 경로 + 리더 단위 | `sendMessage` · `orca:extensions:catalog` |
| R-03 | AT-03·IT-03·UT-05 / AC11 | 내용이 있는데 읽거나 파싱할 수 없는 설정 파일은 결과가 "그 파일 없음"과 같고, 같은 파일 상태에서 경고는 1회다. 경고에는 경로가 있고 파일 내용이 없다 | 14 호출 자리별 깨진 입력 → 결과 = 파일 없는 실행, report spy 1회·detail에 경로 포함·비밀 문자열 미포함 | 같음 |
| R-03 | IT-03 / AC12 | 깨진 `plugin.json`을 가진 플러그인은 목록·실행 플러그인 루트에서 빠지고 다른 플러그인은 남는다 | manifest 3자리 입력 | 같음 |
| R-03 | UT-04 / AC13 | 쓰기 경로는 빈 파일 위에는 저장하고, 내용이 있는 깨진 파일은 저장을 거부하고 파일을 바꾸지 않는다. `project-settings`도 깨진 내용에서 지금처럼 오류다 | `plugin-state.test.ts`·`json-file.test.ts` | Windows 플러그인 토글 저장 |
| R-04 | AT-04 / AC14 | 플러그인 탭 목록 조회가 실패해도 탭 영역에 안내 행·다시 시도 버튼이 없다. 백엔드별 실패 진입 시 `skills.native.load-failed` 토스트 1회, 실패가 이어지면 반복 없음, 회복 뒤 다시 실패하면 1회 | hook 테스트 호출 횟수 + View 상호작용 테스트 DOM + report site 레지스트리 | `/plugins` → `useNativeMcpCatalog` → `orca:extensions:catalog` |
| R-04 | IT-04 / AC15 | `orca:session:native-resources`가 reject할 때 메시지가 "하네스 목록을 불러오지 못했습니다"와 원래 원인 문구를 함께 담는다 | 핸들러 테스트 2자리 | composer 목록 → handler |
| — | gate / AC16 | 현재 상태 문서 5곳이 바뀐 동작을 서술하고 인벤토리 가드를 통과한다 | `node scripts/check-doc-inventory.mjs --check` + 문서 대조 | §18 문서 |
| R-01~R-04 | 사람 / AC17 | Windows 실기: (a) 응답 중 `cd <하위폴더>`가 있던 세션을 앱 재시작 뒤 이어 보내기 (b) 빈 `~/.claude/settings.json`에서 플러그인 탭 배너 없음 + 전송 (c) 끝 쉼표 `settings.json`에서 경고 토스트 1회 + 전송 (d) 플러그인 탭 레이아웃 white/dark (e) ΔV1: 시작 단계 동기 실패(예: 읽을 수 없는 플러그인 스킬 파일)에서 말풍선이 사라지고 입력창에 원문이 돌아옴 white/dark | 사람 확인 | 실제 CLI 기록·실제 Windows 파일 |
| R-05 | AT-05 / AC18 | 기존 세션의 첫 spawn이 동기 실패하면 원래 오류 1회 뒤 체인이 끝나고, 그 입력은 대기열에 없으며 `message.cancelled`(ids = 그 전송의 `clientRequestId`) 1회가 나간다. 같은 세션의 다음 전송 프롬프트에 그 입력이 없다 | §7-A ΔV1 VP-16 main 좌표 + VP-19 (ii) | `chat:send` → `handleChatSend` → post-turn I1 → finally J1 → `message.cancelled` → `chatStore` K1 |
| R-05 | IT-05 / AC19 | renderer는 main이 보낸 `message.cancelled`의 id로 그 전송의 낙관 말풍선을 찾아 지우고 원문을 입력창 복원 신호로 낸다. 규칙은 producer를 가리지 않는다(준비 중 Stop·준비 실패·세션 폐기 포함) | VP-17: store 실제 전송 경로가 만든 말풍선 + 같은 id 이벤트 | J1 → IPC → K1 |
| R-05 | UT-07 / AC20 | post-turn은 직전 턴 입력이 held로 돌아왔고 그 턴이 중단되지 않았을 때만 체인을 끝낸다. 즉시 보내기 중단·다른 held·정상 종료 뒤 flush는 그대로이고, flush 턴이 동기 실패해도 같은 규칙이다 | VP-18 입력 (i)~(iv) | `runTurnWithContinuations` |
| R-05 | UT-08 / AC21 | renderer `message.cancelled`: pending 항목은 지금처럼 지우고, 같은 `clientId`의 사용자 말풍선도 지운다. 복원 텍스트는 말풍선 → pending 순 `\n\n` 결합이며, 매칭이 없으면 복원 신호도 없다 | VP-19 입력 (i)~(v) | `chatStore` |

### AC 검증 주의사항

- 기존 테스트 재사용: `opencode-runtime.test.ts`의 `'rejects a withdrawn reservation in the runtime before contacting the provider'`·`'delivers a reply after runtime admission for session %s'`(커밋 뒤 admission false), `session-runtime.test.ts`의 `'후속 제출은 queue fence를 먼저 통과하고 accepted 뒤에만 commit한다'`가 있다(이번 세션 확인). AC7 fence 유지의 회귀 증거다.
- 바뀌는 기존 잠금: `plugin-catalog.test.ts`의 `'reports invalid configuration without its contents and leaves absent installations empty'`와 같은 파일 async 비교 케이스의 reject 단언, `configured-resources.test.ts`의 `'distinguishes absent metadata from malformed data with a redacted error'`. reject 기대는 D-011로 "결과 = 파일 없음 + 경고 1회"가 되고, 내용 비노출 단언은 경고 detail·로그에 그대로 남긴다.
- 사람 실기 항목: AC17은 실제 CLI가 쓰는 기록 형식과 Windows 파일·시각만 본다. 판정 로직은 전부 AC1~AC15의 자동 테스트다.
- N회 기준: 경고 1회는 "같은 파일 상태(경로+사유+내용 서명)당"으로 센다. 호출부는 §10 F행 14자리이고 관측은 `reportError` spy 하나다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` pair 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 | R | §7 AC1~AC3 세션 이어가기 | NEW | — |
| R-02 | R | §7 AC4~AC9 재시도 | NEW | — |
| R-03 | R | §7 AC10~AC13 설정 읽기 | NEW | — |
| R-04 | R | §7 AC14~AC15 실패 표시 | NEW | — |
| AT-01~AT-04 | AT | 위 R별 인수 | NEW | — |
| SD-01 | SD | §5 상태표·§13 예약 수명주기 | NEW | — |
| ST-01 | ST | AC6 | NEW | — |
| AR-01 | AR | §10 A행 원본 확인 비교 edge | NEW | — |
| AR-02 | AR | §10 B행 요청 위임 ↔ queue | NEW | — |
| AR-03 | AR | §10 F행 Claude 리더 ↔ 정책 모듈 | NEW | — |
| AR-04 | AR | §10 H행 목록 핸들러 메시지 | NEW | — |
| IT-01~IT-04 | IT | 위 AR별 통합 | NEW | — |
| MD-01 | MD | 세션 경로 규칙 함수 | NEW | — |
| MD-02 | MD | queue 재개방 | NEW | — |
| MD-03 | MD | coordinator 재시도 gate·로그 | NEW | — |
| MD-04 | MD | 빈 내용 규칙 + 쓰기 엄격 | NEW | — |
| MD-05 | MD | 설정 파일 리더 정책·경고 1회 | NEW | — |
| MD-06 | MD | runtime spawn admission 순서 | NEW | — |
| UT-01~UT-06 | UT | 위 MD별 단위 | NEW | — |

### Pair registry

| Pair | left ↔ right | req. | production path | 직접 oracle (자리별 좌표 · 분기 입력) | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `chat:send` → `resolveTurn`(`resolve-turn.ts:139`) → `prepareNativeSession`(`native-session.ts:47`) → `ClaudeAdapter.readHistory`(`adapter.ts:356`) → A1·A2 → ready면 `sendMessage` resume(`adapter.ts:652`) / missing면 `recoverSession` | 신규 `app/src/main/app/chat-turn/native-session.claude-transcript.test.ts` — (a) 존재 하위폴더 drift (b) 삭제 하위폴더 drift → `ok:true`·resume 옵션 (c) relocated 다른 실재 경로 (d) relocated 없는 경로 → `ok:false`·작업 경로 문구. 네 입력 모두 `recoverSession` spy 0 | not selected — 반환값·spy가 직접 관측 | A (2) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `runTurnWithContinuations` → `TurnCoordinator.run` → `SessionRuntime.send` → spawn → 실패 → B5 → `turn.retrying` → backoff → B6 → 재spawn | 신규 `app/src/main/app/chat-turn/retry-submission.test.ts`(concurrency fixture에 초기 예약 옵션 추가). A: 1번째 eventBatches가 첫 batch 전 throw, 2번째 정상 → `turn.retrying`·종료·`error` 없음·spawn 2. B: 세 번 모두 비동기 실패 → `turn.retrying`×2·`error.message`=원래 문구·spawn 3. C: 1번째 `sendMessage` 동기 throw("Claude 네이티브 확장 설정을 읽을 수 없습니다.") → `turn.retrying` 0·원래 문구·spawn 1. D: `turn.retrying` 직후 `orphanUnconfirmed('s1')` → 원래 문구·spawn 1. A~D 모두 `submission_stale:` 오류 0 | not selected | B (8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | spawn: `sendMessage` → `claudePluginDefaults`(`adapter.ts:449`)·`readClaudePluginCatalog`(`adapter.ts:615`) → F자리 → query 옵션. nav: `orca:extensions:catalog` → `harnessModule('claude').globalResources` → `globalClaudeResources` → F자리 | 신규 `app/src/main/adapters/claude/adapter.native-settings.test.ts`(SDK `query` mock, `CLAUDE_CONFIG_DIR` fixture) — 0바이트 settings → throw 없음·report 0. 깨진 settings → throw 없음·report 1·두 번째 전송 뒤에도 1. 깨진 manifest 플러그인 → 옵션 `plugins`에 그 루트 없음·다른 루트 있음. 신규 `app/src/main/app/handlers/extension-catalog.claude-settings.test.ts`(실제 registry, 격리 HOME) — 빈/깨진 `~/.claude/settings.json`에서 `read('claude')` resolve | not selected | F (15) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `/plugins` → `ExtensionsCatalogView` → `useNativeMcpCatalog.refreshBackend` → `sessionApi.globalExtensions` reject → G2 → `reportError` | `useNativeMcpCatalog.test.ts` 신규 케이스 — claude reject → reject(focus) → resolve → reject 순서에서 report 2회·event·title. `ExtensionsCatalogView.interaction.test.ts` 신규 케이스 — 실패 상태 mcp·providers 탭에 오류 문구·다시 시도 버튼 없음. `reportSites.registry.test.ts` 레지스트리 갱신 | required — G1 배너 행을 되살리면 View 케이스 red, G2 전이 조건을 지우면(매 실패 report) hook 케이스 red | G (3) |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | VP-02 경로 + `chatCancel` 핸들러 | `retry-submission.test.ts` — A에서 `pendingMessages.subscribe` 리스너가 변경마다 표본(`hasSubmitted`·`canCommitMany`)을 기록 → 순서 = submitted → submitting → submitted, backoff 동안 변경 0. E: `turn.retrying` 직후 `f.stop()` → spawn 1·`hasSubmitted` 참·`error` 없음. C 뒤 `pending('s1')` 1 | not selected | B (8) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | `readClaudeNativeHistory` → A1 → A2 → status | `native-history.test.ts` 신규 it.each — I1 존재 하위폴더 drift→ready · I2 삭제 하위폴더 drift→ready · I3 처음=다른 실재 폴더·마지막=요청 cwd→unavailable · I4 relocated 다른 실재→unavailable · I5 처음=다른 폴더·relocated=요청 cwd→ready · I6 relocated 없는 경로→unavailable(missing 아님). 기존 `'does not read a different cwd or substitute an invalid ID'` 유지 | required — A1 규칙을 "마지막 cwd"로 되돌리면 I1 red, "아무 항목이나 일치"로 바꾸면 I3 red | A (2) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `send.ts:568` `buildTurnRequest` → B3·B4 → queue B1·B2 · flush `buildFlushRequest`(B8) | 신규 `app/src/main/app/chat-turn/turn-request.reopen.test.ts` — W1 저장 세션(`dbSessionId:'s1'`, `queueKey:'q-other'`) · W2 새 세션(`dbSessionId:null`, `queueKey:'new:1'`) · W3 생성 뒤 `getInitialBatches`가 새 배치를 돌려줌(옛 배치는 confirmed): commit → canReopen 참 → reopen 참 → `canSubmitInitial` 참. `continuation.test.ts` 신규 W4 — `buildFlushRequest({base})`의 두 위임이 base와 동일 | not selected | B (8) |
| VP-08 | AR-03 ↔ IT-03 | REQUIRED | 리더 호출 14자리 → F정책 → 각 함수 결과 | `plugin-catalog.test.ts`·`configured-resources.test.ts` it.each — 14자리마다 {0바이트, 깨진 JSON(비밀 문자열 포함)} 입력. 설정 문서 11자리: 결과 = 그 파일만 없는 실행 결과, report 0/1. manifest 3자리: 그 플러그인만 결과에서 빠짐, report 0/1. 깨진 입력의 report detail에 경로 포함·비밀 문자열 미포함 | required — 자리 하나를 기존 엄격 리더로 되돌리면 그 자리 깨진 입력 red | F (15) |
| VP-09 | AR-04 ↔ IT-04 | REQUIRED | `orca:session:native-resources` → `read`(H1) / `readRequest` catch(H2) → reject | `session-resources.test.ts` 신규 — H1: configured가 `Error('원인-가')`로 reject·live 없음 → 메시지에 고정 문구와 `원인-가`. H2: 초안 조회가 `Error('원인-나')`로 throw → 메시지에 `원인-나` | not selected | H (2) |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | 규칙 함수 단독 | 신규 `app/src/main/adapters/claude/transcript-cwd.test.ts` — C1 relocated 없음·처음 A·뒤 B → A · C2 중간 relocated R 뒤 B → R · C3 R1 뒤 R2 → R2 · C4 빈/비문자열 relocatedCwd만 → 처음 cwd · C5 문자열 cwd·relocated 없음 → undefined · C6 첫 항목 cwd 없음·둘째 A → A · C7 유효 R1 뒤 빈 relocated → R1 | not selected | A (2) |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | queue 메서드 단독 | `pending-message-queue.test.ts` 신규 — Q1 전부 submitted → 참·submitting·uuid/attemptId/chainId 불변·변경 통지 1 · Q2 전부 submitting → 참·통지 0 · Q3 혼합 → 참·전부 submitting · Q4 하나 confirmed → 거짓·불변 · Q5 하나 orphaned → 거짓·불변 · Q6 held로 rollback됨 → 거짓·held 불변 · Q7 chainId 또는 messageIds 불일치 → 거짓 · Q8 빈 claim → 참. `canReopenMany`는 같은 입력에서 같은 참/거짓이며 상태를 바꾸지 않는다 | not selected | B (8) |
| VP-12 | MD-03 ↔ UT-03 | REQUIRED | coordinator 단독 | `turn-coordinator.test.ts` 신규 describe — B1 재시도 가능·이벤트 0·시도 0·canReopen 참·reopen 참 → 호출 순서 canReopen → `turn.retrying` → (타이머) → reopen → 2번째 send, warn 1 · B2 canReopen 거짓 → `turn.retrying` 0·reopen 0·원래 오류·send 1·warn 0 · B3 canReopen 참·reopen 거짓 → `turn.retrying` 1·원래 오류·send 1 · B4 이벤트>0 → canReopen 0 · B5 stale 오류 → canReopen 0 · B6 비재시도 오류 → canReopen 0 · B7 세 번 실패 → canReopen 2·최종 = 3번째 오류 · B8 listen 턴 → 위임 0·재시도 · B9 위임 없는 요청 → 재시도(기존 `'재시도성 에러 + 첫 이벤트 전이면…'`) · B10 backoff 중 abort → reopen 0·send 1 | not selected | B (8) |
| VP-13 | MD-04 ↔ UT-04 | REQUIRED | `parseJsonObject` · `persistClaudePluginState` | `json-file.test.ts` 신규 — `undefined`·`''`·`'  \r\n'`·`'﻿'`·`'﻿ \n'`·`'null'`·`'{}'` → `{}` · `'[]'`·`'1'`·`'{"a":1'` → invalid. `plugin-state.test.ts` 신규 — latest `''`·`'null'` → enabledPlugins 저장 · latest 깨진 내용 → 저장 거부·파일 바이트 불변 | not selected | E (1) |
| VP-14 | MD-05 ↔ UT-05 | REQUIRED | 신규 리더 모듈 단독 | 신규 `app/src/main/adapters/claude/native-settings-file.test.ts` sync·async 각각 — 없음 → `{}`·report 0 · 빈 4종 → `{}`·0 · 유효 → 객체·0 · 파싱 실패 → `{}`·1 · 비객체(`[]`) → `{}`·1 · 경로가 디렉터리 → `{}`·1 · 같은 깨진 파일 두 번 → 1 · 내용이 다른 깨진 내용으로 바뀜 → 2. manifest 리더 — 없음 → `{}` · 빈 → `{}` · 깨짐 → `undefined`·1 | not selected | F (15) |
| VP-15 | MD-06 ↔ UT-06 | REQUIRED | `SessionRuntime.runAttempt` spawn 경로 | `session-runtime.test.ts` 신규 — `canSubmitInitial: () => false` → reject `submission_stale:before-spawn`, `sendMessage` 0, `getLogger().child('engine').info`의 `'engine.spawn.started'` 0, `rollbackInitialSubmission` 1 | not selected | C (1) |

### ΔV1 — verify r1 D2 · D-017

- V mode: Delta V. 기준 V = `0301-session-resume-cwd-retry:V1@01ca522`(설계 READY 커밋). 유효 V = V1 + ΔV1.
- 변경이 시작되는 수준: R(새 요구 R-05). `SUPERSEDED` 노드 없음 → 이관 해당 없음.
- verify r1 D1(VP-07 canReopen claim 항)은 계약 변경이 아니라 V1 이행 결함이다. 규칙 칸(AC7 "commit과 같은 세션 키·claim")은 그대로이고 재구현이 입력을 더한다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-05 | R | §7 AC18·AC19 시작 실패 입력 회수·복원 | NEW | — |
| AT-05 | AT | AC18 | NEW | — |
| SD-01 | SD | §5 상태표 ΔV1 행 — 체인 종료 시 회수 | CHANGED | V1 SD-01 |
| ST-01 | ST | AC6 + AC18 main 절반 | CHANGED | V1 ST-01 |
| AR-05 | AR | §10 J·K — main `message.cancelled` producer ↔ renderer 소비 | NEW | — |
| IT-05 | IT | AC19 | NEW | — |
| MD-07 | MD | §10 I post-turn 가드 | NEW | — |
| UT-07 | UT | AC20 | NEW | — |
| MD-08 | MD | §10 K renderer 소비 규칙 | NEW | — |
| UT-08 | UT | AC21 | NEW | — |
| R-02 | R | AC4·AC5 재시도 — post-turn 경로 공유 | INHERITED | V1 R-02 |

| Pair | left ↔ right | req. | production path | 직접 oracle (자리별 좌표 · 분기 입력) | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-16 | R-05 ↔ AT-05 | REQUIRED | `chat:send` → `handleChatSend`(`send.ts`) → `runTurnWithContinuations` → coordinator 실패 → runtime 동기 rollback(held) → I1 break → finally J1(회수 + `message.cancelled`) → renderer K1 | 신규 `app/src/main/app/chat-turn.returned-input.test.ts` — `registerChatHandlers` 조립 + **실제 `PendingMessageQueue`**(held 상태가 판정 입력이라 mock 금지). J(i): 기존 세션 `s1` 전송(`clientRequestId:'req-1'`, `질문-가`), `sendMessage` 1회차 동기 throw `Error('원래-오류')` → `error` 1(원래 문구) · `message.cancelled` 정확히 1(`sessionId:'s1'`, ids `['req-1']`) · `pending('s1')` 0 · `sendMessage` 1. 이어 `s1`에 `req-2` `질문-나`(정상) → 2회차 프롬프트에 `질문-가` 없음 · `sendMessage` 총 2 · 추가 `message.cancelled` 0. J(ii): 새 대화(`sessionId:null`, `req-3`) 동기 실패 → `message.cancelled` 0 · `pending('req-3')` 0(큐 키 = `clientRequestId`, `admission.ts:103`). J(iii): 정상 종료 → `message.cancelled` 0. J(iv): 최초 턴 정상 + 응답 중 예약 `req-5` → flush 턴 동기 실패 → `message.cancelled` ids `['req-5']` 1 | not selected — 이벤트·큐·spawn 수 직접 관측 | J (1) · I (2) |
| VP-17 | AR-05 ↔ IT-05 | REQUIRED | main J1 ids(= `clientRequestId`) → IPC → renderer K1(말풍선 `clientId` = 전송 `requestId`) | main 절반 = VP-16 J(i) ids 단언. renderer 절반 = `chatStore.test.ts` 신규 — store의 실제 전송 함수로 새 메시지를 보내(`chatApi.send` mock, resolve) 낙관 말풍선을 만든 뒤, 그 `chatApi.send` 호출 인자의 `clientRequestId`로 `message.cancelled`를 받으면 말풍선 0 · `draftRestore.text` = 보낸 원문 | not selected | J (1) · K (1) |
| VP-18 | MD-07 ↔ UT-07 | REQUIRED | `runTurnWithContinuations` 반복 상단 I1 → step | `retry-submission.test.ts`(실제 post-turn 조립). (i) 기존 `'C …'`: 동기 실패 → spawn 1 · `turn.retrying` 0 · `pending('s1')` 1. (ii) 신규 F: 1회차 `sendMessage` 안에서 그 턴의 `abortContinuation='send-now'` 설정·abort 뒤 동기 throw → flush로 spawn 2 · 2회차 입력에 `question` 포함. (iii) 기존 `chat-turn.execution-config.test.ts:'chat:send execution configuration from the selected engine document (0262) runs opencode-local with its own document and model on the initial and automatic flush turn'` — 정상 종료 뒤 다른 held flush. (iv) 신규 H: 최초 턴 정상 + 응답 중 held 1 → flush 턴 동기 throw → spawn 2 · `pending` 1(flush 입력) · 3번째 spawn 없음 | required — PT1(break 대입 제거) → (i) red · PT2(중단 항 제거) → (ii) red · PT3(held 판정 → `true`) → (iii) red · I2(`getInitialBatches` → `[]`) → (i) red · flush 배치 대신 최초 배치를 보게 하는 변이 → (iv) red | I (2) |
| VP-19 | MD-08 ↔ UT-08 | REQUIRED | `chatStore` `case 'message.cancelled'` 단독 | `chatStore.test.ts` 신규 — (i) pending 항목만(`p-1` `예약-나`) → pending 제거 · draft `예약-나`(기존 동작) (ii) 말풍선만(`clientId:'req-1'` `질문-가`) → 말풍선 제거 · draft `질문-가` (iii) 말풍선 `req-1` + pending `p-1` → 둘 다 제거 · draft `질문-가\n\n예약-나` (iv) 매칭 없음 → messages·pending·`draftRestore` 불변 (v) ids에 없는 말풍선 `req-0`은 남음 | not selected | K (1) |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED (CHANGED) | V1 경로 + finally J1 | V1 좌표 유지 + VP-16 J(i)의 `pending('s1')` 0 · `message.cancelled` 1(공유 증거 — 체인 종료 뒤 상태 범위) | not selected | B (8) · J (1) |
| VP-02 | R-02 ↔ AT-02 | REGRESSION | V1 경로(post-turn 공유) | V1 좌표 `retry-submission.test.ts:'A'~'E'` 재실행 green | not selected | B (8) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 (cwd=`app`) | 실패 범위 |
|---|---|---|---|
| app 로컬 확인 전체 | `app/**` 코드·테스트를 추가·수정한다 | `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(파일 필터 없음) · `node --test scripts/*.test.mjs` | 현재 변경이 유발한 실패와 추가·수정 파일의 규칙 가드 실패만 blocking |
| 추가·수정 테스트 subtree 규칙 | 테스트 파일을 추가·수정한다 | 시간 예산(`scaledBudget`/`scaleMs`) · 호스트 격리(홈·env 명시 주입) · 풀 분류(`[test-pools]` 0) | 추가·수정 파일 위반 0 |
| commit trailer 파싱 | 설계·구현 커밋 | `git log -1 --format='%(trailers:only=true)'` | 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| ID | 발견 / 제약 | 근거 |
|---|---|---|
| R-01 | Orca는 기록 항목 전체에서 **마지막** `cwd`(relocated면 `relocatedCwd`)를 저장 cwd와 비교한다 | `native-history.ts:234-245` |
| R-02 | CLI 항목별 `cwd`는 `getCwd()`(=`getStore()?.cwd ?? 상태값`)라 Bash `cd`로 바뀐다. SDK의 세션 경로는 `Rf(tail,"relocated","relocatedCwd") ?? qS(head,"cwd")` = 마지막 relocated ?? **첫** cwd | SDK 0.3.296 `sdk.mjs` `HI`·`XN`, CLI 2.1.296 바이너리 `oFn(){return{cwd:se()…}}`, `se(){try{return con()}…}` |
| R-03 | 재현(임시 테스트, 커밋 안 함): 마지막 항목 `cwd`=하위폴더 → `unavailable` "작업 경로가 저장된 세션과 일치하지 않습니다." · 하위폴더가 삭제됨 → `missing` | `readClaudeNativeHistory` 직접 호출 2건 출력 |
| R-04 | `missing`이면 send 경로가 보관 대화로 새 native 세션을 만든다 | `native-session.ts:54-86` |
| R-05 | 턴 재시도는 coordinator가 소유한다(`MAX_RETRIES=2`, backoff 1s·2s). 조건은 재시도 가능·비stale·이벤트 0·한도 미만·비중단 | `turn-coordinator.ts:38-39,582-606` |
| R-06 | spawn 경로는 `canSubmitInitial()` 거짓이면 `submission_stale:before-spawn`이고, 이 검사는 `submitting`만 통과한다. commit은 `submitting`→`submitted`, rollback은 `submitting`→held | `session-runtime.ts:486-497` · `pending-message-queue.ts:271-317` |
| R-07 | 재현(실제 SessionRuntime·queue·coordinator, 커밋 안 함): 비동기 실패는 spawn 1·`turn.retrying`(stream_error) 뒤 `error`(provider_connection_error, "submission_stale:before-spawn")·대기 1. 동기 실패는 같은 오류에 held 1 | 임시 테스트 2종 출력 |
| R-08 | 기존 재시도 테스트는 가짜 runtime이거나 초기 배치가 빈 요청이라 이 조합을 실행하지 않았다 | `turn-coordinator.test.ts:1154` · `concurrency-identity.test.ts:144`(`initialBatches=[]`) |
| R-09 | `before-spawn` 문구가 Claude 분류 패턴 `/\bspawn\b/i`에 걸려 연결 오류(재시도 가능)로 표시된다 | `error-classifier.ts:16` |
| R-10 | `engine.spawn.started`는 admission 검사보다 먼저 기록된다 | `session-runtime.ts:477` → `:486` |
| R-11 | spawn은 `sendMessage` 안에서 동기로 Claude 설정 JSON을 엄격히 읽는다. 없음(ENOENT)만 `{}`이고 읽기 오류·파싱 실패·비객체는 throw한다 | `adapter.ts:449,615` · `plugin-catalog.ts:16-20` · `json-file.ts:10-46` |
| R-12 | 실측: `settings.json` 없음·`{}` → spawn·nav 정상. **0바이트·공백·BOM만·`null`·끝 쉼표·UTF-16 → 둘 다 실패**. OpenCode 설정 없는 HOME의 `globalOpenCodeResources` → `[]` | 임시 테스트 출력 |
| R-13 | CLI는 깨진 설정을 건너뛴다: "… could not be parsed, so what it sets cannot be checked", "Managed settings document could not be parsed … none of its settings are in effect", "Check manifest file syntax in the plugin directory", "installed_plugins.json could not be read and was rebuilt" | CLI 바이너리 문자열 |
| R-14 | main이 목록 실패 원인을 고정 문구로 덮는다 | `session-resources.ts:72,183` |
| R-15 | 플러그인 탭 배너는 `nativeMcp.failed`일 때 mcp·providers 탭 tabpanel 안에 상태 행과 다시 시도 버튼을 렌더한다 | `ExtensionsCatalogView.tsx:139-146` |
| R-16 | hook은 두 백엔드를 각각 조회하고 실패를 `failures` 집합에 담는다. 창 focus·변경 push마다 다시 조회한다. 실패 catch는 report site 레지스트리에 `CONSUMED`로 등록돼 있다 | `useNativeMcpCatalog.ts:48-92`(catch `:63`) · `reportSites.registry.test.ts`(ordinal 0) |
| R-17 | 깨진 설정 reject를 잠근 기존 테스트 3건이 있고 내용 비노출도 함께 잠근다 | `plugin-catalog.test.ts`(`'reports invalid configuration without its contents…'`, async 비교 케이스) · `configured-resources.test.ts`(`'distinguishes absent metadata from malformed data with a redacted error'`) |
| R-18 | Claude 설정 쓰기는 `persistClaudePluginState` 하나이며 `parseJsonObject`로 엄격히 읽어 깨진 파일 저장을 거부한다 | `plugin-state.ts:8-35` |
| R-19 | 엄격 읽기가 spawn 경로에 들어온 것은 2026-10-20이다(0259는 10-12) | `git log -S` → `1521ac9d`, 공용화 `2c220b2d` |
| R-20 | main 경고 토스트 선례: `providers.settings.parse-failed`(`configInvalid`, warn) — 같은 제목·detail은 1초 throttle만 있다 | `settings.ts:25-40` · `error-report/hub.ts:20-25` |

### 전수 조사

| 대상 | 검색/방법 (repo root) | N | 의미 |
|---|---|---:|---|
| 기록 `cwd` 해석 자리 | `rg -n "relocatedCwd\|\bentry\.cwd\b" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` | 1 | `native-history.ts:235`뿐 |
| 초기 제출 위임 자리 | `rg -n "InitialSubmission\|canSubmitInitial" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` | 17 | 타입 3 · Omit 3 · 구현 3 · runtime 5 · send 1 · opencode 1 · 주석 1 |
| Claude 설정 리더 호출 | `rg -n "readObject(Async)?\(" app/src/main/adapters/claude -g '!*.test.ts' -g '!*.testfixture.ts'` | 14 | 설정 문서 11 + `plugin.json` 3 |
| 엄격 JSON 리더 사용처 | `rg -n "readJsonObject(Sync)?\(\|parseJsonObject\(" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` | 5 (정의 제외) | 위 리더 3모듈 + `project-settings.ts:11` + `plugin-state.ts:19` |
| 목록 실패 고정 문구 | `rg -n "하네스 목록을 불러오지 못했습니다" app/src/main -g '!*.test.ts'` | 2 | `session-resources.ts:72,183` |
| 플러그인 탭 실패 표시 | `rg -n "chat.nativeResources.error\|nativeMcp.failed\|failures.current" app/src/renderer/src -g '!*.test.*'` | 6 | View 3 · hook 3 |
| spawn 기록 순서 | `rg -n "submission_stale:before-spawn\|engine.spawn.started" app/src/main -g '!*.test.ts'` | 2 | `:477` started → `:487` 검사 |
| `readHistory` 호출부 | `rg -n "readHistory!?\(" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` | 4 (정의 2 + 호출 2) | 호출 `native-session.ts:47`(send) · `app/native-history.ts:40`(화면) |

### 수치 / 전칭 표현 검산

- 초기 제출 위임 17 = 3+3+3+5+1+1+1 (검산 일치).
- 리더 호출 14 = `configured-resources.ts` 9(67·68·69·70·71·72·132·147·156) + `plugin-catalog.ts` 5(26·278·291·324·338).
- "쓰기는 하나뿐": `rg -n "settings(\.local)?\.json" app/src/main/adapters/claude -g '!*.test.ts' -g '!*.testfixture.ts'` 출력 중 쓰기는 `plugin-state.ts:14` 1(`mutations.mutate`), 나머지는 읽기·주석이다. `writeJsonAtomic` 사용처 6곳은 Claude native 파일이 아니다(`scaffold.ts`는 provider settings).
- 문서 앵커 확인: `runtime-ipc.md:94`, `persistence.md:188`, `adapters.md:82,151`, `IPC_CONTRACT.md:194,196,267`, `design-system.md:187`, `design-components.md:390` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01~AR-04.
- 현재 책임 소유자: 세션 경로 판정 `native-history.ts` 인라인 · 재시도 `TurnCoordinator` · 예약 fence `PendingMessageQueue`·`turn-request.ts` · 설정 읽기 각 모듈의 `readObject` 래퍼 + `json-file.ts`.
- 문제의 직접 원인: R-01(마지막 cwd) · R-06(재시도가 `submitted`/held 예약으로 admission) · R-11(빈·깨진 파일 throw) · R-14·R-15(원인 은폐·인라인 배너).

```text
[케이스 1] prepareNativeSession → readClaudeNativeHistory
  → latestCwd = findLast(cwd|relocatedCwd) → realpath(ENOENT→catch→missing) → samePath → unavailable
[케이스 2] coordinator attempt0: runtime.send → canSubmitInitial(submitting) → sendMessage
  ├ 동기 throw(설정 읽기) → rollback(held) → engine.spawn.failed
  └ 비동기 frame 실패(0 이벤트) ← commit(submitted)
  → retryable·0 이벤트 → turn.retrying → backoff → runtime.send
  → engine.spawn.started → canSubmitInitial 거짓 → submission_stale:before-spawn → error(연결 오류)
[추가] readObject: ENOENT→{} | 빈·깨짐·비객체·읽기오류 → throw
  → spawn 실패 · globalClaudeResources reject → hook failures → 탭 tabpanel 배너
  → session-resources catch → "하네스 목록을 불러오지 못했습니다"(원인 소실)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임 소유자: 세션 경로 규칙 `transcript-cwd.ts`(신규) · 재개방 `PendingMessageQueue.canReopenMany`/`reopenMany` + `turn-request.ts` 위임 + coordinator gate · Claude 설정 읽기 정책 `native-settings-file.ts`(신규) · 빈 내용 규칙 `json-file.ts`.
- 유지: fence(D-008), backoff·한도, relocated 차단(D-003), 쓰기 엄격(D-014), 기존 토스트 경로.

```text
[케이스 1] readClaudeNativeHistory → claudeTranscriptCwd(entries)
  → realpath(transcriptCwd) (ENOENT·실패 → unavailable) → samePath → ready|unavailable
[케이스 2] attempt 실패 → retryable·비stale·0 이벤트·한도·비중단
  → pushesInput ? request.canReopenInitialSubmission?.() : true
      거짓 → 원래 오류로 실패 처리
      참 → warn chat.turn.retrying → turn.retrying → backoff
         → pushesInput ? request.reopenInitialSubmission?.() : true
             거짓 → 원래 오류로 실패 처리 / 참 → 다음 attempt
  runtime spawn: admission 검사 → (거부면 rollback·throw, 기록 없음) → engine.spawn.started → …
[추가] readClaudeSettingsObject(file): 없음·빈 → {} | 깨짐·비객체·읽기오류 → {} + 경고(서명당 1회)
       readClaudePluginManifest(root): 없음·빈 → {} | 깨짐 → undefined(플러그인 제외) + 경고
  hook 실패 → (백엔드가 실패 집합에 처음 들어갈 때만) reportError → 토스트 · 탭 영역 무변화
  session-resources reject 메시지 = 고정 문구 + 원래 원인
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 연결 |
|---|---|---|---|---|
| 책임/소유권 | 경로 규칙 인라인 | 규칙 함수 분리(SSOT) | 단위 분기 잠금 | MD-01 / VP-10 · `transcript-cwd.ts` |
| data/control flow | 재시도가 admission에 막힘 | backoff 뒤 재개방 후 재spawn | D-005 | SD-01 / VP-02·05 · coordinator |
| state/contract | 예약 상태 전이에 `submitted→submitting` 없음 | 재시도 전용 재개방 전이 추가 | D-007·D-008 | AR-02 / VP-07·11 · queue·`turn.ts` |
| error/lifecycle | 깨진 설정 = 실행·목록 실패, 원인 은폐 | 파일 단위 건너뛰기 + 경고 1회, 원인 동반 | D-010·D-011·D-016 | AR-03·AR-04 / VP-03·08·09 |
| test seam/관측점 | 재시도 테스트가 초기 배치 없음 | 초기 예약을 가진 실제 조립 fixture | R-08 | VP-02·05 · fixture 옵션 |
| UI 배치 | tabpanel 상태 행 | 토스트(전이 1회) | D-012 | R-04 / VP-04 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/claude/transcript-cwd.ts` (adapter-impl, 신규) | 기록 항목 → 세션 경로 | `ClaudeHistoryEntry[]` → `string \| undefined` | `native-history.ts` |
| `adapters/claude/native-settings-file.ts` (adapter-impl, 신규) | Claude 설정·manifest 읽기 정책과 경고 1회 | 경로 → 객체 / manifest는 `undefined` 가능 | `plugin-catalog.ts`·`configured-resources.ts` |
| `infra/config/json-file.ts` | 빈 내용 = `{}` 규칙(SSOT) | 텍스트 → 객체 / invalid throw | 리더·`plugin-state.ts`·`project-settings.ts` |
| `features/chat/pending-message-queue.ts` | `canReopenMany`·`reopenMany` | claim → boolean | `turn-request.ts` |
| `app/chat-turn/turn-request.ts` | 두 위임을 commit과 같은 키·claim으로 조립 | — | `send.ts`, flush는 spread로 승계 |
| `features/chat/turn-coordinator.ts` | 재시도 gate·재개방 호출·재시도 로그 | — | `post-turn.ts` |
| `features/sessions/session-runtime.ts` | spawn admission을 기록·도구 컨텍스트보다 먼저 | — | coordinator |
| `app/handlers/session-resources.ts` | reject 메시지에 원인 동반 | — | IPC |
| renderer `useNativeMcpCatalog.ts` · `ExtensionsCatalogView.tsx` | 실패 전이 토스트 · 배너 제거 | — | `/plugins` |

## 10. 계약 / 타입 / 강제 지점

| 행 | V / pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 (repo root) | 실패 의미 |
|---|---|---|---|---|---|---|
| A | AR-01·MD-01 / VP-01·06·10 | 세션 경로 = 마지막 유효 relocated ?? 처음 문자열 cwd. 기록 경로를 찾을 수 없으면 unavailable | `transcript-cwd.ts` | A1 `transcript-cwd.ts:claudeTranscriptCwd` · A2 `native-history.ts:readClaudeNativeHistory` 비교(경로 해석 실패→unavailable 포함) — 2 | `rg -n "relocatedCwd\|\bentry\.cwd\b\|claudeTranscriptCwd" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` → A1 정의 행 + A2 호출 행 | 이동한 세션 이어가기 실패 또는 원본 있는데 새 세션 복구 |
| B | AR-02·MD-02·MD-03·SD-01 / VP-02·05·07·11·12 | 재시도 전 같은 claim의 예약을 `submitting`으로 되돌릴 수 있을 때만 재시도하고, 재개방은 backoff 뒤 | queue 두 메서드 | B1 `pending-message-queue.ts:canReopenMany` · B2 `:reopenMany` · B3 `turn-request.ts` `canReopenInitialSubmission` 위임 · B4 `reopenInitialSubmission` 위임 · B5 `turn-coordinator.ts` backoff 전 검사 · B6 backoff 뒤 재개방 · B7 `chat.turn.retrying` warn · B8 `continuation.ts:66` `...input.base` 승계 — 8 | `rg -n "eopen(InitialSubmission\|Many)\|chat\.turn\.retrying" app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'` 출력에서 `adapters/common/turn.ts` 타입 2행·`turn-request.ts` Omit 2행을 뺀 나머지를 B1~B7에 대응(한 자리가 여러 행이면 묶는다, 대응 없는 행 0) + `rg -n "\.\.\.input\.base" app/src/main/app/chat-turn/continuation.ts` 1행 = B8 | 재시도가 stale로 끝남 / 남의 예약 재개방 / 헛된 재시도 표시 |
| C | MD-06 / VP-15 | spawn admission 거부는 `engine.spawn.started` 이전 | `session-runtime.ts` | C1 `runAttempt` spawn 경로 admission — 1 | `rg -n "submission_stale:before-spawn\|engine.spawn.started" app/src/main -g '!*.test.ts'` → 검사 행 번호 < 기록 행 번호 | 띄우지 않은 시도가 started로 기록 |
| E | MD-04 / VP-13 | 빈 내용(BOM·공백 제거 뒤 빈 문자열, JSON `null`) = `{}` | `json-file.ts:parseJsonObject` | E1 `parseJsonObject` — 1 (사용처 `readJsonObject`·`readJsonObjectSync`·`plugin-state.ts:19`는 승계 경로) | `rg -n "parseJsonObject\(" app/src/main -g '!*.test.ts'` | 빈 파일이 실행·저장을 막음 |
| F | AR-03·MD-05 / VP-03·08·14 | Claude 설정 문서 읽기 실패 = `{}` + 경고 1회. manifest 실패 = 그 플러그인 제외 + 경고 1회. 경고는 경로·사유만 | `native-settings-file.ts` | 문서 11: `configured-resources.ts:67,68,69,70,71,72,147,156` · `plugin-catalog.ts:26,278,324`. manifest 3: `configured-resources.ts:132` · `plugin-catalog.ts:291,338`. 정책 모듈 경고 서명 1 — 15 | `rg -n "readObject(Async)?\(\|readClaude(Settings\|PluginManifest)" app/src/main/adapters/claude -g '!*.test.ts' -g '!*.testfixture.ts'` → 호출 14 + 정책 모듈 정의 | 깨진 파일 하나가 실행·목록 전체를 막음 / 반복 토스트 / 내용 노출 |
| G | R-04 / VP-04 | 플러그인 탭 실패는 tabpanel에 렌더하지 않고 실패 진입 시 토스트 1회 | hook | G1 `ExtensionsCatalogView.tsx` 배너 제거 · G2 `useNativeMcpCatalog.ts` catch 전이 report · G3 `reportSites.registry.test.ts` 등록 — 3 | `rg -n "chat.nativeResources.error\|nativeMcp.failed\|skills.native.load-failed" app/src/renderer/src` | 레이아웃 밀림 / focus마다 토스트 |
| H | AR-04 / VP-09 | 목록 reject 메시지 = 고정 문구 + 원래 원인 | `session-resources.ts` 단일 helper | H1 `:72` · H2 `:183` — 2 | `rg -n "하네스 목록을 불러오지 못했습니다" app/src/main -g '!*.test.ts'` → 2행이 같은 helper 경유 | 원인 소실 |
| I | MD-07 / VP-18·VP-02 | 직전 턴(최초 또는 flush 턴)이 연 입력 배치 중 하나라도 held에 있고 그 턴이 중단(abort)되지 않았으면 이번 post-turn 반복은 `break`. 중단됐으면 기존 판정(즉시 보내기는 flush). 직전 입력이 held에 없으면 기존 판정 | `post-turn.ts` | I1 `post-turn.ts` `returnedInput` 계산과 `break` 대입 · I2 `send.ts` `getInitialBatches` 위임 — 2 | `rg -n "returnedInput\|getInitialBatches" app/src/main/app/chat-turn/post-turn.ts app/src/main/app/chat-turn/send.ts` → 6행: `post-turn.ts` 인터페이스 선언 1행 제외 · 계산·대입 3행 → I1 · `send.ts`의 `runTurnWithContinuations` deps 행 → I2 · `send.ts`의 `buildTurnRequest` deps 행은 B행 claim 원천이라 제외(그 밖 `turn-request.ts` 사용처도 B행) | 같은 실패 입력을 backoff 없이 반복 / 즉시 보내기 입력이 묶임 / 정상 예약이 안 나감 |
| J | AR-05·SD-01 / VP-16·VP-17·VP-05 | 체인이 끝날 때(최종 `rollbackInitialSubmission` 다음) 마지막 초기 배치의 id 중 held에 남은 것을 큐 키 `activeTurn.dbSessionId ?? turn.dbSessionId ?? queueKey`에서 빼고, 세션 ID가 있으면 그 ids로 `message.cancelled` 1회. 분기: (i) 세션 있음 → 회수 + 이벤트 (ii) 세션 없음 → 회수만 (iii) held에 없음(확정·orphaned·submitted·flush로 나감) → 아무것도 안 함 (iv) flush 턴이면 그 flush 배치가 대상 | `send.ts` finally | J1 `send.ts` 실행 try의 finally — 1 | `rg -n "message\.cancelled" app/src/main/app/chat-turn/send.ts` 출력 중 준비 중 Stop 블록(`if (turn.controller.signal.aborted)`)·준비 실패 블록(`if (!cleanupDone)`)의 2행을 뺀 1행 = J1 | 실패한 입력이 다음 전송 뒤 몰래 나감 / 말풍선·입력창 복원 없음 |
| K | MD-08·AR-05 / VP-19·VP-17 | `message.cancelled` 소비: ids 중 pending 항목을 지우고, pending에 없고 `role:'user'`·같은 `clientId`인 말풍선도 지운다. 복원 텍스트 = 말풍선들(메시지 순) → pending 항목들(기존 순), `\n\n` 결합. 하나라도 있으면 `draftRestore` 1회, 없으면 없음 | `chatStore.ts` | K1 `chatStore.ts` `case 'message.cancelled'` — 1 | `rg -n "case 'message.cancelled'" app/src/renderer/src -g '!*.test.*'` → 1행 | 말풍선이 남아 다시 보낸 입력이 두 번 보임 / 입력이 사라짐 |

- 자리 목록은 위 검색 출력과 차집합 0이어야 한다. 구현 뒤 행 번호가 바뀌면 같은 명령으로 다시 열거한다.
- **선언 경계**(측정 근거와 함께):
  - 이벤트 0건 실패 뒤 CLI가 입력을 이미 기록했다면, 재시도는 native 기록에 같은 입력을 한 번 더 남길 수 있다. 이 계약은 이벤트 0건을 미전달로 본다(기존 coordinator 조건 R-05·0154 재주입과 같은 가정, 측정 안 함 — 보호를 주장하지 않는다).
  - 경합으로 생긴 정당한 `submission_stale:*`의 화면 분류는 바꾸지 않는다(R-09). AC5는 재시도 경로에서 stale이 0임만 잠근다.
  - CLI는 relocated를 파일 꼬리 구간에서만 찾는다. Orca는 파일 전체에서 찾으므로 결과는 그 상위집합이다(R-02).
  - `project-settings.ts`는 내용이 있는 깨진 파일에서 지금처럼 오류다(D-014). 프로젝트 플러그인 제어가 그 동안 동작하지 않는다.
  - 플러그인 스킬 `.md`·OpenCode 설정의 읽기 실패 정책은 바꾸지 않는다(§6).
  - 토스트 detail의 Electron IPC 접두어("Error invoking remote method …")는 기존 공통 형식이다.
- **ΔV1 선언 경계**:
  - 새 대화(세션 ID 발급 전) — J(ii)는 renderer에 알리지 않는다. `message.cancelled`는 `sessionId` 필수(`shared/ipc.ts:595`)이고 준비 중 Stop도 같은 조건으로 생략한다(`send.ts:642`). 말풍선·오류가 남고 입력창 복원은 없다.
  - 첨부는 복원하지 않는다 — 기존 복원과 같이 텍스트만이다(`chatStore.ts:878`).
  - 비동기 실패(이벤트 0건)로 재시도를 다 쓴 입력은 `submitted`라 J 대상이 아니다. 체인 종료 시 orphaned로 늦은 확정을 기다린다(0154, `send.ts:717`).
  - 실패한 턴 동안 사용자가 예약한 다른 held(steer)는 J 대상이 아니다. 취소 가능한 예약 말풍선으로 남고 다음 체인에서 기존대로 이어진다.
  - K는 producer를 가리지 않는다. 준비 중 Stop(`send.ts:644`)·준비 실패(`send.ts:750`)·세션 폐기(`discard.ts:37`)의 턴 시작 입력도 말풍선이 지워지고 복원된다 — 세 자리의 주석이 이미 "복원"을 적는다(§12).
  - K의 전제: main은 확정(커밋)된 id로 `message.cancelled`를 내지 않는다. 확정 배치는 `drainConfirmed`로 큐에서 빠지고 `cancel`은 held만(`pending-message-queue.ts:183`), `discardSubmitted`는 open(미확정)만 지운다(`:430`).
- 열린 입력 집합 판정: 설정 파일 내용은 열린 입력이라 fail-closed 대신 결과 3분류(없음·빈 → `{}` 무경고 / 객체 → 사용 / 그 밖 전부 → `{}`·경고)로 닫는다. 모르는 형태는 전부 세 번째 칸이다.
- 같은 규칙의 SSOT: 빈 내용은 `parseJsonObject` 한 곳이다. 건너뛰기·경고는 `native-settings-file.ts` 한 곳이고, 세 리더 모듈의 `readObject` 래퍼를 이 모듈 호출로 바꾼다(정규식·판정 복제 금지).
- 선택적 필드 의미: `canReopenInitialSubmission`·`reopenInitialSubmission`이 `undefined`면 위임 없는 요청이라 기존처럼 재시도한다(B9). 둘 중 하나만 있는 조합은 `buildTurnRequest`가 만들지 않는다.
- 외부 SDK 경계: 제외된 플러그인 루트는 `options.plugins`에 넣지 않는다. CLI가 같은 manifest를 읽으면 그 플러그인을 어차피 로드하지 못한다(R-13).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude/transcript-cwd.ts` (신규) | MD-01 | `claudeTranscriptCwd(entries)` — 끝에서부터 `type==='relocated'`·`sessionId` 무관(신원 검사는 호출자)·`relocatedCwd`가 비지 않은 문자열인 첫 항목. 없으면 앞에서부터 `cwd`가 문자열인 첫 항목 | 순수 단위 |
| `app/src/main/adapters/claude/native-history.ts` | A2 | `:234-245`를 규칙 함수 호출로 교체. `realpath(transcriptCwd)`를 자체 try로 감싸 실패 시 기존 unavailable 문구 반환 | fs fixture |
| `app/src/main/adapters/common/turn.ts` | 계약 | `TurnRequest`에 `canReopenInitialSubmission?: () => boolean` · `reopenInitialSubmission?: () => boolean` 추가(주석: 같은 coordinator 실행의 재시도 전용, admission fence와 별개) | typecheck |
| `app/src/main/features/chat/pending-message-queue.ts` | B1·B2 | `canReopenMany(sid, claims)` = `selectAttempts(…, ['submitting','submitted'])` 전부 존재. `reopenMany` = 같은 검사 후 `submitted`만 `submitting`, 바뀐 것이 있으면 `changed` 1회. 상태도 주석에 `submitted ──retry reopen──→ submitting` 추가 | 단위 |
| `app/src/main/app/chat-turn/turn-request.ts` | B3·B4 | Omit에 두 키 추가. 두 위임은 `deps.getActiveTurn().dbSessionId ?? queueKey`와 `batchClaims()`를 commit과 같은 방식으로 쓴다. 소유권 이벤트는 보내지 않는다 | 통합(실제 queue) |
| `app/src/main/features/chat/turn-coordinator.ts` | B5·B6·B7 | catch에서 재시도 조건을 계산하고, `policy.pushesInput`이면 `request.canReopenInitialSubmission?.() !== false`를 마지막 항으로 둔다. 재시도면 `log.warn('chat.turn.retrying', {...turnMeta(), attempt, maxRetries, category, message})` → 기존 forward·backoff → `policy.pushesInput && request.reopenInitialSubmission?.() === false`면 같은 `err`·`error`로 실패 처리(기존 실패 블록을 함수로 묶어 두 곳에서 호출) | fakeRuntime 단위 |
| `app/src/main/features/sessions/session-runtime.ts` | C1 | spawn 경로의 `canSubmitInitial` 검사를 `engine.spawn.started` 기록·`ChannelToolContext` 생성 앞으로 옮긴다. 거부 시 `req.rollbackInitialSubmission?.()` 후 throw(현재 catch와 같은 정리) | 단위 + 로그 spy |
| `app/src/main/infra/config/json-file.ts` | E1 | `parseJsonObject`: BOM 제거·trim 뒤 빈 문자열이면 `{}`, 파싱 값이 `null`이면 `{}`. 나머지 규칙 불변 | 단위 |
| `app/src/main/adapters/claude/native-settings-file.ts` (신규) | F 정책 | `readClaudeSettingsObject(file)` · `readClaudeSettingsObjectAsync(file)` · `readClaudePluginManifest(root)` · `readClaudePluginManifestAsync(root)`. 실패 사유 `read`(errno)·`parse`·`shape`를 경고하고, 경고 서명(경로+사유+내용 sha256 또는 errno)이 바뀔 때만 `reportError({event:'claude.native-settings.skipped', scope:'claude', title:'configInvalid', level:'warn', detail, data:{file, reason}})` | 단위(report spy) |
| `app/src/main/adapters/claude/plugin-catalog.ts` · `configured-resources.ts` | F 호출 14 | `readObject`·`readObjectAsync` 래퍼를 정책 모듈로 교체. manifest 3자리는 `undefined`면 그 엔트리를 건너뛴다(`loaded`·`plugins`에 넣지 않음) | 통합(fs fixture) |
| `app/src/main/app/handlers/session-resources.ts` | H1·H2 | `withCause(error)` helper — `하네스 목록을 불러오지 못했습니다(${errorMessage(cause)}). 다시 시도해 주세요.` | 핸들러 테스트 |
| `app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.ts` | G2 | catch에서 `failures.current`에 그 백엔드가 없을 때만 `reportError({event:'skills.native.load-failed', scope:'native-resources', title:'loadFailed', error})` 후 추가 | hook 테스트 |
| `app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx` | G1 | `:139-146` 상태 행 제거. `suppressEmpty`·로딩은 유지 | 상호작용 테스트 |
| `app/src/renderer/src/shared/errors/reportSites.registry.test.ts` | G3 | useNativeMcpCatalog ordinal 0을 `TOAST`·`T-native-mcp-load`·`skills.native.load-failed`·`loadFailed`로 | 레지스트리 테스트 |
| `app/src/main/app/chat-turn/concurrency-identity.testfixture.ts` | seam | `initial?: string` 옵션 — enqueue+`reserveItem` 후 `initialBatches=[batch]`, 요청 `promptUuid`=batch.uuid. 기본 동작 불변 | fixture |
| 테스트 신규/수정 | §7-A 좌표 | VP-01~VP-15 | — |
| `app/src/main/app/chat-turn/send.ts` (ΔV1) | J1 | finally에서 `request.rollbackInitialSubmission?.()` 다음: 큐 키 `finalSessionId ?? queueKey`에서 `initialBatches`의 id를 `pendingMessages.cancel`(held만 지움)로 빼고, 뺀 id가 있고 `finalSessionId`가 있으면 `sendChatEvent(wc, {type:'message.cancelled', sessionId: finalSessionId, ids})` | 조립 테스트(VP-16) |
| `app/src/main/app/chat-turn/post-turn.ts` (ΔV1) | I1 | r1 구현 유지. 주석의 "사용자가 다시 보낸다"를 "체인 종료 시 send.ts가 입력창으로 돌려준다"로 | VP-18 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` (ΔV1) | K1 | `case 'message.cancelled'`: 기존 pending 처리에 더해 `ev.ids`와 `clientId`가 같은 사용자 말풍선을 `DROP_UNCOMMITTED_USER`로 지우고 텍스트를 모아 K행 순서로 결합 | `chatStore.test.ts` |
| 테스트 (ΔV1) | VP-16~19 | 신규 `app/src/main/app/chat-turn.returned-input.test.ts` · `retry-submission.test.ts` F·H · `chatStore.test.ts` 신규 케이스 | — |

### 테스트 가능성

- electron 비의존: 신규 두 모듈은 `node:fs`·`node:crypto`·`infra/error-report`만 쓴다. 테스트는 `vi.mock('../../infra/error-report')`로 report를 관측한다.
- 기존 메커니즘 재사용 적합성: `selectAttempts`는 commit과 같은 claim 매칭(attemptId·chainId·messageIds)이라 재개방의 대상 일치를 그대로 보장한다. 토스트는 기존 `configInvalid`·`loadFailed` 제목과 hub를 쓴다.
- 순서 관측: coordinator 위임 spy와 forward spy의 호출 순서 배열(B1), fake timer 경계 전후 queue 관측(VP-05), 로그 spy(B7·C1).

## 12. End-to-end 영향

### producer → consumer

```text
Claude CLI JSONL → readClaudeNativeHistory(규칙 함수) → NativeHistoryResult → prepareNativeSession / refreshNativeHistory
adapter LiveTurn 실패 → coordinator(gate) → forward turn.retrying/error → renderer PendingAssistant·TurnErrorBanner
Claude 설정 파일 → native-settings-file → plugin-catalog/configured-resources → SDK options / NativeResources → 목록·메뉴
main reportError → hub → renderer ErrorToastHost
```

- producer 기준: 세션 경로는 CLI 규칙(R-02). 재시도 이벤트 의미는 `IPC_CONTRACT.md:596` 그대로다(재시도 직전 1회).
- consumer 파생 규칙: 화면 이력 갱신(`app/native-history.ts:40`)도 같은 리더를 쓰므로 하위 폴더 이동 세션의 화면 갱신도 ready가 된다(별도 변경 없음).
- 합성값 우회: 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `skill-catalog.ts:20` · `plugin-catalog.ts:375`(명령 목록) | 깨진 설정에서 reject 대신 남은 파일 기준 결과 | AC11 |
| `app/harnesses/claude/module.ts:34,40`(전역·구성 목록) | 같음 | AC11·AC14 |
| (ΔV1) `index.ts:143` 단건(hover) 취소의 `message.cancelled` | pending 항목만 — 말풍선 매칭 없음, 변화 없음 | AC21 (i) |
| (ΔV1) `index.ts:188` 중단 버튼 `cancelAllHeld` | held 턴 시작 입력이 있으면 말풍선도 지워짐(D-017 뒤에는 J가 체인 종료 시 먼저 회수) | AC21 (ii)·(iii) |
| (ΔV1) `send.ts:644` 준비 중 Stop · `send.ts:750` 준비 실패 | 턴 시작 입력 → 말풍선 제거 + 복원. 주석 "이 배치만 복원한다"·"held 로 복구" 의도와 일치 | AC19 |
| (ΔV1) `discard.ts:37` 세션 폐기 | 미확정 턴 시작 입력 → 말풍선 제거 + 복원. 주석 "텍스트는 draft 로 복원해 사용자가 재전송을 정한다"와 일치 | AC19 |
| `project-reconciliation.ts:112`(manifest 직접 파싱) | 제외된 플러그인은 설치 목록에 없어 `restart-required` 분기로 간다 | AC12 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 재spawn은 기존 spawn 경로 그대로이며 `ChannelToolContext`는 admission 통과 뒤에만 만든다.
- 취소/중단: backoff 중 Stop은 재개방 전이라 예약이 `submitted`로 남는다(AS-IS와 동일). 재개방과 다음 attempt 사이의 중단은 첫 attempt 중단과 같은 경로다.
- 종료/crash: 경고 서명 기억은 프로세스 메모리라 재시작 뒤 같은 깨진 파일은 다시 1회 경고한다.
- retry/timeout/partial failure: 재개방 실패는 원래 오류로 끝낸다. 마지막 attempt 실패에는 재개방을 묻지 않는다(B7).
- (ΔV1) 체인 종료: 최종 rollback 뒤 마지막 초기 배치의 held 잔여를 J1이 회수하고 `message.cancelled`로 알린다(D-017).
- cleanup/rollback: `send.ts:716` 최종 rollback은 그대로다. 재개방된 뒤 재spawn 전에 실패한 경우는 `submitting`이므로 이 rollback이 held로 되돌린다.
- **다중 저장소 쓰기**: 해당 없음(코드). 문서 산출물은 판정 사본이 `plan.md`와 `INDEX.md` 두 곳이다 — 같은 설계 커밋에서 함께 바꾼다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수 상한: 전송 1회당 spawn은 최대 3회(1+`MAX_RETRIES`)로 기존 설계와 같다. AS-IS는 사실상 1회였으므로, 영구 실패의 최악 지연은 backoff 3초 + spawn 2회 증가다.
- 새 출력: 경고 토스트는 파일 상태당 1회, 플러그인 탭 토스트는 백엔드 실패 전이당 1회다.
- 경고 서명 계산: 깨진 파일 내용 sha256 1회(정상 파일은 계산 안 함). `CLAUDE_HISTORY_MAX_BYTES`와 무관한 작은 설정 파일이다.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 배포·플러그인 구현자가 구현할 port/schema 변경 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 경로 충돌·인증·unavailable에는 재생성·재전송 없음 | `app/AGENTS.md` DB 정책 · 0265 | §5 상태표 relocated 행 · D-003 | 유지 |
| 원본 부재 확인만 복구 | `persistence.md:188` | D-004 · AC2 | 유지(적용 확대 — 원본 존재 시 missing 금지) |
| 턴 재시도 = respawn+resume | `runtime-ipc.md:94` | D-005 · AC4 | 유지(코드를 문서에 맞춤) |
| 커밋된 claim은 admission 불가 | `opencode-runtime.test.ts:337` | D-008 · AC7 | 유지 |
| 깨진 Claude 설정은 reject | 기존 테스트 3건(R-17) | D-011 · AC11 | 변경(사용자 결정 2026-11-09) |
| 설정 오류에 내용 비노출 | 같은 테스트 | D-015 · AC11 | 유지 |
| error는 해당 영역에 설명·복구 | `design-system.md:187` | D-012 · AC14 | 이 카탈로그만 예외(D-013). 문서에 예외 1줄 |
| 플러그인 탭은 focus·변경 push에 갱신 | `IPC_CONTRACT.md:196` | §5 · AC14 | 유지 + 실패 표시 문장 추가 |
| 갱신 안내·부분 실패 토스트 없음(+ 메뉴) | `ux-domains.md:29` · `design-components.md:133` | 해당 없음(Composer 메뉴는 이번 범위 밖) | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 재시도가 이미 기록된 입력을 중복 전송 | 이벤트 0건일 때만 재시도(기존 조건). 선언 경계로 명시 |
| 깨진 설정을 건너뛰어 사용자가 문제를 모른 채 씀 | 경로를 담은 경고 1회 + 로그(D-011) |
| 쓰기 경로가 깨진 파일을 덮어씀 | 쓰기·project-settings는 엄격 유지(D-014, AC13) |
| 토스트 반복 | 서명 기억(main)·실패 전이(renderer) |

- 되돌리기 어려운 결정: 없음(파일 형식·스키마·IPC 이름 불변. 로그 이벤트 2종 신설).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- 코드: §11 표의 파일.
- `docs/arch/backend/adapters.md` `:151` — Claude 세션 경로 규칙. `:82` 문단 — Claude 설정 읽기 정책(없음·빈 = 설정 없음, 깨짐 = 그 파일/플러그인 제외 + 경고 1회, 쓰기 엄격).
- `docs/arch/backend/runtime-ipc.md:94` — 재시도는 같은 예약을 backoff 뒤 재개방해 다시 보내고, 재개방할 수 없으면 원래 오류로 끝난다. admission 거부는 spawn 시작 기록 전이다.
- `docs/IPC_CONTRACT.md:196` — 플러그인 탭 조회 실패는 탭 영역에 표시하지 않고 실패 진입 시 토스트 1회. `:267` — reject 메시지는 원래 원인을 포함한다.
- `docs/arch/frontend/design-components.md:390` — `ExtensionsCatalogView` 행에 실패 표시 예외.
- (ΔV1) `docs/IPC_CONTRACT.md:582` `message.cancelled` 행 — 시작 단계에서 보내지 못하고 체인이 끝난 턴 시작 입력도 이 이벤트로 회신되고, renderer는 같은 id의 사용자 말풍선을 지우고 텍스트를 복원한다. `docs/arch/backend/runtime-ipc.md:94` — "같은 체인에서 자동 재전송하지 않는다" 뒤에 "체인 종료 시 대기열에서 빼 입력창으로 돌려준다".
- `docs/arch/frontend/design-system.md:187` — error 행에 "배경 자동 갱신 목록(플러그인 카탈로그)의 조회 실패는 토스트" 예외 1줄.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`·`로컬 확인` · `app/src/main/AGENTS.md`(레이어 DAG) · `app/src/renderer/AGENTS.md`(완료 검토).
- ABI/네트워크 등 환경 제약: 이 환경은 Electron 다운로드가 막힐 수 있다. DB 로드 스위트 실패는 변경 전 집합과 대조해 분리 보고한다.
- 기본 정적 게이트: `npm run lint` · `npm run typecheck`.
- 관련 테스트: §7-A 좌표 파일 + 파일 필터 없는 `./node_modules/.bin/vitest run` + `node --test scripts/*.test.mjs` + 가드 3종.
- 사람 실기: AC17.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 2026-11-09 다섯 턴의 리포트·응답을 D-001~D-016으로 기록, OPEN 0.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §5 상태표 14행.
- [x] 조건절·이유절을 재해석하지 않았다 — D-010·D-011·D-012 원문 인용.
- [x] Product/UX 핵심 동작이 AC와 Technical Design에 연결된다 — §3 갱신 메모 대조, §11 표.
- [x] AS-IS와 TO-BE가 같은 축으로 있다 — §9 두 블록 + Delta 6행.
- [x] Delta 각 행이 파일·AC로 추적된다 — Delta 마지막 열.
- [x] AS-IS에서 사라진 책임: 인라인 경로 규칙 → 이동(`transcript-cwd.ts`), 배너 → 삭제(토스트 대체), 래퍼 `readObject` → 대체(정책 모듈).
- [x] 수치·전칭·외부 규약·앵커·기존 테스트 인용을 실측했다 — §8 전수 조사·검산.
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 가진다 — §7 표.
- [x] Baseline V이고 유효 V를 재구성할 수 있다.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R 4·SD 1·AR 4·MD 6 ↔ VP-01~VP-15.
- [x] INHERITED node 없음(Baseline).
- [x] 각 pair가 경로·§10 분모·자리별 좌표를 갖고, 적대 증거는 VP-04·06·08만 이유와 변이를 갖는다.
- [x] 규칙 칸 분기마다 입력이 있다 — A: C1~C7·I1~I6 · B: B1~B10·Q1~Q8·W1~W4 · E: 10입력 · F: 14자리×2입력 + 리더 분기 · G: 전이 4단계.
- [x] 선언 경계를 적었고(6), 열린 입력은 결과 3분류로 닫았다.
- [x] INDEX 후보 표 겹침 0(0262 이관·0294·0296·0299 행 대조).
- [x] 운영 gate가 열거됐고 관련 없는 기존 실패를 범위로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC17은 실제 CLI 기록·Windows 파일·시각만.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — 재시도는 spawn 횟수·전달 이벤트, 설정은 "파일 없음과 같은 결과"로 단언.
- [x] 신규 계약의 SSOT·강제 지점·seam이 있다 — §10 A~H.
- [x] 기존 소비처를 전수 확인했다 — §12 표 3행.
- [x] producer/consumer 의미를 확인했다 — §12.
- [x] 상한을 계산했다 — §14.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 문구와 맞는다.
- [x] 본문 완성 후 Ledger와 교차검증했다 — §3 갱신 메모 "충돌 0".
- [x] 산출물 문장 규칙을 지켰다.

### READY self-review (ΔV1)

- Ledger: D-017 ACTIVE 추가, 대체 0 — 사용자 응답 원문 인용. D-006과 충돌 0(갱신 메모).
- 조건절: 사용자 원문 "나중에 자동으로 나가지 않는다"를 AC18 "다음 전송 프롬프트에 그 입력이 없다"로 관측화했다.
- NEW 노드 R-05·AT-05·AR-05·IT-05·MD-07·UT-07·MD-08·UT-08 ↔ VP-16~19 REQUIRED. CHANGED SD-01·ST-01 ↔ VP-05 REQUIRED. 경로 공유 INHERITED R-02 ↔ VP-02 REGRESSION.
- 자리 목록 실측(이 턴): I 검색 → `post-turn.ts:46`(선언, 제외) · `:134`·`:136`(계산)·`:146`(대입) → I1 · `send.ts:707` → I2 · `send.ts:576`(B행, 제외). 술어를 저장소 전체로 넓히면 `turn-request.ts:24·88·103·112`가 더 나오며 모두 V1 B행 claim 원천이다. J 검색 → `send.ts:644`·`:750` 2행(기존, J1은 구현 뒤 생김). K 검색 → `chatStore.ts:868` 1행.
- 규칙 칸 ↔ 입력 칸: I 4분기 ↔ VP-18 (i)~(iv) · J 4분기 ↔ VP-16 J(i)~(iv) · K 5항 ↔ VP-19 (i)~(v).
- 적대 증거: VP-18만 선택 — 가드는 "끝낸다/잇는다"의 방향이 둘이라 반대쪽 입력이 없으면 분기가 침묵한다(verify r1 PT2·PT3이 좌표에서 green).
- 기존 좌표 실측: VP-18 (iii) 좌표는 이 턴에 PT3 변이를 심어 `chat-turn.execution-config.test.ts` 13케이스 red를 관측했다(`src/main/app/chat-turn`·`src/main/features/chat` 범위 실패 13 → 32, 늘어난 19 = 그 파일 13 + `chat-turn.runtime-tools.test.ts` 6).
- 선언 경계 6항(측정 근거 인용). 사람 실기로 미룬 순수 로직 없음 — AC17(e)는 시각만.
- 운영 gate: V1 표 그대로(renderer 테스트는 파일 필터 없는 vitest에 포함).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: A·B·C·E·F·G·H 행과 §11 파일 표를 그대로 구현했다. 신규 모듈 `transcript-cwd.ts`·`native-settings-file.ts`.
- 이견 / 현실성 문제: §7 AC5·§5 "동기 실패 → 재시도 없음"은 coordinator만으로 성립하지 않았다. `post-turn.ts`가 held로 되돌아간 같은 입력을 곧바로 flush해 같은 실패를 반복했다(아래 놓친 문제 #1, 선조치).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. `project-settings.test.ts`의 `null` = 깨짐 단언이 R-17 목록 밖의 기존 잠금이었다 — D-010·D-014(빈 내용 규칙 공유)대로 바꿨다(#2).

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01·06·10 | A 세션 경로 | A1·A2 — 2 | 2/2 | §10 A 검색 → `transcript-cwd.ts:11` 정의 + `native-history.ts:235` 호출(차집합 0). A1 `transcript-cwd.test.ts:'%s'` C1~C7 · A2 `native-history.test.ts:'judges the session cwd by the CLI rule: %s'` I1~I6 + `'I7 does not accept a relative recorded cwd…'` · `native-session.claude-transcript.test.ts` 4케이스 | 처음 cwd ≠ 마지막 cwd(하위폴더) · relocated ≠ 요청 cwd · 상대경로가 요청 cwd로 해석됨 | 없음 |
| VP-02·05·07·11·12 | B 재개방 | B1~B8 — 8 | 8/8 | §10 B 검색 출력에서 타입 2·Omit 2 제외 → queue `:326`·`:335` · turn-request `:123`·`:125` · coordinator `:614`·`:616`·`:637` · continuation `:66`(차집합 0). B1·B2 `pending-message-queue.test.ts:'Q1~Q8'` · B3·B4 `turn-request.reopen.test.ts:'W1·W2·W3'` · B5~B7 `turn-coordinator.test.ts:'B1~B10'` · B8 `continuation.test.ts:'buildFlushRequest passes both reopen delegates through unchanged'` · 경로 `retry-submission.test.ts:'A~E'` | W1 dbSessionId `s1` ≠ queueKey `q-other` · W3 옛 배치 confirmed · 오류 문구 `failure-1`/`failure-3` 구별 | 없음 |
| VP-15 | C admission 순서 | C1 — 1 | 1/1 | 검사 `session-runtime.ts:479` < 기록 `:482` · `session-runtime.test.ts:'rejects a stale spawn admission before recording a spawn…'` | started 0·sendMessage 0·rollback 1·toolContext null | 없음 |
| VP-13 | E 빈 내용 | E1 — 1 | 1/1 | §10 E 검색 5행(정의 1·승계 4). `json-file.test.ts:'treats empty content %j as no settings'`·`'keeps non-empty invalid content %j invalid'` · `plugin-state.test.ts` 신규 2 | `''`·공백·BOM·`null` vs `[]`·`1`·끝 쉼표 | 없음 |
| VP-03·08·14 | F 설정 정책 | 문서 11 · manifest 3 · 경고 서명 1 — 15 | 15/15 | §10 F 검색 → 호출 14 + 정의 4(차집합 0). 자리별: `plugin-catalog.test.ts:'P26·P281×4·P331×4 …: empty/broken'`·`'P295·P345 …'` · `configured-resources.test.ts:'C68~C163 …'`·`'C138 …'` · 서명 `native-settings-file.test.ts:'warns once per file state…'` · spawn `adapter.native-settings.test.ts` 6 · nav `extension-catalog.claude-settings.test.ts` 4 | 파일마다 결과에 단독 기여(“skipped ≠ full” 단언) · 비밀 문자열 미포함 | 없음 |
| VP-04 | G 탭 실패 | G1~G3 — 3 | 3/3 | G1 `ExtensionsCatalogView.interaction.test.ts:'scopes native loading and failure to plugin and MCP tabs'` · G2 `useNativeMcpCatalog.test.ts:'toasts a list failure once when a harness enters the failed state…'` · G3 `reportSites.registry.test.ts`(`T-native-mcp-load`) | reject→reject→resolve→reject = 토스트 1→1→1→2 | 없음 |
| VP-09 | H 원인 동반 | H1·H2 — 2 | 2/2 | 검색 1행 = 단일 helper `session-resources.ts:16`, 호출 `:77`·`:188`. `session-resources.test.ts:'H1 …'`·`'H2 …'` 정확 문구 | `원인-가` ≠ `원인-나` | 없음 |

- §10 자리 목록 밖에서 본 운반 자리: `post-turn.ts` 자동 flush(#1, 선조치 · 잠금 `retry-submission.test.ts:'C …'`) · main report 레지스트리 `error-report.registry.test.ts` M25(구현 세부).
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(r1).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `native-session.claude-transcript.test.ts` 4 | not selected |
| VP-02 | REQUIRED | SELF_PASS | `retry-submission.test.ts:'A'~'D'` | not selected |
| VP-03 | REQUIRED | SELF_PASS | `adapter.native-settings.test.ts` · `extension-catalog.claude-settings.test.ts` | not selected |
| VP-04 | REQUIRED | SELF_PASS | 위 G 좌표 | G1-1 배너 복원 red · G2-1 전이 조건 제거 red |
| VP-05 | REQUIRED | SELF_PASS | `retry-submission.test.ts:'A'`(표본 submitted→submitting→submitted, backoff 중 변경 0)·`'C'`(pending 1)·`'E'` | not selected |
| VP-06 | REQUIRED | SELF_PASS | `native-history.test.ts` I1~I7 | A1-5 "마지막 cwd" red · A2-R "아무 항목이나 일치" red |
| VP-07 | REQUIRED | SELF_PASS | `turn-request.reopen.test.ts` W1~W3 · `continuation.test.ts` W4 | not selected |
| VP-08 | REQUIRED | SELF_PASS | 위 F 자리별 좌표 | 14자리 각각 엄격 리더 복귀 red(F-P26~F-C163) |
| VP-09 | REQUIRED | SELF_PASS | H1·H2 | not selected |
| VP-10 | REQUIRED | SELF_PASS | C1~C7 | not selected |
| VP-11 | REQUIRED | SELF_PASS | Q1~Q8 | not selected |
| VP-12 | REQUIRED | SELF_PASS | B1~B8·B10(B9는 기존 `'재시도성 에러 + 첫 이벤트 전이면…'`) | not selected |
| VP-13 | REQUIRED | SELF_PASS | E 좌표 | not selected |
| VP-14 | REQUIRED | SELF_PASS | `native-settings-file.test.ts` 28 | not selected |
| VP-15 | REQUIRED | SELF_PASS | C1 좌표 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

하네스 `mutate.py`, spec 64행 + 재실행 2행. 원복 확인 "모든 파일 원문 그대로".

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| A1-1~A1-6 relocated 분기·findLast·빈/비문자열·first→last·type 조건 | §10 A1 규칙 분기 · VP-06 등록(A1-5) | 최초 | 8·1·2·1·9·1 failed | 잡음 |
| A2-1 realpath catch 제거 · A2-2 samePath 제거 · A2-R 아무 항목 일치 | §10 A2 · VP-06 등록 | 최초 | 2·4·5 failed | 잡음 |
| A2-3 `isAbsolutePath` 제거 | §10 A2 분기 | 최초 | 1차 0 failed → I7 추가 후 1 failed | 잡음(입력 추가) |
| B1-1·B1-2 상태 집합 축소 · B2-1~B2-3 원자성·전이·통지 | §10 B1·B2 | 최초 | 2·5·4·5·1 failed | 잡음 |
| B3-1·B3-2·B4-1·B4-2 키 맞바꿈(⑤)·claim 비움 | §10 B3·B4 | 최초 | 2·1·2·6 failed | 잡음 |
| B5-1~B5-3 gate 항 제거·pushesInput 제거·`!==false`→`===true` | §10 B5 | 최초 | 5·1·3 failed | 잡음 |
| B6-1·B6-2 재개방 실패 처리 제거·pushesInput 제거 | §10 B6 | 최초 | 6·1 failed | 잡음 |
| B7-1·B7-2 warn 제거·message 항 제거 | §10 B7 | 최초 | 2·1 failed | 잡음 |
| B8-1 flush가 위임을 지움 | §10 B8 | 최초 | 1 failed | 잡음 |
| C1-1 검사를 started 뒤로 · C1-2 rollback 제거 | §10 C1 | 최초 | 1·1 failed | 잡음 |
| E1-1~E1-3 null·빈 문자열·trim 제거 | §10 E1 분기 | 최초 | 2·6·3 failed | 잡음 |
| E1-4 BOM 제거 제거 | §10 E1 | 최초 | 0 failed | 동치 — `'\uFEFF'.trim()===''` 실측 true(U+FEFF는 ECMAScript 공백). 중복 코드라 삭제 |
| F-P26·P281·P331·P295·P345·C68·C69·C72·C75·C76·C77·C138·C154·C163 엄격 리더 복귀 | §10 F 14자리 · VP-08 등록 | 최초 | 9·21·11·2·1·12·10·8·8·8·4·1·26·2 failed | 잡음 |
| F-W1~F-W9 1회 기억·서명·사유·digest·회복 삭제·ENOENT·detail 맞바꿈·manifest `{}`·read 경고 | §10 F 서명 · VP-14 분기 | 최초 | 27·27·2·2·2·44·6·3·2 failed | 잡음 |
| G1-1 배너 복원 · G2-1 전이 조건 제거 · G2-2 event 바꿈 | VP-04 등록 · §10 G | 최초 | 1·1·2 failed | 잡음 |
| H1-1·H2-1 원인 제거 · H-helper 원인 문구 제거 | §10 H | 최초 | 1·1·2 failed | 잡음 |
| PT-1 post-turn break 제거 | 놓친 문제 #1 잠금 | 최초 | worker crash(무한 flush) | 잡음 |
| PT-2 `!aborted` 조건 제거 | 놓친 문제 #1 | 최초 | 0 failed | 못 잡음 — 예약 유지 Stop + rollback 입력 조합 입력 없음. 남긴 곳 |

- **분모 검산**: 선택 증거 18(VP-04 2 · VP-06 2 · VP-08 14) · 인용 변이 0 · 새 oracle 2(PT-1·PT-2) · sweep 44 = 변이 64(재실행 2 별도: A2-3·E1-4). 최종 잡음 62 · 동치 1(E1-4) · 못 잡음 1(PT-2) = 64.
- **덮개 회귀**: 해당 없음(r1). 교체한 장치(R-17 잠금 3건 + project-settings `null`)는 내용 비노출 단언을 report 인자로 옮겨 유지했다.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음. 경고 detail 2종은 `configInvalid` 토스트(main reportError → hub), 목록 원인 문구는 기존 reject 경로, 탭 실패는 `loadFailed` 토스트 | 탭 배너 문구 `chat.nativeResources.error`·`retry`는 이제 renderer 소비처 0(`rg` 0행). 리소스 키만 남음 — 파생 #4 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | `session-runtime.ts` admission을 try 밖으로 옮겼다. 거부 시 도구 컨텍스트를 만들기 전이라 정리할 것이 rollback뿐이고 그것을 부른다(VP-15) | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 동기 실패 → "원래 오류 즉시"(post-turn 차단 포함) · 비동기 0건 → "재시도 1/2 뒤 정상" · backoff 중 다른 경로 → "재시도 1/2 뒤 원래 오류" · 깨진 설정/manifest → 경고 1회 행 · 탭 실패 → 토스트 행 | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 탭 실패는 토스트 1회 후 탭이 직전 목록(또는 빈 목록, `suppressEmpty`)을 유지 — 실패가 이어지는 동안 추가 안내가 없다. D-012 의도대로 | AC17(d) 사람 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | hook의 version 비교를 그대로 두고 그 안에서만 report — 지각 reject는 토스트를 내지 않는다 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 현재 결함: spawn 동기 실패로 held에 되돌아간 입력을 `post-turn.ts`가 같은 체인에서 바로 flush → 같은 실패 반복. 변경 전에는 backoff로 느리게(기준선 5초 6 spawn), 변경 후에는 backoff 없이 즉시 반복(worker crash) | 선조치: 직전 턴의 초기 배치 id가 held에 있고 턴이 중단되지 않았으면 `break`(`post-turn.ts:146`, `getInitialBatches` 위임 추가 `send.ts`·fixture). Part I §5 "재시도 없음·원래 오류"와 VP-02 C(spawn 1·pending 1)를 production 경로에서 성립시킨다 | `retry-submission.test.ts:'C …'` · PT-1 red |
| 2 | R-17 밖의 기존 잠금: `project-settings.test.ts`가 `null`을 깨진 파일로 단언 | D-010·D-014대로 `null`=없음 단언으로 교체, 깨진 내용 단언 4종은 유지 | 기준선 대비 새 실패 1파일이 이것뿐 |
| 3 | `parseJsonObject`의 `invalid` 콜백이 사유(`parse`·`shape`)를 받도록 넓혔다 | 기존 호출부는 인자를 무시(호환). 정책 모듈이 사유를 경고 data에 싣는다 | typecheck 0 |
| 4 | 탭 배너 i18n 키 2개가 소비처 없이 남음 | 이번 범위 밖(비귀속) — 삭제는 다음 정리 후보 | `rg` 0행 |
| 5 | PT-2: 예약 유지 Stop(`abortContinuation.resume`) 중 rollback된 입력의 판정 입력 없음 | 기존 경로 보존 의도의 가드라 남김. 확장 후보로 보고 | sweep PT-2 green |

### 설계 대비 명시적 차이

- plan §11에 없던 `post-turn.ts`·`send.ts` 변경(#1)과 main report 레지스트리 M25. 메커니즘 대체는 없다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 판정은 매 post-turn 반복에서 큐 상태로 새로 계산 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 초기 배치 게터는 send.ts·post-turn·turn-request가 공유. flush 턴은 `setInitialBatches`로 갱신하므로 다음 반복은 flush 입력을 본다 | AC5 · `retry-submission.test.ts:'B'`(재시도 2회 뒤 정상 종료) |
| 재진입 | 사용자가 같은 턴 중 새로 보낸 held는 초기 배치 id가 아니므로 그대로 flush | `concurrency-identity.test.ts` P7(send-now) green |
| 다른 무효화 축 | 사용자 Stop(abort)은 가드로 기존 경로 — PT-2 미잠금 | 남긴 곳 #5 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `transcript-cwd.ts`(신규)·`native-history.ts`·`native-settings-file.ts`(신규)·`plugin-catalog.ts`·`configured-resources.ts`·`json-file.ts`·`turn.ts`·`pending-message-queue.ts`·`turn-request.ts`·`turn-coordinator.ts`·`session-runtime.ts`·`post-turn.ts`·`send.ts`·`session-resources.ts` · renderer: `useNativeMcpCatalog.ts`·`ExtensionsCatalogView.tsx` · 문서 5곳(§18) · 테스트 23파일 |
| 실행 명령 | cwd=`app`: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` (`npm rebuild better-sqlite3`로 Node ABI) |
| **관측한 게이트 산출** | 마이그레이션 ok · 인벤토리 ok(링크·수치) · 예산 "20 real-git suites ok" · lint 0 error/2 warning(손대지 않은 virtualizer 파일) · typecheck exit 0 · `node --test` exit 0 · vitest 938파일: 30 failed / 904 passed → `project-settings` 1건 수정 후 남은 29파일은 변경 전(같은 명령, HEAD worktree) 실패 집합과 차집합 ∅. 서명: `Electron failed to install correctly`(바이너리 미설치) · `C:/…`·`Composer directory must be absolute`(Windows 경로) · `restart-required`·"프로젝트별 제어를 지원하지 않습니다"(Windows 전용 플러그인 제어) |
| **추가·수정 테스트의 subtree 규칙** | 23파일(`git diff --name-only 01ca522` + 신규). 시간 예산 위반 0(가드 통과, 신규 대기는 가짜 시계만) · 호스트 격리 위반 0(`CLAUDE_CONFIG_DIR`·tmp fixture, nav 테스트는 `HOME`/`USERPROFILE` 명시 주입) · 풀 분류 `[test-pools]` 0(23파일 실행 22 passed, 자식 프로세스·SQLite 없음) |
| V-pair 자기확인 | 15/15 SELF_PASS |
| 강제 지점 전수 | A 2/2 · B 8/8 · C 1/1 · E 1/1 · F 15/15 · G 3/3 · H 2/2 = 32/32 |
| **AC 자기보고**(`Criteria-Met`) | AC1~AC16 ✅(좌표: 위 강제 지점 표 · AC16 = 인벤토리 가드 + 문서 5곳 `adapters.md` 2·`runtime-ipc.md` 1·`IPC_CONTRACT.md` 2·`design-system.md` 1·`design-components.md` 1 문단) · AC17 ⚠️ Windows 사람 실기 대기 |
| **합계 검산** | ✅ 16 · ⚠️ 1 · ❌ 0 = 총 17 |
| 블로커 / 역질문 | 없음. #1 선조치(post-turn)는 verify가 계약 범위를 판정한다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` — 같은 라운드 진행분 커밋 1개 + 완료 커밋 1개 |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(r1).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: VP-02 path가 `runTurnWithContinuations`를 포함했지만 §10 B 자리 목록에 post-turn 자동 flush가 없었다(#1). R-17이 `project-settings.test.ts` `null` 잠금을 열거하지 않았다(#2).
- 반복해서 부딪히는 환경 한계: Electron 바이너리 미설치로 전체 vitest의 기준선 29파일 red(Windows 전용 경로 포함). worker 재시작 1회.
- 현재 라운드·impl 턴: `r1`

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: ΔV1 §10 I·J·K와 §11 ΔV1 행을 그대로 구현했다. J1 = `send.ts` 실행 try의 finally(최종 rollback 다음), K1 = `chatStore.ts` `case 'message.cancelled'`.
- 이견 / 현실성 문제: VP-16 J(iv)를 mock supervisor로 조립하면 응답 중 보낸 입력이 busy 예약이 아니라 별도 체인으로 처리돼 J(i)를 다시 재는 것이 됐다(sweep I-iv green으로 발견). 실제 `RuntimeSupervisor`로 바꿔 닫았다(아래 #1).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.
- 사용자 지적 CI #1035(같은 라운드, 외부 gate red): `native-history.test.ts` I7가 Windows에서 red — 임시 폴더(C:)와 작업 폴더(D:)의 드라이브가 달라 `path.relative`가 절대 경로를 돌려줘 입력이 성립하지 않았다. `realpath`를 감싸 상대 경로가 저장 폴더로 풀리는 입력을 플랫폼과 무관하게 만들었다(#2).

## [구현자 기입] 강제 지점 전수 (§10 대조) (r2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-18·VP-02 | I post-turn 가드 | I1·I2 — 2 | 2/2 | §10 I 검색 6행: `post-turn.ts:46` 선언 제외 · `:135`·`:137`·`:147` → I1 · `send.ts:707` → I2 · `send.ts:576` B행 제외(차집합 0). I1 (i) `retry-submission.test.ts:'C …'` · (ii) `'F a send-now interrupt …'` · (iii) `chat-turn.execution-config.test.ts:'… runs %s with its own document …'` · (iv) `'H a flush turn that fails synchronously …'` · I2 `chat-turn.returned-input.test.ts:'J(i)…'`(실제 send.ts 조립) | (ii) 중단 = send-now · (iv) flush 입력 `held-1` ≠ 최초 `initial-message` | 없음 |
| VP-16·VP-17·VP-05 | J 체인 종료 회수 | J1 — 1 | 1/1 | §10 J 검색 3행: `send.ts:644` 준비 중 Stop · `:766` 준비 실패 제외 → `:729` = J1(차집합 0). `chat-turn.returned-input.test.ts` J(i)~J(v) | (i) ids `['req-1']`·세션 `s1` · (ii) 세션 없음 → 이벤트 0 · (iii) 정상 → 0 · (iv) flush `req-5` ≠ 최초 `req-6` · (v) 큐 키 `n1` ≠ queueKey `req-7` | 없음 |
| VP-19·VP-17 | K renderer 소비 | K1 — 1 | 1/1 | §10 K 검색 1행 `chatStore.ts:874`. `chatStore.test.ts:'message.cancelled — 턴 시작 입력의 말풍선 회수 …'` VP-17·(i)~(vii) | 말풍선 `질문-가` ≠ pending `예약-나` · 결합 순서 · 같은 id pending(vi) · assistant clientId(vii) | 없음 |
| VP-07 | B3 canReopen claim(D1) | B3 — 1(V1 B 8 중) | 1/1 | §10 B 검색 출력 r1과 동일(차집합 0). `turn-request.reopen.test.ts:'%s refuses to reopen a batch that was %s'` W1·W2 × confirmed·rolled back | 빈 claim(참) ≠ 불일치 claim(거짓) | 없음 |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: V-B3b(이행) → 이번 턴 red 4 · V-PT2·V-PT3(ΔV1 채택) → red 1·17 · V-Fw7은 verify가 `잡음`으로 재분류. 남은 의무 0.
- V1 강제 지점 r1 `SELF_PASS`(A·C·E·F·G·H)는 좌표 유지 — 이번 diff가 닿은 A2만 재실행(V-A2a~c red).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-16 | REQUIRED | SELF_PASS | `chat-turn.returned-input.test.ts` J(i)~J(v) | not selected |
| VP-17 | REQUIRED | SELF_PASS | main J(i) ids · `chatStore.test.ts:'VP-17 the bubble the real send created …'` | not selected |
| VP-18 | REQUIRED | SELF_PASS | 위 I 좌표 (i)~(iv) | PT1 crash · PT2 red 1 · PT3 red 17 · I2 crash · I-iv red 2 |
| VP-19 | REQUIRED | SELF_PASS | `chatStore.test.ts` (i)~(vii) | not selected |
| VP-05 (CHANGED) | REQUIRED | SELF_PASS | V1 `retry-submission.test.ts:'A'`·`'C'`·`'E'` + J(i) `pending('s1')` 0·`message.cancelled` 1 | not selected |
| VP-02 | REGRESSION | SELF_PASS | `retry-submission.test.ts` A~E 재실행 7 passed(F·H 포함) | not selected |
| VP-07 | REQUIRED | SELF_PASS | W1~W3 + claim 불일치 4입력 | V-B3b red 4 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

하네스 `mutate.py`, spec 25행(`--cwd app`). 원복 확인 "모든 파일 원문 그대로".

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| PT1 `if (returnedInput) step='break'` 제거 | VP-18 등록 | r1 잡음(crash) | worker crash(무한 flush) | 잡음 |
| PT2 `!aborted &&` 제거 | VP-18 등록 · verify V-PT2 | r1 못 잡음 | 1 failed(F) | 잡음 |
| PT3 held 판정 → `true` | VP-18 등록 · verify V-PT3 | r1 좌표에서 못 잡음 | 17 failed | 잡음 |
| I2 `send.ts:707` `getInitialBatches` → `[]` | VP-18 등록 | 최초 | worker crash | 잡음 |
| I-iv flush 배치 갱신 제거(최초 배치를 보게 함) | VP-18 등록 | 최초 | 1차 0 failed → J(iv) 실제 supervisor로 교정 후 2 failed | 잡음(입력 교정) |
| J1-1 cancel → held 존재 검사만(회수 안 함) | sweep J1 | 최초 | 4 failed | 잡음 |
| J1-2 `message.cancelled` 발신 제거 | sweep J1 (i) | 최초 | 3 failed | 잡음 |
| J1-3 큐 키 `finalSessionId ?? queueKey` → `queueKey` | sweep J1 큐 키 항 | 최초 | 1차 0 failed → J(v) 추가 후 1 failed | 잡음(입력 추가) |
| J1-4 `finalSessionId &&` 제거 | sweep J1 (ii) | 최초 | 1 failed | 잡음 |
| J1-5 cancel 결과 무시(모든 id 회신) | sweep J1 (iii) | 최초 | 2 failed | 잡음 |
| J1-6 `returnedIds.length > 0` 제거 | sweep J1 (iii) | 최초 | 2 failed | 잡음 |
| K1-1 말풍선 제거 dispatch 삭제 | sweep K1 | 최초 | 4 failed | 잡음 |
| K1-2 `!presentIds.has` → `true` | sweep K1 "pending에 없고" | 최초 | 1차 0 failed → (vi) 추가 후 1 failed | 잡음(입력 추가) |
| K1-3 결합 순서 맞바꿈(⑤) | sweep K1 순서 | 최초 | 1 failed | 잡음 |
| K1-4 `role === 'user'` 제거 | sweep K1 `role:'user'` | 최초 | 1차 0 failed → (vii) 추가 후 1 failed | 잡음(입력 추가) |
| K1-5 말풍선 텍스트 제외 | sweep K1 | 최초 | 4 failed | 잡음 |
| K1-6 `ev.ids.includes` 제거 | sweep K1 (v) | 최초 | 2 failed | 잡음 |
| K1-7 `texts.length > 0` → `true` | sweep K1 (iv) | 최초 | 4 failed | 잡음 |
| V-B3b canReopen claim → `[]` | D1 인용 변이 | r1 verify 못 잡음 | 4 failed | 잡음 |
| V-B3a·V-B4a·V-B4b 키·claim | verify 잡음 행(oracle 파일 수정) | 잡음 | 2·2·7 failed | 잡음 |
| V-A2a·V-A2b·V-A2c realpath catch·samePath·isAbsolute | verify 잡음 행(I7 수정, CI #1035) | 잡음 | 2·4·1 failed | 잡음 |

- **분모 검산**: 선택 증거 5(PT1·PT2·PT3·I2·I-iv) · 인용 변이 1(V-B3b) · 새 oracle 0 · sweep 13(J1 6 · K1 7) · 이전 잡음 재실행 6 = 표 25행(V-B3a·B4a·B4b·A2a·A2b·A2c는 2행에 묶음). 최종 잡음 25 · 못 잡음 0 · 동치 0.
- **덮개 회귀**: 없음. I7 장치 교체(`path.relative` → `realpath` 감쌈) 뒤 V-A2c red 유지(1 failed). r1 verify `잡음` 중 이번 diff가 닿은 oracle 파일(native-history·turn-request.reopen)의 행 6개 전부 red.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음. J1 `message.cancelled`의 소비자 = K1(말풍선 제거 + `draftRestore`) | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 동기 실패 → ΔV1 1행 · flush 동기 실패 → 2행 · 새 대화 → 4행(이벤트 없음) · 세션 ID를 받은 새 대화의 flush 실패 → 2행(J(v), 세션 ID로 회신) | 없음 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 원래 오류 배너 1회 + 말풍선 제거 + 입력창 복원(VP-17) | AC17(e) 사람 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | K는 확정 id에 오지 않는다(§10 K 전제) — 확정 뒤 같은 id 이벤트가 없다 | 없음 |
| 기존 소비처 변화(§12) | 중단 버튼·준비 중 Stop·세션 폐기의 턴 시작 입력도 말풍선이 지워진다 — §12 표대로 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 구현 세부: VP-16 조립에서 mock supervisor는 lease를 모르므로 응답 중 전송이 busy 예약이 되지 않았다 | 실제 `RuntimeSupervisor` + `acquireRuntime`·`peekRuntime` spy(런타임 생성만 SDK 경계로). history 구독자의 `turn.dbSessionId` 대입은 bus mock이 대신 | I-iv 0 → 2 failed |
| 2 | 외부 gate red(CI #1035): I7가 Windows 교차 드라이브에서 입력 불성립 | `realpath` mock으로 상대 경로 → 저장 폴더 해석을 직접 만든다 | CI 로그 `expected 'ready' to be 'unavailable'` · V-A2c red 유지 |
| 3 | J(v) 큐 키 항: 세션 ID를 받은 새 대화는 큐가 그 ID로 rekey되므로 `queueKey`로 회수하면 놓친다 | 입력 J(v) 추가 | J1-3 0 → 1 failed |

### 설계 대비 명시적 차이

- 메커니즘 대체 없음 — 해당 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `send.ts`(J1)·`post-turn.ts`(주석) · renderer: `chatStore.ts`(K1) · 문서 `IPC_CONTRACT.md` `message.cancelled` 행 · `runtime-ipc.md:94` · 테스트 5파일(신규 `chat-turn.returned-input.test.ts` · `retry-submission.test.ts` F·H · `turn-request.reopen.test.ts` · `chatStore.test.ts` · `native-history.test.ts` I7) |
| 실행 명령 | cwd=`app`: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` (`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` + `npm rebuild better-sqlite3`) |
| **관측한 게이트 산출** | 마이그레이션 skip(이전 v* 태그 없음) · 인벤토리 prose·links ok · 예산 "20 real-git suites ok" · lint 0 error/2 warning(손대지 않은 파일) · typecheck exit 0 · `node --test` pass 827/fail 0 · vitest 939파일: 29 failed / 906 passed, 변경 전(HEAD worktree, 같은 명령) 29 failed — 파일 집합 차집합 양방향 ∅. 서명: `C:/` 경로 26 · `restart-required` 14 · `Composer directory must be absolute` 4 · `Electron failed to install correctly` 3 · "프로젝트별 제어를 지원하지 않습니다" 3 |
| **추가·수정 테스트의 subtree 규칙** | 5파일(`git diff --name-only` + 신규 1). 시간 예산 위반 0(가드 통과, 대기는 가짜 시계·`vi.waitFor` 기본값) · 호스트 격리 위반 0(설정 문서는 `mkdtempSync(tmpdir())` 루트를 명시 주입, 홈 미참조) · 풀 분류 `[test-pools]` 0(5파일 unit 실행, 자식 프로세스·SQLite 없음) |
| V-pair 자기확인 | ΔV1 대상 7/7 SELF_PASS(VP-16·17·18·19·05·02·07) · V1 나머지 r1 유지 |
| 강제 지점 전수 | I 2/2 · J 1/1 · K 1/1 · B3(D1) 1/1 = 5/5 (V1 32/32 r1 유지) |
| **AC 자기보고**(`Criteria-Met`) | AC1~AC16 ✅(r1 좌표 유지 · AC7 W claim 입력 추가 · AC16 문서 ΔV1 2곳 추가) · AC18 ✅ J(i) · AC19 ✅ VP-17 · AC20 ✅ (i)~(iv) · AC21 ✅ (i)~(vii) · AC17 ⚠️ Windows 사람 실기(a~e) |
| **합계 검산** | ✅ 20 · ⚠️ 1 · ❌ 0 = 총 21. 분모 변경: r1 17 → r2 21(ΔV1 AC18~21) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` — CI #1035 테스트 보완 커밋 1 + r2 구현 커밋 1 |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — post-turn 차단 가드(r1 #1)의 후속(회수·복원). D1은 V1 B3 claim 항.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: r1 I7 입력은 플랫폼 가정(같은 드라이브)을 담았고 Linux에서만 성립했다 — CI #1035에서 발견.
- 반복해서 부딪히는 환경 한계: Electron 바이너리 미설치·Windows 전용 경로로 전체 vitest 기준선 29파일 red(r1과 같은 수).
- 현재 라운드·impl 턴: `r2`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | VP-07 좌표가 `turn-request.ts:124` canReopen claim 항을 잠그지 않는다(`batchClaims()`→`[]` green, B4는 red) | VP-07 · AC7 · §10 B3 | W1~W3에 claim 불일치(예: confirmed·다른 chainId)에서 canReopen 거짓인 입력 추가 | 이행 결함 | BLOCKING | open |
| D2 | `post-turn.ts` `returnedInput` 가드가 §10 B 목록 밖 운반 자리이고 PT2(aborted 항)·PT3(held 판정 항) 좌표가 없다 | VP-02 path · §10 B | 설계자가 B9로 채택하고 변이·입력을 고정하거나 경계 선언 | 확장 후보(목록 미고정) | PLAN_GAP | ΔV1 채택(D-017 · §10 I·J·K) — 재구현·재검증 대상 |
| D3 | 탭 배너 i18n 키 2개 소비처 0 | 구현 보고 #4 | 다음 정리 후보 | 비귀속 | NON_BLOCKING | open |
