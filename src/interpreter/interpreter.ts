import {
  Expression,
  Visitor,
  Literal,
  Identifier,
  Select,
  Index,
  Call,
  ListExpression,
  MapExpression,
  Struct,
  Comprehension,
  Unary,
  Binary,
  Conditional,
  BinaryOp,
  UnaryOp,
} from '../ast/index.js';
import { Functions } from '../functions/functions.js';
import { EvaluationError, isCelError } from '../errors.js';
import { StandardFunctions } from '../functions/standard-functions.js';
import * as Utilities from '../functions/utilities.js';
import { Timestamp } from '../values/timestamp.js';
import { Duration } from '../values/duration.js';
import { Type } from '../values/type.js';
import { normalize, normalizeResult } from '../values/normalize.js';
import { isBytes, concatBytes } from '../values/bytes.js';
import { INT64_MIN, checkInt64, isNumeric } from '../values/numbers.js';

const OPERATOR_SPELLING: Partial<Record<BinaryOp, string>> = {
  [BinaryOp.LOGICAL_AND]: '&&',
  [BinaryOp.LOGICAL_OR]: '||',
};

/**
 * Interpreter for evaluating CEL expressions.
 *
 * Implements the Visitor pattern to traverse and evaluate the AST produced by the parser.
 * Supports all CEL operations including macros, type conversions, and complex expressions.
 *
 * Variables are normalised into the CEL value model on construction: integer-valued
 * numbers become `bigint`, plain objects become `Map`, and `Date` becomes `Timestamp`.
 *
 * Note: an Interpreter is not safe to share between concurrent evaluations; the
 * variable scope is mutated while macros run.
 */
export class Interpreter implements Visitor<unknown> {
  private readonly variables: Map<string, unknown>;
  private readonly functions: Functions;

  /**
   * Constructs an interpreter with the specified variables and functions.
   *
   * @param variables Variable bindings as a plain object or Map. If null, no variables are bound.
   * @param functions The function library. If null, StandardFunctions is used.
   */
  constructor(
    variables?: Record<string, unknown> | Map<string, unknown> | null,
    functions?: Functions | null
  ) {
    this.variables = new Map();
    if (variables instanceof Map) {
      for (const [name, value] of variables) {
        this.variables.set(name, normalize(value));
      }
    } else if (variables) {
      for (const [name, value] of Object.entries(variables)) {
        this.variables.set(name, normalize(value));
      }
    }
    this.functions = functions ?? new StandardFunctions();
  }

  /**
   * Evaluates a CEL expression and returns its result.
   *
   * @throws EvaluationError if evaluation fails
   */
  evaluate(expr: Expression): unknown {
    return expr.accept(this);
  }

  visitLiteral(expr: Literal): unknown {
    return expr.value;
  }

  visitIdentifier(expr: Identifier): unknown {
    if (!this.variables.has(expr.name)) {
      // Bare type names resolve to type values unless a variable shadows them
      const type = Type.of(expr.name);
      if (type !== null) {
        return type;
      }
      throw new EvaluationError(`Undefined variable: ${expr.name}`);
    }
    return this.variables.get(expr.name);
  }

  visitSelect(expr: Select): unknown {
    const target = expr.operand !== null ? this.evaluate(expr.operand) : this.variables;

    if (target === null || target === undefined) {
      if (expr.isTest) {
        return false;
      }
      throw new EvaluationError(`Cannot select field ${expr.field} from null`);
    }

    if (target instanceof Map) {
      if (expr.isTest) {
        return target.has(expr.field);
      }
      if (!target.has(expr.field)) {
        throw new EvaluationError(`Field ${expr.field} not found`);
      }
      return target.get(expr.field);
    }

    throw new EvaluationError('Cannot select field from non-map type');
  }

