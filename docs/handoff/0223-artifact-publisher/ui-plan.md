# ΔV1 — 작업 패널 출력 통합

작성자: Codex. 상태: **READY — 확정 UI 범위**. 일반 생성물의 수집 기준(Q-04)은 사용자 답변 대기이며 이 경로는 구현을 시작하지 않는다.

기준은 `0223:V1 rev.4@dd378d34`이고 유효 V는 기준 V + 본 ΔV1이다. 기존 도구 호출·파일 보관의 미완료 인수 결과는 그대로 남는다.

## Part I — Product & UX Contract

### 1. 결정과 범위

| ID | 결정 | 상태 / 출처 |
|---|---|---|
| D-020 | 독립 `산출물` 타일을 제거하고 `작업` 타일 안의 `진행 상황 / 출력 / 컨텍스트`를 복원 | ACTIVE. 사용자 최신 지시. D-004의 우측 배치 및 0213의 섹션 숨김을 대체 |
| D-021 | 게시된 아티팩트는 출력 목록의 작은 행으로, transcript는 문서 아이콘·제목·형식·다운로드 버튼이 있는 카드로 표시 | ACTIVE. 사용자 최신 지시와 첨부 사진. 기존 시맨틱 토큰·파일 액션 재사용 |
| D-022 | 컨텍스트는 영역만 복원. 참조 리소스 수집·항목 표시는 다음 단계에서 설계 | ACTIVE. 사용자 “아직 설계조차 안되엇음. 다음 스텝에서 진행” |
| D-023 | 일반 생성물도 출력에 표시하되 발견/등록 기준은 Q-04 답변 후 확정 | OPEN. 성공한 파일 도구 관측과 명시적 모델 등록은 서로 다른 제품 결과 |

Q-04: 일반 생성물을 성공한 파일 생성 도구 결과에서 찾을지, 모델의 명시적 등록만 받을지 질문했다. 답변 전 일반 파일을 아티팩트로 승격하거나 watcher를 추가하지 않는다.

목표는 게시 기능을 기존 작업 화면에 결합하는 것이다. 기존 D-001~003·005·007~008·011~019 중 배치 외의 도구·보관·권한·수명·뷰어 후속 계약을 유지한다.

### 2. 사용자 흐름

`대화 상단 타일 메뉴 → 작업 → 진행 상황 / 출력 / 컨텍스트` 순서로 보인다. 각 섹션은 독립적으로 접을 수 있고 작업 상세/뒤로가기는 기존 흐름을 유지한다.

publisher 성공은 출력 목록을 갱신하고 원래 호출 턴에 카드가 붙는다. 출력 목록은 compact 행, transcript는 넓은 문서 카드이며 파일 액션은 같은 게시 ID를 사용한다.

| 상태 | 표시 / 동작 |
|---|---|
| 게시 전 | 출력 빈 상태. 컨텍스트에는 아직 수집하지 않는 상태를 짧게 표시 |
| 정상 파일 | transcript 우측 다운로드, 출력 행에 아티팩트 구분. 보조 메뉴로 저장·탐색기·휴지통·보관 폴더·다시 확인 |
| 확인 중 / 작업 중 | 해당 상태 표시, 중복 파일 작업 방지 |
| 파일 소실 / 접근 오류 | 메타 유지와 구분된 상태. 다시 확인·보관 폴더 액션 보존 |
| 목록 재조회 실패 | 출력 안에서 오류와 재시도 제공 |
| 닫기 / 세션 전환 | 기존 artifactStore의 요청 세대·소유 세션 검사를 유지 |

출력 섹션만 접으면 카드와 파일 상태 구독을 정리하고 목록 메타 구독은 유지해 헤더 개수를 갱신한다. 작업 타일 닫기·작업 상세 진입·세션 전환은 목록 구독도 해제하며, 늦은 목록 응답이 닫힌 본문이나 이전 세션 화면을 복원하지 않는다.

뷰어·HTML 실행·컨텍스트 수집·일반 생성물 수집 기준의 임의 결정은 이번 확정 UI 범위 밖이다. 파일 저장 루트·DB·IPC·publisher 입력은 변경하지 않는다.

### 3. AC와 기존 기준 대체

