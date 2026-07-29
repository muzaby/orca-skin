# VENDOR — superpowers

이 디렉토리는 **외부 저장소를 그대로 복사(vendoring)한 트리**다. 여기 있는 파일은 직접 편집하지 않는다 — 수정이 필요하면 upstream 에 반영하거나 저장소 쪽(루트 `AGENTS.md`)에서 조정한다.

## 출처 / 핀

| 항목 | 값 |
|---|---|
| upstream | https://github.com/obra/superpowers |
| 라이선스 | MIT (`LICENSE` 원본 유지) |
| 태그 | `v6.2.0` |
| commit | `3dcbd5c4b48e02263fbf4a3c01e3fe4f81d584d9` |
| 벤더링 일자 | 2026-07-29 |
| 도입 핸드오프 | `docs/handoff/0156-superpowers-vendoring/` |

## 왜 `.agents/` 인가

두 타겟 하네스의 제약이 비대칭이다.

- **Codex**: 프로젝트 단위 플러그인 자동설치 수단이 없다. 저장소에 커밋된 **`$REPO_ROOT/.agents/skills/`** 를 네이티브로 스캔하는 경로가 유일하다. Codex 는 superpowers 의 SessionStart 훅을 실행하지 않는다 — 스킬을 네이티브로 노출하기 때문이다(upstream 이 `.codex-plugin/plugin.json` 에서 `"hooks": {}` 로 훅 탐색을 의도적으로 억제).
- **Claude Code**: `.claude/settings.json` 의 `extraKnownMarketplaces` 가 `directory` 소스(로컬 경로)를 지원한다. 이 트리는 `.claude-plugin/marketplace.json` 을 갖고 있고 플러그인 소스가 `"./"` (마켓플레이스 루트 == 플러그인 루트) 라서, **같은 트리 하나**가 마켓플레이스이자 플러그인으로 동작한다. SessionStart 훅(`hooks/`)까지 함께 로드된다.

플러그인 매니페스트의 경로 필드는 플러그인 루트 기준 `./` 로 시작해야 하고 `../` 로 트리 밖을 가리킬 수 없다. 그래서 심링크 없이 사본 1벌을 공유하려면 이 구조가 유일한 해법이다.

## 벤더링 범위

**포함** (upstream 과 바이트 동일, 아래 1건 제외):

```
.claude-plugin/plugin.json      # 그대로
.claude-plugin/marketplace.json # ★ name 만 superpowers-dev → superpowers-vendored
hooks/{hooks.json,run-hook.cmd,session-start}
skills/                          # 14 스킬 · 50 파일
LICENSE
```

`marketplace.json` 의 `name` 을 바꾸는 이유: upstream 개발용 마켓플레이스(`superpowers-dev`) 와 이름이 겹치면 사용자가 둘 다 등록했을 때 충돌한다.

**제외**:

| 대상 | 이유 |
|---|---|
| `hooks/hooks-cursor.json` | Cursor 전용 |
| `.cursor-plugin/` `.kimi-plugin/` `.opencode/` `.pi/` `.codex-plugin/` `.agents/plugins/` | 타 하네스 매니페스트. 타겟은 Claude Code + Codex |
| `AGENTS.md` `CLAUDE.md` `GEMINI.md` | **superpowers 저장소 기여 가이드라인**. 이 저장소 컨텍스트에 유입되면 안 된다 |
| `tests/` `docs/` `scripts/` `evals/` | upstream 개발 인프라 |
| `assets/` `README.md` `RELEASE-NOTES.md` `package.json` | 배포 메타 |

## 버전업 절차

```bash
# 1) 새 태그를 얕은 클론
git clone --depth 1 --branch <새태그> https://github.com/obra/superpowers.git /tmp/sp

# 2) 트리 교체 (제외 목록 반영)
rm -rf .agents/{skills,hooks,.claude-plugin,LICENSE}
git -C /tmp/sp archive <새태그> skills hooks .claude-plugin LICENSE | tar -x -C .agents
rm -f .agents/hooks/hooks-cursor.json

# 3) marketplace.json 의 name 재적용
#    "superpowers-dev" → "superpowers-vendored"

# 4) 검증
claude plugin validate .agents --strict
ls .agents/skills | wc -l          # 스킬 개수 확인

# 5) 본 문서의 태그·commit·일자 갱신
```

교체 후 Claude Code 세션에서는 캐시 사본을 갱신해야 한다:

```
/plugin marketplace update superpowers-vendored
```

스킬 목록이나 부트스트랩 내용이 바뀌었으면 루트 `AGENTS.md` 의 "superpowers 스킬 (벤더링)" 섹션 — 특히 스킬↔핸드오프 단계 매핑 — 도 함께 점검한다.
