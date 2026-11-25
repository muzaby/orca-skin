#!/usr/bin/env python3
"""instruction_delta.py — 6-A Operational Instruction Delta 보조. 지침 문서를 고친 뒤 "설명 없이 사라진 것" 후보를 뽑는다.

변경 전 문서의 줄마다 변경 후의 **같은 파일**에 남았는지 먼저 보고, 없으면 다른 대조 파일에 있는지 본다.
판정(KEEP·MOVE·REPLACE·DELETE)은 사람이 후보 줄을 읽고 내린다.
종료 코드: 0 비교 성공(후보 0도 정상) · 2 입력 오류 — 잘못된 --base/--head ref, 두 판본 어디에도 없는 대상,
없는 --pool 파일, 형식이 틀리거나 가리키는 파일이 없는 --map, 읽기 실패. 입력 오류를 빈 문서로 읽으면
"신규 파일·후보 0"이나 "잃음 다수"처럼 정상 결과로 보이기 때문이다.

후보 종류:
  잃음        백틱 식별자·사례 ID(`0NNN rN`)가 어느 변경 후 문서에도 토큰 단위로 없다 — `--strict`가
              `--strict-old` 안에 들어 있어도 보존으로 세지 않는다. 대부분 사례 세부·앵커 표기만 빠진 줄이고,
              규칙 문장이 사라진 줄이 regression이다.
  이동?       표식이 같은 파일에는 없고 다른 대조 파일에만 있다. 옮겨 간 곳을 원래 문서가 가리키는지 확인한다 —
              corpus처럼 규칙 정본이 아닌 파일에만 남았으면 지침에서는 사라진 것이다.
  문장        (--prose) 줄의 글자 4-gram이 어느 변경 후 문서의 한 줄에도 기준(--threshold, 기본 0.5)만큼 들어 있지 않다.
  문장 이동?  (--prose) 같은 파일에서는 기준 미만이고 다른 대조 파일의 한 줄에서는 기준 이상이다.

잡지 못하는 것: 문장이 거의 그대로인 줄에서 조건·범위·주체 단어 하나만 빠진 약화. 작은 수정은
  git diff --word-diff=plain <base> <head> -- <파일> | grep -oP '\\[-.*?-\\]'
로 지운 단어를 따로 본다.

사용:
  python3 .agents/skills/handoff-review/scripts/instruction_delta.py --base <변경 전 커밋> [--head <변경 후 커밋>] \\
      [--pool <파일>]... [--map <old>=<new>]... [--prose [--threshold 0.5]] <파일> [<파일> ...]
  python3 .agents/skills/handoff-review/scripts/instruction_delta.py --base <변경 전> [--head <변경 후>] \\
      --pset .agents/skills/handoff-review/references/failure-patterns.corpus.md
      (6-B 첫 단계: 변경 전후 `## P<번호>` 집합의 삭제·추가·중복·번호 변경)

  --head 를 생략하면 변경 후 = 작업 트리.
  대조 대상 파일들은 서로의 대조 파일이 된다. --pool 은 규칙이 옮겨 갔을 수 있는 다른 파일이다(파일마다 하나씩).
  --map old=new 는 파일 이름이 바뀐 경우다(쌍마다 하나씩).
"""
import argparse
import re
import subprocess
import sys
from collections import Counter

TOKEN = re.compile(r"`([^`]{3,80})`")
CASE_ID = re.compile(r"\b0\d{3}(?: r\d+(?:\.\d+)?(?:~r\d+|→r\d+)?)?")
DECORATION = re.compile(r"[\s*`|>#\-]")
GRAM = 4
MIN_GRAMS = 8  # 표 구분선·짧은 제목처럼 대조할 내용이 없는 줄은 건너뛴다
KINDS = ("잃음", "이동?", "문장", "문장 이동?")


class InputError(Exception):
    pass


def check_ref(name, rev):
    if rev is None:
        return
    result = subprocess.run(["git", "rev-parse", "--verify", "--quiet", f"{rev}^{{commit}}"], capture_output=True, text=True)
    if result.returncode != 0:
        raise InputError(f"{name} `{rev}`는 커밋을 가리키지 않는다")


