# Plan — 0271-native-skill-target

## 메타

| 항목 | 값 |
|---|---|
| slug | `0271-native-skill-target` |
| 작성자 | Codex — 사용자 직접 수정 요청 |
| 일자 | 2026-10-21 |
| 상태 | IMPL_DONE |
| V mode / 기준 V | Baseline V / none |
| 이번 V revision / 유효 V | ΔV1 / V1 + ΔV1 |

## 후속 정책 정정 — 색상·제어 가능성

0278 D11·D24가 본문의 초기 색상 기준을 대체한다. AC4의 native 일괄 토글 금지는 항목별 capability 확인으로 한정하고 삭제 권한은 유지한다. AC5·VP-01·VP-02의 enabled=false 색상 단언은 0278 AC1/VP1·VP4의 on/off×capability 행렬로 이관하며 파일 열기·원문 식별자·작성 slug 검증 증거는 유지한다.

기준은 본 V1+ΔV1@256ddd24이며 이 정정은 정책 정본 연결이다. 과거 조사·구현 보고의 회색 관측을 현재 요구로 승격하지 않는다. 이번 턴에 제품 코드를 바꾸거나 이전 검증을 PASS로 갱신하지 않는다.

# Part I — Product & UX Contract

## 1. Context / 목표

수정한다. 플러그인 스킬의 `superpowers:using-superpowers` 이름이 작성용 slug 검증에서 거부되어 파일 열기·폴더 표시가 실패한다(`protocol.ts:369–389`).
기존 카탈로그 항목의 이름은 원문 식별자로 조회하고, 새 Orca 스킬의 디렉터리 이름 제약은 유지한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “원격 저장소의 codex-harness-entry-menu 브랜치로 전환하라” | 현재 사용자 요청 |
| 명시 증상 | 플러그인 → 스킬 → superpowers → 케밥 → 폴더에서 열기 시 Zod regex 오류, 회색 표시 | 현재 사용자 로그 |
| 추론 의도 | 해당 스킬의 파일 접근을 복구하고 회색 표시의 원인을 확인한다 | 로그와 UI 경로 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 당시 요청 브랜치에서 작업한다 | 브랜치 전환 명시 요구 | 사용자 | SUPERSEDED | 병합 후 원격 main 전환 요청(2026-10-22) |
| D-002 | 카탈로그 이름은 생성용 slug가 아닌 정확한 조회 키다 | producer가 namespace·frontmatter 이름을 그대로 제공 | `plugin-catalog.ts`, `scan.ts` | ACTIVE | — |
| D-003 | 파일 열기가 활성 상태·쓰기 권한을 변경하지 않음 | native capability를 조회 시 재검증 | 초기 사용자 요청 | ACTIVE(읽기 권한) | 모든 native 토글 불가·off이면 회색이라는 부분은 0278 D11·D24로 대체 |
| D-004 | Orca 작성 이름의 기존 제약을 보존한다 | 디렉터리 생성에 사용되는 값 | `sources.ts`, `AuthorSkillSchema` | ACTIVE | — |

### 갱신 메모

신규 D-001~004, 대체 결정 없음. ACTIVE 결정 ↔ AC 대조: D-001은 운영 gate, D-002↔AC1·2, D-003↔AC4·5, D-004↔AC3으로 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 직접 원인인가 | 예 | namespace `:`를 producer가 만들고 target schema가 거부 |
| 회색이 오류인가 | 아니오 | `~/.claude/settings.json`의 superpowers 항목=false, `CustomizeList`는 enabled=false에 `text-ink3` |
| 더 작은 해법 | 작성/조회 검증 분리 | handler는 이미 카탈로그의 sourceId/name을 정확히 대조 |
| 기존 결정 충돌 | 없음 | native 설정을 쓰거나 스킬 파일을 재배포하지 않음 |

이 절의 회색 표시 원인은 최초 조사 당시 사실이다. 현재 nav 표시 계약은 0278 D11·D24의 capability 기준이며 비활성 여부만으로 흐리게 표시하지 않는다.

