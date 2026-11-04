#!/usr/bin/env bash
# 합성 "사내 호스트"에서 vitest 를 돌린다 — Claude/OpenCode/Git 설정과 환경변수가 채워진 HOME.
# 사용: hostile-host-run.sh <app 디렉토리> <출력.json> [vitest 인자...]
# 리눅스 전용(env -i). 결과는 clean-host-run.sh 결과와 newfails.mjs 로 비교한다.
set -euo pipefail
APP=$(cd "$1" && pwd); OUT=$2; shift 2
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(mktemp -d); H=$ROOT/home; mkdir -p "$ROOT/tmp"
bash "$HERE/make-hostile-home.sh" "$H" "$APP" >/dev/null
cat > "$H/.gitconfig" <<'J'
[user]
	name = Corp User
	email = user@corp.example
[commit]
	gpgsign = true
[gpg]
	program = /nonexistent/gpg
[init]
	defaultBranch = develop
J
echo '{"model":"corp/corp-model","mcp":{"corp-env-mcp":{"type":"local","command":["corp-env"]}}}' > "$H/corp-opencode.json"
mkdir -p "$ROOT/oc-dir" "$ROOT/claude-corp"
echo '{"mcp":{"dir-mcp":{"type":"local","command":["x"]}}}' > "$ROOT/oc-dir/opencode.json"
echo '{"model":"opus"}' > "$ROOT/claude-corp/settings.json"
cd "$APP"
env -i PATH="$PATH" HOME="$H" TMPDIR="$ROOT/tmp" LANG=C.UTF-8 \
  ANTHROPIC_MODEL=corp-model CLAUDE_CODE_DISABLE_1M_CONTEXT=1 CLAUDE_CONFIG_DIR="$ROOT/claude-corp" \
  OPENCODE_CONFIG="$H/corp-opencode.json" OPENCODE_CONFIG_DIR="$ROOT/oc-dir" OPENCODE_DISABLE_PROJECT_CONFIG=true \
  ANTHROPIC_API_KEY=sk-ant-corp ANTHROPIC_BASE_URL=https://llm.corp.example \
  HTTPS_PROXY=http://proxy.corp.example:8080 NO_PROXY=localhost,127.0.0.1 \
  ${VITEST_PREFIX:-} ./node_modules/.bin/vitest run --reporter=json --outputFile="$OUT" "$@" >/dev/null 2>&1 || true
# HOME 아래에 실행 중 새로 생긴 파일(실제 홈 쓰기) — 비어 있어야 한다.
find "$H" -newer "$H/corp-opencode.json" -mindepth 1 | sed "s#$H#~#"
