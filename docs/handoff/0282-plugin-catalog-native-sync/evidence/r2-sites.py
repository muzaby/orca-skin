"""Recheck the r2 fixed-site inventory; behavior oracles are recorded in plan.md."""
from pathlib import Path
import json
import re
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[4]
DATA = json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))


def differences(actual, classified):
    return sorted(actual - classified), sorted(classified - actual)


covered = set(DATA['negativeGate'])
classified_count = 0
for query in DATA['queries']:
    match = re.fullmatch(r'rg -n "(.*?)" (.*)', query['command'])
    args = ['rg', '-n', match[1].replace(r'\|', '|'), *shlex.split(match[2]),
            '-g', '!*.test.ts', '-g', '!*.test.tsx']
    run = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    assert run.returncode in (0, 1), run.stderr
    actual = set(run.stdout.replace('\\', '/').splitlines())
    classified = {row['line'] for row in query['matches']}
    assert differences(actual, classified) == ([], []), (query['ep'], differences(actual, classified))
    # A dropped classification must be detected, even when another row has the same site ID.
    for line in classified:
        assert line in differences(actual, classified - {line})[0]
    classified_count += len(classified)
    covered.update(row['classification'] for row in query['matches']
                   if not row['classification'].startswith('exclude:'))

for row in DATA['supplement']:
    lines = (ROOT / row['file']).read_text(encoding='utf-8').splitlines()
    found = [i + 1 for i, line in enumerate(lines) if row['needle'] in line]
    assert found == row['lines'], (row['id'], found)
    covered.add(row['id'])

expected = set(DATA['expected'])
assert len(expected) == len(DATA['expected']) == 117
assert differences(expected, covered) == ([], []), differences(expected, covered)
for site in expected:
    assert site in differences(expected, covered - {site})[0]
subprocess.run(['python', str(Path(__file__).with_name('r2-gates.py'))], cwd=ROOT, check=True)
print(f'classified lines={classified_count}; supplements={len(DATA["supplement"])}; '
      f'fixed sites={len(expected)}; unclassified=[]; missing=[]; extra=[]; '
      'classification/site omission controls passed')
