import { describe, it, expect, beforeEach } from 'vitest';
import { CEL } from '../src/cel.js';
import { ArgumentError } from '../src/errors.js';
import { Type } from '../src/values/type.js';

/** Tests for the string, regex and encoding functions. */
describe('String functions', () => {
  let cel: CEL;

  beforeEach(() => {
    cel = new CEL();
  });

  const evalExpr = (source: string): unknown => cel.eval(source, {});

  it('should index characters with charAt', () => {
    expect(evalExpr("'hello'.charAt(1)")).toBe('e');
    expect(evalExpr("'hello'.charAt(5)")).toBe('');
    expect(() => evalExpr("'hello'.charAt(6)")).toThrow(ArgumentError);
  });

  it('should find substrings with indexOf and lastIndexOf', () => {
    expect(evalExpr("'hello'.indexOf('l')")).toBe(2n);
    expect(evalExpr("'hello'.indexOf('l', 3)")).toBe(3n);
    expect(evalExpr("'hello'.indexOf('z')")).toBe(-1n);
    expect(evalExpr("'hello'.lastIndexOf('l')")).toBe(3n);
    expect(evalExpr("'hello'.lastIndexOf('l', 2)")).toBe(2n);
  });

  it('should count indexes in code points', () => {
    const grin = '😀';
    expect(evalExpr("'a\\U0001F600b'.charAt(1)")).toBe(grin);
    expect(evalExpr("'a\\U0001F600b'.indexOf('b')")).toBe(2n);
    expect(evalExpr("'a\\U0001F600b'.lastIndexOf('b')")).toBe(2n);
    expect(evalExpr("'a\\U0001F600b'.substring(1, 2)")).toBe(grin);
    expect(evalExpr("size('a\\U0001F600')")).toBe(2n);
  });

  it('should convert ASCII case only', () => {
    expect(evalExpr("'hello'.upperAscii()")).toBe('HELLO');
    expect(evalExpr("'HELLO'.lowerAscii()")).toBe('hello');
    // lowerAscii leaves non-ASCII untouched
    expect(evalExpr("'CAFÉ'.lowerAscii()")).toBe('cafÉ');
  });

  it('should take substrings and reverse', () => {
    expect(evalExpr("'hello'.substring(1, 4)")).toBe('ell');
    expect(evalExpr("'hello'.substring(1)")).toBe('ello');
    expect(evalExpr("'hello'.reverse()")).toBe('olleh');
    expect(() => evalExpr("'hello'.substring(3, 1)")).toThrow(ArgumentError);
  });

  it('should replace with a limit', () => {
    expect(evalExpr("'aaa'.replace('a', 'b')")).toBe('bbb');
    expect(evalExpr("'aaa'.replace('a', 'b', 2)")).toBe('bba');
    expect(evalExpr("'aaa'.replace('a', 'b', 0)")).toBe('aaa');
  });

  it('should split with a limit', () => {
    expect(evalExpr("'a,b,c'.split(',')")).toEqual(['a', 'b', 'c']);
    expect(evalExpr("'a,b,c'.split(',', 2)")).toEqual(['a', 'b,c']);
    expect(evalExpr("'a,b,c'.split(',', 0)")).toEqual([]);
  });

  it('should join lists of strings', () => {
    expect(evalExpr("['a', 'b', 'c'].join()")).toBe('abc');
    expect(evalExpr("['a', 'b', 'c'].join('-')")).toBe('a-b-c');
    expect(evalExpr("[].join(',')")).toBe('');
    expect(() => evalExpr('[1].join()')).toThrow(ArgumentError);
  });

  it('should format with the CEL verbs', () => {
    expect(evalExpr("'%d apples'.format([3])")).toBe('3 apples');
    expect(evalExpr("'%d%% of %.2f'.format([50, 2.5])")).toBe('50% of 2.50');
    expect(evalExpr("'a=%s b=%s'.format(['x', true])")).toBe('a=x b=true');
    expect(evalExpr("'%x %X %o %b'.format([255, 255, 511, 10])")).toBe('ff FF 777 1010');
    expect(evalExpr("'%e'.format([1500.0])")).toBe('1.500000e+03');
    expect(evalExpr("'%.2f'.format([2.675])")).toBe('2.68');
    expect(evalExpr("'%.0f'.format([2.5])")).toBe('3');
    expect(evalExpr("'%s'.format([1e10])")).toBe('1.0E10');
    expect(evalExpr("'%b'.format([-1])")).toBe('1'.repeat(64));
    expect(evalExpr("'%x'.format(['abc'])")).toBe('616263');
    expect(() => evalExpr("'%q'.format(['x'])")).toThrow(ArgumentError);
    expect(() => evalExpr("'%d'.format([1, 2])")).toThrow(ArgumentError);
    expect(() => evalExpr("'%d %d'.format([1])")).toThrow(ArgumentError);
    expect(() => evalExpr("'%'.format([])")).toThrow(ArgumentError);
    expect(() => evalExpr("'%.f'.format([1.0])")).toThrow(ArgumentError);
  });

  it('should quote strings', () => {
    expect(evalExpr("strings.quote('a\\nb')")).toBe('"a\\nb"');
    expect(evalExpr("strings.quote('plain')")).toBe('"plain"');
  });

  it('should match with search semantics', () => {
    expect(evalExpr("'hello world'.matches('o w')")).toBe(true);
    expect(evalExpr("matches('hello world', 'o w')")).toBe(true);
    expect(evalExpr("'hello'.matches('^ello')")).toBe(false);
    expect(() => evalExpr("'hello'.matches('(')")).toThrow(ArgumentError);
  });

  it('should replace with regular expressions', () => {
    expect(evalExpr("regex.replace('a b c', ' ', '-')")).toBe('a-b-c');
    expect(evalExpr("regex.replace('a b c', ' ', '-', 1)")).toBe('a-b c');
    expect(evalExpr("regex.replace('ab', '(\\\\w)', '[\\\\1]')")).toBe('[a][b]');
    expect(evalExpr("regex.replace('abc', 'b', '$1')")).toBe('a$1c');
    expect(evalExpr("regex.replace('abc', '', '-')")).toBe('-a-b-c-');
    expect(() => evalExpr("regex.replace('ab', '(\\\\w)', '\\\\2')")).toThrow(ArgumentError);
    expect(() => evalExpr("regex.replace('ab', '(', 'x')")).toThrow(
      'Invalid regular expression: ('
    );
  });

  it('should extract with regular expressions', () => {
    expect(evalExpr("regex.extract('id 123 x', '[0-9]+')")).toBe('123');
    expect(evalExpr("regex.extract('id=123', '=([0-9]+)')")).toBe('123');
    expect(evalExpr("regex.extract('none', '[0-9]+')")).toBeNull();
    expect(evalExpr("regex.extractAll('a1b2', '[0-9]')")).toEqual(['1', '2']);
    expect(evalExpr("regex.extractAll('abc', '[0-9]')")).toEqual([]);
    expect(() => evalExpr("regex.extract('x', '(a)(b)')")).toThrow(ArgumentError);
  });

  it('should encode and decode base64', () => {
    expect(evalExpr("base64.encode(b'hello')")).toBe('aGVsbG8=');
    expect(evalExpr("base64.encode('hello')")).toBe('aGVsbG8=');
    expect(evalExpr("string(base64.decode('aGVsbG8='))")).toBe('hello');
    expect(evalExpr("string(base64.decode('aGVsbG8'))")).toBe('hello');
    expect(() => evalExpr("base64.decode('!!!')")).toThrow(ArgumentError);
    expect(() => evalExpr("base64.decode('aGVsbG8==')")).toThrow(ArgumentError);
  });

  it('should support bytes values', () => {
    expect(evalExpr("size(b'hello')")).toBe(5n);
    expect(evalExpr("type(b'hello')")).toBe(Type.BYTES);
    expect(evalExpr("b'ab' == b'ab'")).toBe(true);
    expect(evalExpr("b'ab' == b'ba'")).toBe(false);
    expect(evalExpr("string(b'ab' + b'cd')")).toBe('abcd');
    expect(evalExpr("b'ab'[0]")).toBe(97n);
    expect(evalExpr("base64.encode(bytes('hi'))")).toBe('aGk=');
  });

  it('should let variables shadow namespaces', () => {
    expect(cel.eval('math.greatest(1, 2)', {})).toBe(2n);
    expect(cel.eval('math.greatest', { math: { greatest: 'shadowed' } })).toBe('shadowed');
  });
});
