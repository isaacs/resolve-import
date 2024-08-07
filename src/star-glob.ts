import { escape, glob } from 'glob'
import { resolve } from 'path'

export const starGlob = async (
  star: [string, string], // actually [string,string]
  dir: string,
): Promise<[string, string][]> => {
  const pattern =
    escape(star[0]) +
    (star[0].endsWith('/') ? '' : '*/') +
    '**' +
    (star[1].startsWith('/') ? '' : '/*') +
    escape(star[1])
  const matches = await glob(pattern, {
    posix: true,
    absolute: false,
    nodir: true,
    cwd: dir,
    dotRelative: true,
  })
  return matches.map(match => {
    const rep = match.substring(
      star[0].length,
      match.length - star[1].length,
    )
    return [rep, resolve(dir, match)]
  })
}
