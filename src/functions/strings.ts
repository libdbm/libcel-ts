/**
 * String functions from the CEL strings extension library.
 *
 * Functions are exported so library users can call them directly. Indices and
 * lengths count Unicode code points, so a supplementary character such as an
 * emoji is one position and is never split.
 */
import { ArgumentError, EvaluationError } from '../errors.js';
import { isBytes, utf8Encode, bytesToHex } from '../values/bytes.js';
import * as Utilities from './utilities.js';

// Translates a code point index into the UTF-16 offset the string methods expect
function offset(value: string, index: bigint, name: string): number {
  if (index < 0n || index > BigInt(Utilities.codePointCount(value))) {
    throw new ArgumentError(`${name}() index out of range: ${index}`);
  }
  return Utilities.offsetByCodePoints(value, Number(index));
}

// Translates a UTF-16 offset back into a code point index
function position(value: string, found: number): bigint {
  return found < 0 ? -1n : BigInt(Utilities.codePointCount(value.substring(0, found)));
}

/**
 * Returns the character at the given index as a single character string, or an
 * empty string at the end.
 *
 * @throws ArgumentError if the index is out of range
 */
export function charAt(value: string, index: bigint): string {
  const at = offset(value, index, 'charAt');
  if (at === value.length) {
    return '';
  }
  return String.fromCodePoint(value.codePointAt(at)!);
}

/**
 * Returns the index of the first occurrence of a substring at or after the
 * offset, or -1 when absent.
 *
 * @throws ArgumentError if the offset is out of range
 */
export function indexOf(value: string, search: string, start: bigint = 0n): bigint {
  return position(value, value.indexOf(search, offset(value, start, 'indexOf')));
}

/**
 * Returns the index of the last occurrence of a substring, searching backwards
 * from the offset when one is given, or -1 when absent.
 *
 * @throws ArgumentError if the offset is out of range
 */
export function lastIndexOf(value: string, search: string, start?: bigint): bigint {
  if (start === undefined) {
    return position(value, value.lastIndexOf(search));
  }
  return position(value, value.lastIndexOf(search, offset(value, start, 'lastIndexOf')));
}

/** Lowercases the ASCII letters of the string, leaving other characters untouched. */
export function lower(value: string): string {
  return value.replace(/[A-Z]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 32));
}

/** Uppercases the ASCII letters of the string, leaving other characters untouched. */
export function upper(value: string): string {
  return value.replace(/[a-z]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 32));
}

/**
 * Returns the substring between the given code point indices, or from the start
 * index to the end.
 *
 * @throws ArgumentError if the range is invalid
 */
export function substring(value: string, start: bigint, end?: bigint): string {
  if (end === undefined) {
    return value.substring(offset(value, start, 'substring'));
  }
  if (start > end) {
    throw new ArgumentError(`substring() range out of bounds: ${start}:${end}`);
  }
  return value.substring(offset(value, start, 'substring'), offset(value, end, 'substring'));
}

/** Reverses the string, preserving surrogate pairs. */
export function reverse(value: string): string {
  return Array.from(value).reverse().join('');
}

/**
 * Replaces occurrences of a literal substring.
 *
 * @param limit The maximum number of replacements, or -1 for all
 */
export function replace(value: string, from: string, to: string, limit: bigint = -1n): string {
  if (limit === 0n || from === '') {
    return value;
  }
  let result = '';
  let index = 0;
  let count = 0n;
  while (limit < 0n || count < limit) {
    const found = value.indexOf(from, index);
    if (found < 0) {
      break;
    }
    result += value.substring(index, found) + to;
    Utilities.limit(result.length, 'replace()');
    index = found + from.length;
    count++;
  }
  result += value.substring(index);
  Utilities.limit(result.length, 'replace()');
  return result;
}

/**
 * Splits a string around occurrences of a literal separator, following Java's
 * `String.split` limit semantics: a positive limit caps the number of parts with
 * the last part holding the unsplit remainder, and a negative limit keeps trailing
 * empty strings.
 *
 * @param limit The maximum number of parts, or -1 for no limit
 */
