import { ArgumentError, EvaluationError } from '../errors.js';
import {
  SECONDS_PER_DAY,
  daysFromCivil,
  daysInMonth,
  floorDiv,
  floorMod,
  utcFields,
} from './civil.js';
import { Duration } from './duration.js';

const NANOS_PER_SECOND = 1_000_000_000n;

const RFC3339 =
  /^([+-]?\d{4,9})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * A CEL timestamp: an instant on the UTC time line with nanosecond precision.
 *
 * `nanos` is always in `0..999_999_999`; `seconds` counts from
 * 1970-01-01T00:00:00Z and may be negative.
 */
export class Timestamp {
  /** Epoch second of the smallest supported instant (java.time.Instant.MIN). */
  static readonly MIN_SECONDS = -31_557_014_167_219_200n;
  /** Epoch second of the largest supported instant (java.time.Instant.MAX). */
  static readonly MAX_SECONDS = 31_556_889_864_403_199n;

  private constructor(
    readonly seconds: bigint,
    readonly nanos: number
  ) {}

  /**
   * Creates a timestamp from epoch seconds and a nanosecond adjustment.
   *
   * @throws ArgumentError if the instant is outside the supported range
   */
  static ofEpochSeconds(seconds: bigint, nanoAdjustment: bigint = 0n): Timestamp {
    const total = seconds + floorDiv(nanoAdjustment, NANOS_PER_SECOND);
    const nanos = Number(floorMod(nanoAdjustment, NANOS_PER_SECOND));
    if (total < Timestamp.MIN_SECONDS || total > Timestamp.MAX_SECONDS) {
      throw new ArgumentError(`Timestamp out of range: ${seconds}`);
    }
    return new Timestamp(total, nanos);
  }

  /** Creates a timestamp from epoch milliseconds. */
  static ofEpochMillis(millis: bigint): Timestamp {
    return Timestamp.ofEpochSeconds(0n, millis * 1_000_000n);
  }

  /** Converts a JavaScript Date. */
  static fromDate(date: Date): Timestamp {
    const millis = date.getTime();
    if (Number.isNaN(millis)) {
      throw new ArgumentError('Invalid timestamp value: Invalid Date');
    }
    return Timestamp.ofEpochMillis(BigInt(millis));
  }

  /** The current instant, at millisecond resolution. */
  static now(): Timestamp {
    return Timestamp.ofEpochMillis(BigInt(Date.now()));
  }

  /**
   * Parses an RFC 3339 timestamp such as `2024-01-01T00:00:00Z` or
   * `2024-01-01T01:00:00.5+01:00`.
   *
   * @throws ArgumentError if the text is not a valid timestamp
   */
  static parse(text: string): Timestamp {
    const match = RFC3339.exec(text);
    if (!match) {
      throw new ArgumentError(`Invalid timestamp value: ${text}`);
    }
    const year = BigInt(match[1]!);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] ?? '0');
    const nanos = Number((match[7] ?? '').padEnd(9, '0'));
    const offset = match[8]!;
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      throw new ArgumentError(`Invalid timestamp value: ${text}`);
    }
    let offsetSeconds = 0n;
    if (offset !== 'Z' && offset !== 'z') {
      const sign = offset.startsWith('-') ? -1n : 1n;
      const hours = Number(offset.slice(1, 3));
      const minutes = Number(offset.slice(4, 6));
      if (hours > 18 || minutes > 59) {
        throw new ArgumentError(`Invalid timestamp value: ${text}`);
      }
      offsetSeconds = sign * BigInt(hours * 3600 + minutes * 60);
    }
    const seconds =
      daysFromCivil(year, month, day) * SECONDS_PER_DAY +
      BigInt(hour * 3600 + minute * 60 + second) -
      offsetSeconds;
    return Timestamp.ofEpochSeconds(seconds, BigInt(nanos));
  }

  /** Reports whether the value is a Timestamp. */
  static isTimestamp(value: unknown): value is Timestamp {
    return value instanceof Timestamp;
  }

  /** Converts to a JavaScript Date, truncating to milliseconds. */
  toDate(): Date {
    return new Date(Number(this.seconds) * 1000 + Math.floor(this.nanos / 1_000_000));
  }

  /**
   * Adds a duration.
   *
   * @throws EvaluationError if the result is outside the supported range
   */
  plus(duration: Duration): Timestamp {
    return this.shift(duration.seconds, duration.nanos);
  }

  /**
   * Subtracts a duration.
   *
   * @throws EvaluationError if the result is outside the supported range
   */
  minus(duration: Duration): Timestamp {
    return this.shift(-duration.seconds, -duration.nanos);
  }

  private shift(seconds: bigint, nanos: number): Timestamp {
    try {
      return Timestamp.ofEpochSeconds(this.seconds + seconds, BigInt(this.nanos + nanos));
    } catch (error) {
      if (error instanceof ArgumentError) {
        throw new EvaluationError('Timestamp out of range');
      }
      throw error;
    }
  }

  /** The duration from this instant to another (`other - this`). */
  until(other: Timestamp): Duration {
    return Duration.ofSeconds(other.seconds - this.seconds, BigInt(other.nanos - this.nanos));
  }

  compareTo(other: Timestamp): number {
    if (this.seconds !== other.seconds) {
      return this.seconds < other.seconds ? -1 : 1;
    }
    return this.nanos - other.nanos;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof Timestamp && other.seconds === this.seconds && other.nanos === this.nanos
    );
  }

  /**
   * Renders the instant in ISO-8601 form, the way java.time.Instant does:
   * `2024-03-05T14:30:45.250Z`, with the fraction shown in groups of three
   * digits only as far as needed.
   */
  toString(): string {
    const fields = utcFields(this.seconds);
    const pad = (value: number): string => String(value).padStart(2, '0');
    let year: string;
    if (fields.year > 9999n) {
      year = '+' + fields.year;
    } else if (fields.year < 0n) {
      year = '-' + String(-fields.year).padStart(4, '0');
    } else {
      year = String(fields.year).padStart(4, '0');
    }
    let fraction = '';
    if (this.nanos !== 0) {
      if (this.nanos % 1_000_000 === 0) {
        fraction = '.' + String(this.nanos / 1_000_000).padStart(3, '0');
      } else if (this.nanos % 1000 === 0) {
        fraction = '.' + String(this.nanos / 1000).padStart(6, '0');
      } else {
        fraction = '.' + String(this.nanos).padStart(9, '0');
      }
    }
    return `${year}-${pad(fields.month)}-${pad(fields.day)}T${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}${fraction}Z`;
  }
}
