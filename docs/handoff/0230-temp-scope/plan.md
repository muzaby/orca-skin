# Plan — 0230-temp-scope

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex |
| 일자 | 2026-09-12 |
| 상태 | IMPL_DONE |
| V mode / 기준 / revision | Baseline V / none / V2 |
| 관련 작업 | 백그라운드 SDK 보완은 별도 `0231-background-task-conformance` |

# Part I — Product & UX Contract

## 1. Context / 목표

도구의 기본 임시 접근 범위를 OS 임시 폴더 전체에서 앱 전용 하위 폴더로 좁힌다. 첨부 입력과 Work 완성 파일은 같은 앱 전용 루트를 사용한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 사용하는 모든 도구의 임시 rw 경로를 앱 전용 하위 폴더로 변경 | 2026-09-12 사용자 요청 1 |
| 명시 정정 | 폴더 이름은 `orcinus-orca (현재 앱 이름과 동일)` | 같은 대화의 경로 철자 질의 응답 |
| 명시 요구 | 작성한 핸드오프 문서에 codex라고 작성 | 같은 대화 후속 지시 |
| 해석 | OS 임시 경로는 기존 `os.tmpdir()`의 OS override를 유지하고 그 아래 `orcinus-orca`를 추가 | 기존 경로 구현과 Windows 기본 경로 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-01 | 공통 임시 루트는 `resolve(tmpdir(), 'orcinus-orca')` | 사용자 최종 철자와 기존 OS 임시 루트 해석 유지 | 사용자 | ACTIVE |
| D-02 | Code·Work의 SDK 추가 경로와 파일 가드에 동일 앱 임시 루트를 제공 | 모든 도구에 적용하라는 요청 | 사용자 | ACTIVE |
| D-03 | 첨부·일반 출력·artifact 임시 입력도 D-01을 사용 | 권한과 실제 파일 위치 일치 | 사용자 요구의 구현 해석 | ACTIVE |
| D-04 | 기존 사용자 선택 cwd·extraDirs와 별개인 자동 허용 경로만 좁힘 | 명시적으로 선택한 작업 경로를 삭제할 근거 없음 | 기존 계약 유지 | ACTIVE |
| D-05 | 작성 주체는 Codex | 사용자 지시 | 사용자 | ACTIVE |
| D-06 | Claude query의 `CLAUDE_CODE_TMPDIR`를 D-01로 고정 | SDK 실제 task 출력도 자동 허용 루트 안에 생성해야 함. OS TEMP/TMP/TMPDIR는 유지 | 실제 SDK 0.3.267·CLI 2.1.267 loopback 실기 | ACTIVE |

갱신 메모: 요청의 `orckinus-orca`는 명시 응답으로 `orcinus-orca`가 되었다. ACTIVE 결정 ↔ AC 대조: D-01~04는 AC1~5, D-05는 AC6에 연결한다.

## 4. 요구 비판적 검토

| 판단 | 관측 |
|---|---|
| 현재 기본 임시 범위가 넓음 | `infra/config/temp-path.ts`가 `resolve(tmpdir())` 반환 |
| 단일 경로 변경만으로 모든 도구 적용은 보장되지 않음 | `claude.ts`는 `extensions.outputFiles`가 있는 경우만 출력 경로를 추가 |
| 기존 입력·출력 가드 재사용 가능 | `attachment-files.ts`, `artifacts/files.ts`가 공통 경로 함수를 소비 |
| OS 전체 샌드박스 변경과 구분 | `workspace-guard.ts`는 파일 도구 가드이며 셸 명령 문자열을 검사하지 않음 |

## 5. 동작 / 사용자 흐름

턴 준비 → 앱 임시 폴더 준비 → SDK와 파일 가드에 같은 루트 전달 → 첨부 저장·도구 파일 접근·완성 파일 수집.

| 상황 | 결과 |
|---|---|
| 폴더가 없음 | 안전한 부모 확인 후 생성 |
| 앱 임시 폴더 내부 읽기·쓰기 | 기존 모드/승인 정책을 적용하며 경로 때문에 거부하지 않음 |
| 임시 폴더 형제·부모 파일 | 자동 허용 대상에서 제외; 명시 cwd·extraDirs는 기존 규칙 적용 |
| 링크 또는 리디렉션된 입력/출력 | 기존 안정 파일·경로 검증 유지 |
| 이전 임시 루트의 일반 출력 | 자동 이관/스캔하지 않음; 새 파일은 새 루트에 생성 |

