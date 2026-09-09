# Verify — 0225-orcinus-orca-naming

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0225-orcinus-orca-naming` |
| 검증자 | Claude Code |
| 일자 | 2026-09-09 |
| 대상 커밋/range | `fc0d993..9a2b9bb` |
| 구현 전 plan 기준 | `fc0d993` (규범 정정 C4까지 반영된 마지막 설계 커밋) |
| V mode / 유효 V | `Baseline V` / `V1` |
| 검증 기준 plan revision | `fc0d993:V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **설계·구현·검증이 같은 에이전트다.** §4의 자기검증 분모 규칙을 적용해 구현 보고가 이름을 대지 않은 적대 축 3건(M-E·M-F·M-G)과 §10 분모 독립 재열거를 추가로 수행했다 |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립한다.** 설계 커밋 3개(`678fbf6`·`c53f18b`·`fc0d993`)와 구현 커밋(`9a2b9bb`)이 갈려 있어 §0의 자기 증명 방지 장치가 작동한다.
- 구현 커밋의 `plan.md` diff는 **`[구현자 기입]` 자리표시자 치환 전부**다. 삭제된 줄 전건이 템플릿의 `…` 자리이고 규범 행(Decision·AC·V node/pair·§10) 삭제는 0건이다.
- Decision Ledger 변경: 없음. D-001~D-018 전건 ACTIVE 유지.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. AT-01~AT-14 총 14로 분모 불변.
- V node/pair·requiredness·§10·oracle 변경: 구현 커밋에서 없음. **구현 중 정정 C4(EP-04 9→31→34)는 별도 설계 커밋 `fc0d993`이 갖는다** — 분모를 늘리는 방향이라 자기 완화가 아니다.
- 채점에 사용할 원 기준: `fc0d993`의 §7 AC 표 · §7-A pair registry · §10 강제 지점 표.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속 기준이 없어 `Baseline V`. 0103(dev/prod 격리)·0210(worktree 수명주기)에 제품 식별자 축의 V가 없음을 확인 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | node 14, pair 14. R·AT·SD·ST·AR·IT·MD·UT 전 레벨이 짝을 가진다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | Baseline이라 INHERITED node 0 — REGRESSION 행이 없는 것이 맞다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 14 pair 전건이 production path와 EP 번호를 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 음성 스윕(VP-04·05)·순서(VP-07)·조용한 누락(VP-08) 4건만 선택했고 각각 심을 결함을 명시 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 5 gate 열거. 기존 ABI red를 새 blocking 범위로 올리지 않았다 |

- V 도입 전 plan 아님 — 합성 매핑 불필요.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 화면 `Orcinus orca` · 파일 `orcinus-orca` | `shared/product.ts` → renderer 11파일 + main 7지점 + `index.html` |
| D-002·D-013 | 산출물·appId 분리 | `package.json:name` → `${name}` 매크로·설치 dir·updater 캐시 / `electron-builder.yml:appId` → NSIS AUMID·제거 키 GUID |
| D-003·D-004·D-006~D-009 | 데이터·설정 루트와 내부 파일명 분리 | `PRODUCT_SLUG` → `paths.ts`·`db/index.ts`·store 4종·마커 2종·플러그인 디렉토리 |
| D-010 | 옛 경로를 정상 저장소·자동 fallback으로 쓰지 않음 | 레거시 상수 소비자가 `migrate-legacy.ts` 1파일. 공개 export 2개에 읽기 API 없음 |
| D-012 | 코드 식별자 불변 | `orca:` 채널 89 · `sourceKind:'orca'` · sentinel 4군 · `window.orca` 전부 그대로 |
| D-014 | 전체 이관 + worktree repair | `index.ts` 모듈 스코프 이관 → `bootstrap` DB 단계 rebase 5컬럼 → repo 측 `git worktree repair` |
| D-016 | `productName` 키 금지 | `package.json`에 키 부재. `app.getName()`이 `name`으로 떨어진다 |
| D-017·D-018 | 멱등 + 2등급 실패 | `move()`가 단계마다 "source 있고 target 없으면", DB 3종만 `critical: true` → `legacy-migration` 단계가 DB 오픈 전에 throw |
| D-015 | 플러그인 이름 함께 변경 | `ORCA_PLUGIN_NAME = PRODUCT_SLUG` → `dist/<engine>/plugins/orcinus-orca` · `orcinus-orca:<skill>` |

### end-to-end 흐름