## 5. 동작 / 사용자 흐름

```text
기존 스킬 선택 → 파일 동작 → 원문 이름의 IPC 검증 → sourceId/name 조회 → 등록된 skillPath를 OS에 전달
                                                    ↘ 미등록 항목: reject, OS 호출 없음
```

| 시작 상태/이벤트 | 시스템 동작 | 관측 결과 |
|---|---|---|
| 활성 native 스킬의 폴더/파일 열기 | 정확한 카탈로그 항목 조회 | 해당 SKILL.md 경로를 reveal/open |
| 비활성 native 스킬의 폴더/파일 열기 | 활성 여부와 독립적으로 조회 | 읽기 동작 허용, 비활성 유지 |
| 없는 sourceId/name | 조회 거부 | IPC reject, OS 호출 없음 |
| native 토글/제거 요청 | 기존 capability 확인 | 설정 변경·삭제 없음 |
| 새 Orca 스킬 작성 | 기존 slug 검증 | 잘못된 디렉터리 이름 거부 |

로딩·재시도·동시성·취소·테마 구조는 유지한다. 파일이 삭제된 뒤 OS에서 실패하는 기존 경로는 이번 검증 오류와 별개다.

## 6. 범위 / 비범위

범위: 조회 이름 검증, 관련 IPC 회귀 테스트, native 비활성 표시의 원인 확인, 계약 문서 정정.
비범위: native 설정 자동 활성화, 새 UI·토큰, 실행 스킬 선택 정책, OS 파일 앱 오류 처리 변경.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | namespace·frontmatter 이름을 가진 기존 스킬의 reveal/open은 등록된 파일 경로를 사용한다 | `skills.test.ts` namespace·정확한 원문 이름과 source 구별 경로 단언 | IPC→실제 schema/handler→shell |
| R-01 | AT-02 / AC2 | 없는 이름·source 조합은 거부되고 요청의 임의 path는 사용되지 않는다 | `skills.test.ts` 잘못된 키·추가 path 입력, shell 무호출/등록 경로 단언 | IPC→findSkill→shell |
| R-02 | AT-03 / AC3 | 새 작성 이름은 trim·1~64자 ASCII 영숫자/underscore/hyphen 제약을 유지한다 | `protocol.skills.test.ts` 유효·무효 작성 입력 | author IPC→AuthorSkillSchema |
| R-02 | AT-04 / AC4 | native의 토글·제거는 원래 권한을 유지하고 Orca 토글은 동작한다 | `skills.test.ts` patch/deploy 무호출 및 Orca 설정 갱신 | target schema→findSkill→capability→settings |
| R-03 | AT-05 / AC5 | 비활성 plugin 스킬의 파일 열기는 유지. enabled=false만 흐리게 표시하던 조건은 SUPERSEDED → 0278 AC1 | `skill-catalog.test.ts` 실제 파일/설정→IPC reveal, `CustomizeList.render.test.ts` 활성/비활성 read-only 행 비교 | plugin 설정→catalog→scan→목록/IPC |

기존 증거 확인: `skill-catalog.test.ts:assembles the real catalog…`는 disabled native 보존을 단언한다.
Windows 탐색기 창의 실기 시각 확인은 별도이고, AC1은 실제 handler가 전달하는 경로까지 기계 검증한다.

## 7-A. V / Trace Matrix

Baseline V다. 다른 handoff의 독립 검증 대기 상태는 변경하지 않는다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01·02 | R / AT | 파일 접근과 정확한 조회, AC1·2 | NEW | — |
| R-02 / AT-03·04 | R / AT | 작성 제약·쓰기 권한, AC3·4 | NEW | — |
| R-03 / AT-05 | R / AT | 비활성 표시와 읽기 분리, AC5 | NEW | — |
| SD-01 / ST-01 | SD / ST | 설정/실제 파일→카탈로그→폴더 표시 | NEW | — |
| AR-01 / IT-01 | AR / IT | schema→handler→카탈로그 조회→OS/권한 | NEW | — |
| MD-01 / UT-01 | MD / UT | 작성명과 조회 식별자 분리 | NEW | — |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·02·03 ↔ AT-01~05 | REQUIRED | 아래 VP-02~04의 경로 + 실제 CustomizeList 렌더 | AC1~4→`skills.test.ts`, `protocol.skills.test.ts`; AC5→`skill-catalog.test.ts`, `CustomizeList.render.test.ts:only dims disabled…` | not selected — 직접 경로·설정·출력 단언 | EP-01~05 (15) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | 실제 native 설정/파일→readSkillCatalog→scanSkills→skillsList→showInFolder→shell | `skill-catalog.test.ts:assembles the real catalog…` disabled 항목 reveal; 목록의 색→`CustomizeList.render.test.ts:only dims disabled…` | not selected — 실제 fixture 설정·파일을 사용 | EP-02 lookup/reveal·EP-03 reveal·EP-05 (7) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | 등록된 IPC wrapper→schema→findSkill→shell/capability/settings | `skills.test.ts` 공개 IPC 진입, 같은 이름/다른 source, 같은 source/다른 이름, 양 쓰기 권한 | not selected — 실제 wrapper/schema/handler를 실행 | EP-02~04 (9) |
| VP-04 | MD-01 ↔ UT-01 | REQUIRED | raw 요청→작성/조회 schema→검증 결과 | `protocol.skills.test.ts` 원문 name 보존과 잘못된 형상/작성 slug 거부 | not selected — 직접 parse 결과 | EP-01 (2) |

운영 gate: lint·typecheck, §19의 관련 비DB 테스트, doc inventory/references, diff whitespace, 브랜치/원격 일치 및 커밋 trailer 파싱.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| target handler | `rg -n 'findSkill\(ctx' app/src/main/app/handlers/skills.ts` | 4 | toggle/open/reveal/remove가 같은 조회를 사용 |
| OS sink | `rg -n 'shell\.' app/src/main/app/handlers/skills.ts` | 2 | openPath/showItemInFolder |
| native capability | `rg -n '!skill.can' app/src/main/app/handlers/skills.ts` | 2 | canToggle/canRemove |
| 조회 schema 소비 | `rg -n 'SkillTargetSchema|SetSkillEnabledSchema' app/src/main/app/handlers/skills.ts` | 등록 4 | import 제외, 위 handler와 대응 |
| 실제 사용자 설정 | 해당 enabledPlugins의 superpowers boolean만 조회 | 1 | false, 설정 내용/인증값 수집 안 함 |

`SkillInfo.name`과 `SkillTargetRequest.name`은 string이다(`ipc.ts`). `readClaudePluginCatalog`는 namespace와 frontmatter를 조합하므로 생성 디렉터리 규칙과 같지 않다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

`plugin-catalog→readSkillCatalog→scanSkills→목록`은 namespace 이름을 보존한다. 파일 동작 IPC에서 작성 slug schema를 재사용해 lookup 전에 거부한다.
비활성 native 항목도 catalog에 포함되며 enabled=false, canToggle/canRemove=false다.

### TO-BE

동일한 모듈·흐름을 유지한다. `AuthoredSkillNameSchema`는 작성에만 쓰고 target은 변환 없는 비어 있지 않은 string으로 받는다.
임의 파일 접근을 허용하지 않도록 기존 sourceId/name exact lookup과 capability guard를 유지한다.