## 6. 범위 / 비범위

범위: 공통 임시 경로·자동 rw 배선·첨부·Work 출력·artifact 입력·관련 프롬프트와 현재 문서.
비범위: 사용자 OS ACL 전역 변경, 개발 도구 임시 디렉터리, SQLite 시험 폴더, 사용자 파일 일괄 이동·삭제, `TEMP`·`TMP`·`TMPDIR` 환경변수 변경. 셸/MCP 프로세스의 OS 강제 격리는 기존 기능이 아니며 이번 경로 변경의 성공으로 주장하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R / AT / AC | 동작 기준 | 직접 검증 | production path |
|---|---|---|---|
| R-01 / AT-01 / AC1 | 공통 루트가 OS 임시 폴더 아래 정확히 `orcinus-orca` | 실제 함수 반환과 override fixture | temp-path → 입력/출력 소비처 |
| R-02 / AT-02 / AC2 | Code·Work 모두 해당 루트 rw, 부모·형제는 자동 허용 안 됨 | 두 프로필 query 옵션·SDK 임시 env 및 실제 guardToolAccess 결과 | Claude query 준비 → additionalDirectories·PreToolUse·CLAUDE_CODE_TMPDIR |
| R-03 / AT-03 / AC3 | 첨부와 완성 파일이 새 루트에서 읽기·저장·수집됨 | 임시 fixture의 실제 파일 I/O | attachments·output collector → artifact service |
| R-04 / AT-04 / AC4 | artifact 임시 입력은 앱 루트만 자동 허용 | 앱 루트 성공·형제 경로 거부·링크 거부 | readArtifactInput → stable reader |
| R-05 / AT-05 / AC5 | 사용자 cwd·extraDirs와 기존 파일 무결성 검증 유지 | 기존 workspace 및 출력 파일 회귀 테스트 | turn extraDirs → guard·output reader |
| R-06 / AT-06 / AC6 | 프롬프트·현재 문서가 새 경로를 설명하고 작성자는 Codex | 문서·문구 실값 및 링크 검사 | Work profile·turn prompt·현재 문서·plan |

## 7-A. V / Trace Matrix

모든 노드는 이번 기준선에서 NEW이며 기존 V를 상속하지 않는다. 기존 Work 출력뿐 아니라 Code를 포함하는 공통 자동 권한 요구를 독립 기준선으로 잡고 기존 동작 회귀는 AC5로 직접 검사한다. R-01~06·AT-01~06은 §7, SD-01/ST-01은 §5·§9의 턴/파일 흐름, AR-01/IT-01은 §10의 같은 경로 배선, MD-01/UT-01은 경로·파일 경계 불변식이다.

| Pair | left ↔ right | requiredness | production path / oracle | §10 | 적대 증거 |
|---|---|---|---|---|---|
| VP-01~06 | R-01~06 ↔ AT-01~06 (동일 번호) | REQUIRED | §7 각 행의 경로·직접 행동 단언 | EP-01~05 | not selected — 파일 I/O·옵션·가드 직접 결과 |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | 턴 준비 → 파일 생성 → 수집·읽기 통합 결과 | EP-02~04 | not selected — 실제 파일 결과 |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | query 옵션과 가드에 같은 루트를 전달한 두 프로필 실행 | EP-02 | not selected — 주입된 query/hook 행동 |
| VP-10 | AR-02 ↔ IT-02 | REQUIRED | query/설정 env의 옛 tmp override → 앱 tmp로 고정 → 실제 SDK 출력 파일의 허용 read | EP-06 | not selected — 실제 query 옵션과 파일 내용 |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | 루트 해석 → 앱 폴더/형제/링크 입력 판정 | EP-01·03·04 | not selected — 직접 경로 판정 |

운영 gate: 관련 비 DB Vitest, `npm run typecheck`, `npm run lint`, 문서 링크·inventory 검사, `git diff --check`, 커밋 trailer 재독. 현재 변경으로 유발된 실패를 판정한다.

# Part II — Technical Design

## 8. Research