```text
[기존 설치본 최초 실행]
  index.ts 모듈 스코프
    → (DEV) setPath(userData)
    → runStartupSequence({ migrateLegacy, initLog })     ← 순서 계약 EP-07
        → migrateLegacyRoots: %APPDATA%\orca → …\orcinus-orca, 내부 12항목 개명
                              ~/.config/orca → …/orcinus-orca, 마커·플러그인 개명
        → initLog() (새 설정 루트에 로그를 연다)
    → moved/conflicts/failed 를 로거에 flush
  whenReady → new Bootstrap(…, legacyMigration)
    → step 'legacy-migration' (critical) : DB 3종 실패면 throw → BootFailureFrame
    → step 'db-init'
    → step 'legacy-paths' (non-critical) : rebaseStoredPaths(5컬럼, 1 트랜잭션)
                                           → repairMovedWorktrees(repo 측 repair)
    → registerChatHandlers …                              ← 세션 재개는 여기부터
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 등급이 갈린다 | DB 3종 실패만 부팅 차단. 나머지는 경고 후 계속하고 다음 부팅이 재시도한다 |
| false success 가능성 | **1건 — 제품 계약이 만든 것** | 새 userData 루트가 이미 있으면 `move()`가 conflict로 기록하고 조용히 넘어간다. 첫 부팅에 이 조건이 성립하면 이관이 통째로 no-op이다 → D3 |
| partial failure/rollback | 안전 | DB 3종 이동 순서가 `-wal` → `-shm` → `.db`라 어디서 끊겨도 다음 부팅의 파일별 가드가 수렴한다. rebase는 sqlite 트랜잭션 1개 |
| Product/UX의 A가 아닌 다른 B를 구현했는가 | 아니오 | 상태 전이표 7행이 코드의 7 경로와 1:1이다 |
| 증상만 제거하고 상태 변화가 남았는가 | 아니오 | 옛 루트를 남기는 유일한 경로가 conflict이고, 그 행은 설계가 명시한 계약이다 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | repair는 매 호출이 디스크 포인터를 다시 읽는다. 캐시 도입 0 |
| 출력/요청 worst-case 상한 | 유계 | repair 호출 수 = 경로가 바뀐 `managed_worktrees` 행 수. 프롬프트 증분은 스킬당 8자 |

- 추가 관측: `configRoots`가 이동 여부와 무관하게 항상 채워지고 `legacy !== current`가 영구 참이라, **rebase의 SELECT 2건이 매 부팅 돈다**. §14의 부팅 비용 산정에 이 항목이 없다 → D7.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh fc0d993..9a2b9bb
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 값 export | 정상 | 신규 3건 없음. `Sidebar.tsx`의 폭 상수 3개는 이번 변경 이전부터 있던 것이고 diff가 건드리지 않았다 |
| 타입 전용 export 7건(`RebaseReport`·`MigrationReport` 계열) | 정상 | 전부 같은 파일의 시그니처가 쓴다. `MigrationReport`는 `bootstrap.ts`·`startup-sequence.ts`가 값 경로에서 소비한다 |
| 테스트 전용 참조 | 신규 0 | 목록 9건 전부 이번 변경 이전 심볼(`namespaceOrcaSkill`·`safeProjectName` 등). 이번 신규 5모듈은 전건 프로덕션 참조가 있다 |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 무출력. 직접 확인한 형제쌍(settings-store ↔ secret-store, store-file 2슬롯)도 같은 형상이다 |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `Bootstrap` 생성자 2번째 인자에 기본값을 둬 기존 호출부(테스트 포함)가 깨지지 않는다. 기본값은 `configRoots` 빈 문자열이라 rebase가 즉시 return한다 |
| producer ↔ consumer 파생 불일치 | 없음 | 저장 절대경로를 재계산하지 않고 접두만 바꾼다(§12 규칙 그대로) |
| 동일 규칙 중복 구현 | SSOT로 합쳐졌다 | 설정 루트 리터럴 2중 정의(`paths.ts`·`log/index.ts`)가 `orcaConfigDir()` 호출 1곳으로 수렴 |

- **미배선 점검**: 신규 5모듈의 유일한 호출자가 테스트인 것은 0건이다. `migrateLegacyRoots`←`index.ts`, `runStartupSequence`←`index.ts`, `migrationBlocksBoot`·`rebaseStoredPaths`·`repairMovedWorktrees`←`bootstrap.ts`, `rebaseUnderRoot`←`migrate-legacy`·`legacy-paths`.
- **로컬 재구현 점검**: `legacy-paths.test.ts`·`migrate-legacy.test.ts`가 production 심볼을 그대로 import한다. 동명 로컬 재구현 0건.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 케이스 실재: `migrate.test.ts:153·207`의 백업 파일명 단언이 새 이름으로 교체된 채 살아 있다. `paths.test.ts`·`workspace-guard.test.ts`의 경로 문자열도 그대로 케이스를 유지한다.
- structural proxy만으로 통과한 AC: 없음. 음성 스윕 2건(AT-08·AT-09)에 양성 단언이 짝지어져 있고, 두 짝을 각각 변이로 확인했다(M-A/M-E · M-B).
- **선택된 적대 증거 재측정**: 등록 변이 4건 + 이번 라운드 신설 축 3건 = **7건 전건 red**. 미검출 0.
- **이전 라운드 대조**: r1이라 이전 라운드 없음. 덮개 회귀 판정 불가·해당 없음.
- **자기검증 분모**: 구현자 = 검증자다. 구현 보고가 이름을 대지 않은 축 **3건**을 추가했다 — 같은 계약을 다른 지점에서 깨기(M-E, main 사용자 대면 7지점), 형제 슬롯 맞바꿈(M-F), 보고가 세지 않은 컬럼(M-G, `sessions.extra_dirs`). 셋 다 red였다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-A — `Header.tsx` 소비처를 리터럴 `'Orca'`로 되돌림 | `product-identity` | 해당 없음 | **red** (1케이스) | VP-04 등록 변이 |
| M-B — `db/index.ts`에 `legacyUserDataDir` import 추가 | `product-identity` | 해당 없음 | **red** (1케이스) | VP-05 등록 변이 |
| M-C — `runStartupSequence`의 두 호출 맞바꿈 | `startup-sequence` | 해당 없음 | **red** (2케이스) | VP-07 등록 변이 |
| M-D — `repairMovedWorktrees`의 git 호출을 성공 상수로 대체 | `legacy-paths` | 해당 없음 | **red** (2케이스) | VP-08 등록 변이 |
| M-E — **main** 지점 `skills/sources.ts` 오류 문구를 리터럴로 (신설 축) | `product-identity` | 해당 없음 | **red** (1케이스) | 자기검증 분모 |
| M-F — `settings-store` ↔ `secret-store` store name 맞바꿈 (형제 슬롯) | `product-identity` | 해당 없음 | **red** (2케이스) | 자기검증 분모 |
| M-G — `rebaseStoredPaths`에서 `sessions.extra_dirs` 처리 제거 (신설 축) | `legacy-paths` | 해당 없음 | **red** (1케이스) | 자기검증 분모 |

- 동작 보존 추출 라운드인가: **아니오**. hunk 되돌림의 초록을 판정 근거로 쓰지 않았다.
- 소거 변이의 잔여물 수렴: M-B·M-E·M-G는 잔여 진단 없이 테스트 본체가 red였다. 잔여물이 대신 red를 만든 케이스 0건.
- 형제 슬롯 맞바꿈: **2슬롯 맞바꿔 검출** (M-F). 존재만 보는 단언이 아니라 파일별 기대 문자열이라 침묵하지 않았다.
- `N회` 기준의 실제 관측 주체: repair는 워크트리당 1회이고 `legacy-paths.test.ts`가 실 git의 `prune -n -v` **stderr까지** 합쳐 관측한다(stdout만 보면 어떤 상태에서도 빈 문자열이다).
- 순서 기준의 관측 훅: `runStartupSequence`에 순서 기록 스텁을 주입한다. 배선 자체는 electron 부재로 소스 텍스트 proxy이며, 그 proxy의 민감도를 M-C가 확인했다.

### 구조적 proxy 엄격화 (§8)

| 스윕 | 엄격화 | 차집합 | 판정 |
|---|---|---|---|
| renderer `\bOrca\b` 0건 | 파일 확장자를 `.ts/.tsx/.html` → **전체 확장자**로 확대 | `styles/tokens.css` 3행 | 전부 CSS 주석이다. 표시 문자열의 0건 주장은 유지되고, 확장자 필터가 가리는 것은 주석 드리프트뿐 → D4 |
| renderer 스윕의 분모 실재 | walk가 실제로 파일을 도는가 | 354파일 | 0파일 → 자동 통과가 아니다 |
| EP-05 파일 목록 | 심볼 언급(주석 포함)까지 세는 현재 술어 유지 + 독립 재실행 | 없음 | `paths.ts`·`migrate-legacy.ts` 2파일로 일치 |

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-09 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | `rebase-path.test.ts` 7케이스 — 형제 접두 `/a/orca-x`·Windows 구분자·빈 문자열 | 순수 술어 / EP-09 1/1 |
| VP-10 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS** | `migrate-legacy.test.ts` 2회 호출 후 디렉토리 스냅샷 차집합 0 | 이관 재실행 / EP-10 1/1 |
| VP-03 | R-04·05·06·07 ↔ IT-01 / IT | REQUIRED | **PASS** | `paths.test.ts` 6 + `product-identity` 10 + 플러그인 1 = 17케이스가 18지점을 덮는다. M-F로 민감도 확인 | SSOT → 경로/파일명 → 디스크 / EP-03 **18/16** |
| VP-07 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | 순서 기록기 2케이스 + 배선 단언 3케이스. M-C red | 모듈 스코프 → 이관 → `initLog()` / EP-07 1/1 |
| VP-08 | AR-03 ↔ IT-03 / IT | REQUIRED | **PASS** | 실 sqlite + 실 git 6케이스. repo도 함께 이동한 케이스가 별도로 있다. M-D·M-G red | 5컬럼 → repo 측 repair → 양방향 포인터 / EP-08 2/2 |
| VP-06 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | `migrate-legacy.test.ts` 9케이스 — 임시 홈·임시 appData에 옛 레이아웃을 깔고 production 함수를 돈다 | 옛 디스크 → 이관 → 새 이름 / EP-06 4/4 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PASS** | 설정 파일 파싱 7케이스. `appId`·`productName`·`executableName`·`artifactName`·`name`·AUMID | 빌드 설정 → NSIS 산출물 / EP-01 1/1 |
| VP-02 | R-02·03 ↔ AT-02·03 / AT | REQUIRED | **PASS**(순수 축) | `devUserDataDir` 반환값 + `productName` 부재 | `app.getName()` → userData / EP-02 2/2 |
| VP-04 | R-08 ↔ AT-08 / AT | REQUIRED | **PASS** | 음성 스윕 31행 → **0행**(양 트리에서 직접 측정) + 양성 11파일 + main 7지점 + `<title>`. M-A·M-E red | SSOT → 화면 / EP-04 **34/34** |
| VP-05 | R-09 ↔ AT-09 / AT | REQUIRED | **PASS** | 소비자 2파일 재측정 + 공개 export 2개 정확 일치. M-B red | 레거시 상수 → 이관 모듈만 / EP-05 2/2 |
| VP-11 | R-11 ↔ AT-11 / AT | REQUIRED | **PASS** | `check-doc-inventory --check` = `89 channels` + 채널 수 ↔ 생성물 대조 + sentinel 4군 | `shared/ipc.ts` → 생성물 / EP-11 1/1 |
| VP-12 | R-12 ↔ AT-12 / AT | REQUIRED | **PASS** | `release-operations.md:65` `## 구버전(orca) 수동 제거` 실재 + 새 산출물명·새 데이터 경로 | 문서 → 릴리스 담당자 / EP-12 1/1 |
| VP-13 | R-13 ↔ AT-13 / AT | REQUIRED | **PASS** | `'productName' in pkg === false` | `package.json` → `app.getName()` / EP-02 2/2 |
| VP-14 | R-14 ↔ AT-14 / AT | REQUIRED | **PASS**(순수 축) | `browser-session-policy.ts`가 diff에 없다. 기존 스위트 green | `partitionFor` → `fromPartition` / EP-13 1/1 |

