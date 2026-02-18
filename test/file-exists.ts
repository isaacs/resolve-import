import t from 'tap'
import { fileExists, fileExistsSync } from '../src/file-exists.js'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dirUrl = pathToFileURL(__dirname)

t.equal(await fileExists(import.meta.url), true)
t.equal(fileExistsSync(import.meta.url), true)
t.equal(await fileExists(fileURLToPath(import.meta.url)), true)
t.equal(fileExistsSync(fileURLToPath(import.meta.url)), true)
t.equal(await fileExists('yolo'), false)
t.equal(fileExistsSync('yolo'), false)
t.equal(await fileExists(__dirname), false)
t.equal(fileExistsSync(__dirname), false)
t.equal(await fileExists(dirUrl), false)
t.equal(fileExistsSync(dirUrl), false)