| R / AC | 관측 기준 | 직접 검증 / production path |
|---|---|---|
| R-06 / AC6 CHANGED | transcript 카드와 작업 출력 행에서 같은 게시 ID의 파일 작업·상태를 제공 | 카드 렌더/액션 시험, 실제 컴포넌트 브라우저 확인. AssistantTurn/TaskTileContent → ArtifactCards → 기존 파일 IPC |
| R-17 / AC17 NEW | 작업 기본 화면에 세 섹션이 해당 순서로 있고 진행 목록은 진행 상황, 게시 목록은 출력에 귀속. 독립 산출물 타일 없음 | TaskTileContent 직접 렌더에서 섹션별 본문·순서와 메뉴/registry 결과 비교 |
| R-18 / AC18 NEW | 컨텍스트는 미수집 상태를 표시하고 실제 참조 항목을 만들지 않음 | TaskTileContent 렌더의 컨텍스트 본문 확인 |
| R-19 / AC19 NEW | transcript는 문서 카드, 출력은 작은 파일 행. 다운로드/보조 메뉴와 소실·오류 상태가 두 테마에서 구별됨 | ArtifactCard 두 표시 형상 렌더 + 브라우저 시각/키보드 확인 |

Q-04는 아직 AC로 확정하지 않았으므로 위 UI 완료가 사용자 전체 요청 완료를 뜻하지 않는다. 기존 AC6의 native 인수 미완료는 새 디자인으로 해소됐다고 세지 않는다.

### 4. Delta V

기준 R-06/AT-06·MD-03/UT-03의 UI 배치만 CHANGED다. 아래 신규 노드의 출처는 D-020~022, 나머지 상속 노드의 출처는 기준 커밋 plan이다.

| Node | provenance | 계약 |
|---|---|---|
| R-17/AT-17, R-18/AT-18, R-19/AT-19 | NEW | 위 AC17~19 |
| R-06/AT-06 | CHANGED | 위 AC6. 독립 타일 대신 출력 행 |
| SD-05/ST-05 | NEW | 작업 출력 목록의 열기·접기·세션 전환·재조회 |
| AR-04/IT-04 | NEW | TaskTileContent → 출력 컴포넌트 → artifactStore/공통 카드 조립 |
| MD-03/UT-03 | CHANGED | 동일 카드의 transcript/list 표현 분리, 파일 ID·액션 수명 유지 |
| R-11/AT-11, R-14/AT-14, R-15/AT-15, R-90/AT-90 | INHERITED | 지연 결과 폐기·파일 상태·삭제 확인·작업 상세와 타일 레이아웃 |

| Pair | left ↔ right | requiredness | 경로 / 직접 oracle | §10 지점 / 적대 증거 |
|---|---|---|---|---|
| VP-06 | R-06 ↔ AT-06 | REQUIRED, 기준 행 대체 | 카드/출력 → 액션의 게시 ID·메타/상태 확인 | EP-U2(3), native 미검증은 별도 유지. 직접 행동, 변이 미선택 |
| VP-U1 | R-17 ↔ AT-17 | REQUIRED | 메뉴 → 작업 → 세 섹션의 순서·각 본문 | EP-U1(3). 섹션 본문 맞교환/출력 제거 변이 선택: 자리 귀속 검증 |
| VP-U2 | R-18 ↔ AT-18 | REQUIRED | 작업 → 컨텍스트 → 미수집 안내 | EP-U1-c(1). 직접 렌더, 변이 미선택 |
| VP-U3 | R-19 ↔ AT-19 | REQUIRED | transcript/출력 → 카드/행 → 다운로드·메뉴 | EP-U2(3). 직접 렌더/브라우저, 변이 미선택 |
| VP-U4 | SD-05 ↔ ST-05 | REQUIRED | 작업 열기 → 목록 acquire/list → 섹션 접기 시 카드 cleanup·헤더 count 유지 → 타일 닫기/상세/세션 전환 시 list cleanup | EP-U3(2). lifecycle 순서 관측, 변이 미선택 |
| VP-U5 | AR-04 ↔ IT-04 | REQUIRED | catalog → registry → TaskTileContent → 출력 목록 | EP-U1(3)+EP-U3-a(1). U1의 제거/교환 변이 공유 |
| VP-42 | MD-03 ↔ UT-03 | REQUIRED, 기준 행의 UI 경로 정정 | live/reload part → 기존 store → 카드/행의 상태·ID | EP-U2(3)+EP-U3(2). 직접 lifecycle/상태표, 변이 미선택 |
| VP-11/14/15/90 | 기준의 동일 좌우 노드 | REGRESSION | 기존 artifactStore/lifecycle/작업 상세/타일 배치 행동 시험 | EP-U3-b(1)+EP-U2(3)+EP-U1(3), 기존 직접 oracle. 기준 native 한계 유지 |