  visitCall(expr: Call): unknown {
    // For macro calls, we need special handling
    if (expr.isMacro && expr.target !== null) {
      const target = this.evaluate(expr.target);

      // For macros, we pass the AST expressions, not evaluated values
      if (expr.args.length === 0) {
        throw new EvaluationError(`Macro ${expr.functionName} requires arguments`);
      }

      // Extract variable name from first argument
      const first = expr.args[0]!;
      if (!(first instanceof Identifier)) {
        throw new EvaluationError(
          `First argument to macro ${expr.functionName} must be a variable name`
        );
      }

      // Remaining arguments are kept as unevaluated AST
      if (expr.args.length < 2) {
        throw new EvaluationError(`Macro ${expr.functionName} requires an expression argument`);
      }
      const steps = expr.args.slice(1);

      return this.evaluateMacro(target, expr.functionName, first.name, steps);
    }

    // Regular function call - evaluate all arguments
    const args: unknown[] = [];
    for (const arg of expr.args) {
      args.push(this.evaluate(arg));
    }

    if (expr.target !== null) {
      // A qualified name such as math.abs is a namespaced function unless a variable shadows it
      const namespace = this.qualify(expr.target);
      if (namespace !== null) {
        const qualified = `${namespace}.${expr.functionName}`;
        if (!this.variables.has(this.root(namespace)) && this.knows(qualified)) {
          return normalizeResult(this.functions.callFunction(qualified, args));
        }
      }
      const target = this.evaluate(expr.target);
      return normalizeResult(this.functions.callMethod(target, expr.functionName, args));
    }
    return normalizeResult(this.functions.callFunction(expr.functionName, args));
  }

  private knows(name: string): boolean {
    return this.functions.knows?.(name) ?? false;
  }

  // Flattens an identifier or a chain of selections over one into a dotted name, or null
  private qualify(expr: Expression): string | null {
    if (expr instanceof Identifier) {
      return expr.name;
    }
    if (expr instanceof Select && expr.operand !== null && !expr.isTest) {
      const prefix = this.qualify(expr.operand);
      return prefix === null ? null : `${prefix}.${expr.field}`;
    }
    return null;
  }

  private root(name: string): string {
    const dot = name.indexOf('.');
    return dot < 0 ? name : name.substring(0, dot);
  }

  private evaluateMacro(
    target: unknown,
    functionName: string,
    variableName: string,
    steps: Expression[]
  ): unknown {
    let list: unknown[];
    if (Array.isArray(target)) {
      list = target;
    } else if (target instanceof Map) {
      list = Array.from(target.keys());
    } else {
      throw new EvaluationError(`Macro ${functionName} requires a list or map target`);
    }

    // Save the current value of the variable (if any)
    const saved = this.variables.get(variableName);
    const had = this.variables.has(variableName);
    const bind = (item: unknown): void => {
      this.variables.set(variableName, item);
    };
    const step = steps[0]!;

    try {
      switch (functionName) {
        case 'map': {
          // Optional second expression makes the first a predicate: map(x, filter, transform)
          const predicate = steps.length > 1 ? steps[0]! : null;
          const transform = steps.length > 1 ? steps[1]! : step;
          const results: unknown[] = [];
          for (const item of list) {
            bind(item);
            if (predicate !== null && !this.test(predicate, functionName)) {
              continue;
            }
            results.push(this.evaluate(transform));
          }
          return results;
        }

        case 'filter': {
          const results: unknown[] = [];
          for (const item of list) {
            bind(item);
            if (this.test(step, functionName)) {
              results.push(item);
            }
          }
          return results;
        }

        case 'all': {
          for (const item of list) {
            bind(item);
            if (!this.test(step, functionName)) {
              return false;
            }
          }
          return true;
        }

        case 'exists': {
          for (const item of list) {
            bind(item);
            if (this.test(step, functionName)) {
              return true;
            }
          }
          return false;
        }

        case 'existsOne': {
          let count = 0;
          for (const item of list) {
            bind(item);
            if (this.test(step, functionName)) {
              count++;
              if (count > 1) {
                return false;
              }
            }
          }
          return count === 1;
        }

        case 'sortBy': {
          // Decorate, sort and undecorate: each key is evaluated exactly once and the sort is stable
          const keys: unknown[] = [];
          for (const item of list) {
            bind(item);
            keys.push(this.evaluate(step));
          }
          const order = list.map((_, index) => index);
          order.sort((left, right) => Utilities.compare(keys[left], keys[right]));
          return order.map((index) => list[index]);
        }

        default:
          throw new EvaluationError(`Unknown macro function: ${functionName}`);
      }
    } finally {
      // Restore the original value of the variable
      if (had) {
        this.variables.set(variableName, saved);
      } else {
        this.variables.delete(variableName);
      }
    }
  }

