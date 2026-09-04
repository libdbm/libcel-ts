import { ArgumentError } from '../errors.js';
import { floorDiv, floorMod } from './civil.js';

const NANOS_PER_SECOND = 1_000_000_000n;

const DURATION_FORM = /^-?(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+$/;
const DURATION_PART = /(\d+)(?:\.(\d+))?(ns|us|µs|ms|s|m|h)/g;

const UNIT_NANOS: Record<string, bigint> = {
  ns: 1n,
  us: 1_000n,
  µs: 1_000n,
  ms: 1_000_000n,
  s: NANOS_PER_SECOND,
  m: NANOS_PER_SECOND * 60n,
  h: NANOS_PER_SECOND * 3600n,
};

/**
 * A CEL duration with nanosecond precision.
 *
 * Follows the java.time convention: `nanos` is always in `0..999_999_999` and the
 * sign is carried by `seconds`, so -1.5s is `{ seconds: -2n, nanos: 500_000_000 }`.
 */
export class Duration {
  /** The largest number of seconds a duration may span, per the CEL specification. */
  static readonly SPAN = 315_576_000_000n;

  static readonly ZERO = new Duration(0n, 0);

  private constructor(
    readonly seconds: bigint,
    readonly nanos: number
  ) {}

  /**
   * Creates a duration from seconds and a nanosecond adjustment, normalising the
   * adjustment into the seconds.
   */
  static ofSeconds(seconds: bigint, nanoAdjustment: bigint = 0n): Duration {
    const total = seconds + floorDiv(nanoAdjustment, NANOS_PER_SECOND);
    const nanos = Number(floorMod(nanoAdjustment, NANOS_PER_SECOND));
    return new Duration(total, nanos);
  }

  static ofNanos(nanos: bigint): Duration {
    return Duration.ofSeconds(0n, nanos);
  }

  static ofMillis(millis: bigint): Duration {
    return Duration.ofSeconds(0n, millis * 1_000_000n);
  }

  static ofMinutes(minutes: bigint): Duration {
    return new Duration(minutes * 60n, 0);
  }

  static ofHours(hours: bigint): Duration {
    return new Duration(hours * 3600n, 0);
  }

  /**
   * Parses a CEL duration literal such as `"300ms"`, `"-1.5h"` or `"2h45m"`.
   *
   * Units are `ns`, `us`, `µs`, `ms`, `s`, `m` and `h`. The value is accumulated
   * exactly and rounded half up to the nearest nanosecond.
   *
   * @throws ArgumentError if the format is invalid or the span exceeds ±10 000 years
   */
  static parse(text: string): Duration {
    if (!DURATION_FORM.test(text)) {
      throw new ArgumentError(`Invalid duration format: ${text}`);
    }
    const parts = Array.from(text.matchAll(DURATION_PART));
    // Accumulate over a common power-of-ten denominator so fractions stay exact
    const scale = Math.max(0, ...parts.map((part) => part[2]?.length ?? 0));
    const denominator = 10n ** BigInt(scale);
    let numerator = 0n;
    for (const part of parts) {
      const whole = part[1]!;
      const fraction = part[2] ?? '';
      const digits = BigInt(whole + fraction) * 10n ** BigInt(scale - fraction.length);
      numerator += digits * UNIT_NANOS[part[3]!]!;
    }
    let nanos = numerator / denominator;
    if ((numerator % denominator) * 2n >= denominator) {
      nanos += 1n;
    }
    const seconds = nanos / NANOS_PER_SECOND;
    if (seconds > Duration.SPAN) {
      throw new ArgumentError(`Duration out of range: ${text}`);
    }
    const result = Duration.ofSeconds(seconds, nanos % NANOS_PER_SECOND);
    return text.startsWith('-') ? result.negated() : result;
  }

  /** Reports whether the value is a Duration. */
  static isDuration(value: unknown): value is Duration {
    return value instanceof Duration;
  }

  isNegative(): boolean {
    return this.seconds < 0n;
  }

  isZero(): boolean {
    return this.seconds === 0n && this.nanos === 0;
  }

  negated(): Duration {
    return Duration.ofSeconds(-this.seconds, -BigInt(this.nanos));
  }

  plus(other: Duration): Duration {
    return Duration.ofSeconds(this.seconds + other.seconds, BigInt(this.nanos + other.nanos));
  }

  minus(other: Duration): Duration {
    return Duration.ofSeconds(this.seconds - other.seconds, BigInt(this.nanos - other.nanos));
  }

  /** The total length in nanoseconds. */
  toNanos(): bigint {
    return this.seconds * NANOS_PER_SECOND + BigInt(this.nanos);
  }

  /** The whole number of milliseconds, truncated toward zero. */
  toMillis(): bigint {
    return this.toNanos() / 1_000_000n;
  }

  /** The whole number of seconds, truncated toward negative infinity (the seconds field). */
  toSeconds(): bigint {
    return this.seconds;
  }

  /** The whole number of minutes, truncated toward zero. */
  toMinutes(): bigint {
    return this.seconds / 60n;
  }

  /** The whole number of hours, truncated toward zero. */
  toHours(): bigint {
    return this.seconds / 3600n;
  }

  compareTo(other: Duration): number {
    if (this.seconds !== other.seconds) {
      return this.seconds < other.seconds ? -1 : 1;
    }
    return this.nanos - other.nanos;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof Duration && other.seconds === this.seconds && other.nanos === this.nanos
    );
  }

  /**
   * Renders the duration the way the CEL specification does: a seconds count with
   * an `s` suffix, for example `"3600s"`, `"1.5s"` or `"-90s"`.
   */
  toString(): string {
    if (this.isNegative()) {
      return '-' + this.negated().toString();
    }
    if (this.nanos === 0) {
      return `${this.seconds}s`;
    }
    const fraction = String(this.nanos).padStart(9, '0').replace(/0+$/, '');
    return `${this.seconds}.${fraction}s`;
  }
}
