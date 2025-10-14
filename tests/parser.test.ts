import { describe, it, expect } from 'vitest';
import { Parser, ParseError } from '../src/parser/parser.js';
import {
  Literal,
  Identifier,
  Binary,
  Unary,
  Conditional,
  ListExpression,
  MapExpression,
  Struct,
  Select,
  Index,
  Call,
  BinaryOp,
  UnaryOp,
  LiteralType,
} from '../src/ast/index.js';

describe('Parser', () => {
  describe('Literal Parsing', () => {
    it('should parse null literal', () => {
      const parser = new Parser('null');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Literal);
      const lit = expr as Literal;
      expect(lit.value).toBeNull();
      expect(lit.literalType).toBe(LiteralType.NULL_VALUE);
    });

    it('should parse boolean literals', () => {
      const parser1 = new Parser('true');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe(true);
      expect((expr1 as Literal).literalType).toBe(LiteralType.BOOL);

      const parser2 = new Parser('false');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Literal);
      expect((expr2 as Literal).value).toBe(false);
      expect((expr2 as Literal).literalType).toBe(LiteralType.BOOL);
    });

    it('should parse integer literals', () => {
      const parser1 = new Parser('42');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe(42);
      expect((expr1 as Literal).literalType).toBe(LiteralType.INT);

      // Hexadecimal
      const parser2 = new Parser('0xFF');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Literal);
      expect((expr2 as Literal).value).toBe(255);
      expect((expr2 as Literal).literalType).toBe(LiteralType.INT);

      // Negative hex
      const parser3 = new Parser('-0x10');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Unary);
      const unary = expr3 as Unary;
      expect(unary.op).toBe(UnaryOp.NEGATE);
      expect(unary.operand).toBeInstanceOf(Literal);
      expect((unary.operand as Literal).value).toBe(16);
    });

    it('should parse unsigned integer literals', () => {
      const parser1 = new Parser('42u');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe(42);
      expect((expr1 as Literal).literalType).toBe(LiteralType.UINT);

      const parser2 = new Parser('0xFFu');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Literal);
      expect((expr2 as Literal).value).toBe(255);
      expect((expr2 as Literal).literalType).toBe(LiteralType.UINT);
    });

    it('should parse double literals', () => {
      const parser1 = new Parser('3.14');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe(3.14);
      expect((expr1 as Literal).literalType).toBe(LiteralType.DOUBLE);

      const parser2 = new Parser('1e10');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Literal);
      expect((expr2 as Literal).value).toBe(1e10);
      expect((expr2 as Literal).literalType).toBe(LiteralType.DOUBLE);

      const parser3 = new Parser('2.5e-3');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Literal);
      expect((expr3 as Literal).value).toBe(2.5e-3);
      expect((expr3 as Literal).literalType).toBe(LiteralType.DOUBLE);
    });

    it('should parse string literals', () => {
      const parser1 = new Parser('"hello"');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe('hello');
      expect((expr1 as Literal).literalType).toBe(LiteralType.STRING);

      const parser2 = new Parser("'world'");
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Literal);
      expect((expr2 as Literal).value).toBe('world');
      expect((expr2 as Literal).literalType).toBe(LiteralType.STRING);
    });

    it('should parse string escape sequences', () => {
      const parser1 = new Parser('"hello\\nworld"');
      const expr1 = parser1.parse();
      expect((expr1 as Literal).value).toBe('hello\nworld');

      const parser2 = new Parser('"tab\\there"');
      const expr2 = parser2.parse();
      expect((expr2 as Literal).value).toBe('tab\there');

      const parser3 = new Parser('"quote\\"here"');
      const expr3 = parser3.parse();
      expect((expr3 as Literal).value).toBe('quote"here');

      // Hex escape
      const parser4 = new Parser('"\\x41\\x42"');
      const expr4 = parser4.parse();
      expect((expr4 as Literal).value).toBe('AB');

      // Unicode escape
      const parser5 = new Parser('"\\u0041\\u0042"');
      const expr5 = parser5.parse();
      expect((expr5 as Literal).value).toBe('AB');
    });

    it('should parse raw strings', () => {
      const parser1 = new Parser('r"hello\\nworld"');
      const expr1 = parser1.parse();
      expect((expr1 as Literal).value).toBe('hello\\nworld');

      const parser2 = new Parser("R'test\\t123'");
      const expr2 = parser2.parse();
      expect((expr2 as Literal).value).toBe('test\\t123');
    });

    it('should parse triple-quoted strings', () => {
      const parser1 = new Parser('"""multi\nline\nstring"""');
      const expr1 = parser1.parse();
      expect((expr1 as Literal).value).toBe('multi\nline\nstring');

      const parser2 = new Parser("'''another\none'''");
      const expr2 = parser2.parse();
      expect((expr2 as Literal).value).toBe('another\none');

      const parser3 = new Parser('r"""raw\\nmulti\\nline"""');
      const expr3 = parser3.parse();
      expect((expr3 as Literal).value).toBe('raw\\nmulti\\nline');
    });

    it('should parse bytes literals', () => {
      const parser1 = new Parser('b"bytes"');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Literal);
      expect((expr1 as Literal).value).toBe('bytes');
      expect((expr1 as Literal).literalType).toBe(LiteralType.BYTES);

      const parser2 = new Parser("B'test'");
      const expr2 = parser2.parse();
      expect((expr2 as Literal).value).toBe('test');
      expect((expr2 as Literal).literalType).toBe(LiteralType.BYTES);
    });
  });

  describe('Identifiers', () => {
    it('should parse identifiers', () => {
      const parser = new Parser('myVariable');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Identifier);
      expect((expr as Identifier).name).toBe('myVariable');
    });
  });

  describe('Binary Operators', () => {
    it('should parse binary operators', () => {
      const parser1 = new Parser('1 + 2');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Binary);
      const bin1 = expr1 as Binary;
      expect(bin1.op).toBe(BinaryOp.ADD);
      expect((bin1.left as Literal).value).toBe(1);
      expect((bin1.right as Literal).value).toBe(2);

      const parser2 = new Parser('x * y');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Binary);
      expect((expr2 as Binary).op).toBe(BinaryOp.MULTIPLY);

      const parser3 = new Parser('a == b');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Binary);
      expect((expr3 as Binary).op).toBe(BinaryOp.EQUAL);
    });

    it('should handle operator precedence', () => {
      const parser = new Parser('1 + 2 * 3');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Binary);
      const add = expr as Binary;
      expect(add.op).toBe(BinaryOp.ADD);
      expect(add.right).toBeInstanceOf(Binary);
      const mul = add.right as Binary;
      expect(mul.op).toBe(BinaryOp.MULTIPLY);
    });

    it('should parse in operator', () => {
      const parser = new Parser('x in list');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Binary);
      const bin = expr as Binary;
      expect(bin.op).toBe(BinaryOp.IN);
      expect((bin.left as Identifier).name).toBe('x');
      expect((bin.right as Identifier).name).toBe('list');
    });

    it('should parse logical operators', () => {
      const parser1 = new Parser('a && b');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Binary);
      expect((expr1 as Binary).op).toBe(BinaryOp.LOGICAL_AND);

      const parser2 = new Parser('x || y');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Binary);
      expect((expr2 as Binary).op).toBe(BinaryOp.LOGICAL_OR);

      const parser3 = new Parser('a && b || c');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Binary);
      const or = expr3 as Binary;
      expect(or.op).toBe(BinaryOp.LOGICAL_OR);
      expect(or.left).toBeInstanceOf(Binary);
      expect((or.left as Binary).op).toBe(BinaryOp.LOGICAL_AND);
    });
  });

  describe('Unary Operators', () => {
    it('should parse unary operators', () => {
      const parser1 = new Parser('!true');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Unary);
      expect((expr1 as Unary).op).toBe(UnaryOp.NOT);

      const parser2 = new Parser('-42');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Unary);
      expect((expr2 as Unary).op).toBe(UnaryOp.NEGATE);

      const parser3 = new Parser('!!value');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Unary);
      const outer = expr3 as Unary;
      expect(outer.operand).toBeInstanceOf(Unary);
    });
  });

  describe('Conditional Expressions', () => {
    it('should parse conditional expressions', () => {
      const parser = new Parser('x > 0 ? 1 : -1');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Conditional);
      const cond = expr as Conditional;
      expect(cond.condition).toBeInstanceOf(Binary);
      expect(cond.thenExpr).toBeInstanceOf(Literal);
      expect(cond.otherwiseExpr).toBeInstanceOf(Unary);
    });
  });

  describe('Lists', () => {
    it('should parse list literals', () => {
      const parser1 = new Parser('[]');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(ListExpression);
      expect((expr1 as ListExpression).elements).toHaveLength(0);

      const parser2 = new Parser('[1, 2, 3]');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(ListExpression);
      const elements = (expr2 as ListExpression).elements;
      expect(elements).toHaveLength(3);
      expect((elements[0] as Literal).value).toBe(1);
      expect((elements[1] as Literal).value).toBe(2);
      expect((elements[2] as Literal).value).toBe(3);

      const parser3 = new Parser('[1, 2, 3,]');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(ListExpression);
      expect((expr3 as ListExpression).elements).toHaveLength(3);
    });
  });

  describe('Maps', () => {
    it('should parse map literals', () => {
      const parser1 = new Parser('{}');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(MapExpression);
      expect((expr1 as MapExpression).entries).toHaveLength(0);

      const parser2 = new Parser('{1: "one", 2: "two"}');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(MapExpression);
      const entries = (expr2 as MapExpression).entries;
      expect(entries).toHaveLength(2);
      expect((entries[0]!.key as Literal).value).toBe(1);
      expect((entries[0]!.value as Literal).value).toBe('one');
    });
  });

  describe('Structs', () => {
    it('should parse struct literals', () => {
      const parser1 = new Parser('{name: "John", age: 30}');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Struct);
      const struct1 = expr1 as Struct;
      expect(struct1.typeName).toBeNull();
      expect(struct1.fields).toHaveLength(2);
      expect(struct1.fields[0]!.field).toBe('name');
      expect((struct1.fields[0]!.value as Literal).value).toBe('John');

      const parser2 = new Parser('Person{name: "John", age: 30}');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Struct);
      const struct2 = expr2 as Struct;
      expect(struct2.typeName).toBe('Person');
      expect(struct2.fields).toHaveLength(2);
    });

    it('should parse qualified identifiers', () => {
      const parser = new Parser('com.example.Type{field: 1}');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Struct);
      const struct = expr as Struct;
      expect(struct.typeName).toBe('com.example.Type');
      expect(struct.fields).toHaveLength(1);
    });
  });

  describe('Field Selection', () => {
    it('should parse field selection', () => {
      const parser = new Parser('obj.field');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Select);
      const sel = expr as Select;
      expect(sel.operand).toBeInstanceOf(Identifier);
      expect((sel.operand as Identifier).name).toBe('obj');
      expect(sel.field).toBe('field');
    });

    it('should parse leading dot', () => {
      const parser1 = new Parser('.field');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Select);
      const sel = expr1 as Select;
      expect(sel.operand).toBeNull();
      expect(sel.field).toBe('field');

      const parser2 = new Parser('.method()');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Call);
      const call = expr2 as Call;
      expect(call.target).toBeNull();
      expect(call.functionName).toBe('method');
    });

    it('should parse chained member access', () => {
      const parser = new Parser('obj.field1.field2.method()');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Call);
      const call = expr as Call;
      expect(call.target).toBeInstanceOf(Select);
      const sel2 = call.target as Select;
      expect(sel2.field).toBe('field2');
      expect(sel2.operand).toBeInstanceOf(Select);
      const sel1 = sel2.operand as Select;
      expect(sel1.field).toBe('field1');
      expect(sel1.operand).toBeInstanceOf(Identifier);
      expect((sel1.operand as Identifier).name).toBe('obj');
    });
  });

  describe('Indexing', () => {
    it('should parse index expressions', () => {
      const parser = new Parser('list[0]');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Index);
      const idx = expr as Index;
      expect(idx.operand).toBeInstanceOf(Identifier);
      expect((idx.operand as Identifier).name).toBe('list');
      expect((idx.index as Literal).value).toBe(0);
    });
  });

  describe('Function Calls', () => {
    it('should parse function calls', () => {
      const parser1 = new Parser('size(list)');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Call);
      const call1 = expr1 as Call;
      expect(call1.target).toBeNull();
      expect(call1.functionName).toBe('size');
      expect(call1.args).toHaveLength(1);
      expect(call1.isMacro).toBe(false);

      const parser2 = new Parser('func()');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Call);
      const call2 = expr2 as Call;
      expect(call2.args).toHaveLength(0);
    });

    it('should parse method calls', () => {
      const parser = new Parser('obj.method(arg1, arg2)');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Call);
      const call = expr as Call;
      expect(call.target).toBeInstanceOf(Identifier);
      expect((call.target as Identifier).name).toBe('obj');
      expect(call.functionName).toBe('method');
      expect(call.args).toHaveLength(2);
    });

    it('should parse macro calls', () => {
      const parser1 = new Parser('list.map(x, x * 2)');
      const expr1 = parser1.parse();
      expect(expr1).toBeInstanceOf(Call);
      const call1 = expr1 as Call;
      expect(call1.functionName).toBe('map');
      expect(call1.isMacro).toBe(true);

      const parser2 = new Parser('list.filter(x, x > 0)');
      const expr2 = parser2.parse();
      expect(expr2).toBeInstanceOf(Call);
      expect((expr2 as Call).isMacro).toBe(true);

      const parser3 = new Parser('list.all(x, x > 0)');
      const expr3 = parser3.parse();
      expect(expr3).toBeInstanceOf(Call);
      expect((expr3 as Call).isMacro).toBe(true);
    });
  });

  describe('Parenthesized Expressions', () => {
    it('should parse parenthesized expressions', () => {
      const parser = new Parser('(1 + 2) * 3');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Binary);
      const mul = expr as Binary;
      expect(mul.op).toBe(BinaryOp.MULTIPLY);
      expect(mul.left).toBeInstanceOf(Binary);
      const add = mul.left as Binary;
      expect(add.op).toBe(BinaryOp.ADD);
    });
  });

  describe('Complex Expressions', () => {
    it('should parse complex expressions', () => {
      const parser = new Parser('user.age > 18 && user.name == "John" ? "adult" : "minor"');
      const expr = parser.parse();
      expect(expr).toBeInstanceOf(Conditional);
      const cond = expr as Conditional;
      expect(cond.condition).toBeInstanceOf(Binary);
      expect((cond.condition as Binary).op).toBe(BinaryOp.LOGICAL_AND);
    });
  });

  describe('Error Handling', () => {
    it('should throw parse errors for invalid syntax', () => {
      expect(() => new Parser('1 +').parse()).toThrow(ParseError);
      expect(() => new Parser('"unterminated').parse()).toThrow(ParseError);
      expect(() => new Parser('@invalid').parse()).toThrow(ParseError);
    });

    it('should report line and column in errors', () => {
      // Unterminated string on line 3, column 4
      const src1 = '\n\n   "unterminated';
      try {
        new Parser(src1).parse();
        expect.fail('Should have thrown ParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const err = e as ParseError;
        expect(err.message).toContain('Unterminated string');
        expect(err.line).toBe(3);
        expect(err.column).toBe(4);
      }

      // Unexpected character after leading spaces on line 1, column 3
      const src2 = '  @oops';
      try {
        new Parser(src2).parse();
        expect.fail('Should have thrown ParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const err = e as ParseError;
        expect(err.message).toContain('Unexpected character');
        expect(err.line).toBe(1);
        expect(err.column).toBe(3);
      }

      // CRLF should count as a single newline; error '@' at line 3, column 1
      const src3 = '\r\n\t\t1 +\r\n@';
      try {
        new Parser(src3).parse();
        expect.fail('Should have thrown ParseError');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const err = e as ParseError;
        expect(err.message).toContain('Unexpected character');
        expect(err.line).toBe(3);
        expect(err.column).toBe(1);
      }
    });
  });
});
