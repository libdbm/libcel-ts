import { Expression } from './ast/index.js';
import { Functions } from './functions/index.js';
import { Interpreter } from './interpreter/index.js';

/**
 * A compiled CEL program that can be evaluated multiple times.
 *
 * A Program represents a parsed CEL expression that can be efficiently evaluated
 * with different sets of variables. This is more efficient than parsing the
 * expression each time it needs to be evaluated.
 *
 * Programs are created using CEL.compile() and should be reused when the same
 * expression needs to be evaluated multiple times.
 *
 * @example
 * ```typescript
 * const program = cel.compile('price * quantity');
 * const result1 = program.evaluate({ price: 10, quantity: 5 });
 * const result2 = program.evaluate({ price: 20, quantity: 3 });
 * ```
 */
export class Program {
  /**
   * Creates a new compiled program.
   *
   * This constructor is typically called by CEL.compile() and should not be used directly.
   *
   * @param ast The abstract syntax tree of the compiled expression
   * @param functions The function library to use for evaluation
   */
  constructor(
    private readonly ast: Expression,
    private readonly functions: Functions
  ) {}

  /**
   * Evaluates the compiled program with the given variables.
   *
   * @param variables A map of variable names to their values
   * @returns The result of evaluating the expression
   * @throws EvaluationError if an error occurs during evaluation
   *
   * @example
   * ```typescript
   * const result = program.evaluate({
   *   x: 10,
   *   y: 20,
   *   items: [1, 2, 3]
   * });
   * ```
   */
  evaluate(variables: Record<string, any> = {}): any {
    const interpreter = new Interpreter({ ...variables }, this.functions);
    return interpreter.evaluate(this.ast);
  }
}
