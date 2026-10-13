#!/usr/bin/env bash
# drift-check — 0260 이 정정한 사실·상태 표식·핸드오프 커버리지를 현재 문서와 대조한다.
#
#   drift-check.sh check          세 축 대조 — 차집합이 전부 비면 exit 0, 아니면 1, preflight 실패는 2
#   drift-check.sh sweep marks    현재 표식 사이트 산출 (file \t marker \t 정규화한 줄)  — 판정 입력용
#   drift-check.sh sweep handoffs 커버리지 분모 산출 (0193~0259 디렉토리 slug)
#
# TSV 계약 (TAB 구분, 빈 칸 금지 — 해당 없음은 `-`, `#` 로 시작하는 줄은 주석):
#   drift-assertions.tsv   id \t file \t must_not(ERE|-) \t must(ERE|-) \t anchor(path | path:ERE | -) \t note
#                          must_not 만 있는 행은 거부한다 — 0건 단언은 양성 단언과 짝이어야 한다(plan §10 EP-13).
#   status-marks.tsv       file \t marker \t 문맥 \t 근거   — 남아 있는 표식의 유지 판정.
#                          문맥 = 표식 앞뒤 최대 24글자(UTF-8 문자 단위). 줄 번호를 키로 쓰지 않으므로
#                          줄 이동에는 안정하고, 표식 근처 문장이 바뀌면 재판정을 요구한다.
#   handoff-coverage.tsv   handoff \t docs(;구분|-) \t 확인어(ERE|-) \t 비고
#                          docs 가 있으면 확인어도 있어야 하고, 확인어는 docs 중 하나에서 매치해야 한다.
#                          `-` 행은 그 핸드오프가 지우거나 옮긴 app/src 이름이 COVERAGE_BASE 범위 문서에 인용됐으면 거부한다.
#
# SCOPE 는 0192 doc-gate.sh `scope_files()` 와 같은 find 식·EXTRA_SCOPE 의 사본이다 — preflight 가 원본 두 줄의 존재를 대조한다.
# 완결성 주장의 관측값은 차집합이다. 정본: docs/handoff/0260-docs-handoff-resync/plan.md
set -uo pipefail
export LC_ALL=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$ROOT"

DOCGATE=docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh
SCOPE_EXPR="find docs -name '*.md' | grep -v '^docs/handoff/\\|^docs/archive/\\|^docs/etc/\\|^docs/spec/' | sort"
EXTRA_SCOPE=(app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md)
# 표식은 ERE 로 쓴다(`+` 이스케이프). 출력 라벨은 역슬래시를 뗀 값이다.
MARKERS=('⏳' '🚧' '미구현' '잔여' 'TBD' 'Phase 4\+')
CONTEXT=24
RANGE_LO=193; RANGE_HI=259
# `-` 행 인용 대조의 기준 커밋 — 0260 구현 전(plan READY 의 부모). 범위가 0193~0259 로 고정이라 상수다(D-014).
COVERAGE_BASE=6ee2d4db

die() { echo "drift-check: $*" >&2; exit 2; }

# 문맥 추출은 문자 단위여야 한다 — C 로캘의 `.` 는 바이트라 한글을 잘라 키가 깨진다.
UTF8_LOCALE=$(locale -a 2>/dev/null | grep -ixE 'c\.utf-?8|en_us\.utf-?8' | head -1)

scope_files() {
  find docs -name '*.md' | grep -v '^docs/handoff/\|^docs/archive/\|^docs/etc/\|^docs/spec/' | sort
  printf '%s\n' "${EXTRA_SCOPE[@]}"
}

rows() { grep -v '^#' "$HERE/$1" | grep -v '^[[:space:]]*$'; }

