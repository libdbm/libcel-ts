import { describe, it, expect } from 'vitest';
import { ArgumentError, EvaluationError } from '../src/errors.js';
import { Type } from '../src/values/type.js';
import { Duration } from '../src/values/duration.js';
import { Timestamp } from '../src/values/timestamp.js';
import { canonicalKey, KeySet } from '../src/values/key.js';
import { normalize } from '../src/values/normalize.js';
import {
  INT64_MAX,
  INT64_MIN,
  checkInt64,
  javaDoubleToString,
  order,
  truncateToInt64,
} from '../src/values/numbers.js';
import { bytesCompare, utf8Decode, utf8Encode } from '../src/values/bytes.js';
import { daysFromCivil, civilFromDays, fieldsOf } from '../src/values/civil.js';

describe('Type', () => {
  it('should resolve names to interned constants', () => {
    expect(Type.of('int')).toBe(Type.INT);
    expect(Type.of('null_type')).toBe(Type.NULL);
    expect(Type.of('type')).toBe(Type.TYPE);
    expect(Type.of('unknown')).toBeNull();
    expect(Type.of('missing')).toBeNull();
  });

  it('should render as the bare name', () => {
    expect(String(Type.TIMESTAMP)).toBe('timestamp');
    expect(Type.INT.equals(Type.INT)).toBe(true);
    expect(Type.INT.equals(Type.UINT)).toBe(false);
  });
});

describe('numbers', () => {
  it('should order mixed numbers exactly', () => {
    expect(order(1n, 1)).toBe(0);
    expect(order(1n, 1.5)).toBe(-1);
    expect(order(2n, 1.5)).toBe(1);
    expect(order(1.5, 1n)).toBe(1);
    expect(order(-1n, -0.5)).toBe(-1);
    // Converting both to a double would call these equal
    expect(order(9223372036854775807n, 9223372036854775808.0)).toBe(-1);
    expect(order(9007199254740993n, 9007199254740992.0)).toBe(1);
    expect(order(1n, Infinity)).toBe(-1);
    expect(order(1n, -Infinity)).toBe(1);
    expect(order(0, -0)).toBe(0);
  });

  it('should treat NaN as greater than everything and equal to itself', () => {
    expect(order(NaN, NaN)).toBe(0);
    expect(order(NaN, 1)).toBe(1);
    expect(order(1, NaN)).toBe(-1);
    expect(order(1n, NaN)).toBe(-1);
  });

  it('should detect 64-bit overflow', () => {
    expect(checkInt64(INT64_MAX)).toBe(INT64_MAX);
    expect(() => checkInt64(INT64_MAX + 1n)).toThrow(EvaluationError);
    expect(() => checkInt64(INT64_MIN - 1n)).toThrow(EvaluationError);
  });

  it('should truncate doubles like Java longValue', () => {
    expect(truncateToInt64(1.9)).toBe(1n);
    expect(truncateToInt64(-1.9)).toBe(-1n);
    expect(truncateToInt64(NaN)).toBe(0n);
    expect(truncateToInt64(1e30)).toBe(INT64_MAX);
    expect(truncateToInt64(-1e30)).toBe(INT64_MIN);
  });

  it('should format doubles like Java Double.toString', () => {
    expect(javaDoubleToString(1)).toBe('1.0');
    expect(javaDoubleToString(3.14)).toBe('3.14');
    expect(javaDoubleToString(100)).toBe('100.0');
    expect(javaDoubleToString(0.001)).toBe('0.001');
    expect(javaDoubleToString(1e-4)).toBe('1.0E-4');
    expect(javaDoubleToString(1e10)).toBe('1.0E10');
    expect(javaDoubleToString(1.234e-5)).toBe('1.234E-5');
    expect(javaDoubleToString(1234567)).toBe('1234567.0');
    expect(javaDoubleToString(12345678)).toBe('1.2345678E7');
    expect(javaDoubleToString(-2.5)).toBe('-2.5');
    expect(javaDoubleToString(0)).toBe('0.0');
    expect(javaDoubleToString(-0)).toBe('-0.0');
    expect(javaDoubleToString(NaN)).toBe('NaN');
    expect(javaDoubleToString(-Infinity)).toBe('-Infinity');
  });
});

describe('bytes', () => {
  it('should round trip UTF-8', () => {
    expect(utf8Decode(utf8Encode('café 😀'))).toBe('café 😀');
    expect(Array.from(utf8Encode('hi'))).toEqual([104, 105]);
  });

  it('should compare like Arrays.compare', () => {
    expect(bytesCompare(utf8Encode('ab'), utf8Encode('ab'))).toBe(0);
    expect(bytesCompare(utf8Encode('ab'), utf8Encode('abc'))).toBeLessThan(0);
    expect(bytesCompare(utf8Encode('b'), utf8Encode('a'))).toBeGreaterThan(0);
  });
});

