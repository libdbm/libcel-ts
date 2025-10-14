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
import { Functions, EvaluationError } from '../functions/functions.js';
import { StandardFunctions } from '../functions/standard-functions.js';
import * as Utilities from '../functions/utilities.js';

/**
 * Interpreter for evaluating CEL expressions.
 *
 * Implements the Visitor pattern to traverse and evaluate the AST produced by the parser.
 * Supports all CEL operations including macros, type conversions, and complex expressions.
 */
export class Interpreter implements Visitor<any> {
  private readonly variables: Record<string, any>;
  private readonly functions: Functions;

  /**
   * Constructs an interpreter with the specified variables and functions.
   *
   * @param variables A map of variable names to their values. If null, an empty object is used.
   * @param functions An instance of Functions to handle function calls. If null, StandardFunctions is used.
   */
  constructor(variables?: Record<string, any> | null, functions?: Functions | null) {
    this.variables = variables ?? {};
    this.functions = functions ?? new StandardFunctions();
  }

  /**
   * Evaluates a CEL expression and returns its result.
   *
   * @param expr The expression to evaluate
   * @returns The result of the evaluation
   * @throws EvaluationError if evaluation fails
   */
  evaluate(expr: Expression): any {
    return expr.accept(this);
  }

  visitLiteral(expr: Literal): any {
    // In CEL, byte literals are just strings marked as bytes
    return expr.value;
  }

  visitIdentifier(expr: Identifier): any {
    if (!(expr.name in this.variables)) {
      throw new EvaluationError(`Undefined variable: ${expr.name}`);
    }
    return this.variables[expr.name];
  }

  visitSelect(expr: Select): any {
    const target = expr.operand !== null ? this.evaluate(expr.operand) : this.variables;

    if (target === null || target === undefined) {
      if (expr.isTest) {
        return false;
      }
      throw new EvaluationError(`Cannot select field ${expr.field} from null`);
    }

    if (typeof target === 'object') {
      if (expr.isTest) {
        return expr.field in target;
      }
      if (!(expr.field in target)) {
        throw new EvaluationError(`Field ${expr.field} not found`);
      }
      return target[expr.field];
    }

    throw new EvaluationError('Cannot select field from non-object type');
  }

  visitCall(expr: Call): any {
    // For macro calls, we need special handling
    if (expr.isMacro && expr.target !== null) {
      const target = this.evaluate(expr.target);

      // For macros, we pass the AST expressions, not evaluated values
      if (expr.args.length === 0) {
        throw new EvaluationError(`Macro ${expr.functionName} requires arguments`);
      }

      // Extract variable name from first argument
      const firstArg = expr.args[0]!;
      if (!(firstArg instanceof Identifier)) {
        throw new EvaluationError(
          `First argument to macro ${expr.functionName} must be a variable name`
        );
      }
      const variableName = firstArg.name;

      // Second argument is the expression (kept as AST)
      if (expr.args.length < 2) {
        throw new EvaluationError(`Macro ${expr.functionName} requires an expression argument`);
      }
      const macroExpr = expr.args[1]!;

      // Handle each macro function
      return this.evaluateMacro(target, expr.functionName, variableName, macroExpr);
    }

    // Regular function call - evaluate all arguments
    const args: any[] = [];
    for (const arg of expr.args) {
      args.push(this.evaluate(arg));
    }

    if (expr.target !== null) {
      const target = this.evaluate(expr.target);
      return this.functions.callMethod(target, expr.functionName, args);
    } else {
      return this.functions.callFunction(expr.functionName, args);
    }
  }

