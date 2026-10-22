# 0278 정책 검증 — FAIL

| 항목 | 값 |
|---|---|
| 검증자 / 일자 | Codex / 2026-10-22 |
| 대상 | `1ff91429..6bf1ee40` — 정책 구현 및 CI fixture 보완 |
| 구현 전 기준 | `1ff91429`, plan V1 확정 AC·Baseline V1·§10 |
| 라운드 | r1.2 검증 → r2 구현 |
| 자기검증 여부 | 구현과 같은 에이전트. 구현 보고를 증거로 삼지 않고 별도 반례·설치 SDK 실험 수행 |

**현재 작업경로별 MCP 격리가 Claude에서 성립하지 않는다.** A가 Git 루트이고 B가 그 하위 경로이면 A의 MCP off가 B에도 적용된다. CI 보완 완료 여부와 별개인 정책 결함이다.

## 기준선과 범위

`git diff 1ff91429..6bf1ee40 -- docs/handoff/0278-harness-extension-isolation/plan.md`에서 구현 보고 추가만 확인했다. V1의 Decision·AC·pair를 구현에 맞게 완화한 변경은 없다. 앞부분 초안보다 V1 확정 표가 우선한다.

| 기준 | 결과 |
|---|---|
| V1 Baseline, REQUIRED VP1–VP6·REGRESSION VP7 | 식별 가능. VP7의 0279 프로젝트 격리 회귀에서 실패 |
| D15 / AC5 | native plugin flags·skill 목록·OpenCode MCP 선택은 directory 수명에 고정됨 |
| D16 / AC7 / 0279 AC2 | 현재 cwd가 다른 프로젝트의 MCP 상태와 분리되어야 함. 실제 SDK 저장 범위 및 동기화 reader가 이를 위반 |
| D22–D25 / AC1–4 | native 기본값 사본 없이 명시 선택만 보관, capability에 따른 가변/고정 토글 확인 |
| D12 / 0281 | 팝업 안내·수동 새로고침 추가 없음, 재진입 목록 캐시 검증 유지 |

## F1 — Claude Git 루트 MCP 상태가 하위 작업폴더로 전파됨

**BLOCKING / VP7 PAIR_FAIL.** 사용자 요구는 현재 경로 단위인데 native MCP 저장 키와 Orca 공유 키의 범위가 다르다.

1. 임시 Git 저장소 A와 하위 작업폴더 B를 만든다. 각 폴더에 같은 이름 `fixture`의 MCP를 선언한다.
2. 격리한 SDK Query A의 MCP가 connected임을 확인하고 `toggleMcpServer('fixture', false)`를 호출한다.
3. SDK가 별도 config의 `.claude.json`에 `projects[A].disabledMcpServers`를 기록한다.
4. 새 Query B도 **disabled**로 시작한다. B의 설정 파일은 편집하지 않았다.
5. 기존 B에 대해서도 실제 `readClaudeProjectSettings(B)`와 `ClaudeProjectReconciliation`을 실행하면 A의 변경으로 B의 revision이 달라지고 `set('docs', false, 'mcp', false, guard)`를 호출한다.

관측 경로: 우측 패널 → session resource handler → `claude/native-resources.ts:toggleMcpServer` → SDK의 Git-root 영속 상태 → `project-settings.ts`의 Git-root entry + cwd entry 병합 → B watcher/reconcile. `native-resource-sharing.ts`의 cwd별 peer 필터만으로는 파일 경유 전파를 차단하지 못한다.

실제 SDK 관측 결과:

```json
{"initialA":"connected","afterA":"disabled","disabledSavedAt":["A Git root"],"firstB":"disabled"}
```

외부 API·사용자 설정은 사용하지 않았다. SDK prompt는 입력 대기 상태이며 API URL은 localhost 폐쇄 포트, MCP는 로컬 stdio fixture다. 설치 SDK와 native CLI로 재현했고, 실제 사용자 배포본의 모든 버전까지 확인했다는 뜻은 아니다.

## 별도 반례와 V-pair 결과

구현 보고가 다루지 않은 두 축을 추가했다. (1) 전역 변경이 directory 획득과 최초 prepare 사이에 들어오는 경합 및 A/B의 서로 반대인 MCP 상태, (2) 독립 Git 저장소 A/B 대신 Git 루트와 하위 cwd 조합이다. 프로덕션 코드 변이는 하지 않았다.

