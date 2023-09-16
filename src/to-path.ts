import { fileURLToPath } from 'url'

export const toPath = (p: string | URL): string =>
  typeof p === 'object' || p.startsWith('file://') ? fileURLToPath(p) : p
