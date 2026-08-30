# Plan — 0210-worktree-lifecycle

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0210-worktree-lifecycle` |
| 작성자 | Claude Code |
| 일자 | 2026-08-30 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Delta V` |
| 기준 V | `0209-git-worktree-isolation:V1@6d8c67c6` |
| 이번 V revision | `ΔV1` |
| 유효 V | `0209 V1 + ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0209가 만든 worktree 격리가 세 지점에서 사용자를 막는다 — (a) 격리를 켜도 브랜치 전환이 작업 트리를 즉시 checkout해 커밋을 요구하고, (b) worktree 디렉토리가 UUID 2단이라 사람이 식별할 수 없으며, (c) worktree가 외부에서 삭제되면 그 세션의 대화가 영구히 막힌다.
- 완료 후 달라지는 것: 격리를 켠 세션은 커밋 없이 브랜치를 고르고 전송할 수 있고, worktree는 `~/.config/orca/worktrees/<repo>-<hash8>/<branch>` 로 사람이 찾을 수 있으며, worktree가 사라져도 대화가 원본 작업 경로에서 이어진다.
- 성공을 사용자 관점에서 한 문장으로: **격리를 켜는 것이 사용자의 현재 작업 트리와 대화 연속성 어느 쪽도 인질로 잡지 않는다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "3. 유예 선택" — 격리 시 브랜치 변경은 즉시 checkout하지 않는다 | 2026-08-30 라이브 세션 |
| 명시 요구 | "4. 그럼 orca 경로에서 dev의 경우에만 '-dev' suffix로 구분할 것" | 같은 세션 |
| 명시 요구 | "5. 대화가 시작되면 프로세스가 몇분동안은 유지될텐데, 이것과는 관계없이 가능한지?" — 장수명 프로세스와 무관한 복구 요구 | 같은 세션 |
| 명시 요구 | dirty source 거부 해제 (claude 패리티) | 같은 세션, 선택지 응답 |
| 명시 관측 | "orca 제품은 `<설치경로>/worktrees`에 2 depth … 브랜치식별자B는 워크트리 브랜치 이름과 일치하지도 않음" | 같은 세션 |
| 명시 관측 | worktree 외부 삭제 시 "에러: 스트림 오류 … native binary … failed to launch" 로 대화 불가 | 같은 세션 |
| 추론 의도 | 폴백은 1회성 우회가 아니라 영속돼야 한다 — 추론. 근거: 사용자가 "패널스택이 현재 브랜치로 변경되며 모든 diff 및 git 정보가 현재 브랜치를 따라간다"를 기대 동작으로 인용했다 | 설계자 해석 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-101 | 격리 ON이면 브랜치 칩 선택은 `git checkout`을 실행하지 않고 **다음 worktree의 base ref로만 유예**한다 | "3. 유예 선택". 격리 OFF의 즉시 checkout은 그대로 | 사용자 턴 | ACTIVE | — |
| D-102 | worktree 루트는 `~/.config/orca/worktrees` (`orcaConfigDir()` 하위) | repo 내부에 두면 `--untracked-files=all` 이 저장소를 영구 dirty로 만든다 | 사용자 턴 + 조사 | ACTIVE | 0209 D(userData 하위) 대체 |
| D-103 | dev는 **worktrees 디렉토리에만** `-dev` suffix를 붙인다. `orcaConfigDir()` 자체는 바꾸지 않는다 | "orca 경로에서 dev의 경우에만 '-dev' suffix". config 루트 전체를 가르면 dev가 settings·plugins·projects를 잃는다 | 사용자 선택 | ACTIVE | — |
| D-104 | worktree 디렉토리는 `<repo이름>-<repoRoot 해시8>/<브랜치 slug>` 2단이다 | 첫 칸이 실제 저장소 식별자, 둘째 칸이 브랜치와 일치해야 한다 | 사용자 관측 | ACTIVE | 0209 D(UUID/UUID) 대체 |
| D-105 | 격리 준비는 **dirty source를 거부하지 않는다** | `git worktree add`는 source 작업 트리를 건드리지 않는다. claude 패리티 | 사용자 선택 | ACTIVE | 0209 R-08 SUPERSEDE |
| D-106 | 커밋되지 않은 변경이 새 worktree에 따라오지 않는다는 사실은 **칩 툴팁 문구**로 알린다 | D-105가 없앤 것은 거부지 안내가 아니다 | 설계자, 사용자 선택지 preview에 명시 | ACTIVE | — |
| D-107 | worktree 소실 시 **source_cwd로 폴백하고 그 폴백을 영속**한다 (sessions.cwd 갱신 + managed row 삭제) | 1회성 우회면 다음 턴이 같은 실패를 반복하고 화면은 죽은 경로를 계속 보여준다 | 설계자 추론 (§2) | ACTIVE | 0209 R-13 CHANGED |
| D-108 | 살아 있는 채널은 폴백 시 `teardownChannel()`로 내린다 — cwd는 spawn 시점에 박혀 재지정할 수 없다 | "장수명 프로세스와 무관하게 가능한지"에 대한 답 | 사용자 질의 + 조사 | ACTIVE | — |
| D-109 | 폴백 통지는 **새 wire variant 없이** 기존 `session.updated`의 `patch.cwd`로 한다 | 렌더러 reducer가 이미 `patch.cwd`로 cwd를 갱신하고 BranchChip·CwdButton이 그 cwd를 따른다 | 조사 | ACTIVE | — |
| D-110 | 기존 `<userData>/worktrees` 아래 worktree는 마이그레이션하지 않는다 | `managed_worktrees.worktree_root`가 절대경로라 기존 행은 그대로 해석된다 | 조사 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-101 ~ D-110 전부. 0210의 첫 설계 턴이다.
- 변경된 결정: 0209 R-08(dirty 거부) → D-105로 SUPERSEDED. 0209 R-10(userData/UUID/UUID 경로) → D-102·D-104로 SUPERSEDED.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0209의 격리 선택 범위(신규 일반 세션 전용, R-07)·안전 삭제(R-15)·external worktree 불간섭(R-16)·mutation queue(R-17)는 그대로다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-105("거부하지 않는다") ↔ AC1("dirty여도 managed 결과") → 일치. D-103("worktrees에만 suffix") ↔ AC3("`orcaConfigDir()` 반환값 불변") → 일치. D-107("영속") ↔ AC11("재시작 후에도 source cwd") → 일치. D-101("격리 ON일 때만 유예") ↔ AC5("격리 OFF는 즉시 checkout") → 일치(조건절 보존).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **전제 정정 1건**. 사용자는 "orca는 composer 조작시 바로 워크트리 수행"으로 봤으나 orca도 턴에서 만든다 | `send.ts:140` → `prepare-worktree.ts:22`. 커밋 요구의 실제 출처는 `BranchChip.tsx:140` → `git-cli.ts:142`의 즉시 checkout이다 |
| 이미 기존 코드가 충족하는가 | 아니오. `BranchChip.tsx`에 `worktreeIsolation` 참조 0건 — 칩이 격리 상태를 모른다 | `rg 'worktreeIsolation' app/src/renderer/src/features/chat/components/composer/` → 0건 |
| 더 작은 해법이 있는가 | 예, 셋 다. 폴백은 기존 respawn 무효화 축에 1개 추가, 통지는 기존 `session.updated` 재사용, 경로는 `managedWorktreesDir` 1함수 | `respawn-policy.ts:20-30` · `chatReducer.ts:443` · `paths.ts:41` |
| 선행 자료의 주장을 코드와 대조했는가 | 예. 오류 메시지의 libc 원인 주장은 **오진**이다 — SDK는 spawn 실패 시 바이너리 `existsSync`만 보고 문구를 고른다 | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`: `function _xe(e,t){if(lxe(e))return \`Claude Code native binary at ${e} exists but failed to launch` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 예, 2건 — 0209 R-08·R-10. 둘 다 사용자가 명시적으로 뒤집었다(D-105·D-102/104) | 0209 `plan.md:155`·`plan.md:157` |

- 사용자에게 올릴 결정: **없음**. dirty 거부 해제는 이번 턴에 물어 D-105로 닫았다.
- 코드 조사로 닫은 사실: worktree 생성 시점(턴) · 오류 문구의 실제 원인(존재하지 않는 cwd로의 spawn) · `orcaConfigDir()` 존재 · `session.updated`의 `patch.cwd` 소비 경로 · 마이그레이션 불필요.

## 5. 동작 / 사용자 흐름