preflight() {
  local n f
  [ -n "$UTF8_LOCALE" ] || die "UTF-8 로캘이 없다(C.UTF-8 또는 en_US.UTF-8) — 표식 문맥을 문자 단위로 자를 수 없다"
  n=$(scope_files | wc -l); [ "$n" -gt 0 ] || die "SCOPE 가 비었다"
  for f in $(scope_files); do [ -e "$f" ] || die "SCOPE 경로 없음: $f"; done
  [ -e "$DOCGATE" ] || die "doc-gate 없음: $DOCGATE"
  grep -qF "$SCOPE_EXPR" "$DOCGATE" || die "SCOPE 식이 doc-gate.sh 원본과 다르다 — 사본을 맞춘다"
  grep -qxF "EXTRA_SCOPE=(${EXTRA_SCOPE[*]})" "$DOCGATE" || die "EXTRA_SCOPE 가 doc-gate.sh 원본과 다르다 — 사본을 맞춘다"
  [ "$(git cat-file -t "$COVERAGE_BASE" 2>/dev/null)" = commit ] || die "COVERAGE_BASE 커밋이 없다: $COVERAGE_BASE"
  for f in drift-assertions.tsv status-marks.tsv handoff-coverage.tsv; do
    [ -e "$HERE/$f" ] || die "TSV 없음: $f"
    [ "$(rows "$f" | wc -l)" -gt 0 ] || die "TSV 가 비었다: $f"
  done
}

