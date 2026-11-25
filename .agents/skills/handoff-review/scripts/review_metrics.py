#!/usr/bin/env python3
"""review_metrics.py — review가 반복 실패의 추세를 실제 verify 이력으로 설명하게 하는 집계.

판정은 하지 않는다. review가 숫자를 라운드 기록(§7)에 옮기고 원문을 대조해 원인을 판단한다.

1. 실제 verify 회차 — 커밋 trailer(`Handoff:` · `Status:` · `Verified-By:`)를 커밋 순서로 읽는다.
   한 handoff의 verify 커밋은 직전 verify 커밋 뒤에 그 handoff의 설계·구현 커밋이 있었을 때만 새 회차다.
   그 사이에 설계·구현이 없으면(판정 정정 · 원장 재구성 · 같은 턴의 추가 커밋) 같은 회차를 갱신한다.
   회차의 판정은 마지막 커밋의 `Verified-By`이고, 비었거나 `pending`이면 판정 불명이다.
2. review 구간 — `regression-coverage.md`의 `# Round N —` · `# review round N —` 절이 처음 들어온 커밋을
   커밋 순서(`git rev-list --topo-order`)로 놓고 그 사이를 구간으로 한다. 같은 날의 여러 review와 같은 번호의
   두 절(예: round 24)도 서로 다른 구간이다. 각 verify 회차는 첫 커밋이 속한 구간에 한 번만 배정된다.
   FAIL 비율의 분자·분모에서 판정 불명은 뺀다.
3. 발견 원장 F(N) — `docs/handoff/*/verify.md`의 `### 발견 원장 — verify N[ 정정(round K)]` 표.
   F = 그 회차 판정 시점에 `이번 결과 = 열림`인 `BLOCKING`·`PLAN_GAP` 고유 ID 수.
   같은 회차는 가장 큰 K가 유효 값이고, 정정 전 값은 이력으로 함께 낸다.
   회차 사이 ID 전이: 신규 · 계속 열림 · 재개(verify가 종결을 확인한 뒤 다시 열림) · 실제 종결 · 비차단으로 분류 이동.
   구현자의 `closed 보고`는 verify의 종결 확인과 따로 센다.
   원장이 없는 verify.md·형식 오류·충돌 중복·회차 누락은 0건으로 세지 않고 그 사실을 낸다.
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
BLOCKING = ("BLOCKING", "PLAN_GAP")
DISPOSITIONS = ("BLOCKING", "PLAN_GAP", "NON_BLOCKING", "NEXT_HANDOFF", "경계")
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
    fmt = "%H%x1f%cs%x1f%(trailers:key=Handoff,valueonly,separator=%x1e)%x1f%(trailers:key=Status,valueonly,separator=%x1e)%x1f%(trailers:key=Verified-By,valueonly,separator=%x1e)%x1d"
    rows = []
    for rec in git("log", f"--format={fmt}").split("\x1d"):
        parts = [p.strip() for p in rec.strip("\n").split("\x1f")]
        if len(parts) < 5:
            continue
        sha, date, handoff, status, verified = parts
        m = re.search(r"docs/handoff/(\d{4})-", handoff)
        if not m or sha not in order:
            continue
        kind = "verify" if status == "verified" or verified in ("claude:pass", "claude:fail") else (
            "plan" if status in PLAN_STATUS else "impl" if status in IMPL_STATUS else "other")
        rows.append({"sha": sha, "idx": order[sha], "date": date, "hid": m.group(1), "kind": kind, "verdict": verified})
    rows.sort(key=lambda r: r["idx"])
    return rows


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
            last = r["commits"][-1]["verdict"]
            r["verdict"] = last if last in ("claude:pass", "claude:fail") else "불명"
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
    """→ ({(n, k): rows}, errors). rows = [dict]. 형식 오류는 errors에 담고 그 원장은 쓰지 않는다."""
    text = open(path, encoding="utf8").read()
    found, errors = {}, []
    for m in LEDGER.finditer(text):
        n, k = int(m.group(1)), int(m.group(2) or 0)
        where = f"{path}:{text.count(chr(10), 0, m.start()) + 1} verify {n}" + (f" 정정 {k}" if k else "")
        lines = text[m.end():].split("\n")[1:]
        while lines and not lines[0].strip():
            lines.pop(0)
        cells = lambda line: [c.strip().strip("`").strip() for c in line.strip().strip("|").split("|")]
        if len(lines) < 2 or not lines[0].startswith("|") or cells(lines[0]) != HEADER or not set(lines[1].replace("|", "").strip()) <= set("-: "):
            errors.append(f"{where}: 원장 표 머리가 없거나 열이 다르다(기대 {' | '.join(HEADER)})")
            continue
        rows, bad = [], False
        for line in lines[2:]:
            if not line.startswith("|"):
                break
            row = dict(zip(["id", "disp", "prev", "now", "prior", "evidence"], cells(line)))
            if len(cells(line)) != 6:
                errors.append(f"{where}: 열 수가 6이 아닌 행 — {line[:60]}")
                bad = True
                continue
            problems = []
            if not row["disp"].startswith(DISPOSITIONS):
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
                errors.append(f"{where}: {row['id']} 값 오류 — {', '.join(problems)}")
                bad = True
            rows.append(row)
        ids = defaultdict(list)
        for row in rows:
            ids[row["id"]].append(row)
        for rid, same in ids.items():
            if len(same) > 1 and any(s != same[0] for s in same):
                errors.append(f"{where}: ID {rid}가 서로 다른 내용으로 {len(same)}번 나온다")
                bad = True
        if bad:
            continue
        unique = [same[0] for same in ids.values()]
        if (n, k) in found and found[(n, k)] != unique:
            errors.append(f"{where}: 같은 회차·정정 번호의 원장이 서로 다르다")
            found[(n, k)] = None
            continue
        found.setdefault((n, k), unique)
    return {key: rows for key, rows in found.items() if rows is not None}, errors


def ledger_summary(handoff_filter=None):
    files = sorted(glob.glob("docs/handoff/*/verify.md"))
    per, errors, with_ledger = {}, [], 0
    for path in files:
        hid = re.search(r"/(\d{4})-", path)
        if not hid or (handoff_filter and hid.group(1) != handoff_filter):
            continue
        found, errs = parse_ledgers(path)
        errors += errs
        if found or errs:
            with_ledger += 1
        if found:
            per[hid.group(1)] = found
    return files, with_ledger, per, errors


def transitions(found: dict):
    """회차별 유효 원장과 전이 · 정정 전 F."""
    by_n = defaultdict(dict)
    for (n, k), rows in found.items():
        by_n[n][k] = rows
    out, notes = [], []
    closed_confirmed = set()
    prev_open, prev_n = None, None
    for n in sorted(by_n):
        versions = by_n[n]
        rows = versions[max(versions)]
        f_of = lambda rs: {r["id"] for r in rs if r["disp"].startswith(BLOCKING) and r["now"] == "열림"}
        current_open = f_of(rows)
        history = [f"{'원' if k == 0 else f'정정 {k}'} F {len(f_of(versions[k]))}" for k in sorted(versions)]
        moves = defaultdict(list)
        if prev_open is not None and n == prev_n + 1:
            ids = {r["id"]: r for r in rows}
            for rid, r in ids.items():
                blocking = r["disp"].startswith(BLOCKING)
                if blocking and r["now"] == "열림":
                    moves["계속 열림" if rid in prev_open else "재개" if rid in closed_confirmed else "신규"].append(rid)
                elif blocking and r["now"] == "닫힘" and rid in prev_open:
                    moves["실제 종결"].append(rid)
                elif not blocking and rid in prev_open:
                    moves["분류 이동"].append(rid)
            for rid in sorted(prev_open - set(ids)):
                moves["원장에서 빠짐"].append(rid)
        elif prev_open is None and n == 1:
            moves["신규"] = sorted(current_open)
        else:
            notes.append(f"verify {n}: 직전 회차 원장이 없어 전이를 복원할 수 없다")
        reported = [r for r in rows if r["prev"] == "closed 보고"]
        moves["closed 보고 → 종결 확인"] = [r["id"] for r in reported if r["now"] == "닫힘"]
        moves["closed 보고 → 열림"] = [r["id"] for r in reported if r["now"] == "열림"]
        late = {v: [r["id"] for r in rows if r["id"] in current_open and r["prior"] == v] for v in PRIOR[1:]}
        evidence = {v: sum(1 for r in rows if v in r["evidence"]) for v in ("새 실행", "재분류")}
        out.append({"n": n, "k": max(versions), "F": len(current_open), "history": history, "moves": moves, "late": late, "evidence": evidence})
        for r in rows:
            if r["disp"].startswith(BLOCKING) and r["now"] == "닫힘":
                closed_confirmed.add(r["id"])
        prev_open, prev_n = current_open, n
    return out, notes


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
    print(f"verify 회차 {len(all_rounds)}(handoff {len(rounds)}) · 판정 불명 {unknown}")
    print("\nreview\tcommit\tdate\tverify\tPASS\tFAIL\t불명\tFAIL%(불명 제외)\t제목")
    edges = [b["idx"] for b in bounds] + [float("inf")]
    assigned = defaultdict(list)
    for r in all_rounds:
        i = max((j for j, e in enumerate(edges[:-1]) if e <= r["first"]["idx"]), default=None)
        assigned[i].append(r)
    for i, b in list(enumerate(bounds))[-args.last:]:
        items = assigned.get(i, [])
        p = sum(1 for r in items if r["verdict"] == "claude:pass")
        f = sum(1 for r in items if r["verdict"] == "claude:fail")
        u = len(items) - p - f
        rate = f"{100 * f / (p + f):.0f}" if p + f else "-"
        print(f"{b['label']}\t{b['sha'][:8]}\t{git('show', '-s', '--format=%cs', b['sha']).strip()}\t{len(items)}\t{p}\t{f}\t{u}\t{rate}\t{b['title']}")
    print(f"(첫 review 앞 회차 {len(assigned.get(None, []))} · 배정 합계 {sum(len(v) for v in assigned.values())} = 회차 {len(all_rounds)})")
    if args.list:
        hit = [i for i, b in enumerate(bounds) if b["label"] == args.list]
        if not hit:
            print(f"입력 오류: review 구간 `{args.list}`이 없다", file=sys.stderr)
            return 2
        for r in sorted(assigned.get(hit[0], []), key=lambda r: r["first"]["idx"]):
            extra = f" · 같은 회차 갱신 {', '.join(c['sha'][:8] for c in r['commits'][1:])}" if len(r["commits"]) > 1 else ""
            print(f"  {r['first']['hid']} verify {r['n']}\t{r['first']['sha'][:8]}\t{r['verdict']}{extra}")
    for u in unresolved:
        print(f"구간 복원 불가\t{u}\t절을 들인 커밋을 찾지 못했다")

    files, with_ledger, per, errors = ledger_summary(args.handoff)
    scope = f"handoff {args.handoff}" if args.handoff else "전체"
    print(f"\n발견 원장({scope}): verify.md {len(files)} · 원장 보유 {with_ledger} · 원장 없음(F 복원 불가) {len(files) - with_ledger if not args.handoff else '-'} · 원장 오류 {len(errors)}")
    print("handoff\tverify\t유효 원장\tF\t이력\t신규\t계속\t재개\t종결\t분류 이동\t늦은 발견(검사 완료·명시 이월·확인 불가)\t증거(새 실행·재분류)")
    for hid in sorted(per):
        found = per[hid]
        table, notes = transitions(found)
        ledger_rounds = {t["n"] for t in table}
        commit_rounds = len(rounds.get(hid, []))
        for t in table:
            m = t["moves"]
            src = f"정정 {t['k']}" if t["k"] else "원"
            late = "·".join(str(len(t["late"][v])) for v in PRIOR[1:])
            print(f"{hid}\t{t['n']}\t{src}\t{t['F']}\t{' → '.join(t['history'])}\t{len(m.get('신규', []))}\t{len(m.get('계속 열림', []))}\t{len(m.get('재개', []))}\t{len(m.get('실제 종결', []))}\t{len(m.get('분류 이동', []))}\t{late}\t{t['evidence']['새 실행']}·{t['evidence']['재분류']}")
            for key in ("재개", "분류 이동", "원장에서 빠짐", "closed 보고 → 열림"):
                if m.get(key):
                    print(f"\t\t{key}\t{', '.join(m[key])}")
            for rid in t["late"]["검사 완료"]:
                print(f"\t\t권고 신호\t{rid}\t앞 기록이 검사 완료였던 범위의 늦은 발견")
        for note in notes:
            print(f"{hid}\t{note}")
        if commit_rounds and max(ledger_rounds) != commit_rounds:
            print(f"{hid}\t원장 회차 {sorted(ledger_rounds)} ↔ 커밋 회차 {commit_rounds} 불일치")
    for e in errors:
        print(f"원장 오류\t{e}")

    print("\nrev\t핵심 지침 bytes\t사례 인용\t없는 파일")
    for rev, total, cites, absent in sizes:
        print(f"{rev}\t{total}\t{cites}\t{', '.join(absent) or '-'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
