import { describe, it, expect, beforeEach } from 'vitest';
import { CEL } from '../src/cel.js';
import { ArgumentError } from '../src/errors.js';
import { Type } from '../src/values/type.js';
import { Timestamp } from '../src/values/timestamp.js';
import { Duration } from '../src/values/duration.js';

/** Tests for the timestamp and duration functions. */
describe('Time functions', () => {
  const MOMENT = '2024-03-05T14:30:45.250Z';
  let cel: CEL;

  beforeEach(() => {
    cel = new CEL();
  });

  const evalExpr = (source: string): unknown => cel.eval(source, { t: Timestamp.parse(MOMENT) });

  it('should parse durations', () => {
    expect(evalExpr("duration('5s')")).toEqual(Duration.ofSeconds(5n));
    expect(evalExpr("duration('1h30m')")).toEqual(Duration.ofMinutes(90n));
    expect(evalExpr("duration('1.5s')")).toEqual(Duration.ofMillis(1500n));
    expect(evalExpr("duration('100ms')")).toEqual(Duration.ofMillis(100n));
    expect(evalExpr("duration('10ns')")).toEqual(Duration.ofNanos(10n));
    expect(evalExpr("duration('-2h')")).toEqual(Duration.ofHours(-2n));
    expect(() => evalExpr("duration('5x')")).toThrow(ArgumentError);
    // Exact accumulation: a double would clamp this to 9223372036 seconds
    expect(evalExpr("duration('10000000h')")).toEqual(Duration.ofHours(10000000n));
    expect(() => evalExpr("duration('100000000h')")).toThrow(ArgumentError);
  });

  it('should default accessors to UTC', () => {
    expect(evalExpr('getFullYear(t)')).toBe(2024n);
    expect(evalExpr('getMonth(t)')).toBe(2n);
    expect(evalExpr('getDate(t)')).toBe(5n);
    expect(evalExpr('getHours(t)')).toBe(14n);
    expect(evalExpr('getMinutes(t)')).toBe(30n);
    expect(evalExpr('getSeconds(t)')).toBe(45n);
    expect(evalExpr('getMilliseconds(t)')).toBe(250n);
    expect(evalExpr('getDayOfWeek(t)')).toBe(2n);
    expect(evalExpr('getDayOfYear(t)')).toBe(64n);
  });

  it('should accept a time zone', () => {
    expect(evalExpr("getHours(t, 'America/New_York')")).toBe(9n);
    expect(evalExpr("getHours(t, 'Asia/Tokyo')")).toBe(23n);
    expect(evalExpr("getDate(t, 'Asia/Tokyo')")).toBe(5n);
    expect(evalExpr("getDate(timestamp('2024-03-05T23:30:00Z'), 'Asia/Tokyo')")).toBe(6n);
    expect(evalExpr("getDate(timestamp('2024-03-05T23:30:00Z'))")).toBe(5n);
    expect(() => evalExpr("getHours(t, 'Mars/Olympus')")).toThrow(ArgumentError);
  });

  it('should expose accessors as methods', () => {
    expect(evalExpr('t.getFullYear()')).toBe(2024n);
    expect(evalExpr('t.getHours()')).toBe(14n);
    expect(evalExpr("t.getHours('America/New_York')")).toBe(9n);
  });

  it('should expose cumulative duration accessors', () => {
    expect(evalExpr("duration('1h30m').getHours()")).toBe(1n);
    expect(evalExpr("duration('1h30m').getMinutes()")).toBe(90n);
    expect(evalExpr("duration('1h30m').getSeconds()")).toBe(5400n);
    expect(evalExpr("duration('1.5s').getMilliseconds()")).toBe(1500n);
  });

  it('should support timestamp and duration arithmetic', () => {
    const later = Timestamp.parse('2024-03-05T15:30:45.250Z');
    expect(evalExpr("t + duration('1h')")).toEqual(later);
    expect(evalExpr("duration('1h') + t")).toEqual(later);
    expect(evalExpr("t - duration('1h')")).toEqual(Timestamp.parse('2024-03-05T13:30:45.250Z'));
    expect(evalExpr("(t + duration('1h')) - t")).toEqual(Duration.ofHours(1n));
    expect(evalExpr("duration('1h') + duration('30m')")).toEqual(Duration.ofMinutes(90n));
    expect(evalExpr("duration('1h') - duration('30m')")).toEqual(Duration.ofMinutes(30n));
    expect(evalExpr("-duration('1h')")).toEqual(Duration.ofHours(-1n));
  });

  it('should compare timestamps and durations', () => {
    expect(evalExpr("t < t + duration('1s')")).toBe(true);
    expect(evalExpr("duration('1h') > duration('30m')")).toBe(true);
    expect(evalExpr(`t == timestamp('${MOMENT}')`)).toBe(true);
  });

  it('should report type names', () => {
    expect(evalExpr('type(t)')).toBe(Type.TIMESTAMP);
    expect(evalExpr("type(duration('1s'))")).toBe(Type.DURATION);
  });

  it('should accept Date values as timestamps', () => {
    const vars = { d: new Date(MOMENT) };
    expect(cel.eval('d.getHours()', vars)).toBe(14n);
    expect(cel.eval('d == timestamp("' + MOMENT + '")', vars)).toBe(true);
    expect(cel.eval('string(d)', vars)).toBe(MOMENT);
    expect(cel.eval('timestamp(1)', {})).toEqual(Timestamp.ofEpochSeconds(1n));
    expect(cel.eval("string(duration('1h'))", {})).toBe('3600s');
    expect(cel.eval("string(duration('-1m30s'))", {})).toBe('-90s');
  });
});
