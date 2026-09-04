import { describe, it, expect } from 'vitest';
import { Parser } from '../src/parser/parser.js';
import { Printer, PrinterOptions } from '../src/printer/printer.js';
import { Literal, LiteralType } from '../src/ast/index.js';
import { ArgumentError } from '../src/errors.js';

/** Tests for rendering an expression tree back into CEL source text. */
describe('Printer', () => {
  const print = (source: string): string => Printer.print(new Parser(source).parse());

  const round = (source: string): void => {
    const once = print(source);
    const twice = print(once);
    expect(twice, `printing is not idempotent for: ${source}`).toBe(once);
  };

  it('should print literals', () => {
    expect(print('null')).toBe('null');
    expect(print('true')).toBe('true');
    expect(print('42')).toBe('42');
    expect(print('0xFF')).toBe('255');
    expect(print('42u')).toBe('42u');
    expect(print('1.0')).toBe('1.0');
    expect(print('1e10')).toBe('1.0E10');
    expect(print('3.14')).toBe('3.14');
    expect(print("'hello'")).toBe('"hello"');
    expect(print('b"data"')).toBe('b"data"');
  });

  it('should escape string literals', () => {
    expect(print('"a\\nb"')).toBe('"a\\nb"');
    expect(print('\'say "hi"\'')).toBe('"say \\"hi\\""');
    expect(print('"tab\\there"')).toBe('"tab\\there"');
    expect(print('"café"')).toBe('"café"');
    // A supplementary character survives escaping as a whole character
    expect(print("'\\U0001F600'")).toBe('"😀"');
    round("'\\U0001F600'");
    round('"a\\nb\\\\c\\"d"');
  });

  it('should escape bytes literals', () => {
    expect(print('b"\\x00\\xff"')).toBe('b"\\x00\\xff"');
    round('b"\\x00\\xff"');
  });

  it('should omit redundant parentheses', () => {
    expect(print('a + b * c')).toBe('a + b * c');
    expect(print('a + (b * c)')).toBe('a + b * c');
    expect(print('(a + b) + c')).toBe('a + b + c');
    expect(print('(a * b) + c')).toBe('a * b + c');
  });

  it('should keep required parentheses', () => {
    expect(print('(a + b) * c')).toBe('(a + b) * c');
    expect(print('a - (b - c)')).toBe('a - (b - c)');
    expect(print('a / (b / c)')).toBe('a / (b / c)');
    expect(print('!(a && b)')).toBe('!(a && b)');
    expect(print('(a || b) && c')).toBe('(a || b) && c');
    expect(print('(a + b).size()')).toBe('(a + b).size()');
    expect(print('(-a).size()')).toBe('(-a).size()');
  });

  it('should print unary operators', () => {
    expect(print('!a')).toBe('!a');
    expect(print('-a')).toBe('-a');
    expect(print('-(-x)')).toBe('--x');
    expect(print('!!x')).toBe('!!x');
    round('-(-x)');
  });

  it('should print conditionals', () => {
    expect(print('a ? b : c')).toBe('a ? b : c');
    expect(print('a ? b : c ? d : e')).toBe('a ? b : c ? d : e');
    expect(print('(a ? b : c) ? d : e')).toBe('(a ? b : c) ? d : e');
    expect(print('a ? (b ? c : d) : e')).toBe('a ? (b ? c : d) : e');
  });

  it('should print collections and members', () => {
    expect(print('[1,2,3]')).toBe('[1, 2, 3]');
    expect(print('[]')).toBe('[]');
    expect(print("{'a': 1, 'b': 2}")).toBe('{"a": 1, "b": 2}');
    expect(print('a.b.c')).toBe('a.b.c');
    expect(print('a[0][1]')).toBe('a[0][1]');
    expect(print('size(a)')).toBe('size(a)');
    expect(print('a.size()')).toBe('a.size()');
    expect(print('has(a.b)')).toBe('has(a.b)');
    expect(print('Point{x: 1, y: 2}')).toBe('Point{x: 1, y: 2}');
  });

  it('should print macros', () => {
    expect(print('[1,2].map(x, x*2)')).toBe('[1, 2].map(x, x * 2)');
    expect(print('a.filter(x, x>1).all(y, y<9)')).toBe('a.filter(x, x > 1).all(y, y < 9)');
  });

  it('should round trip parsed expressions', () => {
    const sources = [
      '1 + 2 * 3 - 4 / 5 % 6',
      'a == b != c',
      'a < b && c >= d || !e',
      "'x' in ['x', 'y']",
      "{'k': [1, {'n': null}]}",
      "user.roles.filter(r, r != 'guest').size() > 0",
      'a.b[0].c(1, 2, 3)',
      "timestamp('2024-01-01T00:00:00Z') + duration('1h30m')",
    ];
    for (const source of sources) {
      round(source);
      expect(() => new Parser(print(source)).parse(), source).not.toThrow();
    }
  });

  it('should keep short expressions on one line when pretty printing', () => {
    const expr = new Parser('[1, 2, 3]').parse();
    expect(Printer.print(expr, PrinterOptions.pretty())).toBe('[1, 2, 3]');
  });

  it('should break long collections when pretty printing', () => {
    const source = "['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc', 'dddddddddd', 'eeeeeeeeee']";
    const text = Printer.print(new Parser(source).parse(), new PrinterOptions(true, 2, 40));
    expect(text).toBe(
      [
        '[',
        '  "aaaaaaaaaa",',
        '  "bbbbbbbbbb",',
        '  "cccccccccc",',
        '  "dddddddddd",',
        '  "eeeeeeeeee"',
        ']',
      ].join('\n')
    );
    expect(print(text)).toBe(print(source));
  });

  it('should break nested structures when pretty printing', () => {
    const source = "{'alpha': [1, 2, 3], 'beta': {'gamma': 'a long enough string value'}}";
    const text = Printer.print(new Parser(source).parse(), new PrinterOptions(true, 2, 40));
    expect(text).toBe(
      [
        '{',
        '  "alpha": [1, 2, 3],',
        '  "beta": {',
        '    "gamma": "a long enough string value"',
        '  }',
        '}',
      ].join('\n')
    );
    expect(print(text)).toBe(print(source));
  });

  it('should break logical chains and conditionals when pretty printing', () => {
    const source = "aaaaaaaaaaaaaaaa && bbbbbbbbbbbbbbbb || cccccccccccccccc ? 'yes' : 'no'";
    const text = Printer.print(new Parser(source).parse(), new PrinterOptions(true, 2, 30));
    expect(text).toBe(
      [
        'aaaaaaaaaaaaaaaa',
        '&& bbbbbbbbbbbbbbbb',
        '|| cccccccccccccccc',
        '  ? "yes"',
        '  : "no"',
      ].join('\n')
    );
    expect(print(text)).toBe(print(source));
  });

  it('should refuse non-finite double literals', () => {
    expect(() => Printer.print(new Literal(NaN, LiteralType.DOUBLE))).toThrow(ArgumentError);
    expect(() => Printer.print(new Literal(Infinity, LiteralType.DOUBLE))).toThrow(
      'Cannot render Infinity as a CEL literal'
    );
    expect(Printer.print(new Literal(-0, LiteralType.DOUBLE))).toBe('-0.0');
  });
});
