import { describe, it, expect } from 'vitest';
import { CEL } from '../src/cel.js';
import { ArgumentError, EvaluationError } from '../src/errors.js';
import { ParseError } from '../src/parser/index.js';
import { Timestamp } from '../src/values/timestamp.js';
import { Duration } from '../src/values/duration.js';

/**
 * Conformance tests organized after the sections of the google/cel-spec test corpus.
 *
 * Every case evaluates through the public CEL boundary. The final group records the
 * places where this implementation deliberately differs from the specification.
 */
describe('Conformance', () => {
  const evalExpr = (source: string, variables: Record<string, unknown> = {}): unknown =>
    new CEL().eval(source, variables);

  describe('Basic', () => {
    it('should evaluate self-evaluating literals', () => {
      expect(evalExpr('null')).toBeNull();
      expect(evalExpr('true')).toBe(true);
      expect(evalExpr('false')).toBe(false);
      expect(evalExpr('42')).toBe(42n);
      expect(evalExpr('3.14')).toBe(3.14);
      expect(evalExpr("'hello'")).toBe('hello');
      expect(evalExpr('[]')).toEqual([]);
      expect(evalExpr('{}')).toEqual(new Map());
    });

    it('should honour parentheses and precedence', () => {
      expect(evalExpr('2 + 3 * 4')).toBe(14n);
      expect(evalExpr('(2 + 3) * 4')).toBe(20n);
      expect(evalExpr('1 < 2 == true')).toBe(true);
    });
  });

  describe('Variables', () => {
    it('should resolve bound names', () => {
      expect(evalExpr('x + 2', { x: 5 })).toBe(7n);
      expect(evalExpr('a + b', { a: 'a', b: 'b' })).toBe('ab');
    });

    it('should report unbound names as errors', () => {
      expect(() => evalExpr('missing')).toThrow(EvaluationError);
    });

    it('should select nested fields', () => {
      const data = { a: { b: { c: 1 } } };
      expect(evalExpr('a.b.c', data)).toBe(1n);
      expect(evalExpr("a['b']['c']", data)).toBe(1n);
    });
  });

  describe('Comparisons', () => {
    it('should order values', () => {
      expect(evalExpr('1 < 2')).toBe(true);
      expect(evalExpr('2 <= 2')).toBe(true);
      expect(evalExpr('3 > 2')).toBe(true);
      expect(evalExpr('3 >= 3')).toBe(true);
      expect(evalExpr("'a' < 'b'")).toBe(true);
    });

    it('should compare equality across numeric types', () => {
      expect(evalExpr('1 == 1.0')).toBe(true);
      expect(evalExpr('1 != 2')).toBe(true);
      expect(evalExpr('2.0 > 1')).toBe(true);
    });

    it('should compare mixed numbers exactly', () => {
      // Converting both to a double would call these equal
      expect(evalExpr('9223372036854775807 == 9223372036854775808.0')).toBe(false);
      expect(evalExpr('9223372036854775807 < 9223372036854775808.0')).toBe(true);
      expect(evalExpr('9007199254740993 == 9007199254740992.0')).toBe(false);
      expect(evalExpr('9007199254740993 > 9007199254740992.0')).toBe(true);
      expect(evalExpr('9007199254740992 == 9007199254740992.0')).toBe(true);
      expect(evalExpr('1 == 1.0')).toBe(true);
      expect(evalExpr('1 < 1.5')).toBe(true);
      expect(evalExpr('9223372036854775807 in [9223372036854775808.0]')).toBe(false);
    });

    it('should never equate NaN', () => {
      expect(evalExpr('0.0 / 0.0 == 0.0 / 0.0')).toBe(false);
      expect(evalExpr('0.0 / 0.0 != 0.0 / 0.0')).toBe(true);
    });

    it('should compare deeply', () => {
      expect(evalExpr('[1, [2, 3]] == [1, [2, 3]]')).toBe(true);
      expect(evalExpr("{'a': [1]} == {'a': [1]}")).toBe(true);
      expect(evalExpr('[1, 2] == [2, 1]')).toBe(false);
      expect(evalExpr("b'ab' == b'ab'")).toBe(true);
    });

    it('should treat signed zero as one value everywhere', () => {
      expect(evalExpr('-0.0 == 0.0')).toBe(true);
      expect(evalExpr('[[-0.0]] == [[0.0]]')).toBe(true);
      expect(evalExpr("x == {0.0: 'z'}", { x: new Map([[-0, 'z']]) })).toBe(true);
      // The hash-backed operations must agree with equality
      expect((evalExpr('[-0.0, 0.0].distinct()') as unknown[]).length).toBe(1);
      expect(evalExpr('sets.contains([-0.0], [0.0])')).toBe(true);
      expect(evalExpr('sets.equivalent([-0.0], [0.0])')).toBe(true);
      expect(evalExpr('0.0 in [-0.0]')).toBe(true);
    });

    it('should compare null', () => {
      expect(evalExpr('null == null')).toBe(true);
      expect(evalExpr('null != 1')).toBe(true);
    });
  });

  describe('Arithmetic', () => {
    it('should truncate integer division', () => {
      expect(evalExpr('1 / 2')).toBe(0n);
      expect(evalExpr('5 / 2')).toBe(2n);
      expect(evalExpr('-5 / 2')).toBe(-2n);
      expect(evalExpr('15 / 3')).toBe(5n);
    });

    it('should treat integer division by zero as an error', () => {
      expect(() => evalExpr('1 / 0')).toThrow(EvaluationError);
      expect(() => evalExpr('1 % 0')).toThrow(EvaluationError);
    });

    it('should yield infinity for double division by zero', () => {
      expect(evalExpr('1.0 / 0.0')).toBe(Infinity);
      expect(evalExpr('-1.0 / 0.0')).toBe(-Infinity);
      expect(evalExpr('math.isNaN(0.0 / 0.0)')).toBe(true);
      expect(evalExpr('1.0 / 2')).toBe(0.5);
    });

    it('should require integers for modulo', () => {
      expect(evalExpr('5 % 2')).toBe(1n);
      expect(evalExpr('17 % 5')).toBe(2n);
      expect(() => evalExpr('5.0 % 2')).toThrow(EvaluationError);
      expect(() => evalExpr('5 % 2.0')).toThrow(EvaluationError);
    });

    it('should treat integer overflow as an error', () => {
      expect(() => evalExpr('9223372036854775807 + 1')).toThrow(EvaluationError);
      expect(() => evalExpr('-9223372036854775807 - 2')).toThrow(EvaluationError);
      expect(() => evalExpr('9223372036854775807 * 2')).toThrow(EvaluationError);
      expect(() => evalExpr('(-9223372036854775807 - 1) / -1')).toThrow(EvaluationError);
    });

    it('should reject the absolute value of the minimum integer', () => {
      expect(evalExpr('math.abs(-5)')).toBe(5n);
      expect(evalExpr('math.abs(-5.5)')).toBe(5.5);
      expect(() => evalExpr('math.abs(-9223372036854775807 - 1)')).toThrow(EvaluationError);
    });

    it('should not overflow double arithmetic', () => {
      expect(evalExpr('math.isInf(1.7976931348623157e308 * 2.0)')).toBe(true);
    });

    it('should negate', () => {
      expect(evalExpr('-5')).toBe(-5n);
      expect(evalExpr('--5')).toBe(5n);
      expect(evalExpr('-2.5')).toBe(-2.5);
    });
  });

  describe('Logic', () => {
    it('should short circuit', () => {
      expect(evalExpr('false && missing')).toBe(false);
      expect(evalExpr('true || missing')).toBe(true);
    });

    it('should absorb errors from either side', () => {
      expect(evalExpr('missing && false')).toBe(false);
      expect(evalExpr('missing || true')).toBe(true);
    });

    it('should propagate unabsorbed errors', () => {
      expect(() => evalExpr('missing && true')).toThrow(EvaluationError);
      expect(() => evalExpr('missing || false')).toThrow(EvaluationError);
    });

    it('should require boolean operands', () => {
      expect(() => evalExpr('1 && true')).toThrow(EvaluationError);
      expect(() => evalExpr("false || 'x'")).toThrow(EvaluationError);
      // A short-circuiting operand still wins over a non-boolean on the other side
      expect(evalExpr("true || 'x'")).toBe(true);
      expect(evalExpr('false && 1')).toBe(false);
      expect(() => evalExpr('!1')).toThrow(EvaluationError);
    });

    it('should require a boolean condition', () => {
      expect(evalExpr('true ? 1 : 2')).toBe(1n);
      expect(evalExpr('false ? 1 : 2')).toBe(2n);
      expect(() => evalExpr('1 ? 1 : 2')).toThrow(EvaluationError);
      expect(() => evalExpr("'x' ? 1 : 2")).toThrow(EvaluationError);
    });

    it('should evaluate one conditional branch only', () => {
      expect(evalExpr('true ? 1 : missing')).toBe(1n);
      expect(evalExpr('false ? missing : 2')).toBe(2n);
    });
  });

  describe('Conversions', () => {
    it('should convert numbers', () => {
      expect(evalExpr("int('42')")).toBe(42n);
      expect(evalExpr('int(1.9)')).toBe(1n);
      expect(evalExpr('double(42)')).toBe(42);
      expect(evalExpr('string(42)')).toBe('42');
      expect(evalExpr('uint(1)')).toBe(1n);
    });

    it('should convert strings and bytes', () => {
      expect(evalExpr("string(b'hello')")).toBe('hello');
      expect(evalExpr("bytes('hello') == b'hello'")).toBe(true);
      expect(evalExpr("bool('x')")).toBe(true);
    });

    it('should convert timestamps', () => {
      expect(evalExpr('timestamp(1)')).toEqual(Timestamp.ofEpochSeconds(1n));
      expect(evalExpr('int(timestamp(1))')).toBe(1n);
      expect(evalExpr("timestamp('2024-01-01T00:00:00Z')")).toEqual(
        Timestamp.parse('2024-01-01T00:00:00Z')
      );
      expect(evalExpr("timestamp('2024-01-01T01:00:00+01:00')")).toEqual(
        Timestamp.parse('2024-01-01T00:00:00Z')
      );
      expect(evalExpr("string(timestamp('2024-01-01T00:00:00Z'))")).toBe('2024-01-01T00:00:00Z');
    });

    it('should convert durations', () => {
      expect(evalExpr("duration('1h')")).toEqual(Duration.ofHours(1n));
      expect(evalExpr("string(duration('1h'))")).toBe('3600s');
      expect(evalExpr("string(duration('1.5s'))")).toBe('1.5s');
      expect(evalExpr("string(duration('-1m30s'))")).toBe('-90s');
      expect(evalExpr("string(duration('0s'))")).toBe('0s');
    });

    it('should keep the value of large durations', () => {
      // Accumulating through a double would silently clamp this to 9223372036 seconds
      expect(evalExpr("duration('10000000h')")).toEqual(Duration.ofHours(10000000n));
      expect(evalExpr("string(duration('10000000h'))")).toBe('36000000000s');
      expect(evalExpr("duration('0.000000001s')")).toEqual(Duration.ofNanos(1n));
      expect(evalExpr("string(duration('0.000000001s'))")).toBe('0.000000001s');
    });

    it('should reject out-of-range times', () => {
      expect(() => evalExpr("duration('100000000h')")).toThrow(ArgumentError);
      expect(() => evalExpr('timestamp(9223372036854775807)')).toThrow(ArgumentError);
    });

    it('should produce type values', () => {
      expect(evalExpr('type(null) == null_type')).toBe(true);
      expect(evalExpr('type(true) == bool')).toBe(true);
      expect(evalExpr('type(1) == int')).toBe(true);
      expect(evalExpr('type(1.0) == double')).toBe(true);
      expect(evalExpr("type('a') == string")).toBe(true);
      expect(evalExpr("type(b'a') == bytes")).toBe(true);
      expect(evalExpr('type([1]) == list')).toBe(true);
      expect(evalExpr("type({'a': 1}) == map")).toBe(true);
      expect(evalExpr('type(timestamp(0)) == timestamp')).toBe(true);
      expect(evalExpr("type(duration('1s')) == duration")).toBe(true);
      expect(evalExpr('type(type(1)) == type')).toBe(true);
      expect(evalExpr('type(1) == double')).toBe(false);
      expect(evalExpr('string(type(1))')).toBe('int');
    });

    it('should let variables shadow type names', () => {
      expect(evalExpr('int', { int: 7 })).toBe(7n);
    });
  });

  describe('Lists', () => {
    it('should index and size', () => {
      expect(evalExpr('[1, 2, 3][0]')).toBe(1n);
      expect(evalExpr('size([1, 2, 3])')).toBe(3n);
      expect(() => evalExpr('[1][5]')).toThrow(EvaluationError);
      expect(() => evalExpr('[1][-1]')).toThrow(EvaluationError);
    });

    it('should concatenate', () => {
      expect(evalExpr('[1] + [2, 3]')).toEqual([1n, 2n, 3n]);
      expect(evalExpr('[1] + []')).toEqual([1n]);
    });

    it('should test membership', () => {
      expect(evalExpr('2 in [1, 2, 3]')).toBe(true);
      expect(evalExpr('4 in [1, 2, 3]')).toBe(false);
      expect(evalExpr('[1] in [[1], [2]]')).toBe(true);
    });
  });

  describe('Maps', () => {
    it('should access and size', () => {
      expect(evalExpr("{'a': 1}['a']")).toBe(1n);
      expect(evalExpr("{'a': 1}.a")).toBe(1n);
      expect(evalExpr("size({'a': 1, 'b': 2})")).toBe(2n);
      expect(() => evalExpr("{'a': 1}['b']")).toThrow(EvaluationError);
    });

    it('should match keys numerically for membership', () => {
      expect(evalExpr("'a' in {'a': 1}")).toBe(true);
      expect(evalExpr("'b' in {'a': 1}")).toBe(false);
      expect(evalExpr('1 in x', { x: new Map([[1, 'one']]) })).toBe(true);
    });

    it('should keep membership, indexing and presence in agreement', () => {
      // The key is a JavaScript number while the expression probes with an int
      const data = { x: new Map([[1, 'one']]) };
      expect(evalExpr('1 in x', data)).toBe(true);
      expect(evalExpr('x[1]', data)).toBe('one');
      expect(evalExpr('has(x, 1)', data)).toBe(true);
      expect(evalExpr("1 in x ? x[1] : 'fallback'", data)).toBe('one');
      expect(evalExpr("2 in x ? x[2] : 'fallback'", data)).toBe('fallback');
      expect(evalExpr("1.0 in x ? x[1.0] : 'fallback'", data)).toBe('one');
      expect(() => evalExpr('x[2]', data)).toThrow(EvaluationError);
    });

    it('should match keys across number types for equality', () => {
      const data = { x: new Map([[1, 'one']]) };
      expect(evalExpr("x == {1: 'one'}", data)).toBe(true);
      expect(evalExpr("x == {1.0: 'one'}", data)).toBe(true);
      expect(evalExpr("x == {1: 'two'}", data)).toBe(false);
      expect(evalExpr("x == {2: 'one'}", data)).toBe(false);
      expect(evalExpr("[x] == [{1: 'one'}]", data)).toBe(true);
    });

    it('should treat a null key probe as an ordinary miss', () => {
      const data = { x: { a: 1 } };
      expect(evalExpr('null in x', data)).toBe(false);
      expect(evalExpr('has(x, null)', data)).toBe(false);
      expect(() => evalExpr('x[null]', data)).toThrow(EvaluationError);
    });
  });

  describe('Macros', () => {
    it('should test presence with has() without erroring', () => {
      const data = { a: { b: 1 } };
      expect(evalExpr('has(a.b)', data)).toBe(true);
      expect(evalExpr('has(a.c)', data)).toBe(false);
      expect(evalExpr('has(a.b) && a.b == 1', data)).toBe(true);
    });

    it('should require a field selection for has()', () => {
      expect(() => evalExpr('has(1)', { a: {} })).toThrow(ParseError);
    });

    it('should evaluate comprehensions', () => {
      expect(evalExpr('[1, 2].map(x, x * 2)')).toEqual([2n, 4n]);
      expect(evalExpr('[1, 2].filter(x, x % 2 == 0)')).toEqual([2n]);
      expect(evalExpr('[1, 2].all(x, x > 0)')).toBe(true);
      expect(evalExpr('[1, 2].exists(x, x > 1)')).toBe(true);
      expect(evalExpr('[1, 2].existsOne(x, x > 1)')).toBe(true);
    });

    it('should require boolean comprehension predicates', () => {
      expect(() => evalExpr('[1, 2].filter(x, x)')).toThrow(EvaluationError);
      expect(() => evalExpr('[1, 2].all(x, x)')).toThrow(EvaluationError);
    });
  });

  describe('StringFunctions', () => {
    it('should provide the standard methods', () => {
      expect(evalExpr("'hello'.contains('ell')")).toBe(true);
      expect(evalExpr("'hello'.startsWith('he')")).toBe(true);
      expect(evalExpr("'hello'.endsWith('lo')")).toBe(true);
      expect(evalExpr("size('hello')")).toBe(5n);
      expect(evalExpr("'hello'.upperAscii()")).toBe('HELLO');
    });

    it('should match partially', () => {
      expect(evalExpr("'hello'.matches('ell')")).toBe(true);
      expect(evalExpr("matches('hello', 'ell')")).toBe(true);
      expect(evalExpr("'hello'.matches('^ell')")).toBe(false);
    });

    it('should concatenate', () => {
      expect(evalExpr("'a' + 'b'")).toBe('ab');
      expect(evalExpr("b'a' + b'b' == b'ab'")).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should default accessors to UTC', () => {
      expect(evalExpr("timestamp('2024-03-05T14:30:45Z').getFullYear()")).toBe(2024n);
      expect(evalExpr("timestamp('2024-03-05T14:30:45Z').getHours()")).toBe(14n);
      expect(evalExpr("timestamp('2024-03-05T14:30:45Z').getHours('America/New_York')")).toBe(9n);
    });

    it('should support arithmetic and ordering', () => {
      expect(evalExpr("timestamp('2024-01-01T00:00:00Z') + duration('1h')")).toEqual(
        Timestamp.parse('2024-01-01T01:00:00Z')
      );
      expect(
        evalExpr("timestamp('2024-01-01T01:00:00Z') - timestamp('2024-01-01T00:00:00Z')")
      ).toEqual(Duration.ofHours(1n));
      expect(evalExpr('timestamp(0) < timestamp(1)')).toBe(true);
      expect(evalExpr("duration('1s') < duration('1m')")).toBe(true);
    });
  });

  /** Positions and sizes are counted in Unicode code points, never UTF-16 code units. */
  describe('Unicode', () => {
    const GRIN = '😀';

    it('should count size in code points', () => {
      expect(evalExpr("size('\\U0001F600')")).toBe(1n);
      expect(evalExpr("size('\\U0001F600b')")).toBe(2n);
      expect(evalExpr("size('café')")).toBe(4n);
    });

    it('should return whole characters from charAt and indexing', () => {
      expect(evalExpr("'\\U0001F600b'.charAt(0)")).toBe(GRIN);
      expect(evalExpr("'\\U0001F600b'.charAt(1)")).toBe('b');
      expect(evalExpr("'\\U0001F600b'[0]")).toBe(GRIN);
      expect(evalExpr("'\\U0001F600b'[1]")).toBe('b');
      expect(evalExpr("'\\U0001F600b'.charAt(2)")).toBe('');
      expect(() => evalExpr("'\\U0001F600b'.charAt(3)")).toThrow(ArgumentError);
      expect(() => evalExpr("'\\U0001F600b'[2]")).toThrow(EvaluationError);
    });

    it('should not split a character in substring', () => {
      expect(evalExpr("'a\\U0001F600b'.substring(1, 2)")).toBe(GRIN);
      expect(evalExpr("'a\\U0001F600b'.substring(1)")).toBe(GRIN + 'b');
      expect(evalExpr("'a\\U0001F600b'.substring(2)")).toBe('b');
      expect(evalExpr("'a\\U0001F600b'.substring(1, 1)")).toBe('');
    });

    it('should report search positions in code points', () => {
      expect(evalExpr("'a\\U0001F600b'.indexOf('b')")).toBe(2n);
      expect(evalExpr("'a\\U0001F600b'.lastIndexOf('b')")).toBe(2n);
      expect(evalExpr("'a\\U0001F600b'.indexOf('\\U0001F600')")).toBe(1n);
      expect(evalExpr("'a\\U0001F600b'.indexOf('z')")).toBe(-1n);
      expect(evalExpr("'a\\U0001F600b'.indexOf('b', 1)")).toBe(2n);
    });

    it('should survive the other string functions', () => {
      expect(evalExpr("'\\U0001F600'.reverse()")).toBe(GRIN);
      expect(evalExpr("'a\\U0001F600b'.reverse()")).toBe('b' + GRIN + 'a');
      expect(evalExpr("'\\U0001F600'.upperAscii()")).toBe(GRIN);
      expect(evalExpr("string(bytes('\\U0001F600'))")).toBe(GRIN);
    });
  });

  /** Guards that keep an untrusted expression from exhausting the heap. */
  describe('Limits', () => {
    it('should bound range', () => {
      expect(evalExpr('lists.range(3)')).toEqual([0n, 1n, 2n]);
      expect(evalExpr('size(lists.range(1000000))')).toBe(1000000n);
      expect(() => evalExpr('lists.range(9223372036854775807)')).toThrow(EvaluationError);
      expect(() => evalExpr('lists.range(1000001)')).toThrow(EvaluationError);
    });

    it('should bound string repetition', () => {
      expect(evalExpr("'ab' * 3")).toBe('ababab');
      expect(() => evalExpr("'ab' * 9223372036854775807")).toThrow(EvaluationError);
      expect(() => evalExpr("'ab' * 500001")).toThrow(EvaluationError);
      expect(() => evalExpr("'' * 9223372036854775807")).toThrow(EvaluationError);
    });

    it('should bound list repetition', () => {
      expect(evalExpr('[1] * 2')).toEqual([1n, 1n]);
      expect(() => evalExpr('[1, 2] * 9223372036854775807')).toThrow(EvaluationError);
      expect(() => evalExpr('[1, 2] * 500001')).toThrow(EvaluationError);
      expect(() => evalExpr('[] * 9223372036854775807')).toThrow(EvaluationError);
    });

    it('should deduplicate in linear time', () => {
      // A linear scan over the result would need tens of billions of comparisons here
      expect(evalExpr('size(lists.range(200000).distinct())')).toBe(200000n);
    }, 10_000);

    it('should run set operations in linear time', () => {
      expect(evalExpr('sets.contains(lists.range(200000), lists.range(200000))')).toBe(true);
      expect(evalExpr('sets.intersects(lists.range(200000), [199999])')).toBe(true);
      expect(evalExpr('sets.equivalent(lists.range(200000), lists.range(200000))')).toBe(true);
    }, 10_000);

    it('should bound format precision', () => {
      expect(evalExpr("'%.3f'.format([1.5])")).toBe('1.500');
      expect(() => evalExpr("'%.2000000f'.format([1.5])")).toThrow(EvaluationError);
      expect(() => evalExpr("'%.1000000f'.format([1.5])")).toThrow(EvaluationError);
      // A precision too large to hold in an int must be rejected, not fail to parse
      expect(() => evalExpr("'%.99999999999999999999f'.format([1.5])")).toThrow(EvaluationError);
    });

    it('should not let combined operations amplify', () => {
      // Every input here is individually legal; the combined output would not be
      expect(() => evalExpr("lists.range(1000000).map(x, 'a').join('x' * 1000000)")).toThrow(
        EvaluationError
      );
      expect(() => evalExpr("('x' * 1000000) + ('x' * 1000000)")).toThrow(EvaluationError);
      expect(() => evalExpr('lists.range(1000000) + lists.range(1000000)')).toThrow(
        EvaluationError
      );
      expect(() => evalExpr("('x' * 1000000).replace('x', 'yy')")).toThrow(EvaluationError);
      expect(() => evalExpr("regex.replace('x' * 1000000, 'x', 'yy')")).toThrow(EvaluationError);
      expect(() => evalExpr("base64.encode(bytes('x' * 1000000))")).toThrow(EvaluationError);
      expect(() => evalExpr("b'ab' * 1 + b'cd' * 1000000")).toThrow(EvaluationError);
    });

    it('should still allow ordinary combinations', () => {
      expect(evalExpr("['a', 'b'].join('-')")).toBe('a-b');
      expect(evalExpr("'x' + 'y'")).toBe('xy');
      expect(evalExpr('[1] + [2]')).toEqual([1n, 2n]);
      expect(evalExpr("'xx'.replace('x', 'y')")).toBe('yy');
    });

    it('should reject negative repetition', () => {
      expect(() => evalExpr("'ab' * -1")).toThrow(EvaluationError);
      expect(() => evalExpr('[1] * -1')).toThrow(EvaluationError);
    });
  });

  /** Behavior this implementation adds on purpose, beyond what the specification defines. */
  describe('Extensions', () => {
    it('should provide repetition operators', () => {
      expect(evalExpr("'ab' * 3")).toBe('ababab');
      expect(evalExpr('[1] * 2')).toEqual([1n, 1n]);
    });

    it('should provide substring membership', () => {
      expect(evalExpr("'ell' in 'hello'")).toBe(true);
    });

    it('should provide the two-argument has() function', () => {
      expect(evalExpr("has(a, 'b')", { a: { b: 1 } })).toBe(true);
      expect(evalExpr("has(a, 'c')", { a: { b: 1 } })).toBe(false);
    });

    it('should not treat unsigned as a distinct type', () => {
      expect(evalExpr('type(1u) == int')).toBe(true);
      expect(evalExpr('1u == 1')).toBe(true);
    });
  });
});
