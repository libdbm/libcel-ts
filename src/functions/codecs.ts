/**
 * Encoding functions from the CEL encoders extension library.
 *
 * Functions are exported so library users can call them directly. The codec is
 * implemented by hand so that it behaves identically in browsers and Node.
 */
import { ArgumentError } from '../errors.js';
import { utf8Decode } from '../values/bytes.js';
import * as Utilities from './utilities.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALUES = new Map<string, number>(Array.from(ALPHABET, (ch, i) => [ch, i]));

/**
 * Encodes bytes, or a string as UTF-8, in standard base64 with padding.
 *
 * @throws ArgumentError if the value cannot be converted to bytes
 */
export function encode(value: unknown): string {
  const bytes = Utilities.asBytes(value);
  Utilities.limit(4 * Math.ceil(bytes.length / 3), 'base64.encode()');
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    result +=
      ALPHABET[chunk >> 18]! +
      ALPHABET[(chunk >> 12) & 63]! +
      ALPHABET[(chunk >> 6) & 63]! +
      ALPHABET[chunk & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const chunk = bytes[i]! << 16;
    result += ALPHABET[chunk >> 18]! + ALPHABET[(chunk >> 12) & 63]! + '==';
  } else if (rest === 2) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    result +=
      ALPHABET[chunk >> 18]! + ALPHABET[(chunk >> 12) & 63]! + ALPHABET[(chunk >> 6) & 63]! + '=';
  }
  return result;
}

/**
 * Decodes standard base64 text into bytes.
 *
 * Only the standard alphabet is accepted; padding is optional but must be
 * well formed when present.
 *
 * @throws ArgumentError if the text is not valid base64
 */
export function decode(value: unknown): Uint8Array {
  if (typeof value !== 'string') {
    throw new ArgumentError('base64.decode() requires string arguments');
  }
  let data = value;
  let padding = 0;
  while (data.endsWith('=') && padding < 2) {
    data = data.substring(0, data.length - 1);
    padding++;
  }
  const remainder = data.length % 4;
  if (
    data.includes('=') ||
    remainder === 1 ||
    (padding > 0 && (remainder === 0 || padding !== 4 - remainder))
  ) {
    throw new ArgumentError(`Invalid base64 input: ${value}`);
  }
  const result: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of data) {
    const sextet = VALUES.get(ch);
    if (sextet === undefined) {
      throw new ArgumentError(`Invalid base64 input: ${value}`);
    }
    buffer = ((buffer << 6) | sextet) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(result);
}

/**
 * Decodes base64 text into a UTF-8 string.
 *
 * @throws ArgumentError if the text is not valid base64
 */
export function text(value: string): string {
  return utf8Decode(decode(value));
}
