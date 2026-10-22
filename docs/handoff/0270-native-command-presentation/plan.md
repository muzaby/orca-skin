# Plan — 0270-native-command-presentation

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (사용자 직접 수정 요청) / 2026-10-21 |
| 상태 | IMPL_DONE (r1, 독립 검증 대기) |
| V mode / 기준 / revision | Baseline V / none / V1 |
| 유효 V | V1 + ΔV1 (아래 정정) |
| 브랜치 | codex-harness-entry-menu (원격과 동일한 상태에서 착수) |

# Part I — Product & UX Contract

## 1. 목표

OpenCode의 응답 진행 문구, Claude 스킬 명령의 재시작 복원, 세션에서 켠 native 플러그인의 검색·강조를 수정한다.

## 2. 사용자 의도 / 출처

| 구분 | 원문 / 근거 |
|---|---|
| 명시 | "스피너 출력 라인의 텍스트를 '생각 중' 으로 변경하라." |
| 명시 | "앱 재시작시 스킬 커맨드가 xml 태그로 그대로 렌더링되는 문제가 발생하고 있다(대화중에는 문제 없음)." |
| 명시 | "상태 패널에서는 정상 출력되나, 컴포저에서 슬래시 커맨드 입력시 렌더잉되지 않고, nav 플러그인 페이지 -> 스킬 탭에서도 감지되지 않고 있다." |
| 확인 답변 | "세션에서 켠 상태인데 누락됩니다" |

## 3. Decision Ledger

| ID | 결정 | 상태 | 근거 |
|---|---|---|---|
| D1 | OpenCode 일반 응답 진행은 `생각 중`. 준비·예약·마무리 대기 상태와 Claude 라벨은 유지 | ACTIVE | 사용자 문구 + 기존 activityLabel 상태 |
| D2 | native command envelope를 `/command args` 표시로 복원. UUID·인수·원본 파일 보존 | ACTIVE | 제공 예시와 실제 JSONL 일치 |
| D3 | 세션 native commands를 컴포저 후보·강조의 정본으로 사용 | ACTIVE | 사용자의 활성 상태 확인 |
| D4 | 스킬 탭은 설치된 native plugin 스킬을 활성 여부와 함께 읽기 전용으로 제공 | ACTIVE | 상태 패널과 설치 인벤토리의 일치 |
| D5 | 일반 사용자 XML·불완전 래퍼는 보존. 자동 입력의 origin·기본 숨김 정책 유지 | ACTIVE | map.ts·turns.ts 기존 계약 |

갱신 메모: ACTIVE 결정 ↔ AC 대조: D1→AC1·2, D2→AC3·4, D3→AC5·6, D4→AC7, D5→AC4·8, 충돌 0.

## 4. 요구 비판적 검토

| 발견 | 관측 | 판단 |
|---|---|---|
| 복원만 원문 노출 | mapClaudeHistory가 input.echo.text를 그대로 복사 | 표시 투영에서 완전한 명령 래퍼만 해석 |
| 이미 저장된 snapshot 재사용 | native-history의 동일 revision은 unchanged | 투영 버전을 sourceKey에 포함해 기존 사본 재생성 |
| 활성 세션과 전역 목록 불일치 | ComposerInputController는 useSkills만 사용, native.view는 +메뉴에만 전달 | 기존 native 상태 구독을 후보·강조에도 사용 |
| 스킬 탭에서 전역 비활성 설치 누락 | readSkillCatalog가 includeDisabled=false로 호출 | 인벤토리 조회는 설치 목록, 실행 가능성은 세션 commands |

## 5. 동작 / 상태

| 시작 | 결과 |
|---|---|
| OpenCode 응답 시작/완료 | `생각 중` / 기존대로 스피너 제거 |
| 재시작 후 이전 command JSONL 로드 | slash 입력과 인수 표시, 원본 byte 불변 |
| native 플러그인 활성/비활성 관측 | 자동완성·강조 후보 추가/제거, 초안·caret 유지 |
| 스킬 탭 재진입 | 현재 설치 인벤토리 재조회, 자동 전송 없음 |
| malformed XML / 사용자 인용 | 원문 표시 |
| 자동 시스템 입력 | origin 유지, 기본 숨김·옵션으로 보기 유지 |