```text
[격리 칩 ON] + [브랜치 칩에서 feature 선택]
  → 작업 트리 변경 0, 칩 라벨만 선택값으로 바뀜 (커밋 요구 없음)
  → [전송]
  → worktree 생성 (base = feature 의 HEAD) → Agent 시작
  ↘ 생성 실패 → 이번 send 만 오류, 다음 send 는 정상

[worktree 가 외부에서 삭제됨] + [다음 전송]
  → cwd 부재 감지 → source_cwd 로 폴백 → 채널 teardown → 콜드 스폰
  → 대화 계속, 화면의 경로·브랜치·diff 가 원본 작업 경로를 따라감
  ↘ source_cwd 도 없으면 → 이번 send 오류 (기존 오류 경로)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 격리 ON + 브랜치 선택 | payload에 base ref 보관, checkout 미실행 | 칩 라벨이 선택 브랜치, 작업 트리 그대로 |
| 격리 OFF + 브랜치 선택 | 기존대로 즉시 checkout (dirty면 해소 모달) | 0209/0206과 동일 |
| 격리 ON + dirty source + 전송 | worktree 생성 진행 | 대화 시작. 원본의 미커밋 변경은 그 자리에 남음 |
| 격리 ON + 전송 + 생성 실패 | rejected 결과 | 이번 send만 오류 문구, 세션은 살아 있음 |
| resume + worktree 존재 | 기존 executionCwd 사용 | 변화 없음 |
| resume + worktree 소실 | 폴백 + sessions.cwd 갱신 + `session.updated` | 경로 칩이 원본 경로로, 브랜치/diff가 원본 추종 |
| resume + worktree 소실 + 채널 생존 | 위 + `teardownChannel()` → 콜드 스폰 | 응답이 조금 늦을 뿐 대화는 이어짐 |

### 파생 UX / 엣지케이스

- loading / empty / error: 폴백은 loading 상태를 새로 만들지 않는다 — 기존 콜드 스폰 경로를 탄다.
- cancel / retry / close / restart: 폴백이 영속되므로 재시작 후에도 원본 경로다(D-107). 폴백 도중 abort면 sessions.cwd를 쓰지 않는다.
- concurrency / multi-session: 같은 repo의 두 세션이 동시에 worktree를 만들면 디렉토리 이름은 브랜치 slug라 서로 다르다 — 브랜치 유일성 루프가 디렉토리 유일성도 겸한다(§11).
- keyboard / a11y / theme: 격리 칩의 `ariaPressed`는 유지. 브랜치 칩은 격리 ON에서도 계속 조작 가능하다 — 비활성화하지 않는다.
- 외부환경: `~/.config/orca` 가 없으면 `ensureConfigDir()` 이후 `mkdir -p`로 만든다(기존 동작).

## 6. 범위 / 비범위

- **범위**: 브랜치 선택 유예 · worktree 경로 재배치 · dev suffix · dirty 거부 해제 · worktree 소실 폴백과 그 영속 · 폴백의 respawn 축.
- **비범위**: 기존 `<userData>/worktrees` 이설/정리 · worktree 목록 UI · 고아 worktree 부팅 reconciliation · 0209의 안전 삭제 정책 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 기존 userData worktree 이설 | 아니오 — 절대경로 저장이라 기존 행이 계속 동작한다(D-110) | 후속 |
| 고아 worktree 부팅 reconciliation | 아니오 — 폴백이 세션 축의 손실을 이미 막는다 | 후속 |
| 디렉토리 이름 스키마 | **예 — 저장 경로는 one-way door** | 지금 확정(D-104) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-21 | AT-21 / AC1 | dirty source(tracked·untracked·양쪽)여도 격리 준비가 `kind:'managed'`를 낸다 | porcelain 3종 fixture에서 `add` 1회 + 결과 kind 직접 관측 | CwdPanel 격리 ON → send → `service.prepare` |
| R-21 | AT-21b / AC2 | 준비 후에도 source 작업 트리의 미커밋 변경이 그대로다 | 준비 전후 `status --porcelain` 출력 동일 단언 | 같은 경로 |
| R-22 | AT-22 / AC3 | worktree 루트가 `orcaConfigDir()/worktrees`이고 `orcaConfigDir()` 반환값은 불변이다 | `managedWorktreesDir()` 반환값 + `orcaConfigDir()` 회귀 단언 | `bootstrap.ts` → `WorktreeService.rootDir` |
| R-22 | AT-22b / AC4 | dev면 `worktrees-dev`, prod면 `worktrees`다 | dev 플래그 두 값에 대한 반환값 표 | `paths.ts` 순수 함수 |
| R-22 | AT-22c / AC5 | worktree 경로가 `<repo이름>-<hash8>/<브랜치 slug>` 이고 같은 repoRoot는 같은 첫 칸을 만든다 | 같은 repoRoot 2회 호출의 첫 칸 동일 + 다른 repoRoot의 첫 칸 상이 단언 | `service.prepare` path mapping |
| R-22 | AT-22d / AC6 | 디렉토리 둘째 칸이 실제 생성된 브랜치 이름에서 파생된다(`/`→`-`) | 생성 결과의 branch와 경로 basename 대조 | 같은 경로 |
| R-23 | AT-23 / AC7 | 격리 ON에서 브랜치를 고르면 `git.checkout` IPC가 호출되지 않는다 | fake gitApi에서 checkout 호출 0회 + 선택 상태 반영 단언 | BranchChip `onPick` → (유예) |
| R-23 | AT-23b / AC8 | 격리 OFF에서는 기존대로 checkout이 호출되고 dirty면 해소 모달이 뜬다 | checkout 1회 + `reason:'dirty'`에서 prompt 상태 단언 (REGRESSION) | BranchChip `onPick` → `gitApi.checkout` |
| R-24 | AT-24 / AC9 | 유예된 브랜치가 payload `worktreeBaseRef`로 실려 schema를 통과한다 | 신규+격리 ON 조합 통과, resume/fork 조합·격리 OFF 조합 거부 단언 | store send → `SendChatMessageSchema` |
| R-24 | AT-24b / AC10 | 선택 브랜치가 새 worktree의 base가 된다 — 생성된 worktree의 HEAD가 그 브랜치의 OID다 | 두 브랜치가 다른 커밋인 repo에서 worktree HEAD 직접 관측 | payload → `service.prepare(baseRef)` → `addWorktree(base)` |
| R-09' | AT-09' / AC11 | base OID는 준비 초기에 **한 번** 읽는다 — 미선택이면 HEAD, 선택이면 그 ref | ref 읽은 뒤 브랜치 이동을 모사해 `add`의 base가 최초 OID인지 관측 (CHANGED) | `resolveHead`/`resolveRef` → `addWorktree` |
| R-25 | AT-25 / AC12 | worktree 디렉토리가 없으면 다음 턴의 실행 cwd가 `source_cwd`다 | 디렉토리 삭제 후 turn 조립 결과 cwd 직접 관측 | send → `prepareTurnExecution` → `buildTurnContext` |
| R-25 | AT-25b / AC13 | 폴백 턴이 실제로 실행된다 — Agent가 시작하고 오류 이벤트가 나가지 않는다 | 삭제 fixture에서 runtime acquire 1회 + `type:'error'` 0회 | 같은 경로 |
| R-25 | AT-25c / AC14 | 채널이 살아 있으면 폴백이 `teardownChannel()`을 유발한다 | `channelAlive=true`+cwd 소실 입력에서 `decideRespawn` true, 소실 없으면 false | `runtime-entry.ts` → `decideRespawn` |
| R-26 | AT-26 / AC15 | 폴백이 `sessions.cwd`를 source_cwd로 갱신하고 managed row를 지운다 | DB 재조회로 두 값 직접 관측 | 폴백 → `DbQueries` |
| R-26 | AT-26b / AC16 | 재시작(DB 재오픈) 후 같은 세션이 source_cwd로 resume한다 | reopen 후 `resolveTurnCwd` 결과 단언 | DB → `resolveTurnCwd` |
| R-26 | AT-26c / AC17 | 폴백이 `session.updated`를 `patch.cwd=source_cwd`로 보낸다 | 방출 이벤트 payload 직접 관측 + reducer가 cwd를 바꾸는 회귀 | main emit → `chatReducer.ts:443` |
| R-27 | AT-27 / AC18 | 격리 칩 툴팁이 미커밋 변경이 따라오지 않음을 한국어로 알린다 | i18n 키 존재 + 칩 `title` 단언 | `ko.ts` → CwdPanel |
| R-13' | AT-13' / AC19 | worktree가 살아 있으면 resume이 여전히 같은 executionCwd다 (REGRESSION) | 기존 `worktree-bind.test.ts` reopen 케이스 전건 | 기존 경로 |
| R-02 | AT-14 / AC20 | 준비 실패가 앱이 아니라 그 send만 실패시킨다 (REGRESSION) | 실패 주입 후 다음 non-isolated send 성공 | 기존 경로 |
| R-15 | AT-15 / AC21 | 세션 삭제 안전 증명(clean + HEAD==base)이 유지된다 (REGRESSION) | 기존 `safe-delete.test.ts` 전건 | 기존 경로 |

### AC 검증 주의사항

- 기존 테스트 재사용: `worktree-bind.test.ts`의 reopen 케이스(AC19)와 `safe-delete.test.ts`(AC21)는 실제 존재한다 — `app/src/main/app/chat-turn/worktree-bind.test.ts:1`(AC12·13 주석), `app/src/main/features/worktrees/safe-delete.test.ts`.
- 사람 실기 항목: **없음**. 격리 칩 툴팁(AC18)은 i18n 키 + `title` 속성 단언으로 닫는다 — 시각 배치는 0209 AC20이 이미 담당했고 이번 변경은 문구뿐이다.
- 0건 기준: AC7의 "checkout 호출 0회"는 **AC8의 양성 단언(격리 OFF에서 1회)과 쌍이다.** 유예 코드를 지우면 AC8이 아니라 AC7이 red여야 하고, 칩 자체를 지우면 AC8이 red다.
- AC14의 `decideRespawn`은 순수 함수라 두 방향(소실 true / 정상 false)을 모두 단언한다 — 한 방향만 보면 항상 true를 반환하는 변이를 못 잡는다.
- AC5의 "같은 repoRoot → 같은 첫 칸"은 결정성 단언이다. 현재 코드의 `randomUUID()`(`service.ts:87`)를 그대로 두면 red다.

## 7-A. V / Trace Matrix

- V mode 판정: **Delta V**. 0209가 worktree 격리의 Baseline V(V1)를 이미 갖고, 이번 작업은 그중 경로·dirty 정책·resume cwd를 바꾸고 유예·복구를 더한다.
- 기준 V 상속 근거: `0209-git-worktree-isolation:V1@6d8c67c6` (verify r13 PASS 시점의 plan).
- 변경이 시작되는 수준: **R**. 사용자가 관측하는 결과가 바뀌고(유예·dirty·복구) 그 아래 SD/AR/MD가 모두 따라온다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-08 | R | 0209 §7 dirty 거부 | **SUPERSEDED** | → R-21 |
| R-10 | R | 0209 §7 userData UUID 경로 | **SUPERSEDED** | → R-22 |
| R-21 | R | §7 dirty여도 준비 성공 | NEW | — |
| R-22 | R | §7 config 루트 + repo/branch 경로 | NEW | — |
| R-23 | R | §7 브랜치 선택 유예 | NEW | — |
| R-24 | R | §7 선택 브랜치가 base | NEW | — |
| R-25 | R | §7 소실 시 폴백 실행 | NEW | — |
| R-26 | R | §7 폴백 영속 | NEW | — |
| R-27 | R | §7 미커밋 변경 안내 | NEW | — |
| R-09' | R | §7 base OID 1회 읽기 | CHANGED | 0209 R-09 (HEAD 고정) |
| R-13' | R | §7 정상 resume 동일 cwd | CHANGED | 0209 R-13 (무조건 세션행 cwd) |
| R-02 | R | 0209 §7 오류 격리 | INHERITED | 0209 AT-14 |
| R-15 | R | 0209 §7 안전 삭제 | INHERITED | 0209 AT-15 |
| SD-06 | SD | §5 소실 감지→폴백→teardown→콜드 스폰 | NEW | — |
| SD-07 | SD | §5 유예된 base가 생성까지 도달 | NEW | — |
| SD-01 | SD | 0209 §5 prepare→Agent 순서 | INHERITED | 0209 ST-01 |
| SD-02 | SD | 0209 §5 metadata bind→resume | INHERITED | 0209 ST-02 |
| AR-03' | AR | §9 executionCwd 해석에 존재 확인·폴백 | CHANGED | 0209 AR-03 |
| AR-05' | AR | §10 sessions.cwd 갱신 statement | CHANGED | 0209 AR-05 |
| AR-08 | AR | §9 respawn 무효화 축 추가 | NEW | — |
| AR-09 | AR | §9 renderer 유예 → payload → service base | NEW | — |
| MD-01' | MD | §11 path mapping (repo/branch) | CHANGED | 0209 MD-01 |
| MD-06 | MD | §11 repo 식별자·slug·충돌 회피 | NEW | — |
| MD-03' | MD | §11 dirty 분류 소비처 축소 | CHANGED | 0209 MD-03 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| WP-01 | R-21 ↔ AT-21·21b(AC1·2) | REQUIRED | 격리 ON send → prepare → isClean 미거부 → addWorktree | porcelain 3종에서 결과 kind + 준비 전후 source status 동일 | not selected — 직접 행동(생성 성공·트리 불변) 관측 | EP-11 (2) |
| WP-02 | R-22 ↔ AT-22~22d(AC3~6) | REQUIRED | bootstrap → managedWorktreesDir → service path mapping | 반환 경로 문자열 + 실제 생성 디렉토리 basename | required — `randomUUID()` 잔존 변이가 AC5 결정성 단언을 red로 만드는지 | EP-09 (2) · EP-13 (1) |
| WP-03 | R-23 ↔ AT-23·23b(AC7·8) | REQUIRED | 격리 상태 → BranchChip onPick/onConfirm → (유예 or checkout) | fake gitApi checkout 호출 수 0/1 양방향 | required — 유예 분기를 지우면 AC7 red, 칩을 지우면 AC8 red | EP-14 (2) |
| WP-04 | R-24·R-09' ↔ AT-24·24b·09'(AC9~11) | REQUIRED | store send → schema → prepare(baseRef) → addWorktree(base) | 생성된 worktree HEAD의 OID 직접 관측 | not selected — 최종 OID가 직접 결과다 | EP-15 (3) |
| WP-05 | R-25 ↔ AT-25·25b(AC12·13) | REQUIRED | 삭제된 cwd → prepareTurnExecution 존재 확인 → source_cwd → runtime | turn.cwd 값 + runtime acquire 1회 + error 0회 | required — 존재 확인을 지우면 AC12·13이 red인지 | EP-16 (2) |
| WP-06 | R-25 ↔ AT-25c(AC14) | REQUIRED | runtime-entry → respawnInputs → decideRespawn | 소실/정상 두 입력의 boolean 양방향 | required — 항상 true 반환 변이를 정상 입력이 잡는지 | EP-16 (2) |
| WP-07 | R-26 ↔ AT-26~26c(AC15~17) | REQUIRED | 폴백 → sessions.cwd UPDATE + row 삭제 + session.updated | DB 재조회 2값 + 방출 payload + reducer cwd | required — 세 쓰기 중 하나를 지우면 각각 다른 AC가 red인지(형제 슬롯) | EP-17 (3) |
| WP-08 | R-27 ↔ AT-27(AC18) | REQUIRED | ko.ts → CwdPanel title | i18n 키 + 칩 `title` 문자열 | not selected — 문구 존재가 직접 결과다 | EP-01 (2) |
| WP-09 | R-13' ↔ AT-13'(AC19) | REGRESSION | DB → resolveTurnCwd → turn | 기존 reopen 케이스 전건 | not selected — 양성 resume 단언 | EP-16 (2) |
| WP-10 | R-02 ↔ AT-14(AC20) | REGRESSION | 준비 실패 → chat error → 다음 send | 후속 send 성공 | not selected | EP-16 (2) |
| WP-11 | R-15 ↔ AT-15(AC21) | REGRESSION | delete → 안전 증명 → remove/보존 | 기존 safe-delete 표 전건 | not selected | EP-11 (2) |
| WP-12 | SD-06 ↔ ST-06(AC12~14) | REQUIRED | 소실 → 폴백 → teardown → 콜드 스폰 → 응답 | 순서 로그: 폴백 → teardown → spawn | required — teardown 제거 시 죽은 cwd 채널 재사용이 관측되는지 | EP-16 (2) · EP-17 (3) |
| WP-13 | SD-07 ↔ ST-07(AC9·10) | REQUIRED | 칩 선택 → payload → prepare → worktree HEAD | 종단 OID 일치 | not selected — 종단 관측 | EP-15 (3) |
| WP-14 | SD-01 ↔ ST-01 | REGRESSION | send → prepare 완료 → runtime acquire | 기존 deferred order 케이스 | not selected | EP-16 (2) |
| WP-15 | SD-02 ↔ ST-02 | REGRESSION | create → null row → bind → reopen | 기존 bind/reopen 케이스 | not selected | EP-17 (3) |
| WP-16 | AR-03' ↔ IT-03'(AC12·19) | REQUIRED | resolveTurnCwd → 존재 확인 → executionCwd → TurnRequest | 최종 TurnRequest cwd | required — 존재 확인 우회 변이 | EP-16 (2) |
| WP-17 | AR-05' ↔ IT-05'(AC15·16) | REQUIRED | 폴백 → DbQueries → reopen | 실제 DB 행 2회 조회 | not selected — 행 값이 직접 결과다 | EP-17 (3) |
| WP-18 | AR-08 ↔ IT-08(AC14) | REQUIRED | runtime-entry 입력 조립 → decideRespawn | respawnInputs가 새 축을 싣는지 + 판정 | required — 입력 조립에서 축을 빠뜨리는 변이(배선 존재 oracle) | EP-16 (2) |
| WP-19 | AR-09 ↔ IT-09(AC7·9) | REQUIRED | CwdPanel isolation → BranchChip → store draft → schema | payload 필드 + checkout 미호출 | required — 격리 상태 전달을 끊는 변이 | EP-01 (2) · EP-14 (2) · EP-15 (3) |
| WP-20 | MD-01'·MD-06 ↔ UT-01'(AC5·6) | REQUIRED | repoRoot/branch → path 파생 → 디렉토리 | POSIX/Windows 경로 표 + 결정성 | required — 해시를 랜덤으로 되돌리는 변이 | EP-09 (2) |
| WP-21 | MD-03' ↔ UT-03'(AC1·21) | REQUIRED | porcelain → 분류 → (준비 미사용 / 삭제 증명 사용) | 두 소비처의 분기 결과 | required — 삭제 증명에서도 dirty를 무시하는 변이가 AC21을 red로 만드는지 | EP-11 (2) |

`NOT_REQUIRED`로 판정한 inherited pair: 0209 VP-09(IPC 계약 sweep)·VP-12(mutation queue)·VP-15(naming 실패 매트릭스)·VP-16(external worktree 불간섭). 이번 변경은 Git 실행 스택·큐·naming 실패 분기·external 분류를 건드리지 않는다 — 경로 문자열과 base ref 인자만 바뀌고 `runGit` 호출 형태는 동일하다. 기존 증거 좌표는 0209 `verify.md` r13의 해당 pair 행이다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree — `app/AGENTS.md` | `app/**` 를 수정한다 | `cd app && npm run lint && npm run typecheck` (ABI 중립) | 이번 변경이 낸 error만 blocking |
| 관련 순수 테스트 | worktree·chat-turn·composer 스위트 | `./node_modules/.bin/vitest run src/main/features/worktrees src/main/app/chat-turn src/main/infra/config src/renderer/src/features/chat` | 이번 변경이 낸 red만 blocking |
| DB 스위트 | `sessions.cwd` UPDATE·managed row 삭제를 실제 SQLite로 본다 | `npm test` (Node ABI) — `managed-worktrees.test.ts`·`queries.test.ts` | egress 차단 환경의 bindings 실패는 환경 기인으로 분리 |
| repository — INDEX/trailer | 보드 행과 커밋 trailer를 이번 턴이 갱신한다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| worktree 생성은 이미 턴 시점이다 — 칩은 상태만 바꾼다 | `chatStore.ts:755` (`setWorktreeIsolation`) · `send.ts:140` → `prepare-worktree.ts:22` |
| 커밋 요구의 실제 출처는 브랜치 칩의 즉시 checkout이다 | `BranchChip.tsx:140` → `git-cli.ts:142` (`runGit(cwd,['checkout',branch])`) |
| 브랜치 칩은 격리 상태를 모른다 | `BranchChip.tsx` 전체에 `worktreeIsolation` 참조 0건 |
| `repoId`는 저장소 식별자가 아니라 호출마다 새 UUID다 | `service.ts:87` `const repoId = randomUUID()` |
| dirty 게이트는 untracked까지 본다 | `repository.ts:23` `['status','--porcelain','--untracked-files=all']` |
| `orcaConfigDir()`은 모든 OS에서 `~/.config/orca`다 | `paths.ts:28-30` |
| resume cwd는 존재 확인 없이 세션행 값을 돌려준다 | `turn-context.ts:57-66` (`usableCwd`는 루트 여부만 본다) |
| 어댑터는 그 cwd를 그대로 spawn에 넘긴다 | `claude.ts:264` `...(req.cwd ? { cwd: req.cwd } : {})` |
| SDK는 spawn 실패 시 바이너리 존재만 보고 libc 문구를 고른다 | `sdk.mjs`: `function _xe(e,t){if(lxe(e))return \`Claude Code native binary at ${e} exists but failed to launch` |
| 채널은 장수명이고 무효화 축이 이미 5개다 | `runtime-entry.ts:65-89` · `respawn-policy.ts:20-30` |
| `session.updated`는 이미 `patch.cwd`를 싣고 렌더러가 소비한다 | `shared/ipc.ts:441-445` · `chatReducer.ts:443` |
| `sessions.cwd`를 갱신하는 statement가 없다 | `rg 'UPDATE sessions SET' app/src/main/infra/db/queries.ts` → 3건(provider_key·title·pinned_at), cwd 없음 |
| `managed_worktrees`는 절대경로를 저장해 마이그레이션이 불필요하다 | 0209 `plan.md:313` `worktree_root TEXT NOT NULL UNIQUE` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `managedWorktreesDir` 소비처 | `rg 'managedWorktreesDir' app/src` | 2 | 정의(`paths.ts:41`) + 호출(`bootstrap.ts:835`). 테스트 참조 0 |
| turn 실행 cwd 조립 진입점 | `rg 'prepareTurnExecution\|prepareTurnWorktree' app/src/main --글로브 non-test` | 1 | `send.ts:140` 하나. continuation·held는 turn.cwd를 계승한다(`continuation.ts:38`·`turn-context.ts:230`) |
| BranchChip의 트리 변경 진입 | `BranchChip.tsx` 내 `checkout(` 호출 | 2 | `onPick`(140) · dirty `onConfirm`(170) |
| `orcaConfigDir()` 소비처 | `rg 'orcaConfigDir' app/src` | 15 | settings·plugins·workspace-guard·projects·downloads — **D-103이 이들을 건드리지 않는 이유** |
| respawn 무효화 축 | `respawn-policy.ts` 필드 | 5 | provider·model·settings·env·tools revision. cwd 축이 6번째 |
| dirty 분류 소비처 | `rg 'isClean' app/src/main` | 2 | `service.ts:66`(준비 — 제거 대상) · `service.ts:151`(삭제 증명 — 유지) |

### 수치 / 전칭 표현 검산

- 재측정 수치: `managedWorktreesDir` 2 · turn 진입 1 · BranchChip checkout 진입 2 · respawn 축 5 · `isClean` 소비처 2. 모두 이번 세션에서 `rg`로 셌다.
- 내역 합 = 총계: §10 강제 지점 EP-01(2) + EP-09(2) + EP-11(2) + EP-13(1) + EP-14(2) + EP-15(3) + EP-16(2) + EP-17(3) = **17 지점**.
- "유일한/항상" 반례 검색: "턴 실행 cwd 조립 진입점은 `send.ts:140` 하나"의 반례를 `prepareTurnExecution` 호출 전수로 확인했다 — 비테스트 호출 1건.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: 0209 `plan.md` §7(144행)·§7-A(176행)·§10(268행) 실재. `worktree-bind.test.ts`·`safe-delete.test.ts` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`·`SD-02`·`AR-03`·`MD-01`(0209 V1)
- 현재 책임 소유자: 경로 파생 `service.prepare` · 실행 cwd 해석 `turn-context.resolveTurnCwd` · 브랜치 전환 `BranchChip`
- 현재 entry → flow → state → consumer: 칩 토글은 store만 바꾸고, 브랜치 칩은 격리와 **무관하게** main의 `gitCheckout`을 불러 작업 트리를 바꾼다. send에서 `prepare`가 dirty를 거부하고, 통과하면 `<userData>/worktrees/<uuid>/<uuid>`에 worktree를 만든다. resume은 세션행 cwd를 검사 없이 돌려준다.
- 현재 오류/취소/정리 경로: 준비 실패는 `rejected` → `sendChatEvent(type:'error')`(`send.ts:215-220`). resume cwd가 없으면 **오류 경로가 없다** — spawn이 실패하고 SDK가 libc 오진 문구를 낸다.
- 문제의 직접 원인: (1) `BranchChip`에 격리 조건 분기 부재, (2) `repoId`가 무작위, (3) `resolveTurnCwd`에 존재 확인 부재.

```text
[브랜치 칩 선택] → gitCheckout(작업 트리 변경) → dirty면 커밋 요구
[send + 격리] → isClean 거부 → prepare → <userData>/worktrees/<uuid>/<uuid>
[resume] → sessions.cwd (검사 없음) → spawn(cwd) → ENOENT → "libc" 오진
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `AR-03'`·`AR-08`·`AR-09`·`MD-01'`·`MD-06`·`SD-06`·`SD-07`
- 변경 후 책임 소유자: 경로 파생은 `paths.ts`(루트) + `worktrees/naming.ts`(디렉토리 세그먼트), 실행 cwd 확정은 `prepare-worktree.ts` 한 곳(신규 세션 생성 + resume 복구 둘 다), 브랜치 전환 분기는 `BranchChip`.
- 변경 후 entry → flow → state → consumer: 격리 ON이면 브랜치 선택이 store draft의 `worktreeBaseRef`만 바꾼다. send에서 `prepare`는 dirty를 보지 않고 선택 ref의 OID를 base로 삼아 `~/.config/orca/worktrees[-dev]/<repo>-<hash8>/<branch>`에 만든다. resume에서는 `prepareTurnExecution`이 cwd 존재를 확인해 없으면 `source_cwd`로 접고, 그 사실을 DB와 렌더러 양쪽에 쓴다.
- 변경 후 오류/취소/정리 경로: 폴백은 오류가 아니라 정상 경로다 — `session.updated`만 나가고 `type:'error'`는 나가지 않는다. source_cwd마저 없으면 기존 `rejected` 오류로 접는다.
- 유지하는 기존 메커니즘: `runGit` 스택 · mutation queue · naming 충돌 루프 · 삭제 안전 증명 · `session.updated` wire. **제거**: 준비 단계의 `isClean` 거부(`service.ts:66-79`). **대체**: `randomUUID()` 경로 → 결정적 파생.

```text
[브랜치 칩 선택 + 격리 ON] → store draft.worktreeBaseRef (작업 트리 불변)
[send] → prepare(baseRef) → resolveRef → ~/.config/orca/worktrees[-dev]/<repo>-<hash8>/<branch>
[resume] → prepareTurnExecution → cwd 존재? → 없으면 source_cwd
        → sessions.cwd UPDATE + managed row 삭제 + session.updated(patch.cwd)
        → decideRespawn(executionCwdMissing) → teardownChannel → 콜드 스폰
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 브랜치 전환이 격리를 모른다 | `BranchChip`이 격리 상태로 분기 | D-101 | AR-09 / WP-03·WP-19 · `BranchChip.tsx` |
| data/control flow | base는 항상 source HEAD | base는 선택 ref(미선택 시 HEAD) | D-101 | SD-07 / WP-04·WP-13 · `service.ts` |
| state/contract | 경로 = userData + UUID 2단 | 경로 = configDir + repo/branch 2단 | D-102·D-104 | MD-01'·MD-06 / WP-02·WP-20 · `paths.ts`·`naming.ts` |
| state/contract | dirty면 준비 거부 | dirty를 준비 판정에서 제외 | D-105 | MD-03' / WP-01·WP-21 · `service.ts` |
| error/lifecycle | resume cwd 부재가 spawn 실패로만 관측 | 부재를 감지해 source_cwd로 폴백·영속 | D-107 | AR-03'·SD-06 / WP-05·WP-07·WP-12 · `prepare-worktree.ts` |
| error/lifecycle | 살아 있는 채널이 죽은 cwd를 유지 | cwd 소실이 respawn 6번째 축 | D-108 | AR-08 / WP-06·WP-18 · `respawn-policy.ts` |
| test seam/관측점 | 경로 파생이 `service` 안에 인라인 | 순수 파생 함수로 분리(전자는 electron 미의존) | 순수 단위 테스트 가능성 | MD-06 / WP-20 · `naming.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/config/paths.ts` | worktree 루트 1개 파생 (dev suffix 포함) | `(isDev: boolean) → string` | `bootstrap.ts` |
| `features/worktrees/naming.ts` | 브랜치 이름 + **디렉토리 세그먼트** 파생·충돌 회피 | `(repoRoot, branch) → segments` | `service.ts` |
| `features/worktrees/service.ts` | 생성/삭제 + base ref 해석 | `prepare({sourceCwd, baseRef?, …})` | `prepare-worktree.ts` |
| `app/chat-turn/prepare-worktree.ts` | **턴 실행 cwd 확정** — 신규 생성 + resume 복구 | `→ passthrough \| managed \| recovered \| rejected` | `send.ts` |
| `features/sessions/respawn-policy.ts` | 무효화 판정(순수) | `+ executionCwdMissing: boolean` | `runtime-entry.ts` |
| `renderer .../composer/BranchChip.tsx` | 격리 ON이면 유예, OFF면 checkout | props에 격리 상태 | `CwdPanel.tsx` |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 (CHANGED) | AR-09 / WP-08·WP-19 | 격리 상태의 renderer 소비 — `CwdPanel`(칩·툴팁) + `BranchChip`(분기) **2곳** | `chatStore.worktreeIsolation` | renderer | 렌더 시 | 칩은 눌리는데 브랜치 칩이 여전히 트리를 바꾼다 |
| EP-09 (CHANGED) | MD-01'·R-22 / WP-02·WP-20 | worktree 루트·세그먼트 파생 — `paths.ts` 정의 + `bootstrap.ts:835` 호출 **2곳** | `paths.ts` | main | 부팅 배선 시 | 경로가 두 갈래가 되거나 dev/prod가 섞인다 |
| EP-11 (CHANGED) | MD-03' / WP-01·WP-21 | `isClean` 소비처 — 준비(**제거**) + 삭제 증명(**유지**) **2곳** | `repository.isClean` | main | 준비/삭제 시점 | 준비가 계속 거부하거나, 삭제가 dirty worktree를 지운다 |
| EP-13 (NEW) | R-22 / WP-02 | dev 분기 — `import.meta.env.DEV` → `paths.ts` 인자 **1곳** | `bootstrap.ts` 주입 | main | 부팅 시 | dev가 prod worktree 루트를 공유한다 |
| EP-14 (NEW) | R-23 / WP-03·WP-19 | 유예 분기 — `onPick`(BranchChip:140) + dirty `onConfirm`(:170) **2 진입** | `BranchChip` | renderer | 브랜치 선택/해소 확인 시 | 한 경로만 막으면 모달 확인에서 트리가 바뀐다 |
| EP-15 (NEW) | R-24·R-09' / WP-04·WP-13·WP-19 | base ref 전달 — store send payload + `SendChatMessageSchema` + `service.prepare` **3좌표** | `shared/protocol.ts` | renderer→main | 전송 시 | 선택한 브랜치가 조용히 무시되고 HEAD가 base가 된다 |
| EP-16 (NEW) | AR-03'·AR-08 / WP-05·WP-06·WP-16·WP-18 | cwd 소실 감지 — `prepareTurnExecution` 진입 1 + `respawnInputs` 축 1 **2곳** | `prepare-worktree.ts` | main | 매 send | 한쪽만 닫으면 죽은 cwd로 spawn하거나 죽은 채널을 재사용한다 |
| EP-17 (NEW) | R-26 / WP-07·WP-12·WP-15·WP-17 | 폴백 영속 — `sessions.cwd` UPDATE + managed row 삭제 + `session.updated` 방출 **3 쓰기** | `prepare-worktree.ts` | main | 폴백 시 | 다음 턴이 같은 실패를 반복하거나 화면이 죽은 경로를 계속 보여준다 |

- 같은 규칙이 여러 레이어에 있는가: 경로 파생은 `paths.ts`(루트)와 `naming.ts`(세그먼트)로 **역할이 다르다** — 루트 문자열을 `naming.ts`가 다시 만들지 않고 인자로 받는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: **없음**.
- 선택적 필드의 의미: `worktreeBaseRef?: string` — `undefined`는 "선택 없음 = 현재 HEAD"다. 빈 문자열은 schema가 거부한다(`min(1)`).
- 외부 SDK 경계: 없음. SDK에 넘기는 값은 여전히 `cwd: string` 하나이고 형태가 바뀌지 않는다.

### 타입 / API

```ts
// paths.ts — dev 분기를 인자로 받는다(순수). 호출자가 import.meta.env.DEV 를 넘긴다.
export function managedWorktreesDir(isDev: boolean): string   // ~/.config/orca/worktrees[-dev]

// naming.ts — 결정적 파생. randomUUID 를 쓰지 않는다.
export function repoDirSegment(repoRoot: string): string      // <basename>-<sha1(repoRoot).slice(0,8)>
export function branchDirSegment(branch: string): string      // 'work/foo' → 'work-foo'

// service.ts
prepare(input: {
  sourceCwd: string
  firstPrompt: string
  baseRef?: string            // 유예된 브랜치. 미지정이면 HEAD
  signal?: AbortSignal
  complete?: (prompt: string, signal: AbortSignal) => Promise<string>
}): Promise<PrepareWorktreeResult>   // 'dirty' reason 은 union 에서 제거된다

// prepare-worktree.ts — 결과에 복구 갈래가 추가된다
export type PrepareTurnWorktreeResult =
  | { kind: 'passthrough'; executionCwd: string }
  | { kind: 'managed'; worktreeId: string; executionCwd: string }
  | { kind: 'recovered'; executionCwd: string; lostWorktreeRoot: string }
  | { kind: 'rejected'; message: string }

// respawn-policy.ts — 6번째 축
export interface RespawnDecisionInput { /* …기존 5축… */ executionCwdMissing: boolean }
```

- `PrepareWorktreeResult`의 `reason: 'dirty'`를 **union에서 제거**한다(D-105). 타입을 남겨두면 그 분기가 죽은 코드로 남아 다음 독자가 정책을 오독한다.
- `recovered`는 `managed`와 별개 갈래다 — 호출자가 통지·영속을 해야 하는 유일한 갈래라 `passthrough`로 합치면 그 책임이 사라진다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/infra/config/paths.ts` | 루트 파생 | `managedWorktreesDir(isDev)` — `orcaConfigDir()` 하위 + dev suffix | 순수 단위 |
| `app/src/main/app/bootstrap.ts` | 배선 | `managedWorktreesDir(import.meta.env.DEV)` 주입 (`:835`) | 통합 |
| `app/src/main/features/worktrees/naming.ts` | 세그먼트 파생 | `repoDirSegment`·`branchDirSegment` 추가, 충돌 루프에 **디렉토리 부재** 조건 추가 | 순수 단위 |
| `app/src/main/features/worktrees/service.ts` | 생성 | `isClean` 거부 제거(:66-79) · `randomUUID` 경로 제거(:87-89) · `baseRef` 해석 | 통합(임시 repo) |
| `app/src/main/infra/git/repository.ts` | ref 해석 | `resolveRef(cwd, ref)` 추가 — 기존 `resolveHead`는 유지 | 순수+통합 |
| `app/src/main/app/chat-turn/prepare-worktree.ts` | 실행 cwd 확정 | resume 갈래 추가 — 존재 확인 → 폴백 → 영속·통지 | 순수 판정 분리 |
| `app/src/main/features/sessions/respawn-policy.ts` | 무효화 판정 | `executionCwdMissing` 축 | 순수 단위 |
| `app/src/main/app/chat-turn/respawn-inputs.ts` | 입력 조립 | 새 축을 싣는다 | 순수 단위 |
| `app/src/main/infra/db/queries.ts` | 영속 | `updateSessionCwd(sessionId, cwd)` 추가 | DB 통합 |
| `app/src/shared/protocol.ts` | wire | `worktreeBaseRef?: string` + `superRefine`(격리 ON·신규 전용) | 스키마 단위 |
| `app/src/renderer/.../chat/store/chatStore.ts` · `reducer/chatReducer.ts` | draft 상태 | `worktreeBaseRef` 액션·send payload(`:598` 인근) | reducer 단위 |
| `app/src/renderer/.../composer/BranchChip.tsx` | 유예 분기 | 격리 ON이면 checkout 대신 선택 통보 | 순수부 분리 |
| `app/src/renderer/.../chat/components/CwdPanel.tsx` | 배선·문구 | 격리 상태를 BranchChip에 전달 · 툴팁 문구 | 컴포넌트 단위 |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | 미커밋 변경 안내 키 | 키 존재 단언 |

