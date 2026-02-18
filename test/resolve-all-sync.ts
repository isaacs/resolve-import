import { resolve } from 'path'
import t from 'tap'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  resolveAllExportsSync,
  resolveAllLocalImportsSync,
} from '../src/index.js'

const cwd = pathToFileURL(process.cwd()).pathname

t.formatSnapshot = (o: Record<string, URL | string>) => {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        String(v).split(cwd).join('{CWD}'),
      ]),
    ),
    null,
    2,
  )
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pj = resolve(__dirname, 'fixtures/resolve-all/package.json')
const noExportsImports = resolve(
  __dirname,
  'fixtures/resolve-all/no-exports-imports.json',
)
const exportsNotSubpaths = resolve(
  __dirname,
  'fixtures/resolve-all/exports-not-subpaths.json',
)
const exportsNotSubpathsObject = resolve(
  __dirname,
  'fixtures/resolve-all/exports-not-subpaths-object.json',
)
const importsInvalid = resolve(
  __dirname,
  'fixtures/resolve-all/imports-invalid.json',
)
const importsInvalidArray = resolve(
  __dirname,
  'fixtures/resolve-all/imports-invalid-array.json',
)

t.test('resolveAllLocalImports', async t => {
  t.matchSnapshot(resolveAllLocalImportsSync(pj))
})

t.test('resolveAllExports', async t => {
  t.matchSnapshot(resolveAllExportsSync(pj))
})

t.test('throws on invalid package', async t => {
  const __filename = fileURLToPath(import.meta.url)
  t.throws(() => resolveAllLocalImportsSync(__filename))
  t.throws(() => resolveAllExportsSync(__filename))
  t.throws(() => resolveAllLocalImportsSync(pathToFileURL(importsInvalid)))
  t.throws(() => resolveAllLocalImportsSync(importsInvalidArray))
})

t.test('no imports/exports returns no {}', async t => {
  t.strictSame(
    resolveAllLocalImportsSync(String(pathToFileURL(noExportsImports))),
    {},
  )
  t.strictSame(
    resolveAllExportsSync(String(pathToFileURL(noExportsImports))),
    {},
  )
})

t.test('if exports is only one path, return "." only', async t => {
  t.matchSnapshot(resolveAllExportsSync(pathToFileURL(exportsNotSubpaths)))
  t.matchSnapshot(
    resolveAllExportsSync(pathToFileURL(exportsNotSubpathsObject)),
  )
})
