# Plan — 0241-git-gateway-spawn-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0241-git-gateway-spawn-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-09-25 |
| 매핑 | — (브랜치 `claude/git-infrastructure-performance-4f58s3`) |
| 상태 | **READY** (ΔV2 — §22 G6~G8 닫음) |
| 보완 검토 | Codex r1(§20) → Claude ΔV1(§21) → Codex 재검토(§22) → Claude ΔV2(§23) · 2026-09-26 |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | V1 = `0241:V1@f682cc2` · ΔV1 = `0241:ΔV1@2ce833e` (ΔV2의 상속 기준) |
| 이번 V revision | `ΔV2` — §23. ΔV1의 OID 고정 계약(D-023·D-024·EP-11)과 테스트 처분 표를 정정한다 |
| 유효 V | `V1 + ΔV1 + ΔV2` |

> **ΔV2로 READY 재판정.** §22 G6~G8은 §23이 닫는다. 규범 우선순위는 §23 > §21 > V1 본문이다. §21·V1의 대체된 행은 각 절 머리 표식이 가리킨다.

# Part I — Product & UX Contract

## 1. Context / 목표

> **ΔV1**: "OID로 정해지는 결과는 재사용된다"와 "턴 종료 git 실행 1회"는 §21.2가 대체한다.

- 해결하려는 문제: 요청 하나가 git.exe 여러 개로 늘어난다. 턴 종료마다 세션당 7~8회, 브랜치 전환 1회에 9회 실행된다(§8 표).
- 완료 후 달라지는 것: git 실행이 main의 **단일 관문**을 지나고, 변하는 값은 요청당 probe 1회로 확인하며, OID로 정해지는 결과는 재사용된다.
- 성공을 사용자 관점에서 한 문장으로: 새 커밋이 없는 턴 종료에서 git 실행은 1회이고, 표시 값은 지금과 같거나 더 정확하다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Git.exe 실행 횟수 줄이는 방법. 캐싱. 결과 재활용 등 아키텍처링 관점에서 진단하라" | 라이브 세션 턴 1 |
| 명시 요구 | "계약 변경은 문제없다. 안전성 유지 혹은 상승, 유지보수 상승. 비용 최소화의 방향을 제안하라" | 라이브 세션 턴 2 |
| 명시 요구 | "전체 plan만 작성하라" | 라이브 세션 턴 3 |
| 추론 의도 | "전체"는 턴 2에서 제안한 단계 1~3(계측·안전 조치, GitReader, 계약 전환)을 한 plan에 담으라는 뜻이다. "plan만"은 이번 턴에 구현하지 않는다는 뜻이다 | 턴 2 응답의 "1·2와 3을 나눌지" 질문에 대한 답 |
| 추론 의도 | "비용"은 git 실행 비용과 구현·유지 비용 둘 다다. 두 비용이 충돌하면 안전성 → 유지보수 → 실행 비용 순으로 우선한다 | 턴 2 문장의 나열 순서 |
| 명시 요구 | "보완냐용을 plan 반영, plan 차례로 넘겨라. 커밋, push할 것" | 2026-09-26 구현 전 리뷰 후 사용자 지시. 보완 기록·설계자 인계이며 구현 지시는 아님 |
| 명시 요구 | "/handoff-plan 으로 지적사항을 보완하라" | 2026-09-26 라이브 세션 턴 6 |
| 명시 결정 | G1: "교차 요청 캐시 제거" · G3: "캐시 없이 매번 조회" | 턴 6 질의 응답(두 항목 모두 추천안 선택) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | git.exe 실행 횟수를 줄인다. 수단은 호출 통합·캐싱·결과 재활용이다 | "Git.exe 실행 횟수 줄이는 방법. 캐싱. 결과 재활용" | 턴 1 | ACTIVE | — |
| D-002 | IPC 공개 계약 변경을 허용한다 | "계약 변경은 문제없다" | 턴 2 | ACTIVE | — |
| D-003 | 우선순위: 안전성 유지·상승 → 유지보수 상승 → 비용 최소화 | "안전성 유지 혹은 상승, 유지보수 상승. 비용 최소화의 방향" | 턴 2 | ACTIVE | — |
| D-004 | 단계 1~3을 한 plan에 담는다. 이번 턴은 plan만 작성한다 | "전체 plan만 작성하라" | 턴 3 | ACTIVE | — |
| D-005 | 변하는 값(저장소 좌표·HEAD·브랜치·dirty)은 캐시하지 않고 요청마다 probe 1회로 확인한다 | D-003 안전성. 캐시 무효화 버그가 생길 자리를 설계로 없앤다 | 설계 | ACTIVE | — |
| D-006 | 캐시 대상은 다음 셋뿐이다. ① OID로 정해지는 결과 ② git 실행 파일 경로(찾은 경우만) ③ origin URL(config 내용이 같을 때만) | D-005의 보완 | 설계 | SUPERSEDED | D-021·D-022 |
| D-007 | 실패·타임아웃·중단·폴백 결과는 캐시하지 않는다. 예외는 origin 없음(exit 2)뿐이다(EP-09) | 타임아웃은 비결정적이다. 한 번의 부하가 영구 저하로 굳으면 안 된다 | 설계 | SUPERSEDED | D-021 (결과 캐시 자체가 없어 대상이 사라짐) |
| D-008 | git 실행 파일은 PATH의 **절대 경로 항목**에서만 찾는다. 빈 항목·상대 항목은 건너뛰고, win32는 `git.exe`만 찾는다. 찾지 못한 결과는 memo하지 않는다 | D-003 안전성. 저장소 cwd의 가짜 git 실행을 차단한다. 앱을 켠 채 git을 설치해도 재시작이 필요 없다 | 설계 | ACTIVE | — |
| D-009 | Windows `cmd\git.exe` 런처 우회는 범위 밖이다 | 효과와 부작용(HOME·PATH 설정)이 실측되지 않았다. 추측으로 구현하지 않는다 | 설계 | ACTIVE | — |
| D-010 | `orca:git:status`와 `orca:git:diffSummary`를 `orca:git:snapshot` 하나로 합친다. 요약 포함 여부는 `includeSummary`로 정한다 | D-002. 같은 계기로 함께 도는 두 조회가 probe를 공유한다 | 설계 | ACTIVE | — |
| D-011 | checkout 성공 결과에 전환 후 `status`를 싣는다. renderer는 재조회하지 않는다 | 재조회 왕복과 그 사이 경합 구간을 없앤다 | 설계 | ACTIVE | — |
| D-012 | `GitDiffSummary.uncommitted` 필드를 삭제한다 | 항상 빈 값이고 renderer 소비처 0건이다(0211 §18 I-06) | 설계 | ACTIVE | — |
| D-013 | `ifRevision`/`unchanged` 응답은 도입하지 않는다 | main 캐시로 실행 비용은 이미 닫힌다. renderer에 이전 요약 보존 규칙을 늘리지 않는다(D-003 유지보수) | 설계 | ACTIVE | — |
| D-014 | 읽기용 diff·log에 `--no-ext-diff --no-textconv`를 붙인다 | 캐시 결정성 확보 + 저장소 config가 지정한 외부 프로그램의 실행 차단(D-003). textconv 사용자의 diff 표시는 원본 기준이 된다 | 설계 → 사용자 수용(턴 4 "1. 수용함") | ACTIVE | — |
| D-015 | 쓰기(checkout 해소 3종·checkout·worktree add/remove·branch -d·worktree repair)는 `gateway.mutate`를 거친다. 읽기 전용 env를 싣지 않고, 끝나면 세대를 +1 한다 | 지금은 해소 3종이 읽기 전용 env로 실행된다(`git-cli.ts:34`) | 설계 | ACTIVE | — |
| D-016 | 읽기는 전역 동시 실행 상한 4를 둔다. 쓰기는 상한 밖이다 | 여러 세션이 동시에 턴을 끝낼 때의 폭주를 흡수한다. 사용자 작업(쓰기)은 지연시키지 않는다 | 설계 | ACTIVE | — |
| D-017 | in-flight 중복 제거는 **진행 중인 실행만** 공유하고 완료 결과는 보관하지 않는다. 키에 세대를 넣는다 | 완료 결과를 보관하는 것은 D-005 위반이다 | 설계 | ACTIVE | — |
| D-018 | `removeForSession` 판정 순서와 worktree 이름 후보 루프의 동작은 바꾸지 않는다. 관문 경유만 바꾼다 | 순서를 바꾸면 dirty+커밋 동시 상황의 사유 문구가 바뀐다. 이름 규칙을 복제하면 SSOT가 둘이 된다 | 설계 | ACTIVE | — |
| D-019 | `runGit` 직접 사용과 `child_process` import는 `infra/git`의 관문·runner로 한정하고 lint로 강제한다. `app/legacy-paths.ts`의 repair도 `infra/git/worktree.ts`를 거친다 | D-003 유지보수. 새 호출부가 관문을 우회할 길을 막는다 | 설계 | ACTIVE | — |
| D-020 | production 실행 로그·계측은 범위 밖이다. 요청별 실행 횟수는 테스트 oracle로 고정한다 | 로그 폭주 없이 회귀를 잡는다(D-003 비용) | 설계 | ACTIVE | — |
| D-021 | 요청 사이에 보관하는 값은 git 실행 파일 경로(찾은 경우)뿐이다. diff·log·patch·cat-file·rev-list 결과를 요청 사이에 캐시하지 않는다 | "교차 요청 캐시 제거". OID가 같아도 `.gitattributes`·`git replace`·설정에 따라 출력이 달라진다(§21.1 실측) | 턴 6 사용자 선택 | ACTIVE | D-006·D-007 대체 |
| D-022 | origin URL은 status를 만들 때마다 `remote get-url origin`으로 조회한다 | "캐시 없이 매번 조회". 저장소 밖 설정(`url.*.insteadOf`)도 결과를 바꾼다 | 턴 6 사용자 선택 | ACTIVE | D-006 ③ 대체 |
| D-023 | 한 요청 안의 읽기 명령은 probe가 준 HEAD OID를 인자로 쓴다. 문자열 `HEAD`는 checkout 직전 dirty 검사와 쓰기 명령에서만 쓴다 | G2. 명령 사이에 HEAD가 움직여도 한 응답이 한 시점을 본다(§21.1 실측 `2/1` vs `1/1`) | 설계 | SUPERSEDED | D-027 (G6: 선택 커밋 범위는 HEAD와 무관) |
| D-024 | base OID와 head OID가 같으면 diff·log·patch 실행을 생략하고 빈 결과를 준다 | 같은 OID끼리의 diff와 `A..A` log는 속성·replace와 무관하게 비어 있다 | 설계 | SUPERSEDED | D-028 (적용 범위를 누적 범위로 한정) |
| D-025 | 관문 경계 lint는 규칙 3개다. `import/no-restricted-paths`(runner의 해석된 경로) + `no-restricted-imports`(`child_process`·`node:child_process`) + `no-restricted-syntax`(두 표기의 동적 `import()`·`require`) | G4. 문자열 패턴은 `./runner`·`child_process`를 놓친다(§21.1 실측) | 설계 | ACTIVE | D-019의 강제 수단 구체화 |
| D-027 | 읽기 범위의 끝점은 요청 종류로 정한다. **누적 범위**(요약·범위 패치)는 `[B, H]`이고 `H` = probe HEAD OID다. **선택 커밋 범위**는 `[P, C]`이고 `C` = 요청 `commitSha`, `P` = `cat-file commit C`의 첫 부모(root면 empty tree)이며 HEAD와 무관하다. 전문맥·축소 재시도는 같은 끝점 쌍을 쓴다 | G6. 선택 커밋 본문에 이후 커밋이 섞이면 안 된다(`git-diff-commit.test.ts:49` 계약) | 설계 | ACTIVE | D-023 대체 |
| D-028 | 누적 범위에서 `B = H`면 diff·log·patch 실행을 생략하고 빈 결과를 준다. 선택 커밋 범위는 생략 규칙의 대상이 아니다 | D-024의 범위 한정 | 설계 | ACTIVE | D-024 대체 |
| D-026 | renderer `gitApi.status(cwd)`는 `snapshot({cwd, includeSummary:false})`의 `status`를 돌려주는 래퍼로 남긴다 | 상태만 필요한 소비처 2곳의 호출 형태를 보존한다(D-003 유지보수) | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-020 (신규 handoff). 턴 4: D-014 사용자 수용("1. 수용함") — 결정 내용 불변, 출처만 갱신.
- 변경된 결정: 없음.
- 사용자 확인: D-014(textconv 표시 변경)를 턴 4에서 사용자가 수용했다.
- **`ACTIVE 결정 ↔ AC` 대조 — V1 최초 설계 시점**: 당시 충돌 0으로 기록했다. 2026-09-26 리뷰에서 D-005의 매 요청 probe와 AC24의 기존 기대값 유지가 충돌함을 확인했다(G5); 캐시 결정성·현재 표시 유지도 G1·G3의 정정 대상이다.
- **2026-09-26 인계**: D-001~D-020은 임의 변경하지 않았다. §20의 G1~G5를 `open`으로 남기며, 설계자는 필요한 Decision·AC·V-pair·§10을 Delta V로 정정한 뒤 READY를 다시 판단한다.
- **ΔV1 (턴 6)**: 추가 D-021~D-026. 변경 D-006·D-007 → SUPERSEDED(사용자 선택 G1·G3). D-014는 ACTIVE 유지 — 근거 중 "캐시 결정성"은 D-021로 소멸했고 "외부 프로그램 실행 차단"이 남는다.
- **`ACTIVE 결정 ↔ AC` 대조 — ΔV1 설계 당시 기록**: 충돌 0. D-005↔AC1·AC7(요청마다 probe, 반복 호출도 같은 횟수), D-021↔AC1·AC2·AC7·AC25(반복 호출 실행 수 동일 = 캐시 없음), D-022↔AC3(전역 insteadOf 변경 반영), D-023↔AC26·AC8, D-024↔AC1·AC7, D-025↔AC22, D-026↔AC18, D-018↔AC20. V1 AC24의 "기존 기대값 유지"와 D-005의 충돌(G5)은 AC24 ΔV1이 처분 표로 해소했다고 기록했다.
- **ΔV1 재검토**: D-023·EP-11과 선택 커밋 패치의 기존 계약(G6), AC26과 경합 seam의 실행 순서(G7), AC15·AC17과 AC24의 테스트 수정 제한(G8)이 충돌한다. 현재 대조 결과와 설계 정정 요구는 §22에 기록하며, 사용자 결정 D-021·D-022는 유지한다.
- **ΔV2 (턴 7)**: 추가 D-027·D-028, 변경 D-023·D-024 → SUPERSEDED. 사용자 결정 D-021·D-022는 그대로다.
- **`ACTIVE 결정 ↔ AC` 대조 — ΔV2**: 충돌 0. D-027↔AC7(선택 커밋 HEAD 독립)·AC8(재시도 동일 끝점)·AC26(누적 범위 경합), D-028↔AC1·AC7(B = H 생략, 선택 커밋 제외), D-011↔AC15·AC17(성공 결과 status 전달)↔AC24 R16~R18(기존 성공 단언 확장). ΔV1 대조 줄의 D-023·D-024 항은 D-027·D-028로 읽는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당. renderer 계기는 이미 절제돼 있고 증폭은 main에서 일어난다 | `useGitSnapshot.ts:17-37` 계기는 초기·식별자·턴 종료·수동뿐. `git-cli.ts:62-73`이 status 1회에 4회 실행 |
| 이미 기존 코드가 충족하는가 | 부분. `repoCoords` 캐시가 `git-diff.ts`에만 있다 | `git-diff.ts:195` · `git-cli.ts`는 캐시 없음 |
| 더 작은 해법이 있는가 | probe 통합만으로 status 4→2가 된다. 턴 종료 1회까지 가려면 OID 캐시가 필요하다 | §14 |
| 선행 자료를 코드와 대조했는가 | 대조함. 턴 1 진단의 "Windows 런처 2배"는 미실측이라 D-009로 범위에서 뺐다 | — |
| ACTIVE·기존 결정과 충돌하는가 | 0211 D-063("좌표만 캐시")과 충돌하지 않는다. TO-BE는 좌표 캐시조차 없앤다 | `git-diff.ts:188` 주석 |