### 알고리즘 — 생성 (변경분만)

1. `sourceCwd` realpath → `resolveRepoRoot` → repo 밖이면 거부. **(유지)**
2. ~~`isClean` 거부~~ **(제거 — D-105)**
3. `baseOid = baseRef ? resolveRef(sourceCwd, baseRef) : resolveHead(sourceCwd)` — **한 번만** 읽는다.
4. `chooseBranchName`이 브랜치 후보를 정할 때 **`branchExists(candidate) === false` 와 `<root>/<repoSeg>/<branchSeg(candidate)>` 디렉토리 부재를 함께** 요구한다 — 루프 하나가 두 유일성을 겸한다.
5. `worktreeRoot = resolve(rootDir, repoDirSegment(repoRoot), branchDirSegment(branch))`.
6. 이후 `addWorktree`·rollback·DB insert는 **그대로**.

### 알고리즘 — resume 복구 (신규)

1. `sessionId`가 있고 세션행 cwd가 있으면 그 경로를 `stat`한다.
2. 존재하면 `passthrough` — 기존과 동일(AC19).
3. 부재면 `getManagedWorktreeBySession(sessionId)`으로 `source_cwd`를 얻는다. 행이 없으면 폴백 대상이 없으므로 기존 오류 경로로 간다.
4. `source_cwd`도 부재면 `rejected`.
5. 존재하면 `updateSessionCwd` → `deleteManagedWorktree` → `session.updated{patch:{cwd}}` 방출 → `recovered` 반환.
6. `respawnInputs`가 `executionCwdMissing: true`를 실어 `decideRespawn`이 채널을 내린다.

