import { ArgumentError } from '../errors.js';
import { Duration } from './duration.js';
import { Timestamp } from './timestamp.js';
import { Type } from './type.js';

/**
 * Converts a JavaScript value into the CEL value model.
 *
 * Applied to variables entering `Program.evaluate()` and to the results of
 * custom functions, so that every code path inside the interpreter sees exactly
 * one representation per CEL type:
 *
 * - `undefined` becomes `null`
 * - integer-valued numbers become `bigint` (CEL int); other numbers stay doubles
 * - `Date` becomes `Timestamp`
 * - arrays are copied with normalised elements
 * - `Map` instances are copied with normalised keys and values
 * - plain objects become `Map<string, unknown>`
 * - `bigint`, `string`, `boolean`, `Uint8Array`, `Timestamp`, `Duration` and `Type`
 *   pass through; other class instances are left as they are
 *
 * @throws ArgumentError if the value contains a cycle
 */
export function normalize(value: unknown): unknown {
  return convert(value, new Set(), true);
}

/**
 * Converts a value returned by a function into the CEL value model.
 *
 * Like {@link normalize}, except that numbers are left as doubles: a function
 * returning a JavaScript number has produced a CEL double, and one that wants to
 * return an int returns a `bigint`.
 */
export function normalizeResult(value: unknown): unknown {
  return convert(value, new Set(), false);
}

/** Reports whether the value is a plain object (not a class instance). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function convert(value: unknown, ancestors: Set<object>, integers: boolean): unknown {
  switch (typeof value) {
    case 'undefined':
      return null;
    case 'number':
      return integers && Number.isInteger(value) ? BigInt(value) : value;
    case 'bigint':
    case 'string':
    case 'boolean':
      return value;
    case 'object':
      break;
    default:
      return value;
  }
  if (value === null) {
    return null;
  }
  if (
    value instanceof Uint8Array ||
    value instanceof Timestamp ||
    value instanceof Duration ||
    value instanceof Type
  ) {
    return value;
  }
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  if (Array.isArray(value)) {
    return descend(value, ancestors, () => value.map((item) => convert(item, ancestors, integers)));
  }
  if (value instanceof Map) {
    return descend(value, ancestors, () => {
      const result = new Map<unknown, unknown>();
      for (const [k, v] of value) {
        result.set(convert(k, ancestors, integers), convert(v, ancestors, integers));
      }
      return result;
    });
  }
  if (isPlainObject(value)) {
    return descend(value, ancestors, () => {
      const result = new Map<string, unknown>();
      for (const [k, v] of Object.entries(value)) {
        result.set(k, convert(v, ancestors, integers));
      }
      return result;
    });
  }
  return value;
}

function descend<T>(value: object, ancestors: Set<object>, body: () => T): T {
  if (ancestors.has(value)) {
    throw new ArgumentError('Cyclic value');
  }
  ancestors.add(value);
  try {
    return body();
  } finally {
    ancestors.delete(value);
  }
}
