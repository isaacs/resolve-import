import t from 'tap'

t.test('not windows', async t => {
  const { isRelativeRequire } = await t.mockImport(
    '../src/is-relative-require.js',
    {
      '../src/is-windows.js': {
        isWindows: false,
      },
    },
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
    '../src/is-relative-require.js',
    {
      '../src/is-windows.js': {
        isWindows: true,
      },
    },
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