describe('Duration', () => {
  it('should parse multi-unit literals', () => {
    expect(Duration.parse('1h30m')).toEqual(Duration.ofMinutes(90n));
    expect(Duration.parse('1.5s').toString()).toBe('1.5s');
    expect(Duration.parse('100ms').toMillis()).toBe(100n);
    expect(Duration.parse('10ns').toNanos()).toBe(10n);
    expect(Duration.parse('-2h').toHours()).toBe(-2n);
    expect(Duration.parse('1.500000001s').toString()).toBe('1.500000001s');
    expect(Duration.parse('0.000000001s').toNanos()).toBe(1n);
  });

  it('should keep large durations exact', () => {
    // A double would clamp this to 9223372036 seconds
    expect(Duration.parse('10000000h').toString()).toBe('36000000000s');
    expect(() => Duration.parse('100000000h')).toThrow(ArgumentError);
    expect(() => Duration.parse('5x')).toThrow(ArgumentError);
    expect(() => Duration.parse('')).toThrow(ArgumentError);
  });

  it('should render negative durations in CEL form', () => {
    expect(Duration.parse('-1m30s').toString()).toBe('-90s');
    expect(Duration.parse('-1.5s').seconds).toBe(-2n);
    expect(Duration.parse('-1.5s').nanos).toBe(500_000_000);
    expect(Duration.parse('-1.5s').toMillis()).toBe(-1500n);
    expect(Duration.ZERO.toString()).toBe('0s');
  });

  it('should support arithmetic and comparison', () => {
    const one = Duration.parse('1h');
    const half = Duration.parse('30m');
    expect(one.plus(half).toString()).toBe('5400s');
    expect(one.minus(half).toString()).toBe('1800s');
    expect(one.negated().toString()).toBe('-3600s');
    expect(half.compareTo(one)).toBeLessThan(0);
    expect(one.equals(Duration.parse('60m'))).toBe(true);
  });
});

describe('Timestamp', () => {
  const MOMENT = '2024-03-05T14:30:45.250Z';

  it('should parse and render RFC 3339', () => {
    const t = Timestamp.parse(MOMENT);
    expect(t.seconds).toBe(1709649045n);
    expect(t.nanos).toBe(250_000_000);
    expect(t.toString()).toBe(MOMENT);
    expect(Timestamp.parse('2024-01-01T00:00:00Z').toString()).toBe('2024-01-01T00:00:00Z');
    expect(Timestamp.parse('2024-01-01T00:00:00.000000001Z').toString()).toBe(
      '2024-01-01T00:00:00.000000001Z'
    );
    expect(Timestamp.parse('2024-01-01T00:00:00.5Z').toString()).toBe('2024-01-01T00:00:00.500Z');
  });

  it('should honour offsets', () => {
    expect(
      Timestamp.parse('2024-01-01T01:00:00+01:00').equals(Timestamp.parse('2024-01-01T00:00:00Z'))
    ).toBe(true);
    expect(Timestamp.parse('2023-12-31T19:00:00-05:00').toString()).toBe('2024-01-01T00:00:00Z');
  });

  it('should reject invalid text and out-of-range values', () => {
    expect(() => Timestamp.parse('2024-13-01T00:00:00Z')).toThrow(ArgumentError);
    expect(() => Timestamp.parse('2023-02-29T00:00:00Z')).toThrow(ArgumentError);
    expect(() => Timestamp.parse('not a date')).toThrow(ArgumentError);
    expect(() => Timestamp.ofEpochSeconds(Timestamp.MAX_SECONDS + 1n)).toThrow(ArgumentError);
    expect(Timestamp.ofEpochSeconds(0n).toString()).toBe('1970-01-01T00:00:00Z');
    expect(Timestamp.ofEpochSeconds(-1n).toString()).toBe('1969-12-31T23:59:59Z');
  });

  it('should convert to and from Date', () => {
    const date = new Date(MOMENT);
    const t = Timestamp.fromDate(date);
    expect(t.equals(Timestamp.parse(MOMENT))).toBe(true);
    expect(t.toDate().getTime()).toBe(date.getTime());
  });

  it('should add and subtract durations', () => {
    const t = Timestamp.parse(MOMENT);
    expect(t.plus(Duration.parse('1h')).toString()).toBe('2024-03-05T15:30:45.250Z');
    expect(t.minus(Duration.parse('1s')).toString()).toBe('2024-03-05T14:30:44.250Z');
    expect(t.until(t.plus(Duration.parse('90s'))).toString()).toBe('90s');
    expect(t.plus(Duration.parse('90s')).until(t).toString()).toBe('-90s');
    expect(() =>
      Timestamp.ofEpochSeconds(Timestamp.MAX_SECONDS).plus(Duration.parse('1h'))
    ).toThrow(EvaluationError);
  });
});

