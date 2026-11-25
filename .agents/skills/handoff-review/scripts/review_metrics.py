#!/usr/bin/env python3
"""review_metrics.py — review가 반복 실패의 추세를 실제 verify 이력으로 설명하게 하는 집계.

판정은 하지 않는다. review가 숫자를 라운드 기록(§7)에 옮기고 원문을 대조해 원인을 판단한다.

1. 실제 verify 회차 — 커밋 trailer(`Handoff:` · `Status:` · `Verified-By:` · `Next-Action:`)를 커밋 순서로 읽는다.
   `Handoff:`가 여럿인 커밋은 그 handoff마다 반영한다. 부모와 트리가 모두 같은 커밋은 같은 변경이 두 번
   들어온 것(병합 양쪽의 재커밋)이라 하나로 센다 — 트리만 같고 부모가 다르면 같은 코드를 다시 검증한 별개 커밋이다.
   한 handoff의 verify 커밋은 직전 verify 커밋 뒤에 그 handoff의 설계·구현 커밋이 있었을 때만 새 회차다.
   그 사이에 설계·구현이 없으면(판정 정정 · 원장 재구성 · 같은 턴의 추가 커밋) 같은 회차를 갱신한다.
   회차의 판정은 마지막 커밋에서 읽는다 — `claude:pass`는 PASS, `claude:fail`은 제목의 RETURN_TO_PLAN·CLOSED·FAIL,
   제목에 없으면 `Next-Action`이 구현자면 FAIL, 아니면 `FAIL·RTP`. `Verified-By`가 비었거나 `pending`이면 판정 불명이다.
   verify.md의 명시적 회차(`# rN 검증`·`# 라운드 N`·`# verify N회째` 등의 최댓값)와 복원한 회차 수가 다르면
   그 handoff를 `복원 불가`로 근거와 함께 내고, 구간 FAIL 비율에서 판정 불명과 함께 뺀다.
2. review 구간 — `regression-coverage.md`의 `# Round N —` · `# review round N —` 절이 처음 들어온 커밋을
   커밋 순서(`git rev-list --topo-order`)로 놓고 그 사이를 구간으로 한다. 같은 날의 여러 review와 같은 번호의
   두 절(예: round 24)도 서로 다른 구간이다. 각 verify 회차는 첫 커밋이 속한 구간에 한 번만 배정된다.
   FAIL 비율의 분자·분모에서 판정 불명은 뺀다.
3. 발견 원장 F(N) — `docs/handoff/*/verify.md`의 `### 발견 원장 — verify N[ 정정(round K)]` 표.
   F = 그 회차 판정 시점에 `이번 결과 = 열림`인 `BLOCKING`·`PLAN_GAP` 고유 ID 수.
   같은 회차는 가장 큰 K가 유효 값이고, 정정 전 값은 이력으로 함께 낸다.
   회차 사이 ID 전이: 신규 · 계속 열림 · 재개(verify가 종결을 확인한 뒤 다시 열림) · 실제 종결 · 비차단으로 분류 이동.
   구현자의 `closed 보고`는 verify의 종결 확인과 따로 센다.
   원장이 없는 verify.md·형식 오류·충돌 중복·회차 누락은 0건으로 세지 않고 그 사실을 낸다. 직전 회차에 열린 ID가
   종결·분류 이동 기록 없이 사라졌거나 최신 정정 원장이 잘못됐으면 그 회차 F는 `판정 불가`다. 직전 상태 값은
   직전 원장과 대조한다 — `—`는 직전에 열리지 않음, `열림`·`closed 보고`(구현자가 닫았다고 보고)는 직전에 열림,
   `닫힘`은 앞 원장에서 verify가 종결을 확인함(이번에 다시 열리면 재개).
4. 지침 크기 — 핵심 지침 5개의 바이트 합과 사례 인용 수. `--size-at <rev>`에서 잘못된 ref는 실패,
   그 시점에 파일이 없었던 경우는 `없음`으로 따로 낸다.

사용:
  python3 .agents/skills/handoff-review/scripts/review_metrics.py [--last N] [--handoff NNNN] [--size-at REV ...]
종료 코드: 0 정상 · 1 원장 형식 오류·충돌이 있음(집계는 출력) · 2 입력 오류(잘못된 ref 등).
"""
import argparse
import glob
import re
import subprocess
import sys
from collections import defaultdict