## 6. 범위

표시 투영·기존 native 목록의 소비·설치 인벤토리 조회가 범위다. SDK 호출 방식, 저장 원본, 플러그인 설치·활성 설정, IPC shape·DB schema는 변경하지 않는다.

## 7. Requirements / Acceptance

| R / AT / AC | 관측 기준 | 직접 oracle |
|---|---|---|
| R1 / AT1 / AC1 | OpenCode 응답 진행의 표시·접근성 라벨이 `생각 중` | StatusLine.harness.test + TranscriptView.harness.test |
| R1 / AT1 / AC2 | Claude 동사·준비 단계·예약 대기 라벨 보존 | StatusLine.harness.test |
| R2 / AT2 / AC3 | 예시 command wrapper가 `/superpowers:using-superpowers 이 스킬이?`로 복원 | native-history-map.test + native-history.test |
| R2 / AT2 / AC4 | 빈/여러 줄 인수·UUID·원본 보존, 일반/인용/불완전 XML 무변경 | native-command-text.test + native-history-map.test |
| R3 / AT3 / AC5 | 전역에 없는 세션 명령이 자동완성·강조에 나타남 | Composer.native-menu.test (실제 controller·decoration·autocomplete) |
| R3 / AT3 / AC6 | native empty 성공 시 제거, 다른 세션/하네스 혼입·초안 손실 없음 | composerSkills.test + Composer.native-menu.test |
| R4 / AT4 / AC7 | 전역 비활성 native plugin도 설치 스킬 조회에 포함, native enabled 값 보존, 조회 시 새 설치 반영 | skill-catalog.test (실제 파일+IPC) |
| R2 / AT2 / AC8 | 자동 입력 출처·기본 숨김 유지, 수기 XML을 자동 입력으로 재분류하지 않음 | native-history-map.test + UserMessage.origin.test + turns.test |

## 7-A. V / Trace Matrix

모든 아래 노드는 NEW다. 기존 V를 상속하지 않는다. AT1~4는 §7의 AC 묶음이며 SD1=재시작/상태변경 수명주기, AR1=이력 투영, AR2=세션 목록→입력 UI, AR3=파일→스킬 IPC, MD1=명령 파서, MD2=후보 합성이다.

| Pair | left ↔ right | requiredness | production path | 직접 oracle / 강제 지점 |
|---|---|---|---|---|
| VP1 | R1 ↔ AT1 | REQUIRED | PendingAssistantStatus → StatusLine → common status | TranscriptView.harness.test + StatusLine.harness.test / EP1 |
| VP2 | R2 ↔ AT2 | REQUIRED | native JSONL → select/map → user text parts | native-history.test + native-history-map.test / EP2 |
| VP3 | R3 ↔ AT3 | REQUIRED | native view → controller → autocomplete/decoration | Composer.native-menu.test / EP3 |
| VP4 | R4 ↔ AT4 | REQUIRED | plugin registry → catalog → skills:list | skill-catalog.test / EP4 |
| VP5 | SD1 ↔ ST1 | REQUIRED | old snapshot→reopen; native observation→candidate refresh | native-history.test + Composer.native-menu.test / EP2·3 |
| VP6 | AR1 ↔ IT1 | REQUIRED | readClaudeNativeHistory → mapClaudeHistory | native-history.test / EP2 |
| VP7 | AR2 ↔ IT2 | REQUIRED | useNativeResources → controller → candidate consumers | Composer.native-menu.test / EP3 |
| VP8 | AR3 ↔ IT3 | REQUIRED | readSkillCatalog → scanSkills → handler | skill-catalog.test / EP4 |
| VP9 | MD1 ↔ UT1 | REQUIRED | native command string → display text | native-command-text.test / EP2 parser |
| VP10 | MD2 ↔ UT2 | REQUIRED | catalog + native snapshot → suggestion list | composerSkills.test / EP3 projection |

全 pair의 적대 증거: not selected — 직접 행동 결과·구별 입력을 단언한다. 구조 proxy 테스트를 바꿀 경우 기존 범위의 행동 테스트로 대체한다.

# Part II — Technical Design

## 8. Research