| 대상 | 검색/방법 | 관측 |
|---|---|---|
| 임시 루트 소비 | `rg -n 'getTemporaryFilesPath|nativeAttachmentDirectory' app/src/main` | attachments 및 artifacts 경로 소비 |
| 자동 권한 | `rg -n 'additionalDirectories|makeWorkspaceGuardHook' app/src/main/adapters/claude.ts` | Work 출력 유무에 따라 추가 경로 구성 |
| 프롬프트 | `rg -n 'OS temporary|OS user temporary|LocalAppData/Temp' app/src/main` | profiles·send에서 OS 루트라고 설명 |
| 기준선 | 관련 기존 5개 Vitest 스위트 | 135테스트 통과; 배경 스펙 충족 판정과 별개 |

## 9. Architecture — AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 경로 | OS 임시 루트 | 그 아래 PRODUCT_SLUG 폴더 |
| 권한 배선 | Work outputFiles가 추가 루트를 제공 | Code·Work 공통 임시 루트 + 명시 extraDirs + outputFiles |
| 파일 I/O | OS 루트에 첨부/완성본 | 앱 전용 루트에 첨부/완성본 |
| 오류·정리 | 기존 안정 파일 검사 | 유지; 사용자 기존 파일을 이관/삭제하지 않음 |

## 10. 계약 / 타입 / 강제 지점

| EP | 불변식 / 지점 | SSOT / 강제 시점 | 실패 의미 |
|---|---|---|---|
| EP-01 | 공통 임시 루트 반환·안전한 폴더 준비 (2) | `infra/config/temp-path.ts` / 호출·턴 준비 | 넓은 OS 루트를 허용하거나 Code 첫 턴에 폴더 부재 |
| EP-02 | Code·Work query 옵션·workspace 훅 (2 프로필 × 2 소비) | `adapters/claude.ts`의 공유 배열 / spawn | 프로필 또는 SDK·가드 권한 불일치 |
| EP-03 | 첨부 기본 저장·일반 출력 준비·일반 출력 재읽기 (3) | `attachment-files.ts`, `artifacts/files.ts` / I/O | 새 위치 불일치 또는 검증 약화 |
| EP-04 | artifact 임시 입력 fallback (1) | `artifacts/files.ts:readArtifactInput` / 읽기 | 부모/형제 파일 무단 허용 |
| EP-05 | Work profile·턴 출력 경로 설명·artifact instructions/description·현재 persistence·권한 가이드·plan·INDEX (8) | 각 현재 문서/프롬프트 / 배선·보고 | 설명과 실행 불일치 |
| EP-06 | SDK 내부 tmp env와 명시 설정 override 우선순위 (2) | `claude.ts` query options/env/settings / spawn | SDK task 출력이 부모 Temp에 생성되어 새 reader가 거부 |

AR-02/IT-02는 D-06의 SDK 내부 출력 생성 경로 계약과 실기·옵션 oracle이다. V2 변경은 이 노드·pair·EP와 AC2/AC3 경로를 보강하며 기존 V1 행을 유지한다.

## 11. 구현 설계

1. 경로·프로필별 query/guard·실제 파일 fixture에서 새 기대값을 먼저 확인한다.
2. 공통 함수를 `PRODUCT_SLUG` 하위 경로로 바꾸고 두 프로필의 additionalDirectories 기본값을 일치시킨다. `infra/config/temp-path.ts`에 부모 lstat·realpath 검증과 mkdir를 수행하는 async 준비 함수를 두고 `app/chat-turn/send.ts`의 실제 query 준비 전에 양 프로필 공통으로 호출한다.
3. 첨부/출력 소비와 프롬프트를 확인하고, 폴더 생성 실패와 형제 경로 차단 회귀를 수행한다.
4. 현재 문서를 갱신하고 게이트 결과를 구현자 기입에 기록한다.

## 12. End-to-end 영향

temp-path → Claude additionalDirectories/guard 및 attachments/artifacts → 도구·입력·출력 UI. 사용자 extraDirs는 DB에 추가하거나 제거하지 않는다.

## 13. Lifecycle / 오류 / 정리

기존 디렉터리 생성·안정 파일 검사를 재사용한다. 임시 파일 정리는 자신이 만든 파일의 identity를 검증한 뒤 수행하는 기존 계약을 유지한다. plan/INDEX 두 상태 사본은 같은 커밋에서 갱신한다.

