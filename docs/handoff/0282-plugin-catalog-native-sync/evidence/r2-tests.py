"""Run the saved non-DB r2 regression set without changing the SQLite ABI."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[4]
files = json.loads(Path(__file__).with_name('r2-test-files.json').read_text(encoding='utf-8'))
output = ROOT / 'work' / 'handoff-0282-r2-recheck'
output.mkdir(parents=True, exist_ok=True)
raise SystemExit(subprocess.run([
    'node', 'node_modules/vitest/vitest.mjs', 'run', *files, '--maxWorkers=2',
    '--reporter=json', '--outputFile=' + str(output / 'tests.json')
], cwd=ROOT / 'app').returncode)
