/**
 * Exported as `'resolve-import/resolve-all-local-imports'`
 * @module
 */
import { dirname, resolve } from 'path'
import { pathToFileURL } from 'url'
import { invalidPackage } from './errors.js'
import { fileExists } from './file-exists.js'
import { findDepPackage } from './find-dep-package.js'
import { ResolveImportOpts } from './index.js'
import { Pkg, readPkg } from './read-pkg.js'
import { resolveAllExports } from './resolve-all-exports.js'
import { resolveConditionalValue } from './resolve-conditional-value.js'
import { resolveImport } from './resolve-import.js'
import { starGlob } from './star-glob.js'
import { toFileURL } from './to-file-url.js'
import { toPath } from './to-path.js'

/**
 * Given a path or file URL to a package.json file, return an object where each
 * possible local import path is mapped to the file URL that it would resolve
 * to.
 *
 * Invalid and non-resolving imports are omitted.
 */
export const resolveAllLocalImports = async (
  packageJsonPath: string | URL,
  options: ResolveImportOpts = {},
): Promise<Record<string, string | URL>> => {
  const pjPath = toPath(packageJsonPath)
  const pjDir = dirname(pjPath)
  const pjURL = toFileURL(packageJsonPath)

  const pkg = await readPkg(pjPath)
  if (!pkg) {
    throw invalidPackage(packageJsonPath, resolveAllLocalImports)
  }
  const results: Record<string, URL | string> = {}

  for (const [sub, target] of getNamedImportsList(pkg, options)) {
    // if the import is local, then look it up
    // if it's another package, then look up that package
    // if it's another package with a *, then look up all exports
    // of that package, and filter by the matches.
    const parts = target.match(/^(@[^\/]+\/[^\/]+|[^\/]+)/)
    // make internal package named modules consistently `./`
    const name = pkg.name

    // non-matches already filtered out
    /* c8 ignore start */
    if (!parts) continue
    /* c8 ignore stop */

    const ssub = sub.split('*')
    const starget = target.split('*') as [string, string]
    const star = ssub.length === 2 && starget.length === 2
    if (!star) {
      // simple case, no * replacement
      // if not found, just omit it.
      // do a full resolve, because the target can be anything like
      // './foo/bar' or 'dep/blah', etc.
      try {
        results[sub] = await resolveImport(target, pjURL)
      } catch {}
      continue
    }

    // has a star, have to glob if it's localPath, or look up exports if not
    const localPath = parts[1] === '.'
    if (localPath) {
      for (const [rep, target] of await starGlob(starget, pjDir)) {
        results[ssub[0] + rep + ssub[1]] = pathToFileURL(target)
      }
      continue
    }

    const localName = parts[1] === name
    const dep = !localPath && !localName ? parts[1] : null

    // if we can't find the package, it's not valid.
    const ppath = dep ? await findDepPackage(dep, pjDir) : pjDir
    if (!ppath) continue

    const pj = resolve(ppath, 'package.json')
    if (!(await fileExists(pj))) {
      continue
    }

    const allExports = await resolveAllExports(pj)
    for (const [k, v] of Object.entries(allExports)) {
      if (k === '.' || k === './') continue
      const i = dep + k.substring(1)
      if (i.startsWith(starget[0]) && i.endsWith(starget[1])) {
        const s =
          ssub[0] +
          i.substring(starget[0].length, i.length - starget[1].length) +
          ssub[1]
        // should be impossible to throw, because we're pulling the list
        // from the package itself, and it gets resolved at that point.
        /* c8 ignore start */
        try {
          results[s] = await resolveImport(v, pjURL)
        } catch {}
        /* c8 ignore stop */
      }
    }
  }

  return results
}

/**
 * Get the condition-resolved targets of all imports
 *
 * Stars are not expanded.
 */
const getNamedImportsList = (
  pkg: Pkg,
  options: ResolveImportOpts,
): [string, string][] => {
  const results: [string, string][] = []
  const { imports } = pkg
  if (!imports || typeof imports !== 'object') return results
  for (const [k, v] of Object.entries(imports)) {
    const r = resolveConditionalValue(v, options)
    if (r && !r.startsWith('#')) results.push([k, r])
  }
  return results
}