| 대상 | 검색 | 관측 |
|---|---|---|
| command tags | `rg 'command-message\|command-name\|command-args' app/src` | 처리 없음 |
| 실제 이력 | 사용자 예시 문자열을 native JSONL에서 검색 | text string, isMeta/origin 없음, command-name·message·args 일치 |
| 설치 | installed_plugins.json + settings enabledPlugins | superpowers 설치됨, 전역 false |
| 상태 소비 | `rg 'knownSkillNames\|native.view\|useSkillAutocomplete' app/src/renderer/src/features/chat` | controller 한 곳, decoration/autocomplete 두 소비자 |

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 라벨 | 모든 하네스 random verb | registry가 OpenCode streaming 번역 키 주입 |
| 이력 | raw echo를 표시 파트로 복사 | Claude 전용 순수 parser를 이력 투영에서 적용 |
| 재시작 | byte revision만 같으면 이전 투영 재사용 | sourceKey에 projection revision 포함 |
| 컴포저 | 전역 캐시만 autocomplete/highlight | 세션 native commands + 허용된 공통 스킬 합성 |
| 인벤토리 | enabled native 설치만 부팅 스캔 | 설치된 native 스킬 + enabled metadata, 목록 요청 시 재조회 |

native 형식은 Claude adapter에 둔다. 공통 renderer는 native syntax를 해석하지 않고 기존 데이터 계약만 소비한다.

## 10. 계약 / 타입 / 강제 지점

| EP / pair | 계약 | SSOT | 언제 강제 (자리) | 자리 검색 | 실패 의미 |
|---|---|---|---|---|---|
| EP1 / VP1 | harness별 streaming label | status registry | PendingAssistantStatus의 backend→StatusLine; StatusLine→common label (2) | `rg -n 'backend=\|statusSpinner\|statusLabel' app/src/renderer/src/features/chat/components/transcript/PendingAssistantStatus.tsx app/src/renderer/src/features/chat/components/StatusLine.tsx app/src/renderer/src/features/chat/harnesses/common/transcript/StatusLine.tsx` | OpenCode 영문·다른 상태 오표시 |
| EP2 / VP2·5·6·9 | native command display | Claude adapter | read의 sourceKey/unchanged; read→map; map input.echo text; parser (4) | `rg -n 'sourceKey\|unchanged\|mapClaudeHistory\|text: event.text' app/src/main/adapters/claude/native-history*.ts` (PowerShell은 디렉터리+glob 사용) | 기존 snapshot 미갱신·본문/인수 손실 |
| EP3 / VP3·5·7·10 | session command membership | native.view.commands | useNativeResources→candidate projection; projection→autocomplete; projection→knownSkillNames→decoration (3) | `rg -n 'native.view\|knownSkillNames\|useSkillAutocomplete' app/src/renderer/src/features/chat -g '*.tsx' -g '*.ts'` (test 제외) | 세션 활성 명령 누락·비활성 잔존 |
| EP4 / VP4·8 | installed native inventory | plugin registry/catalog | plugin files→scan enabled; readSkillCatalog→scan; skills:list→refresh (3) | `rg -n 'filesByName\|files: \|enabled:\|scanSkills\|skillsList' app/src/main/adapters/claude/plugin-catalog.ts app/src/main/features/extensions/common/skills/scan.ts app/src/main/app/skill-catalog.ts app/src/main/app/handlers/skills.ts` | 비활성 설치 누락·활성 상태 왜곡·목록 stale |

## 11. 구현 설계

- `native-command-text.ts`: 전체 문자열이 command-message/name/optional args의 완전한 래퍼일 때만 해석. name은 slash token, message와 이름 일치. args 내부 문자·줄바꿈 유지, HTML로 실행하지 않는다.
- `native-history-map.ts`: input.echo 표시만 변환. live receipt·origin 입력은 원문 유지.
- `native-history.ts`: source hash의 projection revision으로 재투영을 유도하며 원본 bytes hash와 cursor append 검증은 유지.
- `composerSkills.ts`: suggestion을 SkillInfo의 표시 필드 Pick으로 정의. 공통/하네스 파일 스킬과 native commands를 정확한 이름으로 합치고 native plugin의 호출 가능성은 세션 목록으로 판정.
- controller·autocomplete·skillGroups: 같은 suggestion 타입을 사용, 빈 body/가짜 파일 경로를 만들지 않는다.
- plugin catalog explicit files에 선택적 enabled를 전달하고 scan은 해당 metadata를 사용. 글로벌 목록은 설치된 user/managed 범위만 유지, unrelated project 설치는 기존대로 제외.
- skills:list는 refreshSkills를 await한다. 반복 동시 요청의 병합이 필요하면 bootstrap refresh에서 처리하되 별도 캐시 정책은 도입하지 않는다.

