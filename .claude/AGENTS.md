# .claude/ — 코딩 에이전트용 가이드

이 디렉토리는 **Claude Code 프로젝트 설정**만 담는다. Codex 는 이 디렉토리를 읽지 않는다 (Codex 용 배선은 `.agents/` — `.agents/AGENTS.md` 참조).

## 파일

| 파일 | 역할 |
|---|---|
| `settings.json` | 프로젝트 공유 설정. 현재 용도는 **벤더링된 superpowers 플러그인 배선 하나뿐** |
| `settings.local.json` | 개인 오버라이드. **git 추적 안 함** (루트 `.gitignore`). Claude Code 가 자동 생성한다 |

## settings.json 이 하는 일

```json
{
  "extraKnownMarketplaces": {
    "superpowers-vendored": { "source": { "source": "directory", "path": "./.agents" } }
  },
  "enabledPlugins": { "superpowers@superpowers-vendored": true }
}
```

- `directory` 소스 = 로컬 파일시스템 경로. `./.agents` 는 **저장소 main 체크아웃 기준**으로 해석되므로 worktree 에서도 같은 트리를 가리킨다.
- `.agents/.claude-plugin/marketplace.json` 의 플러그인 소스가 `"./"` 라서 마켓플레이스 루트 == 플러그인 루트다. 즉 `.agents/` 트리 하나가 마켓플레이스이자 플러그인이다.
- **폴더 신뢰(trust) 수락이 유일한 게이트다.** 수락하면 마켓플레이스가 자동 등록되고 스킬 14종 + SessionStart 부트스트랩이 바로 붙는다 — **별도 설치 명령은 필요 없다**(fresh clone 실측, 핸드오프 0156 verify 라운드 2). 대화형에서는 확인 프롬프트가 한 번 더 뜰 수 있다. 신뢰를 거절해도 저장소는 정상 동작한다 (스킬 없이 핸드오프 절차만 따르면 된다).
- 벤더 트리를 버전업한 뒤에는 캐시 사본 갱신이 필요하다: `/plugin marketplace update superpowers-vendored`.

## 배선이 살아있는지 확인하는 법

**현재 개발 환경에서 `claude plugin list` 를 보는 것은 검증이 아니다** — 과거에 직접 설치한 흔적(사용자 레벨 `known_marketplaces.json`, gitignore 대상 `settings.local.json`)이 섞여 있어 커밋된 배선이 동작한다는 증거가 되지 못한다. 반드시 **격리된 설정 디렉토리 + fresh clone** 으로 잰다:

```bash
git clone <repo> /tmp/fresh && cd /tmp/fresh
export CLAUDE_CONFIG_DIR=/tmp/ccfg          # ← 기존 설치가 섞이지 않게 격리
claude -p "List the exact names of every skill available to you that starts with 'superpowers'."
```

**함정**: 헤드리스 `claude -p` 는 신뢰 다이얼로그를 **절대 수락하지 않는다**. 신뢰를 세팅하지 않고 "로드 안 됨" 을 보면 배선 결함으로 오진하게 된다. 헤드리스로 재려면 `$CLAUDE_CONFIG_DIR/.claude.json` 의 `projects.<경로>.hasTrustDialogAccepted` 를 `true` 로 두고 다시 실행한다.

Codex 쪽은 `codex debug prompt-input` 이 모델이 실제로 보는 프롬프트를 렌더하므로, 그 `<skills_instructions>` 블록에 `superpowers:*` 가 있는지로 확인한다 (인증 불필요).

## 규칙

1. **여기에 훅을 추가하지 마라.** 이 저장소는 "기계적 강제(템플릿·CI·훅) 없음, 두 에이전트가 관례로 준수" 를 원칙으로 한다 (루트 `AGENTS.md` 커밋 프로토콜). `.agents/hooks/` 의 SessionStart 훅은 *저장소의 강제 장치*가 아니라 **플러그인이 자기 스킬을 소개하는 부트스트랩**이며 벤더 트리 소유다.
2. **`settings.local.json` 을 커밋하지 마라.** 개인 경로·토글이 들어간다.
3. 설정을 추가하기 전에 그것이 *두 에이전트 공통* 규칙인지 확인한다. 공통 규칙은 `AGENTS.md` 에 두는 편이 낫다 — Codex 도 읽기 때문이다.
