import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import t from 'tap'
import {
  type Exports,
  getAllConditions,
  type Imports,
  resolveImportSync,
} from '../src/index.js'
const require = createRequire(import.meta.url)

const fixtures = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  'fixtures',
)
const nm = resolve(fixtures, 'node_modules')

const pWrap = <T>(fn: () => T): Promise<T> =>
  new Promise((res, rej) => {
    try {
      res(fn())
    } catch (er) {
      rej(er)
    }
  })

t.test('basic run-through of all dep cases', async t => {
  const p = require.resolve('./fixtures/t.js')
  const cases = readdirSync(nm).filter(f => f && !f.startsWith('.'))
  const proc = spawn(process.execPath, [p])
  const out: Buffer[] = []
  proc.stdout.on('data', c => out.push(c))
  await new Promise<void>(r => proc.on('close', () => r()))
  const expect = JSON.parse(Buffer.concat(out).toString())

  for (const c of cases) {
    t.test(c, async t => {
      const root = await pWrap(() => resolveImportSync(c, p))
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      const sub = await pWrap(() => resolveImportSync(`${c}/sub.js`, p))
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      const missing = await pWrap(() =>
        resolveImportSync(`${c}/missing.js`, p),
      )
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      // node 20.5 started reporting the package.json not being findable,
      // instead of the folder, which is also not ideal.
      // See: https://github.com/nodejs/node/issues/49674
      const fix = (s: string | (string | undefined)[]) =>
        (
          Array.isArray(s) &&
          s[0] === 'ERR_MODULE_NOT_FOUND' &&
          typeof s[1] === 'string'
        ) ?
          [s[0], s[1].replace(/package\.json|missing\.js|index\.js/, '')]
        : s
      const e = expect[c].map(fix)
      t.strictSame([root, sub, missing].map(fix), e)
      const internal = await pWrap(() =>
        resolveImportSync(`#internal-${c}`, p),
      )
        .then(r => String(r))
        .catch(e => {
          const er = e as NodeJS.ErrnoException
          return [er.code, er.message]
        })
      t.strictSame(internal, root)
      t.end()
    })
  }
  t.end()
})

t.test('missing package fails', async t => {
  const p = t.testdir()
  const n = 'this package does not exist'
  t.throws(() => resolveImportSync(n, p), {
    code: 'ERR_MODULE_NOT_FOUND',
    message: `Cannot find package '${n}' imported from ${p}`,
  })
})

t.test('builtin returns string', async t => {
  t.equal(resolveImportSync('fs'), 'fs')
  const p = String(pathToFileURL(resolve(tmpdir())))
  t.equal(resolveImportSync('node:url', p), 'node:url')
})

t.test('absolute url returns file url of it', async t => {
  const d = t.testdir({
    'c.js': '',
  })
  const p = resolve(d, 'c.js')
  const u = pathToFileURL(p)
  const f = String(u)
  t.strictSame(resolveImportSync(p), u)
  t.strictSame(resolveImportSync(p, tmpdir()), u)
  t.equal(resolveImportSync(u), u)
  t.equal(resolveImportSync(u, tmpdir()), u)
  t.strictSame(resolveImportSync(f), u)
  t.strictSame(resolveImportSync(f, tmpdir()), u)

  t.throws(() => resolveImportSync(resolve(d, 'x.js')))
  t.throws(() => resolveImportSync(pathToFileURL(resolve(d, 'x.js'))))
  t.throws(() =>
    resolveImportSync(String(pathToFileURL(resolve(d, 'x.js')))),
  )
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
  t.throws(() => resolveImportSync(rel), {
    message: 'relative import without parentURL',
    url: '../a/b.js',
    parentURL: undefined,
  })
  const from = pathToFileURL(resolve(d, 'x/y/z.js'))
  const expect = pathToFileURL(resolve(d, 'x/a/b.js'))
  t.strictSame(resolveImportSync(rel, from), expect)
})

