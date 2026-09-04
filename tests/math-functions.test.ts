import { describe, it, expect, beforeEach } from 'vitest';
import { CEL } from '../src/cel.js';
import { ArgumentError, EvaluationError } from '../src/errors.js';

/** Tests for the math functions. */
describe('Math functions', () => {
  let cel: CEL;

  beforeEach(() => {
    cel = new CEL();
  });

  const evalExpr = (source: string): unknown => cel.eval(source, {});

  it('should find the greatest and least values', () => {
    expect(evalExpr('math.greatest(1, 3, 2)')).toBe(3n);
    expect(evalExpr('math.least(1, 3, 2)')).toBe(1n);
    expect(evalExpr('math.greatest([1, 3, 2])')).toBe(3n);
    expect(evalExpr('math.greatest(1, 2.5)')).toBe(2.5);
    expect(() => evalExpr('math.greatest()')).toThrow(ArgumentError);
  });

  it('should preserve the numeric type of abs', () => {
    expect(evalExpr('math.abs(-5)')).toBe(5n);
    expect(evalExpr('math.abs(-5.5)')).toBe(5.5);
    expect(() => evalExpr('math.abs(-9223372036854775807 - 1)')).toThrow(EvaluationError);
  });

  it('should round half away from zero', () => {
    expect(evalExpr('math.ceil(1.2)')).toBe(2);
    expect(evalExpr('math.floor(1.8)')).toBe(1);
    expect(evalExpr('math.round(1.5)')).toBe(2);
    expect(evalExpr('math.round(-1.5)')).toBe(-2);
    expect(evalExpr('math.trunc(1.9)')).toBe(1);
    expect(evalExpr('math.trunc(-1.9)')).toBe(-1);
  });

  it('should compute sign and sqrt', () => {
    expect(evalExpr('math.sign(-4)')).toBe(-1n);
    expect(evalExpr('math.sign(0)')).toBe(0n);
    expect(evalExpr('math.sign(4.2)')).toBe(1);
    expect(evalExpr('math.sqrt(9)')).toBe(3);
    expect(evalExpr('math.sqrt(-1)')).toBeNaN();
  });

  it('should classify floating point values', () => {
    expect(evalExpr('math.isNaN(1.0)')).toBe(false);
    expect(evalExpr('math.isNaN(0.0 / 0.0)')).toBe(true);
    expect(evalExpr('math.isFinite(1.0)')).toBe(true);
    expect(evalExpr('math.isInf(1.0)')).toBe(false);
    expect(evalExpr('math.isInf(1.0 / 0.0)')).toBe(true);
  });

  it('should perform 64-bit bit operations', () => {
    expect(evalExpr('math.bitAnd(12, 10)')).toBe(8n);
    expect(evalExpr('math.bitOr(12, 10)')).toBe(14n);
    expect(evalExpr('math.bitXor(12, 10)')).toBe(6n);
    expect(evalExpr('math.bitNot(0)')).toBe(-1n);
    expect(evalExpr('math.bitShiftLeft(1, 2)')).toBe(4n);
    expect(evalExpr('math.bitShiftRight(4, 2)')).toBe(1n);
    expect(evalExpr('math.bitShiftRight(-1, 60)')).toBe(15n);
    expect(evalExpr('math.bitShiftLeft(1, 63)')).toBe(-9223372036854775808n);
    expect(evalExpr('math.bitShiftLeft(1, 64)')).toBe(0n);
    expect(() => evalExpr('math.bitShiftLeft(1, -1)')).toThrow(ArgumentError);
  });

  it('should check arguments', () => {
    expect(() => evalExpr('math.abs(1, 2)')).toThrow(ArgumentError);
    // An unknown name under a namespace is reported as an undefined variable
    expect(() => evalExpr('math.missing(1)')).toThrow(EvaluationError);
  });
});
