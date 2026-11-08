import { DomainError, type RecordField } from '@note/contracts';

type Expression =
  | { kind: 'number'; value: number }
  | { kind: 'field'; id: string }
  | { kind: 'call'; name: string; args: Expression[] }
  | { kind: 'binary'; op: string; left: Expression; right: Expression };
const fail = (message = 'Use numbers, [property IDs], arithmetic, round, abs, min or max.') => {
  throw new DomainError('INVALID', message);
};
function parse(input: string) {
  if (!input || input.length > 1000)
    return fail('A formula must contain between 1 and 1,000 characters.');
  const tokens =
    input.match(/\[[\w-]{1,64}\]|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+*/,%-]|\S/giu) ??
    [];
  if (tokens.length > 256) return fail('The formula is too complex.');
  let cursor = 0,
    depth = 0;
  const refs = new Set<string>();
  const expression = (minimum = 0): Expression => {
    if (++depth > 32) return fail('Use at most 32 nested expressions.');
    let left: Expression;
    const token = tokens[cursor++];
    if (token === '+' || token === '-')
      left = {
        kind: 'binary',
        op: token,
        left: { kind: 'number', value: 0 },
        right: expression(3),
      };
    else if (token === '(') {
      left = expression();
      if (tokens[cursor++] !== ')') return fail();
    } else if (token?.startsWith('[')) {
      const id = token.slice(1, -1);
      refs.add(id);
      left = { kind: 'field', id };
    } else if (token && /^\d|^\.\d/u.test(token) && Number.isFinite(Number(token)))
      left = { kind: 'number', value: Number(token) };
    else if (['round', 'abs', 'min', 'max'].includes(token)) {
      if (tokens[cursor++] !== '(') return fail();
      const args = [expression()];
      while (tokens[cursor] === ',') {
        cursor++;
        args.push(expression());
      }
      if (
        tokens[cursor++] !== ')' ||
        args.length > 20 ||
        (token === 'abs' && args.length !== 1) ||
        (token === 'round' && args.length > 2)
      )
        return fail();
      left = { kind: 'call', name: token, args };
    } else return fail();
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };
    while ((precedence[tokens[cursor]] ?? 0) > minimum) {
      const op = tokens[cursor++];
      left = { kind: 'binary', op, left, right: expression(precedence[op]) };
    }
    depth--;
    return left;
  };
  const root = expression();
  if (cursor !== tokens.length) return fail();
  return { root, refs };
}
function evaluate(node: Expression, field: (id: string) => number | null): number | null {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'field') return field(node.id);
  if (node.kind === 'call') {
    const values = node.args.map((arg) => evaluate(arg, field));
    if (values.some((value) => value === null)) return null;
    const numbers = values as number[];
    const result =
      node.name === 'min'
        ? Math.min(...numbers)
        : node.name === 'max'
          ? Math.max(...numbers)
          : node.name === 'abs'
            ? Math.abs(numbers[0])
            : Math.round(numbers[0] * 10 ** Math.max(-12, Math.min(12, numbers[1] ?? 0))) /
              10 ** Math.max(-12, Math.min(12, numbers[1] ?? 0));
    return Number.isFinite(result) ? result : null;
  }
  const left = evaluate(node.left, field),
    right = evaluate(node.right, field);
  if (left === null || right === null) return null;
  const result =
    node.op === '+'
      ? left + right
      : node.op === '-'
        ? left - right
        : node.op === '*'
          ? left * right
          : node.op === '/'
            ? left / right
            : left % right;
  return Number.isFinite(result) ? result : null;
}
/** Bounded expression parser; never compiles or executes user input as JavaScript. */
export function compileFormulas(fields: RecordField[]) {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const formulas = new Map(
    fields
      .filter((field) => field.type === 'formula')
      .map((field) => [field.id, parse(field.formula ?? '')]),
  );
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) return fail('Formulas cannot contain circular references.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const ref of formulas.get(id)?.refs ?? []) {
      if (!['number', 'formula'].includes(byId.get(ref)?.type ?? ''))
        return fail(`Formula reference [${ref}] must be a numeric property.`);
      if (formulas.has(ref)) visit(ref);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of formulas.keys()) visit(id);
  return (values: Record<string, unknown>) => {
    const computed: Record<string, number | null> = Object.create(null);
    const get = (id: string): number | null => {
      if (Object.hasOwn(computed, id)) return computed[id];
      const formula = formulas.get(id);
      if (formula) return (computed[id] = evaluate(formula.root, get));
      return typeof values[id] === 'number' && Number.isFinite(values[id])
        ? (values[id] as number)
        : null;
    };
    for (const id of formulas.keys()) get(id);
    return computed;
  };
}
