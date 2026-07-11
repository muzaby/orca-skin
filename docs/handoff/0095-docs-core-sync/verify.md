# Verify — 0095-docs-core-sync

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 문서 작업 — Claude 가 plan→impl→verify 순차 수행. 0094 의 후속편.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0095-docs-core-sync` |
| 검증자 | Claude Code |
| 일자 | 2026-07-11 |
| 대상 커밋 | `1139437` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 보정 ①: guides/workspace `~/.claude` write 는 표 반전 대신 **편차 노트** 병기 | 타당 — 코드 주석(`workspace-guard.ts:25-27`)이 "가이드 기본값에서 의도적으로 넓힌 편차"라고 명시, 가이드=일반론/코드=Orca 구현의 이중 성격 보존 | 매트릭스 #8 기준을 "편차 문서화"로 판정 |
| 보정 ②: PHASES 신규 행 해시 = INDEX 기재 해시 관례 | 타당 — 기존 행(9805bc4·fb72b1e·412c2bc·3495770·ef41e95)도 전부 본 클론 미해석(환경별 해시 편차 = 위생 노트 ① 관례) | 매트릭스 #5 를 "INDEX 와 일치"로 대조 |
| 선조치 ✅ #1~3: GLOSSARY §2 경로 현행화·Frame/Screen PR #29 반영·TRD §4/PRD §9 Python 런타임 "제거됨" 정정 | 타당 (명백한 사실 정정 — 선조치 경계 내) | 매트릭스 #2·#3·#4 증거에 포함 |
| 선조치 ⚠️ #4: 루트 `AGENTS.md` "`Criteria-*`=Codex 만" ↔ git-template "구현 에이전트" 불일치 | 타당 — 범위 밖(`docs/` 한정) 판단 동의 | **사용자 결정 대기** — 파생 이슈 D1 기록 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `IPC_CONTRACT.md` — **0094 D1 해소** | ✅ | §2.4 `theme: "white"\|"dark"` + `spendingLimitUsd`/`scheduler`(17 키) + `SettingsPatch` 실 shape / §1 도메인 20개(boot·notify 추가) / §2 분포에 `notify 1` + `= 64` 명기(합계 검산 64) / §2.1 `NormalizedEvent` 라벨 / §2.13 `wireLog` 4필드 / 헤더 날짜 |
| 2 | `GLOSSARY.md` | ✅ | Python Runtime·uv·buildPyEnv → "제거됨(0050 PR-B)" 1행 압축 / Project 구현 완료 / NormalizedEvent `provider` 주장 삭제 + §3 SSOT 포인터 / Skill 루트·ref / Credential 부분 구현 / SessionRuntime·Backend·Delta·Frame·Screen·TurnExtensions·CapabilityProbe·RevertManager ref 현행화 / **Scheduler·사용량 한도 신설** |
| 3 | `TRD.md` | ✅ | §6.7 17 키·white/dark / §4 (17 키·Zustand 완료·Playwright **미도입**·electron-updater/라우팅/diff 행·OQ3 해소·Python 런타임 제거) / §5 64 채널·20 도메인 + `NormalizedEvent` + 추가 도메인 포인터 / §2 F10 정정 + **F11~F15** / §9 scripts+CI/CD / §10 해소 anchor 6건 / §11 E2E 미도입·유닛 스위트 현행화 |
| 4 | `PRD.md` | ✅ | §11 ~~OQ1~~·~~OQ3~~·~~OQ8~~ 해소(관례 준수) + OQ9 부분 진전 / §7.1 Zustand·영속화·자격증명 완료 반영 / §7.3 NormalizedEvent 노트 / §8 Phase 1~3 ✅·Phase 4 진행 중 / §6.1 F10·§10.1/10.3 테마 2종 / §9 Projects·Engine·MCP ✅ + Python 런타임 ❌ 제거됨 / §12 참조 행 64 채널 |
| 5 | `PHASES.md` | ✅ | 0090(`119132f`)·0092(`2681732`)·0093(`e85c7d4`)·0094(`04aa676`) 행 승격 — 해시 INDEX 와 1:1 일치, 3열 bold 형식 / 0086 생략 판단 각주 / "현재 상태" 문단 갱신(uv 제거·UsagePanel·0079~0091 반영) |
| 6 | `git-template.md` | ✅ | 캐비앗을 `Claude-Session:` 정식 trailer + 8키 화이트리스트 파싱으로 정정, 함정 예시 블록에 `Claude-Session:` 라인 반영 |
| 7 | `claude-code-spec.md` | ✅ | §11 `--model`/`--effort` ✅ 채택(0010/0020) / §14.3 행 취소선+역사 보존 / §5.6·§11 OQ9 부분 진전(0022/0075) 반영 |
| 8 | `guides/workspace-isolation-permissions.md` | ✅ | §3.2 표 + **Orca 구현 편차 노트**(`writeExceptionRoots` — `~/.claude` write 허용, 0075 r2) / §3.4 스켈레톤 Bash 분기를 §3.5 SUPERSEDED 와 정합(screenBashCommand 호출 제거) / §8 체크리스트 동기화 |
| 9 | `docs/AGENTS.md` | ✅ | IPC 행 20 도메인 + notify 1(합계 64) / backend 행 자동 업데이트·스케줄러·시딩 / GLOSSARY·TRD·PHASES·데이터모델·외부 미러(agent-sdk) 행 정합 |
| 10 | 0094 D1 마감 | ✅ | `0094-arch-docs-sync/verify.md` D1 상태 open→**해결(0095)** |
| 11 | 무변경 확약 + 대조 | ✅ | `git diff --stat`: `app/**`·`docs/spec/**`·`docs/etc/**`·CLAUDE.md stub·`guides/release-operations.md` 변경 0. 분포 합계 python 검산=64·`SettingsSchema` 17 키 실측·잔존 stale grep(classic/cool·11 채널·총 36·53 채널)=0·인용 경로 `[ -e ]` 전수 통과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | — | — | N/A (문서 전용) |
| 인수 기준 ↔ 문서 대조 | ✅ | 이견 시 중재 | 11/11 |
| 수치 실측(64/20/17/13) 3중 정합 | ✅ | — | IPC_CONTRACT·TRD·docs/AGENTS.md 일치 |
| 문서 형식/한국어/관례(취소선·✅) | ✅ | — | PRD OQ2 선례·PHASES 3열 bold 준수 |
| 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일 0 |
| PRD 해소 표기 = 의도 변경 아님 | ✖ 보조 | ✅ 결정 | **사람 확인 대기** — 표기 어감 검수 |
| 루트 AGENTS.md Criteria-* 문구 (D1) | ✖ 범위 밖 | ✅ 결정 | **사람 확인 대기** |

## 게이트 재실행 결과

N/A — 문서 전용. 대신 실행한 검사:

```
$ python3 -c "print(5+1+1+1+5+2+6+2+7+5+6+5+3+1+4+4+1+2+1+2)"   # → 64 (§2 분포 = 헤더 총계)
$ grep -c 키 protocol.ts SettingsSchema                            # → 17 키 실측 (theme~scheduler)
$ grep -rn "classic|cool|11 채널|총 36|53 채널" docs/{PRD,TRD,IPC_CONTRACT,AGENTS}.md  # → 잔존 0 (역사 보존 각주 제외)
$ git log -1 --format=%B | git interpret-trailers --parse          # → trailer 정상 파싱
```

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴: 0건. docs/AGENTS.md 변경분은 인벤토리 행 사실 갱신만 — 비밀/변동성 운영정보 혼입 없음.

## PHASES.md 정합성

- 신규 4행 형식·해시(INDEX 1:1)·승격 규칙(verify/PASS → 표 승격) 충족. 0086 생략은 각주로 판단 근거 기록. 본 0095 자체는 문서 동기화라 0094 와 동일하게 승격 비대상(핸드오프 문서가 이력 담당).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: PHASES 해시가 로컬에서 해석되지 않는 관례(환경별 편차)를 설계 시 예상하지 못해 구현 중 발견 — 다행히 기존 관례 확인으로 해소.
- 구현 단계: TRD/PRD 의 Python 런타임 잔존은 감사 3건 모두 놓쳤다(GLOSSARY 감사만 포착) — 제거된 서브시스템은 전 문서 grep 으로 전수 확인하는 절차를 다음부터 기본화.
- 검증 단계: PRD §9 프로토타입 참조 열(`project/…jsx`)의 실존은 미검증(디자인 아카이브 — 본 범위 밖).

## 결론 / 다음 단계

- 상태: **PASS** — 인수 11/11. 0094 파생 D1 마감.
- **사람 확인 대기**: ① PRD OQ 해소 표기 어감(의도 변경 아님 확인) ② 루트 `AGENTS.md` "`Criteria-*`=Codex 만" 문구 일반화 여부(파생 D1).

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 루트 `AGENTS.md` 커밋 프로토콜 표가 `Criteria-*` 작성 주체를 "구현 커밋(Codex)만"으로 좁힘 — 비기능 작업(Claude 구현)도 `Criteria-*` 를 쓰는 현행 관례(git-template.md·0092~0095 실커밋)와 불일치 | 구현자 코멘트 #4 / verify r1 | 루트 AGENTS.md 는 본 요청 범위(`docs/` 한정) 밖 — 사용자 승인 시 한 줄 정정("구현 커밋(구현 에이전트)만") | open |
