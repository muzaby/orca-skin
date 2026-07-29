# .agents/ — 코딩 에이전트용 가이드

**벤더링 트리다. 이 디렉토리의 파일을 직접 편집하지 마라.**

[obra/superpowers](https://github.com/obra/superpowers) `v6.2.0` 를 그대로 복사한 것이다. 출처·핀·제외 목록·버전업 절차는 [`VENDOR.md`](VENDOR.md) 가 정본.

## 무엇이 여기 있나

| 경로 | 역할 |
|---|---|
| `skills/` | superpowers 스킬 14종. **Codex 가 `$REPO_ROOT/.agents/skills/` 로 네이티브 스캔하는 경로** |
| `hooks/` | Claude Code SessionStart 부트스트랩 (`using-superpowers` 를 세션 시작 시 주입). Codex 는 이 훅을 실행하지 않는다 |
| `.claude-plugin/` | Claude Code 플러그인 + 로컬 마켓플레이스 매니페스트. `.claude/settings.json` 이 `directory` 소스로 이 트리를 가리킨다 |
| `LICENSE` | MIT — 저작권 고지 유지 의무 |

## 규칙

1. **편집 금지.** 스킬 본문을 고치면 upstream 버전업 시 diff 가 깨진다. 개선이 필요하면 upstream 에 PR 하거나, 이 저장소 쪽 조정은 루트 `AGENTS.md` 의 "superpowers 스킬 (벤더링)" 섹션에서 한다.
2. **유일한 로컬 수정은 `marketplace.json` 의 `name`** (`superpowers-dev` → `superpowers-vendored`). 버전업 때마다 재적용한다 (`VENDOR.md` 절차 4단계).
3. **워크플로 상하관계**: 이 저장소에서는 **핸드오프 절차가 상위**, superpowers 스킬은 그 안에서 쓰는 도구다. 충돌 시 저장소 규칙 우선 — 정본은 루트 [`../AGENTS.md`](../AGENTS.md) "superpowers 스킬 (벤더링)" 섹션.
4. 여기에 이 저장소 고유의 스킬을 추가하지 마라. 벤더 트리와 자체 산출물이 섞이면 버전업이 불가능해진다.
