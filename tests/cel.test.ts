import { describe, it, expect, beforeEach } from 'vitest';
import { CEL } from '../src/cel.js';
import { StandardFunctions } from '../src/functions/index.js';
import { ParseError } from '../src/parser/index.js';

describe('CEL', () => {
  describe('Basic Usage', () => {
    it('should evaluate simple expressions', () => {
      const cel = new CEL();
      expect(cel.eval('2 + 3 * 4', {})).toBe(14);
      expect(cel.eval('(2 + 3) * 4', {})).toBe(20);
    });

    it('should work with variables', () => {
      const cel = new CEL();
      const vars = { name: 'Alice', age: 30 };
      expect(cel.eval('name + " is " + string(age) + " years old"', vars)).toBe(
        'Alice is 30 years old'
      );
      expect(cel.eval('age >= 18 && age < 65', vars)).toBe(true);
    });
  });

  describe('Program Compilation', () => {
    it('should compile and reuse programs', () => {
      const cel = new CEL();
      const program = cel.compile('price * quantity * (1 - discount)');

      const result1 = program.evaluate({ price: 10, quantity: 5, discount: 0.1 });
      expect(result1).toBe(45);

      const result2 = program.evaluate({ price: 20, quantity: 3, discount: 0.2 });
      expect(result2).toBe(48);
    });
  });

  describe('Complex Data', () => {
    it('should work with nested objects', () => {
      const cel = new CEL();
      const data = {
        user: {
          name: 'Alice',
          roles: ['admin', 'user'],
          metadata: { active: true },
        },
        permissions: ['read', 'write', 'delete'],
      };

      expect(cel.eval('"admin" in user.roles && "delete" in permissions', data)).toBe(true);
    });

    it('should use macro functions', () => {
      const cel = new CEL();
      const users = [
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
        { name: 'Charlie', active: true },
      ];

      const result = cel.eval('users.filter(u, u.active).map(u, u.name)', { users });
      expect(result).toEqual(['Alice', 'Charlie']);
    });
  });

  describe('Static Methods', () => {
    it('should support static compile', () => {
      const program = CEL.compile('x * 2', new StandardFunctions());
      expect(program.evaluate({ x: 21 })).toBe(42);
    });

    it('should support static eval', () => {
      const result = CEL.eval('x + y', new StandardFunctions(), { x: 10, y: 20 });
      expect(result).toBe(30);
    });
  });

  describe('Custom Functions', () => {
    it('should support custom function libraries', () => {
      class CustomFunctions extends StandardFunctions {
        callFunction(name: string, args: any[]): any {
          if (name === 'reverse') {
            return (args[0] as string).split('').reverse().join('');
          }
          if (name === 'double') {
            const str = args[0] as string;
            return str + str;
          }
          return super.callFunction(name, args);
        }
      }

      const cel = new CEL(new CustomFunctions());
      expect(cel.eval('reverse("hello")', {})).toBe('olleh');
      expect(cel.eval('double("world")', {})).toBe('worldworld');
    });
  });

  describe('Type Conversions', () => {
    it('should convert types', () => {
      const cel = new CEL();
      expect(cel.eval('int("42")', {})).toBe(42);
      expect(cel.eval('double(42)', {})).toBe(42);
      expect(cel.eval('string(42)', {})).toBe('42');
      expect(cel.eval('type([1, 2, 3])', {})).toBe('list');
    });
  });

  describe('Comprehensive Integration Tests', () => {
    let cel: CEL;

    beforeEach(() => {
      cel = new CEL();
    });

    describe('Literals', () => {
      it('should parse all literal types', () => {
        expect(cel.eval('null', {})).toBeNull();
        expect(cel.eval('true', {})).toBe(true);
        expect(cel.eval('false', {})).toBe(false);
        expect(cel.eval('42', {})).toBe(42);
        expect(cel.eval('3.14', {})).toBe(3.14);
        expect(cel.eval('"hello"', {})).toBe('hello');
        expect(cel.eval('r"raw string"', {})).toBe('raw string');
      });

      it('should parse hexadecimal integers', () => {
        expect(cel.eval('0x10', {})).toBe(16);
        expect(cel.eval('0xFF', {})).toBe(255);
        expect(cel.eval('0x1A', {})).toBe(26);
        expect(cel.eval('-0x10', {})).toBe(-16);
        expect(cel.eval('0x10u', {})).toBe(16);
        expect(cel.eval('0xFFu', {})).toBe(255);
      });

      it('should parse strings with escape sequences', () => {
        expect(cel.eval('"\\101"', {})).toBe('A'); // octal
        expect(cel.eval('"\\040"', {})).toBe(' '); // octal space
        expect(cel.eval('"\\a"', {})).toBe('\u0007'); // bell
        expect(cel.eval('"\\b"', {})).toBe('\b'); // backspace
        expect(cel.eval('"\\f"', {})).toBe('\f'); // form feed
        expect(cel.eval('"\\v"', {})).toBe('\u000B'); // vertical tab
        expect(cel.eval('"\\?"', {})).toBe('?');
        expect(cel.eval('"\\`"', {})).toBe('`');
      });

      it('should parse triple-quoted strings', () => {
        expect(cel.eval('"""hello world"""', {})).toBe('hello world');
        expect(cel.eval("'''hello world'''", {})).toBe('hello world');
        expect(cel.eval('"""line 1\nline 2"""', {})).toBe('line 1\nline 2');
        expect(cel.eval('r"""hello\\nworld"""', {})).toBe('hello\\nworld');
      });
    });

    describe('Operators', () => {
      it('should evaluate arithmetic operators', () => {
        expect(cel.eval('2 + 3', {})).toBe(5);
        expect(cel.eval('10 - 4', {})).toBe(6);
        expect(cel.eval('3 * 4', {})).toBe(12);
        expect(cel.eval('15 / 3', {})).toBe(5);
        expect(cel.eval('17 % 5', {})).toBe(2);
      });

      it('should respect operator precedence', () => {
        expect(cel.eval('2 + 3 * 4', {})).toBe(14);
        expect(cel.eval('(2 + 3) * 4', {})).toBe(20);
        expect(cel.eval('10 - 2 * 3', {})).toBe(4);
      });

      it('should evaluate comparison operators', () => {
        expect(cel.eval('3 < 5', {})).toBe(true);
        expect(cel.eval('5 <= 5', {})).toBe(true);
        expect(cel.eval('7 > 4', {})).toBe(true);
        expect(cel.eval('8 >= 8', {})).toBe(true);
        expect(cel.eval('5 == 5', {})).toBe(true);
        expect(cel.eval('5 != 3', {})).toBe(true);
      });

      it('should evaluate logical operators', () => {
        expect(cel.eval('true && true', {})).toBe(true);
        expect(cel.eval('true && false', {})).toBe(false);
        expect(cel.eval('false || true', {})).toBe(true);
        expect(cel.eval('false || false', {})).toBe(false);
        expect(cel.eval('!true', {})).toBe(false);
        expect(cel.eval('!false', {})).toBe(true);
      });

      it('should evaluate conditional expressions', () => {
        expect(cel.eval('true ? 1 : 2', {})).toBe(1);
        expect(cel.eval('false ? 1 : 2', {})).toBe(2);
        expect(cel.eval('x > 5 ? "big" : "small"', { x: 10 })).toBe('big');
        expect(cel.eval('x > 5 ? "big" : "small"', { x: 3 })).toBe('small');
      });
    });

    describe('Collections', () => {
      it('should parse list literals', () => {
        expect(cel.eval('[]', {})).toEqual([]);
        expect(cel.eval('[1, 2, 3]', {})).toEqual([1, 2, 3]);
        expect(cel.eval('[1, "two", true]', {})).toEqual([1, 'two', true]);
      });

      it('should parse map literals', () => {
        expect(cel.eval('{}', {})).toEqual({});
        expect(cel.eval('{"a": 1, "b": 2}', {})).toEqual({ a: 1, b: 2 });
        expect(cel.eval('{1: "one", 2: "two"}', {})).toEqual({ 1: 'one', 2: 'two' });
      });

      it('should handle field selection', () => {
        expect(cel.eval('obj.field', { obj: { field: 42 } })).toBe(42);
        expect(cel.eval('obj.nested.field', { obj: { nested: { field: 'value' } } })).toBe('value');
      });

      it('should handle indexing', () => {
        expect(cel.eval('list[0]', { list: [1, 2, 3] })).toBe(1);
        expect(cel.eval('list[1]', { list: [1, 2, 3] })).toBe(2);
        expect(cel.eval('map["key"]', { map: { key: 'value' } })).toBe('value');
        expect(cel.eval('str[0]', { str: 'hello' })).toBe('h');
      });
    });

    describe('String Operations', () => {
      it('should concatenate strings', () => {
        expect(cel.eval('"hello" + " " + "world"', {})).toBe('hello world');
        expect(cel.eval('"value: " + string(42)', {})).toBe('value: 42');
      });

      it('should multiply strings', () => {
        expect(cel.eval('"ab" * 3', {})).toBe('ababab');
      });

      it('should call string methods', () => {
        expect(cel.eval('"hello".contains("ll")', {})).toBe(true);
        expect(cel.eval('"hello".startsWith("he")', {})).toBe(true);
        expect(cel.eval('"hello".endsWith("lo")', {})).toBe(true);
        expect(cel.eval('"HELLO".toLowerCase()', {})).toBe('hello');
        expect(cel.eval('"hello".toUpperCase()', {})).toBe('HELLO');
        expect(cel.eval('"  hello  ".trim()', {})).toBe('hello');
        expect(cel.eval('"hello world".replace("world", "dart")', {})).toBe('hello dart');
        expect(cel.eval('"a,b,c".split(",")', {})).toEqual(['a', 'b', 'c']);
      });
    });

    describe('List Operations', () => {
      it('should concatenate lists', () => {
        expect(cel.eval('[1, 2] + [3, 4]', {})).toEqual([1, 2, 3, 4]);
      });

      it('should multiply lists', () => {
        expect(cel.eval('[1, 2] * 2', {})).toEqual([1, 2, 1, 2]);
      });

      it('should check list membership', () => {
        expect(cel.eval('2 in [1, 2, 3]', {})).toBe(true);
        expect(cel.eval('4 in [1, 2, 3]', {})).toBe(false);
      });
    });

    describe('Functions', () => {
      it('should call built-in functions', () => {
        expect(cel.eval('size("hello")', {})).toBe(5);
        expect(cel.eval('size([1, 2, 3])', {})).toBe(3);
        expect(cel.eval('int("42")', {})).toBe(42);
        expect(cel.eval('string(42)', {})).toBe('42');
      });

      it('should evaluate type function', () => {
        expect(cel.eval('type(null)', {})).toBe('null');
        expect(cel.eval('type(true)', {})).toBe('bool');
        expect(cel.eval('type(42)', {})).toBe('int');
        expect(cel.eval('type(3.14)', {})).toBe('double');
        expect(cel.eval('type("hello")', {})).toBe('string');
        expect(cel.eval('type([1, 2])', {})).toBe('list');
        expect(cel.eval('type({"a": 1})', {})).toBe('map');
      });

      it('should evaluate has function', () => {
        expect(cel.eval('has(obj, "field")', { obj: { field: 1 } })).toBe(true);
        expect(cel.eval('has(obj, "missing")', { obj: { field: 1 } })).toBe(false);
      });

      it('should evaluate matches function', () => {
        expect(cel.eval('matches("hello", "h.*o")', {})).toBe(true);
        expect(cel.eval('matches("hello", "^h")', {})).toBe(true);
        expect(cel.eval('matches("hello", "^e")', {})).toBe(false);
      });

      it('should evaluate max and min functions', () => {
        expect(cel.eval('max(1, 2, 3)', {})).toBe(3);
        expect(cel.eval('min(1, 2, 3)', {})).toBe(1);
        expect(cel.eval('max("a", "b", "c")', {})).toBe('c');
        expect(cel.eval('min("a", "b", "c")', {})).toBe('a');
      });
    });

    describe('Equality and Comparison', () => {
      it('should handle null equality', () => {
        expect(cel.eval('null == null', {})).toBe(true);
        expect(cel.eval('null != 1', {})).toBe(true);
        expect(cel.eval('1 != null', {})).toBe(true);
      });

      it('should compare lists correctly', () => {
        expect(cel.eval('[1, 2] == [1, 2]', {})).toBe(true);
        expect(cel.eval('[1, 2] != [2, 1]', {})).toBe(true);
        expect(cel.eval('[1, 2] < [1, 3]', {})).toBe(true);
        expect(cel.eval('[1, 2, 3] > [1, 2]', {})).toBe(true);
      });

      it('should compare maps correctly', () => {
        expect(cel.eval('{"a": 1} == {"a": 1}', {})).toBe(true);
        expect(cel.eval('{"a": 1} != {"b": 1}', {})).toBe(true);
        expect(cel.eval('{"a": 1, "b": 2} == {"b": 2, "a": 1}', {})).toBe(true);
      });
    });

    describe('Macro Functions', () => {
      it('should transform with map', () => {
        expect(cel.eval('[1, 2, 3].map(x, x * 2)', {})).toEqual([2, 4, 6]);
        expect(cel.eval('[1, 2, 3].map(n, n + 10)', {})).toEqual([11, 12, 13]);
        expect(cel.eval('["a", "b", "c"].map(s, s + "!")', {})).toEqual(['a!', 'b!', 'c!']);
        expect(cel.eval('[1, 2, 3].map(x, x * x)', {})).toEqual([1, 4, 9]);
      });

      it('should filter lists', () => {
        expect(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2)', {})).toEqual([3, 4, 5]);
        expect(cel.eval('[1, 2, 3, 4, 5].filter(x, x % 2 == 0)', {})).toEqual([2, 4]);
        expect(cel.eval('["a", "ab", "abc"].filter(s, size(s) > 1)', {})).toEqual(['ab', 'abc']);
      });

      it('should check all elements', () => {
        expect(cel.eval('[2, 4, 6].all(x, x % 2 == 0)', {})).toBe(true);
        expect(cel.eval('[1, 2, 3].all(x, x > 0)', {})).toBe(true);
        expect(cel.eval('[1, 2, 3].all(x, x > 2)', {})).toBe(false);
        expect(cel.eval('[].all(x, x > 0)', {})).toBe(true); // Empty list
      });

      it('should check if any element exists', () => {
        expect(cel.eval('[1, 2, 3].exists(x, x > 2)', {})).toBe(true);
        expect(cel.eval('[1, 2, 3].exists(x, x > 10)', {})).toBe(false);
        expect(cel.eval('[1, 3, 5].exists(x, x % 2 == 0)', {})).toBe(false);
        expect(cel.eval('[].exists(x, x > 0)', {})).toBe(false); // Empty list
      });

      it('should check if exactly one exists', () => {
        expect(cel.eval('[1, 2, 3].existsOne(x, x == 2)', {})).toBe(true);
        expect(cel.eval('[1, 2, 3].existsOne(x, x > 2)', {})).toBe(true);
        expect(cel.eval('[1, 2, 3].existsOne(x, x > 1)', {})).toBe(false); // 2 matches
        expect(cel.eval('[1, 2, 3].existsOne(x, x > 10)', {})).toBe(false); // 0 matches
        expect(cel.eval('[].existsOne(x, x > 0)', {})).toBe(false); // Empty list
      });

      it('should chain macro functions', () => {
        expect(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2).map(x, x * 2)', {})).toEqual([6, 8, 10]);
        expect(cel.eval('[1, 2, 3, 4].map(x, x * 2).filter(x, x > 4)', {})).toEqual([6, 8]);
      });

      it('should work with objects in lists', () => {
        const users = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
          { name: 'Charlie', age: 35 },
        ];
        expect(cel.eval('users.map(u, u.name)', { users })).toEqual(['Alice', 'Bob', 'Charlie']);
        expect(cel.eval('users.map(u, u.age * 2)', { users })).toEqual([60, 50, 70]);
        expect(cel.eval('users.filter(u, u.age > 28)', { users })).toEqual([
          { name: 'Alice', age: 30 },
          { name: 'Charlie', age: 35 },
        ]);
        expect(cel.eval('users.all(u, u.age >= 25)', { users })).toBe(true);
        expect(cel.eval('users.exists(u, u.age > 33)', { users })).toBe(true);
        expect(cel.eval('users.existsOne(u, u.age == 25)', { users })).toBe(true);
      });

      it('should preserve variable scope', () => {
        const vars = { x: 100, nums: [1, 2, 3] };
        expect(cel.eval('[1, 2, 3].map(x, x * 2)', vars)).toEqual([2, 4, 6]);
        expect(cel.eval('x', vars)).toBe(100); // x should be restored
      });
    });

    describe('Error Handling', () => {
      it('should throw for undefined variables', () => {
        expect(() => cel.eval('x', {})).toThrow('Undefined variable');
      });

      it('should throw for invalid operations', () => {
        expect(() => cel.eval('1 / 0', {})).toThrow('Division by zero');
        expect(() => cel.eval('1 % 0', {})).toThrow('Modulo by zero');
        expect(() => cel.eval('"hello" - "world"', {})).toThrow('Subtraction requires numeric');
      });

      it('should throw for invalid indexing', () => {
        expect(() => cel.eval('[1, 2][5]', {})).toThrow('index out of bounds');
        expect(() => cel.eval('[1, 2][-1]', {})).toThrow('index out of bounds');
        expect(() => cel.eval('{"a": 1}["b"]', {})).toThrow('Map key not found');
      });

      it('should throw parse errors', () => {
        expect(() => cel.compile('x +')).toThrow(ParseError);
        expect(() => cel.compile('(1 + 2')).toThrow(ParseError);
        expect(() => cel.compile('1 2 3')).toThrow(ParseError);
      });
    });

    describe('Complex Expressions', () => {
      it('should evaluate complex boolean logic', () => {
        expect(cel.eval('x > 0 && x < 10', { x: 5 })).toBe(true);
        expect(cel.eval('x > 0 && x < 10', { x: 15 })).toBe(false);
        expect(cel.eval('(x + y) * z', { x: 2, y: 3, z: 4 })).toBe(20);
      });

      it('should handle nested data structures', () => {
        const data = {
          user: { age: 21 },
        };
        expect(cel.eval('user.age >= 18 ? "adult" : "minor"', data)).toBe('adult');
      });
    });
  });
});
