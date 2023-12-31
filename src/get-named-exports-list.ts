import { Exports, ExportsSubpaths } from './index.js'
/**
 * Get the condition-resolved targets of all exports
 *
 * Stars are not expanded.
 */
export const getNamedExportsList = (exports?: Exports): string[] => {
  if (!exports) return []
  if (!isExportSubpaths(exports)) return ['.']
  return Object.keys(exports).filter(e => e === '.' || e.startsWith('./'))
}

const isExportSubpaths = (e: Exports): e is ExportsSubpaths => {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  for (const p in e) {
    if (p !== '.' && !p.startsWith('./')) return false
  }
  return true
}
