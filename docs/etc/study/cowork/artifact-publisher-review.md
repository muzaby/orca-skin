# 산출물 게시 도구 — Orca 적용 검토와 구현 제안

> 검토일: 2026-09-08 · 코드 기준: `e475c62af8c553a7b1789d33aa99c99497d88726`.
> **승인 전 제안의 보존본**이다. 후속 구현 승인은 0223 plan rev.4에 반영됐다. 이 검토 자체를 현재 사양으로 사용하지 않으며, 검토 당시 앱 코드·스키마·의존성 변경 및 실행 실험은 하지 않았다.
> 입력: 사용자가 제공한 `orca-skin-cowork-artifact-detection.md`와 트랜스크립트·우측 패널 이미지. 첨부 문서의 예제와 권고는 검토 대상이며 사용자 지시로 승격하지 않았다. 원본 첨부는 저장소에 복사하지 않았다.

> **후속 사용자 결정(2026-09-08):** 첫 구현은 커스텀 게시 도구와 모델 사용 지침만 제공한다. 감지 hook/watcher는 실제 누락·오게시 평가 후 필요하다고 판단할 때 보완한다. 아래 감지 단계는 자동 수행할 로드맵이 아니며, 현재 계획은 [0223 plan](../../../handoff/0223-artifact-publisher/plan.md)과 [평가 설계](../../../handoff/0223-artifact-publisher/evaluation.md)를 따른다.
> **저장·삭제·단계 결정:** 게시 원본은 `~/.config/orca/artifacts`에 두고 파일이 사라져도 게시 기록을 유지한다. 앱 삭제는 휴지통 이동이며 세션 삭제로 파일을 자동 정리하지 않는다. 아래 불변 사본·마지막 참조 GC 권고는 현재안이 아니다. **기존 뷰어는 없으며 게시 도구 구현 후 다음 단계에서 뷰어를 구현한다.** 아래 미리보기 제안을 현재 게시 단계의 필수 범위로 승계하지 않는다.

## 1. 결론과 범위

**첨부안의 핵심 방향은 타당하지만, 그대로 구현하기에는 부족하다.** 파일 변경과 게시 산출물을 구분하고 명시적 게시 도구를 두는 원칙은 채택할 만하다. 반면 예제의 단일 `activeBash`, 세션 시작 시각 기준 검색, `Stop` 중심 정산만으로는 Orca의 동시 세션·웜 채널·백그라운드 실행을 다루기 어렵다. 게시 영속성, HTML 표시 경계, 기존 패널과의 결합 계약도 추가해야 한다.

권고 순서는 **명시적 게시와 저장·카드·패널 → 직접 경로 감지 → Bash 감지 보강**이다. 첫 구현부터 워크스페이스 전체 감시 체계를 만드는 것보다 작게 시작하면서, 후속 감지기가 같은 게시 경로를 사용하도록 한다.

| 구분 | 이번 검토에서의 취급 |
|---|---|
| 사용자가 요청한 제품 | HTML·Markdown 우선 산출물 감지와 게시, 트랜스크립트 카드, 우측 산출물 패널 |
| `publish` 해석 | **현재 대화 안에 산출물을 게시하고 보관**하는 동작. 외부 웹 호스팅·공개 URL 생성은 별도 요구 |
| 이름 제약 | Claude의 정확한 `artifact` 도구명과 혼동하지 않는 Orca 고유 도구 이름 사용 |
| Git 없는 감지 | 산출물 기능이 Git에 의존하지 않는다는 뜻. 현재 Orca의 Git·worktree 기능을 제거한다는 뜻은 아님 |
| Cowork·OpenCode·SRT | 향후 연결 가능한 책임 경계를 준비. 해당 기능의 구현이나 호환 완료 판정은 이번 범위 밖 |
| HTML JavaScript | 사용자 선택 미확정. 아래는 **정적 HTML 우선 권고**이며, 상호작용 필수라면 미리보기 단계의 범위가 달라짐 |
| 구현 시작 | 사용자 승인 이후 별도 핸드오프에서 Decision·AC·검증 pair를 확정한 뒤 진행 |

## 2. 첨부안의 채택·수정 판정

| 첨부 내용 | 판정 | Orca에서 필요한 보완 |
|---|---|---|
| `FileChange → Candidate → Artifact` | 채택 | 파일 변경, 도구와의 관련성, 결과물로 제공할 의도를 서로 구분. 후보를 자동 게시하지 않음 |
| Write 경로를 hook에서 수집 | 조건부 채택 | `tool_input` 런타임 검증, 성공·실패 구분, 실제 파일 재확인, Edit 포함. 경로를 안다는 사실이 완성된 결과물이라는 뜻은 아님 |
| Bash 명령 문자열만으로 결과 파일 추론하지 않음 | 채택 | 문자열은 힌트로만 사용 가능. 인터프리터·실행 파일 내부 쓰기를 완전하게 복원할 수 없음 |
| 단일 전역 `activeBash` | 수정 필수 | 세션·채널 세대·턴·도구 실행 식별자를 가진 실행별 관측 구간으로 분리. 시간 겹침만으로 생성 주체를 단정하지 않음 |
| 세션 생성 시각 이후 최근 파일 검색 | 주 감지기로 부적합 | 오래 열린 세션, 사용자 저장, 다른 세션 쓰기, 결과 수 제한, 보존된 mtime 때문에 오탐·누락 발생 |
| watcher + manifest | 후속 단계에 채택 | watcher는 후보 알림, 재조사는 현재 상태 확인. 어느 쪽도 작성 주체나 작업 완료를 증명하지 않음 |
| 전체 트리 해시를 매번 비교 | 최소안에서 제외 | 대상 범위를 좁히고 변경 후보만 읽음. 전체 해시는 큰 워크스페이스와 동시 턴에서 I/O·CPU 비용을 중복 발생시킴 |
| `Stop` / `turn.ended` 정산 | 수정 필수 | 정상 완료 외에 실패·사용자 중단·채널 교체·세션 종료, 늦게 끝나는 백그라운드 작업을 별도 취급 |
| `dist/build/tmp` 등 제외 | 감지 정책으로 채택 | 자동 탐색 제외와 게시 권한 거절을 분리. `dist/report.html`을 명시적으로 게시하는 정상 사용까지 막지 않음 |
| `present_artifact` 같은 명시 도구 | 가장 먼저 구현 | 경로 검증 → 불변 저장본 확보 → 대화와 함께 영속화한 시점을 게시 성공 기준으로 삼고, 이후 화면에 알림 |
| 단계적 구현 | 재구성 필요 | 첨부의 최소안은 감지기 중심. 사용자에게 보이는 게시·복원·미리보기·다운로드까지의 수직 구현 단계가 필요 |

