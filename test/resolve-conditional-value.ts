import t from 'tap'
import { resolveConditionalValue } from '../dist/esm/index.js'

t.test('without conditions', t => {
  t.equal(resolveConditionalValue(null, {}), null)
  t.equal(resolveConditionalValue('./x', {}), './x')
  t.equal(resolveConditionalValue(['./x'], {}), './x')
  t.equal(resolveConditionalValue({ default: './x' }, {}), './x')
  t.end()
})

t.test('with conditions', t => {
  t.equal(
    resolveConditionalValue(
      { require: './x', default: './y' },
      { conditions: ['require'] },
    ),
    './x',
  )
  t.equal(
    resolveConditionalValue(
      { node: './x', require: './y' },
      { conditions: ['require'] },
    ),
    './y',
  )
  t.equal(
    resolveConditionalValue(
      { import: './x', default: './y' },
      { conditions: ['require'] },
    ),
    './y',
  )
  t.end()
})

t.test('with negative conditions', t => {
  t.equal(
    resolveConditionalValue(
      { type: './x' },
      { conditions: ['type', '!default'] },
    ),
    './x',
  )
  t.equal(
    resolveConditionalValue(
      { import: './x', default: './y' },
      { conditions: ['type', '!default'] },
    ),
    null,
  )
  t.end()
})
