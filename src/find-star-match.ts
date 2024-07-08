/**
 * Given an object with string keys possibly containing *, and a test
 * string, return the matching key, and the section that the star should
 * expand to when matching against the test string.
 */
export const findStarMatch = (
  s: string,
  obj: Record<string, any>,
): [string, string] | null => {
  // longest pattern matches take priority
  const patterns = Object.keys(obj)
    .filter(p => p.length <= s.length)
    .sort((a, b) => b.length - a.length)
    .map(p => [p, p.split('*')])
    .filter(([, p]) => (p as string[]).length === 2) as [
    string,
    [string, string],
  ][]

  for (const [key, [before, after]] of patterns) {
    if (s.startsWith(before) && s.endsWith(after)) {
      const mid = s.substring(before.length, s.length - after.length)
      return [key, mid]
    }
  }

  return null
}
