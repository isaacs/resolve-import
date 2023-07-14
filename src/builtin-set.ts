import { builtinModules } from 'module'

export const builtinSet = new Set([
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
])