| 비교 축 | AS-IS | TO-BE | 이유 / 연결 |
|---|---|---|---|
| 계약 | 작성명/조회명 동일 제약 | 생성 slug / catalog identity 분리 | AC1·3 / protocol.ts |
| 경로 | lookup 전 namespace 거부 | 실제 catalog 조회 후 등록 경로 사용 | AC1·2 / IPC 통합 테스트 |
| 상태/소유권 | native 설정과 capability 소유 | 유지 | AC4·5 |
| 오류/수명 | 잘못된 요청은 reject | 유지, 유효한 namespace만 복구 | AC2 |
| 관측 | catalog·등록 테스트 중심 | 실제 요청에서 shell 경로까지 단언 | VP-02~04 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-04 / EP-01 | name 검증 | protocol.ts | Zod | AuthorSkillSchema.name, SkillTargetSchema.name (2) | `rg -n -A2 'export const (AuthorSkillSchema|SkillTargetSchema)' app/src/shared/protocol.ts` | 작성 규칙 확장 또는 namespace 거부 |
| AR-01 / VP-03 / EP-02 | sourceId/name exact lookup | skills.ts | handler | findSkill 내부 predicate, setEnabled/open/showInFolder/remove의 findSkill 호출 (5) | `rg -n 's.sourceId ===|findSkill\(ctx' app/src/main/app/handlers/skills.ts` | 다른 source/name 항목 선택 |
| AR-01 / VP-03 / EP-03 | 등록된 skillPath만 OS 전달 | skills.ts | handler | shell.openPath, shell.showItemInFolder (2) | `rg -n 'shell\.' app/src/main/app/handlers/skills.ts` | 임의 경로 또는 잘못된 OS 동작 |
| AR-01 / VP-03 / EP-04 | native 쓰기 거부 | skills.ts | handler | !skill.canToggle, !skill.canRemove (2) | `rg -n '!skill.can' app/src/main/app/handlers/skills.ts` | 조회 검증 완화가 쓰기 허용으로 번짐 |
| SD-01 / VP-02 / EP-05 | native enabled 운반/표시 | native 설정 | catalog/scan/list | plugin-catalog filesByName의 enabled, skill-catalog의 files 전달, scan entry.enabled, CustomizeList skill.enabled 분기 (4) | `rg -n 'filesByName.set|^[ ]+files$|entry.enabled|skill.enabled' app/src/main/adapters/claude/plugin-catalog.ts app/src/main/app/skill-catalog.ts app/src/main/features/extensions/common/skills/scan.ts app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx` | 비활성 상태 유실 또는 읽기 전용만으로 흐림 |
| R / 운영 | 상태 사본 | plan/INDEX/trailer | 구현자 | plan 메타, INDEX 행, 구현 trailer (3, 제품 pair 분모와 별도) | `rg -n '상태|0271-native-skill-target' docs/handoff/0271-native-skill-target/plan.md docs/handoff/INDEX.md`; git trailer | 상태 사본 불일치 |

제품 자리 합계 2+5+2+2+4=15다.
VP-02가 쓰는 lookup predicate·showInFolder 호출·shell reveal 3자리와 EP-05 4자리는 7이다.
공유 name 검증은 protocol.ts 한 곳, sourceId 제약은 유지한다. target name은 파일 경로로 사용하지 않는다.

## 11. 구현 설계

| 변경 파일 | 역할 / 변경 | 테스트 seam |
|---|---|---|
| `app/src/shared/protocol.ts` | 작성 schema 이름 명료화, target name을 exact catalog key로 분리 | 순수 Zod |
| `app/src/shared/protocol.skills.test.ts` | namespace·긴 이름·unicode·원문 보존, 작성 제약 | 순수 |
| `app/src/main/app/handlers/skills.test.ts` | 실제 IPC wrapper/schema/handler, 경로와 권한 | Electron shell/ipcMain만 대체 |
| `app/src/main/app/skill-catalog.test.ts` | disabled 실제 fixture→IPC reveal 추가 | 실제 catalog/scan, OS만 대체 |
| `app/src/renderer/src/features/skills/components/customize/CustomizeList.render.test.ts` | enabled 상태별 read-only 행의 흐림 비교 | 실제 React SSR |
| `docs/IPC_CONTRACT.md` | 생성 이름/조회 이름 의미와 disabled inventory 정정 | 현재 구현과 대조 |

신규 순수 production 모듈은 필요 없다. Electron 의존은 기존 vi.mock 패턴으로 OS/IPC 전송만 대체한다.

## 12. End-to-end 영향

