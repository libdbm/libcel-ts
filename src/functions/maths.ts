/**
 * Numeric functions from the CEL math extension library.
 *
 * Functions that take a single argument accept both ints and doubles and
 * preserve the input type where the operation allows it. Functions are exported
 * so library users can call them directly.
 */
import { ArgumentError, EvaluationError } from '../errors.js';
import { INT64_MIN } from '../values/numbers.js';
import * as Utilities from './utilities.js';

function spread(values: unknown[]): unknown[] {
  if (values.length === 1 && Array.isArray(values[0])) {
    return values[0];
  }
  return values;
}

/**
 * Returns the largest of the given values; a single list argument is spread.
 *
 * @throws ArgumentError if no values are given or they are not comparable
 */
export function greatest(values: unknown[]): unknown {
  return Utilities.max(spread(values));
}

/**
 * Returns the smallest of the given values; a single list argument is spread.
 *
 * @throws ArgumentError if no values are given or they are not comparable
 */
export function least(values: unknown[]): unknown {
  return Utilities.min(spread(values));
}

/**
 * Returns the absolute value, preserving the numeric type.
 *
 * @throws EvaluationError if the value is the minimum int, whose magnitude is not representable
 */
export function abs(value: unknown): bigint | number {
  if (typeof value === 'number') {
    return Math.abs(value);
  }
  const number = Utilities.asInt(value);
  if (number === INT64_MIN) {
    throw new EvaluationError('Integer overflow');
  }
  return number < 0n ? -number : number;
}

/** Returns the smallest double not less than the value. */
export function ceil(value: unknown): number {
  return Math.ceil(Utilities.asDouble(value));
}

/** Returns the largest double not greater than the value. */
export function floor(value: unknown): number {
  return Math.floor(Utilities.asDouble(value));
}

/** Rounds to the nearest double, with ties rounding away from zero. */
export function round(value: unknown): number {
  const number = Utilities.asDouble(value);
  return number < 0 ? -Math.round(-number) : Math.round(number);
}

/** Truncates toward zero. */
export function trunc(value: unknown): number {
  const number = Utilities.asDouble(value);
  return number < 0 ? Math.ceil(number) : Math.floor(number);
}

/** Returns -1, 0 or 1 by sign, preserving the numeric type. */
export function sign(value: unknown): bigint | number {
  if (typeof value === 'number') {
    return Math.sign(value);
  }
  const number = Utilities.asInt(value);
  return number < 0n ? -1n : number > 0n ? 1n : 0n;
}

/** Returns the square root as a double. */
export function sqrt(value: unknown): number {
  return Math.sqrt(Utilities.asDouble(value));
}

/** Reports whether the value is NaN. */
export function isNaN(value: unknown): boolean {
  return Number.isNaN(Utilities.asDouble(value));
}

/** Reports whether the value is positive or negative infinity. */
export function isInf(value: unknown): boolean {
  const number = Utilities.asDouble(value);
  return number === Infinity || number === -Infinity;
}

/** Reports whether the value is neither NaN nor infinite. */
export function isFinite(value: unknown): boolean {
  return Number.isFinite(Utilities.asDouble(value));
}

/** Returns the bitwise AND of two ints. */
export function and(left: unknown, right: unknown): bigint {
  return BigInt.asIntN(64, Utilities.asInt(left) & Utilities.asInt(right));
}

/** Returns the bitwise OR of two ints. */
export function or(left: unknown, right: unknown): bigint {
  return BigInt.asIntN(64, Utilities.asInt(left) | Utilities.asInt(right));
}

/** Returns the bitwise exclusive OR of two ints. */
export function xor(left: unknown, right: unknown): bigint {
  return BigInt.asIntN(64, Utilities.asInt(left) ^ Utilities.asInt(right));
}

/** Returns the bitwise complement of an int. */
export function not(value: unknown): bigint {
  return BigInt.asIntN(64, ~Utilities.asInt(value));
}

function shiftCount(count: unknown): bigint {
  const bits = Utilities.asInt(count);
  if (bits < 0n) {
    throw new ArgumentError(`Shift count must not be negative: ${bits}`);
  }
  return bits;
}

/**
 * Shifts an int left by the given number of bits, wrapping at 64 bits.
 *
 * @throws ArgumentError if the count is negative
 */
export function left(value: unknown, count: unknown): bigint {
  const bits = shiftCount(count);
  return bits >= 64n ? 0n : BigInt.asIntN(64, Utilities.asInt(value) << bits);
}

/**
 * Shifts an int right by the given number of bits, without sign extension.
 *
 * @throws ArgumentError if the count is negative
 */
export function right(value: unknown, count: unknown): bigint {
  const bits = shiftCount(count);
  return bits >= 64n ? 0n : BigInt.asIntN(64, BigInt.asUintN(64, Utilities.asInt(value)) >> bits);
}