- root `PAIR_FAIL`: **없음**.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: `legacy-paths.test.ts`가 VP-08과 VP-06의 DB·git 구간을 함께 지난다. VP-06의 파일시스템 구간은 `migrate-legacy.test.ts`가 따로 닫는다.
- 이번 라운드 실행 범위: **최초 검증** — 유효 V의 REQUIRED 14 pair 전건 + 현재 변경의 운영 gate 5건.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 빌드 산출물이 새 이름 | ✅ | 설정 파싱 7케이스 | `electron-builder --win` |
| AT-02 / AC2 | `%APPDATA%\orcinus-orca` | ⚠️ | 순수 축(키 부재)만 green. 실폴더는 Windows 실기 | `getPath('userData')` |
| AT-03 / AC3 | `%APPDATA%\orcinus-orca-dev` | ✅ | `devUserDataDir('/x/AppData')` 단언 | `index.ts` DEV 분기 |
| AT-04 / AC4 | 설정 루트와 하위 7종 | ✅ | `paths.test.ts` 6 + 로그·artifacts 2 = 8지점 | `bootstrap` 배선 |
| AT-05 / AC5 | DB와 부속 파일 | ✅ | `migrate.test.ts` 백업 파일명 2케이스 + `db/index.ts` 상수 파생 | 부팅 DB 오픈 |
| AT-06 / AC6 | 내부 저장 파일 6종 | ✅ | `product-identity` 6케이스, 각각 양성+음성 | 설정·시크릿·grant·배포·seed |
| AT-07 / AC7 | 플러그인 디렉토리·네임스페이스 | ✅ | `ORCA_PLUGIN_NAME` 파생 + `adaptSkillNameForClaude` → `orcinus-orca:review` | 배포 → SDK `plugins` |
| AT-08 / AC8 | 화면 표시명 | ✅ | 음성 0행 + 양성 11파일 + main 7 + `<title>` | 헤더·사이드바·로그인·부팅·알림 |
| AT-09 / AC9 | 옛 경로 읽기 경로 0 | ✅ | 소비자 2파일 · 공개 export에 `read*`/`resolve*` 없음 | 부정 계약 |
| AT-10 / AC10 | 기존 데이터가 그대로 열린다 | ✅ | 임시 디스크 9 + 실 sqlite·실 git 6케이스. 필드 전제는 D3 | 모듈 스코프 → DB 단계 |
| AT-11 / AC11 | 코드 식별자 불변 | ✅ | 채널 89 불변 · sentinel 4군 · `sourceKind` 유니온 | lint·doc-inventory |
| AT-12 / AC12 | 운영 문서 | ✅ | 새 산출물명·새 경로·구버전 제거 절 | 릴리스 문서 |
| AT-13 / AC13 | `productName` 키 부재 | ✅ | `'productName' in pkg === false` | 회귀 가드 |
| AT-14 / AC14 | 쿠키·캐시 분리 | ⚠️ | 파티션 문자열 불변만 green. 저장 위치는 Windows 실기 | `fromPartition` |