producer의 namespace 이름을 변환 없이 유지한다. 기존 preload·skillApi·useCustomizeSkills·상세의 target 객체 형상은 유지한다(`rg SkillTargetRequest` 확인).
부팅/등록·새 캐시·설정 키 추가 없음. native 실행 후보와 설치 inventory의 구분은 유지한다.

## 13. Lifecycle / 오류 / 정리

추가 비동기 상태 없음. 알 수 없는 이름은 기존 findSkill 오류, 잘못된 요청 형상은 Zod reject다.
제품 저장소 쓰기 추가 없음. plan/INDEX/trailer 상태 사본은 구현 완료 시 함께 갱신하고 다시 읽는다.

## 14. 성능 / 상한 / 최적화

추가 요청·출력·캐시 없음. target name에 작성용 길이 제한을 적용하지 않으며 기존 카탈로그 검색 범위는 유지한다.

## 15. 외부 구현 포트 / 문서 계약

신규 포트 없음. 기존 IPC payload 형상은 같고 native 이름의 유효성을 현재 catalog producer와 맞춘다.

## 16. 기존 결정·규칙과의 관계

| 규칙 | 출처 | 대응 | 판정 |
|---|---|---|---|
| native 원본이 정본 | app/AGENTS.md | §3 D-003 | 유지 |
| 신규 의존성 승인 | app/AGENTS.md | §11 기존 도구만 사용 | 유지 |
| main DAG / renderer 공통 UI | 하위 AGENTS, 디자인 시스템·카탈로그 | production UI/의존 변경 없음 | 유지 |
| plan/impl 커밋 분리 | handoff-plan 마무리 | READY 선커밋 후 구현 | 유지 |

## 17. 리스크 / 트레이드오프

조회 문자열이 더 넓어지므로 exact catalog lookup에 의존한다. 잘못된 source/name과 임의 path 입력 테스트로 그 경계를 확인한다.
신규 의존성·저장 형식 변경·되돌리기 어려운 결정 없음.

## 18. 영향 받는 파일 / 문서

§11 파일 및 이 plan과 `docs/handoff/INDEX.md`. 사용자 native 설정 파일은 읽기만 수행했다.

## 19. 게이트

`app/AGENTS.md`와 main/renderer 하위 가이드를 적용한다. `npm run lint`, `npm run typecheck`, 직접 `vitest run`으로 관련 skills/catalog/plugin/protocol 테스트를 실행한다.
문서는 `node scripts/check-doc-inventory.mjs`와 변경 문서의 로컬 링크 존재 확인, 커밋은 trailer parse·`git diff --check`로 확인한다.
DB 동작 변경이 없어 ABI 전환은 하지 않는다. 빌드는 현재 Electron ABI를 보존하는 상태에서 수행할 수 있다.

## READY self-review

충돌 0: D-001~004와 §7·9·10을 대조했다. §10의 실제 자리 목록은 15개이며 VP-01은 15, VP-02는 7, VP-03은 9, VP-04는 2로 잠근다.
기존 catalog 테스트명·관련 source 경로는 `rg`/읽기로 확인했다. 신규 테스트는 §7·11에서 진입점·구별 입력·관측 대상을 지정했다.
선택한 적대 증거 없음: 직접 입력→실제 handler/schema/설정/마크업 출력으로 판정한다. 독립 검증은 구현 완료 뒤 수행한다.

### ΔV1 — 비활성 inventory 경로의 강제 지점 정정

규범 정정이다. §10의 EP-05 검색은 실제 6행을 반환했고, 기존 4자리 목록에 `includeDisabled` 필터가 빠져 있었다.
이 변경은 제품 요구·AC를 바꾸지 않는다. 구현자 조사에서 발견한 누락을 planner로 되돌려 구현 커밋과 분리해 정정한다.

| Node | 레벨 | 계약 | provenance | 대체 관계 |
|---|---|---|---|---|
| SD-01b / ST-01b | SD / ST | disabled 설치를 보존하고 enabled를 표시까지 전달 | CHANGED / NEW | SD-01 / ST-01 대체 |
| R-01·02·03 / AT-01~05 | R / AT | §7 그대로 | INHERITED | VP-01의 AC·직접 증거 승계 |

