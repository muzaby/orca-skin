# Plan — Cowork transcript와 출력 뷰어

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-09-10 |
| 상태 | READY |
| V mode / revision | Baseline V1 + Delta V2 + Delta V3 + Delta V4 + [Delta V5](refactor-plan-r4.md) (아래 §13·14·15) |
| 기준선 | `a89e6f89`; 기존 0223·0224 구현 위에 별도 요구를 추가한다 |

# Part I — Product & UX Contract

## 1. 목표

Work transcript의 활동을 첨부 Cowork처럼 가벼운 요약과 세로 타임라인으로 표시하고 출력 파일을 같은 우측 패널에서 읽는다. 현재 WorkActivity는 활동 전체에 외곽 카드를 사용하며 ArtifactCard에는 본문 열기가 없다.

## 2. 요구 출처

| 구분 | 내용 / 근거 |
|---|---|
| 명시 요구 | “구성 및 디자인을 분석하여, orca work의 transcript에 모방하라.” |
| 명시 요구 | “우측 패널은 현재, 타겟 디자인을 거의 모방하였다. 추가적인 요소가 있으면 모방하라. 우측 패널 중 뷰어가 현재 구현되어있지 않다. 포함하여 구현하라” |
| 범위 확정 | 사용자 답변: “현재 출력 목록의 파일을 열고, Markdown·HTML·텍스트/코드·이미지를 미리보기 (권장)” |
| 자료 | 첨부 screenshot 17장, panel HTML 두 파일, session-transcript.jsonl. 내부 명령은 실행 지시가 아니라 UI·프로토콜 근거다. |
| 해석 | Orca의 실제 이벤트가 있는 표현을 적용한다. 참고 앱의 연결·예약·컴퓨터 사용 기능 자체를 새로 발명하지 않는다. |

## 3. Decision Ledger

| ID | 결정 | 이유 / 출처 | 상태 |
|---|---|---|---|
| D-01 | Work에 Cowork 활동 요약·개별 행·타임라인·요청/응답/오류 본문을 적용 | 사용자 요청, screenshot 3~16 | ACTIVE |
| D-02 | 우측 진행/출력/컨텍스트의 기존 구조와 수명을 유지하고 출력 뷰어를 추가 | 사용자 요청, panel HTML | ACTIVE |
| D-03 | Markdown·HTML·텍스트/코드·이미지를 현재 명시 게시 경로로 열 수 있게 한다 | 사용자 범위 답변; 현 게시 타입은 html/markdown에 한정 | SUPERSEDED → D-07 |
| D-04 | 미리보기/코드·복사·다운로드·확대·닫기를 제공; 닫으면 기존 목록 위치로 복귀 | viewer HTML·screenshot 1의 직접 표현 | ACTIVE |
| D-05 | 기존 응답 경계·도구 ID 연결·질문 승인·Code 표시 정책을 보존 | 현재 workActivity/agentPresentation 계약 | ACTIVE |
| D-06 | ID 기반 소유권 확인과 제한 읽기를 유지; HTML은 격리된 정적 미리보기 | 기존 artifact 보안 경계 + 새 뷰어의 문서 표시 목적 | ACTIVE |

갱신 메모: D-01~06을 AC1~8과 대조했다. ACTIVE 결정 간 충돌은 없으며 0223의 일반 생성물 자동 수집 Q-04는 본 작업에서 결정하지 않는다.

## 4. 요구 비판적 검토

| 판단 | 관측 |
|---|---|
| 스타일만으로는 부족 | WorkActivity→AssistantSegment→ToolGroup가 기존 Code 상세 본문을 공유한다. Work용 본문 투영이 필요하다. |
| 우측 목록은 재사용 가능 | TaskPanelContent가 숨긴 overview를 mounted·inert로 유지하고 복귀 시 스크롤·포커스를 복원한다. |
| 파일 읽기 계약 필요 | artifact IPC는 list/status/save/reveal/trash/openFolder이며 본문 DTO가 없다. |
| 게시 포맷 확장 필요 | shared/artifacts.ts와 0021_artifacts.sql의 kind가 html/markdown이고 files.ts는 전체 UTF-8 검증이다. |
| 실제 데이터만 표시 | 첨부 JSONL의 도구 호출/결과는 ID로 연결해야 하며 행 하나를 대화 메시지 하나로 간주할 수 없다. |

## 5. 사용자 흐름과 상태

| 시작 / 이벤트 | 동작 | 결과 |
|---|---|---|
| Work 응답 | 기존 경계로 도입·활동·마무리를 투영 | 요약을 펼치면 순서대로 도구 행과 중간 메모 표시 |
| 도구 행 펼침 | input/result를 요청·응답 영역에 표시 | 긴 본문은 제한 높이 내부 스크롤, 실패는 오류색 |
| 출력 클릭 | 선택 ID로 Main 본문 조회 | 같은 패널에 로딩 후 미리보기 표시 |
| 코드 전환 | 받은 텍스트를 줄번호·구문색으로 표시 | Markdown/HTML 원문 및 텍스트/코드 읽기 |
| 복사 / 다운로드 | 텍스트 클립보드 / 기존 저장 IPC | 완료·실패를 명확히 표시; 이미지는 다운로드 제공 |
| 확대 / 닫기 | 확대 뷰 또는 원래 패널 / overview 복귀 | 목록의 접힘·스크롤을 유지하고 실행한 항목으로 초점 복귀 |
| 누락·권한·크기·인코딩 오류 | 본문 대신 오류와 다시 시도 | 이전 파일 본문을 새 파일로 오인하지 않음 |
| 세션 이동·빠른 파일 전환·닫기 | 현재 요청 수명 밖 응답 폐기 | 늦은 응답이 화면을 되돌리지 않음 |

두 테마의 시맨틱 토큰과 키보드 동작을 적용한다. HTML은 앱 권한·네트워크·스크립트를 갖지 않는 iframe 미리보기로 읽으며 원문은 코드 탭에서 보존한다.

## 6. 범위

범위는 Work 활동 스타일/요약/본문, 실제 검색 결과가 있을 때의 검색 목록, 출력 카드 시각 보완, 명시 게시 포맷 확장, ID 기반 뷰어다. PDF·오피스 내장 렌더링, 일반 파일 자동 수집, 새 예약/커넥터/컴퓨터 기능, 원본 JSONL 가져오기 제품 기능은 비범위다.

## 7. Requirements / Acceptance

