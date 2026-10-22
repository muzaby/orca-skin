# 0278 정책 검증 — FAIL

| 항목 | 값 |
|---|---|
| 검증자 / 일자 | Codex / 2026-10-22 |
| 대상 | `1ff91429..6bf1ee40` — 정책 구현 및 CI fixture 보완 |
| 구현 전 기준 | `1ff91429`, plan V1 확정 AC·Baseline V1·§10 |
| 라운드 | r1.2 검증 → r2 구현 |
| 자기검증 여부 | 구현과 같은 에이전트. 구현 보고를 증거로 삼지 않고 별도 반례·설치 SDK 실험 수행 |

**현재 작업경로별 MCP 격리가 Claude에서 성립하지 않는다.** A가 Git 루트이고 B가 그 하위 경로이면 A의 MCP off가 B에도 적용된다. CI 보완 완료 여부와 별개인 정책 결함이다.

## 기준선과 범위

`git diff 1ff91429..6bf1ee40 -- docs/handoff/0278-harness-extension-isolation/plan.md`에서 구현 보고 추가만 확인했다. V1의 Decision·AC·pair를 구현에 맞게 완화한 변경은 없다. 앞부분 초안보다 V1 확정 표가 우선한다.

| 기준 | 결과 |
|---|---|
| V1 Baseline, REQUIRED VP1–VP6·REGRESSION VP7 | 식별 가능. VP7의 0279 프로젝트 격리 회귀에서 실패 |
| D15 / AC5 | native plugin flags·skill 목록·OpenCode MCP 선택은 directory 수명에 고정됨 |
| D16 / AC7 / 0279 AC2 | 현재 cwd가 다른 프로젝트의 MCP 상태와 분리되어야 함. 실제 SDK 저장 범위 및 동기화 reader가 이를 위반 |
| D22–D25 / AC1–4 | native 기본값 사본 없이 명시 선택만 보관, capability에 따른 가변/고정 토글 확인 |
| D12 / 0281 | 팝업 안내·수동 새로고침 추가 없음, 재진입 목록 캐시 검증 유지 |

## F1 — Claude Git 루트 MCP 상태가 하위 작업폴더로 전파됨

**BLOCKING / VP7 PAIR_FAIL.** 사용자 요구는 현재 경로 단위인데 native MCP 저장 키와 Orca 공유 키의 범위가 다르다.

1. 임시 Git 저장소 A와 하위 작업폴더 B를 만든다. 각 폴더에 같은 이름 `fixture`의 MCP를 선언한다.
2. 격리한 SDK Query A의 MCP가 connected임을 확인하고 `toggleMcpServer('fixture', false)`를 호출한다.
3. SDK가 별도 config의 `.claude.json`에 `projects[A].disabledMcpServers`를 기록한다.
4. 새 Query B도 **disabled**로 시작한다. B의 설정 파일은 편집하지 않았다.
5. 기존 B에 대해서도 실제 `readClaudeProjectSettings(B)`와 `ClaudeProjectReconciliation`을 실행하면 A의 변경으로 B의 revision이 달라지고 `set('docs', false, 'mcp', false, guard)`를 호출한다.

관측 경로: 우측 패널 → session resource handler → `claude/native-resources.ts:toggleMcpServer` → SDK의 Git-root 영속 상태 → `project-settings.ts`의 Git-root entry + cwd entry 병합 → B watcher/reconcile. `native-resource-sharing.ts`의 cwd별 peer 필터만으로는 파일 경유 전파를 차단하지 못한다.

실제 SDK 관측 결과:

```json
{"initialA":"connected","afterA":"disabled","disabledSavedAt":["A Git root"],"firstB":"disabled"}
```

외부 API·사용자 설정은 사용하지 않았다. SDK prompt는 입력 대기 상태이며 API URL은 localhost 폐쇄 포트, MCP는 로컬 stdio fixture다. 설치 SDK와 native CLI로 재현했고, 실제 사용자 배포본의 모든 버전까지 확인했다는 뜻은 아니다.

## 별도 반례와 V-pair 결과

구현 보고가 다루지 않은 두 축을 추가했다. (1) 전역 변경이 directory 획득과 최초 prepare 사이에 들어오는 경합 및 A/B의 서로 반대인 MCP 상태, (2) 독립 Git 저장소 A/B 대신 Git 루트와 하위 cwd 조합이다. 프로덕션 코드 변이는 하지 않았다.

