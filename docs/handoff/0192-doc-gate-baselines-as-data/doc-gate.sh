#!/usr/bin/env bash
# doc-gate — 문서가 인용한 코드 경로·심볼·시제를 저장소 실제와 대조한다.
#
#   doc-gate.sh sweep {symbols|paths|tense}   정의 — 산출을 표준출력으로 낸다
#   doc-gate.sh check                         대조 — baseline 과 양방향 차집합, exit 1 이면 어긋남
#   doc-gate.sh regen                         승계 — 기존 판정 보존, 신규는 미분류 표식
#   doc-gate.sh limits                        계측 한계의 크기 — 산문이 수치를 갖지 않게 한다 (exit 0 고정)
#
# baseline 계약 (전부 TAB 구분, 빈 칸 금지):
#   baselines/symbol-buckets.tsv    심볼 \t 버킷      버킷 ∈ 설계어휘|외부|역사|future|문서어휘
#   baselines/path-exceptions.tsv   축 \t 사이트 \t 경로 \t 사유    축 ∈ A|B|C
#   baselines/tense-sites.tsv       종류 \t 심볼 \t 사이트 \t 판정  판정 ∈ 참|정정됨
#
# 완결성 주장의 관측값은 차집합이다. 합계는 총계에 맞춰 배분한 값이라 반증할 수 없다.
# 정본: docs/handoff/0192-doc-gate-baselines-as-data/plan.md
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
BASE="$HERE/baselines"
cd "$ROOT"

CORPUS_PATHS=(app/src app/scripts app/package.json app/eslint.config.mjs app/electron.vite.config.ts .github/workflows)
OUT_OF_SCOPE_DOCS=(docs/PRD.md)
EXTRA_SCOPE=(app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md)
BUCKETS=(설계어휘 외부 역사 future 문서어휘)
VERDICTS=(참 정정됨)
# 시제 술어는 sweep_tense 와 limits 가 공유한다 — 복사하면 두 정의가 갈린다.
TENSE_PREDICATE='현행|현재|한다|이다|✅'
UNCLASSIFIED='UNCLASSIFIED'
UNJUDGED='UNJUDGED'

die() { echo "doc-gate: $*" >&2; exit 2; }

scope_files() {
  find docs -name '*.md' | grep -v '^docs/handoff/\|^docs/archive/\|^docs/etc/\|^docs/spec/' | sort
  printf '%s\n' "${EXTRA_SCOPE[@]}"
}

# 판정 지점 12 — SCOPE·CORPUS·baseline 이 비면 빈 산출이 "전부 통과" 로 읽힌다.
preflight() {
  local n f
  n=$(scope_files | wc -l)
  [ "$n" -gt 0 ] || die "SCOPE 가 비었다"
  for f in $(scope_files); do [ -e "$f" ] || die "SCOPE 경로 없음: $f"; done
  for f in "${CORPUS_PATHS[@]}"; do [ -e "$f" ] || die "CORPUS 경로 없음: $f"; done
  for f in "${OUT_OF_SCOPE_DOCS[@]}"; do [ -e "$f" ] || die "비범위 문서 없음: $f"; done
}

is_out_of_scope_site() {  # $1 = file:line
  local f=${1%:*} d
  for d in "${OUT_OF_SCOPE_DOCS[@]}"; do [ "$f" = "$d" ] && return 0; done
  return 1
}

# ---- 심볼 축 -------------------------------------------------------------
# pass 1 추출 4축 → (심볼, 사이트).  pass 2 고유 심볼마다 실재 판정 1회.  pass 3 join.
# 추출은 limits 의 `bare-camelcase` 차집합도 쓰므로 함수로 둔다 — 복사하면 두 정의가 갈린다.
extract_pairs() {
  for f in $(scope_files); do
    { grep -oEn '`[A-Za-z_][A-Za-z0-9_]*`' "$f" | sed 's/`//g'
      grep -oEn '`[a-z][a-z0-9]*(-[a-z0-9]+)+`' "$f" | sed 's/`//g'
      grep -oEn '\*\*[A-Za-z_][A-Za-z0-9_]*\*\*' "$f" | sed 's/\*\*//g'
      grep -oEn '`[A-Za-z_][A-Za-z0-9_]*\(' "$f" | sed 's/`//g;s/(//'
    } | while IFS=: read -r ln s; do
      case "$s" in *[A-Z]*|*-*) printf '%s\t%s:%s\n' "$s" "$f" "$ln";; esac
    done
  done | sort -u
}