| R / AT / AC | 동작 기준 | 검증 수단 | production path |
|---|---|---|---|
| R1 / AT1 / AC1 | Work 활동은 무테 요약과 아이콘·세로선 도구 행으로 표시하고 호출 수를 센다 | 투영/렌더 테스트 + native 시각 | TranscriptView→WorkActivity→Work 도구 행 |
| R2 / AT2 / AC2 | 펼친 도구에 요청/응답/오류가 구분되고 긴 내용·JSON·실제 검색 결과를 읽는다 | 순수 분류·payload tests + native 스크롤 | ToolCall→Work 본문 |
| R3 / AT3 / AC3 | 출력 행과 transcript 출력 카드에서 뷰어를 열고 닫아 원위치로 복귀한다 | 실제 React callbacks + native | ArtifactCard→선택 상태→TaskTileContent→viewer |
| R4 / AT4 / AC4 | Markdown/HTML은 미리보기와 줄번호 코드, 텍스트/코드는 코드, 이미지는 이미지로 표시한다 | 포맷/실파일 통합 + native | 게시→DB→preview IPC→viewer |
| R5 / AT5 / AC5 | 텍스트 복사·개별 다운로드·확대·닫기·재시도를 실행한다 | callbacks/native·기존 저장 tests | viewer→clipboard/artifactSave |
| R6 / AT6 / AC6 | 다른 세션·임의 경로를 읽지 못하며 크기/인코딩 제한·격리 HTML을 유지한다 | 소유권·경로·파일형식·iframe tests | preview handler→ArtifactService→safe file read |
| R7 / AT7 / AC7 | 전환·닫기 후 지각 응답을 버리고 선택한 파일 오류를 구분한다 | deferred response/native | selection→request lifetime→render |
| R8 / AT8 / AC8 | 응답 경계·늦은 도구 결과·질문 승인·Code·기존 게시/저장/복원은 유지한다 | 기존 의미 테스트와 migration/native 회귀 | reducer/projector·Code·artifact persistence |

## 7-A. V / Trace Matrix

R1~R8와 AT1~AT8은 NEW다. 아래 SD/AR/MD와 대응 검증 노드도 모두 NEW이며 현재 코드의 유지 계약을 함께 검증한다.

| Pair | left ↔ right / requiredness | 경로 / 직접 oracle | §10 지점 |
|---|---|---|---|
| VP1~VP8 | R1~R8 ↔ AT1~AT8 / REQUIRED | §7 각 행의 실제 UI·파일 결과 | 해당 AC의 EP 합집합 |
| VP9 | SD1 ↔ ST1 / REQUIRED | 출력 선택→로딩→본문/오류→닫기/세션 이동; native에서 선택 제목·본문·복귀 관측 | EP2, EP3 (8) |
| VP10 | AR1 ↔ IT1 / REQUIRED | 게시 도구→DB→소유권→preview IPC→renderer; 실파일 bytes/type와 거부 결과 | EP4, EP5 (7) |
| VP11 | MD1 ↔ UT1 / REQUIRED | Work call→label/count/body; 반복 호출·미지 도구·오류·검색 형상 직접 단언 | EP1 (3) |
| VP12 | MD2 ↔ UT2 / REQUIRED | 확장자·bytes→format; 이미지 서명·UTF-8·크기·미지원 결과 | EP5 (3) |

선택 적대 증거: 없음. 표시 상태·콜백 결과·실파일 결과를 직접 관측하며 소스 문자열 개수만으로 배선을 증명하지 않는다.

| 운영 gate | 명령 / 적용 이유 |
|---|---|
| renderer/main 규칙 | `npm run typecheck`, ESLint 읽기 검사; 양 레이어와 preload/shared 변경 |
| 의미 회귀 | 관련 vitest 직접 실행; DB 검사는 ABI를 확인한 뒤 전용 실행 |
| native | 기존 Electron/Vite fixture 패턴으로 실제 React 렌더와 버튼·스크롤·테마 확인 |
| 산출물 | `git diff --check`, doc inventory 생성/검사, migration append-only 검사 |
| 메시지 버스 | 설계와 구현 커밋 분리, INDEX 상태 재확인, trailer 파싱 |

# Part II — Technical Design

## 8. 현재 코드와 계약

| 대상 | 근거 |
|---|---|
| Work 투영 | `app/src/renderer/src/features/chat/lib/workActivity.ts`: 경계·ID 기반 결과 결합·메시지 캐시 |
| Work 표현 | `components/transcript/WorkActivity.tsx`: ActivityDisclosure가 기존 AssistantSegment 사용 |
| Code 도구 | `components/transcript/ToolCard.tsx`, `ToolGroup.tsx`, `registry.ts` |
| 우측 수명 | `components/rightpanel/TaskPanelContent.tsx`, `TaskTileContent.tsx`, `TaskOutputContent.tsx` |
| 파일 저장 | `app/src/main/features/artifacts/{service,files,validation}.ts`, `infra/db/artifact-queries.ts` |
| 계약 경계 | `app/src/shared/{artifacts,ipc,protocol}.ts`, `app/src/preload/index.ts`, `app/handlers/artifacts.ts` |

전수 조사: 현재 artifact 본문 읽기 IPC 0, 기존 artifact 작업 채널 6, ArtifactCard 형상 2(card/list), 게시 kind 제약 2곳(TypeScript/SQL), 본문 UTF-8 검사 1곳(files.ts). 검색은 `rg artifact app/src/shared app/src/preload app/src/main/app/handlers`, `rg 'markdown|html' app/src/main/features/artifacts app/src/main/infra/db/migrations`로 수행했다.

## 9. Architecture — AS-IS → TO-BE

AS-IS: 정규화 parts→WorkProjector→기존 도구 그룹. 게시 도구→HTML/Markdown 파일 복사→publication→출력 metadata→저장/탐색기 동작이다.

TO-BE: 원문 parts와 projector의 경계는 유지하고 Work 전용 call presentation/body를 붙인다. 게시 계약은 text/image를 포함하고 출력 선택을 세션별로 보유하며 ID 요청으로 제한 본문 DTO를 받아 패널에서 렌더한다.

| 축 | AS-IS | TO-BE / 연결 |
|---|---|---|
| 표시 책임 | Code 도구 상세 공유 | Work 전용 행/본문; 질문·서브에이전트는 기존 전용 경로; VP1·2·11 |
| 상태 수명 | 선택 작업, overview 유지 | 선택 출력과 viewer 수명 추가; VP3·7·9 |
| 데이터 | metadata만 renderer 전달 | 경로 없는 bounded preview DTO; VP4·6·10 |
| 영속 | html/markdown CHECK | 새 migration으로 text/image 추가, 기존 FK·publication·fork 보존; VP8·10 |
| 오류 | 상태 조회와 저장 오류 | preview 오류·재시도·지각 응답 취소 추가; VP5·7 |

## 10. 구현 설계와 강제 지점

| EP | 불변식 / 언제 강제 | N | oracle / 실패 의미 |
|---|---|---:|---|
| EP1 | Work 요약·도구 행·도구 본문에서 순서/호출 수/상태를 표시 | 3 | 반복 호출·실패·미지 도구의 실제 결과; 잘못된 라벨/수/본문을 검출 |
| EP2 | 출력 목록 클릭·transcript 카드 클릭·닫기·세션 전환에서 선택을 처리 | 4 | 선택 파일 제목/본문과 복귀 초점; 진입 단절/다른 파일 표시 검출 |
| EP3 | 첫 읽기·빠른 전환·재시도·unmount에서 요청 소유권 유지 | 4 | deferred completion으로 최신 화면 유지; 지각 응답 회귀 검출 |
| EP4 | IPC schema·sender guard·service owner·읽기 후 owner 재검사 | 4 | 변조 요청/타 세션/삭제 시 거부; metadata 조회만의 성공은 증거 아님 |
| EP5 | 게시 입력 형식·파일 bytes·preview 변환에서 허용 형식/크기 보장 | 3 | 실제 텍스트/이미지·잘못된 서명·초과 파일; 확장자만 통과하면 실패 |

