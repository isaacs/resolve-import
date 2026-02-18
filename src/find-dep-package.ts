import { realpathSync, statSync } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { walkUp } from 'walk-up-path'

const dirExists = async (f: string): Promise<boolean> => {
  try {
    return (await stat(f)).isDirectory()
  } catch {
    return false
  }
}

const dirExistsSync = (f: string): boolean => {
  try {
    return statSync(f).isDirectory()
  } catch {
    return false
  }
}

export const findDepPackage = async (
  pkgName: string | null,
  parentPath: string,
) => {
  // starting from the dirname, try to find the nearest node_modules
  for (const dir of walkUp(dirname(parentPath))) {
    const nm = resolve(dir, 'node_modules') + sep
    // if it's null, then we need the node_modules itself
    // if it's '' then we use node_modules with an extra / on it
    // thisis only relevant when generating the error message, since
    // of course node_modules// is never going to be a valid package.
    const ppath =
      pkgName === null ? nm : (!pkgName ? nm : resolve(nm, pkgName)) + sep
    if (await dirExists(ppath)) {
      try {
        return (await realpath(ppath)) + sep
        // the direxists stat will avoid almost all throws that could
        // occur here, but just in case.
        /* c8 ignore start */
      } catch {}
      /* c8 ignore stop */
    }
  }
}

export const findDepPackageSync = (
  pkgName: string | null,
  parentPath: string,
) => {
  // starting from the dirname, try to find the nearest node_modules
  for (const dir of walkUp(dirname(parentPath))) {
    const nm = resolve(dir, 'node_modules') + sep
    // if it's null, then we need the node_modules itself
    // if it's '' then we use node_modules with an extra / on it
    // thisis only relevant when generating the error message, since
    // of course node_modules// is never going to be a valid package.
    const ppath =
      pkgName === null ? nm : (!pkgName ? nm : resolve(nm, pkgName)) + sep
    if (dirExistsSync(ppath)) {
      try {
        return realpathSync(ppath) + sep
        // the direxists stat will avoid almost all throws that could
        // occur here, but just in case.
        /* c8 ignore start */
      } catch {}
      /* c8 ignore stop */
    }
  }
}