### 외부 사례의 근거 범위

- 첨부의 **OpenCowork**는 정확한 저장소·커밋이 명시되지 않았다. `listRecentFiles(cwd, session.createdAt, 50)`가 실제 해당 구현이라는 점은 확인하지 못했으므로 근거에서 제외한다.
- `cowork-harness`의 `preRunPaths`·`preRunHashes`는 실행 전후 검증과 assertion의 근거로 확인된다. 이를 실제 Cowork의 도구별 산출물 게시 구현이라고 해석하면 범위를 넘는다. [cowork-harness SPEC](https://github.com/yaniv-golan/cowork-harness/blob/main/SPEC.md)
- OpenCode에 watcher 사용 사례가 있어도 Orca에 같은 라이브러리가 필수라는 근거는 아니다. 확인한 개발 브랜치의 전체 워크스페이스 감시는 VCS·실험 플래그 조건을 포함한다. [OpenCode watcher 소스](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/filesystem/watcher.ts)

## 3. 현재 코드와 연결할 지점

아래는 검토 기준 커밋에서 확인한 사실이며, 새 기능이 이미 존재한다는 뜻이 아니다.

| 영역 | 현재 코드 근거 | 구현에 미치는 영향 |
|---|---|---|
| 런타임 도구 | [runtime-tools.ts](../../../../app/src/main/adapters/runtime-tools.ts), [runtime-tool-registry.ts](../../../../app/src/main/features/extensions/runtime-tool-registry.ts) | 도구 handler는 현재 입력 객체만 받는다. 전역 registry를 세션별 handler로 덮어쓰는 방식은 다른 세션과 revision에 영향을 줌 |
| Claude 변환 | [claude-runtime-tools.ts](../../../../app/src/main/adapters/claude-runtime-tools.ts), [session-runtime.ts](../../../../app/src/main/features/sessions/session-runtime.ts) | 정적 선언은 유지하고 실행 채널에서 문맥을 결합해야 함. 웜 채널의 이전 턴 closure를 재사용하지 않도록 설계 필요 |
| 구조화 결과 | [claude-map.ts](../../../../app/src/main/adapters/claude-map.ts) | 현재 구조화 출력 보존은 Task 도구군의 특정 경로에 한정. publisher가 `structuredContent`만 반환하면 일반 산출물 영속 카드가 되지 않음 |
| 이벤트와 기록 | [bootstrap.ts](../../../../app/src/main/app/bootstrap.ts), [history/writer.ts](../../../../app/src/main/features/history/writer.ts), [ipc.ts](../../../../app/src/shared/ipc.ts) | 기존 정규 이벤트·history·relay 흐름에 게시 결과를 연결. `file` part는 타입상의 확장점이며 완성된 산출물 모델·렌더러가 아님 |
| 파일 접근 | [workspace-guard.ts](../../../../app/src/main/adapters/workspace-guard.ts), [files.ts](../../../../app/src/main/app/handlers/files.ts) | built-in 파일 도구 가드가 MCP publisher를 대신 보호하지 않음. 기존 첨부 읽기는 이미지용이고, 파일 열기는 저장 대화상자가 아님 |
| 저장·분기 | [queries.ts](../../../../app/src/main/infra/db/queries.ts), [persistence.md](../../../arch/backend/persistence.md), [worktrees/service.ts](../../../../app/src/main/features/worktrees/service.ts) | fork는 현재 part JSON을 복사. 상대 경로만 보관하면 worktree 제거·cwd 변경 뒤 다른 파일을 가리킬 수 있음 |
| 우측 패널 | [ChatTile.tsx](../../../../app/src/renderer/src/features/chat/components/ChatTile.tsx), [RightPanel.tsx](../../../../app/src/renderer/src/features/chat/components/rightpanel/RightPanel.tsx), [tileRegistry.ts](../../../../app/src/renderer/src/features/chat/components/rightpanel/tileRegistry.ts) | 실제 호스트와 타일 조립 지점이 이미 있음. 새로운 패널 프레임워크는 불필요 |
| 턴 카드 | [AssistantTurn.tsx](../../../../app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx), [turns.ts](../../../../app/src/renderer/src/features/chat/lib/turns.ts), [parts.ts](../../../../app/src/renderer/src/features/chat/lib/parts.ts) | 일반 도구 출력 내부가 아니라 해당 assistant 턴의 게시 묶음으로 투영. 비교 함수·리듀서·재조회 변환도 함께 연결해야 함 |

현재 패널 진입점은 [rightPanelTiles.ts](../../../../app/src/renderer/src/features/chat/lib/rightPanelTiles.ts)가 갖는다. 0205의 작업 타일 정지 상태를 현재 상태로 적용하면 안 된다. 현재는 작업 타일 진입점이 복구되어 있으므로, 기존 작업 UI에 임시로 끼워 넣지 않고 별도 `artifacts` 타일을 추가하는 편이 명확하다.

## 4. 게시 도구와 실행 문맥

### 4.1 이름과 모델이 보는 계약

**권고 이름은 `publish_artifact`, MCP 서버 식별자는 `orca_artifacts`**다. Claude가 보는 완전한 이름은 `mcp__orca_artifacts__publish_artifact`, UI 명칭은 **산출물**로 제안한다. `publish_output`도 가능하지만 같은 기능의 별칭 도구를 동시에 등록하지 않는다.

공식 SDK의 사용자 정의 도구는 MCP 서버 이름으로 구분된다. 확인한 자료에서 `artifact` 문자열 전체를 사용자 도구에 금지하는 규칙은 찾지 못했다. 설치된 SDK 타입에는 `enableArtifact`·`disableArtifact` 설정이 있지만, 그것만으로 Orca에서 내장 도구의 가용 범위나 충돌 여부를 확정할 수는 없다. **이름을 분리하고 실제 도구 목록을 확인하며, 내장 Artifact 설정을 임의로 끄지 않는 것**이 적절하다. [Claude 사용자 정의 도구](https://code.claude.com/docs/en/agent-sdk/custom-tools), [도구 정의](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)

| 항목 | 제안 계약 |
|---|---|
| 모델 입력 | `path` 필수, `title` 선택. 단일 파일부터 시작. 상대 경로는 실제 실행 cwd 기준 |
| 모델이 정하지 않는 값 | 세션·턴·실행 식별자, 저장 경로, 게시 소유권, 외부 URL, 임의 MIME |
| 성공 결과 | `publicationId`, 파일명·종류·제목·크기 등 제한된 메타데이터. 본문 전체나 내부 저장 경로는 모델 결과에 넣지 않음 |
| 실패 결과 | `isError: true`와 수정 가능한 원인. 범위 밖·미지원 형식·변경 중·크기 초과·취소·저장 실패 구분 |
| 도구 설명 | 사용자가 받을 결과물이 완성된 뒤 호출. 기존 파일도 게시 가능. 파일 생성·웹 배포를 대신하는 도구는 아님 |
| 권한 | 현재 도구 승인 경로를 유지. 로컬 기록을 생성하는 동작을 `readOnlyHint: true`로 위장하여 우회하지 않음. 별도 자동 승인 정책은 사용자 결정 대상 |

도구 이름의 소유권 충돌은 등록 시 드러나야 한다. 같은 server ID를 플러그인이 나중에 덮어써도 조용히 다른 handler가 실행되는 상태를 허용하지 않는다. 이 보강은 고유 이름의 충돌 검사 범위로 제한하고 새 플러그인 관리 체계를 만들지 않는다.

### 4.2 세션을 안전하게 연결하는 최소 보강

정적 도구 선언과 **호스트가 제공하는 호출 문맥**을 분리한다. 문맥에는 최소한 실제 DB 세션, 실행 cwd와 허용 루트, 채널 세대, 턴 또는 백그라운드 작업의 소유권, 취소 신호가 필요하다. provider의 hook 식별자는 adapter 안에서 대응시킨다.

- 모델 인자의 `sessionId`나 현재 화면에서 선택한 세션을 권한 근거로 삼지 않는다.
- 채널별 실행 래퍼가 호출 시작 시 문맥을 포착하고, 저장 확정 직전에 유효성과 취소를 다시 검사한다.
- 가능한 경우 원래 도구 실행과 소유 메시지도 결합한다. steer 입력 소비로 현재 assistant 메시지가 바뀌어도 지연된 게시를 새 메시지에 임의로 붙이지 않는다.
- 웜 채널에는 해당 호출의 문맥을 전달한다. 실행 중 전역 registry를 교체하거나 종료된 턴의 closure를 계속 사용하지 않는다.
- MCP SDK의 callback 부가 인자에 Orca의 `toolRunId`가 있다고 가정하지 않는다. 실제 hook·도구 호출 대응이 없으면 그 정보를 조작해 채우지 않는다.
- 백그라운드/서브에이전트 호출의 원래 소유권을 확인할 수 없다면 새 턴에 붙이지 않는다. 첫 단계는 이 경우 명확한 미지원 오류를 반환하고 부모 실행이 게시하도록 한다. 자동 연결은 별도 검증을 거쳐 확대한다.

**A 단계의 첫 연결 검증은 안정적인 호출 식별자 확보**다. 매 callback마다 생성한 새 UUID는 재전달을 식별하지 못하고, path/hash만으로 합치면 의도한 재게시를 지워버린다. 동일한 신뢰 호출 ID의 재전달과 모델이 새 도구 호출로 재시도한 경우를 구분해야 한다. 이 연결이 확인되기 전에는 재전달 멱등성이 확보됐다고 판정하지 않는다.

## 5. 저장·게시·복원 계약

### 5.1 기존 저장 결정을 유지한다

현재 [persistence.md §1](../../../arch/backend/persistence.md)와 [TRD](../../../TRD.md)는 **본문은 `<userData>/artifacts/` 파일, DB에는 경로·해시·크기 등 메타데이터**를 두는 방향을 명시한다. 이 제안도 이를 따른다. SQLite BLOB은 단일 트랜잭션의 장점이 있지만 기존 결정을 바꾸며 DB·WAL·동기 쓰기 부담도 늘리므로 이번 기본안으로 삼지 않는다.

권고는 **게시 시점의 불변 사본**이다. 트랜스크립트와 다운로드는 그 사본을 사용한다. 원본을 나중에 수정·삭제하거나 worktree가 사라져도 과거 게시물은 바뀌지 않는다. 원본 위치 열기는 별도 액션이다.

```text
publish_artifact(path, title?) + 호스트 호출 문맥
  → 경로·종류·크기·호출 소유권 검증
  → 제한된 파일 읽기와 저장본 준비(temp → rename)
  → 메타데이터 + 소유 메시지 part를 DB transaction으로 확정
  → 기존 이벤트 경로로 게시 사실 전달
  → 모델에 성공 결과 반환
```

이 흐름은 **FS와 DB 전체가 하나의 원자적 트랜잭션이라는 뜻이 아니다.** 준비된 파일이 있고 DB 참조도 커밋된 상태를 게시의 기준으로 삼는다. DB 실패 시 UI·모델에 성공을 알리지 않고 미참조 파일을 정리한다. 파일 준비 뒤 프로세스가 종료되면 다음 정리 시 회수할 수 있어야 한다. 커밋 뒤 알림이 유실된 경우에는 재조회로 복원한다. 같은 신뢰 호출 ID가 재전달되면 이미 확정한 결과를 반환한다.

| 계약 | 권고 |
|---|---|
| 식별 | 게시 행위 ID와 불변 저장본 ID를 구분. 메시지 part에는 제한된 카드 메타데이터와 참조만 저장 |
| 버전 | 같은 세션·원본 위치의 새 내용은 새 저장본. 이전 턴 카드는 이전 저장본을 유지하고 패널 목록은 최신 게시를 기본으로 표시 |
| 중복 | 같은 신뢰 호출 ID의 재전달은 멱등 처리. 새 호출은 별도의 게시 의도로 취급하고 해당 턴에 참조를 남김. 같은 턴의 동일 저장본 카드는 표시 단계에서 묶을 수 있음. 내용이 같으면 기존 저장본 재사용 가능 |
| 제목 | 기본은 파일명, 모델 제목은 길이를 제한하고 일반 텍스트로 표시. HTML로 렌더하지 않음 |
| 읽기·저장 API | renderer가 `sessionId + publicationId`로 요청하면 Main이 소유권을 확인. 임의 절대 경로 읽기·쓰기 API를 노출하지 않음 |
| 세션 재조회 | 카드 메타데이터만 로드. 미리보기 본문은 선택 시 읽고 선택·세션 변경 뒤 도착한 응답은 폐기 |
| 실패·취소 | 확정 전 실패는 미게시. 확정 후 전송 취소는 이미 저장된 게시 사실을 삭제하지 않음. 이 경계가 UI와 재시도에서 같아야 함 |
| 보관 | 자동 기간 만료를 도입하지 않고 참조하는 대화가 있는 동안 보관하는 안을 권고. 삭제·정리 정책은 기존 미정 항목이므로 승인 필요 |

### 5.2 fork·삭제와 실패 복구

현재 fork는 메시지 part를 DB transaction에서 복사한다. 이에 맞춰 **불변 파일은 공유하고, 자식 세션의 게시 참조를 같은 transaction에서 복사**하는 안을 권고한다. 별도의 전역 참조 횟수 서비스 없이 살아 있는 참조가 있는지 SQL로 확인할 수 있다.

`<artifacts>/<원래 세션>/` 아래에 파일을 배치해도 그 디렉토리 이름을 독점 소유권으로 해석해서는 안 된다. 원본 세션 삭제 시 폴더 전체를 지우면 fork 카드가 깨진다. 마지막 참조가 사라진 저장본만 정리하고, 사용자가 내보낸 복사본과 워크스페이스 원본은 정리 대상에 넣지 않는다. handoff의 기존 이력 미복사 정책도 임의로 바꾸지 않는다.

정리와 게시/fork는 경쟁할 수 있다. 준비 중인 파일 제외, 참조 재검사와 삭제의 순서, 정리 실패의 재시도, 앱 중단 뒤 고아 파일 회수를 제한된 저장 모듈에서 처리해야 한다. **공유 보관·GC는 기존 문서의 미정 항목**이므로 이 안을 채택하는 결정 행이 구현 전에 필요하다. 과거 대화에 없는 게시물을 디스크 스캔으로 임의 복원하지 않는다.

불변 저장본은 앱이 게시 뒤 덮어쓰지 않는다는 계약이다. 앱 밖의 삭제·변조를 막는다는 뜻은 아니므로 읽기 시 크기·해시 불일치는 손상 상태로 처리한다. DB 조회 실패를 ‘참조 없음’으로 해석해 파일을 삭제하지 않는다.

### 5.3 경로와 파일 검증

- 실제 실행 cwd와 승인된 추가 참조 루트에 속하는 일반 파일만 대상으로 한다. Windows 대소문자·경로 구분자·junction/symlink의 실제 경로를 확인하고 `..`, 루트 이탈, 디렉토리, 장치 경로·ADS 등 파일 외 대상을 거절한다. UNC는 승인 루트와 I/O 실패·취소 처리를 포함해 별도 검증한다.
- `.html/.htm/.md`와 UTF-8 텍스트를 첫 범위로 제안한다. 확장자만 믿지 않고 바이트 제한·텍스트 유효성을 검사한다. HTML 안전성은 파일 형식 검사가 아니라 미리보기 경계가 담당한다.
- 일반 workspace 읽기에서 허용하는 `.claude`나 앱 설정·자격증명 예외를 게시 권한으로 승계하지 않는다. 감지 제외 목록과 민감한 경로의 게시 거절 규칙도 분리한다.
- 읽는 동안 파일이 바뀌면 제한적으로 재시도하거나 ‘변경 중’으로 실패한다. 크기·mtime 확인만으로 동일 내용이나 생산자 완료를 보증하지 않는다. 확인한 바이트의 해시와 저장본을 결합한다.
- 최초 단일 파일 상한은 **5 MiB를 검증 시작값으로 제안**한다. 확정된 제품 제한이나 성능 보증이 아니다. 파일 전체를 무제한 읽은 뒤 크기를 검사하지 않는다.

## 6. 감지 단계의 구체화

### 6.1 직접 감지부터 연결

Write/Edit 성공의 명확한 경로를 후보로 기록한다. 입력 스키마를 확인하고 작업 범위·지원 형식·실제 파일 존재를 검사한다. 후보에는 경로뿐 아니라 관측 출처와 원래 실행 문맥을 보관한다. 도구 실패 이후 파일이 남았더라도 ‘완료된 산출물’로 승격하지 않는다.

첫 후보 소비자는 **모델에 제공하는 제한된 결과물 경로 힌트**로 제안한다. 모델이 `publish_artifact`로 결과 제공 의도를 확정한다. 후보만으로 트랜스크립트 완료 카드나 우측 ‘게시된 산출물’을 만들지 않는다. 수동 후보 목록·‘게시’ 버튼은 필요가 확인되면 추가하며 첫 화면에 상태 체계를 더 만들지 않는다.

명시적 게시에는 후보 등록을 선행 조건으로 두지 않는다. Bash로 만든 파일도 모델이 경로를 알면 바로 게시할 수 있다. 감지 실패가 게시 실패로 이어지지 않도록 한다.

### 6.2 Bash와 변경 관측

| 문제 | 보완 방식 |
|---|---|
| 실행 겹침 | 도구 실행별 관측 구간을 유지. 같은 변경이 여러 구간과 겹치면 관련성 불명으로 남김 |
| 동일 workspace의 여러 세션 | 정규화한 물리 루트의 watcher는 공유 가능하되, 후보·소유권은 세션별. 이벤트를 모든 실행의 생성물로 표시하지 않음 |
| baseline과 watcher 시작 사이 공백 | watcher 연결 후 초기 조사 동안 이벤트를 버퍼링하고 한 번 재조정. 매번 완전한 전역 스냅샷을 요구하지 않음 |
| rename·atomic save·누락 | 이벤트를 경로별로 병합한 뒤 현재 파일을 다시 확인. rename을 확실히 알 수 없으면 삭제·생성으로 기록 |
| 같은 크기·mtime 내용 변경 | 이벤트 경로와 게시 시 읽는 대상은 실제 바이트를 확인. 메타데이터가 같은 모든 미관측 변경의 완전 감지는 보장하지 않음 |
| 도구 종료와 파일 완성 불일치 | background 완료 이벤트와 원래 실행 문맥을 추적. `PostToolUse`가 producer 종료를 항상 뜻한다고 가정하지 않음 |
| 중단·오류 | 정상 완료뿐 아니라 실패·취소·채널 종료에서 관측 상태 해제. 남은 파일은 미완료 후보일 수 있음 |
| 과대 워크스페이스 | 제외 경로를 탐색 진입 전에 걸러내고 시간·파일 수·후보 수 예산을 적용. 제한 도달을 기록하며 조용히 ‘감지 완료’로 표시하지 않음 |

Claude의 `Stop`은 사용자 중단 시 실행되지 않고 API 오류에는 `StopFailure`가 별도로 존재한다. 백그라운드 작업은 응답 종료 뒤에도 남을 수 있다. Orca의 종료·취소 수명과 함께 사용해야 하며 hook 하나로 정산을 끝내면 안 된다. [Claude hooks](https://code.claude.com/docs/en/hooks)

watcher 도입은 별도 단계에서 선택한다. Windows의 `fs.watch`는 추가 의존성이 없지만 누락·이동·네트워크 파일시스템 제약이 있다. Chokidar의 write-finish 대기는 polling 비용과 지연을 수반하며 의미상 완료 보증이 아니다. Parcel은 네이티브 배포·패키징 검증이 추가된다. **첫 단계에서는 어느 watcher도 추가하지 않고**, 요구 범위의 정확도·비용 측정 후 한 가지를 고른다. [Node fs.watch](https://nodejs.org/api/fs.html#fswatchfilename-options-listener), [Chokidar](https://github.com/paulmillr/chokidar), [Parcel watcher](https://github.com/parcel-bundler/watcher)

## 7. 이미지 레퍼런스를 Orca UI로 옮기는 방식

### 7.1 화면과 기존 컴포넌트

| 표면 | 적용안 | 재사용 근거 |
|---|---|---|
| 트랜스크립트 | assistant 턴 본문 아래, 메타 액션 위에 게시된 산출물 카드 묶음. 게시 확정 이벤트가 오면 표시하며 턴 전체 완료까지 기다릴 필요 없음 | [AssistantTurn](../../../../app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx) |
| 산출물 카드 | 문서/코드 아이콘, 제목, 파일명·형식·크기, 미리보기 액션, 저장 메뉴. 같은 카드를 트랜스크립트와 패널 목록에서 사용 | [Button](../../../../app/src/renderer/src/shared/ui/Button.tsx), [Popover](../../../../app/src/renderer/src/shared/ui/Popover.tsx), [MenuItem](../../../../app/src/renderer/src/shared/ui/MenuItem.tsx) |
| 우측 목록 | 기존 타일 호스트에 `artifacts`를 등록. 헤더 ‘산출물’과 ‘모두 저장’, 본문은 현재 세션의 게시 목록 | [RightPanelTile](../../../../app/src/renderer/src/features/chat/components/rightpanel/RightPanelTile.tsx), [tileRegistry](../../../../app/src/renderer/src/features/chat/components/rightpanel/tileRegistry.ts) |
| 미리보기 | 카드 선택 시 **같은 타일**을 상세 화면으로 전환. 제목·종류·버전, 목록으로 돌아가기, 저장, 원본 위치 액션 | 기존 헤더 content/actions 조립 지점 |
| Markdown | 기존 ReactMarkdown·GFM 표시와 코드 블록 활용. 상대 자산과 raw HTML은 별도 계약 없이는 활성화하지 않음 | [Markdown](../../../../app/src/renderer/src/shared/ui/markdown/Markdown.tsx) |
| HTML 원문 | 선택할 때만 기존 코드 표시 컴포넌트 활용. 큰 본문은 하이라이트 제한과 일반 텍스트 대안 필요 | 기존 Markdown 코드 블록 경로 |
| 이미지2의 ‘콘텐츠’ | 입력 첨부를 뜻하는 영역으로 해석. 첫 산출물 패널에 같이 구현하지 않음 | 입력 첨부와 게시 출력의 소유권·수명 구분 |

`FileBody`는 Read 도구 출력에 결합되어 있어 범용 뷰어로 재사용하기에 맞지 않는다. 내부 표시 부품만 필요한 범위에서 활용한다. `ToolRendererRegistry`에 publisher 출력만 꾸미는 방식도 게시 목록·버전·재조회 계약을 대신하지 못한다.

### 7.2 토큰·테마·밀도

기준은 [tokens.css](../../../../app/src/renderer/src/styles/tokens.css)와 [renderer 가이드](../../../../app/src/renderer/AGENTS.md)다. 첨부 이미지의 정보 배치와 카드 액션을 참고하고 Orca의 외형을 적용한다.

| 항목 | 권고 |
|---|---|
| 배경·글자·테두리 | `bg-panel`, `bg-bg2`, `text-ink`, `text-ink2`, `border-border` 등 기존 시맨틱 토큰 |
| 강조·선택 | 기존 선택·hover·focus 토큰. 레퍼런스의 보라색 썸네일 전용 색상표를 새로 만들지 않음 |
| 크기·모서리 | 기존 카드·버튼의 반경과 간격 재사용. 고정된 대형 썸네일보다 작은 문서 아이콘과 가변 높이 행 |
| 테마·밀도 | white/dark와 compact/normal/comfortable에 따라 호스트 UI 반영. 정적 스타일은 Tailwind, 새 스타일 체계 불필요 |
| HTML 본문 | 산출물 작성자의 CSS를 보존. 앱 테마는 패널 테두리·툴바에 적용하고 HTML 문서 색을 임의로 덮지 않음 |
| 접근성 | 카드 열기와 저장 버튼을 별도 형제 액션으로 구성하여 중첩 button 방지. 키보드 초점·긴 파일명·아이콘 label·번역 키 지원 |
| hover | `group/artifact` 등 이름 있는 그룹으로 한정하여 턴/다른 카드에 hover 상태가 번지지 않게 함 |

### 7.3 열기·버전·저장 동작

- **게시만으로 패널을 매번 자동으로 열지 않는다.** 카드는 즉시 표시하고 클릭하면 해당 저장본을 연다. 제목 표시줄의 기존 타일 메뉴에서도 산출물 목록에 접근한다.
- 패널은 같은 원본의 최신 게시를 기본 목록으로 보여주되, 과거 턴 카드를 누르면 그 시점의 버전을 연다. 새 게시가 도착해도 사용자가 읽는 버전을 자동 교체하지 않는다.
- 패널 선택 상태는 세션별로 보관한다. 파일 읽기·저장 대화상자 완료가 늦게 도착해도 다른 세션의 선택이나 알림을 바꾸지 않는다.
- 현재 [rightPanelLayout](../../../../app/src/renderer/src/features/chat/lib/rightPanelLayout.ts)은 타일을 추가하면 열을 늘릴 수 있다. 새 타일을 단순 추가하면 작은 창에서 채팅 영역이 밀릴 수 있으므로, **채팅 최소 폭을 남기고 우측 도킹 영역만 제한 폭 안에서 가로 스크롤하며 선택 타일을 노출**하는 안을 권고한다. 기존 타일을 임의로 닫지 않고 순서·리사이즈 상태를 유지한다. 이 폭 정책은 승인 후 설계에서 확정할 UI 변경이다.
- 폭 제한을 적용할 때 현재 외곽 핸들이 **도킹 viewport가 아니라 첫 열의 폭**을 조절한다는 점을 반영한다. viewport와 열의 리사이즈 책임을 구분하고 스크롤 오프셋을 반영해야 한다. 스크롤한 상태에서 핸들을 잡았을 때 폭이 튀는 문제, 드래그 중 스크롤, 열 삭제 애니메이션을 검증한다.
- 화면 밖 타일 노출은 artifacts만이 아니라 기존 타일의 명시적 열기 경로에도 적용한다. 이미 열린 타일을 다시 여는 경우도 처리한다. 게시·백그라운드 갱신은 스크롤을 유지하고, 사용자의 열기 요청 때만 해당 열을 노출하며 창 축소·열 삭제 후 범위를 보정한다.
- 데스크톱 UI 라벨은 ‘다른 이름으로 저장’, ‘모두 저장’, ‘원본 위치 열기’를 권고한다. 원본 위치 열기는 저장본 다운로드와 의미가 다르며 원본 소실 시 비활성/안내 처리한다.
- 묶음 저장은 트랜스크립트에서는 **그 턴의 게시 버전**, 패널 목록에서는 **표시 중인 최신 목록**을 대상으로 한다. 시작 시 대상을 고정하고 폴더를 한 번 선택한다. 이름 충돌은 자동 접미사로 기존 파일을 보존하는 안을 권고한다. 일부 실패·취소 시 실제 저장 성공/실패를 구분한다. ZIP 의존성을 추가하지 않는다.
- 빈 목록, 읽기 중, 게시 실패, 미리보기 미지원, 저장본 누락/손상, 저장 취소 상태를 마련한다. 일시적인 원본 부재가 이미 보관된 산출물의 실패로 표시되어서는 안 된다.

## 8. HTML 미리보기의 경계

HTML은 생성된 파일이더라도 신뢰할 수 없는 콘텐츠다. Orca renderer DOM에 그대로 삽입하거나 기존 preload API를 제공하면 안 된다. Markdown은 기존 렌더러를 재사용할 수 있지만 HTML 미리보기 호스트는 신규 작업이다. Electron은 콘텐츠 격리·Node 비활성·sandbox·CSP·탐색 제한을 함께 적용하도록 안내한다. [Electron 보안](https://www.electronjs.org/docs/latest/tutorial/security)

| 선택 | 권고와 비용 |
|---|---|
| 정적 자체 포함 HTML | **첫 단계 권고.** `sandbox=""` iframe + `srcdoc`를 우선 검토. React 타일의 레이아웃·포커스·제거 수명을 재사용할 수 있음 |
| JavaScript HTML | 첫 버전 필수라면 별도 범위. preload 없는 `WebContentsView`와 독립 비영속 session을 검토. bounds·오버레이·포커스·webContents 해제 비용이 추가됨 |
| 외부 CDN·상대 파일 | 첫 단계의 자동 로드 범위에서 제외. 자체 포함 문서·인라인 CSS·허용된 data 이미지 우선. 원본 파일은 그대로 저장 가능하되 미리보기 제한을 툴 설명과 UI에 표시 |

정적 iframe도 속성 하나로 완성되지 않는다. 현재 [renderer CSP](../../../../app/src/renderer/index.html)는 외부 폰트·이미지 예외가 있고, [main/index.ts](../../../../app/src/main/index.ts)의 새 창 처리는 `shell.openExternal`을 호출한 뒤 창 생성을 거절한다. 따라서 기존 부모 정책을 상속하는 것만으로 ‘외부 접근 없음’이 성립하지 않는다.

**구현 시 필요한 제한과 검증**:

1. 사용자 HTML보다 먼저 앱 소유의 고정 문서 머리와 엄격한 CSP를 적용한다. 출발점은 `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`이다. 이는 검증할 제안 정책이며, 깨진 문서·meta·base가 포함된 입력도 시험한다. 부모 정책은 완화하지 않는다. [CSP 상속과 복수 정책](https://www.w3.org/TR/CSP3/#security-inherit-csp)
2. iframe의 scripts/same-origin/forms/popups/downloads 권한을 허용하지 않는다. 앱 IPC·실행 가능한 postMessage 브리지를 제공하지 않는다. [HTML sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
3. sandbox가 자기 프레임의 모든 탐색을 막는다고 가정하지 않는다. preview 프레임의 탐색과 외부 실행을 Main에서 막되 앱의 정상 링크 동작은 회귀시키지 않는다. 하위 프레임은 `will-navigate`만으로 다룰 수 없으므로 `will-frame-navigate` 경로를 포함한다. [Electron 프레임 탐색](https://www.electronjs.org/docs/latest/api/web-contents#event-will-frame-navigate)
4. HTML 링크·meta refresh·CSS 자산·resource hint·중첩 frame으로 localhost, 외부 HTTP(S), `file:`, 앱 custom scheme에 접근하거나 외부 프로그램을 실행할 수 없는지 실제 Electron에서 관찰한다. data 이미지와 정상 문서 표시도 함께 검증한다.
5. dev와 packaged `app://` 양쪽에서 검증한다. DOM 문자열 테스트만으로 보안·표시 통과를 선언하지 않는다. CSP·프레임 경계를 유지하면서 동작시킬 수 없다면 별도 session의 `WebContentsView`로 전환하고 단계 범위를 재산정한다. [WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences), [WebContentsView 수명](https://www.electronjs.org/docs/latest/api/base-window#resource-management)

이 미리보기 격리는 SRT 같은 프로세스 실행 격리와 다른 책임이다. SRT 보류가 정적 산출물 게시를 막지는 않으며, 반대로 HTML 뷰어가 안전하다고 에이전트의 Bash 실행도 격리되는 것은 아니다.

## 9. 경량 모듈 배치와 확장 경계

| 위치 | 책임 | 경계 |
|---|---|---|
| `main/features/artifacts/` 신규 | 게시 검증·저장본 준비·후보 정책·정적 도구 선언 | 세션/확장/history feature를 직접 import하지 않음. 앱이 필요한 포트 주입 |
| `main/adapters/` 기존 | runtime tool 호출 문맥 결합, Claude hook에서 직접 경로 정보 추출 | Claude SDK 모양은 여기서 소비. renderer나 저장 모델로 SDK 타입을 전파하지 않음 |
| `main/features/history/`, `main/infra/db/` 기존 | 게시 참조와 message part의 단일 영속 경로, fork·조회 | 게시 모듈과 history에서 같은 DB part를 각각 쓰지 않음. 본문은 FS, 기록은 DB |
| `main/app/` 기존 | 조립, IPC 검증, 창/미리보기 경계와 수명 연결 | 별도 전역 서비스 로케이터·범용 이벤트 허브를 만들지 않음 |
| `shared/`, `preload/` 기존 | 게시 DTO·정규 이벤트·좁은 조회/저장 API | 본문을 모든 이벤트에 싣지 않음. raw path 및 임의 IPC 전달을 노출하지 않음 |
| `renderer/features/chat/` 내부 | ArtifactCard, 게시 묶음, artifacts 타일, 선택·미리보기 상태 | 양쪽 표시가 같은 chat 기능이므로 무리하게 별도 renderer feature로 분리하지 않음 |
| `renderer/shared/ui/` 기존 | 버튼·메뉴·아이콘·Markdown 같은 표현 부품 | 산출물 소유권·감지 규칙을 shared UI로 올리지 않음 |

새 `artifact.published` 정규 이벤트와 전용 메시지 part를 제안한다. 모델이 반환한 텍스트를 파싱해 만드는 이벤트가 아니라 **Main이 확정한 게시 사실**이어야 한다. 구체적인 이벤트 생성/영속 경계는 기존 history-before-relay 순서와 맞춘다. DB transaction rollback 뒤 메모리의 `currentAssistantMessageId`가 실패한 행을 계속 가리키지 않는지도 포함한다.

OpenCode 도입 시 재사용 대상은 게시 서비스·저장본·DTO·카드·미리보기다. 새 adapter는 도구 호출의 신뢰할 수 있는 세션 문맥과 감지 정보를 연결해야 한다. SDK가 설치되어 있다는 사실만으로 이 연결이 호환 완료된 것은 아니다. 일반 플러그인도 파일을 생성한 뒤 publisher를 호출할 수 있지만, 임의 `structuredContent`나 파일 링크만으로 게시 권한을 얻지는 않는다.

SRT가 이후 실제 실행 cwd나 파일 접근 경계를 바꾸면 호스트가 주입하는 허용 루트/파일 접근 포트에서 다룬다. 지금 SRT·Cowork·OpenCode를 예측한 범용 플러그인 플랫폼이나 가상 파일시스템을 만들 필요는 없다.

## 10. 단계별 구현안과 완료 기준

| 단계 | 제공 결과 | 완료를 판정할 핵심 증거 |
|---|---|---|
| A. 명시적 게시 수직 구현 | `publish_artifact`, 불변 저장·재조회, HTML/MD 카드, 산출물 타일, 개별/묶음 저장, Markdown 및 정적 HTML 미리보기 | 먼저 신뢰 호출 ID·문맥 전달을 확인하고 실제 도구 호출부터 카드·패널·재시작 복원까지 연결. 동시 세션 귀속, 권한·HTML 경계, fork·삭제 통과 |
| B. 직접 경로 후보 | Write/Edit 성공 경로를 후보로 기록하고 모델에 제한된 힌트 제공 | 실패·중단·미지원 파일은 게시되지 않음. 기존 파일 수정과 재게시, 후보 없는 명시적 게시 모두 정상 |
| C. Bash 감지 보강 | 범위와 예산이 있는 재조사, 필요 시 단일 watcher 구현 | 동시 실행·외부 수정·rename·누락·백그라운드·큰 트리에서 오귀속/무한 조사/누수 없음. 감지 범위의 한계를 표시 |
| D. 요구에 따른 확대 | 상호작용 HTML, 상대 자산 묶음, 추가 형식 또는 후보 수동 게시 | 각 기능의 실행·수명·자산 권한 계약을 추가. OpenCode·Cowork 전체 구현과 한꺼번에 묶지 않음 |

**A만 끝나면 ‘게시 기능의 최소 사용 가능 상태’이며, 자동 감지 요구까지 완료했다고 보고하지 않는다.** HTML JavaScript가 첫 버전 필수라는 결정이 오면 D의 해당 부분을 A로 이동한다. A에서 HTML을 카드·다운로드만 가능하게 만들고 미리보기까지 끝났다고 판정하지 않는다.

### 회귀·성능 검증에 포함할 사례

| 축 | 필수 사례 |
|---|---|
| 실행 소유권 | 동시에 다른 세션에서 동일 파일명 게시, 웜 채널 다음 턴, 취소 직전/직후, 지연된 도구 callback, 귀속 불명 background 호출 |
| 파일 경계 | 허용/비허용 루트, junction 이탈, 상대 경로, 경로 대소문자, 삭제·rename, 대형/비텍스트 입력, 읽는 중 변경, 디스크 부족 |
| 영속성 | snapshot 준비 전후·DB commit 전후 실패, relay 유실 후 재조회, 재시도 중복, 원본 삭제, fork 뒤 원본 세션 삭제, 정리와 게시 경쟁 |
| UI·테마 | white/dark, 밀도, 긴 한글 파일명, 카드/저장 클릭 분리, 키보드, 좁은 창과 모든 기존 타일 동시 표시, 목록/상세 전환 |
| 대화 성능 | 게시 이벤트가 과거 모든 턴을 재렌더하지 않음. memo 비교 갱신, 늦게 추가된 카드 높이와 transcript 가상화·스크롤 앵커 회귀 없음 |
| 본문 비용 | 목록·세션 전환에서 본문 선로딩 없음. 선택한 뷰어만 유지. 큰 Markdown·HTML과 코드 하이라이트의 제한·취소·캐시 해제 확인 |
| 감지 비용 | 유휴 워크스페이스의 주기 전체 scan 없음. 후보별 병합, 제한된 병렬 I/O, 감시 해제, 예산 초과·네트워크 경로 오류 뒤 정상 도구 실행 유지 |
| HTML | §8의 실행·요청·탐색·IPC 차단 및 정상 문서 표시를 실제 Electron dev/packaged 환경에서 관찰 |
| 운영 게이트 | 유효 핸드오프의 UT/IT/ST/AT, 타입·lint·경계 규칙, 문서/IPC·migration 게이트, 영향 있는 빌드·패키징 검증 |

성능 수치를 이번 읽기 검토로 보증하지 않는다. 승인 후 대표 워크스페이스·긴 대화·상한 크기 파일을 고정해 baseline과 비교하고, 허용 예산을 계획에 기입한다. 저장·스캔 I/O를 동기로 Main 이벤트 루프에서 반복하거나 HTML 썸네일을 카드마다 실행하지 않는 것이 우선이다. 새 worker·watcher·캐시 계층은 계측으로 필요가 확인된 경우에만 추가한다.

## 11. 승인 시 확정할 결정

| 결정 | 권고안 | 미확정인 이유 |
|---|---|---|
| HTML 실행 범위 | 정적 자체 포함 HTML 먼저, JavaScript·외부 자산 후속 | 상호작용 필요 여부에 대해 사용자 답변 대기 |
| 보관과 분기 | 불변 FS 저장본, fork 참조 유지, 마지막 참조 삭제 후 정리 | 기존 persistence의 GC 미정 항목을 구체화하는 제품/데이터 수명 결정 |
| 패널 열기·폭 | 게시 시 자동 열기 없음, 클릭으로 상세, 좁은 창은 도킹 영역 제한+가로 스크롤 | 기존 타일과 새 패널이 공존하는 UX 결정 |
| 지원 제한·저장 | UTF-8 HTML/MD, 파일 상한 검증 시작값 5 MiB, 묶음 저장 시 이름 접미사 | 실제 산출물 크기와 사용 흐름에 맞춰 승인·측정 필요 |
| 도구 승인 | 기존 승인 정책 적용 | 새로운 사전 승인 정책을 이번 기능에서 단독 결정하지 않음 |

이 문서의 제안을 승인한 뒤 해당 단계의 핸드오프를 만들고, 위 결정을 반영해 구현 범위를 `READY`로 확정한다. 현재 단계의 산출물은 이 검토 보고서이며 기능 구현·새 의존성 도입·원격 게시를 포함하지 않는다.
