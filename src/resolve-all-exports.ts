/**
 * Exported as `'resolve-import/resolve-all-exports'`
 * @module
 */
import { dirname, resolve } from 'path'
import { pathToFileURL } from 'url'
import { invalidPackage } from './errors.js'
import { getNamedExportsList } from './get-named-exports-list.js'
import { Exports, ResolveImportOpts } from './index.js'
import { readPkg } from './read-pkg.js'
import { resolveExport } from './resolve-export.js'
import { starGlob } from './star-glob.js'
import { toPath } from './to-path.js'

/**
 * Given a path or file URL to a package.json file, return an object where each
 * possible export path is mapped to the file URL that it would resolve to.
 *
 * Invalid exports are omitted. No errors are raised as long as the file is a
 * valid `package.json`.
 *
 * Note: in cases like `"./x/*": "./file.js"`, where the list of possible
 * import paths is unbounded, the returned object will contain `"./x/*"` as the
 * key, since there's no way to expand that to every possible match.
 */
export const resolveAllExports = async (
  packageJsonPath: string | URL,
  options: ResolveImportOpts = {},
): Promise<Record<string, string | URL>> => {
  const pjPath = toPath(packageJsonPath)
  const pjDir = dirname(pjPath)

  const pkg = await readPkg(pjPath)
  if (!pkg) {
    throw invalidPackage(packageJsonPath, resolveAllExports)
  }

  const results: Record<string, string | URL> = {}

  const { exports } = pkg
  for (const sub of getNamedExportsList(exports)) {
    let res

    // this can't shouldn't be able to actually throw, because we're
    // pulling the list from the set itself.
    /* c8 ignore start */
    try {
      res = resolveExport(sub, exports as Exports, pjPath, pjPath, options)
    } catch {}
    if (!res) continue
    /* c8 ignore stop */

    // if it contains a *, then we have to glob,
    // in package.json exports * is actually **, but only
    // relevant if there is exactly ONE star
    const sres = res.split('*')
    const ssub = sub.split('*')
    if (sres.length === 2 && ssub.length === 2) {
      for (const [rep, target] of await starGlob(
        sres as [string, string],
        pjDir,
      )) {
        results[ssub[0] + rep + ssub[1]] = pathToFileURL(target)
      }
    } else {
      results[sub] = pathToFileURL(resolve(pjDir, res))
    }
  }

  return results
}
