/**
 * Helpers for the CEL bytes type, represented as Uint8Array.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder('utf-8');

/** Reports whether the value is a CEL bytes value. */
export function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/** Encodes a string as UTF-8. */
export function utf8Encode(text: string): Uint8Array {
  return ENCODER.encode(text);
}

/** Decodes UTF-8 bytes into a string, replacing malformed sequences. */
export function utf8Decode(bytes: Uint8Array): string {
  return DECODER.decode(bytes);
}

/** Compares two byte arrays by content. */
export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Orders two byte arrays lexicographically, then by length.
 *
 * Mirrors Java's `Arrays.compare(byte[], byte[])`, which compares each byte as a
 * signed value.
 */
export function bytesCompare(left: Uint8Array, right: Uint8Array): number {
  const size = Math.min(left.length, right.length);
  for (let i = 0; i < size; i++) {
    const a = (left[i]! << 24) >> 24;
    const b = (right[i]! << 24) >> 24;
    if (a !== b) {
      return a < b ? -1 : 1;
    }
  }
  return left.length - right.length;
}

/** Concatenates two byte arrays. */
export function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

/** Renders bytes as lowercase hexadecimal, two digits per byte. */
export function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0');
  }
  return result;
}