  private evaluateMacro(target: any, functionName: string, variableName: string, expr: Expression): any {
    if (!Array.isArray(target)) {
      throw new EvaluationError(`Macro ${functionName} requires a list target`);
    }

    // Save the current value of the variable (if any)
    const saved = this.variables[variableName];
    const had = variableName in this.variables;

    try {
      switch (functionName) {
        case 'map': {
          const results: any[] = [];
          for (const item of target) {
            this.variables[variableName] = item;
            results.push(this.evaluate(expr));
          }
          return results;
        }

        case 'filter': {
          const results: any[] = [];
          for (const item of target) {
            this.variables[variableName] = item;
            const condition = this.evaluate(expr);
            if (condition === true) {
              results.push(item);
            }
          }
          return results;
        }

        case 'all': {
          for (const item of target) {
            this.variables[variableName] = item;
            const condition = this.evaluate(expr);
            if (condition !== true) {
              return false;
            }
          }
          return true;
        }

        case 'exists': {
          for (const item of target) {
            this.variables[variableName] = item;
            const condition = this.evaluate(expr);
            if (condition === true) {
              return true;
            }
          }
          return false;
        }

        case 'existsOne': {
          let count = 0;
          for (const item of target) {
            this.variables[variableName] = item;
            const condition = this.evaluate(expr);
            if (condition === true) {
              count++;
              if (count > 1) {
                return false;
              }
            }
          }
          return count === 1;
        }

        default:
          throw new EvaluationError(`Unknown macro function: ${functionName}`);
      }
    } finally {
      // Restore the original value of the variable
      if (had) {
        this.variables[variableName] = saved;
      } else {
        delete this.variables[variableName];
      }
    }
  }

  visitList(expr: ListExpression): any {
    const result: any[] = [];
    for (const element of expr.elements) {
      result.push(this.evaluate(element));
    }
    return result;
  }

  visitMap(expr: MapExpression): any {
    const map: Record<string, any> = {};
    for (const entry of expr.entries) {
      const key = this.evaluate(entry.key);
      const value = this.evaluate(entry.value);
      map[key] = value;
    }
    return map;
  }

  visitStruct(expr: Struct): any {
    const map: Record<string, any> = {};
    for (const field of expr.fields) {
      map[field.field] = this.evaluate(field.value);
    }
    return map;
  }

  visitComprehension(expr: Comprehension): any {
    const range = this.evaluate(expr.range);
    if (!Array.isArray(range)) {
      throw new EvaluationError('Comprehension range must be a list');
    }

    const iteratorSaved = this.variables[expr.variable];
    const accumulatorSaved = this.variables[expr.accumulator];
    const hadIterator = expr.variable in this.variables;
    const hadAccumulator = expr.accumulator in this.variables;

    try {
      let accumulator = this.evaluate(expr.initializer);
      this.variables[expr.accumulator] = accumulator;

      for (const item of range) {
        this.variables[expr.variable] = item;

        const condition = this.evaluate(expr.condition);
        if (condition !== true) {
          continue;
        }

        accumulator = this.evaluate(expr.step);
        this.variables[expr.accumulator] = accumulator;
      }

      return this.evaluate(expr.result);
    } finally {
      // Restore the original values
      if (hadIterator) {
        this.variables[expr.variable] = iteratorSaved;
      } else {
        delete this.variables[expr.variable];
      }
      if (hadAccumulator) {
        this.variables[expr.accumulator] = accumulatorSaved;
      } else {
        delete this.variables[expr.accumulator];
      }
    }
  }

  visitUnary(expr: Unary): any {
    const operand = this.evaluate(expr.operand);

    switch (expr.op) {
      case UnaryOp.NOT:
        if (typeof operand !== 'boolean') {
          throw new EvaluationError('NOT operator requires boolean operand');
        }
        return !operand;

      case UnaryOp.NEGATE:
        if (typeof operand !== 'number') {
          throw new EvaluationError('Negation requires numeric operand');
        }
        return -operand;

      default:
        throw new EvaluationError(`Unknown unary operator: ${expr.op}`);
    }
  }

  visitBinary(expr: Binary): any {
    // Short-circuit evaluation for logical operators
    if (expr.op === BinaryOp.LOGICAL_AND) {
      const left = this.evaluate(expr.left);
      if (left !== true) {
        return false;
      }
      return this.evaluate(expr.right) === true;
    } else if (expr.op === BinaryOp.LOGICAL_OR) {
      const left = this.evaluate(expr.left);
      if (left === true) {
        return true;
      }
      return this.evaluate(expr.right) === true;
    }

    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);

