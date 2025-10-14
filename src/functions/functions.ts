/**
 * Exception thrown during CEL expression evaluation.
 */
export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Interface for providing functions to CEL expressions.
 *
 * Implement this interface to provide custom functions that can be called
 * from CEL expressions. The StandardFunctions class provides all standard
 * CEL functions and can be extended for custom functionality.
 *
 * @example
 * ```typescript
 * class MyFunctions extends StandardFunctions {
 *   callFunction(name: string, args: any[]): any {
 *     if (name === 'customFunc') {
 *       return myCustomImplementation(args);
 *     }
 *     return super.callFunction(name, args);
 *   }
 * }
 * ```
 */
export interface Functions {
  /**
   * Calls a global function by name.
   *
   * @param name The name of the function to call
   * @param args The arguments to pass to the function
   * @returns The result of the function call
   * @throws Error if the function is not found or if the arguments are invalid
   */
  callFunction(name: string, args: any[]): any;

  /**
   * Calls a method on a target object.
   *
   * @param target The object to call the method on
   * @param method The name of the method to call
   * @param args The arguments to pass to the method
   * @returns The result of the method call
   * @throws Error if the method is not found or if the arguments are invalid
   */
  callMethod(target: any, method: string, args: any[]): any;
}
