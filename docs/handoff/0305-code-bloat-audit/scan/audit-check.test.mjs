import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BLOCKS, check, extractBlock, render, replaceBlock } from './audit-check.mjs'

const FILES = { 'app/src/main/a.ts': 'export function alpha() {}\nexport function beta() {}', 'app/src/main/b.ts': 'export const gamma = 1', 'app/src/main/big/c.ts': 'l1\nl2\nl3' }
const facts = () => ({
  channels: new Set(['orca:a:one', 'orca:a:two', 'orca:b:dead']),
  features: ['chat', 'debug'],
  handoffIds: new Set(['0100', '0200']),
  fileExists: (p) => typeof p === 'string' && p in FILES,
  bucketOf: (p) => (p.includes('/big/') ? 'main/big' : 'main/x'),
  lineCount: (p) => (p in FILES ? FILES[p].split('\n').length : 0),
  fileContains: (p, t) => typeof t === 'string' && t !== '' && (FILES[p] ?? '').includes(t)
})

function valid() {
  const data = {
    volume: { totals: { files: 3, lines: 3300 }, unclassified: [], buckets: { 'main/x': { prod: { files: 1, lines: 100 }, test: { files: 1, lines: 200 } }, 'main/big': { prod: { files: 1, lines: 3000 } } } },
    scenarios: {
      scenarios: [
        { id: 'S-01', action: '보낸다', result: '응답', channels: ['orca:a:one'], features: ['chat'] },
        { id: 'S-02', action: '연다', result: '목록', channels: ['orca:a:two'], features: [] }
      ],
      unreached: { channels: [{ name: 'orca:b:dead', note: '호출부 0' }], features: [{ name: 'debug', note: '개발 전용' }] }
    },
    candidates: {
      lenses: [
        { id: 'L1', method: 'rg', denominator: 3, count: 1 },
        { id: 'L4', method: '추적', denominator: 2, count: 1 },
        { id: 'L5', method: '쌍 비교', denominator: 1, count: 1 }
      ],
      candidates: [
        { id: 'C-01', title: '죽은 채널', bucket: 'main/x', lens: 'L1', type: 'remove', scenarios: [], origin: ['0100'], preserve: '없음 — 호출부 없음', evidence: 'rg → 0', saving: { prod: 10, test: 20, basis: '핸들러 줄 수' }, risk: '낮음', approval: 'required' },
        { id: 'C-02', title: '고정 인자', bucket: 'main/x', lens: 'L4', type: 'restructure', scenarios: ['S-01'], origin: ['0100', '0200'], preserve: '응답이 온다', evidence: 'a.ts:1', saving: { prod: 5, test: 0, basis: '인자 1' }, risk: '낮음', excess: ['X1', 'X5'], decomposition: [{ cut: '고정 인자 제거', keep: '응답이 온다', files: ['app/src/main/a.ts'], scenarios: ['S-01'] }, { cut: '래퍼 제거', keep: '응답이 온다', files: ['app/src/main/b.ts'], scenarios: ['S-01', 'S-02'] }], superseded: [{ id: '0100', by: '0200', concept: '재시도 2회' }] },
        { id: 'C-03', title: '중복 쌍', bucket: 'main/x', lens: 'L5', type: 'restructure', scenarios: ['S-02'], origin: { unknown: true, search: 'rg 0[0-9]{3} a.ts' }, preserve: '목록이 보인다', evidence: 'b.ts:1', saving: { prod: 1, test: 1, basis: '쌍' }, risk: '중간', decisionChange: true, approval: 'required', decomposition: [{ cut: '쌍 합치기', keep: '목록이 보인다', files: ['app/src/main/b.ts'], scenarios: ['S-02'] }] }
      ],
      approvals: ['C-01', 'C-03']
    },
    traces: {
      traces: ['T1', 'T2', 'T3', 'T4', 'T5'].map((id) => ({
        id,
        title: '경로',
        scenario: 'S-01',
        steps: [
          { file: 'app/src/main/a.ts', symbol: 'alpha', does: '받는다', effect: 'user', excess: [] },
          { file: 'app/src/main/a.ts', symbol: 'beta', does: '전달', effect: 'none', excess: [{ x: 'X5', candidate: 'C-02' }] },
          { file: 'app/src/main/b.ts', symbol: 'gamma', does: '기록', effect: 'none', excess: [], keep: '로그 계약' }
        ]
      }))
    },
    reviews: {
      reviews: [
        { scenario: 'S-01', read: ['app/src/main/a.ts'], verdicts: { X1: ['C-02'], X2: 'none', X3: 'none', X4: 'none', X5: ['C-02'], X6: 'none', X7: 'none' } },
        { scenario: 'S-02', read: ['app/src/main/b.ts'], verdicts: { X1: 'none', X2: 'none', X3: 'none', X4: 'none', X5: 'none', X6: 'none', X7: 'none' } }
      ]
    },
    deep: { reviews: [{ bucket: 'main/big', read: ['app/src/main/big/c.ts'], verdicts: { X1: ['C-02'], X2: 'none', X3: 'none', X4: 'none', X5: 'none', X6: 'none', X7: 'none' }, density: 'excess', basis: '고정 인자가 전 호출부에 퍼져 있다' }] },
    split: { handoffs: [{ id: 'H-01', title: '첫 묶음', candidates: ['C-01', 'C-02'], scenarios: ['S-01'] }], deferred: [{ candidate: 'C-03', reason: '결정 대기' }] }
  }
  const r = render(data, facts().lineCount)
  data.auditMd = BLOCKS.map((n) => `<!-- gen:${n} -->\n${r[n]}\n<!-- /gen:${n} -->`).join('\n\n') + '\n<!-- audit:complete -->\n'
  return data
}
const rerender = (d) => {
  const r = render(d, facts().lineCount)
  for (const n of BLOCKS) d.auditMd = replaceBlock(d.auditMd, n, r[n])
}
const run = (mutate, { keepMd = false, complete = true } = {}) => {
  const d = valid()
  mutate(d)
  if (!keepMd) rerender(d)
  return check(d, facts(), { complete }).errors
}
const cand = (d, id) => d.candidates.candidates.find((c) => c.id === id)