CORE = [
    ".agents/skills/handoff-plan/SKILL.md",
    ".agents/skills/handoff-impl/SKILL.md",
    ".agents/skills/handoff-verify/SKILL.md",
    ".agents/skills/handoff-review/SKILL.md",
    "docs/handoff/AGENTS.md",
]
COVERAGE = ".agents/skills/handoff-review/references/regression-coverage.md"
CITE = re.compile(r"0\d{3} r\d+|\(0\d{3}[ )·:]")
ROUND = re.compile(r"^# (?:review round|Round) (\d+) — (.*)$", re.M)
LEDGER = re.compile(r"^### 발견 원장 — verify (\d+)(?: 정정\(round (\d+)\))?[ \t]*$", re.M)
HEADER = ["ID", "disposition", "직전 상태", "이번 결과", "직전 기록", "증거"]
BLOCKING = ("BLOCKING", "PLAN_GAP")  # F에 드는 disposition(정확히 일치)
DISPOSITION = re.compile(r"^(?:BLOCKING|PLAN_GAP|NON_BLOCKING|경계|NEXT_HANDOFF(?:\([^()|]+\))?)$")
EXPLICIT = [
    re.compile(r"^# (?:Verify |verify )?r(\d+)(?![.\d])", re.M),
    re.compile(r"^# 라운드 (\d+)", re.M),
    re.compile(r"^# verify (\d+)회째", re.M),
    re.compile(r"^## 판정 — verify (\d+)회째", re.M),
]
INVALID = "판정 불가"
PREV = ("—", "열림", "closed 보고", "닫힘")
NOW = ("열림", "닫힘")
PRIOR = ("—", "검사 완료", "명시 이월", "확인 불가")
PLAN_STATUS = ("designed",)
IMPL_STATUS = ("implemented", "partial", "blocked")


class InputError(Exception):
    pass


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise InputError(f"git {' '.join(args[:3])} 실패: {result.stderr.strip()}")
    return result.stdout


# ---------- 1. verify 회차 ----------

def commit_order() -> dict:
    return {sha: i for i, sha in enumerate(git("rev-list", "--reverse", "--topo-order", "HEAD").split())}


def trailer_commits(order: dict):
    fmt = "%H%x1f%P%x1f%T%x1f%cs%x1f%s%x1f%(trailers:key=Handoff,valueonly,separator=%x1e)%x1f%(trailers:key=Status,valueonly,separator=%x1e)%x1f%(trailers:key=Verified-By,valueonly,separator=%x1e)%x1f%(trailers:key=Next-Action,valueonly,separator=%x1e)%x1d"
    candidates = []
    for rec in git("log", f"--format={fmt}").split("\x1d"):
        parts = [p.strip() for p in rec.strip("\n").split("\x1f")]
        if len(parts) < 9 or parts[0] not in order:
            continue
        sha, parents, tree, date, subject, handoffs, status, verified, next_action = parts
        kind = "verify" if status == "verified" or verified in ("claude:pass", "claude:fail") else (
            "plan" if status in PLAN_STATUS else "impl" if status in IMPL_STATUS else "other")
        for value in handoffs.split("\x1e"):
            m = re.search(r"docs/handoff/(\d{4})-", value)
            if m:
                candidates.append({"sha": sha, "idx": order[sha], "date": date, "hid": m.group(1), "kind": kind,
                                   "verdict": verified, "subject": subject, "next": next_action,
                                   "key": (m.group(1), parents, tree, kind), "dups": []})
    rows, first = [], {}
    for row in sorted(candidates, key=lambda r: r["idx"]):
        if row["key"] in first:  # 부모·트리가 같은 같은 변경 — 앞선 커밋에 붙인다
            first[row["key"]]["dups"].append(row["sha"])
            continue
        first[row["key"]] = row
        rows.append(row)
    return rows