  // Evaluates a macro predicate, which the specification requires to yield a boolean
  private test(expr: Expression, functionName: string): boolean {
    const result = this.evaluate(expr);
    if (typeof result !== 'boolean') {
      throw new EvaluationError(`Macro ${functionName} requires a boolean predicate`);
    }
    return result;
  }

  visitList(expr: ListExpression): unknown {
    const result: unknown[] = [];
    for (const element of expr.elements) {
      result.push(this.evaluate(element));
    }
    return result;
  }

  visitMap(expr: MapExpression): unknown {
    const map = new Map<unknown, unknown>();
    for (const entry of expr.entries) {
      const key = this.evaluate(entry.key);
      const value = this.evaluate(entry.value);
      map.set(key, value);
    }
    return map;
  }

  visitStruct(expr: Struct): unknown {
    const map = new Map<string, unknown>();
    for (const field of expr.fields) {
      map.set(field.field, this.evaluate(field.value));
    }
    return map;
  }

  visitComprehension(expr: Comprehension): unknown {
    const range = this.evaluate(expr.range);
    if (!Array.isArray(range)) {
      throw new EvaluationError('Comprehension range must be a list');
    }

    const iteratorSaved = this.variables.get(expr.variable);
    const accumulatorSaved = this.variables.get(expr.accumulator);
    const hadIterator = this.variables.has(expr.variable);
    const hadAccumulator = this.variables.has(expr.accumulator);

    try {
      let accumulator = this.evaluate(expr.initializer);
      this.variables.set(expr.accumulator, accumulator);

      for (const item of range) {
        this.variables.set(expr.variable, item);

        const condition = this.evaluate(expr.condition);
        if (condition !== true) {
          continue;
        }

        accumulator = this.evaluate(expr.step);
        this.variables.set(expr.accumulator, accumulator);
      }

      return this.evaluate(expr.result);
    } finally {
      if (hadIterator) {
        this.variables.set(expr.variable, iteratorSaved);
      } else {
        this.variables.delete(expr.variable);
      }
      if (hadAccumulator) {
        this.variables.set(expr.accumulator, accumulatorSaved);
      } else {
        this.variables.delete(expr.accumulator);
      }
    }
  }

  visitUnary(expr: Unary): unknown {
    const operand = this.evaluate(expr.operand);

    switch (expr.op) {
      case UnaryOp.NOT:
        if (typeof operand !== 'boolean') {
          throw new EvaluationError('NOT operator requires boolean operand');
        }
        return !operand;

      case UnaryOp.NEGATE:
        if (typeof operand === 'bigint') {
          if (operand === INT64_MIN) {
            throw new EvaluationError('Integer overflow');
          }
          return -operand;
        }
        if (typeof operand === 'number') {
          return -operand;
        }
        if (operand instanceof Duration) {
          return operand.negated();
        }
        throw new EvaluationError('Negation requires numeric operand');

      default:
        throw new EvaluationError(`Unknown unary operator: ${expr.op}`);
    }
  }

  visitBinary(expr: Binary): unknown {
    // Logical operators absorb errors from the other operand
    if (expr.op === BinaryOp.LOGICAL_AND) {
      return this.combine(expr, false);
    }
    if (expr.op === BinaryOp.LOGICAL_OR) {
      return this.combine(expr, true);
    }

    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);