describe('civil', () => {
  it('should round trip dates', () => {
    expect(daysFromCivil(1970n, 1, 1)).toBe(0n);
    expect(daysFromCivil(2000n, 3, 1)).toBe(11017n);
    expect(civilFromDays(11017n)).toEqual({ year: 2000n, month: 3, day: 1 });
    expect(civilFromDays(-1n)).toEqual({ year: 1969n, month: 12, day: 31 });
    expect(civilFromDays(daysFromCivil(-44n, 3, 15))).toEqual({ year: -44n, month: 3, day: 15 });
  });

  it('should extract UTC fields', () => {
    const fields = fieldsOf(Timestamp.parse('2024-03-05T14:30:45Z').seconds, null);
    expect(fields).toEqual({
      year: 2024n,
      month: 3,
      day: 5,
      hour: 14,
      minute: 30,
      second: 45,
      weekday: 2,
      dayOfYear: 65,
    });
    expect(fieldsOf(0n, null).weekday).toBe(4);
  });

  it('should extract zoned fields', () => {
    const seconds = Timestamp.parse('2024-03-05T14:30:45Z').seconds;
    expect(fieldsOf(seconds, 'America/New_York').hour).toBe(9);
    expect(fieldsOf(seconds, 'Asia/Tokyo').hour).toBe(23);
    const late = Timestamp.parse('2024-03-05T23:30:00Z').seconds;
    expect(fieldsOf(late, 'Asia/Tokyo').day).toBe(6);
    expect(fieldsOf(late, 'Asia/Tokyo').weekday).toBe(3);
    expect(fieldsOf(late, 'UTC').day).toBe(5);
    expect(() => fieldsOf(seconds, 'Mars/Olympus')).toThrow(ArgumentError);
    expect(() => fieldsOf(seconds, 5)).toThrow(ArgumentError);
  });
});

describe('canonicalKey', () => {
  it('should agree with CEL equality', () => {
    expect(canonicalKey(1n)).toBe(canonicalKey(1));
    expect(canonicalKey(-0)).toBe(canonicalKey(0));
    expect(canonicalKey(0n)).toBe(canonicalKey(-0));
    expect(canonicalKey(1.5)).not.toBe(canonicalKey(1n));
    expect(canonicalKey(9007199254740993n)).not.toBe(canonicalKey(9007199254740992));
    expect(canonicalKey(NaN)).not.toBe(canonicalKey(NaN));
    expect(canonicalKey(utf8Encode('ab'))).toBe(canonicalKey(utf8Encode('ab')));
    expect(canonicalKey(utf8Encode('ab'))).not.toBe(canonicalKey(utf8Encode('ba')));
    expect(canonicalKey([1n, [2n]])).toBe(canonicalKey([1, [2]]));
    expect(canonicalKey(['a,b'])).not.toBe(canonicalKey(['a', 'b']));
    expect(canonicalKey(['a,s1:b'])).not.toBe(canonicalKey(['a', 'b']));
    expect(
      canonicalKey(
        new Map([
          ['a', 1n],
          ['b', 2n],
        ])
      )
    ).toBe(
      canonicalKey(
        new Map([
          ['b', 2],
          ['a', 1],
        ])
      )
    );
    expect(canonicalKey('1')).not.toBe(canonicalKey(1n));
    expect(canonicalKey(null)).not.toBe(canonicalKey(false));
    expect(canonicalKey(Type.INT)).toBe(canonicalKey(Type.of('int')));
  });

  it('should back a set with CEL equality', () => {
    const set = new KeySet();
    expect(set.add(1n)).toBe(true);
    expect(set.add(1.0)).toBe(false);
    expect(set.add(-0.0)).toBe(true);
    expect(set.add(0n)).toBe(false);
    expect(set.has(1)).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe('normalize', () => {
  it('should convert JavaScript values to the CEL model', () => {
    expect(normalize(undefined)).toBeNull();
    expect(normalize(3)).toBe(3n);
    expect(normalize(-0)).toBe(0n);
    expect(normalize(2.5)).toBe(2.5);
    expect(normalize(7n)).toBe(7n);
    expect(normalize('x')).toBe('x');
    expect(normalize(true)).toBe(true);
    expect(normalize([1, 2.5, 'a'])).toEqual([1n, 2.5, 'a']);
    expect(normalize({ a: 1, b: { c: [2] } })).toEqual(
      new Map<string, unknown>([
        ['a', 1n],
        ['b', new Map<string, unknown>([['c', [2n]]])],
      ])
    );
    expect(normalize(new Map([[1, 'one']]))).toEqual(new Map([[1n, 'one']]));
    const date = new Date('2024-03-05T14:30:45.250Z');
    expect(normalize(date)).toEqual(Timestamp.parse('2024-03-05T14:30:45.250Z'));
    const bytes = utf8Encode('x');
    expect(normalize(bytes)).toBe(bytes);
    expect(normalize(Type.INT)).toBe(Type.INT);
  });

  it('should leave class instances alone', () => {
    class Thing {
      value = 1;
    }
    const thing = new Thing();
    expect(normalize(thing)).toBe(thing);
    expect(normalize(Object.create(null))).toEqual(new Map());
  });

  it('should reject cycles', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => normalize(cyclic)).toThrow(ArgumentError);
    const shared = { a: 1 };
    expect(() => normalize([shared, shared])).not.toThrow();
  });
});
