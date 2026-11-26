export class WaybillRule extends Error {}
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new WaybillRule(message);
}
export function positive(n: unknown, limit: number): n is number {
  return (
    typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= limit
  );
}