export function split(value: string, separator: string, limit: bigint = -1n): string[] {
  if (limit === 0n) {
    return [];
  }
  let parts: string[];
  if (separator === '') {
    // An empty pattern matches at every position, including the end
    parts = value === '' ? [''] : [...value.split(''), ''];
  } else {
    parts = value.split(separator);
  }
  if (limit > 0n && BigInt(parts.length) > limit) {
    const keep = Number(limit) - 1;
    parts = [...parts.slice(0, keep), parts.slice(keep).join(separator)];
  }
  return parts;
}

/**
 * Joins a list of strings with the given separator.
 *
 * @throws ArgumentError if any element is not a string
 */
export function join(values: unknown[], separator: string): string {
  // Projected before anything is allocated: two bounded inputs can still combine into a huge one
  let projected = Math.max(0, values.length - 1) * separator.length;
  for (const value of values) {
    if (typeof value !== 'string') {
      throw new ArgumentError('join() requires a list of strings');
    }
    projected += value.length;
    Utilities.limit(projected, 'join()');
  }
  let result = '';
  for (const value of values as string[]) {
    if (result.length > 0) {
      result += separator;
    }
    result += value;
  }
  return result;
}

/**
 * Formats a string using the CEL format verbs.
 *
 * Supported verbs are %s, %d, %f, %e, %b, %o, %x, %X and %%, each accepting an
 * optional precision such as %.3f.
 *
 * @throws ArgumentError if a verb is unknown or the argument count does not match
 */
export function format(template: string, args: unknown[]): string {
  let result = '';
  let next = 0;
  let i = 0;

  while (i < template.length) {
    const ch = template[i]!;
    if (ch !== '%') {
      result += ch;
      i++;
      continue;
    }
    if (i + 1 >= template.length) {
      throw new ArgumentError("format() has a trailing '%'");
    }
    if (template[i + 1] === '%') {
      result += '%';
      i += 2;
      continue;
    }

    let precision = -1;
    let at = i + 1;
    if (template[at] === '.') {
      at++;
      const digits = at;
      while (at < template.length && template[at]! >= '0' && template[at]! <= '9') {
        at++;
      }
      if (at === digits) {
        throw new ArgumentError('format() precision requires digits');
      }
      precision = number(template.substring(digits, at));
    }
    if (at >= template.length) {
      throw new ArgumentError('format() has an incomplete verb');
    }
    if (next >= args.length) {
      throw new ArgumentError('format() has more verbs than arguments');
    }

    result += convert(template[at]!, precision, args[next]);
    if (result.length > Utilities.LIMIT) {
      throw new EvaluationError(
        `format() output exceeds the evaluation limit of ${Utilities.LIMIT}`
      );
    }
    next++;
    i = at + 1;
  }

  if (next !== args.length) {
    throw new ArgumentError('format() has more arguments than verbs');
  }
  return result;
}

// Reads a precision, refusing one large enough to make the formatted output exhaust the heap
function number(digits: string): number {
  const value = digits.length > 18 ? Infinity : Number(digits);
  if (value > Utilities.LIMIT) {
    throw new EvaluationError(
      `format() precision exceeds the evaluation limit of ${Utilities.LIMIT}`
    );
  }
  return value;
}

function convert(verb: string, precision: number, value: unknown): string {
  switch (verb) {
    case 's':
      return Utilities.asString(value);
    case 'd':
      return Utilities.asInt(value).toString();
    case 'f':
      return fixed(Utilities.asDouble(value), precision < 0 ? 6 : precision);
    case 'e':
      return scientific(Utilities.asDouble(value), precision < 0 ? 6 : precision);
    case 'b':
      return typeof value === 'boolean' ? String(value) : unsigned(Utilities.asInt(value), 2);
    case 'o':
      return unsigned(Utilities.asInt(value), 8);
    case 'x':
      return hex(value, false);
    case 'X':
      return hex(value, true);
    default:
      throw new ArgumentError(`format() has an unknown verb: %${verb}`);
  }
}

