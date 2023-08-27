import t from 'tap'
import { resolveImport } from '../dist/cjs/index.js'

const cwd = process.cwd()
t.formatSnapshot = (v: URL) => {
  return String(v).split(cwd).join('{CWD}')
}

t.test('resolve import types', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['import', 'types'],
    })
  )
)
t.test('resolve require', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['require', 'node'],
    })
  )
)
t.test('resolve require types', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['require', 'types'],
    })
  )
)