    switch (expr.op) {
      case BinaryOp.ADD:
        // String concatenation
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        // Array concatenation
        if (Array.isArray(left) && Array.isArray(right)) {
          return [...left, ...right];
        }
        // Numeric addition
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        throw new EvaluationError('Invalid operands for addition');

      case BinaryOp.SUBTRACT:
        if (typeof left === 'number' && typeof right === 'number') {
          return left - right;
        }
        throw new EvaluationError('Subtraction requires numeric operands');

      case BinaryOp.MULTIPLY:
        if (typeof left === 'number' && typeof right === 'number') {
          return left * right;
        }
        // String repetition
        if (typeof left === 'string' && typeof right === 'number') {
          return left.repeat(right);
        }
        // Array repetition
        if (Array.isArray(left) && typeof right === 'number') {
          const result: any[] = [];
          for (let i = 0; i < right; i++) {
            result.push(...left);
          }
          return result;
        }
        throw new EvaluationError('Invalid operands for multiplication');

      case BinaryOp.DIVIDE:
        if (typeof left === 'number' && typeof right === 'number') {
          if (right === 0) {
            throw new EvaluationError('Division by zero');
          }
          // Division always returns double in CEL
          return left / right;
        }
        throw new EvaluationError('Division requires numeric operands');

      case BinaryOp.MODULO:
        if (typeof left === 'number' && typeof right === 'number') {
          if (right === 0) {
            throw new EvaluationError('Modulo by zero');
          }
          return left % right;
        }
        throw new EvaluationError('Modulo requires integer operands');

      case BinaryOp.EQUAL:
        return Utilities.deepEquals(left, right);

      case BinaryOp.NOT_EQUAL:
        return !Utilities.deepEquals(left, right);

      case BinaryOp.LESS:
        return Utilities.compare(left, right) < 0;

      case BinaryOp.LESS_EQUAL:
        return Utilities.compare(left, right) <= 0;

      case BinaryOp.GREATER:
        return Utilities.compare(left, right) > 0;

      case BinaryOp.GREATER_EQUAL:
        return Utilities.compare(left, right) >= 0;

      case BinaryOp.IN:
        if (Array.isArray(right)) {
          return Utilities.containsInArray(right, left);
        } else if (typeof right === 'object' && right !== null) {
          return left in right;
        } else if (typeof right === 'string' && typeof left === 'string') {
          return right.includes(left);
        }
        throw new EvaluationError('IN operator requires list, map, or string on right side');

      default:
        throw new EvaluationError(`Unknown binary operator: ${expr.op}`);
    }
  }

  visitConditional(expr: Conditional): any {
    const condition = this.evaluate(expr.condition);
    if (condition === true) {
      return this.evaluate(expr.thenExpr);
    } else {
      return this.evaluate(expr.otherwiseExpr);
    }
  }

  visitIndex(expr: Index): any {
    const operand = this.evaluate(expr.operand);
    const index = this.evaluate(expr.index);

    if (operand === null || operand === undefined) {
      throw new EvaluationError('Cannot index null value');
    }

    if (Array.isArray(operand)) {
      if (typeof index !== 'number') {
        throw new EvaluationError('List index must be an integer');
      }
      const idx = Math.trunc(index);
      if (idx < 0 || idx >= operand.length) {
        throw new EvaluationError(`List index out of bounds: ${idx}`);
      }
      return operand[idx];
    } else if (typeof operand === 'object') {
      if (!(index in operand)) {
        throw new EvaluationError(`Map key not found: ${index}`);
      }
      return operand[index];
    } else if (typeof operand === 'string') {
      if (typeof index !== 'number') {
        throw new EvaluationError('String index must be an integer');
      }
      const idx = Math.trunc(index);
      if (idx < 0 || idx >= operand.length) {
        throw new EvaluationError(`String index out of bounds: ${idx}`);
      }
      return operand[idx];
    }

    throw new EvaluationError(`Cannot index type: ${typeof operand}`);
  }
}
