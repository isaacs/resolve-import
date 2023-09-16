/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/errors.ts > TAP > must match snapshot 1`] = `
Error: invalid import() specifier: some invalid url
`

exports[`test/errors.ts > TAP > must match snapshot 2`] = `
Error: Not a valid package: /some/package.json
`

exports[`test/errors.ts > TAP > must match snapshot 3`] = `
Error: Cannot find module '/path/to/module' imported from /from {
  "code": "ERR_MODULE_NOT_FOUND",
}
`

exports[`test/errors.ts > TAP > must match snapshot 4`] = `
Error: Package import specifier "./a" is not defined in package /x/package.json imported from /from {
  "code": "ERR_PACKAGE_IMPORT_NOT_DEFINED",
}
`

exports[`test/errors.ts > TAP > must match snapshot 5`] = `
Error: Cannot find package '@some/pkg' imported from /from {
  "code": "ERR_MODULE_NOT_FOUND",
}
`

exports[`test/errors.ts > TAP > must match snapshot 6`] = `
Error: relative import without parentURL {
  "parentURL": null,
  "url": "../foo",
}
`

exports[`test/errors.ts > TAP > must match snapshot 7`] = `
Error: No "exports" main defined in /x/package.json imported from /from {
  "code": "ERR_PACKAGE_PATH_NOT_EXPORTED",
}
`

exports[`test/errors.ts > TAP > must match snapshot 8`] = `
Error: Package subpath './x' is not defined by "exports" in /x/package.json imported from /from {
  "code": "ERR_PACKAGE_PATH_NOT_EXPORTED",
}
`
