import { describe, it, expect } from 'vitest';
import { Parser } from '../src/parser/parser.js';
import { Interpreter } from '../src/interpreter/interpreter.js';

// Helper to evaluate simple expressions
function evalExpr(expr: string, vars: Record<string, any> = {}): any {
  const interp = new Interpreter(vars);
  const parser = new Parser(expr);
  const ast = parser.parse();
  return interp.evaluate(ast);
}

describe('Interpreter', () => {
  describe('Literals', () => {
    it('should evaluate literals', () => {
      expect(evalExpr('42')).toBe(42);
      expect(evalExpr('3.14')).toBe(3.14);
      expect(evalExpr('"hello"')).toBe('hello');
      expect(evalExpr('true')).toBe(true);
      expect(evalExpr('false')).toBe(false);
      expect(evalExpr('null')).toBeNull();
    });
  });

  describe('Arithmetic', () => {
    it('should evaluate arithmetic operations', () => {
      expect(evalExpr('3 + 4')).toBe(7);
      expect(evalExpr('3 * 4')).toBe(12);
      expect(evalExpr('5 - 4')).toBe(1);
      expect(evalExpr('5 / 2')).toBe(2.5);
      expect(evalExpr('5 % 2')).toBe(1);
    });
  });

  describe('String Operations', () => {
    it('should handle string operations', () => {
      expect(evalExpr('"hello" + " world"')).toBe('hello world');
      expect(evalExpr('"a" * 3')).toBe('aaa');
    });
  });

  describe('List Operations', () => {
    it('should handle list operations', () => {
      const result = evalExpr('[1, 2] + [3, 4]');
      expect(result).toEqual([1, 2, 3, 4]);

      const repeated = evalExpr('[1, 2] * 3');
      expect(repeated).toEqual([1, 2, 1, 2, 1, 2]);
    });
  });

  describe('Comparisons', () => {
    it('should evaluate comparison operations', () => {
      expect(evalExpr('5 > 3')).toBe(true);
      expect(evalExpr('5 < 3')).toBe(false);
      expect(evalExpr('5 >= 5')).toBe(true);
      expect(evalExpr('5 <= 5')).toBe(true);
      expect(evalExpr('5 == 5')).toBe(true);
      expect(evalExpr('5 != 3')).toBe(true);
    });
  });

  describe('Logical Operators', () => {
    it('should evaluate logical operations', () => {
      expect(evalExpr('true && true')).toBe(true);
      expect(evalExpr('true && false')).toBe(false);
      expect(evalExpr('true || false')).toBe(true);
      expect(evalExpr('false || false')).toBe(false);
      expect(evalExpr('!true')).toBe(false);
      expect(evalExpr('!false')).toBe(true);
    });

    it('should short-circuit logical operations', () => {
      // Should not throw because of short-circuit
      const vars = { x: 0 };
      const interp = new Interpreter(vars);
      const expr = new Parser('x == 0 || x / 0 > 1').parse();
      expect(interp.evaluate(expr)).toBe(true);
    });
  });

  describe('Variables', () => {
    it('should access variables', () => {
      const vars = { name: 'Alice', age: 30 };
      const interp = new Interpreter(vars);

      expect(interp.evaluate(new Parser('name').parse())).toBe('Alice');
      expect(interp.evaluate(new Parser('age').parse())).toBe(30);
    });
  });

  describe('Map Access', () => {
    it('should access map fields', () => {
      const person = { name: 'Bob', age: 25 };
      const vars = { person };
      const interp = new Interpreter(vars);

      expect(interp.evaluate(new Parser('person.name').parse())).toBe('Bob');
      expect(interp.evaluate(new Parser('person.age').parse())).toBe(25);
      expect(interp.evaluate(new Parser('person["name"]').parse())).toBe('Bob');
    });
  });

  describe('List Access', () => {
    it('should access list elements', () => {
      const vars = { items: [10, 20, 30] };
      const interp = new Interpreter(vars);

      expect(interp.evaluate(new Parser('items[0]').parse())).toBe(10);
      expect(interp.evaluate(new Parser('items[1]').parse())).toBe(20);
      expect(interp.evaluate(new Parser('items[2]').parse())).toBe(30);
    });
  });

  describe('Ternary Operator', () => {
    it('should evaluate ternary expressions', () => {
      expect(evalExpr('true ? 10 : 20')).toBe(10);
      expect(evalExpr('false ? 10 : 20')).toBe(20);
    });
  });

  describe('IN Operator', () => {
    it('should evaluate in operator', () => {
      expect(evalExpr('2 in [1, 2, 3]')).toBe(true);
      expect(evalExpr('5 in [1, 2, 3]')).toBe(false);
      expect(evalExpr('"ell" in "hello"')).toBe(true);
      expect(evalExpr('"xyz" in "hello"')).toBe(false);
    });
  });

  describe('Macro Functions', () => {
    it('should evaluate map macro', () => {
      const vars = { nums: [1, 2, 3] };
      const interp = new Interpreter(vars);
      const result = interp.evaluate(new Parser('nums.map(x, x * 2)').parse());
      expect(result).toEqual([2, 4, 6]);
    });

    it('should evaluate filter macro', () => {
      const vars = { nums: [1, 2, 3, 4, 5] };
      const interp = new Interpreter(vars);
      const result = interp.evaluate(new Parser('nums.filter(x, x > 3)').parse());
      expect(result).toEqual([4, 5]);
    });

    it('should evaluate all macro', () => {
      const vars1 = { nums: [2, 4, 6] };
      const interp1 = new Interpreter(vars1);
      expect(interp1.evaluate(new Parser('nums.all(x, x % 2 == 0)').parse())).toBe(true);

      const vars2 = { nums: [2, 3, 6] };
      const interp2 = new Interpreter(vars2);
      expect(interp2.evaluate(new Parser('nums.all(x, x % 2 == 0)').parse())).toBe(false);
    });

    it('should evaluate exists macro', () => {
      const vars = { nums: [1, 2, 3] };
      const interp = new Interpreter(vars);
      expect(interp.evaluate(new Parser('nums.exists(x, x > 2)').parse())).toBe(true);
      expect(interp.evaluate(new Parser('nums.exists(x, x > 10)').parse())).toBe(false);
    });

    it('should evaluate existsOne macro', () => {
      const vars = { nums: [1, 2, 3] };
      const interp = new Interpreter(vars);
      expect(interp.evaluate(new Parser('nums.existsOne(x, x == 2)').parse())).toBe(true);
      expect(interp.evaluate(new Parser('nums.existsOne(x, x > 1)').parse())).toBe(false);
    });

    it('should handle macro variable scoping', () => {
      const vars = { x: 100, nums: [1, 2, 3] };
      const interp = new Interpreter(vars);

      // Use x in macro, should shadow outer x
      interp.evaluate(new Parser('nums.map(x, x * 2)').parse());

      // x should be restored to original value
      expect(interp.evaluate(new Parser('x').parse())).toBe(100);
    });
  });

  describe('Deep Equality', () => {
    it('should perform deep equality checks', () => {
      expect(evalExpr('[1, 2, 3] == [1, 2, 3]')).toBe(true);
      expect(evalExpr('[1, 2, 3] == [1, 2, 4]')).toBe(false);
      expect(evalExpr('[1, 2] == [1, 2, 3]')).toBe(false);
    });
  });

  describe('List Comparison', () => {
    it('should compare lists lexicographically', () => {
      expect(evalExpr('[1, 2] < [1, 3]')).toBe(true);
      expect(evalExpr('[1, 2] < [1, 2, 3]')).toBe(true);
      expect(evalExpr('[1, 3] < [1, 2]')).toBe(false);
      expect(evalExpr('[1, 2] == [1, 2]')).toBe(true);
    });
  });

  describe('Standard Functions', () => {
    it('should call standard functions', () => {
      const vars = {
        text: 'hello',
        items: [1, 2, 3],
      };
      const interp = new Interpreter(vars);

      expect(interp.evaluate(new Parser('size(text)').parse())).toBe(5);
      expect(interp.evaluate(new Parser('size(items)').parse())).toBe(3);
      expect(interp.evaluate(new Parser('text.contains("ell")').parse())).toBe(true);
      expect(interp.evaluate(new Parser('text.startsWith("hel")').parse())).toBe(true);
      expect(interp.evaluate(new Parser('text.endsWith("lo")').parse())).toBe(true);
    });
  });
});