def read(rev, path):
    """판본의 내용. 그 판본에 파일이 없으면 None, 읽기 실패는 InputError."""
    if rev is None:
        try:
            with open(path, encoding="utf8") as handle:
                return handle.read()
        except FileNotFoundError:
            return None
        except OSError as error:
            raise InputError(f"{path} 읽기 실패: {error}")
    if subprocess.run(["git", "cat-file", "-e", f"{rev}:{path}"], capture_output=True).returncode != 0:
        return None
    result = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    if result.returncode != 0:
        raise InputError(f"{rev}:{path} 읽기 실패: {result.stderr.strip()}")
    return result.stdout


def present(mark, text):
    """표식이 토큰 단위로 있는가.

    사례 ID는 같은 추출식(CASE_ID)으로 변경 후 문서에서 뽑은 집합과 비교한다 — 바뀌지 않은 문서는 늘 같은 집합이 나온다.
    백틱 식별자는 앞뒤가 ASCII 식별자 문자(영숫자·_·-)로 이어지지 않을 때만 같은 토큰이다 — `--strict`는
    `--strict-old` 안에서 보존되지 않고, 한글 조사(`--strict`가)는 경계로 본다.
    """
    if CASE_ID.fullmatch(mark):
        return mark in set(CASE_ID.findall(text))
    return re.search(r"(?<![A-Za-z0-9_-])" + re.escape(mark) + r"(?![A-Za-z0-9_-])", text) is not None


PSET = re.compile(r"^## P(\d+)\b(.*)$", re.M)


def pset(base, head, path):
    old, new = read(base, path), read(head, path)
    if old is None or new is None:
        raise InputError(f"--pset {path}: {'변경 전' if old is None else '변경 후'} 판본에 파일이 없다")
    def heads(text):
        items = [(int(m.group(1)), re.sub(r"[*\s]+", " ", m.group(2)).strip(" —")) for m in PSET.finditer(text)]
        return items, {n for n, _ in items}
    before, b_ids = heads(old)
    after, a_ids = heads(new)
    dup = sorted(n for n in a_ids if sum(1 for m, _ in after if m == n) > 1)
    renumbered = [(n, m) for n, title in before for m, other in after if title == other and n != m]
    print(f"== {path}: P 변경 전 {len(b_ids)} · 변경 후 {len(a_ids)}")
    print(f"  삭제\t{', '.join(f'P{n}' for n in sorted(b_ids - a_ids)) or '없음'}")
    print(f"  추가\t{', '.join(f'P{n}' for n in sorted(a_ids - b_ids)) or '없음'}")
    print(f"  중복\t{', '.join(f'P{n}' for n in dup) or '없음'}")
    print(f"  번호 변경\t{', '.join(f'P{n} → P{m}' for n, m in renumbered) or '없음'}")
    print("# 삭제·중복·번호 변경이 있으면 의도한 폐기·이동의 근거를 라운드 기록에 남긴다", file=sys.stderr)


def grams(line):
    text = DECORATION.sub("", line)
    return {text[i : i + GRAM] for i in range(len(text) - GRAM + 1)}


def short(path):
    return "/".join(path.split("/")[-2:])


class LineIndex:
    """4-gram 역색인 — 변경 전 한 줄이 가장 많이 들어 있는 한 줄의 포함률을 잰다."""

    def __init__(self, texts):
        self.index = {}
        for number, line in enumerate(line for text in texts for line in text.split("\n")):
            for gram in grams(line):
                self.index.setdefault(gram, []).append(number)

    def containment(self, line_grams):
        hits = Counter()
        for gram in line_grams:
            hits.update(self.index.get(gram, ()))
        if not hits:
            return 0.0
        return max(hits.values()) / len(line_grams)


