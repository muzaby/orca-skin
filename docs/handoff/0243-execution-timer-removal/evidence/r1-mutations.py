"""Run the six planned mutations and two negative-oracle sensitivity checks.

Run sequentially, with no other test/build process using this checkout.
Every mutation restores the original bytes in finally, including on failure.
"""

import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[4]
APP = ROOT / "app"
EVIDENCE = Path(__file__).resolve().parent
COORDINATOR = "app/src/main/features/chat/turn-coordinator.ts"
COORDINATOR_TEST = "src/main/features/chat/turn-coordinator.test.ts"
HANDLER_TEST = "src/main/app/chat-turn/post-turn.schedules.test.ts"

MUTATIONS = [
    (
        "M1-normal-return",
        COORDINATOR,
        "          deliverAbortTerminal()\n          closeBoundary()",
        "          closeBoundary()",
        COORDINATOR_TEST,
    ),
    (
        "M2-aborted-catch",
        COORDINATOR,
        "          if (turn.controller.signal.aborted) {\n            deliverAbortTerminal()\n            closeAfterFailure()",
        "          if (turn.controller.signal.aborted) {\n            closeAfterFailure()",
        COORDINATOR_TEST,
    ),
    (
        "M3-backoff-catch",
        COORDINATOR,
        "            } catch {\n              deliverAbortTerminal()\n              closeAfterFailure()",
        "            } catch {\n              closeAfterFailure()",
        COORDINATOR_TEST,
    ),
    (
        "M4-handler-ack",
        "app/src/main/app/chat-turn/index.ts",
        "    turn.abortAcknowledged = true\n",
        "",
        HANDLER_TEST,
    ),
    (
        "M5-stream-terminal-flag",
        COORDINATOR,
        "              this.emit(turn, ev)\n              if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {\n                terminalForwarded = true\n              }",
        "              this.emit(turn, ev)",
        COORDINATOR_TEST,
    ),
    (
        "M6-execution-cap",
        COORDINATOR,
        "    let terminalForwarded = false",
        "    setTimeout(() => turn.controller.abort(), 120_000)\n    let terminalForwarded = false",
        COORDINATOR_TEST,
    ),
]

SOURCE_ORACLE = [
    "rg", "-n",
    "STALL_TIMEOUT_MS|createStallTimer|armStall|beginApprovalPause|activeStall|'stall'|timedOut",
    "app/src/main", "--glob", "!**/*.test.ts", "--glob", "!**/background-controller.ts",
]
DOC_ORACLE = ["rg", "-n", "-i", r"\bstall\b|idle timeout", "docs/arch", "docs/IPC_CONTRACT.md"]


def run_test(test, result_path):
    command = [
        "node", "node_modules/vitest/vitest.mjs", "run", test,
        "--maxWorkers=1", "--reporter=json", f"--outputFile={result_path}",
    ]
    result = subprocess.run(command, cwd=APP, capture_output=True, timeout=120)
    if not result_path.exists():
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
    report = json.loads(result_path.read_text(encoding="utf-8"))
    failed = [
        case["fullName"]
        for suite in report["testResults"]
        for case in suite["assertionResults"]
        if case["status"] == "failed"
    ]
    return {
        "exit": result.returncode,
        "tests": report["numTotalTests"],
        "passed": report["numPassedTests"],
        "failed": report["numFailedTests"],
        "failedTests": failed,
        "command": command[:-1],
    }


def main():
    results = []
    with tempfile.TemporaryDirectory(prefix="orca-0243-") as scratch:
        for name, relative, before, after, test in MUTATIONS:
            target = ROOT / relative
            original = target.read_bytes()
            source = original.decode("utf-8").replace("\r\n", "\n")
            assert source.count(before) == 1, (name, source.count(before))
            try:
                target.write_text(source.replace(before, after), encoding="utf-8", newline="\n")
                result = run_test(test, Path(scratch) / f"{name}.json")
                result.update(id=name, source=relative)
                assert result["exit"] != 0 and result["failedTests"], result
                results.append(result)
                print(json.dumps(result, ensure_ascii=True), flush=True)
            finally:
                target.write_bytes(original)
        for name, relative, text, command in [
            ("O1-source-negative", COORDINATOR, "\n// 'stall'\n", SOURCE_ORACLE),
            ("O2-doc-negative", "docs/arch/backend/runtime-ipc.md", "\nidle timeout\n", DOC_ORACLE),
        ]:
            target = ROOT / relative
            original = target.read_bytes()
            baseline = subprocess.run(command, cwd=ROOT, capture_output=True)
            assert baseline.returncode == 1 and not baseline.stdout, name
            try:
                target.write_bytes(original + text.encode("utf-8"))
                result = subprocess.run(command, cwd=ROOT, capture_output=True)
                assert result.returncode == 0 and result.stdout, name
                results.append({
                    "id": name, "baselineMatches": 0,
                    "injectedMatches": len(result.stdout.splitlines()), "command": command,
                })
            finally:
                target.write_bytes(original)
        for test in [COORDINATOR_TEST, HANDLER_TEST]:
            result = run_test(test, Path(scratch) / (Path(test).name + ".json"))
            assert result["exit"] == 0 and result["failed"] == 0, result
            results.append({"id": "restored", "test": test, **result})
            print(json.dumps(results[-1], ensure_ascii=True), flush=True)
    (EVIDENCE / "r1-mutations.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
