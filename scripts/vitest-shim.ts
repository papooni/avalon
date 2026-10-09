/**
 * Minimal Vitest-compatible shim used ONLY to run the engine tests in
 * environments without node_modules (e.g. sandboxed CI smoke checks):
 *   npx tsx --tsconfig scripts/tsconfig.shim.json scripts/run-engine-tests.ts
 * The real project uses Vitest (`npm test`).
 */
type Fn = () => void | Promise<void>;
const tests: { name: string; fn: Fn }[] = [];
const stack: string[] = [];
export function describe(name: string, fn: () => void) { stack.push(name); fn(); stack.pop(); }
export function it(name: string, fn: Fn) { tests.push({ name: [...stack, name].join(' › '), fn }); }
export const test = it;

const fmt = (v: unknown) => { try { return JSON.stringify(v); } catch { return String(v); } };
function deepEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Set && b instanceof Set) return a.size === b.size && [...a].every((x) => b.has(x));
  return fmt(a) === fmt(b);
}
export function expect(actual: unknown) {
  const make = (neg: boolean) => {
    const check = (pass: boolean, msg: string) => { if (pass === neg) throw new Error(`${neg ? 'not ' : ''}${msg}`); };
    return {
      toBe: (e: unknown) => check(Object.is(actual, e), `expected ${fmt(actual)} toBe ${fmt(e)}`),
      toEqual: (e: unknown) => check(deepEqual(actual, e), `expected ${fmt(actual)} toEqual ${fmt(e)}`),
      toBeTruthy: () => check(!!actual, `expected ${fmt(actual)} truthy`),
      toBeNull: () => check(actual === null, `expected ${fmt(actual)} null`),
      toBeDefined: () => check(actual !== undefined, `expected defined`),
      toContain: (e: unknown) => check((actual as string | unknown[]).includes(e as never), `expected ${fmt(actual)} toContain ${fmt(e)}`),
      toBeGreaterThan: (e: number) => check((actual as number) > e, `expected ${fmt(actual)} > ${e}`),
      toThrow: () => { let threw = false; try { (actual as () => void)(); } catch { threw = true; } check(threw, 'expected to throw'); },
    };
  };
  return { ...make(false), not: make(true) };
}
export async function run() {
  let pass = 0; const failures: string[] = [];
  for (const t of tests) {
    try { await t.fn(); pass++; } catch (e) { failures.push(`✗ ${t.name}\n    ${(e as Error).message}`); }
  }
  failures.forEach((f) => console.log(f));
  console.log(`\n${pass} passed, ${failures.length} failed, ${tests.length} total`);
  if (failures.length) (globalThis as unknown as { process: { exit(c: number): never } }).process.exit(1);
}