| Pair | left ↔ right | requiredness | production path / oracle | 선택적 적대 증거 | 유효 분모 |
|---|---|---|---|---|---|
| VP-02b | SD-01b ↔ ST-01b | REQUIRED | VP-02의 경로·`skill-catalog.test.ts:assembles the real catalog…`, 실제 `includeDisabled=true`로 disabled 파일 reveal; 목록→`CustomizeList.render.test.ts:only dims disabled…` | not selected — 직접 설정/파일/OS 경로 단언 승계 | EP-02 lookup/reveal·EP-03 reveal·EP-05b (8) |
| VP-01b | R-01·02·03 ↔ AT-01~05 | REGRESSION | VP-01의 경로·AC1~5 직접 증거 전부 승계 | not selected — 직접 oracle | EP-01~04·EP-05b (16) |

VP-01·02는 각각 VP-01b·02b로 대체한다. AC·증거 폐기 없음, 선택 적대 증거는 원래 없었다.
VP-03·04는 V1의 REQUIRED pair로 유지한다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| SD-01b / VP-02b / EP-05b | disabled 포함·enabled 운반/표시 | native 설정 | catalog/scan/list | plugin-catalog includeDisabled 필터, filesByName enabled, skill-catalog files 전달, scan entry.enabled, CustomizeList skill.enabled (5) | EP-05와 동일 검색 → 6행 중 아래 제외 1행 | 비활성 파일 누락/상태 유실/잘못된 흐림 |

제외 1행: `plugin-catalog.ts:installations.push`는 별도 installations 출력이고, 이 path는 `.files`만 scanSkills에 전달하므로 운반 자리가 아니다.
유효 분모: EP-01~04의 11자리 + EP-05b 5자리 = 16. 상태 사본 3자리는 운영 gate로 유지한다.
정합성 재확인: D-003↔AC5 충돌 0, 기존·대체 pair의 AC5와 oracle 좌표 승계, 원 검색 출력의 두 추가 행을 모두 분류했다.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1 + ΔV1, AC1~5와 기존 생성/조회 책임 분리를 구현했다(`protocol.ts:AuthoredSkillNameSchema/SkillTargetSchema`).
- 이견 / 현실성 문제: 초기 §10 EP-05 검색 6행과 4자리 목록의 차이는 위 ΔV1 별도 설계 커밋으로 정정했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 사용자 native 설정의 false는 읽기만 했고, 실제 비활성 fixture를 사용했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래 좌표에서 `H`는 `app/src/main/app/handlers/skills.test.ts`, `P`는 `app/src/shared/protocol.skills.test.ts`, `C`는 `app/src/main/app/skill-catalog.test.ts`, `L`은 `app/src/renderer/src/features/skills/components/customize/CustomizeList.render.test.ts`다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-04 | EP-01 name | author/target name (2) | 2/2 | §10 검색으로 schema 2개; P:`preserves the catalog identity…`, `keeps authored directory names valid…`, `rejects unsafe or unsupported…` | namespace/Unicode/긴 이름/공백 원문→parse 동일값; 작성 64/65자·경로 구별→허용/거부 | — |
| VP-03 | EP-02 조회 | predicate + toggle/open/reveal/remove lookup (5) | 5/5 | §10 검색 5행; H:`…opens the exact disabled native skill…`, `…rejects unknown source/name combinations…`, `still updates…`, `still removes…` | 같은 name/다른 source, 같은 source/다른 name의 서로 다른 경로→선택 경로 단언; 없는 조합→reject | — |
| VP-03 | EP-03 OS 경로 | openPath/showItemInFolder (2) | 2/2 | §10 검색 2행; H:`…opens the exact disabled native skill…` 두 channel 케이스 | 등록 skillPath와 추가 `/untrusted/SKILL.md` 구별→등록 경로만 사용; 반대 shell 무호출 | — |
| VP-03 | EP-04 capability | toggle/remove guard (2) | 2/2 | §10 검색 2행; H:`keeps native toggles read-only…`, `keeps native removal forbidden…` | native namespace·false capability→settings/deploy/delete 무호출; Orca true capability→선택 설정/폴더만 변경 | — |
| VP-02b | EP-05b enabled | includeDisabled/filesByName/files/scan/list (5) | 5/5 | §10 검색 6행 중 installations 1행 제외; C:`assembles the real catalog…`, L:`only dims disabled skills…` | 실제 settings true→false 갱신, `design:native`→등록 파일 reveal와 false/capability 보존; read-only true/false→서로 다른 class | — |

