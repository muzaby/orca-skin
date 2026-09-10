# 0226 후속 동작 및 Windows CI — Delta V6

READY · Codex · 2026-09-10 · 기준 `769cd454`. 사용자 후속 요구와 CI red gate를 같은 0226 r5에서 처리한다. V1~V5의 비충돌 계약과 독립 verify pending을 승계한다.

## 결정과 사용자 결과

| 결정 | 출처와 계약 |
|---|---|
| D-30 ACTIVE | 최근 대화도 접을 수 있어야 한다. 모든 최근 대화(임시 대화 포함)는 같은 그룹 하위에 놓고 표시용 프로젝트 prefix를 제거한다. 제목 자체의 `/`는 유지한다. |
| D-31 SUPERSEDED → D-36 | 일반/아티팩트 카드는 해당 assistant 턴의 마지막에 모은다. 확정 본문과 live 본문 아래에 spark/status, 그 뒤 완료 메타와 카드가 온다. **배치 순서는 [Delta V7](correction-plan-r6.md)로 대체한다.** 배경 대기 때 spinner를 숨기는 D-11은 유지한다. §13.2의 일반 출력 세션 최하단 배치를 대체한다. |
| D-32 ACTIVE | 일반 산출물은 Windows OS 사용자 Temp의 실제 파일을 읽고 열고 저장한다. 관리 아티팩트 디렉터리 사본을 일반 파일의 읽기 원본으로 사용하지 않는다. 외부 게시 아티팩트의 관리 사본은 유지한다. |
| D-33 SUPERSEDED → D-35 | 앱의 Claude 대화 기본 정책은 Bash·WebSearch 제외, PowerShell 허용이다. **PowerShell 자동 허용은 [Delta V7](correction-plan-r6.md)의 노출/승인 분리로 대체한다.** 관리 provider 설정 템플릿과 실행 설정에 `env.CLAUDE_CODE_USE_POWERSHELL_TOOL="1"`, `skipWebFetchPreflight=true` 기본값을 제공한다. 기존의 명시 환경/설정 우선순위는 보존한다. completion의 도구 비활성은 유지한다. |
| D-34 ACTIVE | 사용자가 전달한 Vitest red gate를 수정한다. Windows 짧은 경로와 canonical 경로의 같은 파일을 허용하되 경로 탈출은 허용하지 않는다. 현재 계약에 뒤처진 테스트 대역을 보강하고 숨겨진 실행 오류도 검출한다. |

대안 검토: 카드 위치를 수신 시각이나 현재 마지막 메시지로 추정하면 늦은 도구 결과가 다음 턴에 붙는다. 기존 tool ID 및 응답 경계, 영속 artifact part를 재사용한다. 새 DB migration이나 타임스탬프 추정은 도입하지 않는다. 소유권 근거가 없는 과거 일반 출력은 우측 출력 목록에서 계속 제공하며 임의의 과거 턴에 끼워 넣지 않는다.

## 데이터 흐름과 상태

- Write/Edit 또는 Stop 명시 링크 → 제한된 Temp 파일 캡처 → SDK hook 결과 대기열 → SDK result의 telemetry 이전 `output.captured` → HistoryWriter의 소유권 확인/원래 메시지 artifact part → renderer의 같은 메시지 → 해당 턴 footer.
- Write/Edit는 `toolRunId`로 원래 호출 메시지를 찾는다. Stop 결과는 해당 응답 경계를 전달한다. Main에서 검증되지 않은 출력은 renderer에 연결하지 않는다. 오류/취소 시 경계 없는 Stop 출력을 다음 응답으로 넘기지 않는다.
- 일반 파일 capture는 메타데이터만 등록하고 관리 사본을 만들지 않는다. status/preview/save/reveal/trash의 단일 분기에서 category=file은 등록한 Temp 원본을 재검사한다. 파일 소실은 missing, 링크/정션·Temp 밖 경로는 거부한다. 기존 일반 출력도 등록한 원본으로 읽고 사본으로 fallback하지 않는다.
- 동일 파일 재수집은 기존 중복 억제를 유지하되, 현재 턴에서 명시적으로 생성/언급한 출력의 part 연결을 허용한다. 턴 안에서는 publicationId로 중복 제거한다.
- 최근 대화 접힘은 기존 CollapsibleSection의 화면 수명을 따른다. 새 항목 수신이나 route 변경이 사용자의 접힘을 강제로 풀지 않는다.
- provider 신규 설정/seed에는 기본값을 합성한다. 기존 설정 파일을 일괄 수정하지 않고 실행 시 누락된 기본값을 보완한다. 기존 custom > runtime > provider > app > process 우선순위를 보존한다.

## AC와 유효 V

