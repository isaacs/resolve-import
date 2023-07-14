import t from 'tap'
import { builtinSet } from '../dist/cjs/builtin-set.js'

t.equal(builtinSet.has('fs'), true)
t.equal(builtinSet.has('node:fs'), true)
t.equal(builtinSet.has('url'), true)
t.equal(builtinSet.has('node:url'), true)
