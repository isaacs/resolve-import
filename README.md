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

### Interface `ResolveImportOpts`

- `conditions: string[]` The list of conditions to match on.
  `'default'` is always accepted. Defaults to `['import',
  'node']`. If set to `['require', 'node']`, then this is
  equivalent to `require.resolve()`.

### resolveImport

```ts
resolveImport(
  url: string | URL,
  parentURL?: string | URL,
  options?: ResolveImportOpts):
    Promise<string | URL>
```

- `url` The string or file URL object being imported.
- `parentURL` The string or file URL object that the import is
  coming from.
- `options` A ResolveImportOpts object (optional)

Returns the string provided for node builtins, like `'fs'` or
`'node:path'`.

Otherwise, resolves to a `file://` URL object corresponding to
the file that will be imported.

Raises roughly the same errors that `import()` will raise if the
lookup fails. For example, if a package is not found, if a
subpath is not exported, etc.

### resolveAllExports

```ts
resolveAllExports(
  packageJsonPath: string | URL,
  options: ResolveImportOpts):
    Promise<Record<string, string | URL>>
```

Given a `package.json` path or file URL, resolve all valid
exports from that package.

If the pattern contains a `*` in both the pattern and the target,
then it will search for all possible files that could match the
pattern, and expand them appropriately in the returned object.

In the case where a `*` exists in the pattern, but does not exist
in the target, no expansion can be done, because _any_ string
there would resolve to the same file. In that case, the `*` is
left in the pattern.

If the target is a node built-in module, it will be a string.
Otherwise, it will be a `file://` URL object.

Any exports that fail to load (ie, if the target is invalid, the
file does not exist, etc.) will be omitted from the returned
object.

### resolveAllLocalImports

```ts
resolveAllLocalImports(
  packageJsonPath: string | URL,
  options: ResolveImportOpts):
    Record<string, string | URL>
```

Similar to `resolveAllExports`, but this resolves the entries in
the package.json's `imports` object.
