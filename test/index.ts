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
      const internal = await resolveImport(`#internal-${c}`, p)
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      t.strictSame(internal, root)
      t.end()
    })
  }
})

t.test('missing package fails', async t => {
  const p = resolve('/some/path')
  const n = 'this package does not exist'
  await t.rejects(resolveImport(n, p), {
    code: 'ERR_MODULE_NOT_FOUND',
    message: `Cannot find package '${n}' imported from ${p}`,
  })
})

t.test('builtin returns string', async t => {
  t.equal(await resolveImport('fs'), 'fs')
  const p = String(pathToFileURL(resolve('/a/b/c')))
  t.equal(await resolveImport('node:url', p), 'node:url')
})

t.test('absolute url returns file url of it', async t => {
  const d = t.testdir({
    'c.js': '',
  })
  const p = resolve(d, 'c.js')
  const u = pathToFileURL(p)
  const f = String(u)
  t.strictSame(await resolveImport(p), u)
  t.strictSame(await resolveImport(p, '/x/y/z.js'), u)
  t.equal(await resolveImport(u), u)
  t.equal(await resolveImport(u, '/x/y/z.js'), u)
  t.strictSame(await resolveImport(f), u)
  t.strictSame(await resolveImport(f, '/x/y/z.js'), u)

  t.rejects(resolveImport(resolve(d, 'x.js')))
  t.rejects(resolveImport(pathToFileURL(resolve(d, 'x.js'))))
  t.rejects(resolveImport(String(pathToFileURL(resolve(d, 'x.js')))))
})

t.test('relative url resolves', async t => {
  const d = t.testdir({
    x: {
      a: {
        'b.js': '',
      },
      y: {
        'z.js': '',
      },
    },
  })
  const rel = '../a/b.js'
  await t.rejects(resolveImport(rel), {
    message: 'relative import without parentURL',
    url: '../a/b.js',
    parentURL: undefined,
  })
  const from = pathToFileURL(resolve(d, 'x/y/z.js'))
  const expect = pathToFileURL(resolve(d, 'x/a/b.js'))
  t.strictSame(await resolveImport(rel, from), expect)
})

t.test('resolve a dep from right here', async t => {
  const dep = 'tap'
  const expect = pathToFileURL(require.resolve('tap/lib/tap.mjs'))
  t.strictSame(await resolveImport(dep), expect)
  const p = pathToFileURL(__filename)
  t.strictSame(await resolveImport(dep, p), expect)
})

t.test('more custom internal imports', async t => {
  const p = require.resolve('./fixtures/t.js')
  const cases: [string, string | null][] = [
    ['#x', './x.js'],
    ['#not-found', null],
    ['#foo-xyz-bar', './multi-x-star-x.js'],
    ['#starxreplace', './star-x-x.js'],
    ['#starreplace', null],
    ['#multi-x-star', './multi-x-star-x.js'],
    ['#blorg', 'tap'],
    ['#nuevo', 'minipass'],
    ['#nul', 'minipass'],
    ['#null', null],
    ['#invalid', null],
    ['#invalid-star-expand', null],
    ['#.', 'glob'],
    ['#failing-conditional', null],
    ['#failing-starmatch', null],
    ['#passing-starmatch', './x.js'],
    ['', null],
  ]
  t.plan(cases.length)
  for (const [i, expect] of cases) {
    t.test(`${i} => ${expect}`, async t => {
      if (expect === null) {
        const e = await resolveImport(i, p).catch(e => e)
        t.match(e, Error)
        t.matchSnapshot(e.code)
      } else {
        t.strictSame(
          await resolveImport(i, p),
          await resolveImport(expect, p)
        )
      }
    })
  }
})

t.test('named package with exports internal import', async t => {
  const p = require.resolve('./fixtures/t.js')
  const ir = '@isaacs/resolve-import-test-fixture'
  const x = ir + '/x'
  const res = await resolveImport(x, p)
  t.strictSame(res, await resolveImport('./x.js', p))

  const passingStar = ir + '/passing-starmatch'
  const ps = await resolveImport(passingStar, p)
  t.strictSame(ps, await resolveImport('./x.js', p))

  t.rejects(resolveImport(ir + '/y', p))
  t.rejects(resolveImport(ir + '/nope', p))
  t.rejects(resolveImport(ir + '/missing', p))
  t.rejects(resolveImport(ir + '/failing-starmatch', p))
})

t.test('internal imports relative to package.json', async t => {
  const d = t.testdir({
    'package.json': JSON.stringify({
      name: '@i/p',
      imports: {
        '#vnd': './source/vendor/x.js',
        '#missing': './source/vendor/missing.js',
      },
      exports: {
        './vnd': './source/vendor/x.js',
        './missing': './source/vendor/missingjs',
      },
    }),
    source: {
      vendor: {
        'x.js': '',
      },
    },
    src: {
      'mine.js': '',
    },
  })
  const expect = pathToFileURL(resolve(d, 'source/vendor/x.js'))
  const from = resolve(d, 'src/mine.js')
  t.strictSame(await resolveImport('#vnd', from), expect)
  t.strictSame(await resolveImport('@i/p/vnd', from), expect)
  t.rejects(resolveImport('#missing', from))
  t.rejects(resolveImport('@i/p/missing', from))
})
