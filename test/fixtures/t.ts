import { readdir } from 'fs/promises'
import { pathToFileURL } from 'url'

export const testAll = async (which?: string) => {
  const types = which
    ? [which]
    : (await readdir(__dirname + '/node_modules')).filter(
        f => f && !f.startsWith('.')
      )
  const res = await Promise.all(
    types.map(async pkg => {
      return [
        pkg,
        await import(pkg)
          .then(({ whoami }) => whoami)
          .catch(e => [e.code, e.message]),
        await import(`${pkg}/sub.js`)
          .then(({ whoami }) => whoami)
          .catch(e => [e.code, e.message]),
        await import(`${pkg}/missing.js`)
          .then(({ whoami }) => whoami)
          .catch(e => [e.code, e.message]),
      ]
    })
  )
  return Object.fromEntries(
    res.map(([p, i, s, m]) => {
      return [p, [tofurl(i), tofurl(s), tofurl(m)]]
    })
  )
}

const tofurl = (s: string | [string, string]) =>
  typeof s !== 'string'
    ? s
    : s.startsWith('file://')
    ? s
    : String(pathToFileURL(s))

if (require.main === module) {
  testAll(process.argv[2]).then(res =>
    console.log(JSON.stringify(res, null, 2))
  )
}
