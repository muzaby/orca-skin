# Verify — 0156-superpowers-vendoring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0156-superpowers-vendoring` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 대상 커밋 | `bfbeec3` (설계 `bade702`) |
| 라운드 | 1 |
| 상태 | **PASS** (인수 9/10 완전 충족 + 1건 부분 충족 → 사람 실기 확인) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §이견 1 — "인수 기준 5 의 검증 가능성을 설계가 과대평가했다. `plugin list` 는 *이미 설치된 것*만 보여줄 뿐 프로젝트 `settings.json` 선언이 설치 프롬프트를 띄우는지는 못 본다" | **타당.** 헤드리스 `claude -p` 실행 후에도 마켓플레이스가 미등록으로 남는 것을 재확인했다. 설계가 기준 5의 검증 수단을 잘못 골랐다 | 매트릭스에서 기준 5를 **부분 충족(⚠️)** 으로 내리고, 나머지를 "사람" 열로 이관 |
| 설계 리뷰 §이견 2 — "게이트 절의 '변경 없음 = 회귀 없음' 은 `git status --porcelain app` 확인이 있어야 성립" | 타당. 구현이 실제로 실행해 0줄을 확인했다 | 기준 10 증거로 채택 |
| 선조치 #1 — `claude plugin marketplace remove` 가 프로젝트 `settings.json` 을 `{}` 로 덮어쓴다 (파일 복원함) | **타당하고 중요.** 커밋된 배선이 CLI 한 줄로 소실되는 실제 함정이다. 다만 이는 *Claude Code CLI 동작*이지 이 변경의 결함이 아니다 | 아래 "사람 확인 대기" 에 운영 주의로 기록. 부수 소득으로 **프로젝트 `settings.json` 이 CLI 에 실제로 읽힌다**는 증거가 됨 |
| 선조치 #2 — `git check-ignore` 로 무시 실효성 확인 | 타당 | 기준 8 증거로 채택 |
| 선조치 #3 — SessionStart 훅 출력 JSON 형식까지 파싱 검증 | 타당. 훅이 실행돼도 키가 틀리면 조용히 무시되므로 형식 확인이 실질 검증이다 | 리스크 R2 의 절반(bash 가용 환경)을 닫은 것으로 인정. Windows 실기는 여전히 사람 확인 |
| 선조치 #4 — upstream `HEAD`(main) 대신 태그 커밋 `3dcbd5c` 에서 `git archive` 추출 | 타당 | 기준 1·2 증거로 채택 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `.agents/skills/` 에 스킬 14개(50 파일)가 upstream `v6.2.0` 과 바이트 동일 | ✅ | `ls .agents/skills \| wc -l` → `14` · `find .agents/skills -type f \| wc -l` → `50` · `diff -r <v6.2.0 archive> .agents` → **skills 차이 0** |
| 2 | `hooks/` 3파일 + `plugin.json` + `LICENSE` 바이트 동일, `marketplace.json` 은 `name` 만 상이 | ✅ | `diff -r` 전체 출력이 `marketplace.json` 2행 1건뿐: `< "name": "superpowers-dev"` / `> "name": "superpowers-vendored"` |
| 3 | `claude plugin validate .agents --strict` 통과 | ✅ | `Validating marketplace manifest: /home/user/orca-skin/.agents/.claude-plugin/marketplace.json` → `√ Validation passed` |
| 4 | `.claude/settings.json` 이 `directory` 소스 `./.agents` + `enabledPlugins` 선언 | ✅ | `.claude/settings.json:3-14` (`extraKnownMarketplaces.superpowers-vendored.source = {source:"directory", path:"./.agents"}`, `enabledPlugins["superpowers@superpowers-vendored"] = true`) |
| 5 | Claude Code 런타임에서 마켓플레이스 등록 + 플러그인 enabled 로드 | **⚠️ 부분** | **입증됨**: `directory` 소스가 벤더 트리를 해석하고 플러그인이 정상 로드된다 — `marketplace list` → `Source: Directory (/home/user/orca-skin/.agents)`, `plugin list` → `superpowers@superpowers-vendored / Version: 6.2.0 / Status: √ enabled`, `plugin details` → **Skills (14)** + **Hooks (1) SessionStart** + always-on ~688 tok. **미입증**: *프로젝트 `settings.json` 선언으로부터의* 대화형 설치 프롬프트 (아래 "사람 확인 대기" 1) |
| 6 | 루트 `AGENTS.md` 에 핸드오프 우선 조정 규칙 + override 3종 | ✅ | `AGENTS.md` "superpowers 스킬 (벤더링)" 섹션 — "### 우선순위 — 핸드오프가 상위, 스킬은 그 안의 도구" + "### 명시적 override" **4항**(요구 3항 + `plan.md`/`verify.md` 산출물 고정 1항 추가) |
| 7 | `.agents/`·`.claude/` 각각 `AGENTS.md` + `CLAUDE.md` stub, 루트 표 2행 | ✅ | `.agents/{AGENTS.md,CLAUDE.md}` · `.claude/{AGENTS.md,CLAUDE.md}` (stub 은 저장소 표준 138B 본문과 동일) · 루트 `AGENTS.md` 디렉토리 표에 `.agents/`·`.claude/` 2행 |
| 8 | `.gitignore` 에 `.claude/settings.local.json` | ✅ | `git check-ignore -v .claude/settings.local.json` → `.gitignore:2:.claude/settings.local.json`. `--scope local` 설치가 실제로 그 파일을 생성했고 `git status` 에 안 잡힘 |
| 9 | `.agents/VENDOR.md` 가 URL·태그·SHA·제외 목록·버전업 절차 포함 | ✅ | `.agents/VENDOR.md` — "출처 / 핀" 표(`v6.2.0` / `3dcbd5c4b48e…`) · "벤더링 범위" 포함/제외 표 · "버전업 절차" 5단계 + `/plugin marketplace update` 주의 |
| 10 | `app/**` 무변경 (CI 미트리거) | ✅ | `git status --porcelain app` → **0줄**. 커밋 `bfbeec3` 변경 65파일 중 `app/` 경로 0건 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | **해당 없음** — `app/**` 무변경(0줄). CI `paths` 필터상 미트리거 |
| 인수 기준 ↔ 산출물 1:1 대조 | ✅ 증거 첨부 | 이견 시 중재 | 9/10 완전 · 1건 부분 |
| upstream 바이트 동일성 | ✅ `diff -r` | — | 의도된 1줄 외 차이 0 |
| 플러그인 매니페스트 유효성 | ✅ `plugin validate --strict` | — | pass |
| 레이어 경계(eslint-boundaries) | — | — | 해당 없음 (앱 코드 무변경) |
| 문서 형식/링크/한국어 | ✅ | — | 신규 4문서 모두 한국어·표 위주, 저장소 톤 유지 |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep | ✅ 최종 판단 | 아래 "위생 검토" |
| **Codex 실기 노출** | ✖ (컨테이너에 `codex` CLI 없음) | ✅ | **사람 확인 대기 2** |
| **Claude Code 대화형 설치 프롬프트** | ✖ (헤드리스로 발동 안 함) | ✅ | **사람 확인 대기 1** |
| **Windows 에서 SessionStart 훅** | ✖ (Linux 컨테이너) | ✅ | **사람 확인 대기 3** |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | **신규 npm 의존성 0** — 승인 불필요 |
| PR 머지 승인 | ✖ | ✅ | PR 미생성 (사용자 미요청) |

