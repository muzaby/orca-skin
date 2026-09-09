# Plan — Cowork transcript와 출력 뷰어

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-09-10 |
| 상태 | READY |
| V mode / revision | Baseline V / V1 |
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
| D-03 | Markdown·HTML·텍스트/코드·이미지를 현재 명시 게시 경로로 열 수 있게 한다 | 사용자 범위 답변; 현 게시 타입은 html/markdown에 한정 | ACTIVE |
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
