import t from 'tap'
t.pass('just enforcing coverage')

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('..', import.meta.url)) + '/src'
for (const f of readdirSync(dir)) {
  await import(`../src/${f}`)
}