sweep_symbols() {
  local pairs verdict
  pairs=$(mktemp); verdict=$(mktemp)
  extract_pairs > "$pairs"
  cut -f1 "$pairs" | sort -u | while read -r s; do
    # [D5] `-wF` 는 `-` 를 비단어 문자로 보므로 `resize-handle` 이 `app-frame-resize-handle`
    # 안에서 매칭됐다(0191 r5 의 `-F`→`-wF` 와 같은 형태). 하이픈을 식별자 문자로 세는 경계로 올린다.
    bnd="(^|[^A-Za-z0-9_-])$s([^A-Za-z0-9_-]|\$)"
    hits=$(grep -rnE "$bnd" "${CORPUS_PATHS[@]}" 2>/dev/null | grep -v -e '\.test\.' -e '\.md:')
    if [ -z "$hits" ]; then printf '%s\tABSENT\n' "$s"; continue; fi
    # 실재는 코드 줄에서만 센다. 줄머리 주석을 버리고, 남은 줄에서 후행 `//` 주석을 지운다.
    # `://` (URL) 은 주석이 아니므로 앞 문자가 `:` 가 아닐 때만 자른다.
    code=$(printf '%s\n' "$hits" | sed 's/^[^:]*:[0-9]*://' \
           | grep -vE '^[[:space:]]*(//|\*|/\*|#)' \
           | sed 's@\([^:]\)//.*@\1@')
    # STRIP_HASH 는 limits 전용 변형이다 — check/sweep 의 판정은 바꾸지 않는다.
    [ -n "${STRIP_HASH:-}" ] && code=$(printf '%s\n' "$code" | sed 's@\([^:]\)#.*@\1@')
    code=$(printf '%s\n' "$code" | grep -E "$bnd")
    [ -z "$code" ] && printf '%s\tCOMMENT_ONLY\n' "$s"
  done | sort -u > "$verdict"
  join -t"$(printf '\t')" -1 1 -2 1 "$verdict" "$pairs" \
    | awk -F'\t' '{print $2"\t"$1"\t"$3}' | sort -u
  rm -f "$pairs" "$verdict"
}

# ---- 경로 축 -------------------------------------------------------------
sweep_paths() {
  local real base
  real=$(mktemp); base=$(mktemp)
  find app/src \( -name '*.ts' -o -name '*.tsx' \) | sed 's|^|/|' | sort > "$real"
  { find app/src \( -name '*.ts' -o -name '*.tsx' \) | xargs -n1 basename
    basename -a app/*.ts; } | sort -u > "$base"
  for f in $(scope_files); do
    grep -oEn '(app/)?src/(main|renderer|shared|preload)/[A-Za-z0-9_./@-]*\.(ts|tsx|md|css|html)' "$f" |
    while IFS=: read -r ln p; do q=${p#app/}; [ -e "app/$q" ] || printf 'A\t%s:%s\t%s\n' "$f" "$ln" "$p"; done
  done
  for f in $(scope_files); do
    grep -oEn '`[^`]*`' "$f" | sed 's/`//g' |
    grep -E ':[A-Za-z0-9_./@{}-]+/[A-Za-z0-9_.@{}-]+\.(ts|tsx)$' |
    while IFS=: read -r ln p; do
      grep -qE "(^|/)${p#app/src/}\$" "$real" || printf 'B\t%s:%s\t%s\n' "$f" "$ln" "$p"
    done
  done
  for f in $(scope_files); do
    grep -oEn '`[A-Za-z0-9_.@-]+\.(ts|tsx)`' "$f" | sed 's/`//g' |
    while IFS=: read -r ln p; do
      case "$p" in */*|.*) continue;; esac
      grep -qxF "$p" "$base" || printf 'C\t%s:%s\t%s\n' "$f" "$ln" "$p"
    done
  done
  rm -f "$real" "$base"
}