## 게이트 재실행 결과

`app/**` 무변경이므로 앱 게이트는 이 작업의 게이트가 아니다. 대신 실행한 것:

```
$ ls .agents/skills | wc -l ; find .agents/skills -type f | wc -l
14
50

$ diff -r <v6.2.0 archive> .agents --exclude=VENDOR.md --exclude=AGENTS.md --exclude=CLAUDE.md
2c2
<   "name": "superpowers-dev",
---
>   "name": "superpowers-vendored",

$ claude plugin validate .agents --strict
√ Validation passed

$ claude plugin marketplace add ./.agents
√ Successfully added marketplace: superpowers-vendored
$ claude plugin marketplace list
  > superpowers-vendored
    Source: Directory (/home/user/orca-skin/.agents)

$ claude plugin install superpowers@superpowers-vendored --scope local
√ Successfully installed plugin: superpowers@superpowers-vendored (scope: local)
$ claude plugin list
  > superpowers@superpowers-vendored
    Version: 6.2.0
    Scope: local
    Status: √ enabled

$ claude plugin details superpowers@superpowers-vendored
  Skills (14)  brainstorming, dispatching-parallel-agents, executing-plans,
               finishing-a-development-branch, receiving-code-review,
               requesting-code-review, subagent-driven-development,
               systematic-debugging, test-driven-development, using-git-worktrees,
               using-superpowers, verification-before-completion, writing-plans,
               writing-skills
  Hooks (1)    SessionStart  (harness-only — no model context cost)
  Always-on:   ~688 tok

$ CLAUDE_PLUGIN_ROOT="$PWD/.agents" bash .agents/hooks/run-hook.cmd session-start
  exit=0, hookSpecificOutput.hookEventName == "SessionStart",
  additionalContext 3,276자 (<EXTREMELY_IMPORTANT> … using-superpowers 전문)

$ git status --porcelain app | wc -l
0

$ git check-ignore -v .claude/settings.local.json
.gitignore:2:.claude/settings.local.json	.claude/settings.local.json
```