def verdict_label(commits) -> str:
    """회차 판정. 마지막 커밋의 Verified-By가 기준이고, fail 종류는 그 회차에서 판정을 제목에 밝힌 가장 최근 커밋에서 읽는다."""
    last = commits[-1]
    if last["verdict"] == "claude:pass":
        return "PASS"
    if last["verdict"] != "claude:fail":
        return "불명"
    for c in reversed(commits):
        for word in ("RETURN_TO_PLAN", "CLOSED", "FAIL"):
            if word in c["subject"]:
                return word
    return "FAIL" if last["next"] in ("codex", "gemini") else "FAIL·RTP"


def explicit_rounds(hid: str):
    """verify.md가 명시한 verify 회차의 최댓값(없으면 None)."""
    numbers = []
    for path in glob.glob(f"docs/handoff/{hid}-*/verify.md"):
        text = open(path, encoding="utf8").read()
        for pattern in EXPLICIT:
            numbers += [int(n) for n in pattern.findall(text)]
    return max(numbers) if numbers else None


def verify_rounds(commits):
    """handoff → [회차] — 회차 = {first, last, commits, verdict}."""
    rounds = defaultdict(list)
    work_since = defaultdict(lambda: True)
    for c in commits:
        hid = c["hid"]
        if c["kind"] in ("plan", "impl"):
            work_since[hid] = True
        elif c["kind"] == "verify":
            if work_since[hid] or not rounds[hid]:
                rounds[hid].append({"first": c, "commits": [c]})
            else:
                rounds[hid][-1]["commits"].append(c)
            work_since[hid] = False
    for hid, items in rounds.items():
        for n, r in enumerate(items, 1):
            r["n"] = n
            r["label"] = verdict_label(r["commits"])
            r["verdict"] = r["commits"][-1]["verdict"] if r["label"] != "불명" else "불명"
        explicit = explicit_rounds(hid)
        status = "명시 없음" if explicit is None else "일치" if explicit == len(items) else f"복원 불가 — 커밋 {len(items)}회 ↔ verify.md 명시 {explicit}회"
        for r in items:
            r["check"] = status
    return rounds


# ---------- 2. review 구간 ----------

def review_boundaries(order: dict):
    try:
        text = open(COVERAGE, encoding="utf8").read()
    except OSError as error:
        raise InputError(f"{COVERAGE} 읽기 실패: {error}")
    occurrences = defaultdict(list)
    for m in ROUND.finditer(text):
        prefix = m.group(0).split(" — ")[0] + " — "
        occurrences[prefix].append((int(m.group(1)), m.group(2)[:40]))
    bounds, unresolved = [], []
    for prefix, items in occurrences.items():
        shas = [s for s in git("log", "--reverse", "--format=%H", "-S", prefix, "--", COVERAGE).split() if s in order]
        for k, (number, title) in enumerate(items):
            if k < len(shas):
                bounds.append({"round": number, "title": title, "sha": shas[k], "idx": order[shas[k]]})
            else:
                unresolved.append(f"{prefix.strip()} {title}")
    bounds.sort(key=lambda b: b["idx"])
    seen = defaultdict(int)
    for b in bounds:
        seen[b["round"]] += 1
        b["label"] = str(b["round"]) + ("" if seen[b["round"]] == 1 else chr(ord("a") + seen[b["round"]] - 1))
    return bounds, unresolved


# ---------- 3. 발견 원장 ----------

