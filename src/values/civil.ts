import { ArgumentError, EvaluationError } from '../errors.js';

/**
 * Proleptic Gregorian calendar arithmetic and time-zone field extraction.
 *
 * The UTC path is pure BigInt arithmetic (Howard Hinnant's algorithms) and is
 * exact for the whole timestamp range. Named zones resolve through
 * Intl.DateTimeFormat, which requires full ICU data in the runtime.
 */

export const SECONDS_PER_DAY = 86_400n;

/** Floor division for bigint. */
export function floorDiv(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  return dividend % divisor !== 0n && dividend < 0n !== divisor < 0n ? quotient - 1n : quotient;
}

/** Floor modulo for bigint; the result has the sign of the divisor. */
export function floorMod(dividend: bigint, divisor: bigint): bigint {
  const remainder = dividend % divisor;
  return remainder !== 0n && remainder < 0n !== divisor < 0n ? remainder + divisor : remainder;
}

/**
 * Returns the number of days since 1970-01-01 for a proleptic Gregorian date.
 *
 * @param year The year (may be zero or negative)
 * @param month The month, 1-12
 * @param day The day of month, 1-31
 */
export function daysFromCivil(year: bigint, month: number, day: number): bigint {
  const y = month <= 2 ? year - 1n : year;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n;
  const m = BigInt(month);
  const doy = (153n * (m + (month > 2 ? -3n : 9n)) + 2n) / 5n + BigInt(day) - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146_097n + doe - 719_468n;
}

/**
 * Returns the proleptic Gregorian date for a count of days since 1970-01-01.
 */
export function civilFromDays(days: bigint): { year: bigint; month: number; day: number } {
  const z = days + 719_468n;
  const era = (z >= 0n ? z : z - 146_096n) / 146_097n;
  const doe = z - era * 146_097n;
  const yoe = (doe - doe / 1460n + doe / 36_524n - doe / 146_096n) / 365n;
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
  const mp = (5n * doy + 2n) / 153n;
  const day = Number(doy - (153n * mp + 2n) / 5n + 1n);
  const month = Number(mp < 10n ? mp + 3n : mp - 9n);
  return { year: month <= 2 ? y + 1n : y, month, day };
}

/** Reports whether the year is a leap year in the proleptic Gregorian calendar. */
export function isLeapYear(year: bigint): boolean {
  return year % 4n === 0n && (year % 100n !== 0n || year % 400n === 0n);
}

/** Returns the number of days in the given month. */
export function daysInMonth(year: bigint, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/** The broken-down civil fields of an instant in some zone. */
export interface CivilFields {
  year: bigint;
  /** Month of year, 1-12. */
  month: number;
  /** Day of month, 1-31. */
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Day of week where Sunday is 0. */
  weekday: number;
  /** Day of year, 1-366. */
  dayOfYear: number;
}

/** Breaks a count of seconds since the epoch into UTC civil fields. */
export function utcFields(seconds: bigint): CivilFields {
  const days = floorDiv(seconds, SECONDS_PER_DAY);
  const secondOfDay = Number(floorMod(seconds, SECONDS_PER_DAY));
  const { year, month, day } = civilFromDays(days);
  return {
    year,
    month,
    day,
    hour: Math.floor(secondOfDay / 3600),
    minute: Math.floor((secondOfDay % 3600) / 60),
    second: secondOfDay % 60,
    // 1970-01-01 was a Thursday
    weekday: Number(floorMod(days + 4n, 7n)),
    dayOfYear: Number(days - daysFromCivil(year, 1, 1)) + 1,
  };
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * Resolves an IANA zone identifier to a formatter, validating it.
 *
 * @throws ArgumentError if the zone is not a string or is unknown
 */
export function zoneFormatter(zone: unknown): Intl.DateTimeFormat {
  if (typeof zone !== 'string') {
    throw new ArgumentError(`Time zone must be a string: ${String(zone)}`);
  }
  const cached = FORMATTERS.get(zone);
  if (cached) {
    return cached;
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    throw new ArgumentError(`Invalid time zone: ${zone}`);
  }
  FORMATTERS.set(zone, formatter);
  return formatter;
}

// Date can represent roughly ±271,821 years around the epoch
const MAX_DATE_SECONDS = 8_640_000_000_000n;

/**
 * Returns the zone's UTC offset, in seconds, at the given instant.
 */
function offsetSeconds(formatter: Intl.DateTimeFormat, seconds: bigint): bigint {
  if (seconds > MAX_DATE_SECONDS || seconds < -MAX_DATE_SECONDS) {
    throw new EvaluationError('Timestamp out of range for time zone conversion');
  }
  const parts = formatter.formatToParts(new Date(Number(seconds) * 1000));
  const field = (type: string): string => parts.find((part) => part.type === type)?.value ?? '0';
  let year = BigInt(field('year'));
  if (field('era').startsWith('B')) {
    year = 1n - year;
  }
  const hour = Number(field('hour')) % 24;
  const wall =
    daysFromCivil(year, Number(field('month')), Number(field('day'))) * SECONDS_PER_DAY +
    BigInt(hour * 3600 + Number(field('minute')) * 60 + Number(field('second')));
  return wall - seconds;
}

/**
 * Breaks a count of seconds since the epoch into civil fields in the given zone.
 *
 * @param seconds Seconds since 1970-01-01T00:00:00Z
 * @param zone An IANA zone identifier, or null for UTC
 */
export function fieldsOf(seconds: bigint, zone: unknown): CivilFields {
  if (zone === null || zone === undefined) {
    return utcFields(seconds);
  }
  const formatter = zoneFormatter(zone);
  return utcFields(seconds + offsetSeconds(formatter, seconds));
}
