import t from 'tap'

import { getAllConditionalValues } from '../src/get-all-conditional-values.js'
import { getConditionalValuesList } from '../src/get-conditional-values-list.js'
import { Exports, Imports } from '../src/index.js'

t.test('valid values', t => {
  const cases: [Imports | Exports, string[]][] = [
    [{ import: { node: 'x' }, node: { import: 'y' } }, ['x']],
    [{ import: { node: { default: 'x' } }, node: { import: 'y' } }, ['x']],
    [
      { import: { node: [{ z: 'z' }, 'x'] }, node: { import: 'y' } },
      ['z', 'x'],
    ],
    [
      { import: null, node: [{ require: 'x' }, { import: 'y' }, 'z'] },
      ['x', 'z'],
    ],
    [
      { './x': { import: './x.js' }, './y': './y.js' },
      ['./x.js', './y.js'],
    ],
    [[{ import: { node: 'x' } }, { node: { import: 'y' } }], ['x']],
  ]
  t.plan(cases.length)

  for (const [ie, expect] of cases) {
    t.test(JSON.stringify(ie), t => {
      const actual = getAllConditionalValues(ie)
      t.strictSame(actual, expect)
      t.matchSnapshot(getConditionalValuesList(ie))
      t.end()
    })
  }
})

// cannot mix types
t.throws(() => getAllConditionalValues({ '#x': 'y', './z': 'invalid' }))
t.throws(() => getAllConditionalValues({ './x': 'y', '#z': 'invalid' }))
t.throws(() => getAllConditionalValues({ x: 'y', '#z': 'invalid' }))
t.throws(() => getAllConditionalValues({ x: 'y', './z': 'invalid' }))