// Renders a 64-bit value as its unsigned two's complement digits, like Long.toBinaryString
function unsigned(value: bigint, radix: number): string {
  return BigInt.asUintN(64, value).toString(radix);
}

/**
 * Renders a double with the given number of fractional digits, rounding half up
 * on its shortest decimal representation the way Java's
 * `BigDecimal.valueOf(d).setScale(p, HALF_UP)` does.
 */
export function fixed(value: number, precision: number): string {
  if (!Number.isFinite(value)) {
    throw new ArgumentError(`Cannot format non-finite value: ${value}`);
  }
  const negative = value < 0;
  const [mantissa, exponent] = Math.abs(value).toExponential().split('e') as [string, string];
  const digits = mantissa.replace('.', '');
  // value = digits × 10^-scale
  const scale = digits.length - 1 - Number(exponent);
  let scaled = BigInt(digits);
  if (scale <= precision) {
    scaled *= 10n ** BigInt(precision - scale);
  } else {
    const divisor = 10n ** BigInt(scale - precision);
    const quotient = scaled / divisor;
    const remainder = scaled % divisor;
    scaled = remainder * 2n >= divisor ? quotient + 1n : quotient;
  }
  const text = scaled.toString().padStart(precision + 1, '0');
  const whole = text.substring(0, text.length - precision);
  const fraction = text.substring(text.length - precision);
  const result = precision > 0 ? `${whole}.${fraction}` : whole;
  return negative && scaled !== 0n ? `-${result}` : result;
}

function scientific(value: number, precision: number): string {
  if (value === 0) {
    return fixed(0, precision) + 'e+00';
  }
  if (!Number.isFinite(value)) {
    throw new ArgumentError(`Cannot format non-finite value: ${value}`);
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);
  const sign = exponent < 0 ? '-' : '+';
  const magnitude = Math.abs(exponent);
  return `${fixed(mantissa, precision)}e${sign}${magnitude < 10 ? '0' : ''}${magnitude}`;
}

function hex(value: unknown, upper: boolean): string {
  let result: string;
  if (isBytes(value)) {
    result = bytesToHex(value);
  } else if (typeof value === 'string') {
    result = bytesToHex(utf8Encode(value));
  } else {
    result = unsigned(Utilities.asInt(value), 16);
  }
  return upper ? result.toUpperCase() : result;
}

/**
 * Escapes the string for inclusion in a CEL string literal, without the
 * enclosing quotes.
 */
export function escape(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    const code = value.charCodeAt(i);
    switch (ch) {
      case '\\':
        result += '\\\\';
        break;
      case '"':
        result += '\\"';
        break;
      case '\n':
        result += '\\n';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\t':
        result += '\\t';
        break;
      case '\b':
        result += '\\b';
        break;
      case '\f':
        result += '\\f';
        break;
      case '\u0007':
        result += '\\a';
        break;
      case '\u000B':
        result += '\\v';
        break;
      default:
        if (code < 0x20 || code === 0x7f) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += ch;
        }
    }
  }
  return result;
}

/** Returns the string as a quoted CEL string literal, including the double quotes. */
export function quote(value: string): string {
  return `"${escape(value)}"`;
}

/**
 * Escapes bytes for inclusion in a CEL bytes literal, without the enclosing
 * quotes.
 */
export function escapeBytes(value: Uint8Array): string {
  let result = '';
  for (const byte of value) {
    switch (byte) {
      case 0x5c:
        result += '\\\\';
        break;
      case 0x22:
        result += '\\"';
        break;
      case 0x0a:
        result += '\\n';
        break;
      case 0x0d:
        result += '\\r';
        break;
      case 0x09:
        result += '\\t';
        break;
      default:
        if (byte < 0x20 || byte >= 0x7f) {
          result += '\\x' + byte.toString(16).padStart(2, '0');
        } else {
          result += String.fromCharCode(byte);
        }
    }
  }
  return result;
}