## 14. 성능 / 상한

디렉터리 전수 스캔과 네트워크 요청을 추가하지 않는다. 기존 첨부 및 출력 크기 상한은 유지한다.

## 15. 외부 구현 포트 / 문서 계약

공개 IPC 변경 없음. 기존 SDK `additionalDirectories: string[]`의 경로 값만 변경한다.

## 16. 기존 결정·규칙과의 관계

기존 0226의 D-16/R18/AC18(첨부·완성본), D-32(원본 경로), D-38/AC44(artifact 임시 입력)의 OS 임시 루트 선택은 이번 사용자 결정 D-01·D-03으로 대체한다. 이전 핸드오프 기록은 수정하지 않는다. workspace의 명시 extraDirs·읽기 전용 예외·승인 모드 정책과 레이어 규칙은 유지한다.

## 17. 리스크 / 트레이드오프

이전 OS 임시 루트 출력은 새 자동 접근 정책에 포함되지 않을 수 있다. 자동 파일 이동은 사용자 파일 충돌 위험이 있어 수행하지 않는다. 새 의존성 없음.

## 18. 영향 파일 / 문서

`app/src/main/infra/config/temp-path.ts`, `adapters/claude.ts`, `features/agents/profiles.ts`, `features/artifacts/tool.ts`, `app/chat-turn/send.ts`, 관련 attachments/artifacts 테스트, `docs/arch/backend/persistence.md`, `docs/guides/workspace-isolation-permissions.md`.

## 19. 게이트

`app/AGENTS.md`의 ABI 중립 절차를 따른다. 관련 Vitest를 직접 실행하고 typecheck/lint·문서 gate·diff/trailer를 확인한다. 경로 검증은 실제 임시 fixture로 재현하며 DB ABI 변경은 요구하지 않는다.

## READY self-review

READY: 독립 감사가 찾은 Code 폴더 생성 누락과 artifact 도구 설명을 EP-01·EP-05에 반영했다. `tmpdir()` 직접 소비 검색에서 도구 경로 밖 SQLite warm-up을 분리했고, ACTIVE D-01~05와 AC1~6의 충돌은 없다. 테스트는 `temp-directory`, `attachments`, `claude.extra-dirs`, `input-files`, `profiles`, `tool`의 직접 행동 결과를 사용한다.

## 설계 정정 — SDK 내부 임시 출력 (Codex, 2026-09-12)

실제 SDK 실행에서 Bash·PowerShell·Agent의 output_file이 `Temp/claude/.../tasks`로 생성되어 좁힌 자동 허용 범위 밖이었다. 공식 `CLAUDE_CODE_TMPDIR`를 앱 전용 루트로 고정한다. 이는 Claude 내부 임시 파일의 위치만 바꾸며 OS TEMP/TMP/TMPDIR·파일 ACL·기존 파일은 변경하지 않는다. 공식 근거: https://code.claude.com/docs/en/env-vars . 일반 환경/설정이 이 host 경로를 넓히지 못하도록 최종 query 입력에서 우선한다.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V2의 D-01~D-06과 §11 구현 순서를 적용했다. SDK 내부 출력 경로는 query의 `options.env`와 `settings.env`에서 앱 임시 루트가 최종 우선한다.
- 이견 / 현실성 문제: 없음. 실제 SDK·CLI 실기에서 V1의 additionalDirectories만으로는 `Temp/claude` 출력 생성 위치가 바뀌지 않았고, 별도 설계 V2가 D-06·VP-10·EP-06으로 이 경계를 보완했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. `adaptExecutionConfig` 테스트가 `TEMP`·`TMP`·`TMPDIR`와 입력 객체·`process.env`의 불변을 직접 비교한다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10 지점 | 닫은 지점 | 재현 명령/관측 | 남긴 곳 |
|---|---|---:|---:|---|---|
| VP-01·07·09 | 공통 루트 반환·안전 준비 | EP-01 (2) | 2/2 | `rg "getTemporaryFilesPath|prepareTemporaryFilesPath" app/src/main/infra/config/temp-path.ts` → 공개 진입점 2개; 실제 폴더·링크 거부 fixture 통과 | — |
| VP-02·08 | Code·Work의 SDK/가드 공통 루트 | EP-02 (4) | 4/4 | `claude.extra-dirs.test.ts`가 Code·Work × `additionalDirectories`·`makeWorkspaceGuardHook`을 검사하고 같은 배열 참조를 단언 | — |
| VP-03·07 | 첨부 저장·출력 준비·출력 재읽기 | EP-03 (3) | 3/3 | `rg "getTemporaryFilesPath"` → `attachment-files.ts:7`, `files.ts:167`, `files.ts:207`; 파일 I/O fixture 통과 | — |
| VP-04·09 | artifact 임시 입력 fallback | EP-04 (1) | 1/1 | `files.ts:131`의 앱 루트 fallback 1개; 부모·형제·junction·root redirect 거부 fixture 통과 | — |
| VP-06 | 사용자/운영 설명과 상태 사본 | EP-05 (8) | 8/8 | 8-anchor 검색 probe: Work profile 1·turn prompt 1·artifact 필드 2·persistence 1·권한 가이드 1·plan 1·INDEX 1 → `total=8 missing=0` | — |
| VP-02·03·10 | SDK tmp env·settings 우선순위 | EP-06 (2) | 2/2 | `adaptExecutionConfig`의 `options.env`·직렬화 `settings.env`가 같은 루트; complete/send 두 호출부와 대소문자 alias 제거 검사 | — |

