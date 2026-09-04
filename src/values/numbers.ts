import { EvaluationError } from '../errors.js';

/**
 * Numeric helpers for the CEL value model.
 *
 * CEL `int` and `uint` values are represented as `bigint`; `double` values as
 * `number`. These helpers implement the exact 64-bit semantics of the Java
 * reference implementation.
 */

/** Smallest signed 64-bit integer. */
export const INT64_MIN = -(2n ** 63n);
/** Largest signed 64-bit integer. */
export const INT64_MAX = 2n ** 63n - 1n;

/** Reports whether the value is a CEL int (a bigint). */
export function isInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/** Reports whether the value is a CEL double (a number). */
export function isDouble(value: unknown): value is number {
  return typeof value === 'number';
}

/** Reports whether the value is a CEL int or double. */
export function isNumeric(value: unknown): value is bigint | number {
  return typeof value === 'bigint' || typeof value === 'number';
}

/**
 * Verifies that an integer result fits in 64 bits.
 *
 * @param value The result of an integer operation
 * @returns The value unchanged
 * @throws EvaluationError if the value is outside the signed 64-bit range
 */
export function checkInt64(value: bigint): bigint {
  if (value < INT64_MIN || value > INT64_MAX) {
    throw new EvaluationError('Integer overflow');
  }
  return value;
}

/**
 * Converts a double to a 64-bit integer the way Java's `Number.longValue()` does:
 * truncation toward zero, NaN becomes zero, and out-of-range values saturate.
 */
export function truncateToInt64(value: number): bigint {
  if (Number.isNaN(value)) {
    return 0n;
  }
  if (value >= 2 ** 63) {
    return INT64_MAX;
  }
  if (value <= -(2 ** 63)) {
    return INT64_MIN;
  }
  return BigInt(Math.trunc(value));
}

/** Normalises negative zero to positive zero, as equality treats them alike. */
function zero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Compares two doubles the way Java's `Double.compare` does, after normalising
 * signed zeros: NaN is greater than everything else and equal to itself.
 */
function compareDoubles(left: number, right: number): number {
  const a = zero(left);
  const b = zero(right);
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  const leftNaN = Number.isNaN(a);
  const rightNaN = Number.isNaN(b);
  if (leftNaN && rightNaN) {
    return 0;
  }
  if (leftNaN) {
    return 1;
  }
  if (rightNaN) {
    return -1;
  }
  return 0;
}

/** Compares a bigint against a finite double exactly. */
function compareIntToDouble(left: bigint, right: number): number {
  if (Number.isInteger(right)) {
    const exact = BigInt(right);
    return left < exact ? -1 : left > exact ? 1 : 0;
  }
  // The double lies strictly between floor and floor + 1
  const floor = BigInt(Math.floor(right));
  return left <= floor ? -1 : 1;
}

/**
 * Orders two numbers exactly, without the precision loss of a double conversion.
 *
 * Two ints compare as integers and two doubles as doubles. A mixed pair is
 * compared exactly, so an int above the range a double can represent is not
 * mistaken for the double it would round to.
 *
 * @returns A negative number, zero, or a positive number
 */
export function order(left: bigint | number, right: bigint | number): number {
  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return compareDoubles(left, right);
  }
  // Exactly one side is a double; a non-finite one has no exact representation to compare against
  const scalar = typeof left === 'number' ? left : (right as number);
  if (!Number.isFinite(scalar)) {
    return compareDoubles(Number(left), Number(right));
  }
  if (typeof left === 'bigint') {
    return compareIntToDouble(left, right as number);
  }
  return -compareIntToDouble(right as bigint, left);
}

/**
 * Renders a double the way Java's `Double.toString` does.
 *
 * Values with magnitude in [1e-3, 1e7) print in plain decimal notation with at
 * least one fractional digit (`1.0`, `3.14`); everything else prints in
 * computerised scientific notation (`1.0E10`, `1.234E-5`).
 */
export function javaDoubleToString(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }
  if (value === Infinity) {
    return 'Infinity';
  }
  if (value === -Infinity) {
    return '-Infinity';
  }
  if (value === 0) {
    return Object.is(value, -0) ? '-0.0' : '0.0';
  }
  const magnitude = Math.abs(value);
  if (magnitude >= 1e-3 && magnitude < 1e7) {
    const text = String(value);
    return text.includes('.') ? text : text + '.0';
  }
  const [mantissa, exponent] = value.toExponential().split('e') as [string, string];
  const digits = mantissa.includes('.') ? mantissa : mantissa + '.0';
  return `${digits}E${exponent.replace('+', '')}`;
}