# 표식 한 번 = 사이트 하나. 같은 줄에 두 번 나오면 두 사이트다. 문맥의 탭은 공백으로, 앞뒤 공백은 뗀다.
sweep_marks() {
  local f m label
  for f in $(scope_files); do
    for m in "${MARKERS[@]}"; do
      label=${m//\\/}
      { LC_ALL=$UTF8_LOCALE grep -oE -- ".{0,$CONTEXT}$m.{0,$CONTEXT}" "$f" || true; } \
        | tr '\t' ' ' | sed 's/^ *//; s/ *$//' \
        | awk -v f="$f" -v m="$label" 'NF {print f "\t" m "\t" $0}'
    done
  done | sort -u
}

sweep_handoffs() {
  local d n
  for d in docs/handoff/0[12][0-9][0-9]-*/; do
    n=$(basename "$d" | cut -c1-4); n=$((10#$n))
    if [ "$n" -ge "$RANGE_LO" ] && [ "$n" -le "$RANGE_HI" ]; then basename "$d"; fi
  done | sort
}

rc=0
fail() { rc=1; }
emit() {  # $1 라벨  $2 파일(실패 행)
  local n; n=$(wc -l < "$2")
  if [ "$n" -eq 0 ]; then printf '    %-14s 0\n' "$1:"
  else printf '    %-14s %s\n' "$1:" "$n"; sed 's/^/      /' "$2"; fail; fi
}

check_assertions() {
  local bad miss total=0 id file mn mu an note c p ere
  bad=$(mktemp); miss=$(mktemp)
  while IFS=$'\t' read -r id file mn mu an note; do
    total=$((total+1))
    if [ -z "$id" ] || [ -z "$file" ] || [ -z "$mn" ] || [ -z "$mu" ] || [ -z "$an" ] || [ -z "${note:-}" ]; then
      echo "형식오류(빈 칸): $id" >> "$bad"; continue; fi
    if [ "$mu" = "-" ]; then echo "형식오류(0건 단독): $id" >> "$bad"; continue; fi
    [ -e "$file" ] || { echo "$id: 파일 없음 $file" >> "$miss"; continue; }
    if [ "$mn" != "-" ]; then
      c=$(grep -cE -- "$mn" "$file"); [ "$c" -eq 0 ] || echo "$id: must_not ${c}건 — $file /$mn/" >> "$miss"
    fi
    c=$(grep -cE -- "$mu" "$file"); [ "$c" -ge 1 ] || echo "$id: must 0건 — $file /$mu/" >> "$miss"
    if [ "$an" != "-" ]; then
      p=${an%%:*}; ere=${an#*:}; [ "$ere" = "$an" ] && ere=""
      if [ ! -e "$p" ]; then echo "$id: anchor 없음 $p" >> "$miss"
      elif [ -n "$ere" ] && ! grep -qE -- "$ere" "$p" 2>/dev/null; then echo "$id: anchor 미매치 $p /$ere/" >> "$miss"; fi
    fi
  done < <(rows drift-assertions.tsv)
  echo "  단언 축 — ${total}행"
  emit "형식오류" "$bad"; emit "불일치" "$miss"
  rm -f "$bad" "$miss"
}

check_marks() {
  local out have bad miss stale
  out=$(mktemp); have=$(mktemp); bad=$(mktemp); miss=$(mktemp); stale=$(mktemp)
  sweep_marks > "$out"
  awk -F'\t' 'NF!=4 || $1=="" || $2=="" || $3=="" || $4=="" || $4=="-" {print "형식오류: "$0}' \
    <(rows status-marks.tsv) > "$bad"
  rows status-marks.tsv | cut -f1-3 | sort -u > "$have"
  comm -23 "$out" "$have" > "$miss"; comm -13 "$out" "$have" > "$stale"
  echo "  표식 축 — 산출 $(wc -l < "$out")사이트 / 유지 행 $(wc -l < "$have")"
  emit "형식오류" "$bad"; emit "미등재(표식)" "$miss"; emit "잔류(행)" "$stale"
  rm -f "$out" "$have" "$bad" "$miss" "$stale"
}

# `-` 행은 "문서 영향 없음" 주장이다. 그 핸드오프 커밋이 지우거나 옮긴 app/src 비테스트 파일의
# 이름(`stem`·stem.ts·stem.tsx)이 기준 커밋의 범위 문서에 인용돼 있었다면 주장이 거짓이다(D-014).
dash_citations() {  # $1 = slug → "이름 in 파일" 줄
  local c f stem
  for c in $(git log --format=%H --grep="Handoff: docs/handoff/$1/"); do
    git show --diff-filter=DR --name-status --format= "$c" -- app/src
  done | awk '$1 ~ /^[DR]/ {print $2}' | grep -v '\.test\.' | sort -u | while read -r f; do
    stem=$(basename "$f"); stem=${stem%.*}
    git grep -lw -e "\`$stem\`" -e "$stem\.ts" -e "$stem\.tsx" "$COVERAGE_BASE" -- \
      'docs/*.md' ':!docs/handoff' ':!docs/archive' ':!docs/etc' ':!docs/spec' "${EXTRA_SCOPE[@]}" 2>/dev/null \
      | sed "s|^$COVERAGE_BASE:|$stem in |"
  done
}

check_coverage() {
  local out have bad miss stale h docs kw note d ok cites
  out=$(mktemp); have=$(mktemp); bad=$(mktemp); miss=$(mktemp); stale=$(mktemp)
  sweep_handoffs > "$out"
  rows handoff-coverage.tsv | cut -f1 | sort -u > "$have"
  comm -23 "$out" "$have" > "$miss"; comm -13 "$out" "$have" > "$stale"
  while IFS=$'\t' read -r h docs kw note; do
    if [ -z "$h" ] || [ -z "$docs" ] || [ -z "$kw" ] || [ -z "${note:-}" ]; then echo "형식오류(빈 칸): $h" >> "$bad"; continue; fi
    if [ "$docs" = "-" ]; then
      [ "$kw" = "-" ] || echo "형식오류(docs 없이 확인어): $h" >> "$bad"
      cites=$(dash_citations "$h" | tr '\n' ';')
      [ -z "$cites" ] || echo "$h: '-' 인데 기준 커밋 인용 ${cites%;}" >> "$bad"
      continue; fi
    [ "$kw" != "-" ] || { echo "형식오류(docs 있는데 확인어 없음): $h" >> "$bad"; continue; }
    ok=0
    IFS=';' read -ra arr <<< "$docs"
    for d in "${arr[@]}"; do
      [ -e "$d" ] || { echo "$h: 반영 문서 없음 $d" >> "$bad"; continue; }
      grep -qE -- "$kw" "$d" && ok=1
    done
    [ "$ok" -eq 1 ] || echo "$h: 확인어 미매치 /$kw/ in $docs" >> "$bad"
  done < <(rows handoff-coverage.tsv)
  echo "  커버리지 축 — 디렉토리 $(wc -l < "$out") / 행 $(wc -l < "$have")"
  emit "형식·확인어" "$bad"; emit "결손(디렉토리)" "$miss"; emit "잔류(행)" "$stale"
  rm -f "$out" "$have" "$bad" "$miss" "$stale"
}

do_check() {
  preflight
  echo "drift-check"
  check_assertions; check_marks; check_coverage
  [ "$rc" -eq 0 ] && echo "  전부 공집합 — 통과" || echo "  차집합이 비지 않았다 — 실패"
  return "$rc"
}

case "${1:-}" in
  check) do_check;;
  sweep)
    preflight
    case "${2:-}" in
      marks) sweep_marks;; handoffs) sweep_handoffs;;
      *) die "sweep {marks|handoffs}";;
    esac;;
  *) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 2;;
esac
