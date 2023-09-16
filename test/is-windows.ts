import t from 'tap'

t.test('not windows', async t => {
  const d = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  ) as PropertyDescriptor
  t.teardown(() => {
    Object.defineProperty(process, 'platform', d)
  })
  Object.defineProperty(process, 'platform', {
    value: 'linux',
    enumerable: true,
    configurable: true,
    writable: true,
  })
  const { isWindows } = await t.mockImport('../dist/esm/is-windows.js', {})
  t.equal(isWindows, false)
})

t.test('yes windows', async t => {
  const d = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  ) as PropertyDescriptor
  t.teardown(() => {
    Object.defineProperty(process, 'platform', d)
  })
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    enumerable: true,
    configurable: true,
    writable: true,
  })
  const { isWindows } = await t.mockImport('../dist/esm/is-windows.js', {})
  t.equal(isWindows, true)
})