def parse_ledgers(path: str):
    """→ ({(n, k): rows | INVALID}, errors). 형식 오류·충돌이 있는 원장은 INVALID로 남겨 그 회차를 판정 불가로 만든다."""
    text = open(path, encoding="utf8").read()
    found, errors = {}, []
    cells = lambda line: [c.strip().strip("`").strip() for c in line.strip().strip("|").split("|")]
    for m in LEDGER.finditer(text):
        n, k = int(m.group(1)), int(m.group(2) or 0)
        where = f"{path}:{text.count(chr(10), 0, m.start()) + 1} verify {n}" + (f" 정정 {k}" if k else "")
        lines = text[m.end():].split("\n")[1:]
        while lines and not lines[0].strip():
            lines.pop(0)
        if len(lines) < 2 or not lines[0].startswith("|") or cells(lines[0]) != HEADER or not set(lines[1].replace("|", "").strip()) <= set("-: "):
            errors.append(f"{where}: 원장 표 머리가 없거나 열이 다르다(기대 {' | '.join(HEADER)})")
            found[(n, k)] = INVALID
            continue
        rows, bad = [], False
        for line in lines[2:]:
            if not line.startswith("|"):
                break
            values = cells(line)
            if len(values) != 6:
                errors.append(f"{where}: 열 수가 6이 아닌 행 — {line[:60]}")
                bad = True
                continue
            row = dict(zip(["id", "disp", "prev", "now", "prior", "evidence"], values))
            problems = []
            if not row["id"]:
                problems.append("빈 발견 ID")
            if not DISPOSITION.match(row["disp"]):
                problems.append(f"disposition `{row['disp']}`")
            if row["prev"] not in PREV:
                problems.append(f"직전 상태 `{row['prev']}`")
            if row["now"] not in NOW:
                problems.append(f"이번 결과 `{row['now']}`")
            if row["prior"] not in PRIOR:
                problems.append(f"직전 기록 `{row['prior']}`")
            if "새 실행" not in row["evidence"] and "재분류" not in row["evidence"]:
                problems.append(f"증거 `{row['evidence']}`")
            if problems:
                errors.append(f"{where}: {row['id'] or '(빈 ID)'} 값 오류 — {', '.join(problems)}")
                bad = True
            rows.append(row)
        ids = defaultdict(list)
        for row in rows:
            ids[row["id"]].append(row)
        for rid, same in ids.items():
            if len(same) > 1 and any(s != same[0] for s in same):
                errors.append(f"{where}: ID {rid}가 서로 다른 내용으로 {len(same)}번 나온다")
                bad = True
        unique = INVALID if bad else [same[0] for same in ids.values()]
        if (n, k) in found and found[(n, k)] != unique:
            if found[(n, k)] != INVALID and unique != INVALID:
                errors.append(f"{where}: 같은 회차·정정 번호의 원장이 서로 다르다")
            found[(n, k)] = INVALID
            continue
        found[(n, k)] = unique
    return found, errors


def ledger_summary(handoff_filter=None):
    files = [p for p in sorted(glob.glob("docs/handoff/*/verify.md"))
             if re.search(r"/(\d{4})-", p) and (not handoff_filter or re.search(r"/(\d{4})-", p).group(1) == handoff_filter)]
    per, errors, with_ledger = {}, [], 0
    for path in files:
        found, errs = parse_ledgers(path)
        errors += errs
        if found:
            with_ledger += 1
            per[re.search(r"/(\d{4})-", path).group(1)] = found
    return files, with_ledger, per, errors


