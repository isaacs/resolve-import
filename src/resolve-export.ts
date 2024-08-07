import { subpathNotExported } from './errors.js'
import { findStarMatch } from './find-star-match.js'
import {
  ConditionalValue,
  Exports,
  ExportsSubpaths,
  ResolveImportOpts,
} from './index.js'
import { resolveConditionalValue } from './resolve-conditional-value.js'

/**
 * Resolve an export that might be a string, subpath exports, exports value
 * object, or array of strings and exports value objects
 */
export const resolveExport = (
  sub: string,
  exp: Exports,
  pj: string,
  from: string,
  options: ResolveImportOpts,
): string => {
  const s =
    !sub ? '.'
    : sub === '.' || sub.startsWith('./') ? sub
    : `./${sub}`

  if (typeof exp === 'string' || Array.isArray(exp)) {
    const res = s === '.' && resolveConditionalValue(exp, options)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  // now it must be a set of named exports or an export value object
  // first try to resolve as a value object, if that's allowed
  if (s === '.') {
    const res = resolveConditionalValue(exp, options)
    if (res) return res
  }

  // otherwise the only way to match is with subpaths
  const es = exp as ExportsSubpaths

  // if we have an exact match, use that
  const e = es[s]
  if (e !== undefined) {
    const res = resolveConditionalValue(e, options)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  const sm = findStarMatch(s, es)
  if (sm) {
    const [key, mid] = sm
    const res = resolveConditionalValue(
      es[key] as ConditionalValue,
      options,
    )
    if (!res) throw subpathNotExported(s, pj, from)
    return res.replace(/\*/g, mid)
  }

  // did not find a match
  throw subpathNotExported(s, pj, from)
}
