/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/resolve-all-sync.ts > TAP > if exports is only one path, return "." only > must match snapshot 1`] = `
{
  ".": "file://{CWD}/test/fixtures/resolve-all/default.js"
}
`

exports[`test/resolve-all-sync.ts > TAP > if exports is only one path, return "." only > must match snapshot 2`] = `
{
  ".": "file://{CWD}/test/fixtures/resolve-all/default.js"
}
`

exports[`test/resolve-all-sync.ts > TAP > resolveAllExports > must match snapshot 1`] = `
{
  ".": "file://{CWD}/test/fixtures/resolve-all/default.js",
  "./blah/*": "file://{CWD}/test/fixtures/resolve-all/default.js",
  "./deep/a/b/c/d/y/x.js": "file://{CWD}/test/fixtures/resolve-all/deep/a/b/c/d/y.js",
  "./deep/a/b/c/d/y/y.js": "file://{CWD}/test/fixtures/resolve-all/deep/a/b/c/d/y.js",
  "./deep/a/b/c/d/z.js": "file://{CWD}/test/fixtures/resolve-all/deep/a/b/c/d/y.js"
}
`

exports[`test/resolve-all-sync.ts > TAP > resolveAllLocalImports > must match snapshot 1`] = `
{
  "#module": "node:fs",
  "#g": "file://{CWD}/test/fixtures/resolve-all/node_modules/glob/dist/mjs/index.js",
  "#y/package.json": "file://{CWD}/node_modules/yaml/package.json",
  "#y/util": "file://{CWD}/node_modules/yaml/dist/util.js",
  "#u/ti/l": "file://{CWD}/node_modules/yaml/dist/util.js",
  "#localpath": "file://{CWD}/test/fixtures/resolve-all/default.js",
  "#localpath/a/b/c/d/y": "file://{CWD}/test/fixtures/resolve-all/deep/a/b/c/d/y.js",
  "#localname": "file://{CWD}/test/fixtures/resolve-all/default.js"
}
`
