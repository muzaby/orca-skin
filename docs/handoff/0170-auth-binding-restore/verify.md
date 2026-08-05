# Verify — 0170-auth-binding-restore

## 메타

| 항목 | 값 |
|---|---|
| slug | `0170-auth-binding-restore` |
| 검증자 | Claude Code |
| 일자 | 2026-08-05 |
| 대상 커밋 | 작업 트리 |
| 라운드 | 1 |
| 상태 | **PASS** (사람 실기 2건 대기) |
| 자기 검증 여부 | **예 — 설계·구현·검증 동일 에이전트.** §0 을 두 번 돌렸다(0168 r1 의 교훈) |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **부팅 축을 우선 봤다.** 재연결이 `await` 되지 않고(`void this.restoreAuthConnections`) 내부가 `try/catch` 로 감싸여, 사내망 밖의 타임아웃·401·정리 실패 어느 것도 부팅을 막지 않는다. 실패 경로 3종이 전부 테스트로 고정됐다 | `bootstrap.ts` `restoreAuthConnections` · `auth-restore.test.ts` 4케이스 |
| **잘못된 성공(false success)** 이 가능한 경로 | **차단됐다 — 이 설계의 핵심 판단이다.** 레코드만 보고 복원하면 UI 가 "연결됨" 이라 표시해 놓고 첫 요청에서 깨진다. `restore()` 는 **vault 에 값이 실제로 있는지 물어보고 나서** 살리고(AC4), 없으면 레코드를 지우며(AC5), 연결까지 실패하면 logout 한다(AC10). 세 겹이다 | `broker.ts` `restore()` · `auth-restore.ts` |
| 되돌릴 수 있는가 | **예.** 새 파일(`orca-auth-bindings`)만 추가되고 기존 저장소·DB·마이그레이션·IPC 는 무변경. 포트를 주입하지 않으면 종전 동작 그대로다(AC3) — 되돌리기가 `bindingPersistence` 한 줄 제거다 | `bindings.ts` 생성자 · `bootstrap.ts` |
| 설계가 의도한 것을 구현이 실제로 했는가 | **했다.** 3분기(`found`/`undecryptable`/`absent`)가 vault 계약 그대로이고, connector·`vault_credential` 필터가 §설계 (3) 의 의사코드와 1:1이다. **`application` 을 안 살리는 것**도 코드·테스트 양쪽에 있다 | `broker.ts:151-182` ↔ plan §설계 (3) |
| 구현자 선조치가 경계를 넘지 않았나 | **넘지 않았다.** 4건 전부 구현 세부·명백한 누락이고 AC 를 약화한 것이 0이다. 특히 #1(id 충돌)은 **자격증명 오배정**을 막는 것이라 선조치가 옳다 | plan §[구현자 기입] 1~4 |

**두 번째 패스에서 추가로 본 것**:

- **비밀은 이 변경으로 더 노출되지 않는다.** 저장 파일에 값이 들어갈 자리가 형상에 없고
  (`artifact` = `kind`+`handleId`+`credentialKind`), AC12 가 그것을 키 목록으로 고정한다.
  vault 는 종전대로 safeStorage 다.
- **잔여 비밀이 오히려 줄어든다** — 지금까지는 재시작마다 새 binding id 를 만들어 이전
  네임스페이스의 암호문을 방치했다. id 재사용으로 그 축적이 멈춘다. **기존** 잔여는 남는다(D1).
- **`clear()` 도 flush 한다** — 전량 삭제가 파일에 반영되지 않으면 다음 부팅에 되살아난다.
  경로 5곳(`create`·`setStatus`·`patch`·`takeForRemoval`·`clear`)을 세어 전부 확인했다.