| Pair | 레벨 / 판정 | 직접 관측 |
|---|---|---|
| VP5 | UT / PASS | extension-catalog의 실제 SettingsStore·명시 선택 저장 및 경로 정규화. 기본값 조회가 저장을 만들지 않음 |
| VP6 | UT / PASS | 두 configured-resources reader와 Claude adapt·native plugin tests. 지원 불가 항목 제어 거부·skills allow-list |
| VP3 | IT / PASS | 실제 등록 catalog handler, preload, bootstrap harness/native-history 및 SDK HTTP fixture. 서로 다른 엔진 선택값 전달 |
| VP4 | IT / PASS | 실제 reader→catalog hook→CustomizeList, resource state→tile. 부분 실패·늦은 응답·고정 토글 |
| VP2 | ST / PASS(검증 범위) | OpenCode capture 이후 global 변경·A/B 반대 상태·busy 보류·새 directory 최신값, Claude plugin flags/skills owner 유지·마지막 해제 후 갱신 |
| VP7 | ST / PAIR_FAIL | F1. 기존 sync/shared-instance 테스트는 통과하나 native SDK의 Git-root MCP 상태가 다른 cwd로 확장됨 |
| VP1 | AT / BLOCKED_BY:VP7 | nav capability·외부 파일 불변·명시 선택 경로는 통과. 전체 제품의 프로젝트 격리는 승인 불가 |

§10 확인은 EP1(5자리: schema/store·IPC·preload/API·handler·bootstrap), EP2(3자리: Claude flags·allow-list·snapshot), EP3(4자리: OpenCode snapshot·prepare·mutation·저장/reconcile), EP4(5자리: 두 reader·hook·rows·panel)를 다시 대조했다. 17자리의 기존 경로는 관련 테스트에서 실행됐다. **17/17은 전체 정책 PASS가 아니다.** F1은 상속한 VP7의 native persistence 경계이며, 현재 경로를 서로 다른 Git 저장소로만 시험하면 드러나지 않는다.

## 실행 증거와 한계

