# .claude/ — 코딩 에이전트용 가이드

이 디렉토리는 **Claude Code 프로젝트 설정**만 담는다. Codex 는 이 디렉토리를 읽지 않는다 (Codex 용 배선은 `.agents/` — `.agents/AGENTS.md` 참조).

## 파일

| 파일 | 역할 |
|---|---|
| `settings.json` | 프로젝트 공유 설정. 현재 용도는 **벤더링된 superpowers 플러그인 배선 하나뿐** |
| `skills` | `../.agents/skills` 심링크. marketplace 가 아직 사용자 영역에 등록되지 않은 첫 실행에서도 14개 스킬을 프로젝트 스킬로 노출하는 무설치 fallback |
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
- 폴더 신뢰(trust)를 수락하면 마켓플레이스 등록 → 플러그인 설치를 **프롬프트**한다. 완전 무동의 자동설치는 Claude Code 의 신뢰 경계상 불가능하며, 이게 정상 동작이다. 거절해도 저장소는 정상 동작한다 (스킬 없이 핸드오프 절차만 따르면 된다).
- 플러그인 설치 전에도 `skills` 심링크를 통해 스킬 본문은 즉시 사용할 수 있다. 이 fallback 은 플러그인 훅을 로드하지 않으므로 SessionStart 부트스트랩까지 쓰려면 위 설치 프롬프트를 수락해야 한다.
- 벤더 트리를 버전업한 뒤에는 캐시 사본 갱신이 필요하다: `/plugin marketplace update superpowers-vendored`.

## 규칙

1. **여기에 훅을 추가하지 마라.** 이 저장소는 "기계적 강제(템플릿·CI·훅) 없음, 두 에이전트가 관례로 준수" 를 원칙으로 한다 (루트 `AGENTS.md` 커밋 프로토콜). `.agents/hooks/` 의 SessionStart 훅은 *저장소의 강제 장치*가 아니라 **플러그인이 자기 스킬을 소개하는 부트스트랩**이며 벤더 트리 소유다.
2. **`settings.local.json` 을 커밋하지 마라.** 개인 경로·토글이 들어간다.
3. 설정을 추가하기 전에 그것이 *두 에이전트 공통* 규칙인지 확인한다. 공통 규칙은 `AGENTS.md` 에 두는 편이 낫다 — Codex 도 읽기 때문이다.
4. `skills` 심링크를 실제 디렉토리나 사본으로 바꾸지 마라. 단일 벤더 트리 원칙과 upstream 바이트 동일성을 지키기 위한 Claude Code 전용 진입점이다.