def transitions(found: dict):
    """회차별 유효 F와 전이. 확인할 수 없는 값은 None(판정 불가)으로 두고 0으로 채우지 않는다."""
    by_n = defaultdict(dict)
    for (n, k), rows in found.items():
        by_n[n][k] = rows
    out, errors = [], []
    confirmed_closed = set()
    prev_rows, prev_n = None, None  # prev_rows: 직전 회차 유효 원장(알 수 없으면 None)
    for n in sorted(by_n):
        versions = by_n[n]
        k = max(versions)
        rows = versions[k]
        f_of = lambda rs: None if rs == INVALID else {r["id"] for r in rs if DISPOSITION.match(r["disp"]) and r["disp"] in BLOCKING and r["now"] == "열림"}
        history = [f"{'원' if kk == 0 else f'정정 {kk}'} F {INVALID if f_of(versions[kk]) is None else len(f_of(versions[kk]))}" for kk in sorted(versions)]
        entry = {"n": n, "k": k, "history": history, "moves": None, "late": None, "evidence": None, "F": None}
        known_prev = prev_rows is not None and prev_n == n - 1
        if rows == INVALID:
            errors.append(f"verify {n}: 최신 원장({'원' if k == 0 else f'정정 {k}'})이 잘못돼 F를 정할 수 없다")
            out.append(entry)
            prev_rows, prev_n = None, n
            continue
        ids = {r["id"]: r for r in rows}
        open_now = f_of(rows)
        entry["late"] = {v: sum(1 for r in rows if r["id"] in open_now and r["prior"] == v) for v in PRIOR[1:]}
        entry["evidence"] = {v: sum(1 for r in rows if v in r["evidence"]) for v in ("새 실행", "재분류")}
        entry["late_ids"] = [r["id"] for r in rows if r["id"] in open_now and r["prior"] == "검사 완료"]
        if n == 1 or known_prev:
            prev_open = set() if n == 1 else {r["id"] for r in prev_rows if r["now"] == "열림"}
            prev_blocking = set() if n == 1 else {r["id"] for r in prev_rows if r["disp"] in BLOCKING and r["now"] == "열림"}
            problems = []
            for rid, r in ids.items():
                if r["prev"] == "—" and rid in prev_open:
                    problems.append(f"{rid}: 직전 상태 —인데 직전 원장에서 열림")
                if r["prev"] in ("열림", "closed 보고") and rid not in prev_open:
                    problems.append(f"{rid}: 직전 상태 {r['prev']}인데 직전 원장에서 열리지 않음")
                if r["prev"] == "닫힘" and rid not in confirmed_closed:
                    problems.append(f"{rid}: 직전 상태 닫힘인데 앞 원장에 verify 종결 확인이 없다")
            missing = sorted(prev_blocking - set(ids))
            if missing:
                problems.append(f"직전에 열린 {', '.join(missing)}가 종결·분류 이동 기록 없이 빠졌다")
            if problems:
                errors += [f"verify {n}: {p}" for p in problems]
                out.append(entry)
                prev_rows, prev_n = None, n
                continue
            moves = defaultdict(list)
            for rid, r in ids.items():
                blocking = r["disp"] in BLOCKING
                if blocking and r["now"] == "열림":
                    moves["계속 열림" if rid in prev_blocking else "재개" if rid in confirmed_closed else "신규"].append(rid)
                elif blocking and r["now"] == "닫힘" and rid in prev_blocking:
                    moves["실제 종결"].append(rid)
                elif not blocking and rid in prev_blocking:
                    moves["분류 이동"].append(rid)
            reported = [r for r in rows if r["prev"] == "closed 보고"]
            moves["closed 보고 → 종결 확인"] = [r["id"] for r in reported if r["now"] == "닫힘"]
            moves["closed 보고 → 열림"] = [r["id"] for r in reported if r["now"] == "열림"]
            entry["moves"] = moves
        else:
            entry["note"] = "직전 회차를 판정할 수 없어 전이·누락을 확인할 수 없다"
        entry["F"] = len(open_now)
        for r in rows:
            if r["disp"] in BLOCKING and r["now"] == "닫힘":
                confirmed_closed.add(r["id"])
        out.append(entry)
        prev_rows, prev_n = rows, n
    return out, errors


# ---------- 4. 지침 크기 ----------

