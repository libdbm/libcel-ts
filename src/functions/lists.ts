/**
 * List functions from the CEL lists extension library.
 *
 * Functions are exported so library users can call them directly. All of them
 * return new lists and never modify their input.
 */
import { ArgumentError, EvaluationError } from '../errors.js';
import { KeySet } from '../values/key.js';
import * as Utilities from './utilities.js';

/** Removes duplicate elements under CEL equality, preserving first appearance order. */
export function distinct(values: unknown[]): unknown[] {
  const seen = new KeySet();
  const result: unknown[] = [];
  for (const value of values) {
    if (seen.add(value)) {
      result.push(value);
    }
  }
  return result;
}

/**
 * Flattens nested lists to the requested depth.
 *
 * @throws ArgumentError if the depth is less than 1
 */
export function flatten(values: unknown[], depth: bigint = 1n): unknown[] {
  if (depth < 1n) {
    throw new ArgumentError('flatten() depth must be at least 1');
  }
  const result: unknown[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      result.push(...(depth > 1n ? flatten(value, depth - 1n) : value));
    } else {
      result.push(value);
    }
  }
  return result;
}

/** Returns the elements in reverse order. */
export function reverse(values: unknown[]): unknown[] {
  return [...values].reverse();
}

/**
 * Returns the elements between the given indices.
 *
 * @throws ArgumentError if the range is invalid
 */
export function slice(values: unknown[], start: bigint, end: bigint): unknown[] {
  if (start < 0n || end > BigInt(values.length) || start > end) {
    throw new ArgumentError(`slice() range out of bounds: ${start}:${end}`);
  }
  return values.slice(Number(start), Number(end));
}

/**
 * Sorts the list using the standard CEL ordering.
 *
 * @throws ArgumentError if the elements are not mutually comparable
 */
export function sort(values: unknown[]): unknown[] {
  return [...values].sort(Utilities.compare);
}

/**
 * Returns the first element.
 *
 * @throws ArgumentError if the list is empty
 */
export function first(values: unknown[]): unknown {
  if (values.length === 0) {
    throw new ArgumentError('first() requires a non-empty list');
  }
  return values[0];
}

/**
 * Returns the last element.
 *
 * @throws ArgumentError if the list is empty
 */
export function last(values: unknown[]): unknown {
  if (values.length === 0) {
    throw new ArgumentError('last() requires a non-empty list');
  }
  return values[values.length - 1];
}

/**
 * Returns the integers from zero up to, but not including, the given bound.
 *
 * @param count The exclusive upper bound; negative values yield an empty list
 * @throws EvaluationError if the count exceeds the evaluation limit
 */
export function range(count: bigint): bigint[] {
  if (count > BigInt(Utilities.LIMIT)) {
    throw new EvaluationError(`range() exceeds the evaluation limit of ${Utilities.LIMIT}`);
  }
  const result: bigint[] = [];
  for (let i = 0n; i < count; i++) {
    result.push(i);
  }
  return result;
}

/** Reports whether the list contains the value, using deep equality. */
export function contains(values: unknown[], value: unknown): boolean {
  return Utilities.containsInArray(values, value);
}