## 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `createBindingPersistence()` — 프로덕션 참조 1(부트스트랩), 테스트 0 | **정상(의도된 미테스트)** — electron-store 인스턴스화라 이 환경에서 로드 불가. **판단 로직을 전부 `binding-records.ts` 로 빼서** 남은 것은 `store.get/set` 위임 3줄이다. plan §설계가 요구한 seam 이 실제로 그어졌는지 확인함 |
| `BindingPersistencePort` (infra) ↔ `BindingPersistence` (features) 두 이름 | **의도된 중복** — features 가 infra 타입을 import 하면 DAG 는 통과하지만 포트의 소유가 뒤집힌다. 구조적으로 만족하는 두 선언이 옳다(0157 의 "구조적 포트" 관례) |
| `BindingStore.loadPersisted()` — 호출자 1(broker) | 정상 — `restore()` 의 유일한 입력 |
| `adopt()` — 호출자 1(broker) + 테스트 | 정상 — 복원 확정 지점 |
| AC 핵심 동사의 테스트 등장 | 확인 — `loadPersisted` 3곳 · `adopt` 3곳 · `restore()` 8곳 · `restoreConnections` 4곳 |
| 형제 파일 정책 비대칭 | 0건 — `infra/auth/` 의 다른 파일과 옵션 키가 겹치지 않는다 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 같은 id 로 복원 | ✅ | `bindings.test.ts::"저장된 레코드를 같은 id 로 되살린다"` |
| 2 | 변경마다 저장 | ✅ | 〃`::"레코드 변경마다 저장소에 반영한다"` — create·setStatus·patch·remove 4회 저장 + 마지막이 빈 목록 |
| 3 | 포트 없으면 메모리 전용 | ✅ | 〃`::"영속 포트가 없으면 메모리 전용으로 동작한다"` + **기존 auth 스위트 401건이 전부 이 경로**(무변경 통과) |
| 4 | 비밀 있으면 valid 복원 | ✅ | `broker-restore.test.ts::"비밀이 남아 있는 binding 을 valid 로 복원한다"` |
| 5 | 비밀 없으면 폐기 + 저장소에서도 제거 | ✅ | 〃`::"비밀이 없는 레코드는 복원하지 않고 지운다"` |
| 6 | 복호화 실패는 `unknown` 유지 | ✅ | 〃`::"복호화 실패는 버리지 않고 unknown 으로 둔다"` — index 는 남기고 값만 지워 실제 3상태를 재현 |
| 7 | `browser_session` 제외 | ✅ | 〃`::"browser_session binding 은 복원하지 않는다"` |
| 8 | `application` 제외 + 게이트 미통과 | ✅ | 〃`::"application binding 은 복원하지 않는다 — 게이트를 건너뛰지 않는다"` — `status().authenticated === false` 까지 단언 |
| 9 | connector 마다 한 번 연결 | ✅ | `auth-restore.test.ts::"복원된 connector 마다 한 번씩 연결한다"` |
| 10 | 실패 binding 정리 + 나머지 계속 | ✅ | 〃`::"연결에 실패한 binding 은 정리하고 나머지는 계속 연결한다"` |
| 11 | 실패해도 부팅 계속 | ✅ | 〃`::"정리마저 실패해도 다음 connector 를 계속 시도한다"` + `bootstrap` 의 `void` + `try/catch` |
| 12 | 저장 파일에 비밀 없음 | ✅ | `binding-records.test.ts::"레코드에 비밀 값을 싣지 않는다"` — artifact 키 3개 고정 + `value` 부재 단언 |
| 13 | 손상 내용은 빈 목록 | ✅ | 〃`::"손상된 저장 내용은 빈 목록으로 강등한다"` + `::"형상이 어긋난 레코드만 버리고 나머지는 살린다"` |
| 14 | logout 하면 다음 부팅에 미복원 | ✅ | `broker-restore.test.ts::"logout 한 binding 은 다음 부팅에 복원되지 않는다"` |
| 15 | 재시작 후 입력 없이 연결 유지 | ❌ **미검증** | **사람 실기** — `npm run dev` 불가(egress 차단) |
| 16 | PAT 폐기 후 재시작 → 재입력 요구 | ❌ **미검증** | **사람 실기** — 동일 |

**집계(직접 재측정)**: ✅14 / ❌2(둘 다 사람 실기). **테스트 없는 충족 0건.**

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 아래 |
| 인수 기준 ↔ 코드 1:1 | ✅ | 이견 시 중재 | 14/16 |
| 레이어 경계(boundaries) 위반 0 | ✅ | — | 포트=features · 구현=infra · 조립=app. lint 0 error |
| 저장 파일에 비밀 부재 | ✅ 형상 단언 | ✅ 실제 파일 눈으로 확인 | AC12 ✅ / 실파일은 사람 |
| **부팅 경로 실동작** | ✖ electron 불가 | ✅ | **AC15·16 대기** |
| 보안 정책 변경 승인(자동 복원) | ✖ 제안 | ✅ 결정 | 2026-08-05 사용자 결정 |
| PR 머지 승인 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ npm run lint       → ✖ 1 problem (0 errors, 1 warning)   ← 0102 베이스라인
$ npm run typecheck  → error TS 0건 (3/3)
$ ./node_modules/.bin/vitest run src/main/features/auth-platform/ src/main/infra/auth/ \
                                 src/main/app/auth-restore.test.ts
   Test Files  26 passed (26) · Tests  424 passed (424)     ← 베이스라인 23파일/401 대비 +3/+23
