import { describe, it, expect, beforeEach } from 'vitest';
import { CEL } from '../src/cel.js';
import { ArgumentError } from '../src/errors.js';
import * as Lists from '../src/functions/lists.js';

/** Tests for the list, set and macro functions. */
describe('List functions', () => {
  let cel: CEL;

  beforeEach(() => {
    cel = new CEL();
  });

  const evalExpr = (source: string): unknown => cel.eval(source, {});

  it('should remove duplicates with distinct', () => {
    expect(evalExpr('[1, 2, 2, 3, 1].distinct()')).toEqual([1n, 2n, 3n]);
    expect(evalExpr('[].distinct()')).toEqual([]);
    expect(evalExpr('[[1], [1]].distinct()')).toEqual([[1n]]);
  });

  it('should use deep equality in distinct', () => {
    // Duplicates are recognised through the same equality the language uses elsewhere
    expect(evalExpr('[1, 1.0, 2].distinct()')).toEqual([1n, 2n]);
    expect(evalExpr("[{'a': 1}, {'a': 1}].distinct()")).toEqual([new Map([['a', 1n]])]);
    expect((evalExpr("[b'ab', b'ab'].distinct()") as unknown[]).length).toBe(1);
    expect((evalExpr("[b'ab', b'ba'].distinct()") as unknown[]).length).toBe(2);
  });

  it('should flatten nested lists', () => {
    expect(evalExpr('[[1, 2], [3]].flatten()')).toEqual([1n, 2n, 3n]);
    expect(evalExpr('[[1, [2]]].flatten()')).toEqual([1n, [2n]]);
    expect(evalExpr('[[1, [2]]].flatten(2)')).toEqual([1n, 2n]);
    expect(() => evalExpr('[[1]].flatten(0)')).toThrow(ArgumentError);
  });

  it('should reverse and slice', () => {
    expect(evalExpr('[1, 2, 3].reverse()')).toEqual([3n, 2n, 1n]);
    expect(evalExpr('[1, 2, 3, 4].slice(1, 3)')).toEqual([2n, 3n]);
    expect(evalExpr('[1, 2, 3].slice(1, 1)')).toEqual([]);
    expect(() => evalExpr('[1, 2].slice(0, 5)')).toThrow(ArgumentError);
  });

  it('should sort and access ends', () => {
    expect(evalExpr('[3, 1, 2].sort()')).toEqual([1n, 2n, 3n]);
    expect(evalExpr("['b', 'a'].sort()")).toEqual(['a', 'b']);
    expect(evalExpr('[1, 2].first()')).toBe(1n);
    expect(evalExpr('[1, 2].last()')).toBe(2n);
    expect(() => evalExpr('[].first()')).toThrow(ArgumentError);
    expect(() => evalExpr("[1, 'a'].sort()")).toThrow(ArgumentError);
  });

  it('should generate ranges', () => {
    expect(evalExpr('lists.range(3)')).toEqual([0n, 1n, 2n]);
    expect(evalExpr('lists.range(0)')).toEqual([]);
  });

  it('should provide set operations', () => {
    expect(evalExpr('sets.contains([1, 2, 3], [1, 3])')).toBe(true);
    expect(evalExpr('sets.contains([1, 2], [3])')).toBe(false);
    expect(evalExpr('sets.equivalent([1, 2, 2], [2, 1])')).toBe(true);
    expect(evalExpr('sets.equivalent([1], [1, 2])')).toBe(false);
    expect(evalExpr('sets.intersects([1, 2], [2, 3])')).toBe(true);
    expect(evalExpr('sets.intersects([1], [2])')).toBe(false);
  });

  it('should sort with the sortBy macro', () => {
    const users = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];
    expect(cel.eval('users.sortBy(u, u.age).map(u, u.name)', { users })).toEqual([
      'Alice',
      'Charlie',
      'Bob',
    ]);
  });

  it('should apply macros over maps', () => {
    const scores = { scores: { a: 1, b: 2 } };
    expect(Lists.sort(cel.eval('scores.map(k, k)', scores) as unknown[])).toEqual(['a', 'b']);
    expect(cel.eval("scores.exists(k, k == 'a')", scores)).toBe(true);
    expect(cel.eval('scores.all(k, size(k) == 1)', scores)).toBe(true);
    expect(cel.eval("scores.filter(k, k == 'b')", scores)).toEqual(['b']);
  });

  it('should support the three-argument map', () => {
    expect(evalExpr('[1, 2, 3, 4].map(x, x % 2 == 0, x * 2)')).toEqual([4n, 8n]);
    expect(evalExpr('[1, 3].map(x, x % 2 == 0, x * 2)')).toEqual([]);
  });
});
