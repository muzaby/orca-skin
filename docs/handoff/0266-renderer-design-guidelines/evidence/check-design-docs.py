from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / 'app/src/renderer/src'
CAT = ROOT / 'docs/arch/frontend/design-components.md'
ROUTES = ['AGENTS.md', 'app/AGENTS.md', 'app/src/renderer/AGENTS.md', 'docs/INDEX.md']

def check(catalog, routes):
    source = {p.relative_to(SRC).as_posix() for p in SRC.rglob('*.tsx') if '.test' not in p.name}
    rows = re.findall(r'^\| \[([^\]]+\.tsx)\]\(../../../app/src/renderer/src/([^\)]+)\)(.*?) \| (.+) \|$', catalog, re.M)
    documented = {path for _, path, _, _ in rows}
    errors = []
    if source - documented:
        errors.append('missing: ' + ', '.join(sorted(source - documented)))
    if documented - source:
        errors.append('stale: ' + ', '.join(sorted(documented - source)))
    if len(rows) != len(documented):
        errors.append('duplicate source rows')
    for label, path, exports, rule in rows:
        if label != path or len(rule.strip()) < 16 or 'MISSING' in rule:
            errors.append('invalid rule/label: ' + path)
        for symbol in re.findall(r'`([^`]+)`', exports):
            if not re.search(r'\b' + re.escape(symbol) + r'\b', (SRC/path).read_text()):
                errors.append('unknown export: ' + path + ':' + symbol)
    for path, text in routes.items():
        for name in ['design-system.md', 'design-components.md']:
            if not re.search(r'\]\([^\)\n]*' + re.escape(name) + r'\)', text):
                errors.append('missing route: ' + path + ':' + name)
    renderer = routes['app/src/renderer/AGENTS.md']
    for instruction in ['읽고 준수한다', '재사용 우선', '상태 설계', '완료 검토', '문서 갱신']:
        if instruction not in renderer:
            errors.append('missing workflow: ' + instruction)
    return errors, len(source), len(rows)

catalog = CAT.read_text()
routes = {p:(ROOT/p).read_text() for p in ROUTES}
errors, source_count, row_count = check(catalog, routes)
assert not errors, errors
print(f'catalog source={source_count}, rows={row_count}, source-minus-doc=[], doc-minus-source=[]')
print('entry routes: 4 files x 2 design links; renderer read/reuse/state/review/update instructions present')

# oracle 방향을 확인한다. 실제 문서/소스는 변경하지 않는다.
first_row = next(line for line in catalog.splitlines() if re.match(r'^\| \[[^\]]+\.tsx\]', line))
assert any('missing:' in e for e in check(catalog.replace(first_row+'\n', '', 1), routes)[0])
print('negative control: remove catalog source row -> red (missing source)')
fake = '| [shared/ui/Fake.tsx](../../../app/src/renderer/src/shared/ui/Fake.tsx) | 존재하지 않는 컴포넌트의 허위 규칙 행이다. |'
assert any('stale:' in e for e in check(catalog+'\n'+fake, routes)[0])
print('negative control: add non-existent source row -> red (stale source)')
for path in ROUTES:
    for name in ['design-system.md', 'design-components.md']:
        changed = dict(routes)
        changed[path] = changed[path].replace(name, 'missing-guide.md')
        assert any('missing route: '+path+':'+name == e for e in check(catalog, changed)[0]), (path, name)
print('negative controls: remove each entry link -> red 8/8')
