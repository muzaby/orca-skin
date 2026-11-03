#!/usr/bin/env bash
# 저성능 러너 모사 — CPU 1코어에 워커 N개를 몰아 케이스당 실행 시간을 늘린다(측정 환경 대비 약 3배).
# 사용: slow-runner-run.sh <app 디렉토리> <출력.json> <워커 수(4|8)> [vitest 인자...]
# 한계: CPU 과부하만 모사한다. Windows 백신·디스크 지연은 재현하지 못한다(사람 실기 AC18).
set -euo pipefail
APP=$(cd "$1" && pwd); OUT=$2; WORKERS=$3; shift 3
ROOT=$(mktemp -d); mkdir -p "$ROOT/home" "$ROOT/tmp"
cd "$APP"
time env -i PATH="$PATH" HOME="$ROOT/home" TMPDIR="$ROOT/tmp" LANG=C.UTF-8 \
  taskset -c 0 ./node_modules/.bin/vitest run --maxWorkers="$WORKERS" --reporter=json --outputFile="$OUT" "$@" >/dev/null 2>&1 || true
