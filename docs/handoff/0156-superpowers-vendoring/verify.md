# Verify — 0156-superpowers-vendoring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0156-superpowers-vendoring` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 대상 커밋 | `bfbeec3` (설계 `bade702`) |
| 라운드 | **2** (라운드 1 = 2026-07-29, 아래 "라운드 2" 절 참조) |
| 상태 | **PASS** (인수 **10/10 완전 충족** — 두 하네스 fresh clone 실측 통과) |

> **라운드 1 → 2 요약**: 라운드 1 은 인수 기준 5를 "부분 충족" 으로 남기고 Codex 를 미검증으로 넘긴 채 PASS 로 종결했다. 사용자 지적("지금 플러그인을 사용할 수 없다면 설치됐다고 할 수 없다")을 받아 격리 환경 + fresh clone 으로 재측정한 결과 **두 하네스 모두 커밋된 파일만으로 동작**함이 확인됐다. 라운드 1 의 미검증은 설계 결함이 아니라 **검증 방법의 결함**이었다. 상세는 문서 말미 "라운드 2 — 재검증".

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
| 5 | Claude Code 런타임에서 마켓플레이스 등록 + 플러그인 enabled 로드 | ✅ **(r2 승격)** | **fresh clone + 격리 `CLAUDE_CONFIG_DIR`, 설치 명령 0회**: 신뢰 수락 후 마켓플레이스가 상대경로 `./.agents` 를 **clone 자신의 경로**로 해석해 자동 등록(`Source: Directory (<clone>/.agents)`) → 모델이 `superpowers:*` **14개 전부** 인식 → SessionStart 부트스트랩 주입 확인(`You have superpowers` → `YES`). 라운드 1 의 "⚠️ 부분" 은 헤드리스가 신뢰 다이얼로그를 수락하지 않는 데서 온 오진이었다. 절차·출력은 "라운드 2" 절 |
| 5-b | (r2 추가) Codex 런타임에서 스킬 노출 — 원래 "비범위/사람 확인" 이었던 항목 | ✅ **(r2 신규 검증)** | **격리 `CODEX_HOME`, 설치 명령 0회**: `codex debug prompt-input` 의 `<skills_instructions>` 에 `superpowers:*` **14개**가 `file: <repo>/.agents/skills/<name>/SKILL.md` 로케이터로 등장. 저장소 루트뿐 아니라 **하위 디렉토리(`app/src/main`)에서도 14개** — cwd→루트 상향 탐색 확인 |
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
| **Codex 실기 노출** | ✅ **(r2)** — vendor 바이너리 직접 실행 + 격리 `CODEX_HOME` | — | 스킬 14개 노출 확인 (루트·하위 디렉토리 모두) |
| **Claude Code fresh clone 로드** | ✅ **(r2)** — fresh clone + 격리 `CLAUDE_CONFIG_DIR` | — | 신뢰 수락 후 설치 명령 0회로 14개 + 부트스트랩 확인 |
| **Windows 에서 SessionStart 훅** | ✖ (Linux 컨테이너) | ✅ | **사람 확인 대기 1** — 유일하게 남은 진짜 미검증 |
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

> 라운드 1 은 5건이었다. 라운드 2 에서 3건을 실측으로 닫아 **2건**이 남았다.

1. **Windows SessionStart 훅** (리스크 R2, 잔여) — 이 컨테이너는 Linux 다. Windows 개발기에서 `run-hook.cmd` 가 bash 를 찾아 훅이 실행되는지는 실기 확인이 필요하다. 실패해도 **스킬 자체는 로드**되며(훅은 부트스트랩 주입만 담당), 루트 `AGENTS.md` 의 "superpowers 스킬" 섹션이 폴백으로 동작한다.
2. **제품 의도 부합** — 조정 규칙(핸드오프 우선 + override 4종)이 의도한 상하관계인지.

### 라운드 2 에서 닫힌 항목

- ~~Claude Code 대화형 설치 프롬프트~~ → fresh clone 실측으로 대체 확인 (신뢰 수락 후 설치 명령 0회로 동작).
- ~~Codex 노출 (리스크 R3)~~ → `codex debug prompt-input` 으로 14개 노출 + `.agents/skills/` 로케이터 확인.
- ~~상대 경로 해석 (리스크 R1)~~ → clone 자신의 경로로 정상 해석 확인. 폴백(절대 경로/`${CLAUDE_PROJECT_DIR}`) 불필요.

### 운영 주의 (존치)

`claude plugin marketplace remove superpowers-vendored` 를 실행하면 **커밋된 `.claude/settings.json` 이 `{}` 로 덮어써진다**(라운드 1 검증 중 실측). 벤더링을 되돌릴 게 아니라면 이 명령을 쓰지 말 것. 실수했다면 `git checkout .claude/settings.json`.

## 라운드 2 — 재검증 (사용자 지적 반영)

### 지적

> **"지금 플러그인을 사용할 수 없다면 설치됐다고 할 수 없다"**

정확한 지적이다. 라운드 1 은 두 가지를 잘못했다.

