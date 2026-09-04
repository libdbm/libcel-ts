/**
 * A CEL type value, as returned by the `type()` function.
 *
 * Type values are interned, compare equal by name and are bound as identifiers,
 * so the specification form `type(42) == int` holds. They render as their bare
 * name, so `string(type(42))` is `"int"`.
 */
export class Type {
  /** The type of a null value. */
  static readonly NULL = new Type('null_type');
  /** The boolean type. */
  static readonly BOOL = new Type('bool');
  /** The signed integer type. */
  static readonly INT = new Type('int');
  /** The unsigned integer type. */
  static readonly UINT = new Type('uint');
  /** The double precision floating point type. */
  static readonly DOUBLE = new Type('double');
  /** The string type. */
  static readonly STRING = new Type('string');
  /** The bytes type. */
  static readonly BYTES = new Type('bytes');
  /** The list type. */
  static readonly LIST = new Type('list');
  /** The map type. */
  static readonly MAP = new Type('map');
  /** The timestamp type. */
  static readonly TIMESTAMP = new Type('timestamp');
  /** The duration type. */
  static readonly DURATION = new Type('duration');
  /** The type of a type value. */
  static readonly TYPE = new Type('type');
  /** The type of a value this library does not recognise. */
  static readonly UNKNOWN = new Type('unknown');

  private static readonly BY_NAME: ReadonlyMap<string, Type> = new Map(
    [
      Type.NULL,
      Type.BOOL,
      Type.INT,
      Type.UINT,
      Type.DOUBLE,
      Type.STRING,
      Type.BYTES,
      Type.LIST,
      Type.MAP,
      Type.TIMESTAMP,
      Type.DURATION,
      Type.TYPE,
    ].map((type) => [type.name, type])
  );

  private constructor(readonly name: string) {}

  /**
   * Returns the type with the given name, or null when the name does not denote a CEL type.
   *
   * Used to resolve bare type names such as `int` when they appear as identifiers.
   * `unknown` is deliberately not resolvable.
   *
   * @param name The candidate type name
   * @returns The matching type, or null
   */
  static of(name: string): Type | null {
    return Type.BY_NAME.get(name) ?? null;
  }

  /**
   * Reports whether the value is a Type.
   */
  static isType(value: unknown): value is Type {
    return value instanceof Type;
  }

  equals(other: unknown): boolean {
    return other instanceof Type && other.name === this.name;
  }

  toString(): string {
    return this.name;
  }
}
