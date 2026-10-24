"""Run the r2 regression set and every renderer consumer without changing SQLite ABI."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[4]
APP = ROOT / 'app'
prior = json.loads(Path(__file__).with_name('r2-test-files.json').read_text(encoding='utf-8'))
renderer = [p.relative_to(APP).as_posix()
            for pattern in ('*.test.ts', '*.test.tsx')
            for p in (APP / 'src/renderer').rglob(pattern)]
files = sorted(set(prior + renderer + ['src/main/app/bootstrap.harness.test.ts']))
output = ROOT / 'work/handoff-0282-r2-2'
output.mkdir(parents=True, exist_ok=True)
(output / 'files.json').write_text(json.dumps(files, indent=2) + '\n', encoding='utf-8')
# A directory filter keeps the Windows command line below its length limit.
filters = ['src/renderer'] + [f for f in files if not f.startswith('src/renderer/')]
raise SystemExit(subprocess.run([
    'node', 'node_modules/vitest/vitest.mjs', 'run', *filters, '--maxWorkers=2',
    '--reporter=json', '--outputFile=' + str(output / 'regression.json')
], cwd=APP).returncode)