```

`src/main/app/chat-turn.continuity.test.ts` 는 electron 로드 실패(better-sqlite3 ABI egress
베이스라인)로 별도 red — 0168 verify 에 기록한 5파일 중 하나이고 이번 변경과 무관하다.

## 위생 검토

- 새 저장 파일에 키/토큰/비밀이 들어갈 **자리가 형상에 없다**(AC12). 로그에도 값이 없다 —
  `auth.restore.dropped` 는 bindingId 와 사유만 싣는다.
- `bindings.ts` 헤더 주석을 새 사실로 갱신했다(옛 결정을 그대로 둔 채 코드만 바꾸면 다음 사람이
  주석을 믿는다).

## PHASES.md 정합성

- **미승격 (의도)** — 0160~0169 가 모두 미승격이라 일관을 유지한다. 라이브 상태는 `INDEX.md`.

## 검증 자기 리뷰

- **설계 단계**: plan 이 "순수부 seam 을 둔다" 고 적고도 **파일 경계로 긋지 않아**, 구현이
  한 파일에 합쳤다가 테스트가 즉시 죽었다. → 다음 plan 이 따라 할 형태: **"electron·DB 를 무는
  모듈은 순수부를 *별도 파일*로 지정하고 그 파일명을 설계에 적는다."** — 이 저장소는 제약 환경이
  상시라 "같은 파일 안 순수 함수" 는 seam 이 아니다.
- **설계 단계 2**: R10 의 베이스라인 수치가 틀렸다(12/219 → 실측 23/401). 관문 1 이 "인용할 모든
  수치를 그 자리에서 재측정한다" 를 요구하는데 **plan 을 쓰는 중에 재측정을 건너뛰었다.**
- **구현 단계**: 선조치 4건이 전부 경계 안. #1(id 충돌)은 설계가 놓친 자격증명 오배정 경로다.
- **검증 단계 — 못 본 것**:
  - **부팅 실동작(AC15·16)** 은 대리 불가다. 특히 `void` 로 띄운 비동기 복원이 실제 부팅
    타이밍에서 다른 단계와 경합하지 않는지는 **실기로만** 확인된다.
  - `createBindingPersistence()` 의 electron-store 왕복(파일 생성·권한·경로)은 미검증이다.
    `SecretStore` 와 같은 패턴을 따랐다는 것이 유일한 근거다.
  - **safeStorage 가 재부팅 후 실제로 복호화하는지** 확인하지 못했다 — 이것이 이 기능의
    전제인데, 검증은 사람 실기(AC15)에 전적으로 의존한다.

## 결론 / 다음 단계

**PASS.** 인수 기준 16건 중 14건이 테스트와 함께 충족됐고 2건은 사람 실기다.

**사람에게 남는 것**: ⓐ Confluence 연결 후 재시작 → 입력 없이 연결 유지되는지(AC15)
ⓑ 서버에서 PAT 폐기 후 재시작 → 연결 실패로 표시되고 재입력을 요구하는지(AC16)
ⓒ `<userData>/orca-auth-bindings.json` 을 열어 비밀이 없는지 눈으로 확인.

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **기존** 잔여 비밀 — 이번 변경 이전에 만들어진 죽은 binding 네임스페이스의 암호문이 `orca-secrets.json` 에 남아 있다(이번 변경이 *새* 잔여를 막을 뿐) | plan §범위 비범위 · verify r1 §0 | vault 에 네임스페이스 열거를 추가해 고아 prefix 를 청소한다. 별도 핸드오프 | open (비범위) |
| D2 | `createBindingPersistence()` 자체가 미테스트(electron-store 로드 불가) | verify r1 역방향 탐색 | 제약 없는 환경(CI, windows-latest)에서는 로드된다 — 통합 테스트를 CI 전용으로 두는 방안 | open |
