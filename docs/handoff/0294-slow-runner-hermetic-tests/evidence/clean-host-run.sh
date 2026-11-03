#!/usr/bin/env bash
# 빈 HOME·최소 환경변수로 vitest 를 돌린다(비교 기준).
# 사용: clean-host-run.sh <app 디렉토리> <출력.json> [vitest 인자...]
set -euo pipefail
APP=$(cd "$1" && pwd); OUT=$2; shift 2
ROOT=$(mktemp -d); mkdir -p "$ROOT/home" "$ROOT/tmp"
cd "$APP"
env -i PATH="$PATH" HOME="$ROOT/home" TMPDIR="$ROOT/tmp" LANG=C.UTF-8 \
  ./node_modules/.bin/vitest run --reporter=json --outputFile="$OUT" "$@" >/dev/null 2>&1 || true
find "$ROOT/home" -mindepth 1 | sed "s#$ROOT/home#~#"
