import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import t from 'tap'
import { resolveImport } from '../dist/cjs/index.js'

const fixtures = resolve(__dirname, 'fixtures')
const nm = resolve(fixtures, 'node_modules')

t.test('basic run-through of all dep cases', async t => {
  const p = require.resolve('./fixtures/t.js')
  const cases = (await readdir(nm)).filter(f => f && !f.startsWith('.'))
  const proc = spawn(process.execPath, [p])
  const out: Buffer[] = []
  proc.stdout.on('data', c => out.push(c))
  await new Promise<void>(r => proc.on('close', () => r()))
  const expect = JSON.parse(Buffer.concat(out).toString())

  t.plan(cases.length)
  for (const c of cases) {
    t.test(c, async t => {
      const root = await resolveImport(c, p)
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      const sub = await resolveImport(`${c}/sub.js`, p)
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      const missing = await resolveImport(`${c}/missing.js`, p)
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      t.strictSame([root, sub, missing], expect[c])
      t.end()
    })
  }
})

t.test('missing package fails', async t => {
  await t.rejects(resolveImport('this package does not exist', '/some/path'), {
    code: 'ERR_MODULE_NOT_FOUND',
    message: `Cannot find package 'this package does not exist' imported from /some/path`,
  })
})

t.test('builtin returns string', async t => {
  t.equal(await resolveImport('fs'), 'fs')
  const p = String(pathToFileURL(resolve('/a/b/c')))
  t.equal(await resolveImport('node:url', p), 'node:url')
})

t.test('absolute url returns file url of it', async t => {
  const p = resolve('/a/b/c.js')
  const u = pathToFileURL(p)
  const f = String(u)
  t.strictSame(await resolveImport(p), u)
  t.strictSame(await resolveImport(p, '/x/y/z.js'), u)
  t.equal(await resolveImport(u), u)
  t.equal(await resolveImport(u, '/x/y/z.js'), u)
  t.strictSame(await resolveImport(f), u)
  t.strictSame(await resolveImport(f, '/x/y/z.js'), u)
})

t.test('relative url resolves', async t => {
  const rel = '../a/b.js'
  await t.rejects(resolveImport(rel), {
    message: 'relative import without parentURL',
    url: '../a/b.js',
    parentURL: undefined,
  })
  const from = pathToFileURL(resolve('/x/y/z.js'))
  const expect = pathToFileURL(resolve('/x/a/b.js'))
  t.strictSame(await resolveImport(rel, from), expect)
})

t.test('resolve a dep from right here', async t => {
  const dep = 'tap'
  const expect = pathToFileURL(require.resolve('tap/lib/tap.mjs'))
  t.strictSame(await resolveImport(dep), expect)
  const p = pathToFileURL(__filename)
  t.strictSame(await resolveImport(dep, p), expect)
})
