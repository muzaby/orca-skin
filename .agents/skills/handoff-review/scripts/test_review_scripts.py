"""review_metrics.py · instruction_delta.py 회귀 테스트 — 임시 git 저장소에 이력을 만들어 돌린다.

python3 .agents/skills/handoff-review/scripts/test_review_scripts.py   (어디서 돌려도 된다 — 임시 저장소에서 실행)
"""
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
METRICS = os.path.join(HERE, "review_metrics.py")
DELTA = os.path.join(HERE, "instruction_delta.py")
CORE = [
    ".agents/skills/handoff-plan/SKILL.md",
    ".agents/skills/handoff-impl/SKILL.md",
    ".agents/skills/handoff-verify/SKILL.md",
    ".agents/skills/handoff-review/SKILL.md",
    "docs/handoff/AGENTS.md",
]
COVERAGE = ".agents/skills/handoff-review/references/regression-coverage.md"
HEADER = "| ID | disposition | 직전 상태 | 이번 결과 | 직전 기록 | 증거 |\n|---|---|---|---|---|---|\n"


class Repo:
    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="review-scripts-")
        self.git("init", "-q")
        self.git("config", "user.email", "t@example.invalid")
        self.git("config", "user.name", "t")
        self.tick = 0

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.dir, capture_output=True, text=True, check=True).stdout

    def write(self, path, text, append=False):
        full = os.path.join(self.dir, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "a" if append else "w", encoding="utf8") as handle:
            handle.write(text)

    def commit(self, subject, trailers=None):
        self.tick += 1
        env = dict(os.environ, GIT_AUTHOR_DATE=f"2026-11-25T10:00:{self.tick:02d}Z", GIT_COMMITTER_DATE=f"2026-11-25T10:00:{self.tick:02d}Z")
        body = subject + "\n\n본문.\n"
        if trailers:
            body += "\n" + "\n".join(f"{k}: {v}" for k, v in trailers.items()) + "\n"
        subprocess.run(["git", "add", "-A"], cwd=self.dir, check=True)
        subprocess.run(["git", "commit", "-q", "--allow-empty", "-F", "-"], cwd=self.dir, input=body, text=True, env=env, check=True)
        return self.git("rev-parse", "HEAD").strip()

    def duplicate(self, sha, branch):
        """sha와 부모·트리가 같은 커밋을 새로 만들어 branch로 둔다(병합 양쪽에서 같은 변경이 들어온 경우)."""
        tree, parent, message = self.git("show", "-s", "--format=%T%n%P%n%B", sha).split("\n", 2)
        env = dict(os.environ, GIT_AUTHOR_DATE="2026-11-25T11:00:00+0900", GIT_COMMITTER_DATE="2026-11-25T11:00:00+0900")
        dup = subprocess.run(["git", "commit-tree", tree, "-p", parent], cwd=self.dir, input=message, text=True, env=env, capture_output=True, check=True).stdout.strip()
        self.git("branch", "-f", branch, dup)
        return dup

    def run(self, script, *args):
        result = subprocess.run([sys.executable, script, *args], cwd=self.dir, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr


def handoff(hid, status, verdict=None):
    t = {"Agent": "claude", "Handoff": f"docs/handoff/{hid}-x/", "Status": status}
    if verdict is not None:
        t["Verified-By"] = verdict
    return t


def ledger(n, rows, k=None):
    head = f"### 발견 원장 — verify {n}" + (f" 정정(round {k})" if k else "")
    return f"\n{head}\n\n{HEADER}" + "".join(f"| {' | '.join(r)} |\n" for r in rows) + "\n"


def rows_of(out, hid):
    return {int(line.split("\t")[1]): line.split("\t") for line in out.splitlines() if line.startswith(hid + "\t") and line.split("\t")[1].isdigit()}


class MetricsHistory(unittest.TestCase):
    """같은 날의 review · 번호가 같은 두 절 · 정정 · 판정 불명 · 옛 `# Round` 제목."""

    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        for path in CORE:
            r.write(path, "x\n")
        r.write(COVERAGE, "# Round 1 — 옛 제목\n")
        r.commit("base")
        r.commit("p", handoff("0001", "designed"))
        r.commit("i", handoff("0001", "implemented"))
        cls.v1 = r.commit("v1", handoff("0001", "verified", "claude:pass"))
        r.write(COVERAGE, "# review round 2 — 같은 날 첫째\n", append=True)
        cls.r2 = r.commit("docs(handoff-review): round 2", {"Handoff": "none", "Status": "designed"})
        cls.fix = r.commit("v1 정정", handoff("0001", "verified", "claude:fail"))
        r.commit("i2", handoff("0001", "implemented"))
        r.commit("v2", handoff("0001", "verified", "claude:pass"))
        r.write(COVERAGE, "# review round 2 — 같은 번호 둘째\n", append=True)
        r.commit("docs(handoff-review): round 2 again", {"Handoff": "none", "Status": "designed"})
        r.commit("p", handoff("0002", "designed"))
        r.commit("v", handoff("0002", "verified", "pending"))
        r.commit("v추가", handoff("0002", "verified", ""))
        _, cls.out, _ = r.run(METRICS, "--last", "10")

    def interval(self, label):
        line = next(l for l in self.out.splitlines() if l.startswith(label + "\t"))
        return line.split("\t")

    def test_counts_actual_rounds_and_unknown_verdicts(self):
        self.assertIn("verify 회차 3(handoff 2) · 판정 불명 1", self.out)

    def test_same_day_reviews_and_duplicate_numbers_are_separate_intervals(self):
        one, two, two_b = self.interval("1"), self.interval("2"), self.interval("2b")
        # 정정 커밋은 회차를 늘리지 않고, 회차 판정은 마지막 커밋(claude:fail)이다.
        self.assertEqual(one[3:7], ["1", "0", "1", "0"])
        self.assertEqual(two[3:8], ["1", "1", "0", "0", "0"])
        self.assertEqual(two_b[3:9], ["1", "0", "0", "1", "0", "-"])  # 판정 불명은 FAIL% 분자·분모에서 뺀다
        self.assertIn("배정 합계 3 = 회차 3", self.out)

    def test_list_shows_the_correction_as_an_update(self):
        _, out, _ = self.repo.run(METRICS, "--list", "1")
        # 제목에 판정어가 없고 Next-Action도 없으면 fail 종류를 특정하지 않는다
        self.assertIn(f"0001 verify 1\t{self.v1[:8]}\tFAIL·RTP · 같은 회차 갱신 {self.fix[:8]}", out)


class MetricsLedger(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        for path in CORE:
            r.write(path, "x\n")
        r.write(COVERAGE, "# review round 1 — r\n")
        cls.base = r.commit("base")
        B = lambda i, d="BLOCKING", p="—", n="열림", c="—": (i, d, p, n, c, "새 실행")
        docs = {
            # 빈 원장 뒤 신규 1건(0 → 1)
            "0001": ledger(1, []) + ledger(2, [B("D1")]),
            # 종결 후 재개: F 1 → 0 → 1
            "0002": ledger(1, [B("D1")]) + ledger(2, [B("D1", p="closed 보고", n="닫힘")]) + ledger(3, [B("D1", p="닫힘")]),
            # 같은 F 수열 1 → 0 → 1이지만 셋째는 다른 ID의 신규
            "0003": ledger(1, [B("D1")]) + ledger(2, [B("D1", p="closed 보고", n="닫힘")]) + ledger(3, [B("D2", c="명시 이월")]),
            # 비차단으로 분류 이동
            "0004": ledger(1, [B("D1")]) + ledger(2, [B("D1", d="NEXT_HANDOFF(확장)", p="열림")]),
            # 판정 정정과 원장 재구성 — 회차는 1, 유효 F는 정정 값
            "0005": ledger(1, [B("D1")]) + ledger(1, [B("D1"), ("G1", "PLAN_GAP", "—", "열림", "검사 완료", "기존 증거 재분류")], k=7)
            + "\n| 원장 밖 | 표 | a | b | c | d |\n",
            # 오타 · 충돌 중복 · 같은 정정 번호의 상충 · 표 없는 원장
            "0006": ledger(1, [B("D1", d="BLOCKNG")]) + ledger(2, [B("D1"), B("D1", n="닫힘")])
            + ledger(3, [B("D1")], k=4) + ledger(3, [B("D2")], k=4) + "\n### 발견 원장 — verify 4\n\n본문만 있다.\n",
            # 회차 누락
            "0007": ledger(1, [B("D1")]) + ledger(3, [B("D1", p="열림")]),
        }
        for hid, text in docs.items():
            r.write(f"docs/handoff/{hid}-x/verify.md", "# Verify\n" + text)
        r.write("docs/handoff/0008-x/verify.md", "# Verify\n원장이 없다.\n")
        r.commit("ledgers")
        cls.code, cls.out, cls.err = r.run(METRICS)

    def test_scope_line_counts_files_with_and_without_ledgers(self):
        self.assertRegex(self.out, r"verify\.md 8 · 원장 보유 7 · 원장 없음\(F 복원 불가\) 1 · 원장 형식 오류 4")
        self.assertEqual(self.code, 1)

    def test_empty_ledger_then_one_new(self):
        rows = rows_of(self.out, "0001")
        self.assertEqual((rows[1][3], rows[2][3], rows[2][5]), ("0", "1", "1"))

    def test_reopen_and_new_are_distinguished_under_the_same_f_sequence(self):
        reopened, fresh = rows_of(self.out, "0002"), rows_of(self.out, "0003")
        self.assertEqual([reopened[n][3] for n in (1, 2, 3)], ["1", "0", "1"])
        self.assertEqual([fresh[n][3] for n in (1, 2, 3)], ["1", "0", "1"])
        self.assertEqual((reopened[3][7], reopened[3][5]), ("1", "0"))  # 재개 1 · 신규 0
        self.assertEqual((fresh[3][7], fresh[3][5]), ("0", "1"))  # 재개 0 · 신규 1
        self.assertEqual(reopened[2][8], "1")  # 실제 종결

    def test_classification_move(self):
        self.assertEqual(rows_of(self.out, "0004")[2][9], "1")

    def test_correction_keeps_history_and_stops_at_table_end(self):
        row = rows_of(self.out, "0005")[1]
        self.assertEqual((row[2], row[3], row[4]), ("정정 7", "2", "원 F 1 → 정정 7 F 2"))
        self.assertIn("권고 신호\tG1", self.out)

    def test_errors_are_not_zero_counts(self):
        self.assertIn("D1 값 오류 — disposition `BLOCKNG`", self.out)
        self.assertIn("ID D1가 서로 다른 내용으로 2번", self.out)
        self.assertIn("같은 회차·정정 번호의 원장이 서로 다르다", self.out)
        self.assertIn("verify 4: 원장 표 머리가 없거나", self.out)
        self.assertEqual(rows_of(self.out, "0006")[1][3], "판정 불가")
        self.assertEqual(rows_of(self.out, "0006")[3][3], "판정 불가")

    def test_missing_round_is_reported(self):
        self.assertIn("0007\tverify 2\t원장 없음 — 2→3 전이를 복원할 수 없다", self.out)
        self.assertEqual(rows_of(self.out, "0007")[3][5:10], ["-"] * 5)

    def test_size_at_bad_ref_and_absent_file(self):
        code, _, err = self.repo.run(METRICS, "--size-at", "no-such-ref")
        self.assertEqual(code, 2)
        self.assertIn("커밋을 가리키지 않는다", err)
        self.repo.write("tmp.txt", "")
        os.remove(os.path.join(self.repo.dir, CORE[0]))
        self.repo.commit("drop plan skill")
        _, out, _ = self.repo.run(METRICS, "--size-at", self.base)
        line = next(l for l in out.splitlines() if l.startswith("HEAD\t"))
        self.assertIn(CORE[0], line.split("\t")[3])
        base_line = next(l for l in out.splitlines() if l.startswith(self.base + "\t"))
        self.assertEqual(base_line.split("\t")[3], "-")


class InstructionDelta(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        r.write("doc.md", "- 옵션 `--strict`를 쓴다(0101 r2).\n- 상태 `verified`는 유지한다.\n- 별개 줄\n")
        r.write("pool.md", "pool\n")
        r.write("corpus.md", "## P1 — 하나\n## P2 — 둘\n## P3 — 셋\n")
        cls.base = r.commit("v1")
        r.write("doc.md", "- 옵션 `--strict-old`를 쓴다(0101 r2).\n- 상태 `verified`가 유지된다.\n- 별개 줄\n")
        r.write("new.md", "새 파일\n")
        r.write("corpus.md", "## P1 — 하나\n## P3 — 셋\n## P3 — 셋 사본\n## P4 — 둘\n")
        cls.head = r.commit("v2")

    def test_similar_option_name_is_not_preserved(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "doc.md")
        self.assertEqual(code, 0)
        self.assertRegex(out, r"잃음\t--strict\t")
        self.assertNotIn("verified", out)  # 한글 조사가 붙은 같은 토큰은 보존

    def test_unchanged_comparison_is_zero_candidates_and_success(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.head, "--head", self.head, "doc.md")
        self.assertEqual((code, "후보 0" in out), (0, True))

    def test_real_new_file_succeeds(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "new.md")
        self.assertEqual((code, "신규 파일" in out), (0, True))

    def test_input_errors_fail_with_a_cause(self):
        cases = [
            (["--base", "no-such-ref", "doc.md"], "--base `no-such-ref`"),
            (["--base", self.base, "--head", "no-such-ref", "doc.md"], "--head `no-such-ref`"),
            (["--base", self.base, "--pool", "missing.md", "doc.md"], "--pool `missing.md`"),
            (["--base", self.base, "missing.md"], "어느 판본에도 없다"),
            (["--base", self.base, "--map", "doc.md", "doc.md"], "old=new 꼴이 아니다"),
            (["--base", self.base, "--map", "doc.md=gone.md", "doc.md"], "`gone.md`가 없다"),
        ]
        for args, cause in cases:
            with self.subTest(args=args):
                code, _, err = self.repo.run(DELTA, *args)
                self.assertEqual(code, 2)
                self.assertIn(cause, err)

    def test_pset_reports_removal_duplicate_and_renumber(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "--pset", "corpus.md")
        self.assertEqual(code, 0)
        self.assertIn("삭제\tP2", out)
        self.assertIn("추가\tP4", out)
        self.assertIn("중복\tP3", out)
        self.assertIn("번호 변경\tP2 → P4", out)



class MetricsRecovery(unittest.TestCase):
    """여러 Handoff trailer · 부모·트리가 같은 중복 커밋 · 같은 코드의 별개 재검증 · 명시 기록과의 충돌."""

    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        for path in CORE:
            r.write(path, "x\n")
        r.write(COVERAGE, "# review round 1 — r\n")
        for hid in ("0010", "0011", "0020", "0030"):
            r.write(f"docs/handoff/{hid}-x/verify.md", "# Verify\n\n# r2 검증\n")
        r.write("docs/handoff/0040-x/verify.md", "# Verify\n\n# r3 검증\n")
        r.commit("base")
        both = lambda status, verdict=None: {**handoff("0010", status, verdict), "Handoff": "docs/handoff/0010-x/\nHandoff: docs/handoff/0011-x/"}
        r.commit("p", both("designed"))
        r.commit("i", both("implemented"))
        r.commit("0010 r1 검증 RETURN_TO_PLAN", handoff("0010", "verified", "claude:fail"))
        r.commit("0011 r1 검증 FAIL", handoff("0011", "verified", "claude:fail"))
        r.commit("i2", both("implemented"))
        r.commit("0010 r2 검증 PASS", handoff("0010", "verified", "claude:pass"))
        r.commit("0011 r2 검증 PASS", handoff("0011", "verified", "claude:pass"))
        # 0020: r1 검증 커밋이 병합 양쪽에서 두 번 들어온다(부모·트리 같음)
        r.commit("p", handoff("0020", "designed"))
        cls.v20 = r.commit("0020 r1 검증 RETURN_TO_PLAN", handoff("0020", "verified", "claude:fail"))
        cls.dup = r.duplicate(cls.v20, "other")
        r.git("merge", "-q", "--no-ff", "-m", "merge other", "other")
        r.commit("p2", handoff("0020", "designed"))
        r.commit("0020 r2 검증 PASS", handoff("0020", "verified", "claude:pass"))
        # 0030: 같은 트리지만 부모가 다른 재검증 — 합치지 않는다
        r.commit("p", handoff("0030", "designed"))
        r.commit("0030 r1 검증 FAIL", handoff("0030", "verified", "claude:fail"))
        r.commit("p2 (빈 설계 턴)", handoff("0030", "designed"))
        r.commit("0030 r2 검증 PASS", handoff("0030", "verified", "claude:pass"))
        # 0040: 커밋은 2회인데 verify.md는 r3까지 적었다 — 해소할 수 없는 충돌
        r.commit("p", handoff("0040", "designed"))
        r.commit("0040 r1 검증 FAIL", handoff("0040", "verified", "claude:fail"))
        r.commit("i", handoff("0040", "implemented"))
        r.commit("0040 r2 검증 PASS", handoff("0040", "verified", "claude:pass"))

    def handoff_line(self, hid):
        _, out, _ = self.repo.run(METRICS, "--handoff", hid)
        return next(l for l in out.splitlines() if l.startswith(hid + "\t") and "→" in l or l.startswith(hid + "\t") and "\t복원" in l).split("\t")

    def test_multiple_handoff_trailers_reach_each_handoff(self):
        self.assertEqual(self.handoff_line("0010")[1:4], ["2", "RETURN_TO_PLAN → PASS", "일치"])
        self.assertEqual(self.handoff_line("0011")[1:4], ["2", "FAIL → PASS", "일치"])

    def test_same_parent_and_tree_is_one_commit(self):
        line = self.handoff_line("0020")
        self.assertEqual(line[1:4], ["2", "RETURN_TO_PLAN → PASS", "일치"])
        self.assertIn(self.dup[:8], line[4])

    def test_same_tree_with_different_parent_stays_separate(self):
        self.assertEqual(self.handoff_line("0030")[1:3], ["2", "FAIL → PASS"])

    def test_unresolvable_conflict_is_reported_and_excluded(self):
        code, out, _ = self.repo.run(METRICS)
        self.assertIn("0040\t2\tFAIL → PASS\t복원 불가 — 커밋 2회 ↔ verify.md 명시 3회", out)
        self.assertIn("복원 불가 handoff 1(회차 2)", out)
        self.assertIn("verify 회차 10(handoff 5)", out)


class MetricsLedgerStrict(unittest.TestCase):
    """빈 ID · 잘못된 disposition · 누락 ID · 잘못된 최신 정정 · 근거 없는 닫힘 · --handoff 범위."""

    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        for path in CORE:
            r.write(path, "x\n")
        r.write(COVERAGE, "# review round 1 — r\n")
        B = lambda i, d="BLOCKING", p="—", n="열림": (i, d, p, n, "—", "새 실행")
        docs = {
            "0050": ledger(1, [B("")]) + ledger(2, [B("D1", d="BLOCKING_typo")]),
            # D1이 종결·분류 이동 기록 없이 사라진다 → verify 2 판정 불가, verify 3 전이 확인 불가
            "0051": ledger(1, [B("D1")]) + ledger(2, [B("D2")]) + ledger(3, [B("D2", p="열림")]),
            # 최신 정정이 잘못됐다 → 원 F는 이력에 남고 유효 F는 판정 불가
            "0052": ledger(1, [B("D1")]) + ledger(1, [B("D1"), B("G1", d="PLAN_GAP", p="열린")], k=5) + ledger(2, [B("D1", p="closed 보고", n="닫힘")]),
            # 앞 원장에 verify 종결 확인이 없는데 닫힘
            "0053": ledger(1, [B("D1")]) + ledger(2, [B("D1", p="닫힘")]),
            # 미해결 없는 유효한 빈 원장
            "0054": ledger(1, []),
        }
        for hid, text in docs.items():
            r.write(f"docs/handoff/{hid}-x/verify.md", "# Verify\n" + text)
        r.commit("ledgers")
        cls.code, cls.out, _ = r.run(METRICS)

    def test_empty_id_and_typo_disposition_are_rejected(self):
        self.assertIn("(빈 ID) 값 오류 — 빈 발견 ID", self.out)
        self.assertIn("D1 값 오류 — disposition `BLOCKING_typo`", self.out)
        self.assertEqual([rows_of(self.out, "0050")[n][3] for n in (1, 2)], ["판정 불가", "판정 불가"])
        self.assertEqual(self.code, 1)

    def test_dropped_open_id_makes_the_round_undeterminable(self):
        rows = rows_of(self.out, "0051")
        self.assertEqual((rows[1][3], rows[2][3]), ("1", "판정 불가"))
        self.assertIn("0051 verify 2: 직전에 열린 D1가 종결·분류 이동 기록 없이 빠졌다", self.out)
        self.assertEqual(rows[3][5:10], ["-"] * 5)

    def test_invalid_latest_correction_keeps_history(self):
        row = rows_of(self.out, "0052")[1]
        self.assertEqual((row[3], row[4]), ("판정 불가", "원 F 1 → 정정 5 F 판정 불가"))
        self.assertEqual(rows_of(self.out, "0052")[2][5:10], ["-"] * 5)

    def test_closed_without_verify_confirmation_is_an_error(self):
        self.assertIn("0053 verify 2: D1: 직전 상태 닫힘인데 앞 원장에 verify 종결 확인이 없다", self.out)
        self.assertEqual(rows_of(self.out, "0053")[2][3], "판정 불가")

    def test_valid_empty_ledger_is_zero(self):
        self.assertEqual(rows_of(self.out, "0054")[1][3], "0")

    def test_handoff_scope_counts_only_that_handoff(self):
        _, out, _ = self.repo.run(METRICS, "--handoff", "0054")
        self.assertIn("발견 원장(handoff 0054): verify.md 1 · 원장 보유 1 · 원장 없음(F 복원 불가) 0", out)


class InstructionDeltaStrict(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = cls.repo = Repo()
        r.write("doc.md", "- 조용히 하려면 `-q`를 붙인다.\n")
        r.write("gone.md", "- 지울 문서\n")
        r.write("corpus.md", "## P1 — 하나\n")
        r.write("dir/a.md", "a\n")
        cls.base = r.commit("v1")
        r.write("doc.md", "- 조용히 하려면 `-v`를 붙인다.\n")
        os.remove(os.path.join(r.dir, "gone.md"))
        cls.head = r.commit("v2")

    def test_short_backtick_option_change_is_a_candidate(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "--prose", "doc.md")
        self.assertEqual(code, 0)
        self.assertRegex(out, r"잃음\t-q\t")

    def test_pset_alone_rejects_pool_and_map(self):
        for extra in (["--pool", "doc.md"], ["--map", "doc.md=doc.md"]):
            with self.subTest(extra=extra):
                code, _, err = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "--pset", "corpus.md", *extra)
                self.assertEqual(code, 2)
                self.assertIn("--pset 단독 실행은 --pool·--map을 쓰지 않는다", err)
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "--pset", "corpus.md", "--pool", "corpus.md", "doc.md")
        self.assertEqual(code, 0)
        self.assertIn("P 변경 전 1", out)

    def test_directory_target_is_an_input_error(self):
        for args in (["--base", self.base, "--head", self.head, "dir"], ["--base", self.base, "dir"]):
            with self.subTest(args=args):
                code, _, err = self.repo.run(DELTA, *args)
                self.assertEqual(code, 2)
                self.assertIn("디렉터리", err)

    def test_deleted_file_is_compared_normally(self):
        code, out, _ = self.repo.run(DELTA, "--base", self.base, "--head", self.head, "gone.md")
        self.assertEqual(code, 0)
        self.assertIn("변경 후 판본 없음(삭제)", out)


if __name__ == "__main__":
    unittest.main()