t.test('resolve a dep from right here', async t => {
  const dep = 'tap'
  const expect = pathToFileURL(
    resolve('node_modules/tap/dist/esm/index.js'),
  )
  t.strictSame(resolveImportSync(dep), expect)
  t.strictSame(resolveImportSync(dep, import.meta.url), expect)
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
  for (const [i, expect] of cases) {
    t.test(`${i} => ${expect}`, async t => {
      if (expect === null) {
        const e = await pWrap(() => resolveImportSync(i, p)).catch(e => e)
        t.match(e, Error)
        t.matchSnapshot(e.code)
      } else {
        t.strictSame(resolveImportSync(i, p), resolveImportSync(expect, p))
      }
    })
  }
  t.end()
})

t.test('named package with exports internal import', async t => {
  const p = require.resolve('./fixtures/t.js')
  const ir = '@isaacs/resolve-import-test-fixture'
  const x = ir + '/x'
  const res = resolveImportSync(x, p)
  t.strictSame(res, resolveImportSync('./x.js', p))

  const passingStar = ir + '/passing-starmatch'
  const ps = resolveImportSync(passingStar, p)
  t.strictSame(ps, resolveImportSync('./x.js', p))

  t.throws(() => resolveImportSync(ir + '/y', p))
  t.throws(() => resolveImportSync(ir + '/nope', p))
  t.throws(() => resolveImportSync(ir + '/missing', p))
  t.throws(() => resolveImportSync(ir + '/failing-starmatch', p))
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
  t.strictSame(resolveImportSync('#vnd', from), expect)
  t.strictSame(resolveImportSync('@i/p/vnd', from), expect)
  t.throws(() => resolveImportSync('#missing', from))
  t.throws(() => resolveImportSync('@i/p/missing', from))
})

t.test('getAllConditions', t => {
  t.test('valid cases', t => {
    const cases: [Imports | Exports, string[]][] = [
      ['./hello.js', []],
      [{ default: './x.js' }, []],
      [
        { import: { types: './x.d.ts', default: './x.mjs' } },
        ['import', 'types'],
      ],
      [
        { import: [{ types: './x.d.ts' }, './x.mjs'] },
        ['import', 'types'],
      ],
      [{ import: ['./x.mjs', { types: './x.d.ts' }] }, ['import']],
      [{ default: ['./x.mjs', { types: './x.d.ts' }] }, []],
      [
        { default: ['./x.mjs', { types: './x.d.ts' }], require: 'x.cjs' },
        [],
      ],
      [
        { require: 'x.cjs', default: ['./x.mjs', { types: './x.d.ts' }] },
        ['require'],
      ],
      [
        { blah: 'x.cjs', default: ['./x.mjs', { types: './x.d.ts' }] },
        ['blah'],
      ],
      [
        [{ x: 'y' }, { x: 'z' }, { y: 'z' }, { y: 'a' }],
        ['x', 'y'],
      ],
      [
        {
          '#a': [{ x: 'y' }, { x: 'z' }, { y: 'z' }, { y: 'a' }],
          '#b': [{ x: 'y' }, { x: 'z' }, { y: 'z' }, { y: 'a' }],
        },
        ['x', 'y'],
      ],
    ]

    t.plan(cases.length)
    for (const [ie, conds] of cases) {
      t.test(JSON.stringify(ie), t => {
        t.strictSame(new Set(getAllConditions(ie)), new Set(conds))
        t.end()
      })
    }
  })

  // cannot mix types
  t.throws(() => getAllConditions({ '#x': 'y', './z': 'invalid' }))
  t.throws(() => getAllConditions({ './x': 'y', '#z': 'invalid' }))
  t.throws(() => getAllConditions({ x: 'y', '#z': 'invalid' }))
  t.throws(() => getAllConditions({ x: 'y', './z': 'invalid' }))

  t.end()
})