    switch (expr.op) {
      case BinaryOp.ADD: {
        // Bytes concatenation
        if (isBytes(left) && isBytes(right)) {
          Utilities.limit(left.length + right.length, 'Bytes concatenation');
          return concatBytes(left, right);
        }
        // Timestamp and duration arithmetic
        if (left instanceof Timestamp && right instanceof Duration) {
          return left.plus(right);
        }
        if (left instanceof Duration && right instanceof Timestamp) {
          return right.plus(left);
        }
        if (left instanceof Duration && right instanceof Duration) {
          return left.plus(right);
        }
        // String concatenation
        if (typeof left === 'string' || typeof right === 'string') {
          const head = Utilities.asString(left);
          const tail = Utilities.asString(right);
          Utilities.limit(head.length + tail.length, 'String concatenation');
          return head + tail;
        }
        // List concatenation
        if (Array.isArray(left) && Array.isArray(right)) {
          Utilities.limit(left.length + right.length, 'List concatenation');
          return [...left, ...right];
        }
        // Numeric addition
        if (isNumeric(left) && isNumeric(right)) {
          return this.arithmetic(
            left,
            right,
            (a, b) => a + b,
            (a, b) => a + b
          );
        }
        throw new EvaluationError('Invalid operands for addition');
      }

      case BinaryOp.SUBTRACT: {
        if (left instanceof Timestamp && right instanceof Timestamp) {
          return right.until(left);
        }
        if (left instanceof Timestamp && right instanceof Duration) {
          return left.minus(right);
        }
        if (left instanceof Duration && right instanceof Duration) {
          return left.minus(right);
        }
        if (isNumeric(left) && isNumeric(right)) {
          return this.arithmetic(
            left,
            right,
            (a, b) => a - b,
            (a, b) => a - b
          );
        }
        throw new EvaluationError('Subtraction requires numeric operands');
      }

      case BinaryOp.MULTIPLY: {
        if (isNumeric(left) && isNumeric(right)) {
          return this.arithmetic(
            left,
            right,
            (a, b) => a * b,
            (a, b) => a * b
          );
        }
        // String repetition
        if (typeof left === 'string' && isNumeric(right)) {
          const count = this.repetitions(right, left.length);
          return left.repeat(count);
        }
        // List repetition
        if (Array.isArray(left) && isNumeric(right)) {
          const count = this.repetitions(right, left.length);
          const result: unknown[] = [];
          for (let i = 0; i < count; i++) {
            result.push(...left);
          }
          return result;
        }
        throw new EvaluationError('Invalid operands for multiplication');
      }

      case BinaryOp.DIVIDE: {
        if (isNumeric(left) && isNumeric(right)) {
          if (typeof left === 'number' || typeof right === 'number') {
            // Double division follows IEEE 754, so a zero divisor yields infinity or NaN
            return Number(left) / Number(right);
          }
          if (right === 0n) {
            throw new EvaluationError('Division by zero');
          }
          if (left === INT64_MIN && right === -1n) {
            throw new EvaluationError('Integer overflow');
          }
          return left / right;
        }
        throw new EvaluationError('Division requires numeric operands');
      }

      case BinaryOp.MODULO: {
        if (typeof left === 'bigint' && typeof right === 'bigint') {
          if (right === 0n) {
            throw new EvaluationError('Modulo by zero');
          }
          return left % right;
        }
        throw new EvaluationError('Modulo requires integer operands');
      }

      case BinaryOp.EQUAL:
        return Utilities.equals(left, right);

      case BinaryOp.NOT_EQUAL:
        return !Utilities.equals(left, right);

      case BinaryOp.LESS:
        return this.compare(left, right) < 0;

      case BinaryOp.LESS_EQUAL:
        return this.compare(left, right) <= 0;

      case BinaryOp.GREATER:
        return this.compare(left, right) > 0;

      case BinaryOp.GREATER_EQUAL:
        return this.compare(left, right) >= 0;

      case BinaryOp.IN: {
        if (Array.isArray(right)) {
          return Utilities.containsInArray(right, left);
        }
        if (right instanceof Map) {
          return Utilities.contains(right, left);
        }
        if (typeof right === 'string' && typeof left === 'string') {
          return right.includes(left);
        }
        throw new EvaluationError('IN operator requires list, map, or string on right side');
      }

      default:
        throw new EvaluationError(`Unknown binary operator: ${expr.op}`);
    }
  }

  // Evaluates a logical operator: the absorbing value wins even when the other operand errors
  private combine(expr: Binary, absorbing: boolean): boolean {
    const left = this.attempt(expr.left);
    if (left === absorbing) {
      return absorbing;
    }

    const right = this.attempt(expr.right);
    if (right === absorbing) {
      return absorbing;
    }

    if (left instanceof Error) {
      throw left;
    }
    if (right instanceof Error) {
      throw right;
    }
    if (typeof left !== 'boolean' || typeof right !== 'boolean') {
      const spelling = OPERATOR_SPELLING[expr.op] ?? expr.op;
      throw new EvaluationError(`Logical operator ${spelling} requires boolean operands`);
    }
    return !absorbing;
  }

  // Evaluates an operand, returning the error instead of throwing it
  private attempt(expr: Expression): unknown {
    try {
      return this.evaluate(expr);
    } catch (error) {
      if (isCelError(error)) {
        return error;
      }
      throw error;
    }
  }

  visitConditional(expr: Conditional): unknown {
    const condition = this.evaluate(expr.condition);
    if (typeof condition !== 'boolean') {
      throw new EvaluationError('Conditional requires a boolean condition');
    }
    return condition ? this.evaluate(expr.thenExpr) : this.evaluate(expr.otherwiseExpr);
  }

  visitIndex(expr: Index): unknown {
    const operand = this.evaluate(expr.operand);
    const index = this.evaluate(expr.index);

    if (operand === null || operand === undefined) {
      throw new EvaluationError('Cannot index null value');
    }

    if (Array.isArray(operand)) {
      if (!isNumeric(index)) {
        throw new EvaluationError('List index must be an integer');
      }
      const idx = Number(typeof index === 'number' ? Math.trunc(index) : index);
      if (idx < 0 || idx >= operand.length) {
        throw new EvaluationError(`List index out of bounds: ${idx}`);
      }
      return operand[idx];
    }
    if (operand instanceof Map) {
      if (!Utilities.contains(operand, index)) {
        throw new EvaluationError(`Map key not found: ${Utilities.asString(index)}`);
      }
      return Utilities.select(operand, index);
    }
    if (isBytes(operand)) {
      if (!isNumeric(index)) {
        throw new EvaluationError('Bytes index must be an integer');
      }
      const at = Number(typeof index === 'number' ? Math.trunc(index) : index);
      if (at < 0 || at >= operand.length) {
        throw new EvaluationError(`Bytes index out of bounds: ${at}`);
      }
      return BigInt(operand[at]!);
    }
    if (typeof operand === 'string') {
      if (!isNumeric(index)) {
        throw new EvaluationError('String index must be an integer');
      }
      // Indexed by code point, so a supplementary character is one position and is never split
      const idx = Number(typeof index === 'number' ? Math.trunc(index) : index);
      const offset = idx < 0 ? -1 : Utilities.offsetByCodePoints(operand, idx);
      if (offset < 0 || offset >= operand.length) {
        throw new EvaluationError(`String index out of bounds: ${idx}`);
      }
      return String.fromCodePoint(operand.codePointAt(offset)!);
    }

    throw new EvaluationError(`Cannot index type: ${Utilities.typeOf(operand)}`);
  }

  // Validates a repetition count against the evaluation limit, before anything is allocated
  private repetitions(count: bigint | number, width: number): number {
    const repeats = typeof count === 'bigint' ? count : BigInt(Math.trunc(count));
    if (repeats < 0n) {
      throw new EvaluationError(`Repetition count must not be negative: ${repeats}`);
    }
    // Bounding the count first keeps the product within range
    if (repeats > BigInt(Utilities.LIMIT) || repeats * BigInt(width) > BigInt(Utilities.LIMIT)) {
      throw new EvaluationError(`Repetition exceeds the evaluation limit of ${Utilities.LIMIT}`);
    }
    return Number(repeats);
  }

  // Applies an arithmetic operator: two ints stay exact 64-bit, otherwise both become doubles
  private arithmetic(
    left: bigint | number,
    right: bigint | number,
    ints: (a: bigint, b: bigint) => bigint,
    doubles: (a: number, b: number) => number
  ): bigint | number {
    if (typeof left === 'bigint' && typeof right === 'bigint') {
      return checkInt64(ints(left, right));
    }
    return doubles(Number(left), Number(right));
  }

  // Ordering for the relational operators
  private compare(left: unknown, right: unknown): number {
    if ((left === null || left === undefined) && (right === null || right === undefined)) {
      return 0;
    }
    if (left === null || left === undefined) {
      return -1;
    }
    if (right === null || right === undefined) {
      return 1;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      const size = Math.min(left.length, right.length);
      for (let i = 0; i < size; i++) {
        const cmp = this.compare(left[i], right[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return left.length - right.length;
    }

    try {
      return Utilities.compare(left, right);
    } catch (error) {
      if (isCelError(error)) {
        throw new EvaluationError(
          `Cannot compare types: ${Utilities.typeOf(left)} and ${Utilities.typeOf(right)}`
        );
      }
      throw error;
    }
  }
}