**실행 비트 보존** (git 인덱스 `100755`, 9개): `hooks/{run-hook.cmd,session-start}` · `skills/brainstorming/scripts/{start,stop}-server.sh` · `skills/subagent-driven-development/scripts/{review-package,sdd-workspace,task-brief}` · `skills/systematic-debugging/find-polluter.sh` · `skills/writing-skills/render-graphs.js`.

## 위생 검토 (AGENTS.md 변경 시)

- **키/토큰/이메일/IP 패턴 스캔**: 신규·수정 문서(`AGENTS.md` 루트 · `.agents/{AGENTS,VENDOR}.md` · `.claude/AGENTS.md`)에 비밀·개인정보 없음. **단 벤더 트리에는 upstream 저자 이메일 `jesse@fsck.com` 이 `plugin.json`/`marketplace.json` 의 `author` 필드로 존재**한다 — 공개 저장소의 공개 저작자 표기이며 MIT 고지의 일부다. 제거하면 매니페스트가 upstream 과 달라지고 저작자 표시가 사라지므로 **그대로 둔다**. → 맥락 최종 판단은 사람.
- **변동성/일회성/장문 코드설명서 혼입**: 루트 `AGENTS.md` 신규 섹션은 *구조·역할 매핑·우선순위 규칙*만 담는다. 변동성 정보(핀·버전·제외 목록)는 `.agents/VENDOR.md` 로, 라이브 상태는 `INDEX.md` 로 분리했다 — 위생 규칙 준수.
- **모순 규칙 점검**: 루트 `AGENTS.md` 커밋 프로토콜의 "기계적 강제(템플릿·CI·훅) 없음" 과 벤더 훅의 관계를 신규 섹션 "벤더 트리 취급" + `.claude/AGENTS.md` 규칙 1에서 명시적으로 구분했다(플러그인 소유 부트스트랩 ≠ 저장소 강제 장치). 모순 없음.

## PHASES.md 정합성

- 페이즈 표 말미에 `0156-superpowers-vendoring` 행 추가 (설계 `bade702` / 구현 `bfbeec3` / 검증 커밋). PR 없음 — 사용자 미요청.

## 사람 확인 대기 (실기)

