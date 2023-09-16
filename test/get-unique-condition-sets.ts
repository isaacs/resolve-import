import t from 'tap'
import { getUniqueConditionSets } from '../src/get-unique-condition-sets.js'
import { Exports, Imports } from '../src/index.js'

const cases: [Imports | Exports, string[][]][] = [
  [{ import: { node: 'x' }, node: { import: 'y' } }, [['import', 'node']]],
  [
    { import: { node: { default: 'x' } }, node: { import: 'y' } },
    [['import', 'node']],
  ],
  [
    { import: { node: [{ z: 'z' }, 'x'] }, node: { import: 'y' } },
    [
      ['import', 'node', 'z'],
      ['import', 'node'],
    ],
  ],
  [
    { import: null, node: [{ require: 'x' }, { import: 'y' }, 'z'] },
    [['import'], ['node', 'require'], ['node']],
  ],
  [{ './x': { import: './x.js' }, './y': './y.js' }, [['import'], []]],
  [
    [{ import: { node: 'x' } }, { node: { import: 'y' } }],
    [['import', 'node']],
  ],
  [
    { './x': { import: './x.js' }, './y': { import: './y.js' } },
    [['import']],
  ],
]

for (const [ie, e] of cases) {
  t.test(JSON.stringify(ie), t => {
    // turn into sets for t.strictSame comparison
    const expect = new Set(e.map(e => new Set(e)))
    const a = getUniqueConditionSets(ie)
    const actual = new Set(a.map(a => new Set(a)))
    t.strictSame(actual, expect)
    t.end()
  })
}