- 사용자에게 올릴 결정: V1에서는 없음으로 판단했다(D-014는 턴 4에서 사용자 수용). 현재 G1·G3의 속성·설정 반영 저하까지 D-014 수용으로 간주하지 않으며, 기존 표시 의미를 바꾸는 해법을 택한다면 설계자가 별도 결정 필요 여부를 판정한다.
- ΔV1: G1·G3를 턴 6에서 사용자에게 올렸고, 표시 의미를 유지하는 쪽(캐시 제거·매번 조회)으로 확정됐다(D-021·D-022). 남은 사용자 결정 없음.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

> **ΔV1**: 흐름의 요약 캐시·origin 캐시 단계, 상태 표의 "같은 범위를 다시 열어도 git 실행 1회", 엣지케이스의 캐시 두 줄은 §21.2가 대체한다.

```text
[턴 종료 tick / 수동 새로 고침 / 초기·cwd 변경]
  → renderer가 orca:git:snapshot 1회 호출 (계기에 따라 includeSummary)
  → main: probe 1회 → status 조립 (origin URL은 config 내용이 같으면 캐시)
         → includeSummary면 (commonDir, base, head) 키로 요약 캐시 조회, 없을 때만 diff‖log
  → 컴포저 git 행·변경사항 타일이 갱신된다
  ↘ 저장소 아님/git 없음 → status.isRepo=false (지금과 같은 무해 폴백)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 초기 마운트·cwd 변경 | snapshot(includeSummary=false) | 브랜치 칩 표시. 지금과 같음 |
| 턴 종료·수동 새로 고침 | snapshot(includeSummary=true) | 칩과 변경 목록 갱신. IPC 2회 → 1회 |
| 브랜치 전환 성공 | checkout 결과의 `status`로 칩 갱신 | 재조회 없이 새 브랜치 표시 |
| 타일에서 패치 조회 | probe + 캐시된 패치 | 같은 범위를 다시 열어도 git 실행 1회 |
| 앱 실행 중 git 설치 | 다음 요청에서 실행 파일을 다시 찾는다 | 재시작 없이 칩이 나타난다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 폴백 값과 의미는 지금과 같다(`isRepo:false`, `unavailable:true`).
- cancel / retry / close / restart: 캐시는 프로세스 메모리에만 있어 재시작하면 비어 있다. 영속화하지 않는다.
- concurrency / multi-session: 같은 인자의 동시 읽기는 실행 1회를 공유한다. 전역 읽기는 최대 4개가 동시에 돈다.
- 외부환경: 저장소 config에 `include`·`includeIf`·`worktreeConfig`가 있으면 origin URL을 캐시하지 않는다(§10 EP-09).

## 6. 범위 / 비범위

- **범위**: `infra/git` 관문·probe·캐시·실행 파일 해석, git IPC 계약 전환(snapshot·checkout 결과·`uncommitted` 삭제), renderer 호출부 3곳, `legacy-paths` repair 경로, lint 경계, IPC_CONTRACT·inventory 갱신.
- **비범위**: Windows 런처 우회(D-009), fs.watch, `.git` 파일 직접 읽기, `cat-file --batch` 상주 프로세스, production 계측(D-020), worktree 이름 루프 최적화(D-018), 캐시 영속화.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| Windows 런처 우회 | 아니오 — runner 내부 구현만 바뀐다 | NEXT_HANDOFF 후보(Windows 실측 선행) |
| `ifRevision` 응답 | 아니오 — 선택 필드로 추가할 수 있다 | 후속 |
| IPC 채널 이름 `orca:git:snapshot` | **예 — 공개 계약** | 지금 확정(D-010) |

## 7. Requirements / Acceptance — `R ↔ AT`

> **ΔV1**: AC1·AC2·AC3·AC5·AC7·AC8·AC15·AC16·AC22·AC24·AC25는 §21.3이 대체하고, AC23은 폐기, AC26을 신설했다. 이 표의 해당 행은 V1 기록이다.

"실행 1회"는 관문이 runner를 1번 부른 것이다. 관측은 `createGitGateway({ run: countingRunner })`로 한다. countingRunner는 실제 `runGit`을 감싸 인자를 기록하고, 실제 임시 저장소에서 돈다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | baseline이 있는 세션에서 HEAD가 그대로면 요약 포함 snapshot 두 번째 호출의 실행은 1회다 | 2회째 기록 = `[probe 인자]` 정확 일치. 결과는 1회째와 deep-equal | renderer tick → `orca:git:snapshot` → `gitSnapshot` |
| R-01 | AT-02 / AC2 | HEAD가 새 커밋으로 움직이면 첫 조회는 probe·diff·log 3회, 같은 HEAD 재조회는 1회다 | 커밋 후 기록 집합 = {probe, diff, log}. 결과 files·commits가 새 커밋을 포함한다 | 같음 |
| R-01 | AT-03 / AC25 | baseline 없는 레거시 세션(`bornAt`)은 같은 HEAD에서 `rev-list`를 다시 부르지 않는다 | 2회째 기록에 `rev-list` 0건. base.oid는 1회째와 같다 | 같음 |
| R-02 | AT-04 / AC3 | 상태만 요청하면 첫 호출은 probe·`remote get-url` 2회, 두 번째는 1회다. `remote set-url` 뒤에는 새 URL을 준다 | 기록 정확 일치 + set-url 후 `githubUrl` 변경. 기존 케이스 "origin 주소를…현재 값을 읽는다" 통과 | renderer 초기 마운트 → snapshot(includeSummary=false) |
| R-02 | AT-05 / AC4 | 저장소가 아닌 디렉토리는 `isRepo:false`이고 실행 ≤2회, 없는 경로는 0회다 | 기록 길이 단언 + 결과 deep-equal `NOT_REPO` | 같음 |
| R-02 | AT-06 / AC5 | 커밋 0개 저장소에서 `branch`는 브랜치 이름, `detached:false`, 요약 `base.kind:'none'`이다 | 결과 단언 + 실행 ≤4회(probe 폴백 3 + origin 1) | 같음 |
| R-02 | AT-07 / AC6 | detached HEAD면 `branch:null`, `detached:true`다 | 기존 케이스 "detached HEAD 면…" 통과 | 같음 |
| R-03 | AT-08 / AC7 | 같은 범위 패치의 두 번째 호출은 실행 1회(probe)다. 커밋 선택 패치도 두 번째는 1회다(`cat-file` 캐시) | 2회째 기록 = `[probe]`. 결과 deep-equal | 타일 → `orca:git:diffPatch` → `gitDiffPatch` |
| R-03 | AT-09 / AC8 | 전문맥 조회 실패로 얻은 축소 결과는 캐시되지 않는다. 같은 요청을 다시 하면 전문맥을 다시 시도한다 | 2회째 기록에 `--unified=1000000` 존재 | 같음 |
| R-06 | AT-10 / AC9 | 모든 읽기 실행은 `--no-optional-locks`로 시작하고 `readOnly:true`다. 쓰기 실행에는 둘 다 없다 | **차집합** — 읽기 기록 중 조건 불만족 0건, 쓰기 기록 중 조건 만족 0건 | 관문 `read`/`mutate` |
| R-06 | AT-11 / AC10 | 저장소 config에 `diff.external`과 textconv 드라이버가 있어도 요약·패치 조회가 그 프로그램을 실행하지 않는다 | 마커 파일을 쓰는 스크립트를 드라이버로 등록 → 조회 후 마커 부재. diff/log 기록 중 두 플래그 누락 0건(차집합) | 요약·패치 경로 |
| R-05 | AT-12 / AC11 | PATH에 `.`·빈 항목·상대 항목이 있고 cwd에 실행 가능한 가짜 `git`이 있어도 그것을 실행하지 않는다 | posix 실제 실행: 가짜 git이 쓰는 마커 부재 + 결과가 진짜 git 기준. 해석 함수 단위 테스트(win32 규칙 포함) | 모든 git 실행 → runner |
| R-05 | AT-13 / AC12 | git을 찾지 못하면 실행 0회로 `unavailable`이 되고, prepare는 `git-unavailable`을 준다. 이후 PATH에 git이 생기면 재시작 없이 찾는다 | spawn 0회 단언 + reject 사유 단언 + PATH 교체 후 `isRepo:true` | runner·`WorktreeService.prepare` |
| R-04 | AT-14 / AC13 | 인자가 같은 동시 읽기 2건은 실행 1회를 공유한다. 쓰기가 끝난 뒤 들어온 같은 읽기는 새로 실행한다 | 지연 runner로 실행 횟수 단언(1 → 쓰기 후 2) | 관문 |
| R-04 | AT-15 / AC14 | 서로 다른 읽기 10건을 동시에 요청하면 동시 실행은 최대 4다 | 지연 runner의 최대 in-flight 관측값 = 4 | 관문 |
| R-04 | AT-16 / AC15 | clean 트리 전환 성공 결과는 `{ok:true, branch, status}`이고 `status.branch`는 새 브랜치다. origin 캐시 적중 시 실행 4회. dirty·해소 없음은 2회이며 결과 형태는 지금과 같다 | 결과 단언 + 기록 정확 일치. 기존 checkout 케이스 전부 통과 | 칩 → `orca:git:checkout` → `gitCheckout` |
| R-07 | AT-17 / AC16 | renderer는 계기당 snapshot을 1회 부른다. 초기·cwd 변경은 `includeSummary:false`, 턴 종료·수동은 `true`, sessionId만 바뀌면 호출하지 않는다 | 순수 계획 함수의 표 단언(계기 6종 × 기대 요청) | `useGitSnapshot` |
| R-07 | AT-18 / AC17 | 전환 성공 후 칩은 결과의 `status`로 갱신되고 추가 snapshot 호출이 없다 | `checkoutOutcome`이 `status`를 싣는다 + 배선 테스트에서 성공 후 `gitApi.snapshot` 호출 0건 | `BranchChip.tsx` |
| R-07 | AT-19 / AC18 | 원격 메뉴는 snapshot의 `status.githubUrl`을 쓴다 | `gitIdentityRemoteWiring` 케이스가 snapshot 경로로 통과 | `useGitIdentityRemote` |
| R-07 | AT-20 / AC19 | `orca:git:status`·`orca:git:diffSummary`가 없고 `orca:git:snapshot`이 있다. `GitDiffSummary`에 `uncommitted`가 없다. 잘못된 요청은 zod가 거절한다 | `ipc-documentation.test.ts` + `check-doc-inventory --check` + typecheck + 스키마 케이스 | preload → handler |
| R-08 | AT-21 / AC20 | `baseRef` 없는 worktree 준비는 실행 4회(probe·check-ref-format·show-ref·worktree add), 새 세션 passthrough 기준선은 1회다. 결과는 지금과 같다 | 기록 정확 일치 + 기존 `service.test`·`prepare-worktree.test` 통과 | `chat:send` → `prepareTurnWorktree` |
| R-08 | AT-22 / AC21 | 경로 이관 repair가 `repairWorktree`를 거치고 동작은 지금과 같다 | 기존 `legacy-paths.test` 16건 통과(주입 seam만 교체) | 부팅 → `repairMovedWorktrees` |
| R-09 | AT-23 / AC22 | `infra/git/runner.ts`·`child_process`를 허용 파일 밖에서 import하면 lint가 실패한다 | 변이: `features/worktrees/service.ts`에 runner import를 심으면 `npm run lint` error | `app/eslint.config.mjs` |
| R-09 | AT-24 / AC23 | 불변 캐시는 크기 상한을 넘기면 가장 오래 안 쓴 항목부터 버린다 | 단위: 상한·접근 순서·크기 계산 | 관문 캐시 |
| R-09 | AT-25 / AC24 | 기존 git·worktree 동작 테스트가 계약 변경분 외에는 수정 없이 통과한다 | §19 스위트 전체 green. 수정된 기대값은 `uncommitted`·채널명·`status` 추가분뿐(diff로 확인) | 전 경로 |

### AC 검증 주의사항

- 기존 테스트 재사용: `git-cli.test.ts` 32건, `git-diff.test.ts` 92건, `git-diff-commit.test.ts` 26건, `repository.test.ts` 9건, `legacy-paths.test.ts` 16건, worktrees 30건(`rg -c "it\("`, 이번 세션 실측). AC4·AC6·AC15가 인용한 케이스명이 `git-cli.test.ts:66,118,129,142`에 있음을 확인했다.
- 사람 실기 항목: 없음. 실행 횟수와 결과는 모두 실제 git 임시 저장소에서 자동 단언한다.
- N회 기준: sink는 `runGit` 하나다(`rg "execFile" src/main` 실행 → production 1곳 `runner.ts:32`, 테스트 픽스처 1곳). TO-BE의 모든 production 호출부는 관문을 지나므로(AC22) countingRunner가 전 호출부를 모형한다. 픽스처의 `execFile`은 관측 대상이 아니다.
- AC9·AC10은 "있다"를 몇 건 세지 않고 **차집합 0건**으로 센다. 0211 AT-39 방식이다(`git-diff.test.ts:342`).
- AC1·AC2·AC7의 "정확 일치"는 방향을 함께 잠근다. 관문을 우회하면 기록이 0건이 되어 실패하고, 캐시를 빼면 기록이 늘어 실패한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V. 이 영역의 0211 V를 상속해 일부만 바꾸는 작업이 아니다. 관문 재구성은 새 계약이다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

> **ΔV1**: provenance 변경은 §21.4. MD-02·MD-06 SUPERSEDED, R-10·MD-07 NEW.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 턴 종료 요약 비용 — AC1·AC2·AC25 | NEW | — |
| R-02 | R | 상태 조회 비용·정확성 — AC3~AC6 | NEW | — |
| R-03 | R | 패치 비용과 폴백 비캐시 — AC7·AC8 | NEW | — |
| R-04 | R | 동시성·전환 — AC13~AC15 | NEW | — |
| R-05 | R | 실행 파일 해석 안전성 — AC11·AC12 | NEW | — |
| R-06 | R | 읽기 무잠금·외부 프로그램 차단 — AC9·AC10 | NEW | — |
| R-07 | R | IPC 계약 전환 — AC16~AC19 | NEW | — |
| R-08 | R | worktree 준비·이관 경로 — AC20·AC21 | NEW | — |
| R-09 | R | 유지보수 경계·회귀 — AC22~AC24 | NEW | — |
| SD-01 | SD | 턴 종료 tick → snapshot → probe → 캐시 → store (§9 TO-BE) | NEW | — |
| SD-02 | SD | 칩 전환 → mutate → 결과 status → 칩 (§9 TO-BE) | NEW | — |
| AR-01 | AR | 관문 단일 경유(read/mutate)와 lint 경계 (§10 EP-01·EP-05·EP-10) | NEW | — |
| AR-02 | AR | preload·handler·renderer 배선 (§10 EP-08) | NEW | — |
| MD-01 | MD | `probeRepo` 파서와 폴백 (§11) | NEW | — |
| MD-02 | MD | 불변 LRU 캐시와 키 (§10 EP-03·EP-06) | NEW | — |
| MD-03 | MD | in-flight 공유·세마포어·세대 (§10 EP-05) | NEW | — |
| MD-04 | MD | `resolveGitExecutable` (§10 EP-04) | NEW | — |
| MD-05 | MD | renderer 조회 계획 함수 (§11) | NEW | — |
| MD-06 | MD | origin URL 캐시 검증값 (§10 EP-09) | NEW | — |

### Pair registry

> **ΔV1**: VP-15·VP-19 SUPERSEDED(폐기), VP-20·VP-21 NEW, 나머지 변경 행은 §21.4.

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED | tick → `gitApi.snapshot` → handler → `gitSnapshot` → probe → 요약 캐시 → store | AC1·AC2·AC25 기록 정확 일치 | not selected — 정확 일치가 캐시 제거·우회 양방향에 반응 | EP-03(5)·EP-06(5) |
| VP-02 | R-02 ↔ AT-04~07 | REQUIRED | 초기 마운트 → snapshot(false) → probe → origin 캐시 → status | AC3~AC6 결과·기록 단언 | required — config 내용 비교를 mtime 비교로 바꾸는 변이. 같은 길이 URL로 즉시 set-url 했을 때 AC3 실패 확인. 심을 자리: `origin-url.ts` 검증 함수 | EP-09(1) |
| VP-03 | R-03 ↔ AT-08·09 | REQUIRED | 타일 → `diffPatch` → probe → cat-file 캐시 → 패치 캐시 | AC7·AC8 | required — 폴백 결과를 캐시에 넣는 변이 → AC8 실패. 자리: `gitDiffPatch` 폴백 분기 | EP-03(패치 2자리) |
| VP-04 | R-04 ↔ AT-14~16 | REQUIRED | 칩 → `orca:git:checkout` → `gitCheckout` → mutate → probe | AC13~AC15 | not selected — 지연 runner 관측이 직접 oracle | EP-05(7)·EP-07(1) |
| VP-05 | R-05 ↔ AT-12·13 | REQUIRED | 모든 요청 → runner → `resolveGitExecutable` → execFile(절대 경로) | AC11 마커 부재·AC12 0회 | required — 해석 함수에서 상대 항목 필터를 지우는 변이 → AC11 실패. 자리: `git-executable.ts` | EP-04(1) |
| VP-06 | R-06 ↔ AT-10·11 | REQUIRED | 읽기 호출부 → `gateway.read` → runner | AC9·AC10 차집합 0건 + 마커 부재 | required — `read`에서 플래그 추가를 지우는 변이·`DIFF_SAFETY_ARGS` 한 자리를 지우는 변이 → 각각 실패 | EP-01(1)·EP-02(6) |
| VP-07 | R-07 ↔ AT-17~20 | REQUIRED | renderer 3호출부 → preload → handler | AC16 표·AC17·AC18 배선·AC19 문서 가드 | not selected — 표 단언과 채널 실측 가드가 직접 oracle | EP-08(3) |
| VP-08 | R-08 ↔ AT-21·22 | REQUIRED | `chat:send` → `prepareTurnWorktree` → probe/mutate · 부팅 → repair | AC20 기록 + 기존 스위트 | not selected | EP-05(repair 1자리 포함) |
| VP-09 | R-09 ↔ AT-23~25 | REQUIRED | lint 설정 · 관문 캐시 · 전 스위트 | AC22 lint · AC23 단위 · AC24 green | required — AC22 자체가 변이 증거(runner import 심기) | EP-10(1) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | 위 VP-01 경로 전체를 실제 저장소로 커밋 전후 2회 실행 | 커밋 전후 snapshot 결과가 새 커밋 반영 + 실행 수 1→3→1 | not selected | EP-03·EP-06·EP-08 (11) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | 실제 저장소에서 checkout → 결과 status → 다음 snapshot | 결과 status와 이후 snapshot status 동일 | not selected | EP-05·EP-07 (8) |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED | production 모듈 전체 → 관문 | AC22 lint + AC9 차집합 | VP-09와 공유 | EP-01·EP-05·EP-10 (9) |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED | preload `git.snapshot` → `CHANNELS.gitSnapshot` → `registerGitHandlers` | `ipc-documentation.test` + 스키마 거절 케이스 | not selected | EP-08(3) |
| VP-14 | MD-01 ↔ UT-01 | REQUIRED | `probeRepo` | 정상·하위 디렉토리·worktree·unborn·detached·비저장소·경로 없음 7케이스 | not selected | 0 — 순수 파서 |
| VP-15 | MD-02 ↔ UT-02 | REQUIRED | `createImmutableCache` | AC23 | not selected | EP-06(5) |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | `createGitGateway` | AC13·AC14 | not selected | EP-05(1 세대) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `resolveGitExecutable` | posix·win32 규칙 표 단언 | VP-05와 공유 | EP-04(1) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | `planGitSnapshotQuery` | AC16 표 | not selected | 0 — 순수 함수 |
| VP-19 | MD-06 ↔ UT-06 | REQUIRED | `readOriginUrl` | 내용 같음 → 캐시, 다름 → 재조회, include 존재 → 매번 조회 | VP-02와 공유 | EP-09(1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` lint·typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 만든 error |
| 비-DB vitest | git·worktree·renderer 순수 스위트 | `./node_modules/.bin/vitest run src/main/infra/git src/main/features/worktrees src/main/app/chat-turn src/main/app/legacy-paths.test.ts src/renderer/src/features/chat src/shared` | 현재 변경 관련 red. DB ABI red는 기준선으로 분리(`app/AGENTS.md §better-sqlite3 ABI`) |
| 문서 인벤토리 | 채널 수·IPC 문서 변경 | `node scripts/check-doc-inventory.mjs --check` (app에서) | 불일치 |
| 커밋 trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| production에서 git을 실행하는 곳은 `runner.ts` 하나다 | `rg "node:child_process" src/main` → production 1(`infra/git/runner.ts`), 픽스처 1 |
| `runGit` 직접 import는 `infra/git` 밖에 1곳 있다 | `app/legacy-paths.ts:16` (`worktree repair`) |
| `execFile('git')`은 bare 이름이고 cwd는 사용자 저장소다 | `runner.ts:32-37` |
| 읽기 전용 표시가 두 방식이다 | env: `runner.ts:28` · 플래그: `git-diff.ts:44,52` |
| 해소 3종(stash/commit/reset)이 읽기 전용 env로 실행된다 | `git-cli.ts:34,107-111` |
| 좌표 캐시는 `git-diff.ts`에만 있다 | `git-diff.ts:195-218` |
| 한 번의 `rev-parse`가 6개 값을 준다(born 저장소) | 이번 세션 실측 git 2.43: inside·toplevel·git-dir·common-dir·HEAD oid·symbolic HEAD |
| unborn 저장소에서는 위 호출이 exit 128이다 | 실측 |
| 하위 디렉토리에서 `--git-common-dir`은 cwd 기준 상대 경로다 | 실측 `../.git`. `path.resolve(cwd, v)`로 정규화한다 |
| unborn 저장소에서 `diff HEAD --shortstat`은 실패한다 | 실측 exit 128 → 지금의 `rev-parse --verify HEAD` 선행 호출은 probe의 `head.kind`로 대체 가능 |
| `--no-ext-diff --no-textconv`는 diff·log 모두 받는다 | 실측 exit 0 |
| status 소비처: 3곳 | `useGitSnapshot.ts:105` · `BranchChip.tsx:81` · `useGitIdentityRemote.ts:68` |
| `uncommitted` 소비처: 타입 1·주석 1·생산자 1, renderer 읽기 0 | `rg uncommitted src` |
| 채널 수는 생성물이 갖고 CI가 대조한다 | `ipc-documentation.test.ts` · `ci.yml:55-56` |
| 위생 가드용 source-scan은 문자열 리터럴을 지운다 → import 경로 검사에 쓸 수 없다 | `source-scan.ts:47`. 그래서 lint(`no-restricted-imports`)로 강제한다 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `infra/git` 외부 import | `rg "from '.*infra/git/" src/main` (테스트 제외) | 7 | 4개 파일(`prepare-worktree`·`handlers/git`·`legacy-paths`·worktrees 2) |
| renderer `gitApi` 호출 파일 | `rg "gitApi\." renderer` (테스트 제외) | 4 | `BranchChip`·`useGitIdentityRemote`·`useGitSnapshot`·`useGitPatch` |
| `gitApi` 참조 테스트 | 같은 검색(테스트) | 3 | `gitIdentityRemoteWiring`·`gitQueryOwner`·`gitPatchQuery` |
| git 채널 | `shared/ipc.ts:74-82` | 5 | status·branches·checkout·diffSummary·diffPatch |
| 쓰기 호출부 | 코드 읽기 | 7 | 해소 3종·checkout·worktree add·remove·branch -d (+ repair 1 = 8) |