## 12~15. End-to-end / Lifecycle / 성능 / 외부 계약

기존 IPC shape·원본 저장·runtime 권한은 유지한다. 자동 입력은 origin 기반으로 숨기며 알려지지 않은 XML은 삭제하지 않는다.
목록 갱신 실패는 기존 IPC 오류 경로를 따른다. 세션 전환의 지각 응답 처리는 NativeResourceState를 그대로 사용한다.
새 네트워크 요청·의존성·다중 저장소 쓰기 없음. 로컬 스킬 조회 때만 기존 설치 루트를 다시 읽는다.

## 16. 기존 규칙

native SSOT·하네스 격리·renderer 4-layer·기존 토큰/primitive 유지. design-components의 StatusLine·ComposerDecorationLayer를 재사용한다.

## 17. 리스크

완전한 command envelope를 사용자가 직접 입력한 경우 native 구조와 구별 불가하므로 인용·부분 문자열은 보존하며 완전 구조만 slash로 복원한다. 프로젝트 활성 상태는 글로벌 설치 목록의 enabled와 다를 수 있으므로 컴포저는 항상 세션 commands를 사용한다.

## 18. 문서

adapters.md와 persistence.md의 현재 동작을 수정한다. 컴포넌트 신설/이동·시각 스타일 변경은 없다.

## 19. 게이트

`npm run lint`, `npm run typecheck`, 관련 비-DB vitest, doc inventory·git diff/trailer 확인. 실제 설치본 재시작 시각 인수는 사용자 환경에서 후속 확인하며 기계적인 표시 변환과 session 업데이트는 직접 테스트한다.

## READY self-review

READY — Decision↔AC 충돌 0, producer/consumer 경로·상태표·자리별 테스트 설계 확인. §10은 파일/심볼 검색으로 고정하고 구현 보고에 재실행 관측을 남긴다. UI 구조·원본 쓰기·신규 공개 계약 없음.

## ΔV1 — 원본 식별과 표시 버전 분리

READY — `native-sync.ts`의 sourceKey 변경은 저장 경로 이전으로 판정하므로 §4·9·11의 sourceKey 버전 계획을 대체한다. 원본 식별은 유지하고 adapter 소유 checkpoint에 `projectionVersion`을 추가하여 이전 cursor만 재투영한다.

| 대체 노드/pair | 변경 | oracle / 강제 지점 |
|---|---|---|
| SD1→SD1a / VP5→VP5a | 원본 경로 유지 + 구 표시 cursor만 무효화 | native-history.test의 구 cursor 재조회 → sourceKey 동일·본문 slash·다음 조회 unchanged |
| AR1→AR1a / VP6→VP6a | unchanged 조건에 projectionVersion 확인 | EP2의 sourceKey/unchanged 자리를 checkpoint/unchanged로 대체, 나머지 자리 유지 |

SD1a·AR1a는 CHANGED이며 VP5a·VP6a는 REQUIRED다. AC3·4와 EP2의 전체 증거를 승계하며 선택 변이는 없다. R2·VP2는 INHERITED/REGRESSION으로 재실행한다. 자리 검색에 `projectionVersion`을 추가한다. 공개 IPC·원본 파일·DB schema 변경은 없으며 기존 adapter-owned Record checkpoint 안의 metadata다.

