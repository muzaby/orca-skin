#!/usr/bin/env python3
"""Mutation runner for 0290 verify.

usage: python3 mutate.py <mutations.json> <out.json> [id-filter-substring]
mutations.json: list of {id, file (relative to app/), replacement: {from,to} | {pattern,flags,to} | [..], tests: [..]}
Each mutation is applied to the working tree, the listed vitest files run with a JSON reporter,
and the file is restored byte-for-byte. Result: CAUGHT (assertion failure), MISSED (all green),
COLLECTION (no assertions failed but a file failed), NOAPPLY (pattern not found exactly once).
"""
import json, os, re, subprocess, sys, tempfile

import pathlib
APP = str(pathlib.Path(__file__).resolve().parents[4] / 'app')
src, out = sys.argv[1], sys.argv[2]
flt = sys.argv[3] if len(sys.argv) > 3 else None
muts = json.load(open(src))
if isinstance(muts, dict):
    muts = muts['mutations']
results = []

def apply(text, rep):
    if isinstance(rep, list):
        for r in rep:
            text = apply(text, r)
            if text is None:
                return None
        return text
    if 'pattern' in rep or isinstance(rep.get('from'), dict):
        spec = rep['from'] if isinstance(rep.get('from'), dict) else rep
        flags = 0
        for ch in spec.get('flags', ''):
            if ch == 'm': flags |= re.M
            if ch == 's': flags |= re.S
            if ch == 'i': flags |= re.I
        pat = re.compile(spec['pattern'], flags)
        found = pat.findall(text)
        if not found:
            return None
        js_to = rep['to']
        py_to = re.sub(r'\$(\d)', r'\\\1', js_to)
        count = 0 if 'g' in spec.get('flags', '') else 1
        return pat.sub(py_to, text, count=count)
    if rep.get('all'):
        if text.count(rep['from']) < 1:
            return None
        return text.replace(rep['from'], rep['to'])
    if 'nth' in rep:
        parts = text.split(rep['from'])
        k = rep['nth']
        if len(parts) - 1 <= k:
            return None
        return rep['from'].join(parts[:k + 1]) + rep['to'] + rep['from'].join(parts[k + 1:])
    if text.count(rep['from']) != 1:
        return None
    return text.replace(rep['from'], rep['to'])

for m in muts:
    if flt and flt not in m['id']:
        continue
    path = os.path.join(APP, m['file'])
    original = open(path, 'rb').read()
    mutated = apply(original.decode('utf8'), m['replacement'])
    rec = {'id': m['id'], 'file': m['file'], 'tests': m['tests']}
    if mutated is None:
        rec['result'] = 'NOAPPLY'
        results.append(rec)
        print(m['id'], 'NOAPPLY', flush=True)
        continue
    report = tempfile.mktemp(suffix='.json')
    try:
        open(path, 'wb').write(mutated.encode('utf8'))
        subprocess.run([os.path.join(APP, 'node_modules/.bin/vitest'), 'run', *m['tests'],
                        '--reporter=json', '--outputFile=' + report],
                       cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=900)
    finally:
        open(path, 'wb').write(original)
    try:
        r = json.load(open(report))
        failed = []
        collection = []
        total = 0
        for f in r['testResults']:
            fa = [a for a in f['assertionResults'] if a['status'] == 'failed']
            total += len(f['assertionResults'])
            if f['status'] != 'passed' and not fa:
                collection.append(os.path.relpath(f['name'], APP))
            for a in fa:
                failed.append(os.path.relpath(f['name'], APP) + ' :: ' + ' > '.join([*a.get('ancestorTitles', []), a['title']]))
        rec['total'] = total
        rec['failed'] = failed
        rec['collection'] = collection
        rec['result'] = 'CAUGHT' if failed else ('COLLECTION' if collection else 'MISSED')
    except Exception as e:  # noqa
        rec['result'] = 'NOREPORT:' + str(e)
    results.append(rec)
    print(m['id'], rec['result'], len(rec.get('failed', [])), 'of', rec.get('total'), flush=True)

json.dump(results, open(out, 'w'), ensure_ascii=False, indent=1)
dirty = subprocess.run(['git', 'status', '--short'], cwd=APP, capture_output=True, text=True).stdout
print('tree status after run:', repr(dirty))