자리 목록 차집합: EP-01~04 검색의 schema 2·lookup 5·shell 2·guard 2를 목록과 대조해 추가/누락 없음. EP-05b는 검색 6행에서 별도 installations 출력 1행을 빼면 목록 5자리와 추가/누락 없음.
§10 목록 밖 운반 자리 없음. 직전 verify 고장 이력은 최초 구현이므로 해당 없음.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01b | REGRESSION | SELF_PASS | H/P/C/L의 위 좌표, AC1~5 아래 대조 | not selected — 직접 oracle |
| VP-02b | REQUIRED | SELF_PASS | C:`assembles the real catalog…`, L:`only dims disabled skills…` | not selected — 실제 파일·설정과 렌더 출력 |
| VP-03 | REQUIRED | SELF_PASS | H의 namespace/unknown/capability/Orca 갱신 케이스 | not selected — 실제 wrapper/schema/handler |
| VP-04 | REQUIRED | SELF_PASS | P의 identity/형상/작성 입력 케이스 | not selected — 실제 schema parse |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 — 직접 oracle | 선택 적대 증거·인용 변이·신규 구조 oracle 없음 | 최초 | 변경 전 실제 schema에서 16 fail/32 pass, 수정 후 같은 48케이스 pass | 원래 namespace 검증 오류의 재현/복구 확인 |

분모 검산: 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 적대 표 의무 행 0(위 1행은 직접 재현 기록).
덮개 회귀: 기존 테스트 장치 삭제·교체 없음. 기존 catalog 케이스에 disabled→reveal 관측을 추가했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태의 소비자가 있는가 | 새 UI 문구·상태 없음 | 기존 CustomizeList와 상세 메뉴 유지 |
| production 재배치와 정리 스코프 | 재배치 없음 | 해당 없음 |
| 이번 실패 경로와 Part I 상태표 | 기존의 미등록 이름 reject를 유지 | H의 unknown 조합 케이스 |
| 실패가 무동작으로 보이는가 | 기존 OS 오류 처리 경로는 변경하지 않음 | 아래 잠재 문제 2 참조 |
| 늦은 응답이 화면을 되돌리는가 | 새 비동기 상태 쓰기 없음 | 기존 선택 epoch 유지 |
| 비활성과 읽기 전용을 구별하는가 | 실제 false만 text-ink3, read-only여도 true는 일반 색 | L의 활성/비활성 쌍 단언 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | EP-05 초기 검색/분모가 달랐음 | plan 수정 제안 후 ΔV1 별도 설계 커밋으로 반영 | 실제 검색 6행, filter 포함 5자리와 installations 제외 1행 |
| 2 | shell.openPath의 반환 오류 문자열을 기존 handler가 해석하지 않음 | 보고만 — OS 파일 앱 실패 UX는 비범위 | `skills.ts:skillsOpen`은 await 결과를 사용하지 않음 |
| 3 | native 비활성 원인을 설명하는 별도 라벨/설정 링크가 없음 | 보고만 — 제품 UI 후속 판단 | `CustomizeList`는 enabled=false 색상, `SkillDetail`은 canToggle=false일 때 토글 생략 |

### 설계 대비 명시적 차이

