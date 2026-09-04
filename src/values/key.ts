import { bytesToHex, isBytes } from './bytes.js';
import { Duration } from './duration.js';
import { Timestamp } from './timestamp.js';
import { Type } from './type.js';

/**
 * Canonical keys for hashing CEL values.
 *
 * JavaScript Map and Set compare keys with SameValueZero, which does not match
 * CEL equality: `1` and `1.0` are equal in CEL, byte arrays compare by content,
 * and lists and maps compare structurally. `canonicalKey` renders a value as a
 * string that is identical for exactly those values CEL considers equal, so
 * membership tests can use a native Set in constant time.
 */

let nanCounter = 0;
const IDENTITIES = new WeakMap<object, number>();
let identityCounter = 0;

function identityOf(value: object): number {
  let id = IDENTITIES.get(value);
  if (id === undefined) {
    id = ++identityCounter;
    IDENTITIES.set(value, id);
  }
  return id;
}

function numberKey(value: number): string {
  if (Number.isNaN(value)) {
    // NaN never equals anything, itself included
    return `nan:${++nanCounter}`;
  }
  if (value === 0) {
    return 'n:0';
  }
  if (Number.isInteger(value)) {
    return `n:${BigInt(value)}`;
  }
  return `n:${value}`;
}

/**
 * Returns a string that is equal for two values exactly when CEL equality holds.
 */
export function canonicalKey(value: unknown): string {
  if (value === null || value === undefined) {
    return 'z';
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'b:1' : 'b:0';
    case 'string':
      return `s${value.length}:${value}`;
    case 'bigint':
      return `n:${value}`;
    case 'number':
      return numberKey(value);
    case 'object':
      break;
    default:
      return `o:${identityOf(value as object)}`;
  }
  if (isBytes(value)) {
    return `y:${bytesToHex(value)}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKey).join(',')}]`;
  }
  if (value instanceof Map) {
    const entries = Array.from(
      value.entries(),
      ([k, v]) => `${canonicalKey(k)}=${canonicalKey(v)}`
    );
    entries.sort();
    return `{${entries.join(',')}}`;
  }
  if (value instanceof Timestamp) {
    return `t:${value.seconds}.${value.nanos}`;
  }
  if (value instanceof Duration) {
    return `d:${value.seconds}.${value.nanos}`;
  }
  if (value instanceof Type) {
    return `T:${value.name}`;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${canonicalKey(k)}=${canonicalKey(v)}`
    );
    entries.sort();
    return `{${entries.join(',')}}`;
  }
  return `o:${identityOf(value as object)}`;
}

/** A set of CEL values keyed by CEL equality. */
export class KeySet {
  private readonly keys = new Set<string>();

  /** Adds the value; returns true if it was not already present. */
  add(value: unknown): boolean {
    const key = canonicalKey(value);
    if (this.keys.has(key)) {
      return false;
    }
    this.keys.add(key);
    return true;
  }

  has(value: unknown): boolean {
    return this.keys.has(canonicalKey(value));
  }

  get size(): number {
    return this.keys.size;
  }
}

/** A map from CEL values to arbitrary values, keyed by CEL equality. */
export class KeyMap<V> {
  private readonly entries = new Map<string, V>();

  set(key: unknown, value: V): void {
    this.entries.set(canonicalKey(key), value);
  }

  get(key: unknown): V | undefined {
    return this.entries.get(canonicalKey(key));
  }

  has(key: unknown): boolean {
    return this.entries.has(canonicalKey(key));
  }

  get size(): number {
    return this.entries.size;
  }
}