# ---- 시제 축 -------------------------------------------------------------
# 버킷은 "심볼이 무엇인가", 시제는 "이 사이트의 단언이 참인가" 를 묻는다.
# `\b` 를 쓰지 않는다 — 한글 뒤에 word boundary 가 서지 않아 술어가 통째로 죽는다.
sweep_tense() {
  { [ -n "${SYMBOL_CACHE:-}" ] && cat "$SYMBOL_CACHE" || sweep_symbols; } \
  | while IFS=$'\t' read -r kind sym site; do
    f=${site%:*}; ln=${site##*:}
    sed -n "${ln}p" "$f" 2>/dev/null | grep -qE "$TENSE_PREDICATE" \
      && printf '%s\t%s\t%s\n' "$kind" "$sym" "$site"
  done
}

# ---- 대조 ---------------------------------------------------------------
rc=0
fail() { rc=1; }

emit_diff() {  # $1 라벨  $2 파일
  local n; n=$(wc -l < "$2")
  if [ "$n" -eq 0 ]; then printf '    %-10s 0\n' "$1:"
  else printf '    %-10s %s\n' "$1:" "$n"; sed 's/^/      /' "$2"; fail; fi
}

check_symbols() {
  local out inscope required have miss stale bad
  out=$(mktemp); inscope=$(mktemp); required=$(mktemp)
  have=$(mktemp); miss=$(mktemp); stale=$(mktemp); bad=$(mktemp)
  { [ -n "${SYMBOL_CACHE:-}" ] && cat "$SYMBOL_CACHE" || sweep_symbols; } > "$out"
  while IFS=$'\t' read -r kind sym site; do
    is_out_of_scope_site "$site" || printf '%s\t%s\t%s\n' "$kind" "$sym" "$site"
  done < "$out" > "$inscope"
  cut -f2 "$inscope" | sort -u > "$required"
  echo "  심볼 축 — 산출 $(wc -l < "$out")사이트 / $(cut -f2 "$out" | sort -u | wc -l)심볼" \
       "(범위 내 $(wc -l < "$inscope")사이트 · 비범위 $(( $(wc -l < "$out") - $(wc -l < "$inscope") ))사이트)"
  awk -F'\t' 'NF!=2 || $1=="" || $2=="" {print "형식 오류: "$0}' "$BASE/symbol-buckets.tsv" > "$bad"
  awk -F'\t' -v ok="$(printf '%s|' "${BUCKETS[@]}")$UNCLASSIFIED" \
      'NF==2 && $2!~"^("ok")$" {print "허용 밖 버킷: "$0}' "$BASE/symbol-buckets.tsv" >> "$bad"
  grep -cP "\t$UNCLASSIFIED$" "$BASE/symbol-buckets.tsv" | grep -qv '^0$' \
    && grep -P "\t$UNCLASSIFIED$" "$BASE/symbol-buckets.tsv" | sed 's/^/미분류 표식: /' >> "$bad"
  emit_diff "형식오류" "$bad"
  cut -f1 "$BASE/symbol-buckets.tsv" | sort -u > "$have"
  comm -23 "$required" "$have" > "$stale.m"
  join -t"$(printf '\t')" -1 1 -2 1 "$stale.m" \
       <(awk -F'\t' '{print $2"\t"$3}' "$inscope" | sort -k1,1) > "$miss" || true
  comm -13 "$required" "$have" > "$stale"
  emit_diff "미분류(사이트)" "$miss"
  emit_diff "잔류(심볼)" "$stale"
  # 버킷별 사이트 수 — 계산값이다. 어떤 산문도 이 수를 복제하지 않는다.
  echo "    버킷별 사이트:"
  join -t"$(printf '\t')" -1 1 -2 1 <(sort -k1,1 "$BASE/symbol-buckets.tsv") \
       <(awk -F'\t' '{print $2"\t"$1"\t"$3}' "$inscope" | sort -k1,1) \
    | awk -F'\t' '{c[$2]++} END {for (b in c) printf "      %s %d\n", b, c[b]}' | sort
  printf '      비범위 %d\n' "$(( $(wc -l < "$out") - $(wc -l < "$inscope") ))"
  rm -f "$out" "$inscope" "$required" "$have" "$miss" "$stale" "$stale.m" "$bad"
}

check_paths() {
  local out have miss stale bad
  out=$(mktemp); have=$(mktemp); miss=$(mktemp); stale=$(mktemp); bad=$(mktemp)
  sweep_paths | sort -u > "$out"
  echo "  경로 축 — 산출 $(wc -l < "$out")줄"
  awk -F'\t' 'NF!=4 || $1=="" || $2=="" || $3=="" || $4=="" {print "형식 오류: "$0}
              NF==4 && $1!~/^[ABC]$/ {print "허용 밖 축: "$0}' "$BASE/path-exceptions.tsv" > "$bad"
  emit_diff "형식오류" "$bad"
  cut -f1-3 "$BASE/path-exceptions.tsv" | sort -u > "$have"
  comm -23 "$out" "$have" > "$miss"; comm -13 "$out" "$have" > "$stale"
  emit_diff "미등재" "$miss"
  emit_diff "잔류" "$stale"
  rm -f "$out" "$have" "$miss" "$stale" "$bad"
}

check_tense() {
  local out have miss stale bad
  out=$(mktemp); have=$(mktemp); miss=$(mktemp); stale=$(mktemp); bad=$(mktemp)
  sweep_tense | sort -u > "$out"
  echo "  시제 축 — 산출 $(wc -l < "$out")사이트"
  awk -F'\t' -v ok="$(printf '%s|' "${VERDICTS[@]}")$UNJUDGED" \
      'NF!=4 || $1=="" || $2=="" || $3=="" || $4=="" {print "형식 오류: "$0; next}
       $4!~"^("ok")$" {print "허용 밖 판정: "$0}' "$BASE/tense-sites.tsv" > "$bad"
  grep -P "\t$UNJUDGED$" "$BASE/tense-sites.tsv" | sed 's/^/미판정 표식: /' >> "$bad"
  emit_diff "형식오류" "$bad"
  cut -f1-3 "$BASE/tense-sites.tsv" | sort -u > "$have"
  comm -23 "$out" "$have" > "$miss"; comm -13 "$out" "$have" > "$stale"
  emit_diff "미판정" "$miss"
  emit_diff "잔류" "$stale"
  rm -f "$out" "$have" "$miss" "$stale" "$bad"
}

do_check() {
  preflight
  local f
  for f in symbol-buckets path-exceptions tense-sites; do
    [ -e "$BASE/$f.tsv" ] || die "baseline 없음: baselines/$f.tsv"
  done
  echo "doc-gate check"
  SYMBOL_CACHE=$(mktemp); export SYMBOL_CACHE
  sweep_symbols > "$SYMBOL_CACHE"
  check_symbols; check_paths; check_tense
  rm -f "$SYMBOL_CACHE"; unset SYMBOL_CACHE
  [ "$rc" -eq 0 ] && echo "  전부 공집합 — 통과" || echo "  차집합이 비지 않았다 — 실패"
  return "$rc"
}

# ---- 재생성 -------------------------------------------------------------
# 기존 판정을 보존하고 신규는 미분류 표식으로 적는다 — 조용한 통과 경로를 만들지 않는다.
do_regen() {
  preflight
  local out inscope tmp
  out=$(mktemp); inscope=$(mktemp); tmp=$(mktemp)
  sweep_symbols > "$out"
  while IFS=$'\t' read -r kind sym site; do
    is_out_of_scope_site "$site" || printf '%s\n' "$sym"
  done < "$out" | sort -u | while read -r s; do
    printf '%s\t%s\n' "$s" "$(grep -P "^\Q$s\E\t" "$BASE/symbol-buckets.tsv" 2>/dev/null | cut -f2 | head -1 || true)"
  done | awk -F'\t' -v u="$UNCLASSIFIED" '{print $1"\t"($2==""?u:$2)}' > "$tmp"
  mv "$tmp" "$BASE/symbol-buckets.tsv"

  tmp=$(mktemp)
  sweep_paths | sort -u | while IFS=$'\t' read -r ax site p; do
    prev=$(grep -P "^\Q$ax\E\t\Q$site\E\t\Q$p\E\t" "$BASE/path-exceptions.tsv" 2>/dev/null | cut -f4 | head -1 || true)
    printf '%s\t%s\t%s\t%s\n' "$ax" "$site" "$p" "${prev:-$UNCLASSIFIED}"
  done > "$tmp"
  mv "$tmp" "$BASE/path-exceptions.tsv"

  tmp=$(mktemp)
  sweep_tense | sort -u | while IFS=$'\t' read -r kind sym site; do
    prev=$(grep -P "^\Q$kind\E\t\Q$sym\E\t\Q$site\E\t" "$BASE/tense-sites.tsv" 2>/dev/null | cut -f4 | head -1 || true)
    printf '%s\t%s\t%s\t%s\n' "$kind" "$sym" "$site" "${prev:-$UNJUDGED}"
  done > "$tmp"
  mv "$tmp" "$BASE/tense-sites.tsv"
  rm -f "$out" "$inscope"
  echo "regen 완료 — 신규 항목은 $UNCLASSIFIED/$UNJUDGED 다. check 가 통과하지 않는다."
}

# ---- 계측 한계의 크기 ----------------------------------------------------
# 이 서브커맨드가 한계 수치의 정본이다 — plan.md §19 는 값을 적지 않고 라벨을 가리킨다.
# 손으로 적은 수치는 재현되지 않는다(0192 verify r2 E1: 등록부 136 ↔ 실측 137).
# 한계 크기의 변동은 결함이 아니라 코퍼스 이동이므로 게이트로 두지 않는다 — exit 0 고정.
emit_limit() { printf '  %-22s %s\n' "$1" "$2"; }

do_limits() {
  preflight
  local sym hash camel extracted diffset paths real sites judged n top esc q
  sym=$(mktemp); hash=$(mktemp); camel=$(mktemp); extracted=$(mktemp)
  diffset=$(mktemp); paths=$(mktemp); real=$(mktemp)
  ( unset SYMBOL_CACHE; sweep_symbols ) | sort -u > "$sym"
  echo "doc-gate limits"

  # 시제 술어의 적용 단위 — 술어가 없어 판정 대상 밖인 고유 사이트.
  sites=$(cut -f3 "$sym" | sort -u | wc -l)
  judged=$(cut -f3 "$sym" | sort -u | while IFS= read -r site; do
             f=${site%:*}; ln=${site##*:}
             sed -n "${ln}p" "$f" 2>/dev/null | grep -qE "$TENSE_PREDICATE" && echo x
           done | wc -l)
  emit_limit tense-out-of-judgment "$(( sites - judged ))  (고유 사이트 $sites · 술어 있는 사이트 $judged)"

  # 추출 / 맨 CamelCase 산문 — 추출 4축이 이미 잡는 심볼을 뺀 차집합이다.
  extract_pairs | cut -f1 | sort -u > "$extracted"
  for f in $(scope_files); do sed 's/`[^`]*`//g; s/\*\*[^*]*\*\*//g' "$f"; done \
    | grep -oE '(^|[^A-Za-z0-9_/`-])[A-Z][a-z0-9]+([A-Z][A-Za-z0-9]*)+' \
    | grep -oE '[A-Z][a-z0-9]+([A-Z][A-Za-z0-9]*)+' | sort > "$camel"
  sort -u "$camel" | comm -23 - "$extracted" > "$diffset"
  n=$(wc -l < "$diffset")
  top=$(grep -xFf "$diffset" "$camel" 2>/dev/null | sort | uniq -c | sort -rn | head -3 \
        | awk '{printf "%s %s · ", $2, $1}' | sed 's/ · $//')
  emit_limit bare-camelcase "$n  (상위 ${top:-없음})"

  # 경로 축 / 비-ts 확장자 — 접미사 해석으로도 실재하지 않는 인용.
  find docs app -name node_modules -prune -o \
       \( -name '*.md' -o -name '*.sql' -o -name '*.json' \) -print 2>/dev/null \
    | sed 's|^|/|' | sort > "$real"
  for f in $(scope_files); do
    grep -oEn '`[A-Za-z0-9_./@{}-]+\.(md|sql|json)`' "$f" | sed 's/`//g' |
    while IFS=: read -r ln p; do
      q=${p#app/}; q=${q#./}
      esc=$(printf '%s' "$q" | sed 's/[][\\.^$*+?(){}|]/\\&/g')
      grep -qE "(^|/)${esc}\$" "$real" || printf '%s:%s\t%s\n' "$f" "$ln" "$p"
    done
  done | sort -u > "$paths"
  emit_limit non-ts-paths "$(wc -l < "$paths")"

  # 실재 판정 / 후행 `#` 주석 — 넓혔을 때 새로 부재/주석이 되는 사이트의 차집합.
  ( unset SYMBOL_CACHE; STRIP_HASH=1 sweep_symbols ) | sort -u > "$hash"
  emit_limit trailing-hash-harvest "$(comm -13 "$sym" "$hash" | wc -l)"

  emit_limit layer-axis "계측불가  (주장한 레이어에 있는가 — 정규식화하면 오탐이 지배한다)"
  emit_limit prose-veracity "계측불가  (이름은 맞고 설명이 틀린 경우 — grep 이 판정할 수 없다)"

  rm -f "$sym" "$hash" "$camel" "$extracted" "$diffset" "$paths" "$real"
  return 0
}

case "${1:-}" in
  sweep)
    preflight
    case "${2:-}" in
      symbols) sweep_symbols;; paths) sweep_paths | sort -u;; tense) sweep_tense | sort -u;;
      *) die "sweep {symbols|paths|tense}";;
    esac;;
  check) do_check;;
  regen) do_regen;;
  limits) do_limits;;
  *) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 2;;
esac
