import { Functions, EvaluationError } from './functions.js';
import * as Utilities from './utilities.js';

/**
 * Standard CEL function library implementation.
 *
 * Provides all built-in CEL functions including:
 * - Type conversions: int(), double(), string(), bool()
 * - Type checking: type()
 * - Collection operations: size(), has()
 * - String operations: contains(), startsWith(), endsWith(), matches()
 * - Math operations: max(), min()
 *
 * This class can be extended to add custom functions while retaining
 * all standard CEL functionality.
 */
export class StandardFunctions implements Functions {
  callFunction(name: string, args: any[]): any {
    switch (name) {
      case 'size':
        return Utilities.sizeOf(args[0]);
      case 'int':
        return Utilities.asInt(args[0]);
      case 'uint':
        return Utilities.asUInt(args[0]);
      case 'double':
        return Utilities.asDouble(args[0]);
      case 'string':
        return Utilities.asString(args[0]);
      case 'bool':
        return Utilities.asBool(args[0]);
      case 'type':
        return Utilities.typeOf(args[0]);
      case 'has':
        if (args.length !== 2) {
          throw new Error('has() requires 2 arguments');
        }
        return Utilities.has(args[0], args[1]);
      case 'matches':
        if (args.length !== 2) {
          throw new Error('matches() requires 2 arguments');
        }
        return Utilities.matches(args[0] as string, args[1] as string);
      case 'max':
        return Utilities.max(args);
      case 'min':
        return Utilities.min(args);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  callMethod(target: any, method: string, args: any[]): any {
    if (target === null || target === undefined) {
      throw new Error('Cannot call method on null');
    }

    switch (method) {
      case 'contains':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.includes(args[0]);
        } else if (Array.isArray(target) && args.length === 1) {
          return target.includes(args[0]);
        }
        throw new Error('Invalid arguments for contains()');

      case 'startsWith':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.startsWith(args[0]);
        }
        throw new Error('startsWith() requires string target and argument');

      case 'endsWith':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.endsWith(args[0]);
        }
        throw new Error('endsWith() requires string target and argument');

      case 'toLowerCase':
        if (typeof target === 'string' && args.length === 0) {
          return target.toLowerCase();
        }
        throw new Error('toLowerCase() requires string target');

      case 'toUpperCase':
        if (typeof target === 'string' && args.length === 0) {
          return target.toUpperCase();
        }
        throw new Error('toUpperCase() requires string target');

      case 'trim':
        if (typeof target === 'string' && args.length === 0) {
          return target.trim();
        }
        throw new Error('trim() requires string target');

      case 'replace':
        if (
          typeof target === 'string' &&
          args.length === 2 &&
          typeof args[0] === 'string' &&
          typeof args[1] === 'string'
        ) {
          // Note: JavaScript replace() only replaces first occurrence by default
          // Use replaceAll() or split/join for all occurrences
          return target.replaceAll(args[0], args[1]);
        }
        throw new Error('replace() requires string target and 2 string arguments');

      case 'split':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          // CEL split uses literal string matching, not regex
          return target.split(args[0]);
        }
        throw new Error('split() requires string target and separator');

      case 'size':
        return Utilities.sizeOf(target);

      // Macro functions are handled in the interpreter with special logic
      case 'map':
      case 'filter':
      case 'all':
      case 'exists':
      case 'existsOne':
        throw new EvaluationError(
          `Macro function ${method} was not properly handled by the interpreter`
        );

      default:
        // Try to call native JavaScript method
        return this.callNativeMethod(target, method, args);
    }
  }

  /**
   * Attempts to call a native JavaScript method on the target object.
   *
   * @param target The object to call the method on
   * @param name The method name
   * @param args The arguments
   * @returns The result of the method call
   * @throws Error if the method doesn't exist or call fails
   */
  private callNativeMethod(target: any, name: string, args: any[]): any {
    if (typeof target[name] === 'function') {
      try {
        return target[name](...args);
      } catch (e) {
        throw new EvaluationError(
          `Invocation of method '${name}' failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    throw new Error(
      `No such method '${name}' on type ${typeof target} with ${args.length} argument(s)`
    );
  }
}
