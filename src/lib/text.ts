/** Dependency-free text helpers (safe to use from server, client and tests). */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