## Part II — Technical Design

### 5. 코드 조사 / AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 작업 타일 | TaskTileContent 기본 화면에 TaskProgressList 하나 | 보존된 TileSection으로 세 영역 조립 |
| 게시 목록 | ArtifactTileContent가 별도 타일 | TaskOutputContent로 이동해 출력 섹션에 삽입. 동일 세션 목록·50건 표시·더 보기 |
| 표시 | ArtifactCards가 양쪽에서 같은 큰 카드 사용 | 공통 액션/구독은 유지, ArtifactCard의 `variant: transcript / list`만 구분 |
| 컨텍스트 | 사용되지 않는 placeholder·i18n 존재 | 미수집 안내. 메시지·파일·도구를 참조 항목으로 추정하지 않음 |
| 일반 생성물 | 목록 producer/계약 없음. TaskOutput은 background 조회 | Q-04 확정 뒤 별도 증분. 기존 메시지 기록 활용 시 신규/수정 구분과 shell 누락 문제 고려 |

현재 등록 표면은 `rightPanelTiles.ts` catalog와 `tileRegistry.ts` 조립이며 메뉴는 catalog에서 파생한다. 활성 타일은 메모리 상태이고 직렬화 저장 코드가 없으므로 DB migration은 불필요하다.

새 플랫폼·공유 범용 레지스트리·추가 의존성 없이 chat feature 안에서 해결한다. 카드의 파일 상태/확인창/액션 로직을 복제하지 않고 표현 인자만 추가한다.

### 10. 강제 지점 / gate

| EP | 전수 N / 위치 | 계약 / 실패 의미 |
|---|---|---|
| EP-U1 | 3: a `lib/rightPanelTiles.ts`; b `rightpanel/tileRegistry.ts`; c `rightpanel/TaskTileContent.tsx` | 독립 타일 제거와 작업 섹션 조립. 메뉴 누락·잘못된 본문 귀속 방지 |
| EP-U2 | 3: a `ArtifactCard.tsx` 표현/메뉴; b 같은 파일 `ArtifactCards` variant 전달·ID 액션; c `rightpanel/TaskOutputContent.tsx` list variant 소비 | 두 표현이 같은 상태·ID 액션을 사용. 복제된 상태/잘못된 파일 선택 금지 |
| EP-U3 | 2: a `TaskOutputContent.tsx` 세션 구독·목록 갱신/페이지; b 기존 `store/artifactStore.ts` 및 ArtifactCards 수명 | 닫힘·세션 전환 뒤 늦은 응답을 재표시하지 않음. 파일 본문/scan/polling 추가 없음 |
| EP-U4 | 3: plan 메타, 본 문서 상태, INDEX 행 | 확정 UI와 미정 Q-04·기존 SDK 검증 한계를 일치시킴 |

전수 조사 술어: `rg -n 'artifacts|ArtifactTileContent' app/src/renderer/src/features/chat -g '*.ts*'`, `rg -n 'TileSection|TaskProgressList' .../rightpanel`, `rg -n 'ArtifactCards|ArtifactCard' .../components`의 production 정의/소비 경로를 대조한다. i18n·테스트·기존 데이터 타입의 artifacts 이름은 독립 패널이 아니므로 유지한다.

운영 gate: 변경 renderer 테스트와 기존 task/layout/artifactStore 회귀, `npm run typecheck`, ESLint 전체 읽기 검사, `npm run build`, 문서 gate와 `git diff --check`. DB/SDK 코드를 바꾸지 않으므로 ABI 변경 테스트와 유료 모델 실행은 이번 UI 검증을 위해 반복하지 않는다.

시각 확인은 실제 컴포넌트를 사용한 임시 브라우저 fixture로 white/dark·좁은 폭·접기·메뉴·세션 전환을 확인하고 fixture를 정리한다. native 저장/탐색기·실제 모델 publisher 성공을 모의 브라우저로 대신 판정하지 않는다.

### READY self-review

확정 UI 계약 D-020/AC17, D-021/AC6·19, D-022/AC18을 대응했고 기준의 보관/도구 계약과 충돌하지 않는다. Q-04는 OPEN이며 일반 생성물 경로는 의도적으로 착수하지 않는다.

새 패널 제거는 단순 메뉴 숨김으로 대체하지 않고 catalog/registry/전용 타일 컴포넌트를 제거한다. 출력 목록 구독과 카드 액션은 기존 프로덕션 구현을 재사용하므로 미연결 게시·파일 소실 상태를 잃지 않는다.