ACTIVE 결정 ↔ AC 재대조: 충돌 0. 원본 SSOT와 기존 저장 경로 보호 계약을 모두 유지한다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1 + ΔV1의 표시 전용 변경과 세션 명령 SSOT를 구현했다.
- 이견 / 현실성 문제: §4·9·11의 sourceKey 변경은 `native-sync.ts`에서 migration-required를 만들므로 구현 전에 ΔV1 설계 커밋으로 정정했다.
- ACTIVE Decision과 충돌하는 설계 발견: D2의 원본 식별 보존과 충돌하던 부분을 checkpoint.projectionVersion으로 해소했다. 나머지 결정은 유지했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래 경로는 `app/src/` 기준이다. 검색은 §10 명령을 재실행하되 테스트 파일을 제외하고, EP2에 `projectionVersion`·`nativeCommandText`를 포함했다. 검색 결과의 타입 선언·import·+메뉴 소비는 실행 자리와 구분했다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP1 | EP1 streaming label | PendingAssistantStatus→wrapper; wrapper→common (2) | 2/2 | `rg -n 'backend=\|statusSpinner\|statusStreamingLabel\|streamingLabelKey'` → backend:39, wrapper:15, common:117; `TranscriptView.harness.test:uses the harness spinner on each pending transcript path`; `StatusLine.harness.test:renders the OpenCode grid with stable animation and accessible status` | backend=opencode/claude → 표시·aria-label의 생각 중/Claude 동사 구별 | 없음 |
| VP2·5a·6a·9 | EP2 command display | checkpoint→unchanged; read→map; echo→text; parser (4) | 4/4 | `rg -n 'projectionVersion\|unchanged\|mapClaudeHistory\|nativeCommandText'` → native-history:174·255, map:199, parser:2; `native-history.test:reprojects a pre-command-display snapshot on restart without modifying native bytes`가 앞 3자리, `native-command-text.test:restores the slash command and preserves arguments`가 parser 관측 | 구 checkpoint + XML snapshot → 같은 sourceKey·slash 본문·다음 unchanged; 빈/여러 줄 인수 → 문자 보존 | 없음 |
| VP3·5a·7·10 | EP3 session membership | native hook→합성; 합성→자동완성; names→surface→decoration (3) | 3/3 | `rg -n 'native.view\|knownSkillNames\|useSkillAutocomplete\|composerSkills'` → controller:149·212·383, surface:101, decoration:36; `Composer.native-menu.test:reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft` | 명령 없음→superpowers→없음 push → 실제 option·강조 추가/제거, 초안 동일, send 미호출 | 없음 |
| VP4·8 | EP4 installed inventory | plugin files→scan enabled; catalog→scan; list→refresh (3) | 3/3 | `rg -n 'filesByName\|files: \|enabled:\|scanSkills\|skillsList\|refreshSkills'` → catalog files:202, scan:78, app catalog:29, handler:38; `skill-catalog.test:assembles the real catalog from lock, harness and native plugin files without exposing other installations` | snapshot 후 전역 true→false + 새 파일 → IPC 결과에 기존/신규 항목과 enabled=false·canToggle=false | 없음 |

- 자리 대조: §10의 EP1 두 자리·EP2 네 자리·EP3 세 자리·EP4 세 자리를 위 검색 출력과 개별 대응했다. 목록−관측, 관측된 계약 실행 자리−목록 모두 빈 집합이다. 닫은 자리 12/12.
- §10 자리 목록 밖에서 본 운반 자리: 기존 native +메뉴는 같은 view를 별도로 소비하며 변경하지 않았다. 그 메뉴의 로드·삽입·재접속 테스트도 재실행했다.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 — 최초 구현.

