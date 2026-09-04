/**
 * Utility helper methods for libcel.
 *
 * Functions are exported so library users can call them directly. They operate
 * on the CEL value model: `bigint` for int, `number` for double, `Uint8Array`
 * for bytes, `Map` for maps, and the `Timestamp`, `Duration` and `Type` classes.
 */
import { ArgumentError, EvaluationError } from '../errors.js';
import { Type } from '../values/type.js';
import { Timestamp } from '../values/timestamp.js';
import { Duration } from '../values/duration.js';
import { fieldsOf } from '../values/civil.js';
import { KeyMap } from '../values/key.js';
import { isPlainObject } from '../values/normalize.js';
import { isBytes, utf8Decode, utf8Encode, bytesEqual, bytesCompare } from '../values/bytes.js';
import {
  javaDoubleToString,
  order,
  truncateToInt64,
  INT64_MIN,
  INT64_MAX,
} from '../values/numbers.js';

export { order } from '../values/numbers.js';

/**
 * The largest collection or string an expression may generate.
 *
 * CEL evaluates untrusted input, so operations whose size is controlled by the
 * expression itself refuse to allocate beyond this ceiling rather than exhausting
 * the heap.
 */
export const LIMIT = 1_000_000;

/** The largest number of seconds a duration may span, per the CEL specification. */
export const SPAN = Duration.SPAN;

const INT_TEXT = /^[+-]?\d+$/;
const DOUBLE_TEXT = /^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|Infinity|NaN)$/;

/**
 * Refuses a result that would exceed {@link LIMIT}.
 *
 * Bounding each operation's output, and not only its inputs, is what stops two
 * separately legal values from being combined into one that exhausts the heap.
 *
 * @param size The size the operation is about to produce
 * @param what The operation being bounded, named in the error message
 * @throws EvaluationError if the size exceeds the limit
 */
export function limit(size: number | bigint, what: string): void {
  if (size > LIMIT) {
    throw new EvaluationError(`${what} exceeds the evaluation limit of ${LIMIT}`);
  }
}

/** Reports whether the value is a CEL map (a Map, or a plain object not yet normalised). */
export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

/** Counts the Unicode code points in a string. */
export function codePointCount(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
      }
    }
    count++;
  }
  return count;
}

/**
 * Returns the UTF-16 offset of the given code point index, or -1 when the index
 * exceeds the number of code points.
 */
export function offsetByCodePoints(value: string, index: number): number {
  let offset = 0;
  for (let remaining = index; remaining > 0; remaining--) {
    if (offset >= value.length) {
      return -1;
    }
    const code = value.charCodeAt(offset);
    if (code >= 0xd800 && code <= 0xdbff && offset + 1 < value.length) {
      const next = value.charCodeAt(offset + 1);
      offset += next >= 0xdc00 && next <= 0xdfff ? 2 : 1;
    } else {
      offset++;
    }
  }
  return offset > value.length ? -1 : offset;
}

/**
 * Returns the size/length of the given value.
 *
 * Strings are measured in Unicode code points; bytes, lists and maps by their
 * element count; null is 0.
 *
 * @throws ArgumentError if the value type is unsupported
 */
export function sizeOf(value: unknown): bigint {
  if (value === null || value === undefined) {
    return 0n;
  }
  if (typeof value === 'string') {
    return BigInt(codePointCount(value));
  }
  if (isBytes(value)) {
    return BigInt(value.length);
  }
  if (Array.isArray(value)) {
    return BigInt(value.length);
  }
  if (value instanceof Map) {
    return BigInt(value.size);
  }
  if (isPlainObject(value)) {
    return BigInt(Object.keys(value).length);
  }
  throw new ArgumentError(`size() not supported for type: ${typeOf(value)}`);
}

/**
 * Converts the given value to a signed 64-bit integer.
 *
 * Accepted inputs: bigint, number (truncated toward zero), string holding a
 * decimal integer, boolean (true = 1), and Timestamp (epoch seconds).
 *
 * @throws ArgumentError if the value cannot be converted
 */
