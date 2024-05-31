import module from 'module'

const moduleSet = new Set(module.builtinModules)
const NODE_PROTOCOL = 'node:'

export const isBuiltin = (moduleName: string): boolean => {
  if (moduleName.startsWith(NODE_PROTOCOL)) {
    moduleName = moduleName.slice(NODE_PROTOCOL.length)
  }
  return moduleSet.has(moduleName)
}
