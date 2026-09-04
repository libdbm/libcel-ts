/**
 * Set functions from the CEL sets extension library.
 *
 * Lists are treated as unordered collections; duplicates do not affect the
 * results. Functions are exported so library users can call them directly.
 */
import { KeySet } from '../values/key.js';

// Indexes a list by CEL equality so membership resolves without scanning
function index(values: unknown[]): KeySet {
  const result = new KeySet();
  for (const value of values) {
    result.add(value);
  }
  return result;
}

/** Reports whether every element of the subset appears in the values. */
export function contains(values: unknown[], subset: unknown[]): boolean {
  const indexed = index(values);
  return subset.every((value) => indexed.has(value));
}

/** Reports whether the two lists contain the same elements, ignoring order and duplicates. */
export function equivalent(left: unknown[], right: unknown[]): boolean {
  return contains(left, right) && contains(right, left);
}

/** Reports whether the two lists share at least one element. */
export function intersects(left: unknown[], right: unknown[]): boolean {
  const indexed = index(left);
  return right.some((value) => indexed.has(value));
}