- **합계 재측정**: `✅ 12 · ⚠️ 2 · ❌ 0 = 총 14`. 분모를 직접 세었고 AC 총수 14와 일치한다. 자기보고 `✅12·⚠️2/14`와 **일치**.
- **합계 사본 대조**: 본문 12/14 ↔ 커밋 trailer `Criteria-Met: 12/14` ↔ INDEX 비고 `✅12·⚠️2/14` — **세 사본 일치**.

### pair별 plan §10 강제 지점 분모 (검증자 재열거)

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01 | 빌드 식별자 5개 + AUMID | EP-01 (1) | 7/1 — 5키 + AUMID + 옛 appId 부재 | PASS |
| VP-02·13 | `productName` 부재 · dev userData | EP-02 (2) | 2/2 | PASS |
| VP-03 | 경로·파일명 | EP-03 (16) | **18/16** — 설정 루트 8 + 내부 파일 6 + 플러그인 2 + DB 2 | PASS |
| VP-04 | 표시명 | EP-04 (34) | **34/34** — renderer 31행 → 0행(양 트리 실측), main 7지점 열거 단언 | PASS |
| VP-05 | 레거시 상수 소비자 | EP-05 (2) | 2/2 — `grep -rl` 재실행이 같은 2파일 | PASS |
| VP-06 | 이관 시나리오 | EP-06 (4) | 9케이스 / 4 | PASS |
| VP-07 | 이관 → 로그 순서 | EP-07 (1) | 1/1 | PASS |
| VP-08 | repair 1회 | EP-08 (2) | 2/2 — 워크트리만 이동 · repo도 함께 이동 | PASS |
| VP-09 | 경계 규칙 | EP-09 (1) | 1/1 (7케이스) | PASS |
| VP-10 | 멱등 | EP-10 (1) | 1/1 | PASS |
| VP-11 | 채널 89 · sentinel | EP-11 (1) | 1/1 | PASS |
| VP-12 | 운영 문서 3항목 | EP-12 (1) | 1/1 | PASS |
| VP-14 | 파티션 불변 | EP-13 (1) | 1/1 | PASS |