| AC / 노드 | 관측 가능한 결과 |
|---|---|
| AC36 / R36↔AT36 | 최근 대화 접기/펼치기·키보드, 모든 항목의 그룹 소속, 표시 prefix 제거와 실제 제목 보존 |
| AC37 / R37↔AT37 | 확정/live 본문→spark→카드 순서, 여러 턴·늦은 출력·reload에서 원래 턴 footer 유지, 일반/게시 동일 카드 액션 |
| AC38 / R38↔AT38 | 일반 파일 작업은 실제 Temp 원본에서 동작하고 관리 사본을 만들지 않음. 게시 아티팩트는 기존 관리 파일 유지. 삭제/교체/권한·범위 실패를 구분 |
| AC39 / R39↔AT39 | Work/Code SDK query의 deny/allow 및 신규·기존 실행 설정 기본값, 명시 설정 우선순위, completion 도구 없음 유지 |
| AC40 / R40↔AT40 | 전달된 CI 테스트가 Windows 실제 경로 및 현행 런타임/부팅 계약으로 통과하고 미등록 파일·정션 탈출은 계속 거부 |

| Pair | requiredness / 경로 / 직접 oracle |
|---|---|
| VP70~74 | REQUIRED · NEW R36~40↔AT36~40 · 위 AC의 native DOM/실파일/실제 query 옵션/실제 handler 실행 |
| VP75 | REQUIRED · NEW AR9↔IT9 · hook→SDK result→HistoryWriter→DB part→reducer의 일반 출력 연결, 도구 ID/응답 경계/중복/다른 세션 검증 |
| VP76 | REQUIRED · NEW MD11↔UT11 · Temp inspect 및 renderer footer 조립, 짧은 경로 canonicalization와 대역 오류 검출 |
| VP77 | REGRESSION · R6~8·R10~12↔해당 AT · 게시 소유권/격리 preview/save/trash, 배경 idle와 출력 액션 수명 |
| VP78 | REGRESSION · R19~30↔해당 AT · 고정됨→프로젝트→최근 순서 및 프로젝트/최근 탐색 |

선택 적대 증거: 없음. 실제 이벤트·DOM 순서·실파일과 실제 호출 인자로 검증한다. 비영향 패널 리사이즈·카탈로그 탭 전체 회귀는 V5 증거를 승계한다.

## §10 강제 지점과 구현 경계

| EP | 언제 강제 / 지점 | 실패 의미 |
|---|---|---|
| EP28 | Sidebar 그룹·draft 행·저장 대화 행 / 3 | 그룹 밖 항목 또는 프로젝트 prefix 잔존 |
| EP29 | hook 수집·SDK drain·history 연결·live reducer·reload part·AssistantTurn footer / 6 | 다음 턴 오귀속, 중복, 카드 뒤 본문/spark |
| EP30 | ordinary capture·status·preview/export·reveal·trash / 5 | Temp 대신 관리 사본 읽기 또는 범위 우회 |
| EP31 | conversation query·completion query·설정 조립·신규 scaffold/seed·provider template·system header / 6 | Bash 지침 잔존, WebSearch 노출, env 우선순위 변경 |
| EP32 | session cwd·extraDirs·정확한 첨부·runtime fixture·bootstrap catalog / 5 | 8.3 경로 오거부, 미등록/정션 허용, 오류 은폐 |

Renderer는 기존 `ArtifactCards`와 `CollapsibleSection`을 사용한다. Main은 `TurnExtensions.outputFiles.capture` 반환값 및 hook 콜백으로 수집 결과를 정규화 스트림에 합친다. DB의 기존 message/tool 연결과 artifact part 포맷을 사용하며 일반 출력 전용 링크 검증은 게시 도구의 영수증 검증과 구분한다. 코드 경로의 category 분기와 제한 읽기는 한 서비스 내부에 모은다.

## 운영 gate와 READY 검토

영향 Vitest, main/web/test typecheck, 변경 TypeScript ESLint/Prettier, doc inventory/test budget/whitespace, Electron 빌드, 실제 SQLite 경로 검사와 native DOM 순서를 확인한다. 현재 Electron ABI를 유지하며 Node용 rebuild는 하지 않는다. 신규 의존성은 없다. 설계와 구현 커밋을 분리하고 현재 원격 브랜치에 푸시한다.

r5 handoff-review는 DIAGNOSE_ONLY. 새 사용자 배치/정책 결정과 CI 대역 drift를 기존 재구현 불변식에 반영한다. 스킬/AGENTS 수정은 필요 없다. D30~34→AC36~40→VP70~78→EP28~32를 대조했고 구현 가능한 경계와 실패 oracle을 확정했다.

## [구현자 기입] 결과

AC36~40 자기확인 5/5. [r5 구현 보고](impl-r5.md)에 EP28~32 전수, VP70~78 증거, 구현 중 발견한 경계 사례와 운영 gate를 기록했다. 독립 verify pending.