**V-pair 자기확인** — 구현자 자기 결과이며 독립 검증 결과가 아니다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP1 | REQUIRED | SELF_PASS | StatusLine.harness.test + TranscriptView.harness.test, 위 EP1 테스트 | not selected — 표시·접근성 값 직접 관측 |
| VP2 | REGRESSION | SELF_PASS | native-history-map.test:restores skill command string/blocks without changing raw entries or provenance | not selected — 원문·출처·본문 직접 관측 |
| VP3 | REQUIRED | SELF_PASS | Composer.native-menu.test:reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft | not selected — 실제 option·장식 노드 관측 |
| VP4 | REQUIRED | SELF_PASS | skill-catalog.test:assembles the real catalog from lock, harness and native plugin files without exposing other installations | not selected — 실제 파일과 IPC 결과 관측 |
| VP5a | REQUIRED | SELF_PASS | native-history.test:reprojects a pre-command-display snapshot on restart without modifying native bytes; Composer.native-menu.test 위 갱신 테스트 | not selected — 구 snapshot·live 변경 결과 관측 |
| VP6a | REQUIRED | SELF_PASS | native-history.test 위 재투영 테스트 | not selected — reader 반환 본문·sourceKey·다음 unchanged 관측 |
| VP7 | REQUIRED | SELF_PASS | Composer.native-menu.test 위 갱신 테스트 및 하네스별 로드·삽입·재접속 테스트 | not selected — bridge 이벤트부터 실제 UI까지 관측 |
| VP8 | REQUIRED | SELF_PASS | skill-catalog.test 위 파일+IPC 테스트 | not selected — enabled=false와 새 항목 관측 |
| VP9 | REQUIRED | SELF_PASS | native-command-text.test:restores the slash command and preserves arguments; preserves ordinary, quoted and incomplete XML | not selected — 구별 문자열 직접 관측 |
| VP10 | REQUIRED | SELF_PASS | composerSkills.test:uses session commands over global plugin flags and preserves allowed file skills 외 3개 | not selected — 허용·비허용 후보 결과 직접 관측 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| composerSkills.ts의 includeExtensions 조건을 true로 바꿈 | 기존 composerAttachMenu.test 구조 단언을 행동 테스트로 교체한 범위 | 최초 | Composer.native-menu.test:keeps Orca file skill autocomplete scoped to extension-enabled opencode inputs / 1건 실패, Claude 1건 통과 | 잠김 — OpenCode에 /local-skill이 잘못 나타남을 검출, finally에서 원본 bytes 복구 |

- 분모 검산: 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 필수 행 0. 교체 장치의 하한 확인을 위한 추가 행동 변이 1 = 표 행 1.
- 덮개 회귀: 삭제한 정규식이 요구하던 includeExtensions 경계를 위 행동 테스트가 검출한다. 다른 pair는 해당 없음 — 직접 oracle. 직전 verify의 red 변이는 없다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | OpenCode registry→공통 StatusLine의 화면과 aria-label에서 생각 중 관측 | 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 자원 수명주기 재배치 없음. 순수 문자열·목록 합성만 추출 | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 불완전 XML 원문 보존, native 비활성 후보 제거 행에 대응 | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 기존 native loading/error UI·스킬 IPC 오류 경로 유지. 후보가 없을 때 전역 plugin 후보를 되살리지 않음 | loading/error 후보 테스트 통과 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 기존 NativeResourceState의 session/scope 격리 사용 | useNativeResources.test 회귀 통과 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | sourceKey에 표시 버전을 넣으면 기존 대화가 경로 이전으로 판정됨 | 설계 정정 후 구현 | native-sync.ts migration-required 분기; ΔV1의 동일 sourceKey 테스트 통과 |
| 2 | 전역 목록만 갱신하면 이미 켜진 세션의 plugin 누락이 지속됨 | 선조치 — native.view를 자동완성·강조 모두에 전달 | 실제 controller·surface를 통한 변경 이벤트 테스트 통과 |
| 3 | 사용자가 완전한 native envelope를 직접 타이핑하면 생성 주체 구별 불가 | 보고만 — §17의 기존 한계 | 일반·인용·부분 XML은 그대로 보존하는 7케이스 통과 |
| 4 | 목록 조회마다 설치 파일을 다시 읽음 | 보고만 — 신규 캐시 정책 없이 기존 refresh 사용 | 새 설치를 즉시 반영하는 IPC 테스트 통과; 대규모 설치 성능 실측은 하지 않음 |

### 설계 대비 명시적 차이