| 검사 | 결과 |
|---|---|
| 정책/SDK/core 재실행 | 5파일 36테스트 통과 |
| UI·project sharing·instance lifecycle 재실행 | 11파일 73테스트 통과 |
| bootstrap/preload/store/adapter 추가 실행 | 8파일 117테스트 통과 |
| CI 실패 파일 보완 | 4파일 40테스트 통과. 기존 27실패 재현 후 수정 |
| 별도 반례 | OpenCode 1통과, Claude 1실패(의도한 격리 oracle 위반) |
| 설치 Claude SDK probe | A off → native Git-root 저장 → 첫 B disabled 재현 |
| 타입 / lint / 스크립트 | node/web/test 통과, lint 오류 0·기존 경고 2, 스크립트 142통과 |
| 전체 Windows CI | [run 39727864276](https://github.com/muzaby/orca-skin/actions/runs/39727864276) **success**. Vitest 805파일·7876테스트 통과, 기존 skip 2파일·2테스트. 스크립트 142통과. 문서·lint·typecheck 성공 |

테스트/SDK 재현 코드는 [evidence](evidence/README.md)에 보존했다. 실패 증거는 앱의 정상 CI 수집 경로 밖에서 명시 실행하며 숨긴 skip은 없다.

로컬 Electron 전체 검사는 fork 종료 지연으로 중단했고 통과 증거에서 제외했다. 자동 surface 스캔도 완료되지 않아 전수 성공으로 세지 않았다. 대신 신규 extensionControl·MCP control·catalog handler·CatalogToggle의 production 참조와 bootstrap 조립을 직접 대조했다. 문서 전체 링크 검사의 참조 checkout 오류는 기존 환경 문제이며 CI의 clean checkout 문서 검사는 통과했다.

**추가 확인 필요:** Orca 자체 MCP의 배포 파일은 고정 경로를 덮어쓰며 Claude snapshot은 flags·skills에 한정된다. 기존 Query가 있는 cwd에 새 Query가 합류하는 경우의 배포 MCP 구성이 동일한지 이번 SDK 실험은 확인하지 않았다. native MCP/flags 검사 결과를 Orca 배포 파일 전체의 불변 증거로 확대하지 않는다. 사용자 설치 OpenCode 1.17.19와 두 테마 실제 창 시각 인수도 미실행이다.

## 처분 및 다음 구현

| 항목 | 처분 |
|---|---|
| F1 | BLOCKING. 현재 cwd 범위와 SDK 저장 범위를 일치시키거나, 격리를 보장하지 못하는 제어를 지원 가능으로 표시하지 않아야 함. reader에서 상속만 제거해도 새 B Query의 native disabled 상태는 남으므로 SDK 경계까지 해결해야 함 |
| 기존 테스트 사각 | 같은 Git root의 A/B 조합을 runtime·파일·cold-start 회귀에 추가. root Query가 idle인 경우뿐 아니라 한쪽 busy인 경우도 검사 |
| Orca 배포 MCP | 후속 독립 검증 항목. 관측하지 않은 수명 경로에 PASS를 부여하지 않음 |
| 정책 변경 | 없음. 현재 경로를 Git root로 재정의하여 통과시키지 않음 |

프로덕션 수정은 이번 검증에 섞지 않았다. 사용자 요청에 따른 Codex 검증이며 Claude가 검증했다고 표기하지 않는다. CI 복구는 `6bf1ee40`, 정책 검증 결론은 **FAIL**로 분리한다.

---

# verify r2 — FAIL (Claude, 2026-10-22)

> 위 r1.2 판정(Codex)은 원문 그대로 보존한다. 아래는 독립 검증 2회째다. 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `10f52f9..32b43cc` — `a082776`(ΔV5 r2) · `9198ec3`·`84fe913`(r2.2 CI 보완) · `32b43cc`(기록) |
| 구현 전 plan 기준 | `087543e` · `8137313` · `1700459` · `f7d268d` · `10f52f9`(§27 READY) |
| V mode / 유효 V | Delta V / V1 + ΔV1–ΔV5, 최종 분모 = §27 FEP1–12 |
| 라운드 | 2 (이 handoff의 verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**FAIL — r1.2의 F1(Git-root MCP 전파)은 D32 거부로 해소됐지만, §27 고정 자리 5곳에서 심은 고장이 전 실행에서 green이었다.** 전역 control 공유 주입(FEP2)·발행 barrier(FEP4)·OpenCode plugin 선언 revision(FEP8)·외부 재편집 재확인(FEP9)·renderer push scope(FEP12)가 미잠금이다.

## r2-0. 기준선 / plan validity

- 구현 커밋의 `plan.md` 변경: `git diff 10f52f9 32b43cc`가 `[구현자 기입]` 추가 115줄뿐(`-` 0줄). 기준선 diff 성립.
- 정책 충돌은 **최신 handoff가 정본**(사용자 지시 2026-10-22): D32가 OpenCode 프로젝트 저장 성공 조건(AC6N·13N·14K의 writer 부분)을 "관측·거부·무기록"으로 대체했으므로 그 기준으로 채점한다.
- §27 자리 목록: FEP1–12가 생산 경로·직접 oracle 좌표로 고정. 검색 입력 재실행 결과 목록 밖 운반 자리 없음. root PLAN_GAP 없음.
- 이전 라운드 고장 이력: r1.2는 변이 0건(F1 반례만). F1을 아래에서 재실행했다.

## r2-1. F1 재실행

| 증거 | r1.2 | r2 (HEAD) |
|---|---|---|
| `evidence/native-isolation.test.ts` Claude reader/reconcile 반례 | 실패(전파) | **통과** — child revision 불변·SDK set 0 |
| 같은 파일 OpenCode 케이스 | 통과 | 실패 `이 MCP는 작업 경로별 제어를 지원하지 않습니다.`(`mcp-control.ts:43`) — D32 거부가 의도대로 동작. 증거 README의 "1통과·1실패" 기대는 V1 시점 서술(N3) |
| `evidence/claude-cwd-probe.mjs`(설치 SDK) | `firstB: disabled` | 동일 — SDK의 Git-root 저장은 그대로이며 Orca가 MCP 제어를 SDK 호출 전에 거부(A12 잡음) |

- 판정: F1 해소(제어 경로 차단 방식). "Orca 배포 MCP 후속 확인"은 FEP3·4로 재측정했다(A19 잡음, X2 못 잡음).

## r2-4. 고장 내 보기

- 0279 verify와 공유한 A1–A24·PL1·P11–P13 실행 + 0278 전용 X1·X2·F12a–d. 환경·Windows shim 방법은 [0279 verify §4](../0279-claude-project-plugin-state/verify.md#4-고장-내-보기). Windows shim 판정은 BASE 실패 목록과의 차집합이다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| A20 | `handlers/extension-catalog.ts:37` | 제거 | `canToggle` 거부 삭제 | 잡음 | `extension-catalog.test: reads native defaults without copying them and keeps supported explicit choices only in memory` | FEP1 |
| X1 | `app/bootstrap.ts:1201` | 다른 값 | catalog handler에 registry와 다른 `extensionControl()` 주입 | **못 잡음** | — | FEP2 · DV1-P4 |
| A18 | `claude/adapter.ts:440` | 고정값 | snapshot 재사용 → 항상 새 capture | 잡음 | `adapter.native-plugins.test: isolates global SDK choices and freezes them…` | FEP3 |
| A19 | `claude/adapter.ts:467` | 제거 | 배포 snapshot roots 무시 | 잡음(shim) | `adapter.native-plugins.test: pins deployed MCP files for same-cwd peers…` | FEP3·4 |
| X2 | `app/harnesses/claude/extensions.ts:65` | 호출 대체 | `await publish` → `void publish` | **못 잡음** | — | FEP4 · DV5-P1 |
| A12·A13·PL1 | `claude/native-resources.ts:186·168·158` | 호출 대체·제거 | MCP SDK 호출 허용 / persist 미대기 / 형제 flag 버림 | 잡음(A13·PL1 shim) | `native-resources.test: rejects both MCP toggle directions…`·`waits for durable persistence…`·`…preserving sibling flags` | FEP5 |
| A1·A24 | `claude/project-settings.ts:79` · `project-reconciliation.ts:94` | 다른 값·제거 | Git-root 병합 / MCP restart-required 삭제 | 잡음 | `project-settings.test: …excluding other cwd and Git-root state` · `project-reconciliation.test: isolates project approvals…` | FEP6 |
| A21 | `opencode/v1/mcp-control.ts:70` | 제거 | 프로젝트 선언 우선 필터 삭제 | 잡음 | `opencode/v1/project-settings.test`·`session-context.test: freezes global choices per directory…` 외 | FEP7 |
| A22 | `opencode/v1/mcp-control.ts:43` | 호출 대체 | 직접 set 거부 → `return` | 잡음 | `adapter.test: …rejects unsafe project controls…`·`session-context.test: …rejects unsafe project writes…` | FEP7 · DV4-P2 |
| A23 | `opencode/v1/project-settings.ts:24` | 제거 | revision 입력에서 `plugin` 선언 삭제 | **못 잡음** | — (oracle의 plugin 값이 항상 `["p"]`) | FEP8 · AC15O |
| A5·A6 | `app/project-resource-sync.ts:44·178` | 제거 | idle 조건 / 읽는 중 version 변경 폐기 | A5 잡음 · **A6 못 잡음**(Linux·shim) | `project-resource-sync.test: counts …activity as busy` | FEP8 · AC11 |
| A2·A3·A14 | `plugin-state.ts:26·32` · `file-mutation.ts:35` | 제거·빈 값 | 형제 키 / coordinator root / FIFO | 잡음 | `plugin-state.test`·`project-settings.test`·`file-mutation.test: serializes canonical same-file aliases…` | FEP9 |
| A15 | `infra/config/file-mutation.ts:134` | 고정값 | commit 직전 외부 변경 재확인 → `false` | **못 잡음**(Linux·shim) | — (유일 oracle이 EBUSY 재시도로 재읽기) | FEP9 · AC19C |
| A11 | `handlers/session-resources.ts:256` | 제거 | 쓰기 전 `canToggle` 확인 삭제 | 잡음 | `session-resources.test: rejects stale generations, unknown entries and read-only resources…` | FEP10 |
| A16·A17 | `app/native-settings-lifecycle.ts:12·32` | 맞바꿈·제거 | drain↔shutdown / before-quit 지연 삭제 | 잡음 | `native-settings-lifecycle.test` 2건 | FEP11 |
| F12a | `CustomizeList.tsx` | 고정값 | capability별 회색 글씨 class 고정 | 잡음 | `useNativeMcpCatalog.test: renders native plugin capabilities…` | FEP12 · AC1 |
| F12b | `CustomizeList.tsx` | 고정값 | `canToggle={true}` | 잡음 | 같음 | FEP12 · AC1 |
| F12c | `CatalogToggle.tsx` | 제거 | `!canToggle` disabled 조건 삭제 | 잡음 | `CustomizeList.render.test: uses capability for font and fixed switches…` 외 | FEP12 · AC21C |
| F12d | `lib/nativeResourcesMenu.ts` | 고정값 | 패널 토글 노출 조건 → `true` | 잡음 | `NativeResourcesTile.test: lists read-only OpenCode resources without inventing unsupported controls` | FEP12 · DV4-P1 |
| P11–P13 | `lib/nativeResourceState.ts:308-310` | 제거 | push 수락 scope의 backend/cwd/projectId 항 각각 삭제 | **못 잡음** ×3 | — | FEP12 · AC7C |

- 검산(0278 귀속 행): 시도 29(A1·A2·A3·A5·A6·A11·A12·A13·A14·A15·A16·A17·A18·A19·A20·A21·A22·A23·A24·PL1·X1·X2·F12a–d·P11–P13) = 잡음 21 · 못 잡음 8(X1·X2·A6·A15·A23·P11·P12·P13) · 동치 0. A7(동치)·A4·A9·A10은 0279 V1 자리로 [0279 verify](../0279-claude-project-plugin-state/verify.md)에 귀속.
- 못 잡음 8건은 모두 §27 고정 자리 → `PAIR_FAIL`(§r2-13 R1–R5).

## r2-5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| DV3-P4 | UT | CHANGED REQUIRED | **PAIR_FAIL** | A14·A2 잡음, **A15** 못 잡음 |
| DV4-P3 | UT | CHANGED REQUIRED | PASS | 지원 판정: A12·A22·F12b·F12c 잡음 |
| DV1-P4 | IT | CHANGED REQUIRED | **PAIR_FAIL** | A20 잡음, **X1** 못 잡음(같은 control 주입) |
| DV2-P3 | IT | CHANGED REQUIRED | **PAIR_FAIL** | A21·A22 잡음, **A23** 못 잡음(plugin revision) |
| DV3-P3 | IT | CHANGED REQUIRED | PASS | A2·A3·A13 잡음 |
| DV4-P2 | IT | CHANGED REQUIRED | PASS | A12·A22·A24 잡음 |
| DV5-P1 | IT | NEW REQUIRED | **PAIR_FAIL** | A18·A19·A16·A17 잡음, **X2** 못 잡음(발행 barrier) |
| DV2-P2 | ST | CHANGED REQUIRED | **PAIR_FAIL** | A5 잡음, **A6** 못 잡음(stale revision emit) |
| DV3-P2 | ST | CHANGED REQUIRED | PASS | A16·A17·A5 잡음 |
| DV1-P2 | ST | CHANGED REQUIRED | BLOCKED_BY:DV5-P1 | G 축 A18·A21·A22 잡음, 배포 edge는 X2 root |
| DV3-P1 | AT | CHANGED REQUIRED | PASS | A11·A13 잡음 |
| DV4-P1 | AT | CHANGED REQUIRED | PASS | F12d·A11·A12 잡음 |
| V1 VP4 | IT | REGRESSION | **PAIR_FAIL** | F12a–c 잡음, **P11–P13** 못 잡음(push scope) |
| V1 VP1·VP3·VP5·VP6, DV1-P1·P3·P5, DV2-P1·P4 | — | REGRESSION | PASS | F12a·b·S10·A20·A1·A4 잡음, 해당 회귀 스위트 green |
| V1 VP2 | ST | REGRESSION | BLOCKED_BY:DV1-P4 | 전역 변경→새 B 반영 edge가 X1 root |
| V1 VP7 | ST | REGRESSION | BLOCKED_BY:0275 VP11·0276 VP6 | 0275 L8·L15, 0276 Q8 못 잡음(각 verify 귀속) |

### r2 AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 nav on/off×capability | ✅ | F12a·F12b·F12c 잡음 |
| AC2 Orca 선택이 새 instance에 반영·외부 파일 불변 | ❌ | X1(선택이 registry에 닿지 않아도 green) |
| AC3 skills allow-list | ✅ | S10 잡음(`isolates global SDK choices…`·`loads enabled native skills…`) |
| AC4S 미승인 영속 저장 없음 | ✅ | A20 잡음, `extension-catalog.test`의 legacy bytes 무효 단언 |
| AC5G 시작 A 고정·새 B 최신 | ❌ | A18·A21 잡음, X1·X2(새 B 최신 선택·발행 완료) green |
| AC6N(→D32) OpenCode 프로젝트 관측·거부 | ✅ | A22 잡음 |
| AC7C cwd 공유·격리 | ❌ | A1·A4 잡음, P11–P13(다른 scope push 수락) green |
| AC8 선언/동적 MCP 구분 | ✅ | O1·O2 잡음 |
| AC9 부분 실패·늦은 결과 거짓 성공 없음 | ✅ | A11·A13 잡음 |
| AC10 조회가 서버를 만들지 않음 | ✅ | 0278 범위 회귀 green. composer 수명 미잠금은 0275·0276 root |
| AC11 외부 변경 즉시 표시·유휴 적용·stale 폐기 | ❌ | A5·A8 잡음, A6 green |
| AC12 합의·구현·검증 구분 | ✅ | 이 문서·INDEX가 F1 해소와 잔여 결함을 분리 |
| AC13N(→D32) legacy 선택이 native를 덮지 않음 | ✅ | A20·`does not reactivate legacy choice bytes` |
| AC14K 대상 키만 편집 | ✅ | A2·A3 잡음 |
| AC15O 외부 편집 UI 즉시·런타임 지연 | ❌ | A23(plugin-only 외부 변경 미관측) green |
| AC16F 부분 실패·이전 세대 응답 | ✅ | A11·A13·PL1 잡음 |
| AC17W 겹친 저장 보존 | ✅ | A14·A2 잡음 |
| AC18Q 잠금 중 다른 파일 진행·해제 후 성공 | ✅ | A14 잡음, Windows 실제 잠금 테스트는 CI #853 green |
| AC19C 외부 편집 시 최신 원본에 patch | ❌ | A15 green |
| AC20L 대기·watcher·종료 | ✅ | A16·A17 잡음 |
| AC21C capability별 제어/관측 | ✅ | A12·A22·F12c·F12d 잡음 |

- 합계 재측정: `✅ 15 · ❌ 6 = 21`. 자기보고 `Criteria-Met: 21/21`(`a082776`·`32b43cc` trailer)과 불일치.

### r2 §27 강제 지점 분모

| 자리 | 결과 |
|---|---|
| FEP1·3·5·6·7·10·11 | PASS |
| FEP2 | PAIR_FAIL (X1) |
| FEP4 | PAIR_FAIL (X2; A19 잡음) |
| FEP8 | PAIR_FAIL (A23·A6; A5·A21 잡음) |
| FEP9 | PAIR_FAIL (A15; A2·A3·A14 잡음) |
| FEP12 | PAIR_FAIL (P11–P13; F12a–d 잡음) |

- FEP 7/12 PASS. 목록 밖 발견 없음.

### r2 운영 gate

HEAD `32b43cc` 실행 산출은 [0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc): typecheck 0 · lint 0 error/2 기존 warning · renderer 374/3060 · main 465파일 중 15 red 전부 Windows 전용 fixture · Windows CI #853 green · scripts 142/142. r2.2 CI 보완 범위 자체는 PASS.

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·라운드 2 → `verify/FAIL`·Codex·라운드 3. 대상 커밋 `a082776`·`9198ec3`·`84fe913`·`32b43cc` 모두 `git cat-file -t` = commit, trailer 5키 파싱.
- `a082776` 한 커밋에 0277·0279·0281 구현이 동봉돼 각 handoff trailer로는 찾을 수 없다(각 verify에 기록).
- `[구현자 기입] ΔV5 r2` 7필드 존재, 강제 지점 표가 FEP1–12 12행을 담음.

## r2-13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| R1 | X1: catalog handler에 다른 control을 줘도 green | FEP2 · AC2·AC5G · DV1-P4 | BLOCKING | 실제 bootstrap에서 catalog 선택 후 registry가 만든 새 adapter의 SDK 인자에 반영됨을 단언 |
| R2 | X2: 발행을 기다리지 않아도 green | FEP4 · AC5G · DV5-P1 | BLOCKING | 발행 gate가 열리기 전 `deployNow` 미완료를 단언 |
| R3 | A23·A6: OpenCode plugin 선언 revision 누락·읽는 중 stale revision emit(0277 D3 이관 수령) | FEP8 · AC15O·AC11 · DV2-P3·DV2-P2 | BLOCKING | plugin 배열만 바뀐 외부 편집 revision 변화, 읽기 중 이벤트 주입 |
| R4 | A15: 외부 재편집 재확인 미잠금 | FEP9 · AC19C · DV3-P4 | BLOCKING | 잠금 없는 `beforeCommit` 외부 편집 케이스 |
| R5 | P11–P13: push scope 비교 3항 미잠금(0277 D2 이관 수령) | FEP12 · AC7C · V1 VP4 | BLOCKING | 한 항만 다른 push 거부를 항마다 단언 |
| N3 | 증거 README의 "1통과·1실패" 기대가 D32 이전 서술 | repository operation | NON_BLOCKING | README에 현재 기대(Claude 통과·OpenCode 거부) 갱신 |

## r2-13a. 이전 handoff에서 이관 받은 책임 (사용자 결정 2026-10-22)

0278이 계약을 뒤집은 이전 handoff의 항목은 이 verify가 판정한다. 해당 handoff에서는 판정하지 않는다.

| 출처 | 항목 | 뒤집은 요소 | 이 verify 판정 |
|---|---|---|---|
| 0277 D2 | P11–P13 renderer push scope(0277 AC5) | D23·§27 FEP12 | R5 — **PAIR_FAIL**(못 잡음 ×3) |
| 0277 D3 | A23 plugin 선언 revision(0277 AC6)·A6 stale revision(0277 AC10) | D30·§27 FEP8 | R3 — **PAIR_FAIL**(못 잡음) |
| 0271 S9 | 비활성 스킬 표시 색(0271 AC5 색상 단언) | D11·D24 on/off×capability | F12a·F12b·F12c 잡음 → PASS |
| 0272 AC6 | nav 색상 유지(색상 부분) | D11·D24 | F12a–c 잡음 → PASS |

- 판정 결과는 기존 r2 표와 같다. 이관으로 새 FAIL·PASS가 생기지 않았고, 0277·0271·0272 쪽 중복 판정이 사라졌다.

## r2-14. Review Signals

- 이전 라운드 동일 증상: F1은 해소. 이번 미검출 축은 r1.2가 다루지 않은 새 축.
- 관련 plan 지침: §27이 FEP2 "동일 control 주입", FEP4 "발행 barrier", FEP9 "외부 재편집"을 oracle 문장으로 명시했다.
- 사용자 결정 변경: D32(2026-10-22) — 최신 정책 기준 채점.
- 반복 환경 한계: Windows 전용 plugin gate·`C:/` fixture — 검증자 shim과 Windows CI.

## r2-15. 결론

- 상태: **FAIL** — verify 2회째(라운드 2 → 3).
- pair: root PAIR_FAIL 6(DV1-P4·DV2-P2·DV2-P3·DV3-P4·DV5-P1·V1 VP4) — DV2-P2/P3는 FEP8 한 자리의 두 고장. BLOCKED_BY 3(DV1-P2·V1 VP2·V1 VP7). 나머지 PASS.
- PLAN_GAP: 없음. AC ✅15 · ❌6 / 21.
- 다음 단계: Codex r3 — R1–R5 테스트 보강(R3·R5는 0277 D3·D2 이관분 포함), 다음 verify는 X1·X2·A6·A15·A23·P11–P13 재실행.
