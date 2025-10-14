import { Parser } from './parser/index.js';
import { Functions, StandardFunctions } from './functions/index.js';
import { Program } from './program.js';

/**
 * The main entry point for evaluating CEL expressions.
 *
 * The CEL class provides methods to compile and evaluate CEL expressions.
 * It supports all standard CEL operators, functions, and macros.
 *
 * @example
 * ```typescript
 * const cel = new CEL();
 * const result = cel.eval('x * 2 + y', { x: 10, y: 5 });
 * console.log(result); // 25
 * ```
 */
export class CEL {
  private readonly functions: Functions;

  /**
   * Creates a new CEL evaluator with the standard function library.
   */
  constructor();

  /**
   * Creates a new CEL evaluator.
   *
   * @param functions Optional custom function library. If not provided, the standard
   *                  CEL function library will be used.
   */
  constructor(functions?: Functions | null);

  constructor(functions?: Functions | null) {
    this.functions = functions ?? new StandardFunctions();
  }

  /**
   * Compiles a CEL expression using the provided function library.
   *
   * This static convenience method avoids the need to instantiate CEL when
   * callers just need to compile once.
   *
   * @param expression The CEL expression to compile
   * @param functions The function library to use when compiling the program
   * @returns A compiled Program using the provided functions
   * @throws ParseError if the expression is invalid
   *
   * @example
   * ```typescript
   * const program = CEL.compile('x + y', new StandardFunctions());
   * ```
   */
  static compile(expression: string, functions: Functions): Program {
    const parser = new Parser(expression);
    return new Program(parser.parse(), functions);
  }

  /**
   * Evaluates a CEL expression with the given variables using the provided function library.
   *
   * This static convenience method avoids the need to instantiate CEL when callers
   * just need to evaluate an expression once.
   *
   * @param expression The CEL expression to evaluate
   * @param functions The function library to use when evaluating the expression
   * @param variables A map of variable names to their values
   * @returns The result of evaluating the expression
   * @throws ParseError if the expression is invalid
   * @throws EvaluationError if an error occurs during evaluation
   *
   * @example
   * ```typescript
   * const result = CEL.eval('x * 2', new StandardFunctions(), { x: 5 });
   * ```
   */
  static eval(expression: string, functions: Functions, variables: Record<string, any>): any {
    const program = this.compile(expression, functions);
    return program.evaluate(variables);
  }

  /**
   * Compiles a CEL expression into a reusable program.
   *
   * This method parses the expression and returns a Program that can be evaluated
   * multiple times with different variables. This is more efficient than calling
   * eval() repeatedly with the same expression.
   *
   * @param expression The CEL expression to compile
   * @returns A compiled program
   * @throws ParseError if the expression is invalid
   *
   * @example
   * ```typescript
   * const program = cel.compile('price * quantity');
   * const result1 = program.evaluate({ price: 10, quantity: 5 });
   * const result2 = program.evaluate({ price: 20, quantity: 3 });
   * ```
   */
  compile(expression: string): Program {
    return CEL.compile(expression, this.functions);
  }

  /**
   * Evaluates a CEL expression with the given variables.
   *
   * This is a convenience method that compiles and evaluates the expression in one step.
   * For better performance when evaluating the same expression multiple times, use
   * compile() to create a reusable Program.
   *
   * @param expression The CEL expression to evaluate
   * @param variables A map of variable names to their values
   * @returns The result of evaluating the expression
   * @throws ParseError if the expression is invalid
   * @throws EvaluationError if an error occurs during evaluation
   *
   * @example
   * ```typescript
   * const result = cel.eval('user.age >= 18', {
   *   user: { name: 'Alice', age: 25 }
   * });
   * ```
   */
  eval(expression: string, variables: Record<string, any> = {}): any {
    return CEL.eval(expression, this.functions, variables);
  }
}
