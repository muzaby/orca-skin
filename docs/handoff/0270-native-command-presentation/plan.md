# Plan — 0270-native-command-presentation

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex (사용자 직접 수정 요청) / 2026-10-21 |
| 상태 | READY |
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