preview 계약: `window.orca.artifacts.preview(ArtifactTargetRequest): Promise<ArtifactPreviewResult>`. 성공은 `{state:'ready',format:'markdown'|'html'|'text'|'image',content:string,mimeType:string,language?:string,previewContent?:string}`, 실패는 `{state:'unavailable',reason:string}`이다. image content는 검증한 data URL이고 다른 content는 UTF-8 원문이며 HTML의 previewContent만 Main이 정제한 전체 문서다.

게시 형식: Markdown(.md/.markdown), HTML(.html/.htm), 텍스트/코드의 명시 allowlist, 이미지 PNG/JPEG/GIF/WebP/SVG. raster는 서명 검사, SVG는 이미지 모드로 표시하고 원문은 텍스트로 검사한다. 기존 5 MiB 읽기 상한과 경로 검증을 유지한다.

파일별 책임: shared/artifacts와 preload API/IPC는 타입·배선, artifacts feature는 포맷 판별·안전 읽기, migration은 기존 행/참조 보존, chat feature는 selection/viewer/UI 상태다. 정적 스타일은 Tailwind이며 새 라이브러리·범용 파일 접근 API를 만들지 않는다.

## 11. 구현 / 검증 순서

1. Work 표현과 payload 분류의 행동 테스트를 만들고 실패를 확인한 뒤 구현한다.
2. 별도 작업자가 게시 형식·preview 경계와 실파일/DB 회귀를 구현한다.
3. 별도 작업자가 출력 선택·뷰어·카드와 수명 검증을 구현한다.
4. root가 실제 React/Electron 통합·시각 확인, subtree gate와 문서 동기화를 수행한다.

## 12. READY self-review

READY: D-01~06→AC1~8 및 VP1~12 경로를 대조했다. 출력 2진입·요청 4수명·Main 4경계와 파일 3검사 지점을 표에 고정했고 기존 일반 생성물 정책을 덮어쓰지 않는다. 기존 API/라이브러리를 조사해 포맷 확장과 새 preview 채널 외의 공개 계약 변경은 없다.

## [구현자 기입] 설계 리뷰

유지: V1의 D-01~06·AC1~8·VP1~12와 강제 지점은 변경하지 않았다. 기존 `artifacts` preload namespace를 사용하고 HTML 정제는 Main의 기존 cheerio로 수행하도록 기술 가이드를 구체화했다. 원문 `content`는 코드·복사용으로 보존하며 별도 `previewContent`만 격리 iframe에 전달한다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

PASS 자기확인: VP1~VP12를 각각 아래 경로의 직접 결과로 확인했다. 강제 지점 검색은 `rg 'WorkTool|toolCount' app/src/renderer/src/features/chat`, `rg 'openArtifactViewer|closeArtifactViewer|readSelection|retryArtifactViewer' app/src/renderer/src/features/chat`, `rg 'preview|readForExport|validateArtifactBytes' app/src/main/features/artifacts app/src/main/app/handlers/artifacts.ts`로 수행했다.

| 지점 | 닫힘 | 실제 관측 |
|---|---|---|
| EP1 요약·행·본문 | 3/3 | 반복 호출 수, ID 순서, 구조화 Task 실패, 실제 검색·요청/응답을 helper/JSX/native에서 확인 |
| EP2 목록·카드·닫기·세션 | 4/4 | 두 카드 callback→선택 및 native 파일 제목·원래 초점·세션 전환 후 뷰어 소실 |
| EP3 첫 읽기·전환·재시도·unmount | 4/4 | deferred store 검사와 native retry/unmount/late-close 결과 |
| EP4 schema·sender·owner·ownerAfter | 4/4 | 변조 경로·신뢰하지 않는 sender·타 세션·읽기 중 삭제가 본문을 반환하지 않음 |
| EP5 입력·bytes·preview | 3/3 | 실파일 UTF-8/서명/상한, data URL, HTML 원문과 정제 문서의 분리 |

VP1·2·11은 Work 투영·본문 회귀와 native, VP3·5·7·9는 실제 진입 callback·수명 tests/native, VP4·6·10·12는 실파일·DB·IPC tests와 격리 프레임 DOM 관측으로 닫았다. VP8은 기존 채팅·질문·Code 및 게시·migration 회귀로 닫았다. native 46개 단언 PASS, 런타임 오류와 외부 요청은 모두 0이며 manifest의 현재 소스 hash 불일치도 0이다([증거](evidence/native-validation.json)).

## [구현자 기입] 이번 라운드 수정의 잠금

선택 적대 증거 없음. Work helper·반복 집계·이전 세션 callback·Task 구조화 실패는 RED→GREEN으로 확인했고, native에서 실제 DOM·스크롤·초점·코드 강조·격리 프레임을 관측했다. 구현 전 활동 외곽 카드, Wasm CSP 실패, 줄번호 누락은 실제 화면/실행으로 재현한 뒤 수정했다.

## [구현자 기입] Product/UX 파생 검토

PASS: 오류·로딩·빈 파일·재시도는 사용자 문구로 연결된다. 출력/대화 카드 양쪽 진입, 원래 항목 초점, 빠른 전환, 세션 이동, unmount를 확인했다. 실제 HTML의 body 배경이 전체 canvas를 채우고 Markdown·코드는 앱 테마에 맞게 표시되는 최종 화면을 확인했다.

## [구현자 기입] 놓친 잠재 문제 + 대응