1. **내가 만든 상태를 내가 확인했다.** 기준 5의 증거로 제시한 `claude plugin list` / `plugin details` 출력은 **내가 직접 `plugin marketplace add` + `plugin install --scope local` 을 실행한 결과**였다. 그 상태는 사용자 레벨 `~/.claude/plugins/known_marketplaces.json` 과 gitignore 대상인 `.claude/settings.local.json` 에 있었다 — **커밋된 파일만 받는 fresh clone 에는 존재하지 않는다.** 커밋된 배선이 동작한다는 증거가 전혀 아니었다.
2. **타겟 하네스의 절반을 미검증으로 넘겼다.** 사용자 요청은 "타겟은 클로드코드, 코덱스" 였는데 Codex 는 "CLI 가 없다" 는 이유로 검증 0인 채 PASS 로 종결됐다.

### 원인 — 설계가 아니라 검증 방법의 결함

**헤드리스 `claude -p` 는 워크스페이스 신뢰 다이얼로그를 절대 수락하지 않는다.** 프로젝트 `.claude/settings.json` 기반 플러그인 로드는 신뢰 게이트 뒤에 있으므로, 신뢰를 세팅하지 않은 채 관측하면 **언제나** "로드 안 됨" 으로 보인다. 라운드 1 은 그 관측을 배선 결함 가능성으로 오진하고 사람에게 넘겼다.

Claude Code 자신이 이 사실을 명시적으로 알려준다:

```
‼ 1 project-scope plugin directory under ./.claude/skills/ was not loaded because
  this workspace was not trusted when plugins were scanned.
```

### 재측정 — 격리 환경 + fresh clone

핵심 원칙: **격리된 설정 디렉토리 + 저장소 fresh clone.** 현재 개발 환경 상태가 섞이면 아무것도 증명되지 않는다.

**Codex** (전역 설치 없이 vendor 바이너리 직접 실행, 격리 `CODEX_HOME`):

```
$ npm pack @openai/codex@0.146.0-linux-x64 && tar -xzf openai-codex-*.tgz
$ export CODEX_HOME=$SCR/codexhome          # 사용자 스킬이 섞이지 않게 격리
$ cd /home/user/orca-skin
$ package/vendor/x86_64-unknown-linux-musl/bin/codex debug prompt-input
```

`debug prompt-input` 은 **모델이 실제로 보는 프롬프트**를 JSON 으로 렌더한다. 그 `<skills_instructions>` 블록(6,666자):

```
### Available skills
- superpowers:brainstorming: You MUST use this before any creative work …
    (file: /home/user/orca-skin/.agents/skills/brainstorming/SKILL.md)
- superpowers:dispatching-parallel-agents: … (file: …/.agents/skills/dispatching-parallel-agents/SKILL.md)
- superpowers:executing-plans / finishing-a-development-branch / receiving-code-review /
  requesting-code-review / subagent-driven-development / systematic-debugging /
  test-driven-development / using-git-worktrees / using-superpowers /
  verification-before-completion / writing-plans / writing-skills
                                                        → superpowers:* 총 14개
```

하위 디렉토리에서도 동일:

```
$ cd /home/user/orca-skin/app/src/main && codex debug prompt-input
superpowers 스킬 개수: 14        # cwd → 저장소 루트 상향 탐색 확인
```

**Claude Code** (fresh clone + 격리 `CLAUDE_CONFIG_DIR`, 설치 명령 0회):

```
$ git clone /home/user/orca-skin $SCR/fresh2 && cd $SCR/fresh2
$ git checkout claude/superpowers-plugin-embed-1zuoc3
$ ls -a .claude            # AGENTS.md  CLAUDE.md  settings.json  (커밋된 것뿐)
$ export CLAUDE_CONFIG_DIR=$SCR/ccfg3       # 기존 설치가 섞이지 않게 격리

# 1) 신뢰 전 — 미등록이 정상
$ claude plugin list
No plugins installed.

# 2) 신뢰 다이얼로그 수락 (대화형이면 그냥 수락, 헤드리스는 아래로 모사)
$ python3 -c "…; d['projects'][repo]['hasTrustDialogAccepted']=True; …"

# 3) 신뢰 후 — 설치 명령 0회
$ claude -p "List the exact names of every skill available to you that starts with 'superpowers'."
superpowers:brainstorming, superpowers:dispatching-parallel-agents,
superpowers:executing-plans, superpowers:finishing-a-development-branch,
superpowers:receiving-code-review, superpowers:requesting-code-review,
superpowers:subagent-driven-development, superpowers:systematic-debugging,
superpowers:test-driven-development, superpowers:using-git-worktrees,
superpowers:using-superpowers, superpowers:verification-before-completion,
superpowers:writing-plans, superpowers:writing-skills          → 14개

$ claude -p "Answer YES or NO only: does your context contain 'You have superpowers'?"
YES                                        # SessionStart 부트스트랩 주입 확인

$ claude plugin marketplace list
  > superpowers-vendored
    Source: Directory (/…/fresh2/.agents)  # 상대경로가 clone 자신의 경로로 해석됨
```

