import { stat } from 'fs/promises'
import { dirname, resolve, sep } from 'path'
import { walkUp } from 'walk-up-path'

const dirExists = async (f: string): Promise<boolean> =>
  stat(f).then(
    st => st.isDirectory(),
    () => false
  )

export const findDepPackage = async (
  pkgName: string | null,
  parentPath: string
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
    if (!(await dirExists(ppath))) continue
    return ppath
  }
}