### 수치 / 전칭 표현 검산 — AS-IS 요청별 실행 수(코드 읽기, 이번 세션)

| 요청 | 실행 수 | 내역 |
|---|---:|---|
| status | 4 | inside 1(`git-cli.ts:48`) + symbolic-ref·toplevel·remote 3(`:69-73`) |
| diffSummary (baseline 있음, 좌표 캐시 적중) | 3 | diff·rev-parse HEAD(`git-diff.ts:258-261`) + log(`:266`) |
| 턴 종료 합계 | 7 (+ 타일 열림 시 패치 1 = 8) | 4 + 3 (+1) |
| checkout clean + renderer 재조회 | 9 | inside·rev-parse HEAD·shortstat·toplevel·checkout 5 + status 4 |
| checkout dirty, 해소 없음 | 4 | inside·rev-parse·shortstat·symbolic-ref |
| 새 세션 passthrough 기준선 | 2 | `prepare-worktree.ts` resolveHead·resolveHeadRef |
| worktree 준비(baseRef 없음, 후보 1) | 6 | toplevel 1 + ref·oid 2 + check-ref·show-ref 2 + add 1 |

- "유일한 실행 지점" 반례 검색: `rg "execFile|spawn\(" src/main` 중 git 실행은 runner 1곳과 픽스처뿐이다.
- 문서 앵커 확인: `IPC_CONTRACT.md` `### 2.6-b Git`(198행)이 존재한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

> **ΔV1**: TO-BE의 `immutableCache`·origin 캐시 경로는 §21.6 흐름도가 대체한다. AS-IS는 유효하다.

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, SD-02, AR-01.
- 현재 책임 소유자: 판정 함수가 `git-cli.ts`·`git-diff.ts`·`repository.ts` 세 파일에 흩어져 있고 각자 `runGit`을 부른다.
- 문제의 직접 원인: 같은 질문(저장소인가·루트·HEAD)을 파일마다 따로 묻고, OID로 정해지는 결과도 매번 다시 계산한다.

```text
tick ─┬─ gitApi.status ──> gitStatus ──> runGit ×4
      └─ gitApi.diffSummary ──> gitDiffSummary ──> runGit ×3 (좌표 캐시만)
칩 전환 ──> gitCheckout ──> runGit ×5 ──> renderer refresh ──> gitStatus ×4
legacy-paths ──> runGit (관문 없음)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, SD-02, AR-01, AR-02.
- 변경 후 책임 소유자: `infra/git/gateway.ts`가 유일한 실행 관문이다. 판정은 `probe.ts` 하나가 갖는다.

```text
tick ──> gitApi.snapshot({includeSummary}) ──> handler ──> gitSnapshot
           ├─ probeRepo ──> gateway.read ×1
           ├─ readOriginUrl ──> (config 내용 같음) 캐시 | gateway.read ×1
           └─ summary? ──> immutableCache[(commonDir, base, head)] | gateway.read diff‖log
칩 전환 ──> gitCheckout ──> probe·shortstat(read) ──> gateway.mutate(checkout) ──> probe ──> {ok, branch, status}
legacy-paths ──> worktree.repairWorktree ──> gateway.mutate
gateway.read  = 세마포어(4) + in-flight 공유(키에 세대) + --no-optional-locks + readOnly
gateway.mutate = withRepoMutation + 세대 +1 (finally)
runner = resolveGitExecutable(절대 경로) ──> execFile
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 3파일이 각자 판정·실행 | probe 1곳, 실행은 관문 1곳 | D-019 | AR-01 / VP-12 · `gateway.ts`·`probe.ts` |
| data/control flow | status·summary 별도 IPC | snapshot 1 IPC, probe 공유 | D-010 | SD-01 / VP-10 · `git-snapshot.ts` |
| state/contract | `uncommitted` 필드, checkout 결과에 status 없음 | 필드 삭제, `status` 추가 | D-011·D-012 | AR-02 / VP-13 · `shared/ipc.ts` |
| 캐시 | 좌표 캐시(cwd 키, 무효화 없음) | 좌표 캐시 **삭제**. OID 결과 LRU + origin URL(내용 검증) + 실행 파일 경로 | D-005·D-006 | MD-02·MD-06 / VP-15·VP-19 |
| error/lifecycle | 실패도 매번 재실행(캐시 없음) | 실패·폴백은 캐시 안 함 | D-007 | VP-03 · AC8 |
| 보안 | bare `git`, cwd = 저장소 | PATH 절대 항목 해석. diff·log 외부 프로그램 차단 | D-008·D-014 | VP-05·VP-06 |
| test seam | `runner = runGit` 기본 인자(`git-diff.ts`만) | 모든 공개 함수가 `gateway` 인자를 받는다(기본값 = production 관문) | 실행 수 oracle | VP-01~VP-09 |

**사라지는 책임**: `repoCoordsCache`(삭제 — probe가 대체), `insideWorkTree`·`repoRoot`(삭제 — probe), `headOid`(삭제 — probe.head), `gitAvailable`의 `--version` 실행(대체 — 실행 파일 해석 결과), `READ_ONLY_GIT_FLAG` 호출부별 부착(이동 — `gateway.read`).

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/git/git-executable.ts` | PATH에서 git 절대 경로 해석 | `{env, platform, isFile}` → `string \| null` | runner |
| `infra/git/runner.ts` | execFile 실행 | 기존 `GitRunResult` + `unavailable?: true` | gateway만 |
| `infra/git/gateway.ts` | read/mutate 관문, 세마포어·in-flight·세대 | `GitGateway` | infra/git 내부 모듈 |
| `infra/git/immutable-cache.ts` | 크기 상한 LRU | `get/set` | gateway 소비 모듈 |
| `infra/git/probe.ts` | 저장소 판정 1회 | `RepoProbe` | git-cli·git-diff·git-snapshot·repository |
| `infra/git/origin-url.ts` | origin URL + 검증값 캐시 | `string \| null` | git-snapshot·git-cli |
| `infra/git/git-snapshot.ts` | status(+summary) 조립 | `GitSnapshotResult` | `app/handlers/git.ts` |

## 10. 계약 / 타입 / 강제 지점

> **ΔV1**: EP-03·EP-06 SUPERSEDED, EP-09·EP-10 CHANGED, EP-11 NEW — §21.5.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-06·12 — **EP-01** | 읽기는 `--no-optional-locks` 선두 + `readOnly:true` | `gateway.read` | gateway | 모든 읽기 실행 직전 (1자리) | 사용자 저장소 index.lock 경합 |
| R-06 / VP-06 — **EP-02** | diff·log 읽기에 `--no-ext-diff --no-textconv` | `DIFF_SAFETY_ARGS` 상수(`git-diff.ts`) | 호출부 | 6자리: 요약 diff · log 정상 · log 폴백 · 패치 전문맥 · 패치 축소 · checkout shortstat | 외부 프로그램 실행·캐시 비결정 |
| MD-02 / VP-01·03 — **EP-03** | 캐시에는 `ok` 결과만 넣는다 | 각 `set` 호출부 | git-diff | 5자리: 요약 diff · history(정상만) · 패치(전문맥만) · commit parent · bornAt 기준 | 일시 실패가 영구화 |
| MD-04 / VP-05 — **EP-04** | 실행은 절대 경로로만 | `resolveGitExecutable` | runner | 실행마다 (1자리) | 저장소 안 가짜 git 실행 |
| AR-01 / VP-04·08 — **EP-05** | 쓰기는 `gateway.mutate` 경유 + 세대 +1 | `gateway.mutate` | git-cli·worktree | 8자리: stash·commit-wip·discard·checkout·worktree add·remove·branch -d·repair (+세대 1) | 락 없이 쓰기 / 쓰기 전 읽기 결과 공유 |
| MD-02 / VP-15 — **EP-06** | 캐시 키 = `[commonDir, kind, ...oid]` | `cacheKey()` | git-diff | EP-03의 5자리와 같은 자리의 `get` | 다른 저장소 설정의 결과 공유 |
| SD-02 / VP-04·11 — **EP-07** | checkout 성공 결과에 `status` | `gitCheckout` | git-cli | 성공 반환 1자리 | 칩이 옛 브랜치 표시 |
| AR-02 / VP-07·13 — **EP-08** | renderer의 상태 조회는 `gitApi.snapshot`만 | `gitApi` | renderer | 3자리: `useGitSnapshot`·`BranchChip` 초기 로드·`useGitIdentityRemote` | 없는 채널 호출(typecheck가 잡는다) |
| MD-06 / VP-02·19 — **EP-09** | origin URL 캐시는 `<commonDir>/config` 내용이 같고 `include`·`includeIf`·`worktreeConfig`가 없을 때만 적중. 저장 대상은 성공한 URL과 exit 2(`No such remote`, 실측)의 `null`뿐 | `readOriginUrl` | origin-url | 조회마다 (1자리) | 원격 변경 후 옛 URL 표시 |
| AR-01 / VP-09 — **EP-10** | `runner`·`child_process` import 허용 파일 = `gateway.ts`·`runner.ts`·테스트·픽스처 | `app/eslint.config.mjs` | lint | `npm run lint` (1자리) | 관문 우회 호출부 |

- 같은 규칙의 SSOT: 브랜치 이름은 기존 `GitBranchNameSchema`, OID 형식은 기존 `revParseOid` 정규식을 유지한다. probe도 HEAD oid를 같은 함수로 검증한다.
- "다른 게이트가 막는다" 기재: EP-08의 "typecheck가 잡는다" — 채널을 지우면 `window.orca.git.status` 타입이 사라져 호출부가 컴파일 오류가 된다. 구현 턴에 채널 제거 후 typecheck 실패를 관측해 기록한다.
- 선택적 필드 의미: `GitSnapshotResult.summary`는 `includeSummary:false`면 항상 `null`이다. `true`인데 `null`이면 폴백(zod 실패)이며 renderer는 요약 조회 실패로 처리한다. `GitRunResult.unavailable`은 실행 파일을 못 찾았을 때만 `true`고 그 외에는 없다.

### 새 타입

```ts
// shared/ipc.ts
export interface GitSnapshotQuery { cwd: string; sessionId?: string; includeSummary: boolean }
export interface GitSnapshotResult { status: GitStatus; summary: GitDiffSummary | null }
export type GitCheckoutResult =
  | { ok: true; branch: string; status: GitStatus }
  | { ok: false; reason: 'dirty'; from: string | null; stat: GitDirtyStat }
  | { ok: false; reason: 'not-repo' | 'error'; message: string; applied?: GitDirtyResolution }