### 테스트 가능성

- electron 의존 분리: `paths.ts`·`naming.ts`·`respawn-policy.ts`는 electron을 import하지 않는다 — 순수 vitest 대상. `bootstrap.ts` 배선은 통합에서만 본다.
- `prepare-worktree.ts`의 폴백 **판정**(경로 존재 여부 → 어느 갈래)은 `stat` 주입으로 순수하게 만든다. 기존 파일이 이미 의존 주입 형태다(`worktrees: Pick<WorktreeService,'prepare'>`).
- 순서 관측: 폴백 → teardown → spawn 순서는 `runtime-entry`에 이미 있는 호출 순서 로그 seam으로 본다(0209 VP-05가 쓴 deferred order log와 같은 방식).

## 12. End-to-end 영향

```text
CwdPanel(격리) → BranchChip(유예) → chatStore draft → SendChatMessageSchema
  → prepareTurnExecution → WorktreeService.prepare(baseRef) → addWorktree
  → TurnContext.cwd → TurnRequest.cwd → adapter query cwd
```

- producer 기준: 실행 cwd의 producer는 `prepareTurnExecution` 하나다. 폴백 후에도 같은 producer가 값을 낸다.
- consumer 파생 규칙: 렌더러는 `patch.cwd`만 보고 경로를 갱신한다 — worktree 존재 여부를 스스로 추론하지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `BranchChip`은 cwd로 `gitStatus`를 다시 조회하므로 폴백 후 브랜치·diff가 자동으로 원본을 따른다(`BranchChip.tsx:56-70`).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:835` `WorktreeService` 생성 | 인자 형태 변경(userData 경로 → dev 불리언) | AC3·AC4 |
| `orcaConfigDir()` 소비처 15곳 | **영향 없음** — 반환값 불변(D-103) | AC3 |
| 기존 `<userData>/worktrees` 행 | 영향 없음 — 절대경로 저장(D-110) | AC19 |
| `respawn-policy` 기존 5축 | 새 축은 OR 항 추가라 기존 판정이 유지된다 | AC14 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 변경 없음 — 준비 실패 시 rollback 순서(remove → deleteBranch → rm)는 그대로.
- 취소/중단: 폴백 중 `signal.aborted`면 DB를 쓰지 않고 반환한다 — 절반 쓰기를 만들지 않는다.
- 종료/quit/crash: 변경 없음. worktree는 앱 종료로 지워지지 않는다(0209 R-13).
- retry/timeout/partial failure: 폴백은 재시도하지 않는다 — 다음 send가 같은 판정을 다시 한다(멱등).
- **다중 저장소 쓰기**: 폴백은 **3곳**에 쓴다.

| 쓰기 지점 | 실패/크래시 시 관측 상태 | 처리 |
|---|---|---|
| ① `sessions.cwd` UPDATE | 실패하면 세션행이 죽은 경로 유지 | 이번 턴은 진행하지 않고 오류 반환 — 다음 send가 같은 폴백을 다시 시도(멱등) |
| ② managed row 삭제 | ① 성공·② 실패면 stale metadata만 남는다 | 무해 — 다음 폴백 시도에서 `stat` 부재로 같은 경로를 다시 지운다 |
| ③ `session.updated` 방출 | ①② 성공·③ 실패면 DB와 화면이 갈린다 | 다음 턴의 `session.updated` 또는 세션 재진입이 화면을 맞춘다 |

①→②→③ 순서가 계약이다. ③을 먼저 보내면 화면이 앞서고 DB가 뒤처져 재시작에서 되돌아간다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 해당 없음 — 새 모델 출력이 없다.
- 새 요청 수: resume 턴마다 `stat` 1회(로컬 파일시스템). base ref 해석은 격리 신규 턴에서 `rev-parse` 1회 — 기존 `resolveHead` 1회를 대체하므로 증가 0.
- 구조적 목표: 없음.
- 캐시/호출 축소로 잃는 부수 효과: 없음 — 캐시를 도입하지 않는다. `stat` 결과를 캐시하면 외부 삭제를 못 보므로 **캐시하지 않는 것이 계약**이다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부/배포가 구현하는 port·schema·config를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| dirty source 거부 | 0209 R-08 / `service.ts:73` | §7 AC1 · §11 "제거 — D-105" | **변경** (D-105, 사용자 결정) |
| repository 밖 UUID 경로 | 0209 R-10 / `service.ts:87-89` | §10 EP-09 · §11 알고리즘 5 | **변경** (D-102·D-104, 사용자 결정) |
| resume은 세션행 cwd | 0209 R-13 / `turn-context.ts:63` | §11 resume 복구 1~5 | **변경** (D-107 — 존재할 때는 동일, 부재 시에만 폴백) |
| 격리는 신규 일반 세션 전용 | 0209 R-07 / `protocol.ts:111-117` | §10 EP-15 `superRefine` | **유지** — `worktreeBaseRef`도 같은 refine에 붙는다 |
| 안전 삭제(clean + HEAD==base) | 0209 R-15 / `service.ts:151-176` | §10 EP-11 "유지" | **유지** |
| external worktree 불간섭 | 0209 R-16 | 비범위 | **유지** |
| main에서 Node 전역 `fetch` 금지 | `app/src/main/AGENTS.md` | 해당 없음 — 원격 요청 없음 | **유지** |
| feature 교차 import 금지 | `app/src/main/AGENTS.md` | §11 — `prepare-worktree.ts`(app 레이어)가 `worktrees`·`sessions`를 조합 | **유지** — 컴포지션 루트라 허용된다 |
| 렌더러 feature 교차 import 금지 | `app/src/renderer/AGENTS.md` | §11 — `BranchChip`은 같은 `chat` feature 내부다 | **유지** |
| 마이그레이션 append-only | `app/AGENTS.md` | 해당 없음 — 스키마 변경 없음(D-110) | **유지** |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| dirty 거부 해제로 사용자가 "내 변경이 왜 없지"를 겪는다 | D-106 — 칩 툴팁이 미커밋 변경 미포함을 명시(AC18) |
| Windows에서 프로세스 CWD인 디렉토리는 삭제되지 않아 폴백 경로가 실기로 재현되기 어렵다 | 폴백 판정은 `stat` 주입으로 순수 테스트한다(§11) — 실기 의존 0 |
| `repoDirSegment` 해시가 Windows 대소문자 차이로 갈라진다 | 입력은 `canonicalPath`(realpath) 결과 하나로 고정한다 — 같은 repoRoot는 같은 문자열이다(AC5가 이 결정성을 단언) |
| 기존 userData worktree가 새 규칙과 섞인다 | D-110 — 절대경로 저장이라 공존한다. 이설은 비범위 |
| 브랜치 slug 디렉토리가 삭제 잔여물과 충돌 | 브랜치 유일성 루프에 디렉토리 부재 조건을 넣는다(§11 알고리즘 4) |

- 되돌리기 어려운 결정: worktree 디렉토리 스키마(D-104) — §6에서 "지금 확정"으로 올려 닫았다.
- 신규 의존성: **없음**. `node:crypto`는 이미 `service.ts:1`이 쓴다.

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/config/paths.ts` · `app/src/main/app/bootstrap.ts`
- `app/src/main/features/worktrees/{naming,service}.ts` · `app/src/main/infra/git/repository.ts`
- `app/src/main/app/chat-turn/{prepare-worktree,respawn-inputs}.ts` · `app/src/main/features/sessions/respawn-policy.ts`
- `app/src/main/infra/db/queries.ts` · `app/src/shared/protocol.ts`
- `app/src/renderer/src/features/chat/{store/chatStore.ts,reducer/chatReducer.ts,components/CwdPanel.tsx,components/composer/BranchChip.tsx}`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/handoff/INDEX.md` · (해당 시) `docs/IPC_CONTRACT.md` — `worktreeBaseRef` 필드 추가

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: egress 차단 환경에서는 DB 로드 스위트만 red다 — 변경 무관으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck` (ABI 중립).
- 관련 테스트: `./node_modules/.bin/vitest run src/main/features/worktrees src/main/app/chat-turn src/main/infra/config src/main/features/sessions src/renderer/src/features/chat` · DB 축(AC15·16)은 `npm test`.
- 사람 실기: **없음**.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-101~D-110 ACTIVE 10, OPEN 0. 0209 R-08·R-10을 SUPERSEDED로 명시.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §1 한 문장 + §5 흐름 2종.
- [x] 조건절·이유절을 재해석하지 않았다 — "dev의 경우에만"은 worktrees 디렉토리로 한정(D-103), config 루트로 확대하지 않았다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 전이표 7행이 AC1·5·7·8·12·14·19에 각각 대응.
- [x] Technical Design에 AS-IS/TO-BE가 모두 있고 같은 축이다 — §9 Delta 7행.
- [x] Delta의 각 변경이 구현 파일 또는 AC에 추적 가능하다 — §9 Delta의 `V / 구현·검증 연결` 칸.
- [x] AS-IS에서 사라진 책임의 처리 명시 — `isClean` 준비 거부는 **삭제**, `randomUUID` 경로는 **대체**(§9 TO-BE).
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 6행 + 검산.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 21행 전건.
- [x] Delta V를 썼고 유효 V를 재구성할 수 있다 — `0209 V1 + ΔV1`.
- [x] 변경 효과에 필요한 레벨을 선택했고 NEW/CHANGED node에 같은 레벨 REQUIRED pair가 있다 — R 9·SD 2·AR 4·MD 3 = 18 node, REQUIRED pair 16.
- [x] 영향받은 INHERITED node는 REGRESSION(WP-09·10·11·14·15), 비영향만 NOT_REQUIRED(§7-A 하단 4건, 근거 기재).
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거는 선택 이유와 함께 등록됐다 — 적대 증거 선택 10 pair, `not selected + 직접 oracle 근거` 11 pair = 21.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다 — §7-A gate 표 4행. 무관한 기존 실패(ABI)는 blocking에서 분리.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 사람 실기 0건(§7 주의사항).
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC7의 0건 단언은 AC8 양성과 쌍(§7 주의사항).
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 EP 8행, 합 17지점.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 4행, `orcaConfigDir()` 15곳 무영향 확인.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12 producer 1개, consumer가 존재를 추론하지 않음.
- [x] 상한·one-way door를 계산했다 — 요청 증가 0(§14), one-way door는 경로 스키마 1건(§6).
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다 — lint+typecheck 기본, `npm test`는 DB 축만.
- [x] 본문 완성 후 Decision Ledger와 교차검증했고 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙 — 판정 먼저, 주장 한 줄에 관측 하나.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 라운드도 같은 이름의 필드를 다시 채운다** — 라운드 표제(`… (r2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I·II 전건. 유예·경로·폴백 셋이 서로 다른 파일이라 순서 충돌이 없었다.
- 이견 / 현실성 문제: **없음**. 다만 §11 이 지정한 "`prepare-worktree.ts` 가 실행 cwd 의 단일 producer" 를 성립시키려면 `send.ts` 가 resume 준비 입력을 세션행에서 먼저 뽑아야 했다 — `payload.cwd` 를 그대로 넘기면 존재 확인이 엉뚱한 경로를 본다(선조치 #1).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| WP-08·WP-19 | EP-01 격리 상태 renderer 소비 | CwdPanel 배선 · BranchChip 분기 (2) | 2/2 | `CwdPanel.tsx:50-51`(deferTo·deferred) · `BranchChip.tsx:102`(유예 분기) | — |
| WP-02·WP-20 | EP-09 worktree 루트 파생 | 정의 · 부팅 호출 (2) | 2/2 | `rg 'managedWorktreesDir' src` 비테스트 → `paths.ts:47` · `bootstrap.ts:836` (2건) | — |
| WP-01·WP-21 | EP-11 `isClean` 소비처 | 준비(제거) · 삭제 증명(유지) (2) | 2/2 | `rg 'isClean\(' src/main` 비테스트 → `service.ts:201` 1건(삭제 증명만). 준비 경로 0건 = 제거 완료 | — |
| WP-02 | EP-13 dev 분기 주입 | 부팅 1 | 1/1 | `bootstrap.ts:836` `managedWorktreesDir(import.meta.env.DEV)` | — |
| WP-03·WP-19 | EP-14 작업 트리를 바꾸는 브랜치 진입 | onPick · dirty onConfirm (2) | 2/2 | `BranchChip.tsx:158`·`:188` — 둘 다 `checkout()` 한 곳으로 들어오고 그 입구가 `deferTo` 로 막힌다 | — |
| WP-04·WP-13 | EP-15 base ref 좌표 | payload · schema · service (3) | 3/3 | `chatStore.ts:600` · `protocol.ts:113`(+`:137` refine) · `service.ts:94` | — |
| WP-05·WP-06·WP-16·WP-18 | EP-16 소실 감지 + respawn 축 | 진입 판정 · respawn 축 (2) | 2/2 | `prepare-worktree.ts:34` · `respawn-inputs.ts:63` → `respawn-policy.ts:32` | — |
| WP-07·WP-12·WP-17 | EP-17 폴백 3쓰기 | sessions.cwd · row 삭제 · 통지 (3) | 3/3 | `service.ts:193`·`:194` · `send.ts:167`(`session.updated{patch.cwd}`) | — |

- 전수 합: **17/17** (2+2+2+1+2+3+2+3). 차집합 검산 — §10 이 적은 17지점과 위 관측 17좌표의 차집합 **0**.
- §10에 없는데 같은 불변식이 필요했던 지점: 없음.

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| WP-01 | REQUIRED | SELF_PASS | `service.test.ts` "tracked·untracked 변경이 있어도…" — 준비 전후 porcelain 동일 | not selected — 직접 행동(생성 성공·트리 불변) |
| WP-02 | REQUIRED | SELF_PASS | `paths.test.ts` 3케이스 + `service.test.ts` 세그먼트 | M1 RED · M12 RED |
| WP-03 | REQUIRED | SELF_PASS | `BranchChip.defer.test.ts` checkout 0회/1회 양방향 | M2 RED |
| WP-04 | REQUIRED | SELF_PASS | `service.test.ts` worktree HEAD == feature OID | M9 RED · M11 RED |
| WP-05 | REQUIRED | SELF_PASS | `prepare-worktree.test.ts` recovered 갈래·통지·판정 입력 | M6 RED |
| WP-06 | REQUIRED | SELF_PASS | `respawn-policy.test.ts` 양방향 | M4 RED |
| WP-07 | REQUIRED | **SELF_BLOCKED** | `worktree-recover.test.ts` 4케이스 작성, **환경 ABI 로 미실행** | 미측정 — 아래 잠금 표 참조 |
| WP-08 | REQUIRED | SELF_PASS | `CwdPanel.isolation.test.ts` title 키 + ko/en 리소스 문구 | not selected — 문구 존재가 직접 결과 |
| WP-09 | REGRESSION | SELF_PASS | `prepare-worktree.test.ts` passthrough 케이스 green | not selected |
| WP-10 | REGRESSION | SELF_PASS | `reject-reasons.test.ts` "거부한 뒤에도 다음 준비는 성공한다" green | not selected |
| WP-11 | REGRESSION | SELF_PASS | `safe-delete.test.ts` 전건 green | M8 RED |
| WP-12 | REQUIRED | **SELF_BLOCKED** | 폴백→teardown→spawn 순서의 종단 관측 없음 — 축 전달까지만 잠갔다 | 미측정 |
| WP-13 | REQUIRED | SELF_PASS | `service.test.ts` 종단 OID 일치 | M9 RED |
| WP-14 | REGRESSION | SELF_PASS | `prepare-worktree.test.ts` deferred order 케이스 green | not selected |
| WP-15 | REGRESSION | **SELF_BLOCKED** | `worktree-bind.test.ts` 미실행(ABI) | 미측정 |
| WP-16 | REQUIRED | SELF_PASS | `send.worktree.test.ts` 8케이스 + `prepare-worktree.test.ts` | M6 RED |
| WP-17 | REQUIRED | **SELF_BLOCKED** | `worktree-recover.test.ts` 미실행(ABI) | 미측정 |
| WP-18 | REQUIRED | SELF_PASS | `respawn-inputs.test.ts` 양방향 | M5 RED |
| WP-19 | REQUIRED | SELF_PASS | `CwdPanel.isolation.test.ts` deferTo 유무 양방향 | M3 RED |
| WP-20 | REQUIRED | SELF_PASS | `service.test.ts` 결정성·형제 칸 | M1 RED · M10 RED |
| WP-21 | REQUIRED | SELF_PASS | `service.test.ts`(준비 비소비) + `safe-delete.test.ts`(삭제 소비) | M7 RED · M8 RED |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `naming.ts:21` — 해시 입력을 `Math.random()` 으로 바꿔 비결정 복원 | `WP-02·WP-20 선택 증거` | 최초 | `managed 경로는 <repo>-<hash8>/<브랜치> 2단…` 1건 | 잠김 |
| `BranchChip.tsx:102-106` — 유예 분기 삭제 | `WP-03 선택 증거` | 최초 | `격리 ON: 선택이 checkout 을 부르지 않고…` 1건 | 잠김 |
| `CwdPanel.tsx:50` — `deferTo` 를 항상 `undefined` 로 | `WP-19 선택 증거` | 최초 | `격리 ON 이면 브랜치 칩이 유예 콜백을 받는다…` 1건 | 잠김 |
| `respawn-policy.ts:32` — 폴백 항 삭제 | `WP-06 선택 증거` | 최초 | `respawns for a changed execution cwd recovery` 1건 | 잠김 |
| `respawn-inputs.ts:63` — 축을 상수 `false` 로 | `WP-18 새 oracle 민감도` | 최초 | `입력의 폴백 여부를 그대로 싣는다 — 양방향` 1건 | 잠김 |
| `prepare-worktree.ts:41` — `recovered` 갈래를 passthrough 로 접음 | `WP-05·WP-16 선택 증거` | 최초 | `worktree 가 사라지면…` · `폴백 여부를 runtime 확보에…` 2건 | 잠김 |
| `service.ts:90` — dirty 거부 복원(D-105 역행) | `WP-01·WP-21 선택 증거` | 최초 | `tracked·untracked 변경이 있어도…` 1건 | 잠김 |
| `service.ts:203` — 삭제 안전 증명이 dirty 무시 | `WP-21 형제 변이` | 최초 | `safe-delete` 1건 | 잠김 |
| `service.ts:94` — 유예 base 무시하고 HEAD 사용 | `WP-04·WP-13 선택 증거` | 최초 | `유예된 기준 브랜치의…` · `없는 기준 브랜치는 거부한다` 2건 | 잠김 |
| `service.ts:118` — repo 칸과 브랜치 칸을 맞바꿈 | `WP-20 형제 슬롯 변이` | 최초 | `managed 경로는 …2단…` 1건 | 잠김 |
| `protocol.ts:137` — 격리 없는 base ref 를 통과 | `WP-04 형제 변이` | 최초 | `격리 없이 온 브랜치는 거부한다…` 1건 | 잠김 |
| `paths.ts:48` — dev 분기 제거 | `WP-02 선택 증거` | 최초 | `dev 만 -dev 로 갈라진다` 1건 | 잠김 |

- **분모 검산**: `선택 증거 9 · 인용 변이 0 · 새 oracle 3 = 표 행 12`. 새 oracle 3 은 `respawn-inputs.test.ts` · `BranchChip.defer.test.ts` · `worktree-recover.test.ts` 이고, 앞 둘은 각각 M5·M2 로 민감도를 확인했으며 형제 슬롯 변이 2건(M8·M10)이 같은 표에 있다. **`worktree-recover.test.ts` 는 ABI 로 실행되지 않아 민감도를 측정하지 못했다** — 그래서 WP-07·WP-17 을 `SELF_PASS` 로 올리지 않았다.
- **덮개 회귀**: 이전 라운드에 red 였는데 이번에 green 인 행 **0건**. 0209 가 red 로 잡던 두 계약(dirty 거부 · UUID 세그먼트)은 사용자 결정(D-105·D-104)으로 SUPERSEDED 되어 **같은 파일 같은 자리에 새 단언을 세웠고**, 그 단언들이 역방향 변이(M7·M10)에 red 다 — 자리를 잃지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ 툴팁(`CwdPanel.tsx:60`) · 유예 라벨(`BranchChip.tsx:139`) · 거부 문구 2종(`service.ts:88`·`:102`) · 폴백 불가 문구(`prepare-worktree.ts:44`) 모두 화면 경로가 있다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | ✅ `acquireRuntime` 콜백에 인자 하나만 늘렸다 — `leaderTurn`·`leaderRuntime` 대입 위치 불변(0209 r6 회귀 축) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ⚠️ **표에 없음 1건** — "resume + worktree 소실 + **원본도 소실**" 은 §5 표에 행이 없다. `rejected` 로 접었다 | 파생 이슈 후보 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ✅ 폴백은 `session.updated` 로 경로가 눈에 띄게 바뀌고, 폴백 불가는 오류 이벤트다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ 유예는 IPC 를 부르지 않아 늦은 응답 자체가 없다. `BranchChip` 의 기존 cwd-태그 스냅샷 규칙은 그대로 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | resume 준비 입력이 `payload.cwd` 라 세션이 잠근 실행 경로를 보지 않는다 — 그대로면 소실 판정이 엉뚱한 경로를 본다 | ✅ 선조치 — `send.ts:145` 에서 `resolveTurnCwd` 로 먼저 확정하고, `buildTurnContext` 에 넘기는 `sessionMeta.cwd` 를 확정값으로 덮었다 | `turn-context.ts:63` 이 resume 에서 세션행을 우선한다 |
| 2 | `git-unavailable` 이유가 producer 를 잃었다 — `isClean` 게이트가 유일한 발생원이었다 | ✅ 선조치 — `gitAvailable()` 을 추가해 `resolveRepoRoot` 의 `null` 두 원인을 가른다 | `repository.ts:9-14`(두 원인이 같은 `null`) · `reject-reasons.test.ts` 2케이스 |
| 3 | `PrepareWorktreeResult` 의 `dirty` 를 타입에 남기면 죽은 분기가 정책을 오독시킨다 | ✅ 선조치 — union 에서 제거(D-105 와 같은 이유) | `service.ts:17-26` |
| 4 | 브랜치 slug 디렉토리가 삭제 잔여물과 충돌하면 `worktree add` 가 실패한다 | ✅ 선조치 — `chooseBranchName` 충돌 루프에 `dirTaken` 조건을 더해 한 루프가 두 유일성을 겸한다 | `naming.ts:41`·`service.ts:113` |
| 5 | `GitBranchNameSchema` 가 send 스키마보다 **뒤에** 선언돼 있어 재사용 시 TDZ 로 죽는다 | ✅ 선조치 — 선언을 위로 옮기고 이유를 주석에 남겼다 | `protocol.ts:63-73` |
| 6 | 폴백 3쓰기 중 ③(통지)만 실패하면 DB 와 화면이 갈린다 | ⚠️ 보고만 — plan §13 이 "다음 턴·재진입이 맞춘다"로 이미 판정했고 그대로 구현했다 | `send.ts:167` |
| 7 | 작업 트리에 사용자 잔여물 `app/a.txt`·`app/src/main/a.ts`(UTF-16) 가 있어 **lint·typecheck 가 각 1 error** 를 낸다 | ⚠️ 보고만 — 내 변경이 아니고 삭제는 사용자 결정이다 | `git status` `??` 2건 · `tsc` `src/main/a.ts(1,1) TS2304` · eslint `Parsing error: File appears to be binary` |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **1건** — §11 은 `repository.ts` 에 `resolveRef(cwd, ref)` 를 적었으나 `resolveBranchOid(cwd, branch)` 로 좁혔다. 사용자가 고른 값이 그대로 첫 인자가 되면 `-` 로 시작하는 이름이 git 옵션으로 읽히므로 `refs/heads/` 접두사를 붙여 넘긴다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 두 형태 모두 호출 시점에 1회 읽고 캐시하지 않는다 | AC11 — `service.ts:94` 단일 읽기 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 반환값은 지역 `baseOid` 뿐이고 공유 저장소에 두지 않는다 | EP-15 3좌표 재검색 |
| 재진입 | 해당 없음 — 순수 조회이고 같은 인자로 여러 번 불러도 같은 값 | AC10 두 케이스 green |
| 다른 무효화 축 | **있음** — 범위가 로컬 브랜치로 좁아져 tag·remote-tracking·raw OID 를 base 로 줄 수 없다 | AC9 가 `GitBranchNameSchema` 로 입력을 이미 브랜치 이름으로 좁혔고 브랜치 칩도 로컬 브랜치만 제시한다(`git-cli.ts:86-89`) — 도달 가능한 입력 집합이 줄지 않는다 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 프로덕션 19 · 테스트 8(신규 3). main: `paths.ts`·`bootstrap.ts`·`naming.ts`·`service.ts`·`repository.ts`·`prepare-worktree.ts`·`respawn-inputs.ts`·`respawn-policy.ts`·`runtime-entry.ts`·`send.ts`·`chat-turn-continuation.ts`·`queries.ts`. shared: `protocol.ts`. renderer: `chatReducer.ts`·`chatStore.ts`·`CwdPanel.tsx`·`BranchChip.tsx`·`ko.ts`·`en.ts` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npm test` · `node node_modules/vitest/vitest.mjs run <suite>`(변이 12회) |
| **관측한 게이트 산출**(exit code 아님) | **lint** 1 error + 1 warning — 둘 다 변경 무관(error = `src/main/a.ts` 사용자 잔여물 binary parse, warning = 기존분). **typecheck** 1 error — `src/main/a.ts(1,1) TS2304`, 같은 잔여물. **npm test** 273파일 2678케이스 중 **8파일 57케이스 red**, 전부 단일 서명 `better_sqlite3.node … NODE_MODULE_VERSION 140 vs 127`(오류 인스턴스 12, 단언 실패 **0**). `npm rebuild better-sqlite3` 는 node-gyp 실패로 이 환경에서 Node ABI 복구 불가 |
| V-pair 자기확인 | `SELF_PASS 17 / SELF_BLOCKED 4`(WP-07·WP-12·WP-15·WP-17); pair별 상세는 위 표 |
| 강제 지점 전수 | **17/17** (차집합 0) |
| **AC 자기보고**(`Criteria-Met`) | 18/21 — ✅ AC1·2(porcelain 전후 동일) · AC3·4(`paths.test` 3케이스) · AC5·6(세그먼트 결정성·브랜치 파생) · AC7·8(checkout 0회/1회) · AC9(schema 3케이스) · AC10(worktree HEAD == feature OID) · AC12·13(recovered 갈래·ready 반환) · AC14(policy·inputs·전달 3층 양방향) · AC17(onRecovered + reducer patch.cwd) · AC18(title 키 + ko/en 문구) · AC19(passthrough green) · AC20(후속 send 성공) · AC21(safe-delete 전건). ⚠️ **AC11** — base 를 "한 번만" 읽는 축을 baseRef 경로에서 재모사하지 않았다(0209 AT-09 의 HEAD 이동 모사가 HEAD 경로만 덮는다). ⚠️ **AC15·16** — oracle 작성 완료, ABI 로 미실행 |
| **합계 검산** | `✅ 18 · ⚠️ 3 · ❌ 0 = 총 21` — 분모는 plan §7 의 21행을 다시 세어 확인했다(AC1~AC21, 이번 라운드 분할·추가 없음) |
| 블로커 / 역질문 | 없음. AC15·16 은 CI(windows-latest, egress 열림)에서 판정된다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — r1 이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음.
- 반복해서 부딪히는 환경 한계: **better-sqlite3 ABI**. `pretest` 의 Node ABI 복구가 node-gyp 실패로 동작하지 않아 DB 로드 8파일을 이 환경에서 판정할 수 없다(0208·0209 와 같은 축).
- 현재 라운드 수: 1

---

---

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: r1 그대로. 규범 행 변경 없음.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r2)

