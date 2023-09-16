import t from 'tap'

t.test('not windows', async t => {
  const { isRelativeRequire } = await t.mockImport(
    '../dist/esm/is-relative-require.js',
    {
      '../dist/esm/is-windows.js': {
        isWindows: false,
      },
    }
  )
  t.equal(isRelativeRequire('./x'), true)
  t.equal(isRelativeRequire('../x'), true)
  t.equal(isRelativeRequire('../../x'), true)
  t.equal(isRelativeRequire('x'), false)
  t.equal(isRelativeRequire('/x'), false)

  t.equal(isRelativeRequire('.\\x'), false)
  t.equal(isRelativeRequire('..\\x'), false)
  t.equal(isRelativeRequire('..\\..\\x'), false)
})

t.test('yes windows', async t => {
  const { isRelativeRequire } = await t.mockImport(
    '../dist/esm/is-relative-require.js',
    {
      '../dist/esm/is-windows.js': {
        isWindows: true,
      },
    }
  )
  t.equal(isRelativeRequire('./x'), true)
  t.equal(isRelativeRequire('../x'), true)
  t.equal(isRelativeRequire('../../x'), true)
  t.equal(isRelativeRequire('x'), false)
  t.equal(isRelativeRequire('/x'), false)

  t.equal(isRelativeRequire('.\\x'), true)
  t.equal(isRelativeRequire('..\\x'), true)
  t.equal(isRelativeRequire('..\\..\\x'), true)
})
