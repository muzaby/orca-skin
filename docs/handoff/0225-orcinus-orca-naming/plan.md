# Plan — 0225-orcinus-orca-naming

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0225-orcinus-orca-naming` |
| 작성자 | Claude Code |
| 일자 | 2026-09-09 |
| 매핑 | PR 미생성 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 제품 식별자·경로 축을 다룬 기존 handoff의 V가 없다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 다른 **Orca** 제품과 함께 설치하면 아이콘이 바뀐다. 원인은 미확정이고 레지스트리 충돌이 의심된다.
- **실측한 충돌 표면**: `appId: com.orca.app`가 바로가기 AppUserModelID와 제거 레지스트리 키 GUID 두 곳에 쓰인다(§8).
- **완료 후 달라지는 것**: 제품명·실행 파일·설치 경로·데이터·설정·워크트리·업데이트 캐시·내부 저장 파일명이 전부 `orcinus-orca` 축으로 분리되고, 기존 설치본의 데이터는 새 자리로 이관된다.
- **성공을 사용자 관점 한 문장으로**: 다른 Orca 제품과 겹치는 이름·경로·레지스트리 항목이 하나도 남지 않고, 기존 대화·설정·워크트리는 그대로 열린다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "화면 표시에는 `Orcinus orca`, 파일·디렉터리 이름에는 `orcinus-orca`를 사용한다." | 요구사항 §2 |
| 명시 요구 | "설정 루트 아래의 **`worktrees`, `worktrees-dev`, `sources`, `dist`, `projects`, `downloads`도 모두 새 루트를 사용**한다. 쿠키·브라우저 캐시 등 세션 저장 공간도 분리한다." | 요구사항 §2 |
| 명시 요구 | "DB의 WAL·SHM·백업 파일과 제품명 기반의 다른 내부 저장 파일도 새 이름에 맞춘다. **내부 파일명 역시 변경 대상이며, 더 이상 미확정 사항이 아니다.**" | 요구사항 §2 |
| 명시 요구 | "기존 데이터를 보존할 경우에는 **새 경로·새 파일명으로 이관**하고, 전환 후 옛 경로를 정상 저장소나 자동 fallback으로 사용하지 않는다. 기존 워크트리의 Git 연결 정보와 저장된 절대 경로도 이관 검토에 포함한다." | 요구사항 §3 |
| 명시 요구 | "GitHub 저장소명 `orca-skin`은 유지하며, 과거 기록이나 코드 식별자까지 무차별적으로 치환하는 작업은 아니다." | 요구사항 §3 |
| 명시 요구 | "**Windows `appId` 변경 여부와 기존 설치본의 업데이트·이관 방식은 별도 검토가 필요하다.**" → 이 세션에서 3건 확정 | 요구사항 §3 + 라이브 질의 |
| 추론 의도 | `~/.config/orca/logs`·`artifacts`는 요구가 열거하지 않았지만 같은 설정 루트 하위다 — 루트가 바뀌면 함께 간다. 추론임을 표시한다. | `log/index.ts:47` · `bootstrap.ts:806` |
| 추론 의도 | 화면의 하드코딩 `'Orca'` 8곳을 표시명 SSOT 하나로 모은다. 요구는 "화면 표시"만 말했고 SSOT화는 설계자 판단이다. | §8 전수 조사 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 화면 표시 = `Orcinus orca`, 파일·디렉터리 = `orcinus-orca` | 사용자 원문. 두 표기를 섞지 않는다 | 요구사항 §2 | ACTIVE | — |
| D-002 | 실행 파일 `orcinus-orca.exe` · 패키지명 `orcinus-orca` · 설치 프로그램 `orcinus-orca-<version>-setup.exe` | 요구 표 | 요구사항 §2 | ACTIVE | — |
| D-003 | 운영 데이터 `%APPDATA%\orcinus-orca\` · 개발 데이터 `%APPDATA%\orcinus-orca-dev\` | 요구 표 | 요구사항 §2 | ACTIVE | — |
| D-004 | 설정·작업 루트 `~/.config/orcinus-orca/` (모든 OS 동일) | 요구 표 + 기존 규약 유지(`paths.ts:27`) | 요구사항 §2 | ACTIVE | — |
| D-005 | 업데이트 캐시 `%LOCALAPPDATA%\orcinus-orca-updater\` | 요구 표 | 요구사항 §2 | ACTIVE | — |
| D-006 | 앱 전역 설정 파일 `orcinus-orca.json` · DB `orcinus-orca.db` | 요구 표 | 요구사항 §2 | ACTIVE | — |
| D-007 | 설정 루트 하위 `worktrees`·`worktrees-dev`·`sources`·`dist`·`projects`·`downloads`가 모두 새 루트를 쓴다 | 사용자 원문 열거 | 요구사항 §2 | ACTIVE | — |
| D-008 | DB의 WAL·SHM·백업과 제품명 기반 내부 저장 파일도 새 이름으로 바꾼다 — **미확정 아님** | 사용자 원문 | 요구사항 §2 | ACTIVE | — |
| D-009 | 쿠키·브라우저 캐시 등 세션 저장 공간도 분리한다 | 사용자 원문 | 요구사항 §2 | ACTIVE | — |
| D-010 | 기존 데이터는 새 경로·새 파일명으로 이관하고, **전환 후 옛 경로를 정상 저장소나 자동 fallback으로 쓰지 않는다** | 사용자 원문 조건절 그대로. 이관 실패 시 옛 경로로 되돌아가 읽는 폴백을 만들지 않는다 | 요구사항 §3 | ACTIVE | — |
| D-011 | GitHub 저장소명 `orca-skin` 유지 | 사용자 원문 | 요구사항 §3 | ACTIVE | — |
| D-012 | 과거 기록·코드 식별자는 무차별 치환하지 않는다 | 사용자 원문. `orca:` IPC 채널 89개·`sourceKind:'orca'`·`ORCA_*` 프롬프트 sentinel·ADR 본문이 여기 해당 | 요구사항 §3 | ACTIVE | — |
| D-013 | `appId`를 **변경**한다. 기존 설치본은 side-by-side가 되므로 릴리스 노트·운영 가이드에 **구버전 수동 제거**를 안내한다 | 라이브 질의 답변("변경 + 구버전 수동 제거 안내"). NSIS 커스텀 스크립트로 자동 제거하지 않는다 | 라이브 세션 | ACTIVE | — |
| D-014 | 기존 데이터를 **전체 이관**하고 워크트리는 `git worktree repair`까지 수행한다 | 라이브 질의 답변("전체 이관 + worktree repair"). repair는 앱이 다음 `worktree add`를 하기 전에 끝나야 한다 | 라이브 세션 | ACTIVE | — |
| D-015 | Claude Code 플러그인 이름 `orca`를 **함께 변경**한다 — 디렉토리와 스킬 네임스페이스 둘 다 | 라이브 질의 답변("함께 변경") | 라이브 세션 | ACTIVE | — |
| D-016 | `package.json`에 `productName` 키를 두지 않는다 | `app.getName()`이 `productName ?? name`이라, 키가 생기면 userData가 `Orcinus orca`(공백 포함)로 옮겨간다. 표시명은 `electron-builder.yml`만 갖는다 | 설계자 판단(§8 실측 근거) | ACTIVE | — |
| D-017 | 이관은 **멱등**하게 짜고 별도 완료 마커를 두지 않는다 | 마커를 마지막에 쓰면 마커 직전 크래시가 부분 상태를 영구화한다. 단계마다 `source 있고 target 없으면 이동`이면 재실행이 곧 복구다 | 설계자 판단(§13) | ACTIVE | — |
| D-018 | DB 파일 3종(`.db`·`-wal`·`-shm`) 이동 실패는 **부팅을 막는다** | WAL만 남고 DB가 옮겨진 상태로 DB를 열면 WAL 꼬리가 조용히 유실된다. 나머지 이동 실패는 부팅을 막지 않는다 | 설계자 판단(§13) | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-018 전부(신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 없음(신규).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 대조한 쌍 —
  - D-010("옛 경로를 자동 fallback으로 쓰지 않는다") ↔ AT-09("옛 루트를 읽는 코드 경로가 0건") → 같은 방향, 충돌 없음.
  - D-012("코드 식별자 무차별 치환 금지") ↔ AT-11(`orca:` 채널 89개 불변) → 같은 방향.
  - D-015("플러그인 이름 함께 변경") ↔ D-012 → 충돌 아님. `ORCA_PLUGIN_NAME`의 **값**이 디스크 디렉토리명이라 §2 "제품명 기반 내부 저장 이름"에 해당하고, 사용자가 이 항목을 명시 선택했다.
  - D-016("productName 키 금지") ↔ AT-02(`%APPDATA%\orcinus-orca`) → AT-02가 D-016 없이는 성립하지 않는다. AT-13이 D-016을 직접 잠근다.
  - D-013("side-by-side 허용") ↔ AT-12(구버전 수동 제거 안내가 문서에 있다) → 같은 방향.

### r1 착수 전 설계 정정 (규범 행)

구현 착수 전 실측에서 §10 분모 2건과 술어 1건이 틀린 것을 확인해 규범 행을 정정했다. ACTIVE Decision은 하나도 바뀌지 않았다 — D-001·D-014가 이미 요구하던 지점을 분모가 덜 세고 있었다.

| # | 정정한 행 | 정정 전 | 정정 후 | 관측 |
|---|---|---|---|---|
| C1 | §10 EP-04 분모 · AT-08 술어 | 9지점 · `rg "'Orca'"` 0건 | 31지점(renderer 27 · main 4) · `\bOrca\b` 0건 | 옛 술어는 작은따옴표 리터럴만 봐서 31지점 중 `useCompletionNotifier.ts:25` 1곳만 분모에 올랐다. 주어(홀로 선 제품명 단어)로 다시 세어 `grep -rnE "\bOrca\b" src/renderer … \| grep -v '\.test\.'` = 31행, main 사용자 대면 4행 |
| C2 | §8 DB 절대경로 컬럼 수 · EP-08 | 4컬럼 | 5컬럼(`repo_root` 추가) | `grep -rnE "cwd\|_root\|_path" migrations/*.sql` = 5행. `repo_root`는 `rev-parse --show-toplevel` 결과라 세션 cwd가 설정 루트 하위 저장소면 옛 접두를 갖는다. C3의 repo 측 repair가 이 값을 cwd로 쓰므로 rebase가 **선행 조건**이다 |
| C4 | §10 EP-04 분모 (구현 중 재측정) | 31지점(renderer 27 · main 4) | **34지점**(renderer 27 · main 7) | main 을 `Orca`(표시명)와 `orca`(슬러그·파일명) **두 표기 모두**로 다시 훑고 주석·모델 대면 프롬프트를 걷어내자 사용자 대면이 4가 아니라 7이었다 — 부팅 단계 라벨 2개(`'Orca 설정 디렉터리 보장'`·`'orca.json 로드'`, 둘 다 부팅 진단 화면에 그대로 뜬다)와 `harness-plugins/claude.ts` 의 플러그인 manifest description(`'orca에서 구성된 skill 및 mcp'`, 하네스가 읽는 산출물)이 빠져 있었다. 모델 대면 프롬프트(`system-header.ts`·`artifacts/tool.ts`·`confluence/tools.ts`)와 일회성 temp 이름(`.orca-artifact-*.tmp`·`.orca-export-check`)·git stash 메시지는 화면 표시가 아니라 분모 밖이며 §6 으로 보고한다 |
| C3 | EP-08 repair 방향 | 워크트리 측 `git worktree repair` | repo 측 `git worktree repair <worktree>` | 임시 저장소 실측 — 워크트리만 이동하면 두 방향 다 성공하지만, **repo도 함께 이동하면 워크트리 측 호출이 `fatal: not a git repository`로 실패**한다. repo 측 호출은 같은 케이스에서 `repair: gitdir incorrect` + `repair: .git file broken` 둘 다 고쳐 `prune -n` 무출력·워크트리 `git status` exit 0 |

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **부분 타당 — 전제 보강** | `appId`가 바로가기 AUMID(`WinShell::SetLnkAUMI "${APP_ID}"`, `templates/nsis/include/installer.nsh:180·189·205·212·220`)와 제거 키 GUID(`UUID.v5(appInfo.id, …)`, `NsisTarget.js:157`)로 쓰인다. 상대 제품의 `appId`를 확인할 수 없어 **아이콘 증상 해소를 AC로 삼지 않는다** — 관측 가능한 "분리 자체"만 AC로 둔다 |
| 이미 기존 코드가 충족하는가 | 아니오 | 파일시스템 이름을 만드는 리터럴 14개가 전부 `orca` 축이다(§8 전수) |
| 더 작은 해법이 있는가 | 있으나 요구를 닫지 못한다 | `appId`만 바꾸면 아이콘 가설은 닫히지만 D-003·D-004·D-006~D-009가 남는다. 사용자 요구가 명시적으로 더 넓다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `release-operations.md:60·80·82`의 `%APPDATA%/orca`·`orca.db.backup.*` 서술이 `db/index.ts:15`·`migrate.ts:137`과 일치. 문서가 낡지 않았다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 변경, 2건 유지 | 0103의 "`setName` 대신 `setPath`로 데이터 경로만 이동, 앱 이름/AppUserModelId 불변"을 이번에 **뒤집는다**(§16). 0210 D-102(worktree 루트는 config root 하위)·D-103(dev는 `worktrees-dev`만 가른다)은 **유지** |

- **사용자에게 올릴 결정**: 없음 — 3건(appId·이관 범위·플러그인 이름)은 이 세션에서 답을 받아 D-013·D-014·D-015로 확정했다.
- **코드 조사로 닫은 사실**: 업데이트 캐시 이름의 출처(`app-builder-lib` `appInfo.updaterCacheDirName`), 설치 디렉토리 이름의 출처(`getWindowsInstallationDirName`), `${name}` 매크로의 해석, worktree 이동의 실제 파손 양상(§8 재현).

## 5. 동작 / 사용자 흐름

```text
[신규 설치]  orcinus-orca-<ver>-setup.exe 실행
  → %LOCALAPPDATA%\Programs\orcinus-orca 에 설치, 바로가기 이름 "Orcinus orca"
  → 첫 실행: %APPDATA%\orcinus-orca\ · ~/.config/orcinus-orca/ 생성
  → 화면 상단·사이드바·로그인·알림이 "Orcinus orca"

[기존 설치본 사용자]  구버전 orca 설치본이 있는 PC에서 신버전 최초 실행
  → 부팅 최초 단계: %APPDATA%\orca → %APPDATA%\orcinus-orca 이동
  → ~/.config/orca → ~/.config/orcinus-orca 이동
  → 내부 파일명 일괄 개명 (DB 3종 · electron-store 4종 · 백업 · 마커 2종 · 플러그인 디렉토리)
  → DB 열기 후: 절대경로 4컬럼 접두 치환 → 옮겨진 워크트리마다 git worktree repair
  → 기존 대화·설정·스킬·워크트리가 그대로 열린다
  ↘ DB 3종 이동 실패: 부팅 중단 + 오류 화면 (WAL 유실 방지, D-018)
  ↘ 그 외 단계 실패: 경고 로그 + 부팅 계속, 다음 부팅에 재시도 (멱등, D-017)

[구버전 설치본]  제어판에 "orca" 항목이 그대로 남는다 (D-013)
  → 릴리스 노트·운영 가이드가 수동 제거를 안내한다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 옛 루트 있음 · 새 루트 없음 | `renameSync`로 루트 이동 후 내부 개명 | 기존 데이터가 새 이름 아래 그대로 |
| 옛 루트 없음 · 새 루트 있음 | 전 단계 no-op | 정상 부팅 (두 번째 부팅부터의 상태) |
| 옛 루트 있음 · 새 루트도 있음 | 루트 이동을 **하지 않고** 경고 로그. 새 루트를 쓴다 | 새 루트 데이터로 동작. 옛 루트는 손대지 않는다 |
| 루트 이동 후 DB 파일 개명 중 크래시 | 다음 부팅이 파일별 가드로 이어서 개명 | 사용자는 재실행 한 번으로 정상 진입 |
| DB 3종 개명이 예외로 실패 | 부팅 중단 + `BootFailureFrame` | "데이터 이관에 실패했습니다" 화면 (D-018) |
| 워크트리 경로 치환됨 | 해당 워크트리에서 `git worktree repair` 실행 | 세션 재개 시 워크트리가 정상 동작 |
| `git worktree repair` 실패 | 경고 로그 + 부팅 계속 | 해당 세션 재개 시 기존 0210 폴백(원본 작업 경로)이 동작 |

### 파생 UX / 엣지케이스

- **loading**: 이관은 `initLog()` 이전 동기 구간이라 화면이 뜨기 전에 끝난다. 진행률 UI를 만들지 않는다.
- **error**: DB 3종 실패만 부팅 차단. 나머지는 부팅 후 로그로만 남는다.
- **restart**: 모든 단계가 멱등이라 재시작이 곧 재시도다(D-017).
- **concurrency**: 단일 인스턴스 락(`index.ts`)이 이관 구간의 동시 실행을 막는다. 단, **구버전 앱이 동시에 떠 있으면** 옛 루트를 잡고 있어 Windows에서 rename이 실패한다 → 경고 로그 후 다음 부팅 재시도.
- **dev**: dev는 `%APPDATA%\orca-dev` → `%APPDATA%\orcinus-orca-dev`, `worktrees-dev`만 별도. 설정 루트는 dev·prod 공용이라 한 번만 이동한다.
- **폐쇄망**: `git worktree repair`는 로컬 명령이라 egress와 무관.

## 6. 범위 / 비범위

- **범위**: 빌드 설정(`package.json`·`electron-builder.yml`) · 런타임 경로 SSOT · DB/설정/시크릿/자격증명 파일명 · 플러그인 디렉토리와 스킬 네임스페이스 · AppUserModelID · 화면 표시명 · 1회 이관(파일시스템 + DB 절대경로 + worktree repair) · 관련 테스트 · 운영 문서 · CI 산출물 이름.
- **비범위**: `orca:` IPC 채널 89개 · `sourceKind: 'orca'` DTO enum · `ORCA_ATTACHMENT_*`·`ORCA_DIFF_*`·`ORCA_PLAN_*` 프롬프트 sentinel · `orca.artifact.published` 버스 이벤트 · `orca_artifacts` 도구 descriptor id · `node_modules/.cache/orca` 빌드 캐시 · GitHub 저장소명 · `docs/decisions/`·`docs/archive/`·`docs/handoff/0*`·`chats/`의 과거 기록 · 아이콘 증상 자체의 재현·근본원인 확정 · NSIS 커스텀 언인스톨 스크립트.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 아이콘 증상 재현 (상대 Orca 제품 필요) | 아니오 — 이번 분리가 표면을 없애므로 재현 없이도 진행 가능 | 사용자 실기로 확인 |
| `orca:` 채널 접두 | 아니오 — 프로세스 내부 계약, 충돌 표면 아님 | D-012로 영구 비범위 |
| 구버전 자동 제거(NSIS 커스텀) | 아니오 — 수동 안내로 대체(D-013) | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 빌드 산출물이 새 이름을 갖는다 | 순수 테스트가 `package.json`·`electron-builder.yml`을 읽어 `name==='orcinus-orca'` · `productName==='Orcinus orca'` · `win.executableName==='orcinus-orca'` · `nsis.artifactName==='${name}-${version}-setup.${ext}'` · `appId !== 'com.orca.app'` 전부를 단언 | `electron-builder --win` → `orcinus-orca-<ver>-setup.exe` |
| R-02 | AT-02 / AC2 | 운영 데이터가 `%APPDATA%\orcinus-orca\`다 | `package.json`에 `productName` 키가 **없음**을 단언(AT-13)하고, `app.getName()`이 `name`으로 떨어지는 경로를 문서화. 실제 폴더는 사람 실기 | `app.getPath('userData')` → `db/index.ts` |
| R-03 | AT-03 / AC3 | 개발 데이터가 `%APPDATA%\orcinus-orca-dev\`다 | `devUserDataDir('/x/appData')` → `/x/appData/orcinus-orca-dev` 단위 단언 | `index.ts` DEV 분기 |
| R-04 | AT-04 / AC4 | 설정 루트가 `~/.config/orcinus-orca/`이고 하위 7종이 그 아래다 | `orcaConfigDir()`·`managedWorktreesDir(false/true)`·`orcaJsonPath()`·`sourcesSkillsDir()`·`projectsDir()`·`downloadsDir()`·로그 디렉토리·artifacts 루트가 전부 새 루트 접두를 갖는지 단위 단언 (8건, 각각 개별 케이스) | `bootstrap.ts` 부팅 배선 |
| R-05 | AT-05 / AC5 | DB와 그 부속 파일이 `orcinus-orca.db*`다 | `migrate.test.ts`가 `orcinus-orca.db.backup.before-<ver>.<ts>` 생성을 단언. `db/index.ts`의 파일명은 상수 SSOT를 통해서만 조립되는지 단언 | 부팅 DB 오픈 → 마이그레이션 백업 |
| R-06 | AT-06 / AC6 | 제품명 기반 내부 저장 파일 6종이 새 이름이다 | 순수 테스트가 `settings-store`·`secret-store`·`store-file`(2)·`deployer` 마커·`seed` 마커의 이름 상수가 전부 `PRODUCT_SLUG` 파생임을 단언. 리터럴을 되돌리면 실패한다 | 설정 저장 · 시크릿 · provider grant · 배포 · 스킬 seed |
| R-07 | AT-07 / AC7 | 플러그인 디렉토리와 스킬 네임스페이스가 `orcinus-orca`다 | `builtInHarnessPluginRoot(root,'claude')`가 `…/dist/claude/plugins/orcinus-orca`이고 `adaptSkillNameForClaude({sourceKind:'orca',name:'review'})==='orcinus-orca:review'` 단언 | 배포 → SDK `options.plugins` |
| R-08 | AT-08 / AC8 | 화면에 보이는 제품명이 `Orcinus orca`다 | 표시명 SSOT 상수 1개를 단언하고, **불변식의 주어(`\bOrca\b` — 홀로 선 제품명 단어)** 로 renderer prod 전수 스윕이 0건임을 단언 + main 사용자 대면 문자열 4곳이 SSOT 파생임을 단언 + `index.html`의 `<title>`이 SSOT 값과 문자열 일치함을 단언 | 헤더·사이드바·로그인·부팅·알림·스킬 목록·오류 토스트 |
| R-09 | AT-09 / AC9 | 옛 경로를 읽는 정상 경로가 없다 | 레거시 경로 상수가 **이관 모듈에서만** import되는지 전수 단언(`rg` import 그래프, 소비자 1파일) + 그 모듈이 읽기 전용 폴백을 노출하지 않음(공개 API에 `read*`/`resolve*` 없음) | — (부정 계약) |
| R-10 | AT-10 / AC10 | 기존 설치본의 데이터가 새 자리에서 그대로 열린다 | 임시 디렉토리에 옛 레이아웃을 만들어 이관 함수를 돌린 뒤: 루트 이동 · 내부 이름 개명 · 재실행 멱등(2회 호출 후 동일 상태) 단언. DB 절대경로 **5컬럼**은 실 sqlite로 rebase 후 값 단언. worktree repair는 실 git 저장소로 §8 재현 절차를 그대로 태워 `git worktree prune -n`이 무출력임을 단언 | `index.ts` 모듈 스코프 → `bootstrap` DB 단계 |
| R-11 | AT-11 / AC11 | 코드 식별자는 그대로다 | `docs/generated/inventory.md`의 IPC 채널 수가 **89**로 불변 · `sourceKind: 'orca'` 유니온 멤버 존재 · `ORCA_ATTACHMENT_START` 등 sentinel 4군 존재를 단언 | `npm run lint`·`check-doc-inventory --check` |
| R-12 | AT-12 / AC12 | 운영 문서가 새 이름과 전환 절차를 서술한다 | `release-operations.md`가 `orcinus-orca-<ver>-setup.exe`·`%APPDATA%/orcinus-orca`를 쓰고 **구버전 수동 제거 절차 문단**을 갖는지 단언(문구 존재 + 새 섹션 앵커). `check-doc-inventory.mjs`의 링크 검사 통과 | 사람이 릴리스할 때 읽는 문서 |
| R-13 | AT-13 / AC13 | `package.json`에 `productName` 키가 생기지 않는다 | 순수 테스트가 `'productName' in pkg === false` 단언 | — (회귀 가드) |
| R-14 | AT-14 / AC14 | 쿠키·브라우저 캐시가 새 userData 아래로 분리된다 | `partitionFor()`가 반환하는 `persist:auth.<group>` 문자열이 불변임을 단언하고, 저장 위치가 `app.getPath('userData')` 파생임을 문서 경로로 확인 | `session.fromPartition` → Chromium 저장소 |

### AC 검증 주의사항

- **기존 테스트 재사용**: `migrate.test.ts:153·206`이 실제로 `orca.db.backup.before-1.100.0.2026-07-08T00-00-00-000Z` 문자열을 단언하는 케이스를 갖고 있음을 확인했다 — AT-05는 이 케이스의 기대값 교체로 닫는다. `paths.test.ts`는 5건, `workspace-guard.test.ts`는 7건의 `.config/orca` 문자열을 갖는다.
- **사람 실기 항목**: AT-02(실제 `%APPDATA%` 폴더)·AT-01의 설치 실기·아이콘 증상 재확인. 이유 — Windows 패키징과 레지스트리 결과는 이 환경에서 재현 불가(egress 차단으로 electron ABI 빌드 불가, `app/AGENTS.md §제약 환경`). 순수 로직(경로 조립·이관·rebase)은 전부 순수 테스트로 내렸다.
- **N회/총량 기준**: AT-09의 분모는 "레거시 상수를 import하는 파일 수". sink는 `legacyUserDataDir`·`legacyConfigDir` 두 함수이고, `rg "legacyUserDataDir|legacyConfigDir" app/src --glob '!*.test.*'`의 결과가 **정의 파일 1 + 이관 모듈 1 = 2파일**이어야 한다. AT-08의 술어는 **불변식의 주어**여야 한다 — 해법의 이름(`'Orca'` 작은따옴표 리터럴)으로 세면 실측 34지점 중 1곳만 분모에 오른다(`useCompletionNotifier.ts:25`). 주어는 **홀로 선 제품명 단어**이므로 술어는 `grep -rnE "\bOrca\b" app/src/renderer --include=*.tsx --include=*.ts --include=*.html | grep -v '\.test\.'` = **0건**이고, 코드 식별자 `OrcaLogo`·`orcaApi`는 단어 경계가 성립하지 않아 술어에 걸리지 않는다(실측 확인). main은 전수 스윕 대상이 아니다 — 프롬프트 본문·주석의 `Orca`가 D-012로 남으므로, 사용자 대면 7지점을 **열거된 양성 단언**으로 잠근다.
- **총량/0건 기준**: AT-08·AT-09는 음성 게이트다. 각각 양성 단언과 짝지었다 — AT-08은 "SSOT 상수가 `Orcinus orca`이고 열거된 소비처가 그것을 import한다", AT-09는 "이관 모듈이 두 레거시 함수를 실제로 호출한다". 음성 단독으로 두지 않는다.

## 7-A. V / Trace Matrix

- **V mode 판정**: `Baseline V`. `INDEX.md`와 archive를 훑어 제품 식별자·경로 축을 계약으로 가진 기존 handoff가 없음을 확인했다(0103은 dev/prod 격리만, 0210은 worktree 수명주기만).
- **기준 V 상속 근거**: 없음.
- **변경이 시작되는 수준**: Baseline이라 해당 없음 — R부터 MD까지 전 층을 새로 만든다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01…R-14 | R | §7 | NEW | — |
| AT-01…AT-14 | AT | §7 | NEW | — |
| SD-01 | SD | §5 부팅 이관 종단 흐름 · §13 | NEW | — |
| ST-01 | ST | §7 AT-10 종단 시나리오 | NEW | — |
| AR-01 | AR | §9 이름 SSOT → 경로/빌드/화면 3소비자 | NEW | — |
| IT-01 | IT | §7 AT-04·AT-06·AT-07 | NEW | — |
| AR-02 | AR | §9 이관 모듈 ↔ 부팅 시퀀스 배선(로그 초기화 이전) | NEW | — |
| IT-02 | IT | §7 AT-10 부팅 순서 | NEW | — |
| AR-03 | AR | §12 DB 절대경로 producer/consumer + git worktree 양방향 링크 | NEW | — |
| IT-03 | IT | §7 AT-10 rebase·repair | NEW | — |
| MD-01 | MD | §11 `rebaseUnderRoot` 순수 술어 | NEW | — |
| UT-01 | UT | §7 AT-10 rebase 케이스 | NEW | — |
| MD-02 | MD | §11 이관 단계 멱등성 | NEW | — |
| UT-02 | UT | §7 AT-10 2회 호출 동일 상태 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `package.json`/`electron-builder.yml` → electron-builder `AppInfo` → NSIS 산출물 | 설정 파일을 파싱해 5개 키 값을 직접 단언 | not selected — 값 자체를 읽는 직접 oracle | EP-01 (1) |
| VP-02 | R-02·R-03 ↔ AT-02·AT-03 | REQUIRED | `app.getName()` → `getPath('userData')` → DB·store | `devUserDataDir` 반환값 직접 단언 + `productName` 부재 단언 | not selected — 반환값 직접 관측 | EP-02 (2) |
| VP-03 | R-04·R-05·R-06·R-07 ↔ IT-01 | REQUIRED | 이름 SSOT → `paths.ts`·`db/index.ts`·store 4종·`claude-plugin.ts` → 디스크 | 각 경로 함수/상수의 반환 문자열을 개별 케이스로 단언 (8+6+2=16건) | not selected — 반환값 직접 관측 | EP-03 (16) |
| VP-04 | R-08 ↔ AT-08 | REQUIRED | `PRODUCT_DISPLAY_NAME` → renderer 27지점 + main 7지점 | 양성: SSOT 값 단언 + 소비처가 상수를 참조. 음성: renderer prod `\bOrca\b` 0건 | **required** — 음성 스윕이 있으므로. 심을 결함: 임의 소비처의 상수 참조를 문자열 `Orca`로 되돌리면 음성 스윕이 실패해야 한다 | EP-04 (34) |
| VP-05 | R-09 ↔ AT-09 | REQUIRED | 레거시 상수 → 이관 모듈만 | 양성: 이관 모듈이 두 함수를 호출. 음성: 다른 파일의 import 0건 | **required** — 0건/전수 주장이므로. 심을 결함: `db/index.ts`에 `legacyUserDataDir` 폴백 import를 넣으면 음성이 실패해야 한다 | EP-05 (2) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | 옛 레이아웃 디스크 → `migrateLegacyRoots` → DB 오픈 → rebase → repair | 임시 디렉토리·실 sqlite·실 git으로 종단 실행 후 최종 상태 단언 | not selected — 최종 디스크·DB·git 상태를 직접 관측 | EP-06 (4) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `index.ts` 모듈 스코프 → 이관 → `initLog()` | 순서 훅: 이관 함수와 로그 초기화에 순서 기록기를 주입해 이관이 먼저 불림을 단언 | **required** — 순서 계약이므로. 심을 결함: 두 호출을 맞바꾸면 실패해야 한다 | EP-07 (1) |
| VP-08 | AR-03 ↔ IT-03 | REQUIRED | `managed_worktrees.repo_root`·`worktree_root` → rebase → **repo 측** `git worktree repair <worktree>` → 양방향 포인터 | 실 git: repair 후 `git worktree prune -n -v` 무출력 + 워크트리에서 `git status` exit 0. **repo도 함께 이동한 케이스**를 별도 케이스로 둔다 | **required** — repair 누락이 조용히 통과할 수 있으므로. 심을 결함: repair 호출을 제거하면 `prune -n`이 `Removing worktrees/...`를 출력해 실패해야 한다 | EP-08 (2) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | `rebaseUnderRoot` 순수 함수 | 접두 일치·불일치·경계(`/a/orca-x`가 `/a/orca` 접두로 잘못 잡히지 않음)·Windows 구분자 케이스 단언 | not selected — 반환값 직접 관측 | EP-09 (1) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | 이관 단계 멱등성 | 같은 입력에 2회 호출 후 디스크 스냅샷이 1회 호출 후와 동일함을 단언 | not selected — 상태 차집합을 직접 관측 | EP-10 (1) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | `shared/ipc.ts` → `check-doc-inventory` | 채널 수 89 불변 단언 + sentinel 4군 존재 | not selected — 개수·존재를 직접 관측 | EP-11 (1) |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | 문서 → 사람 | 문서 본문에 새 산출물명·새 데이터 경로·구버전 제거 문단이 있는지 단언 | not selected — 문자열 존재를 직접 관측 | EP-12 (1) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | `package.json` → `app.getName()` | `'productName' in pkg === false` | not selected — 직접 관측 | EP-02 (2) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | `partitionFor` → `session.fromPartition` → userData 하위 | 파티션 문자열 불변 단언 | not selected — 반환값 직접 관측 | EP-13 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/**` 정적 게이트 | `app/src`·`app/package.json`·`app/electron-builder.yml`을 바꾼다 | `npm run lint` · `npm run typecheck` (ABI-중립, `app/AGENTS.md §better-sqlite3 ABI`) | 이번 변경이 만든 error만 blocking. 기존 warning 1건은 베이스라인 |
| vitest 순수 스위트 | 경로·이관·표시명 테스트를 새로 만든다 | `./node_modules/.bin/vitest run` (pretest 우회) | DB 로드 스위트의 ABI 기인 red는 베이스라인으로 분리 보고 |
| DB 동작 스위트 | rebase가 실제 sqlite 쿼리를 쓴다 | `npm test` (DB 동작이 필요한 경우에만 의도적으로) | ABI 재빌드 불가 환경이면 미실행 사유를 기록 |
| `scripts/*.test.mjs` | `check-doc-inventory` 대상 문서를 바꾼다 | `node --test scripts/*.test.mjs` + `node scripts/check-doc-inventory.mjs --check` | 링크 파손·인벤토리 불일치는 blocking |
| repository / message-bus | handoff 산출물·INDEX 갱신 | `git log -1 --format='%(trailers:only=true)'` 파싱 확인 | trailer 미파싱은 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `appId`는 바로가기 AppUserModelID로 쓰인다 | `app-builder-lib@26.0.12` `templates/nsis/include/installer.nsh:180·189·205·212·220` — `WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"` |
| `appId`는 제거 레지스트리 키 GUID의 입력이다 | 같은 패키지 `out/targets/nsis/NsisTarget.js:157` — `UUID.v5(appInfo.id, ELECTRON_BUILDER_NS_UUID)` → `UNINSTALL_APP_KEY` |
| 런타임도 같은 값을 AUMID로 설정한다 | `app/src/main/index.ts:233` — `electronApp.setAppUserModelId('com.orca.app')` |
| 업데이트 캐시 이름은 **`package.json` name** 파생이다 (productName 아님) | `out/appInfo.js:126` — `updaterCacheDirName = sanitizedName.toLowerCase() + "-updater"`; 소비는 `electron-updater@6.8.9` `out/AppUpdater.js:545·550` |
| 업데이트 캐시 부모는 `%LOCALAPPDATA%`다 | `electron-updater` `out/AppAdapter.js` — win32면 `process.env["LOCALAPPDATA"]` |
| 설치 디렉토리 이름도 `package.json` name 파생이다 | `out/targets/targetUtil.js:40-42` + `NsisTarget.js:165` — `oneClick` 기본 true·`perMachine` 기본 false → `isTryToUseProductName=false` → `appInfo.sanitizedName` |
| `${name}` 매크로 = `package.json` name | `out/util/macroExpander.js:37-40` default 분기 → `appInfo[p1]`; `appInfo.name = info.metadata.name` (`appInfo.js:112`) |
| `productName`은 `config.productName || metadata.productName || metadata.name` | `out/appInfo.js:54` |
| electron-builder는 앱 `package.json`에 `productName`을 주입하지 않는다 | `grep -rln "writeFile.*package.json" app-builder-lib/out/` → Appx·Msi 매니페스트뿐, 앱 파일 복사 경로 0건 |
| `sanitize-filename`은 공백을 지우지 않는다 | `builder-util/out/filename.js` — `_sanitizeFileName` 위임, 금지문자만 제거 |
| 설정 루트 리터럴이 **두 곳**에 있다 (SSOT 위반) | `infra/config/paths.ts:29` `join(homedir(),'.config','orca')` · `infra/log/index.ts:47` 같은 식의 독립 하드코딩 |
| 로그 초기화가 모듈 스코프에서 설정 루트를 연다 | `index.ts:25` `initLog()` — 이관은 이 줄보다 먼저여야 한다 |
| 절대경로를 저장하는 DB 컬럼은 **5개**다 | `0010_session_cwd.sql:1` · `0017_session_extra_dirs.sql:3` · `0018_managed_worktrees.sql:4·5·6`(`repo_root`·`source_cwd`·`worktree_root`). `repo_root`는 `resolveRepoRoot(sourceCwd)`(= `rev-parse --show-toplevel`)이라 세션 cwd가 설정 루트 하위 저장소면 옛 루트 접두를 갖는다. `projects`에는 `cwd` 컬럼이 없다(`0002_projects.sql` 전문 확인) · `artifacts.relative_path`는 상대경로 |
| artifacts는 상대경로만 저장한다 | `0021_artifacts.sql:4` `relative_path TEXT NOT NULL UNIQUE` — 루트가 바뀌어도 rebase 불필요 |
| 렌더러가 `src/shared/`를 **값**으로 import하는 선례가 있다 | `GeneralTab.tsx:11` · `TokensPerDayChart.tsx:9` · `DebugPanel.tsx:2` · `chatReducer.ts:20` (4건). eslint `boundaries/include`는 renderer 블록에서 `src/renderer/src/**`만 포함하고 `no-unknown` 계열 규칙은 꺼져 있다(`eslint.config.mjs`) |
| 화면 표시 `Orca`에 SSOT가 없다 — **renderer 27 + main 4 = 31지점** | main 7 = `bootstrap.ts:182` sourceLabel · `bootstrap.ts` 부팅 단계 라벨 2개 · `deployer.ts:199` sourceLabel · `handlers/skills.ts:81` · `skills/sources.ts:54` 오류 문구 · `harness-plugins/claude.ts:16` 플러그인 description. renderer: `index.html:5` · `Header.tsx:179` · `Sidebar.tsx:130` · `GateLogin.tsx:53·61` · `AppLayout.tsx:43` · `BootScreen.tsx:29` · `GateFrame.tsx:33` · `BootFailureFrame.tsx:19` · `useCompletionNotifier.ts:25` · `OrcaLogo.tsx`의 `aria-label` · `i18n/resources/en.ts` 8건 · `ko.ts` 8건 (+ 주석 4건). |
| 워크트리 브랜치·디렉토리 이름은 제품명과 무관하다 | `features/worktrees/naming.ts` — `repoDirSegment`는 저장소 basename + sha1 8자, `branchDirSegment`는 브랜치명 |
| `docs/generated/inventory.md`의 IPC 채널 수 = 89 | `docs/generated/inventory.md:13` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 파일시스템 이름을 만드는 리터럴 (prod 코드) | 14개 패턴 개별 `rg -c … --glob '!*.test.*'` | 14 | 각 패턴이 정확히 1파일에 있다 — §11 변경 파일 표와 1:1 |
| 설정 루트 리터럴 | `rg "'\.config', 'orca'" src --glob '!*.test.*'` | 2 | `paths.ts` + `log/index.ts` — 중복 정의를 이번에 SSOT로 합친다 |
| 화면 표시 `Orca` (prod) | `grep -rnE "\bOrca\b" src/renderer --include=*.tsx --include=*.ts --include=*.html \| grep -v '\.test\.'` = 31행(주석 4 포함) + main 사용자 대면 4행 | 31 | renderer 27 + main 4. 주석 4행도 함께 고쳐 스윕 술어를 `\bOrca\b` 0건으로 유지한다 |
| `.config/orca` 문자열 (테스트 포함) | `rg -c "\.config/orca" src` | 10파일 | prod 6 + test 4 |
| `orca.json` 언급 (코드 주석 포함) | `rg -c "orca\.json" src` | 21파일 | 리터럴은 `paths.ts` 1곳, 나머지는 주석 서술 |
| `orca:` IPC 채널 | `docs/generated/inventory.md:13` | 89 | D-012 비범위 — 불변을 AT-11이 잠근다 |
| 절대경로 저장 DB 컬럼 | `grep -rnE "cwd\|_root\|_path" migrations/*.sql` | 5 | rebase 대상 전수 (`relative_path` 제외) |
| 갱신 대상 현재-상태 문서 | `rg -ln "…" docs --glob '!archive' '!handoff' '!etc' '!spec'` | 15 | + `app/AGENTS.md`·`app/src/main/AGENTS.md` = 17 |
| 갱신 대상 CI | `rg -n "orca" .github/` | 1 | `release.yml:81` artifact 이름 |

### 수치 / 전칭 표현 검산

- **재측정 수치**: IPC 채널 89(생성물 대조), 파일시스템 리터럴 14, 표시명 34, DB 경로 컬럼 5, 문서 16.
- **내역 합 = 총계**: 표시명 34 = renderer 27(`index.html` 1 + tsx/ts 9 + `OrcaLogo` aria 1 + i18n 16) + 주석 4 는 스윕 유지용 추가 + main 7 ✓ — **주석 4는 표시 분모가 아니라 스윕 분모다**. 문서 16 = docs 14 + AGENTS 2 ✓.
- **"유일한/항상/절대" 반례 검색**: "설정 루트 리터럴은 `paths.ts`가 유일하다"는 **거짓**이었다 — `log/index.ts:47`이 반례다. 이 반례가 §11 변경 파일 목록에 들어갔다.
- **문서 앵커 / 기존 테스트 케이스 존재 확인**: `migrate.test.ts:153`·`:206`의 백업 파일명 단언 케이스 실재 확인. `paths.test.ts` 5건·`workspace-guard.test.ts` 7건 실재 확인. `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 앵커 실재 확인(`AGENTS.md:112`).
- **worktree 이동 파손 재현** (이 세션 실측, 임시 저장소):

  | 단계 | 명령 | 관측 |
  |---|---|---|
  | 이동 직후 | `git worktree list` (원본 저장소) | 해당 행에 `prunable` 표시 |
  | 이동 직후 | `git worktree prune -n -v` | `Removing worktrees/work-x: gitdir file points to non-existent location` |
  | prune 실행 후 | 이동된 워크트리에서 `git status` | `fatal: not a git repository` · exit **128** |
  | repair 후 | 워크트리에서 `git worktree repair` → 원본에서 `prune -n -v` | 무출력(정상). `git worktree list`가 새 경로 표시 |

  → `git worktree add`가 자동 prune을 돌리므로, **repair는 앱이 다음 워크트리를 만들기 전에 끝나야 한다**(D-014).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: 없음(Baseline).
- **현재 책임 소유자**: 제품 이름이 **소유자 없이 흩어져 있다** — 빌드는 `package.json`+`electron-builder.yml`, 경로는 `paths.ts`+`log/index.ts`, 파일명은 6개 모듈이 각자 리터럴, 화면은 9곳이 각자 리터럴, AUMID는 `index.ts`가 별도 리터럴.
- **현재 entry → flow → store → consumer**: `app.getName()`(= `package.json` name `orca`) → `getPath('userData')` = `%APPDATA%\orca` → `db/index.ts`가 `join(userData,'orca.db')` · store 4종이 각자 이름 → 소비자. 병렬로 `homedir()/.config/orca`를 `paths.ts`와 `log/index.ts`가 **따로** 조립.
- **현재 오류/취소/정리 경로**: 이관 개념이 없다. dev 격리만 `setPath`로 존재(0103).
- **문제의 직접 원인 또는 구조적 제약**: `appId`·`productName`·`name`·경로·파일명이 전부 `orca`라, 같은 이름을 쓰는 다른 제품과 Windows 레지스트리(AUMID·제거 키)·`%APPDATA%`·`~/.config`에서 겹칠 수 있다.

```text
package.json(name:orca) ─┬→ app.getName() → %APPDATA%\orca ─→ orca.db / orca-*.json
                         └→ electron-builder: 설치dir·${name}·updaterCacheDirName
electron-builder.yml(appId) ─→ NSIS: 바로가기 AUMID · 제거 키 GUID
index.ts(리터럴) ───────────→ setAppUserModelId('com.orca.app')
paths.ts(리터럴) ──┐
log/index.ts(리터럴)┴──────→ ~/.config/orca/{orca.json,sources,dist,projects,downloads,worktrees,logs,artifacts}
renderer 9곳(리터럴) ──────→ 화면 "Orca"
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `AR-01`(이름 SSOT) · `AR-02`(이관 배선) · `AR-03`(경로 producer/consumer).
- **변경 후 책임 소유자**: `src/shared/product.ts`가 **표시명·슬러그·레거시 슬러그의 단일 소유자**다. 빌드 설정 2개 파일은 코드에서 import할 수 없으므로 SSOT를 **복제**하되 AT-01·AT-13이 두 사본의 일치를 기계 강제한다.
- **변경 후 entry → flow → store → consumer**: `index.ts` 모듈 스코프에서 ① dev userData 리디렉트 ② **`migrateLegacyRoots()`** ③ `initLog()` 순으로 실행. 이후 모든 경로 조립이 `PRODUCT_SLUG` 파생.
- **변경 후 오류/취소/정리 경로**: 이관은 단계별 멱등이고 실패 등급이 둘이다 — DB 3종은 부팅 차단(D-018), 나머지는 경고 후 계속(D-017).
- **유지하는 기존 메커니즘**: `app.setPath('userData')` dev 격리(0103의 수단), `managedWorktreesDir(isDev)`의 dev 분기(0210 D-103), `partitionFor()` 파티션 이름(D-009는 userData 이동으로 자동 충족), 워크트리 디렉토리 명명 규칙.
- **제거/대체하는 메커니즘**: `log/index.ts`의 독립 설정루트 조립 → `orcaConfigDir()` 호출로 **대체**. 흩어진 표시명 리터럴 9곳 → SSOT import로 **대체**.

```text
src/shared/product.ts  {PRODUCT_DISPLAY_NAME, PRODUCT_SLUG, LEGACY_PRODUCT_SLUG}
   ├→ main/infra/config/paths.ts ──→ ~/.config/orcinus-orca/{orcinus-orca.json,sources,dist,
   │      ↑ log/index.ts 도 여기로       projects,downloads,worktrees,worktrees-dev,logs,artifacts}
   ├→ main/infra/db/index.ts·migrate.ts ─→ <userData>/orcinus-orca.db{,-wal,-shm,.backup.*}
   ├→ settings-store · secret-store · auth/store-file ─→ <userData>/orcinus-orca-*.json
   ├→ adapters/claude-plugin.ts ──→ dist/<engine>/plugins/orcinus-orca + "orcinus-orca:<skill>"
   ├→ main/index.ts ─────────────→ setAppUserModelId(APP_ID)
   └→ renderer 8곳 + index.html ─→ 화면 "Orcinus orca"

main/index.ts 모듈 스코프:
  [DEV] setPath(userData) → migrateLegacyRoots() → initLog() → (whenReady) Bootstrap
                                  │
bootstrap DB 단계 후:  rebaseStoredPaths(db) → repairMovedWorktrees(db)  ← handler 등록 이전
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 이름이 14+9곳에 흩어짐, 소유자 없음 | `shared/product.ts` 단일 소유 + 빌드 설정 2사본을 테스트가 잠금 | 드리프트 방지 · D-016 | AR-01 / VP-03·VP-04 · `src/shared/product.ts` |
| 설정 루트 조립 | `paths.ts`·`log/index.ts` **2중 정의** | `orcaConfigDir()` 1곳, `log/index.ts`가 호출 | 반례가 실재(§8) — 한쪽만 고치면 로그가 옛 루트에 남는다 | AR-01 / VP-03 · `infra/log/index.ts` |
| data/control flow | 이관 없음 | 모듈 스코프 이관 → `initLog()` → DB 단계 rebase → repair | 로그가 옛 루트를 먼저 열면 이관이 불가 | SD-01·AR-02 / VP-06·VP-07 · `migrate-legacy.ts` |
| state/contract | 저장 절대경로가 옛 루트 접두 | rebase로 새 루트 접두 (5컬럼) | 경로만 바꾸면 기존 세션이 없는 디렉토리를 가리킨다 | AR-03 / VP-08 · `rebaseUnderRoot` |
| git 링크 | 원본 저장소 포인터가 옛 절대경로 | 이동된 워크트리마다 repo 측 `git worktree repair <worktree>` | 실측: 다음 `worktree add`의 자동 prune이 파괴한다 | AR-03 / VP-08 · `repairMovedWorktrees` |
| error/lifecycle | 해당 없음 | 2등급 실패(DB 차단 / 그 외 계속) + 전 단계 멱등 | 부분 상태의 영구화를 막는다 | SD-01 / VP-06·VP-10 · §13 |
| test seam/관측점 | 경로 함수는 순수, 이관 없음 | 이관·rebase·repair를 electron/DB 비의존 순수 파일로 분리 | 순수 테스트로 내리기 위해 | MD-01·MD-02 / VP-09·VP-10 · §11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/product.ts` | 표시명·슬러그·레거시 슬러그 상수 3개 (순수, 런타임 의존 0) | — / 문자열 | main `infra`·`adapters`·`app` · renderer `app`·`features` |
| `main/infra/config/paths.ts` | 설정 루트와 하위 경로 조립 + **레거시 루트 조립 2함수** | `PRODUCT_SLUG` / 절대경로 | `infra`·`features`·`app`·`adapters` |
| `main/infra/config/migrate-legacy.ts` (신규) | 파일시스템 1회 이관 (루트 이동 + 파일 개명), 동기·멱등 | 경로 쌍 / `MigrationReport` | `main/index.ts` 단 1곳 |
| `main/infra/config/rebase-path.ts` (신규) | `rebaseUnderRoot` 순수 술어 | `(p, oldRoot, newRoot)` / `string \| null` | `migrate-legacy` · `app/legacy-paths.ts` |
| `main/app/legacy-paths.ts` (신규) | DB 절대경로 5컬럼 rebase + 이동된 워크트리 repair | `Queries`·git runner / `RebaseReport` | `bootstrap.ts` DB 단계 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| **EP-01** AR-01 / VP-01 | 빌드 식별자 5개(`name`·`productName`·`executableName`·`artifactName`·`appId`) | `package.json` + `electron-builder.yml` | 순수 테스트 `product-identity.test.ts` | CI·로컬 vitest | 산출물 이름이 요구 표와 어긋난다. 게이트 green으로는 못 잡는다 |
| **EP-02** R-02·R-13 / VP-02·VP-13 | `package.json`에 `productName` 없음 · `devUserDataDir` 반환 | 같은 테스트 + `paths.ts` | 순수 테스트 | 같음 | `productName`이 생기면 userData가 공백 포함 경로로 조용히 이동한다 |
| **EP-03** AR-01 / VP-03 | 경로·파일명 16개가 `PRODUCT_SLUG` 파생 | `shared/product.ts` | `paths.test.ts` 외 5개 스위트 | vitest | 한 곳만 옛 이름이면 그 저장소만 옛 자리에 남는다 |
| **EP-04** R-08 / VP-04 | 표시명 SSOT + **34지점**(renderer 27 · main 7) + renderer `\bOrca\b` 0건 | `shared/product.ts` | 순수 테스트 + 음성 스윕 | vitest | 화면 일부가 옛 이름. 음성 단독이면 소비처 삭제를 못 잡으므로 양성 단언과 짝지었다 |
| **EP-05** R-09 / VP-05 | 레거시 상수 소비자 = 이관 모듈 1파일 | `paths.ts` 레거시 2함수 | import 그래프 전수 테스트 | vitest | D-010 위반(자동 fallback 부활). 음성 단독이라 양성 호출 단언과 짝지었다 |
| **EP-06** SD-01 / VP-06 | 이관 전체 시나리오 | `migrate-legacy.ts` | 임시 디렉토리 종단 테스트 | vitest | 기존 데이터 유실 |
| **EP-07** AR-02 / VP-07 | 이관이 `initLog()`보다 먼저 | `main/index.ts` 모듈 스코프 | 순서 기록기 주입 테스트 | vitest | 로그가 새 루트를 먼저 만들어 이관의 "target 없음" 가드가 거짓이 된다 |
| **EP-08** AR-03 / VP-08 | rebase된 워크트리마다 **repo 측** repair 1회 | `app/legacy-paths.ts` | 실 git 통합 테스트(워크트리만 이동 · repo도 함께 이동 2케이스) | vitest (실 git) | 다음 `worktree add`의 자동 prune이 워크트리를 파괴한다(§8 실측 exit 128) |
| **EP-09** MD-01 / VP-09 | `rebaseUnderRoot` 경계 규칙 | `rebase-path.ts` | 단위 테스트 | vitest | `/a/orca-x`를 `/a/orca` 하위로 오판해 남의 경로를 건드린다 |
| **EP-10** MD-02 / VP-10 | 이관 멱등 | `migrate-legacy.ts` | 2회 호출 차집합 테스트 | vitest | 부분 실패 후 재부팅이 상태를 더 망가뜨린다 |
| **EP-11** R-11 / VP-11 | IPC 채널 89 불변 · sentinel 4군 존재 | `shared/ipc.ts` | `check-doc-inventory --check` + 순수 테스트 | CI | D-012 위반(무차별 치환) |
| **EP-12** R-12 / VP-12 | 운영 문서 3항목 | `release-operations.md` | 문서 문자열 테스트 + 링크 검사 | `node --test scripts/*.test.mjs` | 릴리스 담당자가 구버전 제거를 안내받지 못한다(D-013) |
| **EP-13** R-14 / VP-14 | `partitionFor` 반환 불변 | `browser-session-policy.ts` | 기존 스위트 | vitest | 쿠키 파티션 이름이 바뀌면 기존 세션이 로그아웃된다 |

- **같은/동일 규칙의 SSOT와 공유 방법**: 슬러그는 `shared/product.ts` 1개. 빌드 설정 2개 파일은 코드에서 읽을 수 없어 값을 복제하지만, EP-01·EP-02가 **파일을 파싱해 SSOT와 대조**하므로 복붙이 아니라 검증된 사본이다.
- **`실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거**: 해당 없음 — 어떤 행도 다른 게이트에 의존하지 않는다.
- **선택적 필드의 `true/false/undefined` 의미**: `MigrationReport.moved`는 이동한 항목 배열이고 빈 배열 = 이동할 것이 없었음(정상), `failed`는 실패 항목 배열이며 `critical: true` 항목이 하나라도 있으면 부팅 차단. `undefined`를 허용하지 않는다(항상 배열).
- **외부 SDK 경계의 실제 요구 타입/의미**: 없음. `git worktree repair`는 CLI 호출이고 exit 0/비0만 본다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/product.ts` | **신규** 이름 SSOT | `PRODUCT_DISPLAY_NAME='Orcinus orca'` · `PRODUCT_SLUG='orcinus-orca'` · `LEGACY_PRODUCT_SLUG='orca'` · `APP_USER_MODEL_ID` | 순수 |
| `app/package.json` | 패키지 식별 | `name: orcinus-orca`, `description` 표시명 반영. **`productName` 키 추가 금지**(D-016) | 순수(파일 파싱) |
| `app/electron-builder.yml` | 빌드 식별 | `appId` 새 값 · `productName: Orcinus orca` · `win.executableName: orcinus-orca` | 순수(파일 파싱) |
| `app/src/main/index.ts` | 부팅 진입 | `setAppUserModelId(APP_USER_MODEL_ID)` · **`migrateLegacyRoots()` 호출을 `initLog()` 앞에** 삽입 | 순서 기록기 주입 |
| `app/src/main/infra/config/paths.ts` | 경로 SSOT | 4개 리터럴을 `PRODUCT_SLUG` 파생으로 · `legacyConfigDir()`·`legacyUserDataDir(appDataDir,isDev)` 신설 | 순수 |
| `app/src/main/infra/config/rebase-path.ts` | **신규** 순수 술어 | `rebaseUnderRoot(p, oldRoot, newRoot): string \| null` — 정규화 후 접두 판정, 경계 세그먼트 확인 | 순수 |
| `app/src/main/infra/config/migrate-legacy.ts` | **신규** 파일시스템 이관 | 동기·멱등. 루트 2개 이동 + 파일 8종 개명 + 플러그인 디렉토리 개명. `MigrationReport` 반환 | 임시 디렉토리 |
| `app/src/main/infra/log/index.ts` | 로그 파일 위치 | 하드코딩 조립을 `orcaConfigDir()` 호출로 대체 (SSOT 중복 제거) | 순수 |
| `app/src/main/infra/db/index.ts` | DB 경로 | `'orca.db'` → `${PRODUCT_SLUG}.db` | 순수 |
| `app/src/main/infra/db/migrate.ts` | 백업 파일명 | 백업 접두를 `${PRODUCT_SLUG}.db.backup.before-…`로 | 기존 `migrate.test.ts` |
| `app/src/main/infra/settings-store.ts` | 설정 저장 | store `name`을 `${PRODUCT_SLUG}-settings` | 순수 |
| `app/src/main/infra/config/secret-store.ts` | 시크릿 저장 | store `name`을 `${PRODUCT_SLUG}-secrets` | 순수 |
| `app/src/main/features/auth/store-file.ts` | 자격증명 저장 | store `name` 2개를 `${PRODUCT_SLUG}-provider-{grants,oauth}` | 순수 |
| `app/src/main/features/extensions/deployer.ts` | 배포 마커 | `.orca-deploy.json` → `.${PRODUCT_SLUG}-deploy.json` | 순수 |
| `app/src/main/features/extensions/skills/seed.ts` | seed 마커 | `.orca-builtin.json` → `.${PRODUCT_SLUG}-builtin.json` | 순수 |
| `app/src/main/adapters/claude-plugin.ts` | 플러그인 이름 SSOT | `ORCA_PLUGIN_NAME = PRODUCT_SLUG` (D-015). `sourceKind:'orca'` enum은 **불변** | 순수 |
| `app/src/main/app/legacy-paths.ts` | **신규** DB rebase + repair | 5컬럼 rebase(1 트랜잭션) → 변경된 `worktree_root`마다 repo 측 `git worktree repair <worktree>` | 실 sqlite + 실 git |
| `app/src/main/app/bootstrap.ts` | 부팅 배선 | DB 마이그레이션 단계 직후, **핸들러 등록 이전**에 `legacy-paths` 단계 삽입 | 부팅 단계 순서 |
| `app/src/renderer/index.html` | 창 제목 | `<title>Orcinus orca</title>` | 순수(파일 파싱) |
| renderer 10파일 | 화면 표시 | `Orca` 표기 27지점을 `PRODUCT_DISPLAY_NAME` 파생으로(주석 4지점도 함께) — `OrcaLogo.tsx` `aria-label`·`i18n/{ko,en}.ts` 16문구 포함 | 순수 + 음성 스윕 |
| main 5파일 | 사용자 대면 문구 | `bootstrap.ts`의 `sourceLabel`·부팅 단계 라벨 2개, `deployer.ts`의 `sourceLabel`, `handlers/skills.ts`·`skills/sources.ts`의 오류 문구, `harness-plugins/claude.ts`의 플러그인 description 을 SSOT 파생으로 | 순수 |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 경로 안내 문구 | `~/.config/orca/sources/settings` → 새 루트 (각 1건) | 순수 |
| `.github/workflows/release.yml` | CI 산출물 | artifact 이름 `orca-win-*` → `orcinus-orca-win-*` | — |
| `app/scripts/validate-dist.test.mjs` | 산출물 검증 픽스처 | 기대 파일명 6건 교체 | `node --test` |
| 테스트 9스위트 | 경로 문자열 | `paths.test.ts`(5) · `workspace-guard.test.ts`(7) · `migrate.test.ts`(3) · `worktreeDisplay.test.ts`(1) · DB 픽스처 5파일 | — |
| 문서 17건 | 현재 상태 서술 | §18 목록 | `check-doc-inventory` |

### 테스트 가능성

- **electron/DB/native 의존부와 분리할 별도 순수 파일**: `rebase-path.ts`(node builtin `path`만)와 `migrate-legacy.ts`(`node:fs` 동기 API만, electron 미의존)를 **별도 파일**로 만든다 — `index.ts`나 `bootstrap.ts` 안의 함수로 두면 electron import가 딸려와 순수 테스트가 불가능하다.
- **기존 메커니즘 재사용 시 형상/시점 적합성**: `settings-migration.ts`의 `RENAMED_KEYS` 패턴("새 키가 이미 있으면 그쪽이 이긴다 — 재실행 안전")을 파일 개명에 **같은 형상으로** 적용한다. 다만 그것은 설정 객체 안의 키 개명이고 이번은 파일시스템이라 코드를 공유하지 않는다.
- **순서를 관측할 훅/로그/주입 경계**: `main/index.ts`가 `migrateLegacyRoots`와 `initLog`를 모듈 스코프에서 부른다. 순서 단언을 위해 두 함수를 인자로 받는 `runStartupSequence(migrate, initLog)` 순수 조립 함수로 감싸고, 테스트가 호출 순서를 기록하는 스텁을 넘긴다.

## 12. End-to-end 영향

### producer → consumer

```text
PRODUCT_SLUG ─→ paths.ts/db/store 6종 ─→ 디스크 이름 ─→ (이관) ─→ DB 저장 절대경로 ─→ 세션 재개 consumer
                                                        └────────→ git worktree 원본 저장소 포인터
```

- **producer 기준**: 경로의 정본은 `paths.ts`의 함수 반환값이다. DB에 저장된 절대경로는 그 시점의 **스냅샷**이지 정본이 아니다.
- **consumer 파생 규칙**: 세션 재개는 저장된 `cwd`를 그대로 쓴다(`0210 D-107`: 실행 경로가 사라졌으면 원본 작업 경로로 폴백하고 `session.updated`의 `patch.cwd`로 알린다). rebase를 빠뜨리면 이 폴백이 대량 발동해 사용자에게는 "워크트리가 사라진 것"으로 보인다.
- **파생 가능한 합성값이 정본을 우회하지 않는가**: `managed_worktrees.worktree_root`는 `repoDirSegment`+`branchDirSegment`로 재계산 가능하지만 **재계산하지 않고 저장값을 rebase**한다 — 재계산은 브랜치 개명 이력이 있는 행에서 다른 값을 낸다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `initLog()` (`index.ts:25`) | 이관보다 뒤로 밀린다. 이관 중 오류는 버퍼했다가 로그 초기화 후 기록 | AT-10 · VP-07 |
| `bootstrap` `config-dir` 단계 (`ensureConfigDir`) | 이관이 이미 새 루트를 만들었으면 no-op | AT-04 |
| `bootstrap` `builtin-skill-seed` 단계 | seed 마커가 개명돼 있으면 재seed하지 않는다. 개명 실패 시 재seed(무해) | AT-06 |
| `ExtensionDeployer` (`dist/` 재생성) | 플러그인 디렉토리가 개명돼 있으면 그 위에 덮어쓴다. 개명 실패 시 새 이름으로 새로 만들고 옛 디렉토리는 소비자 0인 잔여물 | AT-07 |
| `updater` (`app-update.yml`의 `updaterCacheDirName`) | 새 캐시 디렉토리를 쓴다. 옛 캐시의 미완 다운로드는 버려진다(재다운로드) | AT-01 |
| `session.fromPartition('persist:auth.*')` | 파티션 이름 불변, 저장 위치만 새 userData로 이동 | AT-14 |

## 13. Lifecycle / 오류 / 정리

- **생성/시작**: 이관은 `main/index.ts` 모듈 스코프 1회. `app.whenReady()` 이전이며 단일 인스턴스 락 안이다.
- **취소/중단**: 취소 지점 없음(동기, 수백 ms 이내 stat/rename).
- **종료/quit/crash**: 이관 도중 크래시 → 다음 부팅이 파일별 가드로 이어서 수행.
- **retry/timeout/partial failure**: 재시도 = 재부팅. 타임아웃 없음.
- **cleanup/rollback**: 롤백하지 않는다 — 각 단계가 rename 하나라 원자적이고, 부분 완료 상태가 그대로 다음 실행의 유효한 입력이다.
- **다중 저장소 쓰기**: 이 작업의 핵심이다. 원자적으로 함께 쓸 수 없는 저장소가 **넷**이다.

| # | 쓰기 지점 | 실패/크래시 시 관측 상태 | 허용 여부와 설계 대응 |
|---|---|---|---|
| 1 | `%APPDATA%\orca` → `…\orcinus-orca` (rename) | 옛 루트만 존재 | 허용 — 다음 부팅이 재시도 |
| 2 | userData 내부 파일 8종 개명 | 일부만 새 이름 | **DB 3종은 불가** — `.db`만 옮기고 `-wal`을 못 옮기면 WAL 꼬리가 유실된다. 대응: DB 3종을 한 묶음으로 처리하고 **어느 하나라도 실패하면 예외를 던져 부팅을 막는다**(D-018). DB는 §11 순서상 아직 열리지 않았으므로 크래시로 인한 중간 상태는 다음 부팅의 파일별 가드가 DB 오픈 전에 복구한다 |
| 3 | `~/.config/orca` → `…/orcinus-orca` (rename) + 내부 개명 | 설정 루트만 옮겨지고 마커·플러그인 디렉토리가 옛 이름 | 허용 — 마커 부재는 재seed/재배포로 자기 치유. 경고 로그만 |
| 4 | DB 4컬럼 rebase (트랜잭션 1개) | 전부 또는 전무 | 허용 — sqlite 트랜잭션이 원자적 |
| 5 | `git worktree repair` (워크트리 N개, 원본 저장소 N곳에 쓴다) | 일부만 repair | 허용 — repair는 워크트리별 독립이고 멱등. 실패분은 다음 부팅에 재시도되지 않으므로(4가 이미 완료돼 "변경된 행"이 없음) **경고 로그에 실패한 워크트리 경로를 남긴다**. 사용자는 해당 세션에서 0210 폴백을 본다 |

  **순서 제약**: 4 → 5. rebase 없이 repair하면 옛 경로에서 실행하게 되고, repair 없이 rebase만 하면 §8 실측대로 다음 `worktree add`가 워크트리를 파괴한다. 둘 다 **핸들러 등록 이전**에 끝난다.

  **문서 사본**: 이번 산출물의 판정·상태는 `plan.md`와 `INDEX.md` 보드 두 곳에 산다. 두 사본을 같은 커밋에서 갱신한다(§10 EP 대상 아님 — repository gate).

## 14. 성능 / 상한 / 최적화

- **새 출력의 `원천 상한 × 배치 상한`**: 없음(모델 출력 변화 없음). 스킬 네임스페이스 문자열이 `orca:` → `orcinus-orca:`로 8자 늘어난다 — 스킬 수 상한 × 8자이며 프롬프트 예산에 유의미하지 않다.
- **새 요청 수**: 없음. `git worktree repair`는 로컬 프로세스이고 호출 수 = `managed_worktrees` 행 중 경로가 바뀐 것의 수.
- **부팅 비용**: 정상 부팅(이관 끝난 상태)에서 이관 모듈은 stat 약 15회. 최초 이관 부팅은 rename 약 12회 + git repair N회.
- **구조적 목표**: 없음(줄/파일 수 목표를 두지 않는다).
- **캐시/호출 축소로 잃는 부수 효과**: 업데이트 캐시 이름이 바뀌어 진행 중이던 부분 다운로드가 버려진다 — 재다운로드로 회복되며 회귀 테스트 대상이 아니다.

## 15. 외부 구현 포트 / 문서 계약

- **외부/배포가 구현할 port/schema/config**: `orcinus-orca.json`(구 `orca.json`)이 폐쇄망 배포자가 직접 쓰는 파일이다. 스키마는 불변, **파일명만** 바뀐다.
- **구현 문서**: `docs/guides/closed-network-extensions.md`(3건) · `docs/guides/release-operations.md`(2건).
- **shape 검증**: `orca-file.ts`의 zod 스키마는 손대지 않으므로 기존 `orca-file.test.ts` 6건이 그대로 shape을 잠근다.
- **semantics 검증**: 파일명 변경은 의미를 바꾸지 않는다. 다만 배포자가 옛 이름으로 만든 파일은 **읽히지 않는다**(D-010 — 자동 fallback 없음). 이관이 개명하지만, 이관 이후 새로 옛 이름을 만든 배포자는 침묵 실패를 본다 → `closed-network-extensions.md`에 새 파일명을 명시하고, `ensureOrcaFile`이 부재 시 빈 템플릿을 만드는 기존 동작이 그 침묵을 "빈 설정"으로 드러낸다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "`setName` 대신 `setPath('userData')` — 앱 이름/AppUserModelId 불변" | 0103 plan §65 | §9 TO-BE — `package.json` name과 `setAppUserModelId` 값을 둘 다 바꾼다 | **변경** — 0103의 목적은 dev/prod 격리였고 그 수단(`setPath`)은 유지된다. 이번은 제품 식별자 자체를 바꾸는 별개 요구다 |
| worktree 루트는 `<userData>`가 아니라 `orcaConfigDir()` 하위 | 0210 D-102 (`paths.ts:41` 주석) | §9 TO-BE — 루트 이름만 바뀌고 위치 관계는 그대로 | 유지 |
| dev는 worktree 디렉토리에만 `-dev`를 붙인다 | 0210 D-103 (`paths.ts:47` 주석) | §11 `managedWorktreesDir` | 유지 |
| 세션 cwd 소실 시 원본 작업 경로 폴백 + `patch.cwd` 통지 | 0210 D-107·D-109 (`IPC_CONTRACT.md`) | §12 consumer 파생 규칙 | 유지 — rebase가 이 폴백의 대량 발동을 막는다 |
| 개별 플러그인 루트 이름의 소유자는 `harness-plugins/*` | `/simplify` 0120 (`paths.ts:130` 주석) | §11 `claude-plugin.ts` | 유지 — `ORCA_PLUGIN_NAME`의 **값**만 SSOT에서 받는다. 경로 조립 책임은 그대로 |
| "코드에서 셀 수 있는 수치를 문서에 적지 마라" | root `AGENTS.md` 원칙 4 | §7 AT-11 | 유지 — 채널 수는 `inventory.md`가 갖고 AC는 그 생성물을 대조한다 |
| better-sqlite3 ABI 게이트 지침 | `app/AGENTS.md:112` | §19 | 유지 |
| 마이그레이션 파일 append-only | `app/AGENTS.md` DB 정책 | §11 — 새 `.sql` 마이그레이션을 **추가하지 않는다**(rebase는 데이터 갱신이지 스키마 변경이 아니다) | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 아이콘 증상의 원인이 `appId`가 아닐 수 있다 | 증상 해소를 AC로 삼지 않는다(§4). 이번 변경은 충돌 표면 제거이고, 남으면 상대 제품 실측으로 후속 handoff |
| 기존 설치본이 side-by-side로 남는다 | D-013 확정. 릴리스 노트·`release-operations.md`에 수동 제거 안내(AT-12) |
| 구버전 앱이 떠 있는 채로 신버전을 실행하면 Windows가 rename을 거부한다 | 단일 인스턴스 락은 같은 appId 내에서만 동작하고 appId가 달라졌으므로 **두 앱이 동시에 뜰 수 있다**. 이관 실패 → 경고 로그 → 다음 부팅 재시도. 수동 제거 안내가 이 상황을 줄인다 |
| `git worktree repair` 실패가 조용히 지나간다 | 실패한 워크트리 경로를 경고 로그에 남기고, 사용자에게는 0210 폴백이 보인다. VP-08이 성공 경로를 잠근다 |
| 표시명 `Orcinus orca`가 기존 UI 폭을 넘친다 | 헤더 18px·사이드바·로그인 5xl에서 길이가 3배가 된다. 사람 실기로 확인(§19). 잘림이 생기면 후속 조정 |
| `%APPDATA%`와 `~/.config`가 다른 볼륨이면 rename이 EXDEV로 실패 | 두 경로 모두 각자의 부모 안에서 sibling으로 rename하므로 같은 볼륨이다. 그래도 EXDEV를 잡아 경고 후 계속(DB 3종은 차단) |

- **되돌리기 어려운 결정**: `appId` 새 값 · `PRODUCT_SLUG` 문자열 · 스킬 네임스페이스 `orcinus-orca:`. 셋 다 배포 후 되돌리면 같은 side-by-side 문제를 다시 만든다.
- **신규 의존성**: 없음. → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

**코드 (신규 5 · 변경 25)**

- 신규: `app/src/shared/product.ts` · `app/src/main/infra/config/rebase-path.ts` · `app/src/main/infra/config/migrate-legacy.ts` · `app/src/main/app/legacy-paths.ts` · `app/src/main/product-identity.test.ts`(위치는 구현자 재량)
- 변경: `app/package.json` · `app/electron-builder.yml` · `.github/workflows/release.yml` · `app/src/main/index.ts` · `app/src/main/app/bootstrap.ts` · `app/src/main/infra/config/paths.ts` · `app/src/main/infra/config/secret-store.ts` · `app/src/main/infra/log/index.ts` · `app/src/main/infra/db/index.ts` · `app/src/main/infra/db/migrate.ts` · `app/src/main/infra/settings-store.ts` · `app/src/main/features/auth/store-file.ts` · `app/src/main/features/extensions/deployer.ts` · `app/src/main/features/extensions/skills/seed.ts` · `app/src/main/adapters/claude-plugin.ts` · `app/src/renderer/index.html` · `app/src/renderer/src/app/{Header,Sidebar,AppLayout,GateFrame,BootFailureFrame}.tsx` · `app/src/renderer/src/app/boot/BootScreen.tsx` · `app/src/renderer/src/app/hooks/useCompletionNotifier.ts` · `app/src/renderer/src/features/providers/components/GateLogin.tsx` · `app/src/renderer/src/shared/ui/OrcaLogo.tsx` · `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `app/src/renderer/src/features/chat/components/composer/composerPanel.ts` · `app/src/renderer/src/features/settings/components/TokensPerDayChart.tsx` · `app/src/main/app/handlers/skills.ts` · `app/src/main/features/extensions/skills/sources.ts` · `app/package-lock.json`
- 테스트: `paths.test.ts` · `workspace-guard.test.ts` · `migrate.test.ts` · `worktreeDisplay.test.ts` · `orca-file.test.ts` · `log-manager.test.ts` · `harness-config.test.ts` · DB 픽스처 5파일(`worktree-recover`·`worktree-bind`·`session-worktree-display`·`artifacts/service`) · `scripts/validate-dist.test.mjs`

**문서 (16)**

- `docs/PRD.md` · `docs/TRD.md` · `docs/GLOSSARY.md` · `docs/IPC_CONTRACT.md`
- `docs/arch/backend/{overview,persistence,runtime-ipc,security,standardization,observability,adapters}.md`
- `docs/guides/{release-operations,closed-network-extensions,workspace-isolation-permissions}.md`
- `app/AGENTS.md` · `app/src/main/AGENTS.md`
- `docs/handoff/INDEX.md` (보드 갱신)

**손대지 않는 문서**: `docs/decisions/001-orca-db-session-ssot.md` — ADR은 과거 결정 기록이고 D-012가 과거 기록의 치환을 금지한다. `docs/archive/**` · `docs/handoff/0*/` · `docs/etc/**` · `docs/spec/**` 동일.

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(레이어 DAG) · `app/src/renderer/AGENTS.md`(4-layer)
- **ABI/네트워크 등 환경 제약**: egress 차단 시 electron 바이너리 재빌드가 403으로 막힌다. DB 로드 스위트 red는 베이스라인으로 분리 보고한다.
- **기본 정적 게이트**: `npm run lint` + `npm run typecheck` (ABI-중립)
- **관련 테스트**: `./node_modules/.bin/vitest run` (pretest 우회, 순수 스위트) · `npm test`는 DB rebase 동작 확인이 필요할 때만 · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check`
- **사람 실기**: ① Windows에서 `orcinus-orca-<ver>-setup.exe` 설치 → 설치 경로·바로가기 이름·제어판 항목 확인 ② 구버전 데이터가 있는 PC에서 신버전 최초 실행 → 기존 대화·설정·워크트리 확인 ③ `%APPDATA%\orcinus-orca` · `%LOCALAPPDATA%\orcinus-orca-updater` 실재 확인 ④ 표시명 `Orcinus orca`의 화면 폭 확인 ⑤ 다른 Orca 제품과 동시 설치 시 아이콘 증상 재확인

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-018 전부 ACTIVE, OPEN 0(3건은 라이브 질의로 확정).
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — D-010·D-012는 사용자 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성됐다.
- [x] AS-IS → TO-BE Delta의 각 변경이 §11 파일 또는 AC로 추적된다.
- [x] AS-IS에서 사라진 책임은 명시했다 — `log/index.ts`의 독립 루트 조립은 **대체**(삭제 아님).
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 검산. 전칭 반례 1건 적발(`log/index.ts`).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없어 Baseline V를 썼고 유효 V = V1이다.
- [x] 변경 효과에 필요한 레벨(R·SD·AR·MD 전부)을 선택했고 모든 NEW node에 같은 레벨 REQUIRED pair가 있다.
- [x] INHERITED node 없음 — Baseline이라 REGRESSION·NOT_REQUIRED 행이 없다.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고, 적대 증거는 음성·순서·구조 oracle을 가진 4개(VP-04·05·07·08)만 선택 이유·변이와 함께 등록했다. **r1 정정 C1~C4로 EP-04(9→34)·EP-08(방향)·DB 컬럼(4→5) 분모를 실측값으로 교체했다.**
- [x] 현재 변경 산출물의 운영 gate가 열거됐고 기존 ABI red를 새 blocking 범위로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 경로 조립·이관·rebase는 전부 순수 테스트.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AT-08·AT-09의 음성 스윕에 양성 단언을 짝지었다.
- [x] "X가 쓰인다" 불변식의 검사 장치가 X를 지웠을 때 실패한다 — VP-04·VP-05의 심을 결함이 그것을 확인한다. 자리를 말하는 불변식(VP-07 이관↔로그 순서)은 두 호출을 맞바꾸면 실패한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 EP-01~EP-13.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 6건.
- [x] producer/consumer 양쪽 의미를 확인했다 — 저장 절대경로는 스냅샷이지 정본이 아니다(§12).
- [x] 상한·one-way door를 필요한 곳에서 계산했다 — §14·§17.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 교차검증했고 결과를 §3 갱신 메모에 관측으로 적었다 — 5쌍 대조, 충돌 0.
- [x] 산출물 문장 규칙을 지켰다 — Part I은 관측·결정, Part II는 경로·계약. 같은 사실을 중복하지 않는다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

- 분모 검산: …
- 덮개 회귀: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 관측한 게이트 산출 | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| AC 자기보고 | … |
| 합계 검산 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드 수: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | … | … | … | … |
