/**
 * Utility helper methods for libcel.
 * Methods are exported so library users can call them directly.
 */

/**
 * Returns the size/length of the given value.
 *
 * Supported types:
 * - String: number of characters
 * - Array: number of elements
 * - Map/Record: number of entries
 * - null: 0
 *
 * @param value The value whose size should be computed; may be null
 * @returns The size for supported types, or 0 for null
 * @throws Error if the value type is unsupported
 */
export function sizeOf(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length;
  }
  throw new Error(`size() not supported for type: ${typeof value}`);
}

/**
 * Converts the given value to a signed integer (number).
 *
 * Accepted inputs: number, string (parsed as integer), boolean (true=1, false=0)
 *
 * @param value The value to convert
 * @returns The converted integer value
 * @throws Error if the value cannot be converted
 */
export function asInt(value: any): number {
  if (typeof value === 'number') {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert to int: ${value}`);
    }
    return parsed;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  throw new Error(`Cannot convert to int: ${value}`);
}

/**
 * Converts the given value to an unsigned integer.
 *
 * Negative inputs are not allowed and will result in an exception.
 *
 * @param value The value to convert
 * @returns The non-negative integer value
 * @throws Error if the value is negative or cannot be converted
 */
export function asUInt(value: any): number {
  const result = asInt(value);
  if (result < 0) {
    throw new Error(`Cannot convert negative value to uint: ${value}`);
  }
  return result;
}

/**
 * Converts the given value to a double (number).
 *
 * Accepted inputs: number, string parsable as number
 *
 * @param value The value to convert
 * @returns The converted number value
 * @throws Error if the value cannot be converted
 */
export function asDouble(value: any): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert to double: ${value}`);
    }
    return parsed;
  }
  throw new Error(`Cannot convert to double: ${value}`);
}

/**
 * Converts the given value to its string representation.
 *
 * Returns the literal string "null" for null/undefined values.
 *
 * @param value The value to stringify
 * @returns The string representation
 */
export function asString(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  return String(value);
}

/**
 * Converts the given value to a boolean using common truthiness rules.
 *
 * Numbers are true if non-zero. Strings are true if non-empty.
 * Collections/maps are true if non-empty. Null is false.
 *
 * @param value The value to interpret
 * @returns The boolean interpretation
 */
export function asBool(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
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
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0;
  }
  return value != null;
}

/**
 * Returns a simple type name for the given value.
 *
 * Possible results: "null", "bool", "int", "double", "string", "list", "map", or "unknown"
 *
 * @param value The value whose type is to be described
 * @returns The simple type name
 */
export function typeOf(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return 'bool';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'double';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  if (typeof value === 'object') {
    return 'map';
  }
  return 'unknown';
}

/**
 * Checks whether a map contains the given field name.
 *
 * @param target The map-like object to check (must be an object to return true/false)
 * @param field The field/key to look for (must be a string)
 * @returns true if target is a Map/object and contains the given key; false otherwise
 */
export function has(target: any, field: any): boolean {
  if (typeof target === 'object' && target !== null && typeof field === 'string') {
    return field in target;
  }
  return false;
}

/**
 * Tests whether the given regular expression matches any part of the text.
 *
 * Uses RegExp pattern matching with find semantics.
 *
 * @param text The input text
 * @param pattern The regular expression pattern
 * @returns true if the pattern matches anywhere in the text; false otherwise
 * @throws Error if the pattern is invalid
 */
export function matches(text: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(text);
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Returns the maximum element from a non-empty array of values.
 *
 * Comparison rules follow compare(). All elements must be mutually comparable.
 *
 * @param values A non-empty array of values
 * @returns The maximum value in the array
 * @throws Error if the array is empty or values are not comparable
 */
export function max(values: any[]): any {
  if (values.length === 0) {
    throw new Error('max() requires at least one argument');
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
 * Returns the minimum element from a non-empty array of values.
 *
 * Comparison rules follow compare(). All elements must be mutually comparable.
 *
 * @param values A non-empty array of values
 * @returns The minimum value in the array
 * @throws Error if the array is empty or values are not comparable
 */
export function min(values: any[]): any {
  if (values.length === 0) {
    throw new Error('min() requires at least one argument');
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
 * Compares two values using a common set of rules.
 *
 * Supported comparisons: numbers (by numeric value), strings (lexicographically),
 * booleans, arrays (lexicographically).
 *
 * @param a The first value
 * @param b The second value
 * @returns A negative number, zero, or a positive number as a is less than, equal to, or greater than b
 * @throws Error if the values cannot be compared
 */
export function compare(a: any, b: any): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return -1;
  }
  if (b === null) {
    return 1;
  }

  // Number comparison
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  // String comparison
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }

  // Boolean comparison
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }

  // Array comparison (lexicographic)
  if (Array.isArray(a) && Array.isArray(b)) {
    const size = Math.min(a.length, b.length);
    for (let i = 0; i < size; i++) {
      const cmp = compare(a[i], b[i]);
      if (cmp !== 0) {
        return cmp;
      }
    }
    return a.length - b.length;
  }

  throw new Error(`Cannot compare types: ${typeof a} and ${typeof b}`);
}

/**
 * Deep equality check for CEL values.
 *
 * @param left First value
 * @param right Second value
 * @returns true if values are deeply equal
 */
export function deepEquals(left: any, right: any): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }

  // Array equality
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i++) {
      if (!deepEquals(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  // Object/Map equality
  if (typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!(key in right)) {
        return false;
      }
      if (!deepEquals(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  // Numeric equality with type coercion
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }

  // Standard equality
  return left === right;
}

/**
 * Helper for array contains with deep equality.
 *
 * @param array The array to search
 * @param value The value to find
 * @returns true if the array contains the value (using deep equality)
 */
export function containsInArray(array: any[], value: any): boolean {
  for (const item of array) {
    if (deepEquals(item, value)) {
      return true;
    }
  }
  return false;
}