1. **Claude Code 대화형 설치 프롬프트** — 저장소 루트에서 `claude` 를 대화형으로 실행 → 폴더 신뢰 수락 → 마켓플레이스/플러그인 설치 프롬프트가 뜨는지. 이 컨테이너에서는 헤드리스 세션 후에도 미등록으로 남아 검증 불가였다.
   *실패 시 폴백*: `.claude/settings.json` 의 `path` 를 절대 경로 또는 `${CLAUDE_PROJECT_DIR}/.agents` 로 교체. (`directory` 소스 타입 자체와 상대 경로 CLI 해석은 이미 입증됨.)
2. **Codex 노출** (리스크 R3) — `codex` 가 설치된 환경에서 저장소 루트로 세션 시작 → 스킬 목록에 14개가 보이는지. upstream 이 규정한 수용 테스트: **`Let's make a react todo list`** 를 입력했을 때 코드 작성 *전에* `brainstorming` 이 자동 발동해야 한다.
   *실패 시 폴백*: `~/.agents/skills/superpowers/` 사용자 단위 설치(upstream 이 Codex 용으로 쓰는 경로).
3. **Windows SessionStart 훅** (리스크 R2) — Windows 개발기에서 훅이 실행되는지. 실패해도 스킬 자체는 로드되며, 루트 `AGENTS.md` 문구가 폴백으로 동작한다.
4. **운영 주의** — `claude plugin marketplace remove superpowers-vendored` 를 실행하면 **커밋된 `.claude/settings.json` 이 `{}` 로 덮어써진다**(검증 중 실측). 벤더링을 되돌릴 게 아니라면 이 명령을 쓰지 말 것. 실수했다면 `git checkout .claude/settings.json`.
5. **제품 의도 부합** — 조정 규칙(핸드오프 우선 + override 4종)이 의도한 상하관계인지.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 기준 5의 *검증 수단*을 잘못 골랐다. "런타임에서 로드된다" 를 `plugin list` 로 확인하겠다고 했지만, 그 명령은 설치 *결과*만 보여줄 뿐 프로젝트 설정으로부터의 설치 *경로*는 못 본다. 설계 시점에 "이 기준을 어떤 명령이 실제로 반증할 수 있는가" 를 한 번 더 물었어야 했다. 또한 Codex CLI 부재를 비범위로 적어두고도 그것이 **요청 타겟 2개 중 1개의 실기 미검증**을 뜻한다는 점을 인수 기준에 반영하지 않았다.
- **구현 단계**: 검증 명령을 고르면서 `marketplace remove` 의 파괴적 부수효과를 예상하지 못해 커밋 대상 파일을 잠시 훼손했다(복원함). 되돌리기 명령을 실행하기 전에 그것이 무엇을 쓰는지 확인했어야 했다 — 결과적으로 유용한 발견이 됐지만 운이 좋았다.
- **검증 단계**: Codex 쪽 근거가 여전히 3자 문서다(공식 `developers.openai.com/codex/skills` 가 이 환경 프록시에서 403). 이 문서는 그 한계를 숨기지 않고 "사람 확인 대기 2" 로 분리했으나, **타겟 하네스의 절반이 실기 미검증인 채 PASS 로 종결된다는 점은 이 verify 의 실질적 약점**이다. 사용자가 Codex 수용 테스트를 돌리기 전까지 이 건은 "설계·배선 완료, 한쪽 실기 미확인" 으로 읽어야 한다.

## 결론 / 다음 단계

**PASS** — 인수 기준 10항 중 9항 완전 충족, 1항(기준 5) 부분 충족. 부분 충족분은 에이전트가 기계적으로 판정할 수 없는 대화형/타하네스 영역이라 사람 확인으로 분리했다(검증 책임 분리 원칙).

- PHASES.md 표 승격 → 완료.
- 다음 주체: **—** (종결). 단 위 "사람 확인 대기" 1·2 결과에 따라 폴백이 필요하면 후속 핸드오프로 이어간다.
- PR: 사용자가 명시적으로 요청하지 않아 생성하지 않았다.