export function asInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return truncateToInt64(value);
  }
  if (typeof value === 'string') {
    if (INT_TEXT.test(value.trim()) && value.trim() === value) {
      const parsed = BigInt(value);
      if (parsed >= INT64_MIN && parsed <= INT64_MAX) {
        return parsed;
      }
    }
    throw new ArgumentError(`Cannot convert to int: ${value}`);
  }
  if (typeof value === 'boolean') {
    return value ? 1n : 0n;
  }
  if (value instanceof Timestamp) {
    return value.seconds;
  }
  throw new ArgumentError(`Cannot convert to int: ${asString(value)}`);
}

/**
 * Converts the given value to an unsigned 64-bit integer.
 *
 * @throws ArgumentError if the value is negative or cannot be converted
 */
export function asUInt(value: unknown): bigint {
  const result = asInt(value);
  if (result < 0n) {
    throw new ArgumentError(`Cannot convert negative value to uint: ${asString(value)}`);
  }
  return result;
}

/**
 * Converts the given value to a double.
 *
 * Accepted inputs: number, bigint, and string parsable as a decimal number.
 *
 * @throws ArgumentError if the value cannot be converted
 */
export function asDouble(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (DOUBLE_TEXT.test(text)) {
      return Number(text);
    }
    throw new ArgumentError(`Cannot convert to double: ${value}`);
  }
  throw new ArgumentError(`Cannot convert to double: ${asString(value)}`);
}

/**
 * Converts the given value to its string representation.
 *
 * Returns "null" for null, decodes bytes as UTF-8, renders a Duration in the
 * CEL form ("3600s"), a Timestamp in RFC 3339, a double the way Java does
 * ("1.0", "1.0E10") and a Type as its bare name.
 */
export function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return javaDoubleToString(value);
  }
  if (typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (isBytes(value)) {
    return utf8Decode(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(asString).join(', ')}]`;
  }
  if (value instanceof Map) {
    return `{${Array.from(value, ([k, v]) => `${asString(k)}=${asString(v)}`).join(', ')}}`;
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .map(([k, v]) => `${k}=${asString(v)}`)
      .join(', ')}}`;
  }
  return String(value);
}

/**
 * Converts the given value to bytes, encoding a string as UTF-8.
 *
 * @throws ArgumentError if the value cannot be converted
 */
export function asBytes(value: unknown): Uint8Array {
  if (isBytes(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return utf8Encode(value);
  }
  throw new ArgumentError(`Cannot convert to bytes: ${asString(value)}`);
}

/**
 * Converts the given value to a boolean using common truthiness rules.
 *
 * Numbers are true if non-zero. Strings are true if non-empty. Collections and
 * maps are true if non-empty. Null is false.
 */
export function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value !== 0n;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value instanceof Map) {
    return value.size > 0;
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length > 0;
  }
  return value !== null && value !== undefined;
}

/**
 * Returns the CEL type of the given value.
 *
 * @returns The type value, or Type.UNKNOWN for a value this library does not recognise
 */
export function typeOf(value: unknown): Type {
  if (value === null || value === undefined) {
    return Type.NULL;
  }
  switch (typeof value) {
    case 'boolean':
      return Type.BOOL;
    case 'bigint':
      return Type.INT;
    case 'number':
      return Type.DOUBLE;
    case 'string':
      return Type.STRING;
    case 'object':
      break;
    default:
      return Type.UNKNOWN;
  }
  if (isBytes(value)) {
    return Type.BYTES;
  }
  if (value instanceof Timestamp) {
    return Type.TIMESTAMP;
  }
  if (value instanceof Duration) {
    return Type.DURATION;
  }
  if (Array.isArray(value)) {
    return Type.LIST;
  }
  if (value instanceof Map || isPlainObject(value)) {
    return Type.MAP;
  }
  if (value instanceof Type) {
    return Type.TYPE;
  }
  return Type.UNKNOWN;
}

/**
 * Checks whether a map contains the given key.
 *
 * @returns true if target is a map and contains the key under CEL equality; false otherwise
 */
export function has(target: unknown, field: unknown): boolean {
  if (target instanceof Map) {
    return contains(target, field);
  }
  if (isPlainObject(target)) {
    return typeof field === 'string' && Object.prototype.hasOwnProperty.call(target, field);
  }
  return false;
}