def classify(path, line, here, others, here_index, all_index, threshold):
    marks = set(TOKEN.findall(line)) | set(CASE_ID.findall(line))
    missing = sorted(mark for mark in marks if not present(mark, here))
    if missing:
        gone = [mark for mark in missing if not any(present(mark, text) for text in others.values())]
        if gone:
            return "잃음", ", ".join(gone)
        where = sorted({short(other) for mark in missing for other, text in others.items() if present(mark, text)})
        return "이동?", f"{', '.join(missing)} → {', '.join(where)}"
    if here_index is None or line.strip() in here:
        return None
    line_grams = grams(line)
    if len(line_grams) < MIN_GRAMS:
        return None
    score_here = here_index.containment(line_grams)
    if score_here >= threshold:
        return None
    score_all = all_index.containment(line_grams)
    if score_all >= threshold:
        return "문장 이동?", f"포함률 {score_here:.2f} → {score_all:.2f}"
    return "문장", f"포함률 {score_all:.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head")
    parser.add_argument("--pool", action="append", default=[], help="규칙이 옮겨 갔을 수 있는 파일(반복 가능)")
    parser.add_argument("--map", action="append", default=[], help="old=new 경로 쌍(반복 가능)")
    parser.add_argument("--prose", action="store_true", help="표식 밖 문장도 포함률로 대조한다")
    parser.add_argument("--threshold", type=float, default=0.5, help="--prose 포함률 기준(기본 0.5)")
    parser.add_argument("--pset", metavar="CORPUS", help="변경 전후 `## P<번호>` 집합을 대조한다(6-B 첫 단계)")
    parser.add_argument("files", nargs="*")
    args = parser.parse_args()
    try:
        return run(args)
    except InputError as error:
        print(f"입력 오류: {error}", file=sys.stderr)
        return 2


def run(args) -> int:
    check_ref("--base", args.base)
    check_ref("--head", args.head)
    if args.pset:
        pset(args.base, args.head, args.pset)
        if not args.files:
            return 0
    if not args.files:
        raise InputError("대조할 파일이 없다")
    renames = {}
    for pair in args.map:
        if "=" not in pair or not all(pair.split("=", 1)):
            raise InputError(f"--map `{pair}`는 old=new 꼴이 아니다")
        old_path, new_path = pair.split("=", 1)
        if read(args.base, old_path) is None:
            raise InputError(f"--map: 변경 전 판본에 `{old_path}`가 없다")
        if read(args.head, new_path) is None:
            raise InputError(f"--map: 변경 후 판본에 `{new_path}`가 없다")
        renames[old_path] = new_path
    news = {}
    for path in args.files:
        new = read(args.head, renames.get(path, path))
        if new is None and read(args.base, path) is None:
            raise InputError(f"`{path}`가 변경 전·후 어느 판본에도 없다")
        news[path] = new
    texts = {path: text or "" for path, text in news.items()}
    for path in args.pool:
        pooled = read(args.head, path)
        if pooled is None:
            raise InputError(f"--pool `{path}`가 변경 후 판본에 없다")
        texts.setdefault(path, pooled)
    all_index = LineIndex(texts.values()) if args.prose else None

    total = Counter()
    for path in args.files:
        old = read(args.base, path)
        if old is None:
            print(f"== {path}: 변경 전 판본 없음(신규 파일)")
            continue
        if news[path] is None:
            print(f"== {path}: 변경 후 판본 없음(삭제) — 모든 줄이 후보다")
        here = texts[path]
        others = {other: text for other, text in texts.items() if other != path}
        here_index = LineIndex([here]) if args.prose else None
        rows = []
        for number, line in enumerate(old.split("\n"), 1):
            found = classify(path, line, here, others, here_index, all_index, args.threshold)
            if found:
                rows.append((number, *found, line.strip()[:90]))
        counts = Counter(kind for _, kind, _, _ in rows)
        total.update(counts)
        summary = " · ".join(f"{kind} {counts[kind]}" for kind in KINDS if kind in counts) or "후보 0"
        print(f"== {path}: {summary}")
        for number, kind, detail, head in sorted(rows, key=lambda row: (KINDS.index(row[1]), row[0])):
            print(f"  {number}\t{kind}\t{detail[:120]}\t{head}")
    summary = " · ".join(f"{kind} {total[kind]}" for kind in KINDS if kind in total) or "0"
    print(f"# 후보 줄 {sum(total.values())} ({summary}) — 줄마다 KEEP/MOVE/REPLACE/DELETE를 판정한다", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