- 전수 합계: **20/20** — `2 + 4 + 3 + 1 + 8 + 2 = 20`. production `getTemporaryFilesPath` 소비 검색 결과를 EP-01~04·06에 분류했고, EP-05의 문구·상태 사본 차집합은 0이다.
- §10에 없는데 같은 불변식이 필요했던 지점: **0건**. V1 실기에서 찾은 SDK env 경계는 V2의 D-06·VP-10·EP-06으로 설계에 먼저 반영됐다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `resolve(tmpdir(), PRODUCT_SLUG)` 반환과 OS override fixture | not selected — 실제 반환값 |
| VP-02 | REQUIRED | SELF_PASS | Code·Work의 SDK 경로·가드와 SDK tmp env가 앱 루트 | not selected — 실제 options/hook 값 |
| VP-03 | REQUIRED | SELF_PASS | 첨부·일반 출력 I/O와 SDK output 네 종류의 main reader 상태 `available` | not selected — 실제 파일 내용 |
| VP-04 | REQUIRED | SELF_PASS | 앱 루트 입력 성공, 부모·형제·junction·file/root alias 거부 | not selected — 실제 파일 판정 |
| VP-05 | REQUIRED | SELF_PASS | 관련 TEMP 10파일 80케이스와 adapter 회귀 48파일 544케이스 통과 | not selected — 기존 직접 oracle |
| VP-06 | REQUIRED | SELF_PASS | profile·turn·artifact·현재 문서에서 `orcinus-orca`; 작성자 Codex | not selected — 산출 실값 |
| VP-07 | REQUIRED | SELF_PASS | Code·Work 턴 준비 후 파일 생성·수집·읽기 경로 80케이스 통과 | not selected — 통합 결과 |
| VP-08 | REQUIRED | SELF_PASS | query 옵션과 guard가 동일 `additionalDirectories` 객체를 받음 | not selected — 참조 동일성 |
| VP-10 | REQUIRED | SELF_PASS | SDK 0.3.267/CLI 2.1.267 네 실기 모두 앱 tmp 아래 생성·reader/snapshot 일치 | not selected — [실기 증거](../0231-background-task-conformance/sdk-evidence.md) |
| VP-09 | REQUIRED | SELF_PASS | 폴더·형제·링크 경계의 직접 경로 판정 | not selected — 실제 경로 판정 |

## [구현자 기입] 이번 라운드 수정의 잠금