/**
 * Reports whether the map holds the given key, comparing keys the way CEL compares values.
 *
 * An integer key therefore matches a double probe of the same value, so
 * membership, indexing and presence tests all agree.
 */
export function contains(map: Map<unknown, unknown>, key: unknown): boolean {
  if (map.has(key)) {
    return true;
  }
  for (const candidate of map.keys()) {
    if (equals(candidate, key)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the value stored under the given key, comparing keys the way CEL compares values.
 *
 * @returns The matching value, or undefined when no key matches
 */
export function select(map: Map<unknown, unknown>, key: unknown): unknown {
  if (map.has(key)) {
    return map.get(key);
  }
  for (const [candidate, value] of map) {
    if (equals(candidate, key)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Tests whether the given regular expression matches any part of the text.
 *
 * @throws ArgumentError if the pattern is invalid
 */
export function matches(text: string, pattern: string): boolean {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    throw new ArgumentError(`Invalid regular expression: ${pattern}`);
  }
  return regex.test(text);
}

/**
 * Parses or provides a Timestamp from the given value.
 *
 * Accepted inputs: null returns the current time, a string is parsed as RFC 3339,
 * a bigint is treated as epoch seconds, and a Date or Timestamp is converted.
 *
 * @throws ArgumentError if the input type or format is invalid
 */
export function timestamp(value: unknown): Timestamp {
  if (value === null || value === undefined) {
    return Timestamp.now();
  }
  if (value instanceof Timestamp) {
    return value;
  }
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  if (typeof value === 'string') {
    return Timestamp.parse(value);
  }
  if (typeof value === 'bigint') {
    return Timestamp.ofEpochSeconds(value);
  }
  throw new ArgumentError(`Invalid timestamp value: ${asString(value)}`);
}

/**
 * Parses a CEL duration string such as "300ms", "-1.5h" or "2h45m".
 *
 * @throws ArgumentError if the format or unit is invalid
 */
export function duration(value: string): Duration {
  return Duration.parse(value);
}

/**
 * Converts the given value to a Duration: a Duration is returned as is and a
 * string is parsed.
 *
 * @throws ArgumentError if the value cannot be converted
 */
export function asDuration(value: unknown): Duration {
  if (value instanceof Duration) {
    return value;
  }
  if (typeof value === 'string') {
    return Duration.parse(value);
  }
  throw new ArgumentError(`Cannot convert to duration: ${asString(value)}`);
}

function at(value: unknown, zone: unknown) {
  const instant = value instanceof Timestamp ? value : timestamp(value);
  return { instant, fields: fieldsOf(instant.seconds, zone ?? null) };
}

/** Returns the day of month (1-31) for the timestamp, in the zone or UTC. */
export function dateOf(value: unknown, zone: unknown = null): bigint {
  return BigInt(at(value, zone).fields.day);
}

/** Returns the zero-based month (0-11) for the timestamp, in the zone or UTC. */
export function monthOf(value: unknown, zone: unknown = null): bigint {
  return BigInt(at(value, zone).fields.month - 1);
}

/** Returns the year for the timestamp, in the zone or UTC. */
export function yearOf(value: unknown, zone: unknown = null): bigint {
  return at(value, zone).fields.year;
}

/** Returns the hour of day for a timestamp, or the whole number of hours in a duration. */
export function hoursOf(value: unknown, zone: unknown = null): bigint {
  if (value instanceof Duration) {
    return value.toHours();
  }
  return BigInt(at(value, zone).fields.hour);
}

/** Returns the minute for a timestamp, or the whole number of minutes in a duration. */
export function minutesOf(value: unknown, zone: unknown = null): bigint {
  if (value instanceof Duration) {
    return value.toMinutes();
  }
  return BigInt(at(value, zone).fields.minute);
}

/** Returns the second for a timestamp, or the whole number of seconds in a duration. */
export function secondsOf(value: unknown, zone: unknown = null): bigint {
  if (value instanceof Duration) {
    return value.toSeconds();
  }
  return BigInt(at(value, zone).fields.second);
}

/** Returns the millisecond for a timestamp, or the whole number of milliseconds in a duration. */
export function millisecondsOf(value: unknown, zone: unknown = null): bigint {
  if (value instanceof Duration) {
    return value.toMillis();
  }
  return BigInt(Math.floor(at(value, zone).instant.nanos / 1_000_000));
}

/** Returns the day of week for the timestamp, where Sunday is 0. */
export function weekdayOf(value: unknown, zone: unknown = null): bigint {
  return BigInt(at(value, zone).fields.weekday);
}

/** Returns the zero-based day of year for the timestamp. */
export function ordinalOf(value: unknown, zone: unknown = null): bigint {
  return BigInt(at(value, zone).fields.dayOfYear - 1);
}

/**
 * Returns the maximum element from a non-empty list of values.
 *
 * @throws ArgumentError if the list is empty or values are not comparable
 */
export function max(values: unknown[]): unknown {
  if (values.length === 0) {
    throw new ArgumentError('max() requires at least one argument');
  }
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    if (compare(values[i], result) > 0) {
      result = values[i];
    }
  }
  return result;
}

/**
 * Returns the minimum element from a non-empty list of values.
 *
 * @throws ArgumentError if the list is empty or values are not comparable
 */
export function min(values: unknown[]): unknown {
  if (values.length === 0) {
    throw new ArgumentError('min() requires at least one argument');
  }
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    if (compare(values[i], result) < 0) {
      result = values[i];
    }
  }
  return result;
}

/**
 * Compares two values for deep equality.
 *
 * Lists and maps are compared element by element, numbers are compared
 * numerically across int and double, bytes by content, and NaN is never equal
 * to anything.
 */
export function equals(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  if (isBytes(left) && isBytes(right)) {
    return bytesEqual(left, right);
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i++) {
      if (!equals(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }
  const leftMap = toMap(left);
  const rightMap = toMap(right);
  if (leftMap && rightMap) {
    if (leftMap.size !== rightMap.size) {
      return false;
    }
    // Indexed by CEL key equality, so an int key matches a double probe
    const indexed = new KeyMap<unknown>();
    for (const [key, value] of rightMap) {
      indexed.set(key, value);
    }
    for (const [key, value] of leftMap) {
      if (!indexed.has(key) || !equals(value, indexed.get(key))) {
        return false;
      }
    }
    return true;
  }
  if (
    (typeof left === 'bigint' || typeof left === 'number') &&
    (typeof right === 'bigint' || typeof right === 'number')
  ) {
    if (Number.isNaN(left) || Number.isNaN(right)) {
      return false;
    }
    return order(left, right) === 0;
  }
  if (left instanceof Timestamp || left instanceof Duration || left instanceof Type) {
    return left.equals(right);
  }
  return left === right;
}

function toMap(value: unknown): Map<unknown, unknown> | null {
  if (value instanceof Map) {
    return value;
  }
  if (isPlainObject(value)) {
    return new Map(Object.entries(value));
  }
  return null;
}

/**
 * Deep equality check for CEL values. Alias of {@link equals}.
 */
export const deepEquals = equals;

/**
 * Compares two values using a common set of rules.
 *
 * Supported comparisons: numbers (exactly, across int and double), strings (by
 * UTF-16 code unit), booleans, timestamps, durations and bytes.
 *
 * @throws ArgumentError if the values cannot be compared
 */
export function compare(a: unknown, b: unknown): number {
  if (
    (typeof a === 'bigint' || typeof a === 'number') &&
    (typeof b === 'bigint' || typeof b === 'number')
  ) {
    return order(a, b);
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }
  if (a instanceof Timestamp && b instanceof Timestamp) {
    return a.compareTo(b);
  }
  if (a instanceof Duration && b instanceof Duration) {
    return a.compareTo(b);
  }
  if (isBytes(a) && isBytes(b)) {
    return bytesCompare(a, b);
  }
  throw new ArgumentError('Cannot compare values of different types');
}

/**
 * Reports whether the array contains the value under CEL equality.
 */
export function containsInArray(array: unknown[], value: unknown): boolean {
  for (const item of array) {
    if (equals(item, value)) {
      return true;
    }
  }
  return false;
}
