import t from 'tap'
import { resolveImport } from '../dist/esm/index.js'

t.formatSnapshot = (v: URL) => String(v)

t.test('resolve import types', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['import', 'types'],
    }),
  ),
)
t.test('resolve require', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['require', 'node'],
    }),
  ),
)
t.test('resolve require types', async t =>
  t.matchSnapshot(
    await resolveImport('resolve-import', undefined, {
      conditions: ['require', 'types'],
    }),
  ),
)