- **DB 절대경로 컬럼 독립 재열거**: `migrations/*.sql`을 직접 훑어 `sessions.cwd`·`sessions.extra_dirs`·`managed_worktrees.{repo_root,source_cwd,worktree_root}` = **5**. `rebaseStoredPaths`가 5컬럼 전건을 쓴다. `artifacts.relative_path`는 상대경로라 대상 밖이 맞다.
- 표에 없는데 같은 불변식이 필요한 지점: 없음. 구현자가 보고한 4건(부팅 라벨 2·플러그인 description·`repo_root`)은 정정 C2·C4로 이미 분모에 올라와 있고 재열거에서 확인했다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| `app/**` 정적 | `app/src`·`package.json`·`electron-builder.yml` 변경 | **PASS** | lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts` react-compiler = 베이스라인) · typecheck **3구성 0 error** |
| vitest 순수 스위트 | 신규 5스위트 | **PASS** | **437파일 4069케이스 — 13 fail / 4055 pass / 1 skip**. 변경 전 트리 실측 **432파일 4005케이스 — 13 fail / 3991 pass**. 신규 red **0** |
| DB 동작 | rebase가 실 sqlite를 쓴다 | **PASS** | `legacy-paths.test.ts`가 `vitest run`에서 실 sqlite로 돈다 — `npm test`(ABI 전환)를 쓰지 않았다 |
| `scripts/*.test.mjs` | `check-doc-inventory` 대상 문서 변경 | **PASS** | `node --test` **109/109 pass** · doc-inventory `generated ok(9 items, 89 channels) · prose ok · links ok` |
| repository / message-bus | handoff 산출물·INDEX | **PASS** | 커밋 4개 전건 trailer 파싱 성공 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `orcinus-orca.json` (구 `orca.json`) | zod 스키마 미변경 — `orca-file.test.ts` 6케이스 그대로 | 파일명만 바뀌고 의미 불변. 이관이 개명하고, 이후 옛 이름으로 만든 파일은 읽히지 않는다(D-010) | PASS |
| `closed-network-extensions.md` | 새 파일명 서술 반영 | 배포자가 옛 이름을 쓰면 `ensureOrcaFile`이 빈 템플릿을 만들어 "빈 설정"으로 드러난다 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 표시명: 변경 전 renderer `\bOrca\b` **31행** → 변경 후 **0행**. 두 트리에서 같은 명령을 직접 돌려 얻었다.
- 레거시 상수 소비자: **2파일**.
- DB 절대경로 컬럼: **5**.
- IPC 채널: **89** (생성물 대조).
- vitest 파일/케이스: 현재 437/4069, 기준선 432/4005 — **+5파일 / +64케이스**, 신규 구현 5테스트와 일치.
- 내역 합 = 총계: EP-03 18 = 8 + 6 + 2 + 2 ✓. AC 14 = 12 + 2 ✓.
- 0건 게이트의 정당한 예외 보존: 음성 스윕이 `window.orca`·`orca:` 채널·`sourceKind:'orca'`·`orca-login.webp`를 지우지 않는다 — 단어 경계가 성립하지 않아 술어에 걸리지 않는 것을 실측했다.
- 상한: repair 호출 = 경로가 바뀐 워크트리 행 수. 무제한 fan-out 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 설치 산출물 (AT-01) | 설정 5키 + AUMID 상수 | NSIS 실행·설치 경로·바로가기 이름·제어판 항목 | Windows에서 `orcinus-orca-<ver>-setup.exe` 설치 |
| 실 데이터 폴더 (AC2) | `productName` 부재로 `app.getName()`이 `name`으로 떨어지는 것 | `%APPDATA%\orcinus-orca` · `%LOCALAPPDATA%\orcinus-orca-updater` 실재 | 설치 후 폴더 확인 |
| 이관 (AC10) | 임시 홈·실 sqlite·실 git 종단 15케이스 | **새 userData 루트가 첫 부팅 시점에 이미 존재하는가**(D3) | 구버전 데이터가 있는 PC에서 신버전 최초 실행 → 로그의 `app.legacy.migrated` 대 `app.legacy.conflict` 확인 |
| 쿠키·캐시 (AC14) | 파티션 문자열 불변 | Chromium 저장 위치가 새 userData 하위인지 | 로그인 후 `%APPDATA%\orcinus-orca` 하위 확인 |
| 표시명 폭 | 문자열 SSOT 파생 | 헤더 18px·사이드바·로그인 5xl의 잘림 | 앱 실행 후 시각 확인 |
| 아이콘 증상 | — (AC 아님) | 다른 Orca 제품과 동시 설치 | 두 제품 설치 후 바로가기 아이콘 관측 |

- electron/DB/native를 이유로 넘긴 순수 로직은 없다. 경로 조립·이관·rebase·repair·순서는 전부 기계 검증으로 내려왔다.

## 9. 게이트 재실행

```text
$ cd app && npm run lint            → 0 error / 1 warning
$ cd app && npm run typecheck       → node·web·test 3구성 0 error
$ ./node_modules/.bin/vitest run    → 437파일 4069케이스 · 13 fail / 4055 pass / 1 skip
$ node --test scripts/*.test.mjs    → 109 pass / 0 fail
$ node scripts/check-doc-inventory.mjs --check → generated·prose·links ok
```

- **관측한 실행 산출**(exit code 아님): 위 파일 수·케이스 수·error/warning 수를 그대로 적었다.
- `npm test`를 쓰지 않았다 — `app/AGENTS.md §better-sqlite3 ABI` 지침대로 `pretest`를 우회했고, DB 동작이 필요한 `legacy-paths.test.ts`가 그 상태에서 실 sqlite로 돌았다.
- **환경 기인 실패와 변경 관련 실패 분리**: 13 red 전건이 변경 전 트리(`fc0d993`)에서 **파일 목록·케이스 수가 동일**하다. 별도 워크트리를 만들어 같은 명령을 돌려 얻은 값이다. 다만 서명은 한 가지가 아니다 — 11케이스는 `Error: Electron failed to install correctly`, **2케이스(`handlers/session.load.test.ts`)는 `extraDirs: []` 관련 deep-equal 불일치**로 electron과 무관한 기존 red다 → D2.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint`가 `--fix`라 실행 후 `git status --porcelain`을 확인했다 — **출력 없음**. 검증자가 고친 코드가 없다.
- **검증 중 실행한 명령이 남긴 잔여물**: 베이스라인 측정용 git worktree를 스크래치패드에 만들었다. 저장소 트리 밖이고 검증 종료 시 제거한다. 미추적 산출물 0.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | 전건 통과, 기준선 분리 완료 |
| AC ↔ production path | 14행 1:1 대조 | — | ✅12 · ⚠️2 |
| 레이어/계약/문서 링크 | boundaries·doc-inventory | — | 통과 |
| AGENTS 위생/부모-자식 모순 | 스캔·대조 | — | 1건 적발(D1) |
| 제품 의도 / one-way door | 보조 의견 | **결정** | `appId` 값 `com.orcinus-orca.app` 승인 필요(D6) |
| 이관 실패 시 병합 정책 | 대안 2안 제시 | **결정** | 상태 전이표 3행 유지 여부(D3) |
| UI 시각 품질 | 문자열 SSOT만 | **시각 확인** | 표시명 폭 |
| PR merge | 상태 확인 | **승인** | 사람 몫 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 민감 패턴(키/토큰/PW/이메일/IP) 스캔: 0건.
- 일회성·변동성 운영정보 혼입: 없음. 변경된 3줄 전부 경로·파일명 서술이다.
- 부모 ↔ 하위 명령 충돌: 없음.
- 새 `AGENTS.md` 생성: 없음 — stub·루트 표 갱신 불필요.
- **적발 1건**: `app/AGENTS.md:171`이 아직 `name=`orca``로 적혀 있다. 같은 파일의 다른 3줄은 갱신됐다 → D1.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 이 커밋에서 `verify/PASS` · 다음 주체 `사람` 으로 갱신한다.
- 「다음 주체」 칸: 주체 하나만 담는다.
- 대상 커밋 좌표 기입(검증자 몫): `678fbf6`(설계) · `c53f18b`·`fc0d993`(규범 정정) · `9a2b9bb`(r1) — 4건 전부 `git cat-file -t` = `commit`.
- 비고 5줄 이내: 구현자가 남긴 비고가 6문장이라 이번 갱신에서 판정 중심으로 줄인다.
- PASS 시 archive 이동: **하지 않는다** — Windows 실기 4건이 남아 있어 0217·0216 선례대로 실기 뒤에 옮긴다.

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Status: designed|implemented` · `Criteria-Met`·`Criteria-Pending`·`Verified-By: pending` 전부 root `AGENTS.md` 표 안이다.
- trailer 파싱: 커밋 4개에 `git log -1 --format='%(trailers:only=true)'`를 돌려 적힌 키를 그대로 돌려받았다. 0건 없음.
- 인용 커밋 해시 실재: 4/4 `commit`.
- `[구현자 기입]` 7필드 전수: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals — **7/7 표 형태로 존재**. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 잠재 문제 #1 — 첫 이관 실패가 데이터를 영구 고아로 만든다 | **타당하고 범위가 더 넓다.** 실패뿐 아니라 target 선존재로도 같은 상태가 된다 | D3으로 확장해 기록. 사용자 결정 |
| 잠재 문제 #2·#4 — 모델 프롬프트·git stash 메시지 | 타당. D-001은 "화면 표시"를 말하고 둘 다 화면이 아니다 | 손대지 않은 것이 맞다. NEXT_HANDOFF 후보 |
| 잠재 문제 #3 — 일회성 temp 이름 | 타당. 생성 직후 삭제라 저장소가 아니다 | 기록만 |
| 잠재 문제 #5 — `repo_root` rebase가 새 워크트리 세그먼트를 바꾼다 | 타당. 기존 행은 저장값을 쓰므로 열린다 | 선조치 없음이 맞다 |
| 설계 대비 차이 — repair를 repo 측 호출로 | **타당하고 대체물의 실패 모드를 실제로 만들었다.** `repo_root`가 rebase되어 실재해야 한다는 새 결합을 M-G가 다시 확인했다 | 인정 |
| 설계 대비 차이 — `rename` 주입 포트 | 타당. root 환경에서 퍼미션 실패를 만들 수 없다. 프로덕션은 기본값을 쓴다 | 인정 |
| 블로커 ① `appId` 값을 스스로 정함 | plan이 값을 고정하지 않았으므로 계약 위반은 아니다. §17이 one-way door로 표시한 항목이다 | D6으로 사용자에게 올린다 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `app/AGENTS.md:171`이 `name=`orca``로 남았다. 같은 커밋이 같은 파일의 다른 3줄은 고쳤다 | 비귀속 — AT-12는 `release-operations.md`만 잠근다 | NON_BLOCKING | — | 다음 문서 손질에서 정정 |
| D2 | 구현 보고가 baseline red 13건을 전부 `Electron failed to install correctly`로 적었다. 실제로는 `handlers/session.load.test.ts` 2건이 `extraDirs: []` deep-equal 불일치다 | 비귀속 — 변경 전 트리에서 동일 | NON_BLOCKING | — | 기존 red의 원인은 별도 조사 대상 |
| D3 | **첫 부팅 시점에 새 userData 루트가 이미 있으면 이관이 통째로 conflict로 넘어간다.** electron이 모듈 스코프 이전에 userData를 만드는지 이 환경에서 확인할 수 없었다 | VP-06 production path의 전제 | NON_BLOCKING (사용자 결정) | SD-01 | §19 사람 실기 ②가 이것을 본다. 완화안 2안 — ① 빈 target은 항목 단위 이관 허용 ② 루트 이동 실패·conflict를 critical로 승격 |
| D4 | 음성 스윕이 `.css`를 보지 않는다. 차집합은 `tokens.css` 주석 3행 | VP-04 | NON_BLOCKING | — | 표시 문자열 0건 주장은 유지된다 |
| D5 | main 주석 8행이 옛 경로를 서술한다 — `~/.config/orca` 7행 · `dist/plugins/orca` 1행 | 비귀속 — D-012가 주석을 비범위로 둔다 | NON_BLOCKING | — | 다음 손질에서 함께 |
| D6 | `appId` 값 `com.orcinus-orca.app`을 구현자가 정했다. §17의 one-way door | D-013 | NON_BLOCKING (사용자 결정) | — | **릴리스 전 사용자 승인 필요** |
| D7 | `configRoots`가 항상 채워지고 `legacy !== current`가 영구 참이라 rebase SELECT 2건이 매 부팅 돈다 | 비귀속 — §14가 세지 않은 비용 | NON_BLOCKING | — | 비용이 작아 지금 고치지 않는다 |

- `PLAN_GAP`: **없음**.
- `BLOCKING`: **없음**.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1이라 없다. 다만 **한 라운드 안에서 EP-04 분모가 두 번 늘었다**(9 → 31 → 34). 두 번 다 술어를 불변식의 주어가 아니라 표기의 한 형태로 잡은 것이 원인이다.
- 관련 plan 지침/AC의 존재: 있었다. `handoff-plan`의 전수 조사 규칙과 §8 "수치/전칭 표현 검산"이 그 자리다. §8은 설정 루트 축에서 반례를 하나 잡았고 표시명 축에서는 놓쳤다.
- 사용자 결정 변경 근거: 없음. 이번 라운드에 `SUPERSEDED`로 바뀐 결정 0건.
- 반복된 검증 환경 한계: ① electron 바이너리 부재로 `Bootstrap` 실행 불가 — 배선을 소스 텍스트 proxy로 잠갔고 민감도는 변이로 확인했다. ② root 실행이라 퍼미션 기반 fs 실패를 만들 수 없다. ③ Windows 패키징·레지스트리·Chromium 저장 위치는 이 환경에서 관측 불가.
- 자기검증 라운드였다. 보고된 변이 4건은 전부 red로 재현됐고, 보고에 없던 축 3건도 red였다. 분모 독립 재열거(§10 13행 · DB 컬럼 5 · 표시명 34)에서 새로 드러난 누락은 0건이다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **14 PASS** · root `PAIR_FAIL` 0 · `BLOCKED_BY` 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-001~D-018 전건 충족. 위반 0
- AC 충족: `✅ 12 · ⚠️ 2 · ❌ 0 = 14`. ⚠️ 2건은 구현이 아니라 관측 수단(Windows 실기)이 막는다
- 현재 변경 운영 gate: 5/5 PASS. 신규 red 0 (13 red = 변경 전 트리에서 동일 측정)
- NON_BLOCKING: D1~D7 (7건). NEXT_HANDOFF 후보: 모델 대면 프롬프트·git stash 메시지의 제품 표기
- repository operation checks: trailer 파싱 4/4 · 커밋 좌표 4/4 실재 · `[구현자 기입]` 7/7 · AGENTS 위생 1건 적발(D1)
- 남은 사람 확인: Windows 설치 실기 · 구버전 데이터 PC 최초 실행(**D3을 여기서 본다**) · 표시명 폭 · 아이콘 증상 · **`appId` 값 승인(D6)**
- 다음 단계: 사람 실기. 실기 통과 후 archive 이동