| RED→GREEN oracle | 출처 | 구현 전 결과 | 구현 후 결과 | 잠근 계약 |
|---|---|---|---|---|
| Code query의 SDK tmp 옵션 | V2 VP-10 | `pins SDK internal temp for code...` 실패 | 통과 | 대화·direct completion의 앱 tmp 고정 |
| Work query의 SDK tmp 옵션 | V2 VP-10 | `pins SDK internal temp for work...` 실패 | 통과 | Work additionalDirectories와 SDK tmp 일치 |
| settings/process env 권위와 OS temp 불변 | D-06·EP-06 | `pins the host temp root in both channels...` 실패 | 통과 | 설정·process 원본과 TEMP/TMP/TMPDIR 불변 |
| 대소문자 alias 제거 | D-06·EP-06 | `overrides explicit temp aliases...` 실패 | 통과 | Windows env 키 단일 권위 |

- 분모 검산: `선택 증거 0 · 인용 변이 0 · 새 oracle 4 = 표 행 4`.
- 덮개 회귀: 이전 라운드 없음. 실제 SDK 실기는 직접 oracle이며 적대 변이로 선택하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 모든 도구가 같은 앱 임시 루트를 쓰는가 | Code·Work 파일 권한과 Claude 내부 output_file이 `Temp/orcinus-orca` 아래로 모인다 | 없음 |
| OS 임시 설정이나 사용자 경로를 바꾸는가 | `TEMP`·`TMP`·`TMPDIR`, cwd, extraDirs, 입력 설정 객체는 바뀌지 않는다 | 없음 |
| 폴더 생성 실패가 무음인가 | 턴 query 전 안전 준비가 실패하면 기존 턴 오류 경로로 전달된다 | 없음 |
| 이전 Temp 출력이 자동 이동되는가 | 이동·스캔하지 않으며 현재 문서가 새 출력만 앱 루트에 둔다고 설명한다 | 없음 |
| 사용자 대면 문구의 소비자가 있는가 | Work profile·turn prompt·artifact 도구 설명을 모델이 직접 소비한다 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | V1은 접근 허용 루트만 좁혀 SDK 자체 output_file은 `Temp/claude`에 남았다 | ✅ 선조치 — V2 설계 뒤 `CLAUDE_CODE_TMPDIR`를 env/settings 두 채널에서 앱 루트로 고정 | [SDK 실기](../0231-background-task-conformance/sdk-evidence.md) |
| 2 | Windows의 대소문자 다른 env alias가 host 값을 우회할 수 있다 | ✅ 선조치 — case-insensitive 제거 후 정본 키 하나를 기록 | `claude-adapt.test.ts` alias 케이스 |
| 3 | 앱 임시 루트는 세션별 격리 폴더가 아니다 | ⚠️ 보고만 — 기존 D-01·D-04 범위이며 모델에 서로 다른 파일명을 쓰도록 안내 | `persistence.md` 일반 출력 절 |

### 설계 대비 명시적 차이

- plan이 지정한 메커니즘과 다르게 구현한 것: 없음. V1 이후 발견한 SDK 생성 경로는 별도 설계 V2에 먼저 반영한 뒤 구현했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — tmp root는 query마다 현재 `os.tmpdir()`에서 계산한다 | AC1 · EP-01 |
| 공유 | 앱 루트는 Code·Work가 공유하지만 자동 허용은 부모·형제로 확장되지 않는다 | AC2·5 · EP-02·04 |
| 재진입 | direct completion과 conversation이 같은 순수 설정 helper를 매번 호출한다 | AC2·3 · EP-06 |
| 다른 무효화 축 | OS tmp override 변경은 다음 호출부터 반영되며 process env 객체는 수정하지 않는다 | AC1·5 · EP-01·06 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 작성자 | **Codex** |
| 변경 파일 | `temp-path.ts`, `claude-adapt.ts`, `claude.ts`, `send.ts`, `profiles.ts`, artifact/attachment 경로와 관련 테스트, `persistence.md`, 권한 가이드, 본 plan |
| TDD | V1 관련 7파일 40케이스에서 기대 실패 12건 확인 후 수정; V2 신규 4케이스 RED→GREEN |
| 관련 검증 | TEMP/attachment/artifact/guard/output 10파일 **80케이스 통과**; adapter 관련 48파일 **544케이스 통과** |
| 실제 SDK/CLI | SDK 0.3.267·CLI 2.1.267: Bash 완료·Bash stop·PowerShell 한글·Agent 기본 output 네 경우가 `Temp/orcinus-orca/claude` 아래 |
| production reader | 네 output 모두 `available`, snapshot `partial=false`; PowerShell 한글 보존. [증거](../0231-background-task-conformance/sdk-evidence.md) |
| AC 자기보고 | AC1~AC6 **SELF_PASS 6 / SELF_BLOCKED 0** |
| V-pair 자기확인 | REQUIRED **SELF_PASS 10 / SELF_BLOCKED 0** |
| 전역 운영 gate | 아래 최종 통합 관측 참조 |
| 커밋 | INDEX의 구현 좌표와 trailer는 검증자가 재확인 |