def size_at(rev: str):
    total, cites, absent = 0, 0, []
    if rev != "WORKTREE":
        try:
            git("rev-parse", "--verify", "--quiet", f"{rev}^{{commit}}")
        except InputError:
            raise InputError(f"--size-at: `{rev}`는 커밋을 가리키지 않는다")
    for path in CORE:
        if rev == "WORKTREE":
            try:
                body = open(path, encoding="utf8").read()
            except FileNotFoundError:
                absent.append(path)
                continue
            except OSError as error:
                raise InputError(f"{path} 읽기 실패: {error}")
        else:
            exists = subprocess.run(["git", "cat-file", "-e", f"{rev}:{path}"], capture_output=True).returncode == 0
            if not exists:
                absent.append(path)
                continue
            body = git("show", f"{rev}:{path}")
        total += len(body.encode("utf8"))
        cites += len(CITE.findall(body))
    return total, cites, absent


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--last", type=int, default=12, help="구간 표에 낼 최근 review 수")
    ap.add_argument("--handoff", help="원장 표를 이 handoff 번호로 좁힌다(예: 0329)")
    ap.add_argument("--size-at", nargs="*", default=[], help="지침 크기를 잴 추가 rev")
    ap.add_argument("--list", metavar="LABEL", help="이 review 구간(예: 48 · 24b)에 배정된 verify 회차를 나열한다")
    args = ap.parse_args(argv)
    try:
        sizes = [(rev, *size_at(rev)) for rev in [*args.size_at, "HEAD", "WORKTREE"]]
        order = commit_order()
        rounds = verify_rounds(trailer_commits(order))
        bounds, unresolved = review_boundaries(order)
    except InputError as error:
        print(f"입력 오류: {error}", file=sys.stderr)
        return 2

    all_rounds = [r for items in rounds.values() for r in items]
    unknown = sum(1 for r in all_rounds if r["verdict"] == "불명")
    broken = {hid: items[0]["check"] for hid, items in rounds.items() if items[0]["check"].startswith("복원 불가")}
    excluded = lambda r: r["verdict"] == "불명" or r["first"]["hid"] in broken
    print(f"verify 회차 {len(all_rounds)}(handoff {len(rounds)}) · 판정 불명 {unknown} · 복원 불가 handoff {len(broken)}(회차 {sum(len(rounds[h]) for h in broken)})")
    print("\nreview\tcommit\tdate\tverify\tPASS\tFAIL\t불명\t복원 불가\tFAIL%(불명·복원 불가 제외)\t제목")
    edges = [b["idx"] for b in bounds] + [float("inf")]
    assigned = defaultdict(list)
    for r in all_rounds:
        i = max((j for j, e in enumerate(edges[:-1]) if e <= r["first"]["idx"]), default=None)
        assigned[i].append(r)
    for i, b in list(enumerate(bounds))[-args.last:]:
        items = assigned.get(i, [])
        p = sum(1 for r in items if not excluded(r) and r["verdict"] == "claude:pass")
        f = sum(1 for r in items if not excluded(r) and r["verdict"] == "claude:fail")
        u = sum(1 for r in items if r["verdict"] == "불명")
        x = sum(1 for r in items if r["verdict"] != "불명" and r["first"]["hid"] in broken)
        rate = f"{100 * f / (p + f):.0f}" if p + f else "-"
        print(f"{b['label']}\t{b['sha'][:8]}\t{git('show', '-s', '--format=%cs', b['sha']).strip()}\t{len(items)}\t{p}\t{f}\t{u}\t{x}\t{rate}\t{b['title']}")
    print(f"(첫 review 앞 회차 {len(assigned.get(None, []))} · 배정 합계 {sum(len(v) for v in assigned.values())} = 회차 {len(all_rounds)})")
    if args.list:
        hit = [i for i, b in enumerate(bounds) if b["label"] == args.list]
        if not hit:
            print(f"입력 오류: review 구간 `{args.list}`이 없다", file=sys.stderr)
            return 2
        for r in sorted(assigned.get(hit[0], []), key=lambda r: r["first"]["idx"]):
            extra = f" · 같은 회차 갱신 {', '.join(c['sha'][:8] for c in r['commits'][1:])}" if len(r["commits"]) > 1 else ""
            print(f"  {r['first']['hid']} verify {r['n']}\t{r['first']['sha'][:8]}\t{r['label']}{extra}")
    for u in unresolved:
        print(f"구간 복원 불가\t{u}\t절을 들인 커밋을 찾지 못했다")

    shown = [args.handoff] if args.handoff else sorted(broken)
    if shown:
        print("\nhandoff\t회차\t판정 순서\t명시 기록 대조\t같은 변경 커밋")
    for hid in shown:
        items = rounds.get(hid, [])
        dups = [d for r in items for c in r["commits"] for d in c["dups"]]
        print(f"{hid}\t{len(items)}\t{' → '.join(r['label'] for r in items) or '-'}\t{items[0]['check'] if items else '커밋 없음'}\t{', '.join(d[:8] for d in dups) or '-'}")

    files, with_ledger, per, errors = ledger_summary(args.handoff)
    scope = f"handoff {args.handoff}" if args.handoff else "전체"
    print(f"\n발견 원장({scope}): verify.md {len(files)} · 원장 보유 {with_ledger} · 원장 없음(F 복원 불가) {len(files) - with_ledger} · 원장 형식 오류 {len(errors)}")
    print("handoff\tverify\t유효 원장\tF\t이력\t신규\t계속\t재개\t종결\t분류 이동\t늦은 발견(검사 완료·명시 이월·확인 불가)\t증거(새 실행·재분류)")
    for hid in sorted(per):
        table, terrs = transitions(per[hid])
        errors += [f"{hid} {e}" for e in terrs]
        for row in table:
            m = row["moves"]
            count = lambda key: "-" if m is None else str(len(m.get(key, [])))
            late = "-" if row["late"] is None else "·".join(str(row["late"][v]) for v in PRIOR[1:])
            ev = "-" if row["evidence"] is None else f"{row['evidence']['새 실행']}·{row['evidence']['재분류']}"
            f_text = INVALID if row["F"] is None else str(row["F"])
            src = f"정정 {row['k']}" if row["k"] else "원"
            print(f"{hid}\t{row['n']}\t{src}\t{f_text}\t{' → '.join(row['history'])}\t{count('신규')}\t{count('계속 열림')}\t{count('재개')}\t{count('실제 종결')}\t{count('분류 이동')}\t{late}\t{ev}")
            if m:
                for key in ("재개", "분류 이동", "closed 보고 → 열림"):
                    if m.get(key):
                        print(f"\t\t{key}\t{', '.join(m[key])}")
            for rid in row.get("late_ids", []):
                print(f"\t\t권고 신호\t{rid}\t앞 기록이 검사 완료였던 범위의 늦은 발견")
            if row.get("note"):
                print(f"\t\t참고\t{row['note']}")
        ledger_rounds = sorted(row["n"] for row in table)
        for gap in sorted(set(range(1, max(ledger_rounds) + 1)) - set(ledger_rounds)):
            print(f"{hid}\tverify {gap}\t원장 없음 — {gap}→{gap + 1} 전이를 복원할 수 없다")
        commit_rounds = len(rounds.get(hid, []))
        if commit_rounds and max(ledger_rounds) != commit_rounds:
            print(f"{hid}\t원장 회차 {ledger_rounds} ↔ 커밋 회차 {commit_rounds} 불일치")
    for e in errors:
        print(f"원장 오류\t{e}")

    print("\nrev\t핵심 지침 bytes\t사례 인용\t없는 파일")
    for rev, total, cites, absent in sizes:
        print(f"{rev}\t{total}\t{cites}\t{', '.join(absent) or '-'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