| Pair | 레벨 / 판정 | 직접 관측 |
|---|---|---|
| VP5 | UT / PASS | extension-catalog의 실제 SettingsStore·명시 선택 저장 및 경로 정규화. 기본값 조회가 저장을 만들지 않음 |
| VP6 | UT / PASS | 두 configured-resources reader와 Claude adapt·native plugin tests. 지원 불가 항목 제어 거부·skills allow-list |
| VP3 | IT / PASS | 실제 등록 catalog handler, preload, bootstrap harness/native-history 및 SDK HTTP fixture. 서로 다른 엔진 선택값 전달 |
| VP4 | IT / PASS | 실제 reader→catalog hook→CustomizeList, resource state→tile. 부분 실패·늦은 응답·고정 토글 |
| VP2 | ST / PASS(검증 범위) | OpenCode capture 이후 global 변경·A/B 반대 상태·busy 보류·새 directory 최신값, Claude plugin flags/skills owner 유지·마지막 해제 후 갱신 |
| VP7 | ST / PAIR_FAIL | F1. 기존 sync/shared-instance 테스트는 통과하나 native SDK의 Git-root MCP 상태가 다른 cwd로 확장됨 |
| VP1 | AT / BLOCKED_BY:VP7 | nav capability·외부 파일 불변·명시 선택 경로는 통과. 전체 제품의 프로젝트 격리는 승인 불가 |

§10 확인은 EP1(5자리: schema/store·IPC·preload/API·handler·bootstrap), EP2(3자리: Claude flags·allow-list·snapshot), EP3(4자리: OpenCode snapshot·prepare·mutation·저장/reconcile), EP4(5자리: 두 reader·hook·rows·panel)를 다시 대조했다. 17자리의 기존 경로는 관련 테스트에서 실행됐다. **17/17은 전체 정책 PASS가 아니다.** F1은 상속한 VP7의 native persistence 경계이며, 현재 경로를 서로 다른 Git 저장소로만 시험하면 드러나지 않는다.

## 실행 증거와 한계

| 검사 | 결과 |
|---|---|
| 정책/SDK/core 재실행 | 5파일 36테스트 통과 |
| UI·project sharing·instance lifecycle 재실행 | 11파일 73테스트 통과 |
| bootstrap/preload/store/adapter 추가 실행 | 8파일 117테스트 통과 |
| CI 실패 파일 보완 | 4파일 40테스트 통과. 기존 27실패 재현 후 수정 |
| 별도 반례 | OpenCode 1통과, Claude 1실패(의도한 격리 oracle 위반) |
| 설치 Claude SDK probe | A off → native Git-root 저장 → 첫 B disabled 재현 |
| 타입 / lint / 스크립트 | node/web/test 통과, lint 오류 0·기존 경고 2, 스크립트 142통과 |
| 전체 Windows CI | [run 39727864276](https://github.com/muzaby/orca-skin/actions/runs/39727864276) **success**. Vitest 805파일·7876테스트 통과, 기존 skip 2파일·2테스트. 스크립트 142통과. 문서·lint·typecheck 성공 |

테스트/SDK 재현 코드는 [evidence](evidence/README.md)에 보존했다. 실패 증거는 앱의 정상 CI 수집 경로 밖에서 명시 실행하며 숨긴 skip은 없다.

로컬 Electron 전체 검사는 fork 종료 지연으로 중단했고 통과 증거에서 제외했다. 자동 surface 스캔도 완료되지 않아 전수 성공으로 세지 않았다. 대신 신규 extensionControl·MCP control·catalog handler·CatalogToggle의 production 참조와 bootstrap 조립을 직접 대조했다. 문서 전체 링크 검사의 참조 checkout 오류는 기존 환경 문제이며 CI의 clean checkout 문서 검사는 통과했다.

**추가 확인 필요:** Orca 자체 MCP의 배포 파일은 고정 경로를 덮어쓰며 Claude snapshot은 flags·skills에 한정된다. 기존 Query가 있는 cwd에 새 Query가 합류하는 경우의 배포 MCP 구성이 동일한지 이번 SDK 실험은 확인하지 않았다. native MCP/flags 검사 결과를 Orca 배포 파일 전체의 불변 증거로 확대하지 않는다. 사용자 설치 OpenCode 1.17.19와 두 테마 실제 창 시각 인수도 미실행이다.

## 처분 및 다음 구현

| 항목 | 처분 |
|---|---|
| F1 | BLOCKING. 현재 cwd 범위와 SDK 저장 범위를 일치시키거나, 격리를 보장하지 못하는 제어를 지원 가능으로 표시하지 않아야 함. reader에서 상속만 제거해도 새 B Query의 native disabled 상태는 남으므로 SDK 경계까지 해결해야 함 |
| 기존 테스트 사각 | 같은 Git root의 A/B 조합을 runtime·파일·cold-start 회귀에 추가. root Query가 idle인 경우뿐 아니라 한쪽 busy인 경우도 검사 |
| Orca 배포 MCP | 후속 독립 검증 항목. 관측하지 않은 수명 경로에 PASS를 부여하지 않음 |
| 정책 변경 | 없음. 현재 경로를 Git root로 재정의하여 통과시키지 않음 |

프로덕션 수정은 이번 검증에 섞지 않았다. 사용자 요청에 따른 Codex 검증이며 Claude가 검증했다고 표기하지 않는다. CI 복구는 `6bf1ee40`, 정책 검증 결론은 **FAIL**로 분리한다.
