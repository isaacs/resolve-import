import { pathToFileURL } from 'url'

export const toFileURL = (p: string | URL): URL =>
  typeof p === 'object' ? p
  : p.startsWith('file://') ? new URL(p)
  : pathToFileURL(p)