r2가 닫은 것은 §10 행이 아니라 **현재 산출물의 필수 gate**(`typecheck:test`)다. r1의 17지점은 그대로다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| WP-06·WP-18 | `RespawnDecisionInput` 조립 | EP-16 respawn 축 (1) | 1/1 | `rg 'decideRespawn\(\{' src` → 3건 · `rg 'respawnInputs\(\{' src` → 4건. 조립 지점 전수 **5**(팩토리 1 + 팩토리 호출 2 + 테스트 리터럴 2), 새 축 누락 **0** | — |

- **불변식**: "`RespawnDecisionInput` 을 조립하는 모든 지점이 새 축을 싣는다." r1은 이 술어를 **해법 이름**(`respawnInputs`)으로 세어 팩토리를 우회하는 테스트 리터럴 2건이 분모에 오르지 않았다.
- §10에 없는데 같은 불변식이 필요했던 지점: **1건** — `session-runtime.test.ts:1252`. 현재 pair(WP-06·WP-18)의 gate 위반이므로 `PLAN_GAP`이 아니라 구현 결함이다.

**V-pair 자기확인 (r2)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| WP-06 | REQUIRED | SELF_PASS | `respawn-policy.test.ts` 양방향 green | r1의 M4 RED 유지(장치 불변) |
| WP-18 | REQUIRED | SELF_PASS | `respawn-inputs.test.ts` 양방향 green | r1의 M5 RED 유지(장치 불변) |
| 그 밖 19 pair | — | r1 상태 유지 | 이번 변경은 테스트 리터럴 1줄이라 다른 pair의 경로에 닿지 않는다 | 재실행 없음 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 — 직접 oracle | `typecheck:test` 가 이번 수정의 oracle이고, 그 자신이 결함을 낸 장치다 | r1 red(CI) | `session-runtime.test.ts(1252,21) TS2345` → 수정 후 0건 | 잠김 |

