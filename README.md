# resolve-import

Look up the file that an `import()` statement will resolve to,
for use in node esm loaders.

Returns a `file://` URL object for file resolutions, or the
builtin module ID string for node builtins.

## USAGE

```js
import { resolveImport } from 'resolve-import'
// or: const { resolveImport } = require('resolve-import')

// resolving a full file URL just returns it
console.log(await resolveImport(new URL('file:///blah/foo.js')))

// resolving a node built in returns the string
console.log(await resolveImport('node:fs')) // 'node:fs'

// resolving an absolute full path just file-url-ifies it
console.log(await resolveImport('/a/b/c.js')) // URL(file:///a/b/c.js)

// resolving a relative path resolves it from the parent module
// URL(file:///path/to/x.js)
console.log(await resolveImport('./x.js', '/path/to/y.js'))

// packages resolved according to their exports, main, etc.
// eg: URL(file:///path/node_modules/pkg/dist/mjs/index.js)
console.log(await resolveImport('pkg', '/path/to/y.js'))
```

## API

```ts
resolveImport(url: string | URL, parentURL?: string | URL):
    Promise<string | URL>
```

* `url` The string or file URL object being imported.
* `parentURL` The string or file URL object that the import is
  coming from.

Returns the string provided for node builtins, like `'fs'` or
`'node:path'`.

Otherwise, resolves to a `file://` URL object corresponding to
the file that will be imported.

Raises roughly the same errors that `import()` will raise if the
lookup fails.  For example, if a package is not found, if a
subpath is not exported, etc.