- 유효 V1 + ΔV1 대비 차이 없음. 최초 sourceKey 방식은 구현 전에 별도 설계 커밋으로 교체했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 유효 설계와 동일, 시간 기반 만료 없음 | AC3·EP2: 구 checkpoint 재투영 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — adapter checkpoint 안에 저장 | AC4·EP2: sourceKey·원본 bytes 동일 |
| 재진입 | 해당 없음 — 유효 설계대로 같은 버전은 재사용 | AC3·EP2: 후속 read unchanged |
| 다른 무효화 축 | 해당 없음 — 원본 revision·경로 검사는 유지 | native-history.test의 append·cwd 격리 회귀 통과 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Claude native history/parser·plugin catalog, skills scan/IPC, composer 후보 합성·소비자, 상태 라벨·번역, 직접 테스트, adapters/persistence 문서 |
| 실행 명령 | app에서 `npm run lint`, `npm run typecheck`; `node node_modules/vitest/vitest.mjs run --maxWorkers=2`로 아래 범위; `node scripts/check-doc-inventory.mjs --check`; `git diff --check` |
| 관측한 게이트 산출 | 관련 56파일/399케이스 통과. typecheck node/web/test 3구성 통과. lint 오류 0·기존 TanStack Virtual 경고 2. 문서 inventory/prose 통과, 기존 ignored .tmp/opencode-dev의 링크 5건 실패; .tmp 제외 링크 검사 0건 |
| V-pair 자기확인 | SELF_PASS 10 / SELF_BLOCKED 0; 위 표 참조 |
| 강제 지점 전수 | 12/12, 자리별 직접 관측은 위 표 |
| AC 자기보고 (Criteria-Met) | 8/8, 아래 AC별 관측 참조 |
| 합계 검산 | ✅ 8 · ⚠️ 0 · ❌ 0 = 총 8; §7 AC1~8을 다시 대조, 분모 변경 없음 |
| 블로커 / 역질문 | 없음. 실제 설치본 재시작·OS caret 시각 실기는 미실행이며 독립 검증 대기 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기 결과 | 이번 턴의 직접 관측 |
|---|---|---|
| AC1 | ✅ | StatusLine 화면·aria-label 및 transcript pending 3경로에서 생각 중 |
| AC2 | ✅ | Claude 동사·OpenCode 준비·예약 대기 라벨 유지 |
| AC3 | ✅ | 예시 string/block XML 및 구 snapshot이 `/superpowers:using-superpowers 이 스킬이?`로 복원 |
| AC4 | ✅ | 인수 4형태 보존, 일반/인용/불완전 XML 7형태 불변, UUID·원본 파일 불변 |
| AC5 | ✅ | 전역 목록 없이 세션 superpowers 이벤트로 실제 자동완성 option·강조 생성 |
| AC6 | ✅ | 빈 성공 응답으로 option·강조 제거, 초안 동일; Claude/OpenCode 파일 후보 격리 |
| AC7 | ✅ | 부팅 snapshot 후 비활성 plugin과 신규 파일이 skills:list 결과에 enabled=false로 포함 |
| AC8 | ✅ | command는 사용자 출처 유지, isMeta 입력의 automatic origin 유지; UserMessage.origin·turns 회귀 통과 |

관련 vitest 범위: Claude native-command-text/native-history-map/native-history/adapter.native-history/plugin-catalog/native-resources/configured-resources/map.received; app skill-catalog/handlers.session-resources; skills scan; 공통 composer 디렉터리; StatusLine.harness/statusLine.render/TranscriptView.harness/UserMessage.origin; composerSkills/skillGroups/turns/useNativeResources; i18n resources; shared extension-sources.

환경 분리: 넓은 탐색 실행은 DB settlement.integration 5건 실패 후 중단했으며 완료 결과에 포함하지 않았다. 설치된 better-sqlite3는 Electron ABI 140, 현재 Node는 ABI 127을 요구하는 서명을 직접 확인했다. ABI를 바꾸지 않고 위 비-DB 범위를 완료했다. lint --fix가 건드린 무관한 chat-turn.execution-config.test.ts 포맷은 원상 복구했다.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 최초 구현으로 이전 라운드 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: sourceKey의 기존 저장 경로 의미를 설계 초안에서 놓쳤고, native-sync 호출부 조사 후 ΔV1으로 정정했다.
- 반복해서 부딪히는 환경 한계: Electron/Node SQLite ABI 차이, ignored upstream scratch 디렉터리의 문서 링크 실패. 변경 관련 테스트와 분리했다.
- 현재 라운드·impl 턴: r1 / r1. 다음 주체는 Claude 독립 검증이다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **PASS**. 파생 이슈 없음.