// GitDiffSummary 에서 uncommitted 삭제

// infra/git/probe.ts
export type RepoHead =
  | { kind: 'branch'; name: string; oid: string }
  | { kind: 'detached'; oid: string }
  | { kind: 'unborn'; name: string | null }
export type RepoProbe =
  | { kind: 'unavailable' }                 // 실행 파일 없음
  | { kind: 'not-repo' }                    // 경로 없음·작업 트리 밖
  | { kind: 'repo'; root: string; gitDir: string; commonDir: string; head: RepoHead }
```

`CHANNELS.gitSnapshot = 'orca:git:snapshot'`를 추가하고 `gitStatus`·`gitDiffSummary`를 삭제한다. 스키마는 `GitSnapshotRequestSchema = GitDiffRequestSchema.extend({ includeSummary: z.boolean() })`이다.

## 11. 구현 설계

> **ΔV1**: `immutable-cache.ts`·`origin-url.ts` 신설과 아래 "캐시 상한" 표는 폐기한다. 파일 표의 변경분은 §21.6.

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `infra/git/git-executable.ts` (신규) | 실행 파일 해석 | PATH 분리(win32 `;`, 그 외 `:`), 빈 항목·`!isAbsolute` 제외, 후보 `git.exe`(win32)/`git`, 첫 `isFile` 적중. 양성만 memo | 순수 — `isFile` 주입 |
| `infra/git/runner.ts` | 실행 | 해석 결과가 null이면 spawn 없이 `{ok:false, unavailable:true}`. 경로는 절대 경로로 execFile | 기존 `execFileImpl` + resolver 주입 |
| `infra/git/gateway.ts` (신규) | 관문 | `createGitGateway({run, maxConcurrentReads=4})` → `read(cwd, args, {maxBuffer, timeoutMs})`, `mutate(repoPath, fn)`, `generation()`. read 키 = `JSON.stringify([gen, cwd, args, maxBuffer])`. 완료 시 in-flight 맵에서 제거. production 싱글턴 `gitGateway` | 가짜 run 주입 |
| `infra/git/immutable-cache.ts` (신규) | LRU | `createImmutableCache<V>({maxUnits, sizeOf})`, Map 삽입 순서 LRU | 순수 |
| `infra/git/probe.ts` (신규) | 판정 | stat → `rev-parse --is-inside-work-tree --show-toplevel --git-dir --git-common-dir HEAD --symbolic-full-name HEAD`. 실패 시 좌표 4개만 다시 묻고, 성공하면 `symbolic-ref -q HEAD`로 unborn 이름을 얻는다. 경로는 `resolve(cwd, v)` 후 `canonicalPath` | gateway 주입 + 실저장소 |
| `infra/git/origin-url.ts` (신규) | 원격 URL | config 파일 내용을 읽어 `Map<commonDir, {content, url}>` 대조. include 류가 있으면 캐시 우회 | fs·gateway 주입 |
| `infra/git/git-snapshot.ts` (신규) | snapshot 조립 | probe 1회 → status. `includeSummary`면 같은 probe로 `summarize(probe, baseline)` | gateway 주입 |
| `infra/git/git-diff.ts` | 요약·패치 | `repoCoords`·`headOid` 삭제. `resolveDiffRange`가 probe.head를 받는다. base oid = head oid면 diff 생략(빈 결과). diff·log·cat-file·rev-list·패치 결과를 LRU에 저장(ok만). `DIFF_SAFETY_ARGS` 부착. 공개 함수 인자 `runner` → `gateway` | gateway 주입 |
| `infra/git/git-cli.ts` | branches·checkout | `insideWorkTree`·`repoRoot`·`dirtyStat` 선행 rev-parse 삭제 → probe. 해소 3종·checkout은 `gateway.mutate`. 성공 시 probe로 `status` 조립. `gitStatus` 삭제(`git-snapshot`으로 이동) | gateway 주입 |
| `infra/git/repository.ts` | 기존 판정 API | `resolveRepoRoot`·`resolveHead`·`resolveHeadRef`를 probe 위로 재구현. `gitAvailable`은 삭제(probe `unavailable`) | gateway 주입 |
| `infra/git/worktree.ts` | 쓰기 | add/remove/deleteBranch를 `gateway.mutate`로. `repairWorktree` 신설 | 기존 |
| `infra/git/mutation-queue.ts` | 저장소 락 | 유지. `gateway.mutate` 내부에서만 부른다 | 기존 |
| `features/worktrees/service.ts` | 준비 | `resolveRepoRoot`+`gitAvailable`+head 2회 → probe 1회. 판정 순서·사유 문구 불변(D-018) | 기존 operations 주입 |
| `app/chat-turn/prepare-worktree.ts` | passthrough 기준선 | resolveHead·resolveHeadRef → probe 1회 | 기존 |
| `app/legacy-paths.ts` | repair | `git: GitRunner` 주입 → `repair: typeof repairWorktree` | 기존 테스트의 주입부만 교체 |
| `app/handlers/git.ts` | IPC | status·diffSummary 핸들러 → snapshot 핸들러 1개. 폴백 `{status: NOT_REPO, summary: null}` | 통합 |
| `shared/ipc.ts`·`shared/protocol.ts` | 계약 | §10 새 타입·채널·스키마. `uncommitted` 삭제 | 스키마 케이스 |
| `preload/index.ts`·`renderer/src/shared/api/ipc.ts` | 배선 | `git.snapshot` 추가, `status`·`diffSummary` 삭제 | typecheck |
| `renderer/.../useGitSnapshot.ts` | 조회 owner | 두 effect를 하나로 합친다. 순수 `planGitSnapshotQuery(prevStatus, prevSummary, next)` → `{status, summary}` 사유. summary 사유가 있으면 owner.run(`includeSummary:true`)의 onResult가 `setGitStatus`와 `receiveGitSnapshotSummary`를 둘 다 부른다. status 사유만 있으면 `includeSummary:false` | 순수 함수 표 |
| `renderer/.../BranchChip.tsx`·`branchChipState.ts` | 전환 | `checkoutOutcome`의 `switched`가 `status`를 싣는다. 성공 시 `setSnapshot({cwd, status})`. 초기 로드는 `snapshot(false).status` | 순수 + 배선 |
| `renderer/.../useGitIdentityRemote.ts` | 원격 메뉴 | load = `snapshot({cwd, includeSummary:false}).then(r => r.status)` | 기존 wiring 테스트 |
| `app/eslint.config.mjs` | 경계 | `src/main/**`에 `no-restricted-imports` 패턴 `**/infra/git/runner`·`node:child_process`, 허용 파일 override | AC22 변이 |
| `docs/IPC_CONTRACT.md §2.6-b`·`docs/generated/inventory.md` | 계약 문서 | 채널 행 교체, checkout 결과·요약 필드 갱신. inventory는 스크립트로 재생성 | `--check` |

### 캐시 상한 (단위: 문자 수)

| 캐시 | 키 | 상한 |
|---|---|---|
| 패치 | `[commonDir, 'patch', baseOid, targetOid]` | 32,000,000자 |
| 요약 diff·history·commit parent·bornAt 기준 | `[commonDir, kind, ...oid]` (bornAt은 `[commonDir, 'born', bornAt, headOid]`) | 합계 8,000,000자 |

### 테스트 가능성

- electron 비의존: `infra/git` 전체가 node 전용이다. 새 모듈도 electron을 import하지 않는다.
- 기존 메커니즘 재사용: `withRepoMutation`은 형상 그대로 `gateway.mutate`가 감싼다. `temp-repo.testfixture.ts` 정리 규약을 새 실저장소 테스트에도 쓴다.
- 순서 관측: 지연 가능한 가짜 run(Promise 수동 해제)으로 in-flight 수와 공유 여부를 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
gateway/probe → gitSnapshot → IPC GitSnapshotResult → useGitSnapshot → chatStore(setGitStatus, receiveGitSnapshotSummary) → GitRow·변경사항 타일
```

- producer 기준: `status`는 요청 시점 probe, `summary`는 같은 probe의 HEAD 기준이다. 두 값이 한 시점을 본다. AS-IS는 두 IPC 사이에 커밋이 끼면 서로 다른 HEAD를 볼 수 있었다.
- consumer 파생 규칙: 기존 reducer 액션을 그대로 쓴다. 새 합성값은 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `registerGitHandlers` (`bootstrap.ts:987`) | 등록 채널 5 → 4 | AC19 |
| `repairMovedWorktrees` 부팅 호출 | 주입 형태만 변경 | AC21 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 관문 싱글턴은 모듈 로드 시 만든다. 실행 파일 해석은 첫 실행 때 한다.
- 취소/중단: `signal`은 `worktree add`만 쓴다(mutate). in-flight 공유 대상인 읽기는 signal을 받지 않는다. 받게 되면 한 호출자의 취소가 다른 호출자에게 번진다.
- retry/timeout/partial failure: 타임아웃·aborted·실패 결과는 캐시하지 않는다(EP-03).
- cleanup/rollback: prepare 롤백 순서는 불변이다.
- **다중 저장소 쓰기**: 해당 없음. 캐시는 메모리 한 곳이고 git 쓰기는 기존과 같은 단일 명령이다. 문서 산출물은 `plan.md`와 `INDEX.md` 행 두 곳이며, 이 설계 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

> **ΔV1**: 실행 수 표와 메모리 상한은 §21.8이 대체한다.

| 요청 | AS-IS | TO-BE |
|---|---:|---:|
| 턴 종료, 새 커밋 없음 (타일 닫힘) | 7 | 1 |
| 턴 종료, 새 커밋 있음 | 7 | 3 |
| 타일 열림 추가분 | +1 | +1(probe, 캐시 적중) |
| 초기 상태 (origin 캐시 적중) | 4 | 1 |
| checkout clean | 9 | 4 |
| checkout dirty·해소 없음 | 4 | 2 |
| 새 세션 passthrough | 2 | 1 |
| worktree 준비(baseRef 없음) | 6 | 4 |
| 비저장소 디렉토리 턴 종료 | 2(status 1 + 요약 1) | 2 |

- 메모리 worst-case: 패치 32M자 + 기타 8M자 ≈ UTF-16 기준 80MB 상한. 패치 1건 상한은 기존 `PATCH_MAX_BUFFER` 16MB다.
- 동시 실행 worst-case: 읽기 4 + 쓰기(저장소당 직렬) 저장소 수.
- 잃는 부수 효과: ① textconv 표시(D-014) ② 캐시된 diff는 이후 `.gitattributes` 변경을 반영하지 않는다 — 같은 OID 쌍인 동안만이고 새 커밋이 생기면 새로 계산한다 ③ 외부에서 일어난 커밋과 동시에 진행 중인 읽기는 커밋 전 결과를 공유할 수 있다(지금의 동시 호출과 같은 수준) ④ 전역 config의 `url.*.insteadOf` 변경은 저장소 config 내용이 바뀔 때까지 origin URL에 반영되지 않는다. 이 컨테이너에서 전역 insteadOf가 `remote get-url` 출력을 바꾸는 것을 실측했다. 영향은 링크 표시뿐이다.

## 15. 외부 구현 포트 / 문서 계약

- 외부 구현자가 구현하는 포트는 없다. IPC 소비자는 이 저장소의 renderer뿐이다.
- 구현 문서: `docs/IPC_CONTRACT.md §2.6-b`. shape는 typecheck, semantics는 `ipc-documentation.test`와 AC16~AC19로 대조한다.

## 16. 기존 결정·규칙과의 관계

> **ΔV1**: 추가 행은 §21.9.

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 좌표만 캐시, 파일 내용은 캐시하지 않는다 (0211 D-063) | `git-diff.ts:188` | §9 캐시 행 | 유지. 좌표 캐시조차 없애고, 캐시되는 결과는 OID로 불변이다 |
| 읽기는 저장소를 잠그지 않는다 (0211 D-064), AT-39 차집합 | `git-diff.ts:41-44` | EP-01 | 유지. 부착 자리를 관문으로 옮기고 차집합 oracle을 관문 전체로 넓힌다 |
| 커밋된 것만 본다 (0211 D-111) | `git-diff.ts:143-156` | §11 git-diff 행 | 유지 |
| `uncommitted` 형태만 남김 (0211 I-06) | `git-diff.ts:283-287` | D-012 | 변경 — 계약 변경 허용(D-002)으로 삭제 |
| 상태 응답에 변경량 축이 없다 (0211 D-027) | `IPC_CONTRACT.md:202` | §10 새 타입 | 유지 |
| 브랜치 이름 검사 2중(스키마 + 실행부) | `git-cli.ts:118-125` | §11 git-cli 행 | 유지 |
| 격리 준비는 dirty를 거부하지 않는다 (0210 D-105) | `IPC_CONTRACT.md:41` | §11 service 행 | 유지 |
| 원격 요청 Chromium 단일 스택 | `app/src/main/AGENTS.md` | — | 무관(네트워크 호출 없음) |
| 레이어 DAG | `app/src/main/AGENTS.md` | §11 전체 | 유지. 신규 모듈은 전부 `infra/git` |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| probe 한 호출의 출력 순서 가정 | 7케이스 실저장소 테스트(VP-14). 실패 시 좌표 재질의 폴백 |
| 오래된 git이 인자 조합을 거부 | 거부는 실패로 나타나고 폴백 경로(좌표 4개 + symbolic-ref)가 받는다 |
| PATH 절대 항목 제한으로 git을 못 찾는 환경 | 상대 PATH 항목에만 git이 있는 환경은 지금 cwd에 따라 다른 git을 실행하는 상태라 안전하지 않다. 못 찾으면 `unavailable`로 드러난다 |
| textconv 표시 변경 | D-014, 사용자 수용(턴 4) |