t.test('link packages get realpathed', async t => {
  // resolving resolving should follow links
  const pkga = {
    'package.json': JSON.stringify({ name: 'a', exports: './index.js' }),
    'index.js': '',
  }
  const pkgb = {
    'package.json': JSON.stringify({ name: 'b', exports: './index.js' }),
    'index.js': '',
  }
  const pkgc = {
    'package.json': JSON.stringify({ name: 'c', exports: './index.js' }),
    'index.js': '',
  }
  const pkgloop = {
    'package.json': JSON.stringify({
      name: 'loop',
      exports: './index.js',
    }),
    'index.js': '',
  }
  const dir = t.testdir({
    'index.js': '',
    node_modules: {
      a: t.fixture('symlink', '../a'),
      b: {
        ...pkgb,
        node_modules: {
          loop: t.fixture('symlink', './loopy'),
          loopy: t.fixture('symlink', './loop'),
        },
      },
      c: t.fixture('symlink', '../c'),
      loop: { ...pkgloop },
    },
    a: {
      ...pkga,
      b: {
        ...pkgb,
        node_modules: {
          c: t.fixture('symlink', '../../c'),
          loop: t.fixture('symlink', './loopy'),
          loopy: t.fixture('symlink', './loop'),
        },
      },
      c: { ...pkgc },
      node_modules: {
        b: t.fixture('symlink', '../b'),
        c: { ...pkgc },
        loop: t.fixture('symlink', './loopy'),
        loopy: t.fixture('symlink', './loop'),
      },
    },
    c: { ...pkgc },
  })
  const url = pathToFileURL(resolve(dir, 'index.js'))
  const r = async (id: string | URL, base: string | URL = url) =>
    String(resolveImportSync(id, base))
  const u = (u: string) => new URL(u + '/index.js', url)
  const p = (p: string) => String(u(p))
  t.equal(await r('a'), p('a'), 'a')
  t.equal(await r('b'), p('node_modules/b'), 'b')
  t.equal(await r('c'), p('c'), 'c')
  t.equal(await r('b', await r('a')), p('a/b'), 'a->b')
  t.equal(await r('c', await r('a')), p('a/node_modules/c'), 'a->c')
  t.equal(await r('a', await r('b')), p('a'), 'b->a')
  t.equal(await r('c', await r('b')), p('c'), 'b->c')
  t.equal(await r('b', await r('c')), p('node_modules/b'), 'c->b')
  t.equal(await r('a', await r('c')), p('a'), 'c->a')
  t.equal(await r('c', await r('b', await r('a'))), p('a/c'), 'a->b->c')
  t.test('url gets realpathed', async t => {
    t.equal(
      await r(u('a/node_modules/b/node_modules/c')),
      p('a/c'),
      'url gets realpathed',
    )
    t.equal(
      await r(u('node_modules/a/node_modules/c')),
      p('a/node_modules/c'),
      'url gets realpathed',
    )
  })

  t.test('symlink loop is not valid dep', async t => {
    const loop = p('node_modules/loop')
    t.equal(await r('loop'), loop)
    t.equal(await r('loop', await r('b')), loop)
    t.equal(await r('loop', await r('b', await r('a'))), loop)
    t.equal(await r('loop', await r('b', await r('a'))), loop)
  })
})

t.test('fail to resolve #import if no pj imports', async t => {
  const dir = t.testdir({
    'index.js': '',
    'x.js': '',
    'package.json': JSON.stringify({
      imports: {
        '#x': './x.js',
      },
    }),
    x: {
      'index.js': '',
      'package.json': JSON.stringify({}),
    },
  })
  t.equal(
    String(resolveImportSync('#x', resolve(dir, 'x.js'))),
    String(pathToFileURL(resolve(dir, 'x.js'))),
  )
  t.throws(() => resolveImportSync('#x', resolve(dir, 'x/index.js')), {
    message:
      `Package import specifier "#x" is not defined in package ` +
      `${resolve(dir, 'x/package.json')} imported from ${resolve(
        dir,
        'x/index.js',
      )}`,
  })
})

t.test('parentURL needs a valid folder, not file', async t => {
  const dir = t.testdir({
    node_modules: {
      dep: {
        'package.json': JSON.stringify({ main: './dep.js' }),
        'dep.js': '',
      },
    },
    folder: {},
  })
  const expect = String(
    pathToFileURL(resolve(dir, 'node_modules/dep/dep.js')),
  )
  t.equal(String(resolveImportSync('dep', dir + '/x')), expect)
  t.equal(
    String(resolveImportSync('dep', pathToFileURL(dir + '/x'))),
    expect,
  )
})
