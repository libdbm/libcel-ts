export { EvaluationError, ArgumentError } from '../errors.js';

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
   * Reports whether this library provides a qualified global function with the given name.
   *
   * The interpreter uses this to resolve namespaced calls such as `math.greatest(1, 2)`,
   * which would otherwise be parsed as a field selection followed by a method call. Only
   * names that are not shadowed by a bound variable are ever tested. Implementations that
   * omit this method provide no namespaced functions.
   *
   * @param name The qualified function name, for example "math.greatest"
   * @returns true if the name should be dispatched to callFunction
   */
  knows?(name: string): boolean;

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