- 되돌리기 어려운 결정: IPC 채널 이름 `orca:git:snapshot`(D-010).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/git/{git-executable,gateway,immutable-cache,probe,origin-url,git-snapshot}.ts` (신규) + 각 테스트
- `app/src/main/infra/git/{runner,git-diff,git-cli,repository,worktree}.ts`
- `app/src/main/features/worktrees/service.ts`, `app/src/main/app/chat-turn/prepare-worktree.ts`, `app/src/main/app/legacy-paths.ts`, `app/src/main/app/handlers/git.ts`
- `app/src/shared/{ipc,protocol}.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`
- `app/src/renderer/src/features/chat/components/composer/{useGitSnapshot,BranchChip,branchChipState,useGitIdentityRemote}.ts(x)`
- `app/eslint.config.mjs`
- `docs/IPC_CONTRACT.md`, `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md §두 가지 강제 규칙`.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate의 vitest 명령. 실저장소 스위트는 `temp-repo.testfixture.ts` 정리 규약을 따른다.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: 없음.

## V1 최초 READY self-review (이전 판정)

아래 체크는 V1 최초 설계 때의 기록이다. 현재 판정은 §23.7(ΔV2 READY self-review)이 갖는다.

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-004가 사용자 턴 1~3.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1·§5.
- [x] 조건절·이유절을 재해석하지 않았다 — §2 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태 표 5행 ↔ AC16·AC1·AC15·AC7·AC12.
- [x] AS-IS와 TO-BE가 같은 축으로 있다 — §9.
- [x] Delta 각 행이 파일·AC로 이어진다 — §9 Delta 마지막 열.
- [x] 사라진 책임을 명시했다 — §9 "사라지는 책임".
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8.
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다 — §7.
- [x] Baseline V — §7-A.
- [x] NEW node마다 REQUIRED pair가 있다 — VP-01~VP-19.
- [x] INHERITED node 없음 — Baseline.
- [x] pair의 경로·강제 지점·oracle이 있고, 적대 증거는 필요한 pair에만 선택했다 — VP-02·03·05·06·09.
- [x] 운영 gate를 열거했다 — §7-A.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] structural proxy만으로 검증하는 AC가 없다 — 실행 수는 정확 일치, 안전성은 마커 부재로 단언한다.
- [x] 신규 계약의 SSOT·강제 지점·seam — §10·§11.
- [x] 부팅/등록 변경의 소비처 — §12.
- [x] producer/consumer 의미 — §12.
- [x] 상한·총량·one-way door — §14·§17.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다 — §19.
- [x] Ledger ↔ AC 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

## 20. [구현자 기입] 구현 전 설계 리뷰 — r1, 2026-09-26

**DRAFT — G1~G5를 설계자에게 인계한다.** 단일 실행 관문·snapshot 통합·실패 결과 비캐시 방향은 유지하되, 아래 설계 전제와 검증 계약을 보완해야 한다. 구현과 독립 verify는 수행하지 않았으므로 `verify/RETURN_TO_PLAN`으로 기록하거나 라운드를 올리지 않는다.

### 20.1 보완 사항과 근거

| ID / 상태 | 출처 / 영향 범위 | 확인한 사실 | 설계자가 닫을 항목 |
|---|---|---|---|
| **G1 · P1 · PLAN_GAP · open** | D-006·D-014, VP-01·03·10·15, EP-03·06, §11 캐시 키·§14·§16 | 임시 저장소와 linked worktree에서 동일 `commonDir`·base/head OID로 `git diff --no-ext-diff --no-textconv --numstat <base> <head>`를 실행했다. worktree에 `*.txt -diff`를 설정하자 결과가 `1\t1\tsample.txt`와 `-\t-\tsample.txt`로 달랐고, 별도 `git replace` 재현에서는 HEAD OID가 같은데 log subject가 `second`에서 `base`로 바뀌었다. | OID만으로 출력이 불변이라는 가정을 정정한다. 속성·설정·replacement가 결과에 미치는 영향과 worktree 간 캐시 공유 범위를 정하고, 캐시 키·유효성 검사·우회 또는 명시적 입력 고정 정책을 AC·V-pair·§10에 연결한다. |
| **G2 · P1 · PLAN_GAP · open** | §12 동일 시점 계약, VP-01·03·10, EP-03·06 | 현재 `git-diff.ts`의 `diffRevArgs`·`readCommitHistory`·bornAt 조회는 `HEAD`를 명령 인자로 사용한다. 임시 저장소에서 probe 뒤 커밋을 추가했을 때 `<base> HEAD`의 numstat는 `2/1`, `<base> <probe OID>`는 `1/1`이었다. | probe OID가 실제 diff·log·rev-list 인자와 캐시 키까지 동일하게 전달되도록 강제 지점을 명시한다. probe와 실행 사이에 HEAD를 이동시키는 지연 테스트로 요약·패치·history·bornAt 경로 및 이후 캐시 적중 결과를 검증한다. |
| **G3 · P2 · PLAN_GAP · open** | §1 표시 정확성, D-006, VP-02·19, EP-09, §14 | EP-09는 `<commonDir>/config`만 비교한다. §14는 전역 `url.*.insteadOf` 변경이 캐시된 origin URL에 반영되지 않는다고 이미 적고 있으며, Git 공식 `remote get-url` 계약도 URL rewrite 확장을 명시한다. | origin 출력에 영향을 주는 설정 범위를 조사해 유효성 조건·캐시 우회 조건을 정한다. 저장소 config는 같고 외부 설정만 바뀌는 회귀 AC를 추가하며, 현재 URL 표시 의미를 낮추는 선택은 기존 사용자 수용으로 간주하지 않는다. |
| **G4 · P2 · PLAN_GAP · open** | D-019, AC22, VP-09·12, EP-10, §11 lint 행 | 설치된 ESLint `Linter.verify`에 제안 패턴 `**/infra/git/runner`·`node:child_process`를 적용했다. `../infra/git/runner`·`node:child_process`는 error지만 `./runner`·`child_process`는 error 0이고, 현재 git 내부 production import도 `./runner`를 쓴다. | 상대 import와 Node built-in의 두 표기를 포함해 실제 runner 도달 경로를 차단하도록 경계를 설계한다. 외부 feature뿐 아니라 `infra/git` 내부 허용 파일 밖의 우회도 실패하는 변이를 AC22·VP-09·12에 등록한다. |
| **G5 · P2 · PLAN_GAP · open** | D-005, AC24, VP-09·18, §11 effect 통합, §16 기존 결정 | `git-diff.test.ts`의 좌표 캐시 테스트는 두 번 조회 후 probe 1회를 요구하지만 새 설계는 요청마다 probe한다. `gitQueryReason.test.ts`의 배선 테스트는 effect 2개를 요구하므로 effect 통합과 충돌하며, 둘 다 AC24가 허용한 필드·채널 변경 범위 밖이다. | AC24를 보존할 행동과 교체할 구조 단언으로 나눠 정정한다. 구 테스트 → 대체 oracle·pair 대응을 남기고 매 요청 probe, 초기·cwd·턴 종료·수동 계기, sessionId만 변경 시 추가 조회 없음과 늦은 응답 처리를 잠근다. |

근거 코드: [git-diff.ts](../../../app/src/main/infra/git/git-diff.ts)의 `diffRevArgs`·`readCommitHistory`·`resolveDiffRange`, [git-diff.test.ts](../../../app/src/main/infra/git/git-diff.test.ts)의 "저장소 좌표는 한 rev-parse 로 얻고 같은 runner 의 두 번째 조회는 다시 묻지 않는다", [gitQueryReason.test.ts](../../../app/src/renderer/src/features/chat/components/composer/gitQueryReason.test.ts)의 "두 effect 의 deps 가 `tick` 을 갖는다". G4의 실제 import 표본은 [repository.ts](../../../app/src/main/infra/git/repository.ts)·[git-cli.ts](../../../app/src/main/infra/git/git-cli.ts)·[worktree.ts](../../../app/src/main/infra/git/worktree.ts)다.

외부 계약: [Git attributes](https://git-scm.com/docs/gitattributes), [Git replace](https://git-scm.com/docs/git-replace), [Git remote get-url](https://git-scm.com/docs/git-remote#Documentation/git-remote.txt-get-url). G1·G2·G4는 이 리뷰 세션의 임시 저장소/메모리 내 검사 관측이고, G3는 기존 plan의 실측 기록과 공식 계약 대조다; 앱 구현의 PASS 증거가 아니다.

### 20.2 설계자 인계 / READY 재진입 조건

- [ ] G1·G3: 캐시가 관측하는 입력과 공유 범위를 확정하고, §14의 표시 저하를 단순 부수 효과로 남기지 않는다. 정책에 따라 실행 횟수 AC1~AC3·AC7·AC25와 §14 성능 표의 적용 조건도 다시 산정한다.
- [ ] G2: 요약 diff·history 정상/폴백·패치 전문맥/축소·bornAt 조회의 OID 전달 자리를 전수로 세고, 캐시 키와 실행 인자의 일치를 경합 oracle로 잠근다.
- [ ] G4: 실제 import 경로를 기준으로 EP-10·AC22를 정정하고 외부/내부 우회 변이가 모두 lint error가 되는지 확인한다.
- [ ] G5: 기존 테스트의 행동 계약을 보존하면서 대체할 구조 단언을 명시하고 AC24·V-pair를 정정한다. 기존 장치가 검출하던 의미상 회귀를 대체 장치가 놓치지 않는지 확인한다.
- [ ] 필요한 규범 변경을 `V1 + Delta V`로 남기고 대체 행·pair·oracle을 연결한다. §10과 pair registry의 자리 수 및 Decision↔AC↔Technical Design을 다시 대조한 뒤 READY self-review를 새로 수행한다.
- [ ] G1~G5가 닫힌 설계 커밋에서 plan과 INDEX를 함께 `plan/READY`로 바꾼다. 그 전까지 다음 주체는 **Claude(설계 보완)**, 라운드는 **1**이며 앱 구현을 시작하지 않는다.

### 20.3 [설계자 응답] ΔV1 처분 — 2026-09-26

| ID | 판정 | 닫은 곳 |
|---|---|---|
| G1 | **closed** — 교차 요청 결과 캐시 제거(사용자 선택). 캐시 키·유효성 문제 자체를 없앴다 | D-021·D-024, §21.3 AC1·AC2·AC7·AC25, §21.4 VP-15 폐기 |
| G2 | **closed (ΔV2)** — 끝점을 요청 종류로 나누고(D-027) 경합 seam 순서를 정정했다 | §23.2 AC7·AC8·AC26, §23.4 EP-11a·11b, §23.5 seam |
| G3 | **closed** — origin URL 매 status 조회(사용자 선택). 전역 설정 변경 회귀 AC 추가 | D-022, §21.3 AC3, §21.5 EP-09, VP-19 폐기·VP-02 변경 |
| G4 | **closed** — lint 규칙 3종으로 해석 경로·두 표기·동적 import를 모두 막는다. 7변이 실측 | D-025, §21.3 AC22, §21.5 EP-10, §21.1 |
| G5 | **closed (ΔV2)** — checkout 성공 결과의 생산·소비 테스트 6자리를 처분 표에 넣고 AC24의 허용 범위를 나눴다 | §23.2 AC24, §23.6 R16~R20 |

ΔV1 설계 당시에는 §20.2 재진입 조건을 충족했다고 판정했으나, 재검토 후 현재 READY 재진입 조건은 §22.3이다. 라운드는 1 그대로다(구현·verify 미수행).

## 21. ΔV1 — §20 G1~G5 보완 (2026-09-26)

**당시 판정: READY → §22 재검토로 DRAFT → ΔV2(§23)로 READY.** V1 대비 캐시 계약을 걷어내고 HEAD 고정·lint 경계·기존 테스트 처분을 추가했다. 이 절의 규범은 V1 본문보다 우선하고, §23이 대체한 행은 각 소절 머리 표식을 따른다.

### 21.1 이번 턴 실측

| 대상 | 방법 | 관측 | 의미 |
|---|---|---|---|
| 속성이 diff 출력을 바꾸는가 | 임시 저장소, 같은 `<B> <H>`에 `*.txt -diff` 추가 전후 `diff --no-ext-diff --no-textconv --numstat` | `1 1 s.txt` → `- - s.txt` | OID만으로 출력이 정해지지 않는다(G1) |
| replace가 log를 바꾸는가 | `git replace <H> <B>` 전후 `log -1 --format=%s <H>` | `second` → `base` | 같은 OID에서도 다르다(G1) |
| HEAD 문자열 경합 | `<B>` 고정, 커밋 1개 추가 후 `diff --numstat <B> HEAD` vs `<B> <H>` | `2 1` vs `1 1` | 명령마다 HEAD를 다시 읽으면 한 응답이 두 시점을 본다(G2) |
| lint 경계 | `app/`에 임시 config로 규칙 3종 적용, 변이 파일 2개 lint | 7변이 전부 error: 외부 `../../infra/git/runner`, 내부 `./runner`, `export … from './runner'`, `import('./runner')`, `child_process`, `node:child_process`, `import('node:child_process')` | 문자열 패턴만으로는 `./runner`·`child_process`·동적 import가 빠진다(G4). 규칙 3종이 모두 닫는다 |
| 현재 트리의 경계 위반 | 같은 config로 `src/main` 전체 lint | 위반 5파일: `app/legacy-paths.ts`·`infra/git/{git-cli,git-diff,repository,worktree}.ts` | TO-BE가 고칠 파일과 일치. 구현 후 0이어야 한다 |
| 기존 테스트 충돌 | `rg` 전수(§21.7) | 좌표 캐시 2건, effect 2개 배선 1건, `uncommitted` 단언 5건·픽스처 12파일, 폐기 API 참조 6파일 | G5 처분 대상 |

### 21.2 Product 계약 대체 (§1·§5)

- 목표 문장 대체: 새 커밋이 없는 턴 종료에서 git 실행은 **2회**(probe·origin)이고, 세션 커밋이 있으면 **4회**다. AS-IS는 7회다.
- 표시 정확도: 요청 사이 캐시가 없으므로 모든 응답은 그 요청 시점의 git 출력과 같다. 한 응답 안의 status·요약·패치는 probe 한 시점을 본다(D-023).
- 상태 표 대체: 타일 패치 조회는 요청마다 probe 1 + patch 1(base = head면 patch 생략)이다. 커밋 선택 패치는 probe·cat-file·patch 3회다.
- 엣지케이스 대체: "캐시는 프로세스 메모리에만" → 요청 사이에 남는 값은 git 실행 파일 경로뿐이다. origin URL은 매번 조회하므로 설정 종류와 무관하게 현재 값이다.

### 21.3 AC ΔV1

> **ΔV2**: AC7·AC8·AC24·AC26 행은 §23.2가 대체한다.

| R | AT / AC | 상태 | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|---|
| R-01 | AT-01 / AC1 | CHANGED | baseline `B`이고 HEAD = `B`면 요약 포함 snapshot 실행은 2회(probe·`remote get-url`)이고 요약은 빈 목록이다. 같은 요청을 두 번 해도 두 번째도 2회다 | 각 호출 기록 = `[probe, remote]` 정확 일치 ×2 | tick → `orca:git:snapshot` → `gitSnapshot` |
| R-01 | AT-02 / AC2 | CHANGED | HEAD ≠ `B`면 실행 4회(probe·remote·diff·log). 같은 요청 반복도 4회이고, 사이에 커밋하면 결과가 새 커밋을 포함한다 | 기록 집합 정확 일치 ×2 + files·commits 단언 | 같음 |
| R-01 | AT-03 / AC25 | CHANGED | 레거시 `bornAt` 세션은 probe·rev-list 뒤 기준 OID가 HEAD와 같으면 3회, 다르면 5회다. rev-list 인자에는 probe OID가 있다 | 기록 정확 일치 + rev-list 인자 단언 + 반복 호출 동일 횟수 | 같음 |
| R-02 | AT-04 / AC3 | CHANGED | 상태만 요청하면 매 호출 2회(probe·remote)다. `remote set-url` 뒤와, 저장소 config는 그대로 두고 전역 config(`GIT_CONFIG_GLOBAL` 임시 파일)의 `url.*.insteadOf`만 바꾼 뒤 모두 다음 호출이 새 URL을 준다 | 기록 정확 일치 + 두 변경 후 `githubUrl` 단언. 기존 origin 케이스 통과 | 초기 마운트 → snapshot(false) |
| R-02 | AT-06 / AC5 | CHANGED | 커밋 0개 저장소: `branch` = 브랜치 이름, `detached:false`, 요약 `base.kind:'none'`, 실행 ≤4회 | 결과 단언 + 기록 길이 | 같음 |
| R-03 | AT-08 / AC7 | CHANGED | 범위 패치는 probe·patch 2회, HEAD = base면 probe 1회와 빈 파일 목록이다. 커밋 선택 패치는 probe·cat-file·patch 3회다. 반복 호출도 같은 횟수다 | 기록 정확 일치 ×2 | 타일 → `orca:git:diffPatch` |
| R-03 | AT-09 / AC8 | CHANGED | 전문맥 실패 후 축소 재시도는 전문맥 시도와 같은 OID 쌍을 인자로 쓴다. 두 시도 사이에 HEAD가 움직여도 범위가 바뀌지 않는다 | 두 호출 인자에서 `--unified=*`만 다르다 + 경합 runner로 결과가 probe OID 기준 | 같음 |
| R-04 | AT-16 / AC15 | CHANGED | clean 전환 성공은 `{ok:true, branch, status}`, `status.branch` = 새 브랜치, 실행 5회(probe·shortstat·checkout·probe·remote). dirty·해소 없음은 2회이고 결과 형태는 지금과 같다 | 결과 단언 + 기록 정확 일치. 기존 checkout 케이스 전부 통과 | 칩 → `orca:git:checkout` |
| R-07 | AT-17 / AC16 | CHANGED | 계기당 snapshot 1회: 초기·cwd 변경은 `includeSummary:false`, 턴 종료·수동은 `true`, sessionId만 바뀌면 호출 없음. 새 계기 뒤에 도착한 이전 응답은 status·summary 둘 다 반영하지 않는다 | 계획 함수 표(6계기) + owner 세대 테스트에 status 폐기 단언 추가 + 배선 스윕(§21.7 R3) | `useGitSnapshot` |
| R-09 | AT-23 / AC22 | CHANGED | 허용 파일(`gateway.ts`·`runner.ts`·테스트·픽스처) 밖에서 runner 해석 경로 import·re-export·동적 import, `child_process`·`node:child_process`의 정적·동적 import가 lint error다. 구현 후 `src/main` 위반은 0이다 | §21.1의 7변이를 심어 각각 error + 구현 후 `npm run lint` 0 error | `app/eslint.config.mjs` |
| R-09 | AT-24 / AC23 | **SUPERSEDED — 폐기** | (LRU 캐시 상한) | 캐시 모듈이 없다(D-021). 증거 이관처 없음 | — |
| R-09 | AT-25 / AC24 | CHANGED | 기존 테스트는 §21.7 처분 표대로만 바뀐다. "보존" 행은 수정 없이 통과하고, "이동"은 단언 문장이 같으며, "교체"는 표의 대체 oracle이 있고, "삭제"는 표의 근거를 가진다 | 구현 diff의 테스트 파일 집합 ⊆ §21.7 행 + 스위트 green | 전 경로 |
| R-10 | AT-26 / AC26 | **NEW** | 한 요청 안의 읽기 명령은 probe OID로 고정된다. probe 직후 커밋을 끼워 넣는 경합 runner에서 요약(files·totals·commits)·범위 패치(전문맥·축소)·bornAt 기준이 probe 시점 결과와 같다 | 경합 runner 실저장소 테스트 + **차집합**: 해당 경로 읽기 인자 중 `HEAD` 토큰 또는 `..HEAD` 접미가 있는 것 0건(예외: checkout dirty 검사 1자리) | snapshot·diffPatch 경로 |

변경 없는 AC(AC4·AC6·AC9~AC14·AC17~AC21)는 V1 §7 행이 유효하다. 활성 AC는 25건이다.

### 21.4 V ΔV1

> **ΔV2**: R-03·R-04·R-07·R-10·MD-07과 VP-03·04·07·09·20·21은 §23.3이 대체한다.

- V mode: Delta V. 기준 `0241:V1@f682cc2`(공유 브랜치에서 `git cat-file -t` → commit 확인).
- 변경 시작 수준: R(R-01·R-02·R-03·R-10 결과가 바뀐다).
- SUPERSEDED pair 증거 이관: VP-15(AC23, 변이 없음) → 폐기, 근거 D-021. VP-19(MD-06, 선택 변이 "내용 비교 → mtime 비교") → 폐기, 근거 D-022(캐시 없음). G3 회귀는 VP-02의 AC3 전역 설정 케이스가 새로 든다.

| Node | 레벨 | provenance | 기준선 출처 / 대체 |
|---|---|---|---|
| R-01·R-02·R-03·R-04·R-07·R-09 | R | CHANGED | V1 §7-A → §21.3 |
| R-10 | R | NEW | — (OID 고정, AC26) |
| SD-01 | SD | CHANGED | 턴 종료 경로에서 캐시 단계 제거, OID 고정 추가 |
| AR-01 | AR | CHANGED | lint 규칙 3종(D-025) |
| AR-02 | AR | CHANGED | `gitApi.status` 래퍼 유지(D-026) |
| MD-02 | MD | SUPERSEDED | 대체 없음 — D-021 |
| MD-05 | MD | CHANGED | effect 1개 + 늦은 응답 폐기 |
| MD-06 | MD | SUPERSEDED | 대체 없음 — D-022 |
| MD-07 | MD | NEW | `rangeArgs(baseOid, headOid)` 순수 인자 생성기 |
| 그 외(SD-02·MD-01·MD-03·MD-04 등) | — | INHERITED | V1 §7-A |

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED (CHANGED) | tick → snapshot → probe → (base≠head) diff‖log | AC1·AC2·AC25 반복 호출 정확 일치 | not selected — 반복 호출 동일 횟수가 캐시 재도입에, 정확 일치가 우회에 반응 | EP-11(요약 diff·history 2종·bornAt = 4) |
| VP-02 | R-02 ↔ AT-04~07 | REQUIRED (CHANGED) | 초기 마운트 → snapshot(false) → probe → remote | AC3 두 설정 변경 반영 | required — "저장소 config 내용이 같으면 직전 URL 재사용" 변이를 `buildStatus`에 심으면 AC3 전역 insteadOf 케이스 실패 | EP-09(2) |
| VP-03 | R-03 ↔ AT-08·09 | REQUIRED (CHANGED) | 타일 → diffPatch → probe → patch(전문맥 → 축소) | AC7·AC8 | required — 축소 재시도 인자를 `HEAD`로 되돌리는 변이 → AC8 경합 케이스 실패 | EP-11(패치 2) |
| VP-04 | R-04 ↔ AT-14~16 | REQUIRED (CHANGED) | 칩 → checkout → mutate → probe → remote | AC13~AC15 | not selected | EP-05(8)·EP-07(1)·EP-09(checkout 1) |
| VP-07 | R-07 ↔ AT-17~20 | REQUIRED (CHANGED) | renderer 3호출부 → preload → handler | AC16 표 + 소유자 스윕(§21.7 R4) + AC17·AC18·AC19 | not selected | EP-08(3) |
| VP-09 | R-09 ↔ AT-23·25 | REQUIRED (CHANGED) | lint · 전 스위트 | AC22 7변이 + AC24 처분 표 대조 | required — AC22 7변이 자체 | EP-10(1 설정, 7변이) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED (CHANGED) | 실저장소: 커밋 없음 → 커밋 → 반복 | 실행 수 2 → 4 → 4, 결과가 커밋 반영, 인자에 probe OID | not selected | EP-08·EP-11 (9) |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED (CHANGED) | production 모듈 → 관문 | AC22 + AC9 차집합 | VP-09 공유 | EP-01·EP-05·EP-10 (10) |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED (CHANGED) | preload `git.snapshot`·renderer `gitApi.status` 래퍼 → handler | `ipc-documentation.test` + 스키마 거절 + `gitIdentityRemoteWiring` 무수정 통과 | not selected | EP-08(3) |
| VP-15 | MD-02 ↔ UT-02 | **SUPERSEDED** | — | — | — | 폐기(D-021) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED (CHANGED) | `planGitSnapshotQuery` + owner | AC16 표 + status 늦은 응답 폐기 | not selected | 0 — 순수 |
| VP-19 | MD-06 ↔ UT-06 | **SUPERSEDED** | — | — | — | 폐기(D-022) |
| VP-20 | R-10 ↔ AT-26 | REQUIRED (NEW) | snapshot·diffPatch → probe → 6자리 명령 | 경합 runner 결과 + 인자 차집합 | required — EP-11의 6자리마다 OID를 `HEAD`로 바꾸는 변이 6종, 각각 AC26 실패 | EP-11(6) |
| VP-21 | MD-07 ↔ UT-07 | REQUIRED (NEW) | `rangeArgs` | base=head → `null`(실행 생략), 그 외 `[base, head]`·`base..head` 표 | not selected | 0 — 순수 |

### 21.5 §10 ΔV1

> **ΔV2**: EP-11은 §23.4의 EP-11a·EP-11b로 나뉜다.

| V node / pair | 계약 | SSOT | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|
| EP-03 · EP-06 | **SUPERSEDED** — 결과 캐시가 없다(D-021) | — | — | — |
| **EP-09** (CHANGED) VP-02·04 | `status.githubUrl`은 probe가 repo일 때 매번 `remote get-url origin`으로 만든다 | `buildStatus(probe)` (`git-snapshot.ts`) | 2자리: snapshot status · checkout 성공 status | 원격·전역 설정 변경 후 옛 링크 |
| **EP-10** (CHANGED) VP-09·12 | 규칙 3종(D-025). 허용: `infra/git/gateway.ts`·`infra/git/runner.ts`·`**/*.test.ts`·`**/*.testfixture.ts` | `app/eslint.config.mjs`의 `src/main/**` 블록 | 1자리(설정), 7변이 | 관문 우회 |
| **EP-11** (NEW) VP-01·03·20 | 읽기 명령의 범위 인자는 `rangeArgs(base, probe.head.oid)` 결과다 | `rangeArgs` (`git-diff.ts`) | 6자리: 요약 diff · history 정상 · history 폴백 · bornAt rev-list · 패치 전문맥 · 패치 축소. 예외 1자리: checkout dirty `diff HEAD --shortstat`(쓰기 직전 게이트라 실제 HEAD 기준이 맞다) | 한 응답이 두 시점을 섞는다 |

- EP-11 예외의 근거: dirty 검사는 뒤따르는 `checkout`이 보는 실제 작업 트리 기준이어야 한다. 쓰기 명령(`reset --hard HEAD` 등)도 같은 이유로 예외다.

### 21.6 Technical ΔV1

> **ΔV2**: `rangeArgs` 시그니처와 경합 seam 설명은 §23.5가 대체한다.

```text
tick ──> gitApi.snapshot({includeSummary}) ──> handler ──> gitSnapshot
           ├─ probeRepo ──> gateway.read ×1           (H = probe.head.oid)
           └─ (repo) buildStatus ‖ summary?
                  buildStatus ──> gateway.read(remote get-url origin)
                  summary     ──> rangeArgs(B, H) = null ? 빈 결과 : diff(B,H) ‖ log(B..H)
diffPatch ──> probe ──> rangeArgs(B, H) ──> patch(전문맥) ──(실패)──> patch(축소, 같은 인자)
gateway.read = 세마포어(4) + in-flight 공유(키에 세대) + --no-optional-locks + readOnly   (요청 사이 보관 없음)
```

| 파일 | V1 계획 | ΔV1 |
|---|---|---|
| `infra/git/immutable-cache.ts` | 신설 | **만들지 않는다** |
| `infra/git/origin-url.ts` | 신설(내용 검증 캐시) | **만들지 않는다**. `buildStatus`가 `remote get-url`을 직접 부른다(exit 2 → `null`) |
| `infra/git/git-snapshot.ts` | status(+summary) | `buildStatus(probe, gateway)` export — checkout도 이것을 쓴다 |
| `infra/git/git-diff.ts` | LRU 저장 | LRU 없음. `rangeArgs(base, head): null \| {diff: [base, head], log: \`${base}..${head}\`}` 신설, EP-11 6자리가 사용. bornAt `rev-list -1 --before=T <H>` |
| `infra/git/git-cli.ts` | 성공 시 status | `buildStatus` 재사용 |
| `renderer/src/shared/api/ipc.ts` | status·diffSummary 삭제 | `status: (cwd) => window.orca.git.snapshot({cwd, includeSummary:false}).then(r => r.status)` 래퍼 유지(D-026), `snapshot` 추가, `diffSummary` 삭제 |
| `renderer/.../useGitSnapshot.ts` | effect 통합 | owner.run 하나가 status·summary를 같은 세대로 커밋한다. status 전용 `live` 플래그 경로는 없어진다 |
| `app/eslint.config.mjs` | `no-restricted-imports` 패턴 | 아래 블록 |

```js
// app/eslint.config.mjs — src/main 블록 뒤에 추가 (D-025, §21.1 실측 설정과 같다)
{
  files: ['src/main/**/*.ts'],
  ignores: ['src/main/infra/git/gateway.ts', 'src/main/infra/git/runner.ts', '**/*.test.ts', '**/*.testfixture.ts'],
  rules: {
    'no-restricted-imports': ['error', { paths: [{ name: 'child_process' }, { name: 'node:child_process' }] }],
    'no-restricted-syntax': ['error',
      { selector: "ImportExpression[source.value=/^(node:)?child_process$/]" },
      { selector: "CallExpression[callee.name='require'][arguments.0.value=/^(node:)?child_process$/]" }],
    'import/no-restricted-paths': ['error', { zones: [{ target: './src/main', from: './src/main/infra/git/runner.ts' }] }]
  }
}
```

- 이 블록이 `no-restricted-syntax`를 새로 쓰므로 기존 설정에 같은 규칙이 없음을 확인했다(`rg "no-restricted" app/eslint.config.mjs` → 0건). 이후 다른 블록이 같은 규칙을 쓰면 flat config 병합으로 덮이므로 AC22 변이가 그 회귀를 잡는다.
- 경합 테스트 seam: `createGitGateway({ run })`의 `run`을 감싸 probe 인자(`--is-inside-work-tree`로 식별)를 본 직후 실저장소에 `git commit`을 실행하고 원래 호출을 넘긴다.

### 21.7 기존 테스트 처분 (G5 · AC24의 정본)

> **ΔV2**: R10은 R16이 대체하고 R16~R20을 추가한다(§23.6). 표 정본은 이 표 + §23.6이다.

| # | 대상 (파일:줄 / 케이스) | 처분 | 대체 oracle / 근거 |
|---|---|---|---|
| R1 | `git-diff.test.ts:580` "저장소 좌표는 한 rev-parse 로 얻고 … 두 번째 조회는 다시 묻지 않는다" | **교체** | "좌표가 한 호출"은 probe 단언으로 보존. "두 번째 재질의 없음"은 D-005로 의도적 반전 → AC1 반복 호출 2회 |
| R2 | `git-diff.test.ts:595` "runner 가 다르면 캐시를 공유하지 않는다" | **삭제** | 캐시가 없다(D-021) |
| R3 | `gitQueryReason.test.ts:122` "두 effect 의 deps 가 `tick` 을 갖는다" | **교체** | 스윕 대상: effect 1개의 deps가 `tick`·`refreshTick`·status 키·요약 키를 모두 가진다(정확히 1건). 실행 축은 AC16 계획 함수 표. `:117` `busy` 부재 단언은 보존 |
| R4 | `gitQueryOwner.test.ts` 소유자 스윕 | **교체(축 갱신)** | `QUERY_CALL`에 `snapshot` 추가·`diffSummary` 제거. 기대: `status` 소유자 = `useGitIdentityRemote` + 랜딩 칩 예외, `snapshot` = `useGitSnapshot`, `diffPatch` = `useGitPatch`. "없다·있다" 양방향 구조 유지 |
| R5 | `git-diff.test.ts:125·146·449·479` `uncommitted` 단언 4건 | **삭제** | D-012. "커밋된 것만" 의미는 `:134` 케이스가 보존 |
| R6 | `shared/git-diff-schema.test.ts:29-34` | **교체** | 문서 슬라이스 기준을 `orca:git:snapshot` 행으로, `toContain('uncommitted')` → `not.toContain` |
| R7 | `uncommitted` **픽스처 필드** 12파일: `gitSnapshotQuery`·`GitContextBar.actions:77`·`GitContextBar.render`·`diffComparison`·`diffPanel0211dv6.render`·`diffReviewNavigation`·`diffSyncState.render`·`diffTile.render:67`·`sessionChangesData`·`chatReducer.diffRequirementSelection`·`chatReducer.plan`·`gitRow.availability` | **픽스처 수정** | 필드만 삭제, 단언 불변(typecheck:test가 강제) |
| R8 | 비교 모드 문자열 단언 3건: `GitContextBar.actions:259`·`diffTile.render:173`·`gitSyncTriggersRemoved:64` | **보존** | 필드가 아니라 renderer 비교 모드 부재 단언이다 |
| R9 | `git-cli.test.ts:66·95·109·118` status 케이스 | **이동** | `gitSnapshot`/`buildStatus` 호출로 옮기고 단언 문장은 그대로 |
| R10 | `git-cli.test.ts:129` checkout 성공 | **단언 추가** | `result.status.branch === 'feature'` (AC15) |
| R11 | `handlers/git.test.ts:61·100·117·129·146` | **교체** | 채널 집합 `{branches, checkout, snapshot, diffPatch}`, 읽기 3종 폴백·전환 reject, snapshot 폴백 `{status: NOT_REPO, summary: null}` |
| R12 | `reject-reasons.test.ts:72-93` `gitAvailable`·`resolveRepoRoot` spy | **seam 교체** | PATH에 git 없는 resolver → `git-unavailable`, 비저장소 → `not-repo`. 사유 단언 동일 |
| R13 | `git-diff.test.ts` fake runner의 `--is-inside-work-tree` 응답 5곳, `infra/git` 테스트의 `runner` 인자 전달 11곳(`rg "runner\)" app/src/main/infra/git --glob '*.test.ts'`) | **seam 교체** | probe 6줄 응답 픽스처 + `createGitGateway({run})` 주입. 단언 불변 |
| R14 | `gitIdentityRemoteWiring.test.ts` | **보존** | D-026 래퍼로 `gitApi.status` 호출 형태가 같다 |
| R15 | `gitSnapshotQuery.test.ts:51·113` 늦은 응답 폐기 | **보존 + 단언 추가** | 결과에 status를 실어 status도 버려지는지 단언(AC16) |

검색: `rg -l "uncommitted|gitAvailable|gitStatus\(|gitDiffSummary\(|gitApi\.(status|diffSummary)|CHANNELS\.git(Status|DiffSummary)" app/src --glob '*.test.ts'` → 22파일. 그중 `features/artifacts/service.test.ts:563`·`sessions/session-runtime.test.ts:1841`은 단어 일치일 뿐 대상이 아니다. 위 표 밖의 테스트 파일이 구현 diff에 들어가면 AC24 위반이다.

### 21.8 성능 재산정 (§14 대체)

| 요청 | AS-IS | ΔV1 |
|---|---:|---:|
| 턴 종료, 세션 커밋 없음 (타일 닫힘) | 7 | 2 |
| 턴 종료, 세션 커밋 있음 | 7 | 4 |
| 타일 열림 추가분 (범위 패치) | +1 (좌표 캐시 적중) | +2 (base = head면 +1) |
| 커밋 선택 패치 | 2 (좌표 캐시 적중) | 3 |
| 초기 상태 | 4 | 2 |
| checkout clean (재조회 포함) | 9 | 5 |
| checkout dirty·해소 없음 | 4 | 2 |
| 새 세션 passthrough | 2 | 1 |
| worktree 준비(baseRef 없음) | 6 | 4 |
| 비저장소 디렉토리 턴 종료 | 2 | 2 |

- 패치 경로는 probe 때문에 AS-IS 대비 +1이다. 대가로 한 응답이 한 시점을 보장하고(D-023) 좌표 캐시의 소실 경로가 사라진다. 패치는 사용자가 타일을 열 때만 돈다.
- 메모리: 요청 사이 보관 값은 git 경로 문자열 하나다. V1의 80MB 상한은 없어진다.
- 동시 실행 worst-case는 V1과 같다(읽기 4 + 저장소별 직렬 쓰기).

### 21.9 기존 결정·규칙 추가 행 (§16)

| 기존 결정/규칙 | 출처 | ΔV1 문장 | 결과 |
|---|---|---|---|
| 좌표 캐시로 파일을 열 때마다 프로세스를 늘리지 않는다 (0211 EP-25 ②) | `git-diff.test.ts:580` | §21.7 R1 | 변경 — D-005(요청마다 probe)가 우선한다. 좌표를 한 호출로 얻는 부분은 유지 |
| 조회 계기의 배선은 effect 2개 (0211 AT-71) | `gitQueryReason.test.ts:108-124` | §21.7 R3 | 변경 — effect 1개. 계기 의미(초기·식별자·턴 종료·수동)는 유지 |
| 조회 소유자 열거 (0211 EP-13) | `gitQueryOwner.test.ts:1-13` | §21.7 R4 | 유지 — 축 이름만 갱신 |

### 21.10 ΔV1 READY self-review

> 아래 체크는 `2ce833e2` 설계 당시 기록이다. 재검토에서 발견한 G6~G8 때문에 현재 READY 판정의 근거로 쓰지 않으며, 다음 설계자가 §22.3을 확인한 뒤 다시 판정한다.

- [x] Ledger: D-006·D-007 SUPERSEDED → D-021·D-022(사용자 턴 6 원문 인용), D-023~D-026 ACTIVE — §3.
- [x] 조건절 재해석 없음 — G1·G3 선택지 원문을 §2에 인용.
- [x] 사용자 결정(G1·G3)과 조사로 닫을 사실(G2·G4·G5)을 구분했다 — §4 ΔV1 줄.
- [x] 수치 실측: 경합 `2/1`·`1/1`, 속성·replace 출력 차이, lint 7변이·현재 위반 5파일, 테스트 22파일 — §21.1·§21.7.
- [x] 변경 AC가 행동 단언·검증·도달 경로를 가진다 — §21.3. 활성 AC 25건.
- [x] Delta V: 기준 `f682cc2` 확인, NEW node(R-10·MD-07)에 REQUIRED pair(VP-20·VP-21), SUPERSEDED pair(VP-15·VP-19)의 증거 이관·폐기 근거 기재 — §21.4.
- [x] 방향: 캐시 재도입은 "반복 호출 동일 횟수"가, 관문 우회는 "정확 일치"가, OID 고정 해제는 6자리 변이가 각각 실패시킨다 — VP-01·VP-20.
- [x] 자리 단위 강제 지점: EP-11 6 + 예외 1, EP-09 2, EP-10 1(7변이) — §21.5.
- [x] 음성 게이트(`HEAD` 토큰 0건)는 경합 결과 단언(양성)과 짝지었다 — AC26.
- [x] 사람 실기 없음.
- [x] 게이트는 V1 §7-A 운영 gate와 같다. `node_modules` 설치 후 lint 실측을 이 턴에 수행했다.
- [x] 본문 교차검증: §1·§5·§7·§7-A·§9·§10·§11·§14·§16에 ΔV1 표식을 달아 대체 관계를 명시했다. `ACTIVE 결정 ↔ AC` 대조는 §3 갱신 메모.

## 22. [구현자 기입] ΔV1 재검토 및 설계자 인계 — r1, 2026-09-26

**DRAFT — G6~G8을 Claude(설계 보완)에게 인계한다.** 검토 대상은 `2ce833e2`의 V1 + ΔV1이며, 사용자 지시는 "요구내용을 정리하여 다시 plan 차례로 넘기고 push 하라"다. 앱 구현과 독립 verify는 수행하지 않았으므로 보드는 `plan/DRAFT`, 라운드는 1로 유지한다.

### 22.1 보완 요구와 닫힘 기준

| ID / 상태 | 출처 | 확인된 문제 | 설계자에게 넘기는 요구 |
|---|---|---|---|
| **G6 · P1 · PLAN_GAP · open** (G2 잔여) | D-023·D-024, AC7·AC8·AC26, VP-03·20·21, EP-11, §21.6 | EP-11은 패치까지 `rangeArgs(base, probe.head.oid)`로 고정한다. 현재 `diffRevArgs`는 `commit-parent`일 때 `[parentOid, commitOid]`를 쓰므로 이 규칙대로 바꾸면 선택 커밋 이후의 변경이 섞인다. | 누적 범위의 끝점은 probe OID, 선택 커밋의 끝점은 선택한 commit OID로 구분한다. 전문맥·축소 재시도가 각 경로의 동일 OID 쌍을 유지하도록 Decision·AC·pair·EP-11·인자 생성기를 함께 정정한다. 기존 선택 커밋의 HEAD 독립성·root·merge 동작을 회귀 oracle로 연결한다. |
| **G7 · P2 · PLAN_GAP · open** (G2 잔여) | AC8·AC26, VP-03·20, §21.6 경합 seam | seam 설명은 probe 인자를 보자마자 커밋한 뒤 원래 probe를 실행한다. 이 순서에서는 probe OID와 후속 `HEAD`가 같아, AC26이 요구한 probe 이후의 HEAD 변경을 검증하지 못한다. | 실제 probe 실행을 await해 결과를 확보한 뒤 커밋하고 그 결과를 돌려준다. `probe 완료 → HEAD 변경 → 후속 읽기`를 관측하고, AC8에는 전문맥·축소 시도 사이의 변경도 배치한다. 영향받은 자리의 OID를 `HEAD`로 바꾸는 등록 변이가 각각 실패하도록 oracle·seam을 맞춘다. |
| **G8 · P2 · PLAN_GAP · open** (G5 잔여) | AC15·AC17·AC24, VP-04·07·09, §11 checkout 소비자, §21.7 | AC24는 표 밖 테스트 수정을 금지하지만 `branchChipState.test.ts:65`가 빠졌다. 해당 케이스의 성공 입력에는 새 필수 `status`가 없고, 기대값 `{kind:'switched'}`도 AC17의 status 전달과 충돌한다. | 처분 표에 성공 fixture의 status 추가와 switched 결과의 status 전달 단언을 명시한다. checkout 결과의 생산자·소비자 테스트를 같은 계약으로 다시 검색하고, 기존 테스트 수정과 신규 oracle 추가의 허용 범위를 AC24에 구분한다. 대체 단언을 AC15·AC17 및 해당 pair에 연결한다. |

근거 코드: [git-diff.ts](../../../app/src/main/infra/git/git-diff.ts)의 `diffRevArgs`·`resolveCommitPatchRange`·`gitDiffPatch`, [git-diff-commit.test.ts](../../../app/src/main/infra/git/git-diff-commit.test.ts)의 "100줄과 20줄 커밋은 각각 100/20, 전체는 120이며 이후 HEAD/작업트리와 독립적이다", [branchChipState.test.ts](../../../app/src/renderer/src/features/chat/components/composer/branchChipState.test.ts)의 "성공이면 switched 다". G6은 `git-diff.ts:158`·`:344`, G8은 `branchChipState.test.ts:65`와 plan §10의 새 `GitCheckoutResult`·AC17을 대조했다.

### 22.2 재검토 증거와 유지하는 보완

| 대상 | 재현 / 대조 | 관측과 판정 |
|---|---|---|
| G1·G3 | D-021·D-022 ↔ §21.3 AC1·AC2·AC3·AC7·AC25 | **설계상 closed 유지**. 요청 사이 결과 캐시 제거와 origin 매 조회 방침을 유지한다. |
| G4 | `app/`에서 `ESLint.lintText`에 §21.6 블록을 `overrideConfig`로 적용, 실제 production 파일 경로 사용 | **closed 유지**. 외부 상대 import·`./runner`·re-export·동적 runner import·`child_process`·`node:child_process`·동적 built-in import 7종 모두 지정한 restricted 규칙의 error를 관측했다. |
| G6 기존 동작 | `cd app` 후 `node node_modules/vitest/vitest.mjs run src/main/infra/git/git-diff-commit.test.ts` | **1파일·3테스트 통과**. 선택 커밋의 HEAD 독립성, root/없는 커밋, merge 첫 부모 동작을 확인했다. |
| G7·G8 | AC26 ↔ §21.6 seam 순서, AC15·AC17 ↔ §21.7 및 `branchChipState.test.ts:65` | **문서·코드 대조로 모순 확인**. 미구현 gateway의 경합 테스트나 변경 후 typecheck를 실행한 것으로 보고하지 않는다. |

위 관측은 구현 전 리뷰의 증거이며 새 구현의 AC 충족이나 독립 verify PASS를 뜻하지 않는다. G1·G3·G4의 보완은 유지하고, G2는 G6·G7, G5는 G8이 닫힐 때까지 `open`이다.

### 22.3 설계 순서 / READY 재진입 조건

- [ ] **G6 먼저**: 요청 종류별 base·target OID를 정하고 D-023·D-024·AC7·AC8·AC26·VP-03·20·21·EP-11·§21.6을 같은 구분으로 정정한다. 선택 커밋과 누적 범위의 회귀 oracle을 구분한다.
- [ ] **G7 다음**: 확정한 범위 계약에 맞춰 경합 seam의 순서·관측 시점·등록 변이의 실패 조건을 정정한다. probe 자체의 `HEAD` 조회와 checkout dirty 검사 같은 허용 지점도 인자 차집합의 대상과 구분한다.
- [ ] **G8 다음**: checkout 성공 결과를 만드는 곳과 소비하는 곳의 테스트를 대조해 처분 표를 보완하고, 새 계약을 잠글 테스트 추가를 AC24가 막지 않게 정정한다.
- [ ] 위 변경을 기존 `V1 + ΔV1`에 대한 Delta V revision으로 기록한다. 필요한 규범 행의 대체 관계·pair·oracle·§10 자리와 Decision↔AC↔Technical Design을 다시 대조한다.
- [ ] G6~G8의 설계 모순이 해소되면 §20.3 G2·G5와 현재 판정 사본을 함께 갱신하고 READY self-review를 새로 수행한다. 그 설계 커밋에서만 plan과 INDEX를 `plan/READY`로 돌린다.

현재 다음 주체는 **Claude(설계 보완)**이며 라운드는 **1**이다. 이번 커밋은 요구 정리와 설계 단계 인계만 담고, 구현 산출과 verify 문서는 만들지 않는다.

### 22.4 [설계자 응답] ΔV2 처분 — 2026-09-26

| ID | 판정 | 닫은 곳 |
|---|---|---|
| G6 | **closed** — 누적 범위 `[B, H]`와 선택 커밋 범위 `[P, C]`를 타입으로 구분했다. 선택 커밋은 HEAD와 무관하다 | D-027·D-028, §23.2 AC7·AC8·AC26, §23.4 EP-11a·11b, §23.5 `DiffRange` |
| G7 | **closed** — seam은 실제 probe 완료를 기다린 뒤 커밋하고 그 결과를 돌려준다. AC8은 전문맥·축소 사이에 커밋을 넣는다. 등록 변이 9종이 각자 실패할 시나리오를 지정했다 | §23.2 AC8·AC26, §23.3 VP-20, §23.5 |
| G8 | **closed** — `branchChipState.test.ts:65` 외에 `git-cli.test.ts:135·169·201`, `BranchChip.defer.test.ts:12`, `queue-entry.test.ts:130`을 추가로 찾아 처분했다. AC24는 기존 케이스 수정과 신규 oracle 추가를 구분한다 | §23.2 AC24, §23.6 R16~R20 |

§22.3 재진입 조건 5개는 §23.7 self-review가 충족한다. 라운드는 1 그대로다.

## 23. ΔV2 — §22 G6~G8 보완 (2026-09-26)

**판정: READY.** ΔV1의 단일 끝점 규칙을 요청 종류별 끝점으로 나누고, 경합 oracle의 실행 순서와 checkout 성공 결과의 테스트 처분을 정정한다. 이 절이 §21·V1과 충돌하면 이 절이 정본이다.

### 23.1 이번 턴 실측

| 대상 | 검색/방법 | N / 관측 | 의미 |
|---|---|---|---|
| 선택 커밋 범위의 현재 끝점 | `git-diff.ts:158` `diffRevArgs` · `:344` `gitDiffPatch` 코드 읽기 | `commit-parent` → `[base.oid, base.commitOid]` | 선택 커밋은 이미 HEAD와 무관하다. ΔV1 EP-11이 이것을 H로 바꾸면 회귀다(G6) |
| 선택 커밋 회귀 oracle | `rg -n "it\(" git-diff-commit.test.ts` | 3건: `:49` HEAD·작업트리 독립 · `:71` root·없는 커밋 · `:80` merge 첫 부모 | ΔV2의 REGRESSION 증거로 그대로 쓴다 |
| checkout 성공 결과를 정확 비교하는 테스트 | `rg -n "ok: true" --glob '*.test.ts*' app/src` 중 `branch` 포함 | 5줄: `git-cli.test.ts:135·169·201`, `branchChipState.test.ts:65`, `BranchChip.defer.test.ts:12` | `status` 필드 추가로 `toEqual`이 깨지는 곳 4줄(:169는 해소 3종 반복) + 모의 반환 1줄 |
| checkout 결과 소비·생산 테스트 파일 | `rg -l "GitCheckoutResult\|checkoutOutcome\|gitApi.checkout\|gitCheckout\(" --glob '*.test.ts'` | 3파일: `branchChipState`·`queue-entry`·`git-cli` (+ 모의 경유 `BranchChip.defer`) | `queue-entry.test.ts:130`은 `result.ok`만 본다 → 보존 |
| checkout 결과 production 소비처 | 같은 검색(테스트 제외) | 8파일: `shared/{ipc,protocol}`·`preload`·`renderer/shared/api/ipc`·`BranchChip`·`branchChipState`·`handlers/git`·`git-cli` | 성공 `status`를 읽는 곳은 `branchChipState.checkoutOutcome` → `BranchChip` 하나다 |

### 23.2 AC ΔV2

| R | AT / AC | 상태 | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|---|
| R-03 | AT-08 / AC7 | CHANGED | 누적 범위 패치: probe·patch 2회, `B = H`면 probe 1회와 빈 목록. 선택 커밋 패치: probe·cat-file·patch 3회이고 인자는 `[P, C]`다. 선택 커밋 뒤에 커밋이 생겨도 선택 커밋 결과는 그대로다. 반복 호출도 같은 횟수다 | 기록 정확 일치 ×2 + `git-diff-commit.test.ts` 3케이스 무수정 통과(REGRESSION) | 타일 → `orca:git:diffPatch` |
| R-03 | AT-09 / AC8 | CHANGED | 전문맥 호출이 실패하면 축소 재시도는 **같은 끝점 쌍**으로 한다. 두 호출 사이에 HEAD가 움직여도 누적 범위는 `[B, H]`, 선택 커밋 범위는 `[P, C]` 결과를 준다 | 경합 seam(§23.5 ②): 전문맥 호출에서 커밋을 넣고 실패를 돌려준다 → 두 호출 인자가 `--unified=*`만 다름 + 결과가 H·C 기준. 두 범위 종류 각각 1케이스 | 같음 |
| R-04 | AT-16 / AC15 | CHANGED | clean 전환 성공은 `{ok:true, branch, status}`이고 `status`는 전환 후 probe로 만든 값(`branch` = 새 브랜치, `isRepo:true`)이다. 해소 3종 뒤 성공도 같은 형태다. 실행 5회(probe·shortstat·checkout·probe·remote), dirty·해소 없음 2회 | §23.6 R16의 확장 단언 + 기록 정확 일치 | 칩 → `orca:git:checkout` |
| R-09 | AT-25 / AC24 | CHANGED | ① 기존 테스트 **케이스의 수정·삭제**는 §21.7 + §23.6 처분 표 행에 한한다. ② 계약을 잠그는 **새 케이스·새 테스트 파일 추가**는 허용하고 처분 표 대상이 아니다. ③ 기존 단언의 기대를 완화(정확 일치 → 부분 일치 등)하려면 표에 대체 단언이 있어야 한다 | 구현 diff에서 수정·삭제된 기존 케이스 집합 ⊆ 처분 표 행 + 스위트 green | 전 경로 |
| R-10 | AT-26 / AC26 | CHANGED | 누적 범위의 읽기 명령은 probe OID로 고정된다. seam이 **probe 실행 완료 후** 커밋을 넣어도 (a) 요약(history 정상) (b) 요약(history 폴백 강제) (c) 레거시 bornAt (d) 누적 패치 전문맥의 결과가 probe 시점과 같다. (e) 선택 커밋 패치는 같은 경합에서 `[P, C]` 결과가 바뀌지 않는다 | 시나리오 5종 결과 단언 + **차집합**: 모집단 = snapshot 요약·diffPatch 경로의 읽기 호출 중 probe 호출(`rev-parse --is-inside-work-tree …`, 폴백 좌표 `rev-parse`, `symbolic-ref -q HEAD`)과 `remote get-url`을 뺀 것. 그 안에서 `HEAD` 토큰·`..HEAD` 접미·`HEAD` 접두 인자 0건 | snapshot·diffPatch 경로 |

변경 없는 AC는 ΔV1 §21.3·V1 §7이 유효하다. AC17은 문장 그대로이며 증거가 §23.6 R17로 연결된다. 활성 AC는 25건 그대로다.

### 23.3 V ΔV2

- V mode: Delta V. 기준 `0241:ΔV1@2ce833e`(공유 브랜치에서 `git cat-file -t` → commit 확인).
- 변경 시작 수준: R(R-03·R-10의 결과 정의가 바뀐다).
- SUPERSEDED pair: 없음. ΔV1 VP-20의 변이 6종은 아래 VP-20의 9종으로 옮긴다(6종 전부 포함).

| Node | provenance | 기준선 / 변경 |
|---|---|---|
| R-03 | CHANGED | ΔV1 §21.3 AC7·AC8 → §23.2 |
| R-04 | CHANGED | AC15 증거 확장 |
| R-07 | CHANGED | AC17 증거 R17 연결 |
| R-09 | CHANGED | AC24 허용 범위 구분 |
| R-10 | CHANGED | AC26 시나리오 5종·모집단 정의 |
| MD-07 | CHANGED | `rangeArgs(range: DiffRange)` 판별 유니온 |
| 그 외 | INHERITED | ΔV1 §21.4 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|---|---|
| VP-03 | R-03 ↔ AT-08·09 | REQUIRED (CHANGED) | 타일 → diffPatch → probe → (선택 커밋이면 cat-file) → `rangeArgs` → patch 전문맥 → 축소 | AC7·AC8 두 범위 종류 | required — 축소 재시도가 `rangeArgs`를 다시 계산하며 `HEAD`를 쓰는 변이 → AC8 누적 케이스 실패 | EP-11a(패치 2) · EP-11b(3) |
| VP-03R | R-03 ↔ 선택 커밋 회귀 | **REGRESSION** | 같음, `commitSha` 경로 | `git-diff-commit.test.ts:49·71·80` 무수정 통과 | not selected — 기존 3케이스가 직접 oracle | EP-11b(3) |
| VP-04 | R-04 ↔ AT-14~16 | REQUIRED (CHANGED) | 칩 → checkout → mutate → probe → remote | AC15 + R16 확장 단언(해소 3종 포함) | not selected | EP-05(8)·EP-07(1)·EP-09(1) |
| VP-07 | R-07 ↔ AT-17~20 | REQUIRED (CHANGED) | `gitApi.checkout` 결과 → `checkoutOutcome` → `BranchChip.setSnapshot` | AC17 배선 + R17 순수 단언(`switched`가 status를 싣는다) | required — `checkoutOutcome`이 `status`를 버리는 변이 → R17 실패 | EP-07(1)·EP-08(3) |
| VP-09 | R-09 ↔ AT-23·25 | REQUIRED (CHANGED) | lint · 전 스위트 | AC22 7변이 + AC24 ①~③ 대조 | required — AC22 7변이 | EP-10 |
| VP-20 | R-10 ↔ AT-26 | REQUIRED (CHANGED) | snapshot·diffPatch → probe(완료) → [seam 커밋] → 범위 명령 | AC26 (a)~(e) + 차집합 | required — 자리마다 끝점을 `HEAD`로 바꾸는 변이 9종: ① 요약 diff → (a) ② history 정상 → (a) ③ history 폴백 → (b) ④ bornAt rev-list → (c) ⑤ 누적 패치 전문맥 → (d) ⑥ 누적 패치 축소 → AC8 누적 ⑦ 선택 커밋 cat-file(`C` → `HEAD`) → (e) ⑧ 선택 커밋 패치 전문맥(`C` → `HEAD`) → (e)·VP-03R `:49` ⑨ 선택 커밋 패치 축소 → AC8 선택 커밋 | EP-11a(6)·EP-11b(3) |
| VP-21 | MD-07 ↔ UT-07 | REQUIRED (CHANGED) | `rangeArgs` | 표: 누적 `B = H` → `null` · 누적 `B ≠ H` → `{diff:[B,H], log:'B..H'}` · 선택 커밋 → `{diff:[P,C], log:null}`(P = C여도 `null` 아님) | not selected | 0 — 순수 |

### 23.4 §10 ΔV2

| V node / pair | 계약 | SSOT | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|
| EP-11 (ΔV1) | **SUPERSEDED** → EP-11a·EP-11b | — | — | — |
| **EP-11a** VP-01·03·20 | 누적 범위 명령의 끝점은 probe `H`다 | `rangeArgs({kind:'cumulative', base, head: probe.head.oid})` | 6자리: 요약 diff · history 정상 · history 폴백 · bornAt `rev-list -1 --before=T H` · 누적 패치 전문맥 · 누적 패치 축소 | 한 응답이 두 시점을 섞는다 |
| **EP-11b** VP-03·03R·20 | 선택 커밋 명령의 끝점은 요청 `C`와 그 첫 부모 `P`다. `H`를 쓰지 않는다 | `rangeArgs({kind:'commit', parent, commit})` + `cat-file commit C` | 3자리: cat-file · 선택 커밋 패치 전문맥 · 선택 커밋 패치 축소 | 선택 커밋 본문에 이후 변경이 섞인다 |
| 예외 (ΔV1 유지) | 문자열 `HEAD` 허용 | — | probe 호출 2종(주 호출·폴백 `symbolic-ref`) · checkout dirty `diff HEAD --shortstat` · 쓰기 명령 | AC26 차집합 모집단에서 제외된 자리 |

### 23.5 Technical ΔV2

```ts
// infra/git/git-diff.ts — ΔV1 rangeArgs(base, head)를 대체한다
type DiffRange =
  | { kind: 'cumulative'; base: string; head: string }   // head = probe.head.oid
  | { kind: 'commit'; parent: string; commit: string }    // parent = 첫 부모 | EMPTY_TREE_OID
