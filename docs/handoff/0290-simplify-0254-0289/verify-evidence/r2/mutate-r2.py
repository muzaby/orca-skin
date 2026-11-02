#!/usr/bin/env python3
"""0290 r2 verify mutation runner (r1 runner + clean-failure subtraction + repro injection).

usage: python3 -I mutate-r2.py <mutations.json> <clean-failed-ids.txt> <out.json> [id-substring]

mutations.json: list of
  {id, file (relative to app/), replacement: {from,to} | {pattern,flags,to} | {from,to,all|nth} | [..] | null,
   tests: [..], extraFiles?: [{src: <repo-relative>, dst: <app-relative>}]}
clean-failed-ids.txt: `vitest-failed-ids.mjs` output of an unmutated full run in the same environment
  (lines `app/<file>\t<ancestors > title>`). Failures listed there are not counted as detection.
Result per mutation: CAUGHT (a failure outside the clean set), MISSED (no new failure),
COLLECTION (only file-level failures outside the clean set), NOAPPLY (pattern not found / ambiguous),
GREEN (replacement null and every listed case passed outside the clean set — used for repro-at-HEAD runs).
Every source file and every injected file is restored or removed byte-for-byte after each run.
"""
import json, os, pathlib, re, shutil, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[5]
APP = REPO / 'app'
src, clean_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
flt = sys.argv[4] if len(sys.argv) > 4 else None
muts = json.load(open(src))
clean = set(l.rstrip('\n') for l in open(clean_path) if l.strip())


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
            flags |= {'m': re.M, 's': re.S, 'i': re.I}.get(ch, 0)
        pat = re.compile(spec['pattern'], flags)
        if not pat.findall(text):
            return None
        py_to = re.sub(r'\$(\d)', r'\\\1', rep['to'])
        return pat.sub(py_to, text, count=0 if 'g' in spec.get('flags', '') else 1)
    if rep.get('all'):
        return text.replace(rep['from'], rep['to']) if rep['from'] in text else None
    if 'nth' in rep:
        parts = text.split(rep['from'])
        k = rep['nth']
        if len(parts) - 1 <= k:
            return None
        return rep['from'].join(parts[:k + 1]) + rep['to'] + rep['from'].join(parts[k + 1:])
    if text.count(rep['from']) != 1:
        return None
    return text.replace(rep['from'], rep['to'])


results = []
for m in muts:
    if flt and flt not in m['id']:
        continue
    rec = {'id': m['id'], 'file': m.get('file'), 'tests': m['tests']}
    path = APP / m['file'] if m.get('file') else None
    original = path.read_bytes() if path else None
    mutated = None
    if m.get('replacement') is not None:
        mutated = apply(original.decode('utf8'), m['replacement'])
        if mutated is None:
            rec['result'] = 'NOAPPLY'
            results.append(rec)
            print(m['id'], 'NOAPPLY', flush=True)
            continue
    injected = []
    report = tempfile.mktemp(suffix='.json')
    try:
        for extra in m.get('extraFiles', []):
            dst = APP / extra['dst']
            assert not dst.exists(), dst
            shutil.copyfile(REPO / extra['src'], dst)
            injected.append(dst)
        if mutated is not None:
            path.write_bytes(mutated.encode('utf8'))
        subprocess.run([str(APP / 'node_modules/.bin/vitest'), 'run', *m['tests'],
                        '--reporter=json', '--outputFile=' + report],
                       cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1200)
    finally:
        if mutated is not None:
            path.write_bytes(original)
        for dst in injected:
            dst.unlink()
    try:
        r = json.load(open(report))
        new_failed, clean_failed, collection, total = [], [], [], 0
        for f in r['testResults']:
            rel = 'app/' + os.path.relpath(f['name'], APP).replace('\\', '/')
            fa = [a for a in f['assertionResults'] if a['status'] == 'failed']
            total += len(f['assertionResults'])
            if f['status'] != 'passed' and not fa and (rel + '\t<file-level>') not in clean:
                collection.append(rel)
            for a in fa:
                ident = rel + '\t' + ' > '.join([*a.get('ancestorTitles', []), a['title']])
                (clean_failed if ident in clean else new_failed).append(ident)
        rec.update(total=total, failed=new_failed, cleanFailed=clean_failed, collection=collection)
        if m.get('replacement') is None:
            rec['result'] = 'RED' if new_failed or collection else 'GREEN'
        else:
            rec['result'] = 'CAUGHT' if new_failed else ('COLLECTION' if collection else 'MISSED')
    except Exception as e:  # noqa
        rec['result'] = 'NOREPORT:' + str(e)
    results.append(rec)
    print(m['id'], rec['result'], len(rec.get('failed', [])), 'of', rec.get('total'), flush=True)

json.dump(results, open(out, 'w'), ensure_ascii=False, indent=1)
dirty = subprocess.run(['git', 'status', '--short', '--', 'app'], cwd=REPO, capture_output=True, text=True).stdout
print('app tree status after run:', repr(dirty))