### 최종 통합 관측

| Gate | 명령 / 관측 결과 |
|---|---|
| 최종 타입 | npm run typecheck — node/web/test 모두 exit0 |
| 최종 린트 | npm run lint — exit0, 오류0, 기존 useTranscriptVirtualizer 경고1 |
| 전체 회귀 실행 | vitest --maxWorkers=4 — 497파일 통과/2파일 실패/1skip, 4629통과/2실패/1skip. 실패 2건은 병렬 작성 중 읽힌 Workflow 신규 RED였다 |
| 수정 후 회귀 | chat/app/runtime/history/output/renderer 관련 최종 231파일·1928테스트 전부 통과. 위 실패 2파일과 실제 started→progress 통합을 포함한다 |
| 마지막 린트 정리 | 반환 타입 2곳과 부모 필드 제거의 미사용 변수 수정 후 parts 2파일·27테스트 통과 |
| 스크립트 | node --test scripts/*.test.mjs — 116테스트, 실패0 |
| Electron 빌드 | npm run prebuild로 Electron ABI 복원 후 electron-vite build — main/preload/renderer 모두 통과. 마지막 타입/린트 정리 이후 번들도 재생성 |
| 문서/DB 가드 | check-doc-inventory --check, check-migrations-appendonly, check-test-budgets — 모두 exit0. 상대 링크 유효, migration append-only 유지 |
| 실제 SDK | basic4 + 소유자 수명9 + Workflow2. SDK 출력의 production reader·snapshot와 실제 main interrupt/close/one-shot 관측은 sdk-evidence.md |
| 저장소 위생 | git diff --check 통과. 최종 커밋 후 trailer 파싱 확인 |

전체 회귀의 RED를 최종 단일 실행 PASS로 바꿔 적지 않는다. 변경 중 실패한 두 스위트와 최종 수정의 영향 범위를 재실행하여 닫았다. DB 테스트는 Node ABI에서 수행했고 종료 시 native 모듈은 Electron ABI로 복원됐다. 빌드 첫 직접 helper 호출은 npm PATH 없이 electron-builder.cmd를 찾지 못해 실패했으며, 저장소가 지정한 prebuild 경로로 실행해 해소했다.

**AC 자기확인**

| AC | 자기 상태 | 관측 |
|---|---|---|
| AC1 | SELF_PASS | 함수 반환·OS override·안전 생성 fixture 통과 |
| AC2 | SELF_PASS | Code·Work SDK/guard와 env/settings tmp root 일치 |
| AC3 | SELF_PASS | 첨부·완성 파일 I/O 및 SDK 네 output의 production reader/snapshot 통과 |
| AC4 | SELF_PASS | 앱 tmp 성공, 부모·형제·junction·redirect 거부 |
| AC5 | SELF_PASS | cwd·extraDirs 불변과 관련 회귀 48파일 544케이스 통과 |
| AC6 | SELF_PASS | 문구·현재 문서·작성자 Codex 실값 확인 |

- AC 검산: `SELF_PASS 6 · SELF_BLOCKED 0 = 총 6`.

## [구현자 기입] Review Signals

| 신호 | 관측 |
|---|---|
| 이전 라운드와 같은 축인가 | 첫 구현 라운드 안에서 V1 경로 허용과 V2 SDK 생성 경로를 같은 temp scope로 닫았다 |
| plan이 막았어야 했는가 | V1은 SDK 내부 생성 경로를 열거하지 않았다; 실제 실기 후 별도 설계 V2가 D-06·VP-10·EP-06을 추가했다 |
| 반복 환경 한계 | loopback은 실제 SDK/CLI와 production reader를 쓰지만 외부 모델·원격 Worker 동작은 측정하지 않는다 |
| 현재 라운드 수 | r1, 유효 설계 V2 |