export function rangeArgs(range: DiffRange): { diff: [string, string]; log: string | null } | null
// cumulative: base === head → null (D-028), 아니면 { diff: [base, head], log: `${base}..${head}` }
// commit:     { diff: [parent, commit], log: null }
```

- `gitDiffPatch`는 `rangeArgs` 결과 `diff`를 한 번 계산해 전문맥·축소 두 호출에 **같은 배열**로 넘긴다. 축소 경로에서 다시 계산하지 않는다(VP-03 변이 자리).
- `GitDiffBase`(IPC 계약)는 바뀌지 않는다. `DiffRange`는 main 내부 타입이고 `resolveDiffRange` 결과 + probe에서 만든다.

**경합 seam (G7 정정)**

| # | 용도 | 순서 | 관측 |
|---|---|---|---|
| ① | AC26 (a)~(e) | `run` 래퍼: 호출이 probe면 **실제 probe를 await해 결과를 받은 뒤** 실저장소에 커밋 1개를 만들고, 그 probe 결과를 돌려준다. 1회만 동작한다 | 커밋 후 실제 `git rev-parse HEAD` ≠ probe `H`를 테스트가 먼저 단언한다(경합이 실제로 일어났다는 확인). (b)는 `log --raw` 호출에 실패를 돌려 폴백을 강제한다. (c)는 `baseOid` 없이 `bornAt`만 준 레거시 세션이다 |
| ② | AC8 | `run` 래퍼: 호출 인자에 `--unified=1000000`이 있으면 커밋 1개를 만든 뒤 `{ok:false}`를 돌려준다 | 두 패치 호출 인자 비교 + 결과가 H·C 기준. 누적·선택 커밋 각 1케이스 |

- seam은 `createGitGateway({ run })`의 `run` 주입으로 만든다. production 코드에 테스트 전용 훅을 두지 않는다.

### 23.6 기존 테스트 처분 추가 (§21.7에 이어짐)

| # | 대상 | 처분 | 대체 oracle / 근거 |
|---|---|---|---|
| R10 | (§21.7) `git-cli.test.ts:129` 단언 추가 | **SUPERSEDED → R16** | 같은 케이스(`:135`)를 R16이 포함한다 |
| R16 | `git-cli.test.ts:135`(clean 성공) · `:169`(해소 3종 반복) · `:201`(정상 이름) `toEqual({ ok: true, branch: 'feature' })` | **단언 확장** | `toEqual({ ok: true, branch: 'feature', status: { isRepo: true, branch: 'feature', detached: false, root: <repo 실경로>, githubUrl: null } })` — 정확 일치를 유지하고 완화하지 않는다(AC24 ③) |
| R17 | `branchChipState.test.ts:65` "성공이면 switched 다" | **입력·기대 확장** | 입력에 `status` 추가, 기대 `{ kind: 'switched', status }` (AC17). 실패·dirty 케이스는 보존 |
| R18 | `BranchChip.defer.test.ts:12` 모의 `checkout` 반환 | **픽스처 수정** | 반환에 `status` 추가. `:61`·`:73` 단언(호출 여부)은 불변 |
| R19 | `queue-entry.test.ts:130` "gitCheckout" | **보존** | `result.ok`·브랜치만 단언하고, 큐 점유 중 checkout이 기다리는지 본다. `gateway.mutate`가 같은 `withRepoMutation` 키를 쓰는지의 회귀 증거다 |
| R20 | `git-diff-commit.test.ts:49·71·80` | **보존** | VP-03R 회귀 증거. 수정되면 AC24 ① 위반 |
| R21 | `runner.test.ts` "passes git arguments without a shell and preserves the Git environment contract" | **실행 파일 기대·seam 교체** | resolver가 돌려준 절대 경로를 `execFileImpl`의 첫 인자로 단언한다(AC11·AC12, D-008). 기존 인자·env·shell 부재 단언은 보존한다. |
| R22 | `prepare-worktree.test.ts:33·65` 신규 비격리·resume 케이스 및 공통 mock | **seam 교체** | `resolveHead`·`resolveHeadRef` mock을 probe 하나로 바꾼다(AC20). baseline·ref·실패 시 null 결과는 보존하고, 신규 세션은 cwd별 probe 1회·resume은 0회를 단언한다. |
| R23 | `reject-reasons.test.ts:95` "저장소 밖 하위 경로는 invalid-path 다" | **seam 교체** | root를 반환하는 `resolveRepoRoot` spy를 같은 root의 probe 응답으로 바꾼다. 기존 `invalid-path` 사유 단언을 보존한다(AC20). |
| R24 | `git-diff.test.ts` "커밋이 하나도 없는 저장소는 base 가 none 이다" | **내부 타입 기대 갱신** | ΔV2의 판별 유니온으로 `{kind:'cumulative', base:{kind:'none'}, headOid:null}`을 정확 비교한다. 커밋이 없는 저장소의 범위 없음 동작은 그대로다(VP-21·AC6). |
| R25 | `features/worktrees/ipc-integration.test.ts:138` 실행기 호출 술어의 양성 검사 | **양성 표본 위치 갱신** | `git-cli.ts`의 직접 `runGit` 호출이 `gateway.ts`로 이동한다(D-009). CALL_AXIS·feature 전수 음성 단언은 유지하고 실제 호출 양성 표본을 `gateway.ts`로 바꾼다(VP-12). |

### 23.7 ΔV2 READY self-review

- [x] Ledger: D-023·D-024 SUPERSEDED → D-027·D-028. 사용자 결정 D-021·D-022 유지 — §3.
- [x] 사용자 결정이 필요한 새 항목 없음 — G6~G8은 기존 계약(`git-diff-commit.test.ts:49`)과 코드로 닫히는 사실이다.
- [x] 실측: 선택 커밋 끝점 코드, 회귀 3케이스, checkout 성공 정확 비교 5줄·소비 테스트 3파일·production 소비처 8파일 — §23.1.
- [x] 변경 AC(AC7·AC8·AC15·AC24·AC26)가 행동 단언·검증·경로를 가진다. AC26은 경합 발생 자체를 먼저 단언한다 — §23.2·§23.5 ①.
- [x] Delta V: 기준 `2ce833e` 확인, CHANGED node마다 REQUIRED pair, 영향받은 선택 커밋 동작은 VP-03R REGRESSION — §23.3.
- [x] 자리 단위: EP-11a 6 + EP-11b 3 = 9자리, 변이 9종이 자리마다 실패 시나리오를 가진다 — VP-20.
- [x] 방향: 음성 차집합(AC26)은 시나리오 결과 단언(양성)과 짝지었고, 모집단에서 뺀 허용 자리를 §23.4 예외 행에 열거했다.
- [x] 형제 자리 맞바꿈: 누적↔선택 커밋 끝점을 맞바꾸는 회귀는 (d)·(e)가 각각 실패시킨다.
- [x] 범위별 동작: `DiffRange`로 입력 종류를 구분하고, 선택 커밋의 `log: null` 반환은 분기 로직과 VP-21 테스트로 보장한다. 반환 타입 `log: string | null` 자체가 이 관계를 강제하지는 않는다.
- [x] 사람 실기 없음. 게이트는 V1 §7-A와 같다.
- [x] 교차검증: §20.3 G2·G5, §22.4, 메타, INDEX 비고를 같은 판정(READY)으로 갱신했다. `ACTIVE 결정 ↔ AC` 대조는 §3 갱신 메모.

### 23.8 구현 착수 지시 — 2026-09-26

사용자 지시 "커밋&push 후 handoff-impl 시작"에 따라 비차단 self-review 문구를 정정하고 Codex가 구현을 맡는다. 유효 V는 `V1 + ΔV1 + ΔV2`이며, 규범 계약과 라운드 1은 유지한다.

착수 전 테스트 seam 대조에서 AC11의 절대 경로와 `runner.test.ts`의 bare `git` 기대, AC20의 probe 통합과 기존 준비 경로 mock 사이의 변경 대상을 추가로 확인했다. 기능 계약을 바꾸지 않고 처분 표 R21~R23만 보완하며, 이 정정은 구현과 별도 설계 커밋으로 기록한다.

backend 회귀 실행에서 ΔV2 내부 범위 타입의 정확 비교와 실행기 호출 술어의 양성 표본을 추가로 확인했다. R24~R25는 기존 동작·검사 강도를 유지하는 대상 갱신이며 별도 설계 커밋으로 기록한다.
