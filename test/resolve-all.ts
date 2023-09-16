import { resolve } from 'path'
import t from 'tap'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  resolveAllExports,
  resolveAllLocalImports,
} from '../dist/esm/index.js'

const cwd = pathToFileURL(process.cwd()).pathname

t.formatSnapshot = (o: Record<string, URL | string>) => {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        String(v).split(cwd).join('{CWD}'),
      ])
    ),
    null,
    2
  )
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pj = resolve(__dirname, 'fixtures/resolve-all/package.json')
const noExportsImports = resolve(
  __dirname,
  'fixtures/resolve-all/no-exports-imports.json'
)
const exportsNotSubpaths = resolve(
  __dirname,
  'fixtures/resolve-all/exports-not-subpaths.json'
)
const exportsNotSubpathsObject = resolve(
  __dirname,
  'fixtures/resolve-all/exports-not-subpaths-object.json'
)
const importsInvalid = resolve(
  __dirname,
  'fixtures/resolve-all/imports-invalid.json'
)
const importsInvalidArray = resolve(
  __dirname,
  'fixtures/resolve-all/imports-invalid-array.json'
)

t.test('resolveAllLocalImports', async t => {
  t.matchSnapshot(await resolveAllLocalImports(pj))
})

t.test('resolveAllExports', async t => {
  t.matchSnapshot(await resolveAllExports(pj))
})

t.test('throws on invalid package', async t => {
  const __filename = fileURLToPath(import.meta.url)
  await t.rejects(resolveAllLocalImports(__filename))
  await t.rejects(resolveAllExports(__filename))
  await t.rejects(resolveAllLocalImports(pathToFileURL(importsInvalid)))
  await t.rejects(resolveAllLocalImports(importsInvalidArray))
})

t.test('no imports/exports returns no {}', async t => {
  t.strictSame(
    await resolveAllLocalImports(String(pathToFileURL(noExportsImports))),
    {}
  )
  t.strictSame(
    await resolveAllExports(String(pathToFileURL(noExportsImports))),
    {}
  )
})

t.test('if exports is only one path, return "." only', async t => {
  t.matchSnapshot(
    await resolveAllExports(pathToFileURL(exportsNotSubpaths))
  )
  t.matchSnapshot(
    await resolveAllExports(pathToFileURL(exportsNotSubpathsObject))
  )
})