수정 완료: 독립 코드 리뷰가 발견한 TaskXXX 구조화 결과 누락과 HTML/body 속성 유실을 닫았다. 추가로 HTML 기본 root 배경의 body canvas 전파 방해를 수정하고 native 전체 프레임에서 확인했다. 자세한 원인과 대응은 [구현 보고](impl.md#구현-중-발견과-수정)에 기록했으며 남은 PLAN_GAP은 없다.

## [구현자 기입] 구현 보고

완료: AC1~8 자기확인 8/8, EP1~5 전수 18/18, VP1~12 PASS. 채팅/Markdown 1,255개·파일/DB 110개·운영 스크립트 116개 tests와 타입·빌드·lint·문서·migration gate를 통과했다. [구현 보고](impl.md)와 [시각·native 증거](evidence/native-validation.json)를 남기고 `impl/IMPL_DONE`으로 넘긴다.

## [구현자 기입] Review Signals

신규 handoff r1. 기존 0223 Q-04와 0224 독립 검증 상태는 유지한다. Native의 opaque HTML frame은 별도 renderer target이므로 CDP target에 연결해 DOMSnapshot으로 읽었으며 sandbox 권한을 늘리지 않았다. 구현자 자기확인과 외부 코드 리뷰는 정식 handoff verify를 대체하지 않는다.

## 13. Delta V2 — 공통 패널·출력 카드·경로 프로젝트

READY (2026-09-10). 기준 V는 `fde5557dedc516ddf09d308b71cc7495cc3ea43f`의 본 문서 V1이다. V1 이후 사용자가 핸드오프 없이 요청했던 변경은 이 커밋의 코드·테스트를 현재 기준으로 승계하며, 이번 사용자의 “핸드오프 작업을 이어서 하겠다”에 따라 r2를 설계한다.

### 13.1 결정 복원과 변경

아래 결정은 충돌하는 V1 본문보다 우선한다. 이전 응답 경계의 데이터 보존(D-05)과 보안(D-06)은 유지하며 표시 정책·출력 수집 비범위만 명시적으로 대체한다.

| ID | 결정 / 출처 | 상태 | AC |
|---|---|---|---|
| D-07 | 일반 출력과 게시 아티팩트를 구분한다. `/tmp/<파일이름>`의 최종 일반 출력, Composer 첨부의 `/tmp` 사본·컨텍스트, 메모의 독립 표시 등 이전 사용자 피드백은 `fde5557d` 구현을 유지한다. | ACTIVE; D-03 및 V1 일반 수집 비범위 대체 | AC10·11 |
| D-08 | “뷰어 패널의 좌측에 핸들바를 배치하여 사이즈 조절”; Transcript와 아티팩트 페이지는 같은 패널 소스·기능을 재사용한다. | ACTIVE | AC9 |
| D-09 | “transcript의 우측패널의 펼치기 버튼 클릭시 transcript 전체만큼”; viewer와 기존 작업 타일 확대는 현재 대화 pane 전체를 채운다. 닫기·복원은 원래 폭·초안·스크롤을 유지한다. | ACTIVE | AC9 |
| D-10 | 일반 출력도 Transcript 카드로 표시한다. 게시 카드의 타이틀 하단은 “아티팩트”만; 카드/우측 출력에서 보관 폴더 열기·메뉴 상단 파일 메타·하단 성공 안내를 제거한다. | ACTIVE; V1 완료 안내의 카드 부분 대체 | AC10·11 |
| D-11 | “백그라운드 작업, 크론 등의 답변을 기다릴때(steer가 아닌 즉각대화재개가 가능할때)”는 답변 대기 표시를 하지 않는다. 실제 모델 활동·입력 순서·예약 수신은 유지한다. | ACTIVE | AC12 |
| D-12 | 새 Composer landing의 기본 경로는 Desktop. 세션 시작 경로를 프로젝트 기본 경로로 저장하고 해당 landing에 자동 적용한다. 동일 basename·다른 경로의 프로젝트는 별개다. | ACTIVE | AC13·14 |
| D-13 | 프로젝트 landing은 제목→Composer→대화 목록을 배치하고 우측 지침 UI·대화 제목 아래 메타를 제거한다. | ACTIVE; nav 표시·최근 그룹·좌우 폭은 D-17·18·21로 대체 | AC14·15 |
| D-14 | 프로젝트 상단 케밥의 “세부사항 수정”을 “지침 편집”으로 바꾸고 편집 대화상자에 연결한다. | ACTIVE; 사용자 후속 지시 | AC16 |
| D-15 | 아티팩트 페이지 제목 옆에 전체 아티팩트 수를 작게 표시한다. 검색·고정 탭의 필터 결과 수로 바꾸지 않는다. | ACTIVE; 사용자 후속 지시 | AC17 |
| D-16 | `/tmp`는 Linux 예시라는 사용자 정정을 반영한다. Windows 일반 출력·첨부·클립보드 사본은 사용자 OS 임시 폴더(LocalAppData/Temp)에 저장한다. | ACTIVE; D-07의 플랫폼 경로 예시 대체 | AC18 |

유지 판정: V1 D-01·02·04·05·06은 D-07~14의 명시 변경 외 그대로다. ACTIVE 결정↔AC 대조에서 충돌 0이며, 우측 지침 제거와 메뉴 편집 유지(D-13·14)는 서로 다른 표면이다.

### 13.2 Product & UX / 인수 기준

| R / AT / AC | 관측 가능한 기준 | production path / oracle |
|---|---|---|
| R9 / AT9 / AC9 | 두 화면에서 좌측 핸들로 폭을 조절하고 확대·복원·닫기를 같은 방식으로 실행한다. 확대는 nav를 침범하지 않고 현재 pane 전체를 채운다. | RightPanel·catalog→공통 pane; native 치수·드래그·초안·스크롤·iframe 넘기 관측 |
| R10 / AT10 / AC10 | Work Transcript에서도 최신 일반 출력의 카드를 열고 저장한다. 우측 패널을 열지 않아도 실시간 추가와 재로드 후 목록이 같다. 게시 카드를 중복 표시하지 않는다. | 저장된 artifact list→세션 출력 구독→Transcript 카드; 게시/파일 혼합·버전·세션 전환 검사 |
| R11 / AT11 / AC11 | 게시 카드 하단에는 아티팩트만 표시한다. 양쪽 카드 메뉴에서 보관 폴더·상단 메타를 제거하고 성공 안내는 표시하지 않는다. 실패는 재시도 가능한 상태로 보인다. | 공통 ArtifactCard/Cards→Transcript·TaskOutputContent; 실제 메뉴·저장 성공/실패 관측 |
| R12 / AT12 / AC12 | 수신 채널이 유휴로 즉시 입력을 받을 때는 응답 스피너·대기 문구·중단 버튼 없이 일반 전송이 가능하다. 자동 응답이 시작하면 응답 중 표시가 돌아온다. | main runtime activity→snapshot→Composer/Transcript; ready→입력/자동 응답→ready·load 회귀 |
| R13 / AT13 / AC13 | 새 대화는 Desktop을 기본으로 하고 최초 전송의 실제 cwd로 프로젝트가 생성·연결된다. 같은 경로는 재사용하고 이름이 같아도 경로가 다르면 둘 다 남는다. | workspace default→send→DB project/session→session.updated; 실제 DB 재개·중복경로 검사 |
| R14 / AT14 / AC14 | 프로젝트를 클릭하면 제목→해당 cwd의 Composer→해당 프로젝트 대화 목록이 나온다. 대화 제목 아래 메타와 우측 지침 패널이 없다. | nav→project route→landing→send; 프로젝트 전환·cwd·목록/초안·빈 상태 native |
| R15 / AT15 / AC15 | nav의 최근 대화 그룹을 제거하고 고정됨을 프로젝트보다 위에 배치한다. 자동 생성한 프로젝트도 표시되며 경로가 연한 prefix로 이름 왼쪽에 보인다. | project/session list→Sidebar; 실제 DOM 순서·중복 basename·미고정 project 검사 |
| R16 / AT16 / AC16 | 상단 메뉴의 지침 편집을 누르면 해당 프로젝트 지침을 편집·저장·취소할 수 있다. 재진입 후 저장된 지침이 남는다. | project kebab→instructions dialog→기존 project update IPC→DB→reload |
| R17 / AT17 / AC17 | 아티팩트 제목 옆 작은 총 개수가 로딩 완료·게시·삭제 후 현재 전체 목록과 일치한다. 검색/탭 이동에도 총 개수를 유지한다. | catalog store→title; 혼합 탭/검색/삭제 native 관측 |
| R18 / AT18 / AC18 | Windows에서 Composer 파일·클립보드 사본과 모델의 일반 최종 출력이 같은 OS Temp 폴더를 사용한다. 모델 안내·허용 루트·수집 판정이 실제 경로와 같다. | OS temp SSOT→attachment copy/output prepare→prompt/guard→capture; 실파일·별도 드라이브·원본 보존 검사 |

일반 출력의 현재 영속 목록에는 메시지/턴 소유자가 없으므로 타임스탬프로 턴을 추측하지 않는다. 최신 일반 출력은 Transcript 하단의 카드 목록으로 표시하고, 기존 명시 게시 카드는 원래 턴 연결을 유지한다. 원본 `/tmp` 파일이나 첨부를 수정·재공개하는 기능은 추가하지 않는다.

기존 cwd 없는 프로젝트와 미분류 대화를 강제로 이동하지 않는다. 기존 프로젝트도 목록에 보존하며 기본 cwd가 없으면 Desktop을 사용한다. 미분류 대화 접근은 D-21의 최근 대화 복구로 보완하며 기존 instructions 저장/런타임 주입과 수동 이름 편집은 보존한다.

### 13.3 조사와 Technical Design

| 축 | AS-IS 근거 | TO-BE / 책임 |
|---|---|---|
| panel | `RightPanel.tsx` viewer 50%/75%, `ArtifactsView.tsx` 60%/전체; 서로 다른 wrapper 2곳 | shared의 도메인 없는 resizable side pane 1벌. app 훅이 catalog viewer 상태를 props로 연결하여 feature 교차 import 방지 |
| 확대 | `ChatTile.tsx` pane-row에 대화와 우측 패널이 형제, task 확대는 viewer와 별도 상태 | pane-row를 기준으로 전체 확대. 기존 DOM 유지·inert, 일반 폭 저장과 복원; catalog도 같은 shell 계약 |
| drag | `RightPanel.tsx` private separator→shared useDragResize; mouseup만 정리 | 좌측 핸들 pointer capture/drag shield, min/max clamp·키보드, unmount/blur/대상 전환 취소; 본문 요청 수명과 폭 분리 |
| 출력 | `ArtifactService.captureOutput`→`artifact.published`→artifactStore 최신 목록; Transcript는 parts의 게시물만 표시 | 세션별 일반 출력 구독을 Transcript에 추가. latest 목록을 SSOT로 쓰고 ArtifactCards 재사용; output 상태는 다른 session으로 새지 않음 |
| 카드 | `ArtifactCard.tsx`에 card/list 두 형상, 메뉴 metadata/openFolder와 결과 success 표시 | 한 소스에서 양 형상 수정. 실패 메시지·다운로드·reveal·휴지통·새로고침은 기존 경계를 유지 |
| 활동 | `post-turn.ts` beginListenPhase와 `sessionBusy=inflight||listening` | `ChatActivitySnapshot.transport`에 ready 추가. 런타임 channelBusy/미소비 backlog로 판정하고 lease/진행 태스크 수로 busy를 추론하지 않음 |
| 프로젝트 | DB project에 cwd 없음; freshEntry는 전역 cwdCache, nav는 pinnedProjects만 표시 | append-only migration으로 nullable cwd+정규화 경로 식별. 실제 세션 시작 main 경로에서 ensure/연결, DTO와 이벤트 전달; landing cwd는 project 우선 |
| landing | project 전용 목록/우측 지침 UI, artifact 전용 list row | 범용 row layout을 shared에 두어 동일 디자인 사용. project는 meta slot 미전달, app/page는 feature를 props로 조립 |

활동 상태는 `idle`(체인 없음), `ready`(수신 유지·즉시 입력 가능), 기존 `listening`(실제 자동 응답/배출 대기)으로 구별한다. 새 snapshot 뒤 SDK가 바빠지는 레이스에서도 기존 main admission·held→flush·UUID/commit 순서를 유지하며 사용자 버블을 낙관적으로 끼워 넣지 않는다. Renderer의 transport 비교와 초기 snapshot 복원 소비처를 함께 갱신한다.

경로는 OS absolute/normalize 비교를 main에서 소유하고 Windows 대소문자·끝 구분자 차이를 같은 경로로 취급한다. 이름은 basename 표시용이며 유일키가 아니다. 신규 세션의 실제 cwd 확정 뒤 프로젝트 생성/연결을 처리하고 기존 명시 project의 지침·세션 관계를 임의로 덮어쓰지 않는다; 다른 cwd를 선택한 최초 전송은 그 경로 프로젝트로 연결한다.

### 13.4 Delta V와 §10 강제 지점 추가

R9~16/AT9~16, SD2~4/ST2~4, AR2~4/IT2~4, MD3~5/UT3~5는 NEW다. R3·R5·R7·R8은 INHERITED이며 기존 본문/선택 소유권·도구 순서·저장 경로 회귀를 선택한다. V1 VP1·2·4·6·10~12는 변경하지 않은 표현·파일 읽기 경계로 기존 증거를 승계하며 이번 구현 산출에 해당하지 않는 전면 재검증은 NOT_REQUIRED다.

| EP | 강제 지점 전수 / N | 직접 oracle·실패 의미 |
|---|---|---|
| EP6 | Transcript viewer·catalog viewer·task panel 확대 / 3 | host rect와 viewer rect, restore 폭·초안·scroll; 일부만 커지는 회귀 검출 |
| EP7 | Transcript 출력 구독·우측 출력 구독·공통 카드 / 3 | 목록 실시간/reload 및 실제 card/menu 문구·성공/실패; 닫힌 패널 의존 검출 |
| EP8 | runtime listen 전이·activity snapshot/복원·Composer·Transcript / 4 | 채널 유휴와 활성 구간의 실제 상태/전송·순서; 예약 대기를 모델 응답 중으로 오인하면 실패 |
| EP9 | default path·main 최초 세션 연결·project DB/DTO·landing cwd / 4 | Desktop·동일경로 재사용·다른경로 이름중복·프로젝트 전환 cwd; session 불일치 검출 |
| EP10 | Sidebar group 순서/프로젝트 행·project landing/row·지침 메뉴/dialog / 3 | 화면 DOM·실제 버튼→IPC→재로드; 고아 메뉴/중복 배치 검출 |

검색 분모: `rg 'viewerExpanded|expanded|min\\(.*(560|640|960)' renderer`, `rg 'ArtifactCards|acquireArtifacts' features/chat`, `rg 'listening|sessionBusy' main renderer`, `rg 'getWorkspacePath|freshEntry|pendingProjectId|pinnedProjects' app/src`의 소비 흐름으로 열거했다. 세부 소비처는 구현 리뷰에서 전수 재확인하며 검색 결과 파일 수를 지점 수로 대신하지 않는다.

| pair | 노드 / requiredness | start → edges → end / oracle | EP |
|---|---|---|---|
| VP13~20 | R9~16↔AT9~16 / REQUIRED | §13.2의 실제 행동; native+DB+선택자 결과 | EP6~10의 해당 행 |
| VP21 | SD2↔ST2 / REQUIRED | 두 route→resize/expand→switch/close→복원; stale selection·iframe drag·초안 유지 | EP6 (3) |
| VP22 | SD3↔ST3 / REQUIRED | background/cron listen→ready→send/자동응답→다시 유휴; commit 순서/중복 없음 | EP8 (4) |
| VP23 | SD4↔ST4 / REQUIRED | 새 대화 cwd→시작→프로젝트 nav→project landing→재시작; 연결/지침 유지 | EP9·10 (7) |
| VP24 | AR2↔IT2 / REQUIRED | artifact list/event→Transcript와 output→공통 카드/viewer; reload·격리된 본문 | EP6·7 (6) |
| VP25 | AR3↔IT3 / REQUIRED | runtime→activity wire→hydration→send UI; ready wire 왕복과 channel 레이스 | EP8 (4) |
| VP26 | AR4↔IT4 / REQUIRED | project DB→DTO/event→app 조립→landing→지침 update; 실DB·IPC 연결 | EP9·10 (7) |
| VP27 | MD3↔UT3 / REQUIRED | drag 입력/폭→clamp·취소, 출력 category→카드 목록; 경계값·latest·세션 격리 | EP6·7 (6) |
| VP28 | MD4↔UT4 / REQUIRED | channel busy/backlog→ready, transport→응답 중/전송 표시; 상태 조합 직접 단언 | EP8 (4) |
| VP29 | MD5↔UT5 / REQUIRED | cwd→경로 식별·basename·landing 초기값, project list→nav 순서; 같은 이름/다른 경로 | EP9·10 (7) |
| VP30 | R3·5·7·8↔기존 AT3·5·7·8 / REGRESSION | preview 선택/재시도/닫기·Code·늦은 결과·입력 commit·첨부/출력 저장; 기존 행동 suite | EP2·3·7·8 (15) |
| VP31 | R17↔AT17 / REQUIRED; NEW | catalog 실제 전체 list→타이틀 개수; pinned/search/delete 상태에서도 원천 전체 개수 | 추가 EP11: catalog 제목 (1) |
| VP32 | R18↔AT18 / REQUIRED; NEW | 선택/클립보드→Temp 사본·컨텍스트, Write/Stop→Temp 출력·카드; OS 실제 경로·실파일과 prompt 관측 | EP12: attachment directory·output directory·prompt/link 해석 (3) |
| VP33 | AR5↔IT5 / REQUIRED; NEW | 공통 main infra temp resolver→두 feature→추출/저장; 원본 불변·같은 루트 | EP12 (3) |
| VP34 | MD6↔UT6 / REQUIRED; NEW | OS temp path→native 절대경로, final link→실제 path 유지; Windows에서 Linux 별칭으로 바꾸지 않음 | EP12 (3) |

각 oracle은 실제 행동 결과를 읽으므로 구조 검색만의 PASS 또는 별도 결함 변이는 선택하지 않는다. Native가 대신할 수 없는 DB 보존·상태 전이는 의미 테스트로 검증하고 시각·치수·키보드·스크롤은 실제 Electron 렌더로 확인한다.

### 13.5 운영 gate·구현 분담·READY 교차검사

필수 gate는 main/web/test typecheck, 변경 파일 read-only ESLint·Prettier, 관련 vitest(현재 Electron SQLite ABI 유지), 직접 electron-vite build, native UI, doc inventory, migration append-only, test budgets, diff whitespace, INDEX/trailer 파싱이다. 새 의존성은 없으며 DB 변경은 기존 migration을 수정하지 않고 추가한다. IPC 의미 변경은 `docs/IPC_CONTRACT.md`, 현재 상태는 해당 frontend/backend architecture에 반영한다.

구현 분담: 공통 패널·두 호스트, 활동/재개 계약, 프로젝트 경로·landing/nav, 출력 카드·통합 검증을 독립 소유한다. shared i18n·app 조립 파일은 필요한 hunk만 수정하여 합류하고 새 기능 간 교차 import를 만들지 않는다.

READY: D-07~16와 AC10·9·9·10/11·12·13/14·14/15·16·17·18 대응을 대조했다. 새 노드 21개(R 10+SD 3+AR 4+MD 4)는 동일 수준 REQUIRED pair를 가지며 전수 EP 21지점(3+3+4+4+3+1+3)을 고정했다. 계획 규범 변경은 구현과 별도 커밋으로 보존하고, 사용자가 명시한 이번 변경을 먼저 반영하되 기존 독립 verify 대기 상태를 PASS로 바꾸지 않는다.

## 14. Delta V3 — 탐색 목록과 페이지 후속 피드백

READY (2026-09-10). 기준은 `5e53f4a5`의 V1+V2 구현이다. 이번 사용자 정정은 아래 결정으로 승계하며 r2의 독립 검증 결과를 대신하지 않는다.

### 14.1 Decision Ledger / Product & UX

| ID | 현재 결정 / 출처 | 상태 |
|---|---|---|
| D-17 | nav 프로젝트 행은 이름 다음에 전체 경로를 작고 연하게 표시한다. 고정하면 고정됨 그룹으로 이동하고 해제하면 프로젝트 그룹으로 돌아간다. | ACTIVE; D-13의 prefix·전용 프로젝트 배치 대체 |
| D-18 | 개별 프로젝트 landing의 제목·Composer·대화 목록 좌우 간격을 새 대화와 같게 한다. | ACTIVE; V2의 landing 폭 대체 |
| D-19 | 아티팩트 제목 옆 총계는 한국어에서 `6개`처럼 단위를 포함한다. | ACTIVE; D-15 보완 |
| D-20 | nav 플러그인은 아티팩트 같은 페이지 레이아웃을 사용하고 스킬·MCP·연결 탭은 전체·고정됨 위치에 둔다. | ACTIVE |
| D-21 | 고아 대화 자동 보정 요구는 취소하고 최근 대화 분류를 복구한다. 기존 대화의 프로젝트 할당은 수정하지 않는다. | ACTIVE; 사용자 후속 정정, D-13의 최근 제거 대체 |
| D-22 | nav 프로젝트 목록 페이지는 아티팩트 같은 세로 목록을 사용하고 항목 제목 아래 메타에 프로젝트 경로를 표시한다. | ACTIVE; 사용자 추가 요청 |
| D-23 | 세션 시작 시 새로 생성한 프로젝트는 nav에서 펼쳐진 상태로 표시한다. | ACTIVE; 사용자 추가 요청 |
| D-24 | 프로젝트·엔진&모델 제목 아래 설명을 제거한다. 엔진&모델 제목 오른쪽 설명은 연결된 setting 개수(`3개`)로 바꾼다. | ACTIVE; 사용자 추가 요청 |

| R / AT / AC | 관측 가능한 기준 | production path / 직접 oracle |
|---|---|---|
| R19 / AT19 / AC19 | 두 nav 그룹의 프로젝트 이름 뒤에 작은 전체 cwd가 보이며 동명·다른 경로를 구별한다. | projects→공통 nav 행; 실제 DOM 문자열 순서·시각 확인 |
| R20 / AT20 / AC20 | 새 대화와 개별 프로젝트의 콘텐츠 좌우 경계가 같은 창 크기에서 일치한다. | 두 page container→제목/Composer/대화; Electron bounding rect |
| R21 / AT21 / AC21 | 프로젝트 고정·해제 시 그룹 간에 이동하고 고정 대화·프로젝트 하위 대화 액션은 유지된다. | pin IPC→project store→nav 파티션/슬롯; 필터·실제 클릭 결과 |
| R22 / AT22 / AC22 | 아티팩트 제목 총계가 한국어 단위를 포함하고 삭제·검색·고정 필터에도 전체 총계를 유지한다. | artifact store→common.count→제목; 렌더 및 기존 catalog 회귀 |
| R23 / AT23 / AC23 | 플러그인 nav가 페이지를 열고 제목 아래 가로 탭으로 스킬·MCP·연결을 전환한다. 검색·추가·상세 기능은 유지된다. | Sidebar→router→ExtensionsCatalogView; 실제 이동/탭/검색 |
| R24 / AT24 / AC24 | 고정됨→프로젝트→최근 대화 순서로 표시하고 프로젝트 없는 기존 대화를 최근 목록에서 다시 연다. | recentIds→기존 파티션→SessionList→chat route; 미할당 대화·고정 중복 제거 |
| R25 / AT25 / AC25 | 프로젝트 목록은 중앙 세로 목록이고 제목 아래에 저장된 cwd가 표시된다. 이름 또는 경로 검색·고정 필터·프로젝트 열기·생성을 제공한다. | ProjectsScreen→CatalogListRow→project route; 실제 행/메타/필터/열기 |
| R26 / AT26 / AC26 | 세션 시작으로 새 프로젝트가 생성되면 해당 nav 행이 펼쳐지고 첫 대화가 나타난다. 기존 프로젝트 접힘과 수동 접기 선택은 유지한다. | main 신규 생성→session.updated→nav 펼침/하위 조회; 신규·재사용·초기 로딩 구별 |
| R27 / AT27 / AC27 | 두 페이지 제목 아래 설명이 없고 엔진&모델 제목 우측은 settings 원천의 설정 수와 한국어 단위를 표시한다. | useEngines→source 필터→제목; settings 2개+runtime 1개 입력에서 2개, 추가/삭제/빈 목록 |

최근 대화 파티션은 기존 고정 프로젝트와 고정 대화의 중복 제거를 재사용한다. 미고정 프로젝트 대화는 최근에도 표시되며 프로젝트 없는 대화를 임의로 배정하지 않는다. cwd 없는 프로젝트는 경로를 발명하지 않고 기존 Desktop 기본값 계약을 유지한다.

### 14.2 Architecture / V / 강제 지점

Main DB·migration·기존 대화 프로젝트 배정은 이번 범위 밖이다. 공통 `CatalogListRow`를 재사용하고 nav는 기존 project row 및 session partition을 조립한다. 프로젝트 landing은 새 대화의 외부 px-4·내부 max-w-[720px] 경계를 적용하고 플러그인은 `/plugins` route로 연결한다.

신규 프로젝트 자동 펼침은 Main의 실제 생성 결과를 `session.updated.patch.projectCreated` 선택 필드로 전달한다. renderer는 해당 project ID의 펼침 요청을 보관하여 catalog 조회의 지각 응답 뒤에도 적용한다. 최초 전체 목록이나 기존 project 재사용을 새 생성으로 추측하지 않는다.

엔진 제목의 setting 수는 `AgentEnvironment.source === 'settings'`의 표시 항목 수다. 모델 수나 읽기전용 `runtime` 원천 환경은 setting 파일 개수로 세지 않는다. `common.count`를 재사용하며 설정 편집·추가·삭제 동작은 유지한다.

| EP | 강제 지점 / N | 실패 의미 / oracle |
|---|---|---|
| EP13 | nav 파티션·두 그룹 공통 프로젝트 행·최근 슬롯 / 3 | 고정 중복/미할당 소실/경로 순서 오류; 파생·렌더·클릭 |
| EP14 | 프로젝트 landing·프로젝트 catalog·아티팩트 제목 / 3 | 콘텐츠 경계/경로 메타/단위 오류; 실제 치수·렌더 |
| EP15 | 플러그인 nav route·catalog tabs/content / 2 | 페이지 진입 단절/기존 검색·상세 소실; route와 상호작용 |
| EP16 | Main 생성 사실 발신·renderer nav 펼침 적용 / 2 | 기존 프로젝트를 신규로 오인/지각 목록에서 신호 소실; 생성·재사용·이벤트 순서 행동 |
| EP17 | 엔진 제목의 설명·설정 총계 / 1 | runtime·model 수 혼동/설명 잔존; 혼합 원천 및 실제 화면 |

| Pair | 노드 상태 / requiredness | 경로와 oracle | EP |
|---|---|---|---|
| VP35~41 | NEW R19~25↔AT19~25 / REQUIRED | §14.1 각 행동의 DOM·경로·필터 결과 | EP13~15 중 해당 지점 |
| VP42 | CHANGED SD4↔ST4 / REQUIRED | pin→nav 이동→project landing→recent→기존 대화; 프로젝트 상태 보존 | EP13·14 |
| VP43 | NEW AR6↔IT6 / REQUIRED | Sidebar→plugins route→feature 탭/검색/상세 | EP15 |
| VP44 | CHANGED MD5↔UT5 / REQUIRED | project pin·session membership→nav 각 목록, 기존 미할당 포함 | EP13 |
| VP45 | INHERITED R14·16·17↔AT14·16·17 / REGRESSION | landing cwd·지침 편집·catalog 전체 총계 | EP10·11 |
| VP46 | NEW R26↔AT26 / REQUIRED | 신규 세션→새 프로젝트→nav 펼침→첫 대화 | EP16 |
| VP47 | NEW AR7↔IT7 / REQUIRED | bindStartingProject→wire→project sync→목록 지각 응답 | EP16 |
| VP48 | NEW MD7↔UT7 / REQUIRED | 실제 created flag→expand 요청·소비; 기존 접힘·수동 접기 보존 | EP16 |
| VP49 | NEW R27↔AT27 / REQUIRED | projects/engine 화면→제목 설명 제거·settings 총계 | EP14·17 |
| VP50 | NEW MD8↔UT8 / REQUIRED | 환경 원천→settings 항목 수→제목; runtime·모델 수 독립 | EP17 |

기존 AC14의 순서·메타 제거·cwd는 유지하고 폭만 AC20으로 정정한다. AC15의 prefix·최근 제거는 AC19·21·24로 대체하며 AC17의 총계는 AC22로 보완한다. 나머지 V1/V2 pair는 비영향이므로 이전 증거 승계, 이번 전면 재검증은 NOT_REQUIRED다. 직접 행동을 검증하므로 별도 변이는 not selected다.

### 14.3 운영 gate / READY 대조

main/web/test typecheck, 변경 파일 읽기 ESLint·Prettier, nav/landing/catalog/plugin 관련 vitest, Electron fixture 시각·치수·액션, 직접 electron-vite build, doc inventory·test budget·diff whitespace와 INDEX/trailer를 확인한다. DB를 수정하지 않으므로 DB ABI 변경과 새 migration은 불필요하다.

READY: D-17~24의 각 결과를 AC19~27 및 EP13~17에 대조했다. 취소한 고아 보정은 구현 경로에서 제외했고 최근 분류 복구는 기존 membership 파티션으로 구체화했다. 기존 지침/세션 관계와 새 표시 계약 간 충돌은 없다.

### [구현자 기입] Delta V3 결과

AC19~27 자기확인 9/9, EP13~17 전수 11/11 완료. [구현 보고](impl-r3.md)에 V-pair·게이트·실제 치수와 수정한 파생 문제를 기록했다. 독립 verify는 pending이며 사용자 정정으로 취소한 기존 대화 재배정은 구현하지 않았다.

## 15. Delta V4 — 플러그인 항목 목록과 우측 상세

READY. 기준은 `73ac30a0`의 V1~V3다. 같은 사용자 피드백 구현 턴의 추가 요청이며 새로운 독립 검증 라운드를 만들지 않는다.

| 결정 | 사용자 결과 | 상태 |
|---|---|---|
| D-25 | 플러그인 세 탭의 항목을 아티팩트와 같은 리스트로 표시하고 목록 헤더를 제거한다. | ACTIVE; 그룹별 표·열 헤더·접힘 헤더 대체 |
| D-26 | 항목 클릭 시 기존 depth 이동 대신 목록 옆 우측 상세 패널을 연다. | ACTIVE; V3의 상세 화면 교체 방식을 대체 |
| D-27 | Code 우측 변경사항 패널의 펼치기도 transcript 전체를 덮는다. | ACTIVE; 사용자 추가 요청 |

페이지 제목과 스킬·MCP·연결 탭은 유지한다. 목록 헤더는 그룹 헤더와 표 열 헤더를 뜻하며 항목의 이름·보조 정보는 공통 `CatalogListRow` 안으로 옮긴다. 기존 상세의 토글·편집·삭제·연결·인증과 스킬 본문 기능을 우측 패널에서 유지한다.

| R / AT / AC | 관측 기준 / 경로 | oracle |
|---|---|---|
| R28 / AT28 / AC28 | 각 탭은 무헤더 세로 항목 목록이며 아이콘·제목·보조 정보와 선택 상태를 보여준다. | 공통 row 실제 렌더·세 탭 클릭·키보드 |
| R29 / AT29 / AC29 | 목록 항목→같은 페이지 우측 상세, 목록·탭·추가 버튼 유지. 닫으면 실행한 행으로 초점 복귀, 탭 이동은 상세를 닫는다. | 실제 DOM 동시존재·좌표·close/tab/focus |
| R30 / AT30 / AC30 | 공통 우측 패널의 크기 조절·확대·복원을 사용하고 선택 전환 시 이전 항목의 폼·본문 표시 모드가 새 항목에 남지 않는다. | 드래그·키보드·치수·서로 다른 상세 전환 |
| R31 / AT31 / AC31 | Code 변경사항의 기존 펼치기 버튼을 누르면 nav를 제외한 transcript host 전체를 덮고 다시 누르면 원래 패널 폭으로 복원한다. | GitContextBar 버튼→RightPanel→공통 pane; 실제 host rect·원폭·선택 보존 |

Architecture: `ExtensionsCatalogView`가 selection과 폭·확대 상태를 보유하고 기존 상세 컴포넌트를 `ResizableSidePane`에 조립한다. skills feature끼리만 결합하며 chat feature를 import하지 않는다. 목록은 항상 mounted, 확대 시 inert이고 상세 수명은 탭+항목 ID로 구분한다. ID는 선택한 탭 안에서만 해석해 다른 탭의 동명 ID와 충돌하지 않는다.

| EP / 지점 | N | 실패 의미 / 직접 관측 |
|---|---:|---|
| EP18 스킬·MCP·연결 리스트 | 3 | 표/그룹 헤더 잔존·다른 형상·잘못된 선택; 실제 row DOM |
| EP19 선택·닫기·탭전환·항목전환·rename/delete | 5 | 목록 소실·초점 소실·다른 항목 폼 누출·stale 선택; 실제 이벤트 |
| EP20 상세 panel resize·expand/restore | 2 | 별도 조절 로직·좁은 창 overflow·목록 remount; 공통 panel 치수·키보드 |
| EP21 Code 변경사항 버튼·host 확대/복원 | 2 | 최대 폭만 바뀌고 transcript가 남음; 실제 버튼→전체 rect·복원 |

| pair | 노드 / requiredness | 경로 / oracle |
|---|---|---|
| VP51~53 | NEW R28~30↔AT28~30 / REQUIRED | 각 AC의 실제 renderer 행동; EP18~20 |
| VP54 | NEW SD5↔ST5 / REQUIRED | select→panel→switch/tab/close→목록/초점; EP19 |
| VP55 | CHANGED AR6↔IT6 / REQUIRED | plugin route→list+shared pane→기존 상세 액션; EP18~20 |
| VP56 | NEW MD9↔UT9 / REQUIRED | tab+ID→선택 상세/수명; 다른 탭 동일ID·삭제/rename; EP19 |
| VP57 | INHERITED R23↔AT23 / REGRESSION | 페이지 진입·가로 탭·추가/편집/인증 기능; EP15 |
| VP58 | NEW R31↔AT31 / REQUIRED | Code 변경사항 펼치기→공통 전체 덮기→원복; EP21 |
| VP59 | CHANGED AR2↔IT2 / REQUIRED | GitContextBar→registry header props→RightPanel 확대 상태→ResizableSidePane; EP21 |
| VP60 | INHERITED R9↔AT9 / REGRESSION | 다른 task/viewer의 전체 확대·복원·공통 크기 조절; EP6 |

직접 행동 oracle을 사용하므로 별도 mutation은 not selected다. 필수 gate는 renderer 타입·변경 소스 ESLint/Prettier·영향 Vitest·실제 Electron 목록/패널/좁은 화면·build·문서 inventory·diff whitespace다. DB·메시지 프로토콜은 비영향, D-25~27과 AC28~31·EP18~21의 충돌은 없다.

플랫폼 경로 정정의 기술 적용: `infra/config`의 OS 임시 경로 resolver를 첨부·출력 준비가 함께 사용한다. Node `os.tmpdir()`의 OS 사용자 임시 폴더를 사용하여 Windows 기본 LocalAppData/Temp와 시스템 재지정을 따른다. Work prompt에는 실제 native 경로를 명시하고 `/tmp`를 Windows 파일로 바꾸는 별칭 해석은 제거한다; 기존 관리 사본·기존 대화의 경로는 이동하지 않는다.

### [구현자 기입] Delta V4 결과

AC28~31 자기확인 4/4, EP18~21 전수 12/12 완료. [구현 보고](impl-r3-panels.md)에 V-pair·게이트·native 증거 및 메뉴 Escape/지연 저장의 파생 문제 수정을 기록했다. 같은 r3 구현 턴이며 독립 verify는 pending이다.