### 결론

- **리스크 R1(상대경로 해석)·R3(Codex `.agents/skills/` 스캔) 실측으로 닫힘.** R3 는 라운드 1 에서 3자 문서 근거뿐이었는데, 이제 Codex 바이너리가 렌더한 프롬프트가 직접 증거다.
- **설계 변경 불필요.** 커밋된 배선이 두 하네스 모두에서 의도대로 동작한다.
- 유일한 게이트는 **워크스페이스 신뢰 수락 1회** — 프로젝트가 제공하는 모든 설정에 공통으로 적용되는 정상 경계이고, 개발자가 저장소를 열 때 어차피 지나간다.

### 검토했으나 채택하지 않은 대안 — `@skills-dir`

`.claude/skills/superpowers/` 에 플러그인 루트를 두면 마켓플레이스·설치 단계 없이 제자리 로드된다(`superpowers@skills-dir / Status: √ loaded` 실측). 그러나:

- 이미 커밋된 경로가 **같은 조건(신뢰 수락)** 에서 동작하므로 이득이 없다.
- 벤더 트리 사본이 하나 더 늘고(351KB×2) drift 위험이 생긴다.
- 실제로 이름 충돌을 일으킨다: `× Not loaded — the name "superpowers" is already taken by an installed plugin (superpowers@superpowers-vendored)`.

심링크(`.claude/skills/superpowers → ../../.agents`)는 Linux 에서 정상 해석됨을 확인했으나, 이 저장소의 타겟인 **Windows** 에서 `core.symlinks` + Developer Mode 에 의존해 신뢰할 수 없다. → **현행 단일 벤더링 유지.**

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 기준 5의 *검증 수단*을 잘못 골랐다. "런타임에서 로드된다" 를 `plugin list` 로 확인하겠다고 했지만, 그 명령은 설치 *결과*만 보여줄 뿐 프로젝트 설정으로부터의 설치 *경로*는 못 본다. 설계 시점에 "이 기준을 어떤 명령이 실제로 반증할 수 있는가" 를 한 번 더 물었어야 했다. 또한 Codex CLI 부재를 비범위로 적어두고도 그것이 **요청 타겟 2개 중 1개의 실기 미검증**을 뜻한다는 점을 인수 기준에 반영하지 않았다.
- **구현 단계**: 검증 명령을 고르면서 `marketplace remove` 의 파괴적 부수효과를 예상하지 못해 커밋 대상 파일을 잠시 훼손했다(복원함). 되돌리기 명령을 실행하기 전에 그것이 무엇을 쓰는지 확인했어야 했다 — 결과적으로 유용한 발견이 됐지만 운이 좋았다.
- **검증 단계 (라운드 1)**: Codex 쪽 근거가 3자 문서뿐이었고(공식 `developers.openai.com/codex/skills` 가 이 환경 프록시에서 403), **타겟 하네스의 절반이 실기 미검증인 채 PASS 로 종결**됐다. → 라운드 2 에서 해소.
- **검증 단계 (라운드 2 의 교훈 — 가장 중요)**: 라운드 1 의 근본 실수는 **"이 명령이 무엇을 증명하는가" 를 묻지 않은 것**이다. 내가 `plugin install` 로 만든 상태를 `plugin list` 로 확인하면 증명되는 것은 *내가 방금 설치했다* 뿐이고, *커밋된 배선이 동작한다* 는 아니다. 배포물 검증의 기본값은 **격리된 설정 디렉토리 + fresh clone** 이어야 한다 — 현재 개발 환경은 검증 대상이 아니라 오염원이다.
  또한 "도구가 없어서 검증 못 함" 을 너무 쉽게 받아들였다. Codex CLI 는 npm 에 있었고(`@openai/codex@0.146.0`), 전역 설치 없이 vendor 바이너리를 직접 실행할 수 있었으며, `codex debug prompt-input` 이라는 **인증 없이 모델 프롬프트를 렌더하는 정확한 도구**가 존재했다. 미검증으로 넘기기 전에 검증 수단을 실제로 찾아봤어야 했다.

## 결론 / 다음 단계

**PASS (라운드 2)** — 인수 기준 **10/10 완전 충족**. 라운드 1 이 부분 충족으로 남긴 기준 5는 fresh clone 실측으로 승격됐고, 비범위였던 Codex 실기 노출도 기준 5-b 로 신규 검증했다.

**"쓸 수 있는가" 에 대한 답**: 두 하네스 모두 **커밋된 파일 + 워크스페이스 신뢰 수락 1회**로 superpowers 스킬 14개를 사용할 수 있다. 별도 설치 명령은 필요 없다.

- PHASES.md 표 승격 → 완료 (라운드 2 반영).
- 다음 주체: **—** (종결).
- 잔여: Windows SessionStart 훅 실기 확인 1건(스킬 로드 자체에는 영향 없음) + 제품 의도 부합.
- PR: 사용자가 명시적으로 요청하지 않아 생성하지 않았다.