test('green: 전부 유효한 입력은 위반 0', () => assert.deepEqual(run(() => {}), []))

// [규칙, 설명, 변이, 기대 메시지 정규식]
const RED = [
  ['K1', '채널 미귀속', (d) => d.scenarios.scenarios[1].channels.pop(), /K1 채널 미귀속 orca:a:two/],
  ['K1', 'unreached 에서 채널 제거', (d) => d.scenarios.unreached.channels.pop(), /K1 채널 미귀속 orca:b:dead/],
  ['K2', '없는 채널 참조', (d) => d.scenarios.scenarios[0].channels.push('orca:a:onee'), /K2 없는 채널 참조 orca:a:onee/],
  ['K3', 'feature 미귀속', (d) => (d.scenarios.scenarios[0].features = []), /K3 feature 미귀속 chat/],
  ['K3', '없는 feature 참조', (d) => d.scenarios.scenarios[0].features.push('chta'), /K3 없는 feature 참조 chta/],
  ...['bucket', 'lens', 'type', 'origin', 'preserve', 'evidence', 'saving', 'risk'].map((k) => ['K4', `필수 칸 제거 ${k}`, (d) => delete cand(d, 'C-02')[k], new RegExp(`K4 C-02 필수 칸 누락 ${k}`)]),
  ['K4', '필수 칸 제거 scenarios', (d) => delete cand(d, 'C-02').scenarios, /K4 C-02 필수 칸 누락 scenarios/],
  ['K4', '빈 값 preserve', (d) => (cand(d, 'C-02').preserve = ' '), /K4 C-02 필수 칸 누락 preserve/],
  ['K4', 'saving.basis 빈 값', (d) => (cand(d, 'C-02').saving.basis = ''), /K4 C-02 필수 칸 누락 saving.basis/],
  ['K5', '없는 S-ID', (d) => (cand(d, 'C-02').scenarios = ['S-99']), /K5 C-02 없는 시나리오 S-99/],
  ['K5', 'restructure + 빈 배열', (d) => (cand(d, 'C-02').scenarios = []), /K5 C-02 remove 아닌데 scenarios 빈 배열/],
  ['K6', '없는 버킷', (d) => (cand(d, 'C-02').bucket = 'main/zz'), /K6 C-02 없는 버킷 main\/zz/],
  ['K6', 'saving.prod 초과', (d) => (cand(d, 'C-02').saving.prod = 101), /K6 C-02 saving.prod 가 버킷 현재 값 초과/],
  ['K6', 'saving.test 초과', (d) => (cand(d, 'C-02').saving.test = 201), /K6 C-02 saving.test 가 버킷 현재 값 초과/],
  ['K7', '없는 출처 handoff', (d) => cand(d, 'C-01').origin.push('9999'), /K7 C-01 없는 출처 handoff 9999/],
  ['K7', '출처 미상인데 search 없음', (d) => delete cand(d, 'C-03').origin.search, /K7 C-03 출처 미상인데 search 없음/],
  ['K7b', 'superseded handoff 미실재', (d) => (cand(d, 'C-02').superseded[0].id = '0001'), /K7b C-02 superseded 의 handoff 미실재/],
  ['K7b', 'by 가 후속이 아님', (d) => (cand(d, 'C-02').superseded[0] = { id: '0200', by: '0100', concept: 'x' }), /K7b C-02 superseded.by 가 후속이 아님/],
  ['K7b', 'by 가 origin 에 없음', (d) => (cand(d, 'C-02').origin = ['0100']), /K7b C-02 superseded.by 가 origin 에 없음/],
  ['K7b', 'concept 빈 값', (d) => (cand(d, 'C-02').superseded[0].concept = ''), /K7b C-02 superseded.concept 빈 값/],
  ['K8', 'remove 인데 approval 뒤집기', (d) => (cand(d, 'C-01').approval = 'none'), /K8 C-01 승인 필요인데 approval≠required/],
  ['K8', 'remove 인데 approval 미지정', (d) => delete cand(d, 'C-01').approval, /K8 C-01 승인 필요인데 approval≠required/],
  ['K8', 'decisionChange 인데 approval 없음', (d) => delete cand(d, 'C-03').approval, /K8 C-03 승인 필요인데 approval≠required/],
  ['K8', '승인 목록에서 누락', (d) => d.candidates.approvals.pop(), /K8 승인 목록에 없음 C-03/],
  ['K8', '승인 목록의 잉여', (d) => d.candidates.approvals.push('C-02'), /K8 승인 목록의 잉여 C-02/],
  ['K9', '분할안에서 후보 누락', (d) => d.split.handoffs[0].candidates.pop(), /K9 분할안에 없는 후보 C-02/],
  ['K9', '분할안 중복', (d) => d.split.deferred.push({ candidate: 'C-01', reason: 'x' }), /K9 분할안에 2회 나온 후보 C-01/],
  ['K9', '유령 후보', (d) => d.split.handoffs[0].candidates.push('C-77'), /K9 분할안이 없는 후보 참조 C-77/],
  ['K10', '회귀 시나리오 0', (d) => (d.split.handoffs[0].scenarios = []), /K10 H-01 회귀 시나리오 0개/],
  ['K10', '없는 S-ID', (d) => (d.split.handoffs[0].scenarios = ['S-99']), /K10 H-01 없는 시나리오 S-99/],
  ['K10', 'deferred 사유 없음', (d) => (d.split.deferred[0].reason = ''), /K10 deferred C-03 사유 없음/],
  ['K11', '파일 미실재', (d) => (d.traces.traces[0].steps[0].file = 'app/src/main/zz.ts'), /K11 T1#1 파일 미실재/],
  ['K11', '심볼 미검출', (d) => (d.traces.traces[0].steps[0].symbol = 'delta'), /K11 T1#1 심볼 미검출 delta/],
  ['K11', 'effect=none 인데 근거 없음', (d) => delete d.traces.traces[0].steps[2].keep, /K11 T1#3 effect=none 인데 후보·유지 근거 없음/],
  ['K11', '추적 ID 집합', (d) => d.traces.traces.pop(), /K11 추적 ID 집합/],
  ['K11', 'excess 칸 누락', (d) => delete d.traces.traces[0].steps[0].excess, /K11 T1#1 excess 칸 누락/],
  ['K11', '추적의 없는 시나리오', (d) => (d.traces.traces[0].scenario = 'S-99'), /K11 T1 없는 시나리오 S-99/],
  ['K13', '모르는 최상위 키', (d) => (d.split.extra = 1), /K13 split.json 모르는 키 extra/],
  ['K13', '모르는 type', (d) => (cand(d, 'C-02').type = 'x'), /K13 C-02 모르는 type x/],
  ['K13', '모르는 lens', (d) => (cand(d, 'C-02').lens = 'L2'), /K13 C-02 모르는 lens L2/],
  ['K13', '모르는 effect', (d) => (d.traces.traces[0].steps[0].effect = 'maybe'), /K13 T1#1 모르는 effect maybe/],
  ['K13', '모르는 excess', (d) => cand(d, 'C-02').excess.push('X9'), /K13 C-02 모르는 excess X9/],
  ['K13', '후보의 모르는 키', (d) => (cand(d, 'C-02').note = 'x'), /K13 C-02 모르는 키 note/],
  ['K14', 'lenses 집합', (d) => d.candidates.lenses.pop(), /K14 lenses 집합/],
  ['K14', 'method 누락', (d) => (d.candidates.lenses[0].method = ''), /K14 L1 method·denominator 누락/],
  ['K14', 'denominator 누락', (d) => delete d.candidates.lenses[0].denominator, /K14 L1 method·denominator 누락/],
  ['K14', '후보 수 불일치', (d) => (d.candidates.lenses[1].count = 2), /K14 L4 후보 수 2 ≠ 행 수 1/],
  ['K17', '검토 없는 시나리오', (d) => d.reviews.reviews.pop(), /K17 검토 없는 시나리오 S-02/],
  ['K17', '없는 S-ID 의 검토', (d) => (d.reviews.reviews[1].scenario = 'S-99'), /K17 없는 시나리오의 검토 S-99/],
  ['K17', 'read 빈 배열', (d) => (d.reviews.reviews[0].read = []), /K17 S-01 read 빈 배열/],
  ['K17', 'read 미실재 파일', (d) => (d.reviews.reviews[0].read = ['app/src/zz.ts']), /K17 S-01 read 파일 미실재/],
  ['K17', '범주 판정 없음', (d) => delete d.reviews.reviews[0].verdicts.X3, /K17 S-01 X3 판정 없음/],
  ['K17', '판정의 후보 미실재', (d) => (d.reviews.reviews[0].verdicts.X1 = ['C-88']), /K17 S-01 X1 가 없는 후보 C-88 를 가리킴/],
  ['K17', 'L4 후보에 excess 없음', (d) => { delete cand(d, 'C-02').excess; d.reviews.reviews[0].verdicts.X1 = 'none'; d.reviews.reviews[0].verdicts.X5 = 'none'; for (const t of d.traces.traces) t.steps[1] = { ...t.steps[1], excess: [], keep: 'k' } }, /K17 C-02 lens=L4 인데 excess 없음/],
  ['K17', '검토 칸 범주 불일치', (d) => (d.reviews.reviews[0].verdicts.X2 = ['C-02']), /K17 S-01 X2 ↔ C-02 excess 범주 불일치/],
  ['K18', '상위 버킷에 심화 검토 없음', (d) => d.deep.reviews.pop(), /K18 심화 검토 없는 버킷 main\/big/],
  ['K18', '없는 버킷의 검토', (d) => d.deep.reviews.push({ ...d.deep.reviews[0], bucket: 'main/zz', read: ['app/src/main/a.ts'] }), /K18 없는 버킷의 심화 검토 main\/zz/],
  ['K18', 'read 빈 배열', (d) => (d.deep.reviews[0].read = []), /K18 심화 main\/big read 빈 배열/],
  ['K18', 'read 미실재 파일', (d) => (d.deep.reviews[0].read = ['app/src/main/big/zz.ts']), /K18 심화 main\/big read 파일 미실재/],
  ['K18', 'read 파일이 다른 버킷', (d) => d.deep.reviews[0].read.push('app/src/main/a.ts'), /K18 심화 main\/big read 파일이 다른 버킷 app\/src\/main\/a.ts/],
  ['K18', '범주 판정 없음', (d) => delete d.deep.reviews[0].verdicts.X3, /K18 심화 main\/big X3 판정 없음/],
  ['K18', '판정의 후보 미실재', (d) => (d.deep.reviews[0].verdicts.X1 = ['C-88']), /K18 심화 main\/big X1 가 없는 후보 C-88 를 가리킴/],
  ['K18', '판정 범주 불일치', (d) => (d.deep.reviews[0].verdicts.X2 = ['C-02']), /K18 심화 main\/big X2 ↔ C-02 excess 범주 불일치/],
  ['K18', 'excess 인데 후보 0', (d) => (d.deep.reviews[0].verdicts.X1 = 'none'), /K18 심화 main\/big density=excess 인데 후보 0/],
  ['K18', 'basis 빈 값', (d) => (d.deep.reviews[0].basis = ' '), /K18 심화 main\/big basis 빈 값/],
  ['K13', '모르는 density', (d) => (d.deep.reviews[0].density = 'dense'), /K13 심화 main\/big 모르는 density dense/],
  ['K13', '심화 검토의 모르는 키', (d) => (d.deep.reviews[0].note = 'x'), /K13 심화 main\/big 모르는 키 note/],
  ['K13', '분해 단계의 모르는 키', (d) => (cand(d, 'C-02').decomposition[0].order = 1), /K13 C-02 분해 1단계 모르는 키 order/],
  ['K19', 'restructure 에 decomposition 없음', (d) => delete cand(d, 'C-02').decomposition, /K19 C-02 restructure 인데 decomposition 없음/],
  ['K19', 'decomposition 빈 배열', (d) => (cand(d, 'C-03').decomposition = []), /K19 C-03 restructure 인데 decomposition 없음/],
  ['K19', 'cut 빈 값', (d) => (cand(d, 'C-02').decomposition[1].cut = ''), /K19 C-02 분해 2단계 cut 빈 값/],
  ['K19', 'keep 빈 값', (d) => delete cand(d, 'C-02').decomposition[0].keep, /K19 C-02 분해 1단계 keep 빈 값/],
  ['K19', 'files 빈 배열', (d) => (cand(d, 'C-02').decomposition[0].files = []), /K19 C-02 분해 1단계 files 빈 배열/],
  ['K19', 'files 미실재', (d) => (cand(d, 'C-02').decomposition[0].files = ['app/src/zz.ts']), /K19 C-02 분해 1단계 files 미실재 app\/src\/zz.ts/],
  ['K19', 'scenarios 빈 배열', (d) => (cand(d, 'C-02').decomposition[0].scenarios = []), /K19 C-02 분해 1단계 scenarios 빈 배열/],
  ['K19', '없는 S-ID', (d) => (cand(d, 'C-02').decomposition[1].scenarios = ['S-01', 'S-99']), /K19 C-02 분해 2단계 없는 시나리오 S-99/],
  ['K17', '추적 칸 범주 불일치', (d) => (d.traces.traces[0].steps[1].excess = [{ x: 'X7', candidate: 'C-02' }]), /K17 T1#2 X7 ↔ C-02 excess 범주 불일치/]
]
for (const [rule, name, mutate, re] of RED) {
  test(`red ${rule}: ${name}`, () => assert.match(run(mutate).join('\n'), re))
}

test('red K12: 생성 블록의 숫자 1개 수정', () => {
  const errors = run((d) => (d.auditMd = d.auditMd.replace('| main/x | 100 |', '| main/x | 101 |')), { keepMd: true })
  assert.match(errors.join('\n'), /K12 생성 블록 ≠ 렌더 결과 volume/)
})
test('red K12: 생성 블록 삭제', () => {
  const errors = run((d) => (d.auditMd = d.auditMd.replace('<!-- gen:split -->', '<!-- gone -->')), { keepMd: true })
  assert.match(errors.join('\n'), /K12 생성 블록 누락 split/)
})
test('red K12: 완료 선언 뒤 data 파일 부재', () => {
  const errors = run((d) => delete d.reviews, { keepMd: true })
  assert.match(errors.join('\n'), /K12 완료 선언 뒤 data\/reviews.json 없음/)
})
test('대기: 완료 선언 전에는 data 파일 부재가 red 가 아니다', () => {
  const d = valid()
  delete d.split
  delete d.deep
  delete d.reviews
  delete d.traces
  delete d.candidates
  const r = render(d, facts().lineCount)
  for (const n of BLOCKS) d.auditMd = replaceBlock(d.auditMd, n, r[n])
  const out = check(d, facts(), { complete: false })
  assert.deepEqual(out.errors, [])
  assert.deepEqual(out.pending.sort(), ['candidates', 'deep', 'reviews', 'split', 'traces'])
})

test('render: 합계 행과 분할 절감 합은 렌더 때 계산한다', () => {
  const r = render(valid())
  assert.match(r.volume, /\| \*\*합계\*\* \| 3100 \| 200 \| 0\.06 \| 3 \|/)
  assert.match(r.split, /\| 1 \| H-01 첫 묶음 \| C-01 C-02 \| 15\/20 \| S-01 \|/)
  assert.match(r.approvals, /\| C-03 \| 중복 쌍 \| 채택 결정 변경 \|/)
  assert.match(r.candidates, /배제: 0100→0200 재시도 2회/)
})
test('extractBlock/replaceBlock 왕복', () => {
  const md = 'a\n<!-- gen:x -->\nold\n<!-- /gen:x -->\nb'
  assert.equal(extractBlock(replaceBlock(md, 'x', 'new'), 'x'), 'new')
  assert.equal(extractBlock(md, 'y'), null)
})

test('K18: prod 가 기준 미만인 버킷은 심화 검토가 없어도 green, 기준과 같으면 필요', () => {
  assert.deepEqual(run((d) => (d.volume.buckets['main/x'].prod.lines = 2999)), [])
  assert.match(run((d) => (d.volume.buckets['main/x'].prod.lines = 3000)).join('\n'), /K18 심화 검토 없는 버킷 main\/x/)
})
test('K18: density=necessary 는 후보 0 이어도 green', () => {
  assert.deepEqual(run((d) => Object.assign(d.deep.reviews[0], { density: 'necessary', verdicts: { X1: 'none', X2: 'none', X3: 'none', X4: 'none', X5: 'none', X6: 'none', X7: 'none' } })), [])
})
test('K19: remove 후보는 decomposition 이 없어도 green', () => assert.equal(cand(valid(), 'C-01').decomposition, undefined))
test('render: 심화 표의 읽은 줄 비율과 분해 표의 단계 번호', () => {
  const r = render(valid(), facts().lineCount)
  assert.match(r.deep, /\| main\/big \| C-02 \| — \| — \| — \| — \| — \| — \| 과도 \| 3 \/ 3000 \(0%\) \|/)
  assert.match(r.decomposition, /\| C-02 고정 인자 \| 1 \| 고정 인자 제거 \| 응답이 온다 \| `main\/a.ts` \| S-01 \|/)
  assert.match(r.decomposition, /\| C-02 \| 2 \| 래퍼 제거 \| 응답이 온다 \| `main\/b.ts` \| S-01 S-02 \|/)
})
test('K19: 완료 선언 전에는 분해안 부재가 대기다', () => {
  const d = valid()
  delete cand(d, 'C-02').decomposition
  rerender(d)
  const out = check(d, facts(), { complete: false })
  assert.deepEqual(out.errors, [])
  assert.deepEqual(out.pending, ['decomposition:C-02'])
})
test('K12: 필수 생성 블록은 9개이고 deep·decomposition 을 지우면 red', () => {
  assert.deepEqual(BLOCKS, ['volume', 'scenarios', 'candidates', 'approvals', 'traces', 'reviews', 'deep', 'decomposition', 'split'])
  for (const name of ['deep', 'decomposition']) {
    const errors = run((d) => (d.auditMd = d.auditMd.replace(`<!-- gen:${name} -->`, '<!-- gone -->')), { keepMd: true })
    assert.match(errors.join('\n'), new RegExp(`K12 생성 블록 누락 ${name}`))
  }
})