유효 V1 + ΔV1 대비 차이 없음. 생성 schema와 target만 분리하고 기존 lookup을 유지했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 새 캐시 없음 | AC1/EP-03 직접 IPC 경로 |
| 공유 | 해당 없음 — 대체 저장소 없음 | AC4/EP-04 기존 settings 권한 단언 |
| 재진입 | 해당 없음 — 새 상태 없음 | AC1/EP-03 두 OS 동작을 별도 호출 |
| 다른 무효화 축 | 해당 없음 — 새 무효화 없음 | AC5/EP-05b 설정 갱신 후 실제 catalog 재조회 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | §11 파일 및 plan/INDEX. production 변경은 `protocol.ts`의 생성/조회 검증 분리 |
| 실행 명령 | 직접 `vitest run`(§19 대상), `npm run lint`, `npm run typecheck`, `node scripts/check-doc-inventory.mjs`, `node scripts/check-test-budgets.mjs` |
| 빌드 명령 | `node scripts/ensure-sqlite-abi.mjs electron` → `already ok`; `electron-vite build`(이미 통과한 typecheck 뒤) |
| 관측한 게이트 산출 | 관련 27파일/207케이스 pass, typecheck node/web/test 오류 0; lint 오류 0·기존 virtualizer 경고 2 |
| 추가 gate 산출 | doc inventory 변경 없음, real-git budget 16 suites ok, 문서 로컬 링크 누락 없음, diff whitespace 오류 없음 |
| 빌드 산출 | main 398모듈·preload 3모듈·renderer 1836모듈 빌드 완료; 기존 SubAgentTaskDetail의 정적/동적 import 경고 1 |
| 환경 기인 실패 | 없음. DB/ABI 전환 없이 테스트했고 기존 Electron ABI 유지 |
| 도구 쓰기 분리 | lint가 무관한 `chat-turn.execution-config.test.ts`의 줄바꿈을 고쳐 해당 두 hunk만 원복, diff에서 제외 확인 |
| V-pair 자기확인 | SELF_PASS 4 / SELF_BLOCKED 0, 독립 검증 PASS를 뜻하지 않음 |
| 강제 지점 전수 | 제품 16/16; 상태 사본은 plan/INDEX IMPL_DONE을 다시 읽고 구현 커밋 trailer 파싱으로 마감 |
| AC 자기보고 | 5/5 — 아래 표 관측으로 검산 |
| 합계 검산 | ✅ 5 · ⚠️ 0 · ❌ 0 = 총 5 |
| 블로커 / 역질문 | 없음. Windows 탐색기 창 실기와 독립 검증은 미수행 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 / 이번 턴 관측 |
|---|---|
| AC1 | ✅ H의 양 OS 동작과 긴 Unicode 이름, C의 실제 namespace 파일 reveal 통과 |
| AC2 | ✅ H의 네 채널 unknown source/name 조합 reject, open/reveal 요청의 추가 path 무시 통과 |
| AC3 | ✅ P의 작성 slug 유효 4·무효 9 입력 통과 |
| AC4 | ✅ H의 native toggle/remove guard, Orca toggle/remove 회귀 통과 |
| AC5 | ✅ C의 disabled catalog→파일 reveal와 false/capability 보존, L의 enabled/read-only 구별 통과 |

AC 행 검산: ✅ 5 · ⚠️ 0 · ❌ 0 = 총 5. 분모 변경 없음.

## [구현자 기입] Review Signals — 사실만

- 이전 라운드와 같은 축인가: 최초 `r1`, 원본 증상은 작성명/조회명 검증 혼용이다.
- 막았어야 할 지침·AC: 기존 catalog 테스트는 namespace 항목을 읽었지만 해당 이름으로 파일 IPC를 호출하지 않았다.
- 환경 한계: 테스트는 실제 handler의 OS 호출 경로까지 관측하며 Windows 탐색기 창 자체는 관측하지 않았다.
- 현재 라운드·impl 턴: `r1`. 분모 누락은 위 ΔV1으로 정정했고 지침 자체는 변경하지 않았다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **PASS**. 파생 이슈 없음.