- **분모 검산**: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 = 표 행 1`(직접 oracle 행). 이번 라운드는 새 장치를 만들지 않았고 기존 pair의 증거를 바꾸지 않았다.
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 **0건**. r1이 심은 12변이의 장치를 하나도 건드리지 않았다(변경은 테스트 리터럴 1줄).

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 이번 변경은 테스트 리터럴 1줄이다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 — 새 실패 경로 0 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **r1의 게이트 관측이 무효였다** — `typecheck`는 `typecheck:node && :web && :test` 체인이라 `a.ts`가 첫 구성에서 낸 error가 체인을 끊어 `typecheck:test`가 **실행되지 않았다**. r1 보고의 "typecheck 1 error"는 세 구성 중 하나만 잰 값이다 | ✅ 선조치 — 세 구성을 **각각** 실행해 관측한다 | `package.json:13` 체인 정의 · 각각 실행 결과 node 1(a.ts) · web 0 · test 1(a.ts) |
| 2 | 사용자 잔여물 `app/src/main/a.ts`가 로컬 게이트를 계속 가린다 — CI에는 없어 CI만 진실을 본다 | ⚠️ 보고만 — 삭제는 사용자 결정이다. 남아 있는 한 로컬 `npm run typecheck`는 `:web`·`:test`를 건너뛴다 | r1 보고 #7과 같은 잔여물, 이제 **마스킹 효과**가 실증됐다 |

### 설계 대비 명시적 차이 (r2)

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체물 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체물 없음 | — |
| 재진입 | 해당 없음 — 대체물 없음 | — |
| 다른 무효화 축 | 해당 없음 — 대체물 없음 | — |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 1 — `src/main/features/sessions/session-runtime.test.ts` (리터럴에 `executionCwdRecovered: false` 추가) |
| 실행 명령 | `npm run typecheck:node` · `npm run typecheck:web` · `npm run typecheck:test` (**각각**) · `node node_modules/vitest/vitest.mjs run <3 suites>` |
| **관측한 게이트 산출**(exit code 아님) | **typecheck:node** 1 error(`a.ts` 잔여물) · **typecheck:web** **0 error** · **typecheck:test** 1 error(`a.ts` 잔여물) — CI가 보고한 `TS2345` 는 **0건**. vitest 3파일 **57케이스 green** |
| V-pair 자기확인 | `SELF_PASS 17 / SELF_BLOCKED 4` — r1과 동일(이번 변경이 pair 경로에 닿지 않음) |
| 강제 지점 전수 | **17/17** (r1 유지) + 이번 불변식 조립 지점 **5/5** |
| **AC 자기보고**(`Criteria-Met`) | 18/21 — r1과 같다. 이번 수정은 테스트 리터럴이라 AC 판정을 바꾸지 않는다 |
| **합계 검산** | `✅ 18 · ⚠️ 3 · ❌ 0 = 총 21` — 분모 21 재확인(분할·추가 없음) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **예** — WP-18의 `RespawnDecisionInput` 조립 축이다. r1이 그 축의 분모를 **해법 이름**(`respawnInputs`)으로 세어 팩토리를 우회하는 리터럴 2건이 빠졌다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: `handoff-impl` §2("검색의 술어는 불변식의 주어로 쓴다 — 해법의 이름이 아니다")가 정확히 이 축이다. 지침은 있었고 지켜지지 않았다. 두 번째 축은 §7("게이트 결과는 exit code가 아니라 관측한 산출로 적는다")로, `&&` 체인이 뒤 구성을 건너뛴 것을 관측으로 잡지 못했다.
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI(r1과 동일) + **작업 트리 잔여물이 로컬 게이트 체인을 끊는다**.
- 현재 라운드 수: 2

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 폴백 통지 방출(`send.ts:163`)을 아무 테스트도 보지 않는다 — 지워도 chat-turn 85케이스 green | EP-17 ③ · AC17 · WP-07 | `send.worktree.test.ts` 의 `sendChatEvent` spy 로 recovered 턴의 payload 단언 | BLOCKING | open (r2) |
| D2 | resume 준비 입력(`send.ts:145`)과 `sessionMeta.cwd` 덮어쓰기(`:197`) 둘 다 지워도 green | EP-16 ① · AC12 · WP-16 | `sessionMeta.cwd ≠ payload.cwd` 하네스에서 recover 인자와 최종 `turn.cwd` 단언 | BLOCKING | open (r2) |
| D3 | `runtime-entry.ts:88` 축 전달과 `:92` `teardownChannel()` 둘 다 지워도 src/main 1793케이스 green | AC14 · WP-12 등록 적대 증거 | fake runtime 으로 `executionCwdRecovered:true` 에서 teardown 1회 관측 | BLOCKING | open (r2) |
| D4 | `chatStore.ts:600` payload 필드를 지워도 renderer chat 524케이스 green | EP-15 ① · AC9 · WP-04·WP-19 | `chatStore.worktreeIsolation.test.ts` 방식으로 payload 필드 단언 | BLOCKING | open (r2) |
| D5 | `docs/IPC_CONTRACT.md:41` 이 `worktreeBaseRef` 를 빠뜨리고 "clean source HEAD" 문장을 유지 | 채널 계약 SSOT gate · plan §18 | §2.1 행의 필드 목록과 설명 문장을 D-101·D-105 에 맞춰 갱신 | BLOCKING | open (r2) |
| D6 | `scripts/ensure-sqlite-abi.mjs` CLI 가드가 Windows 에서 항상 거짓 — `pretest`·`predev`·`prebuild` 무동작 | 비귀속 (0210 밖) | 새 handoff 후보. `npm rebuild better-sqlite3` 로 우회 가능 | NEXT_HANDOFF | open (r2) |
| D7 | `teardownChannel()` 삭제가 respawn 여섯 축 전부에서 무음 — `runtime-entry` 테스트 파일 부재 | 비귀속 (기존 5축) | 기록 | NON_BLOCKING | open (r2) |
| D8 | AC11 "base 를 한 번만" 축을 baseRef 갈래에서 재모사하지 않았다 | AC11 · WP-04 | 기록 — 코드가 단일 표현식이라 구조적으로는 1회 | NON_BLOCKING | open (r2) |
| D9 | doc gate 가 `docs/handoff/<NNNN-slug>/` 링크를 검사하지 않는다(의도된 제외) | 비귀속 | 기록 — 그 exit 0 을 handoff 링크의 증거로 읽지 않는다 | NON_BLOCKING | open (r2) |

> 판정 원문과 재현 명령은 [`verify.md`](verify.md) §Verify r2.
