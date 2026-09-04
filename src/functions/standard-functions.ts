import { Functions, EvaluationError, ArgumentError } from './functions.js';
import * as Utilities from './utilities.js';
import * as Strings from './strings.js';
import * as Regexes from './regexes.js';
import * as Lists from './lists.js';
import * as Sets from './sets.js';
import * as Maths from './maths.js';
import * as Codecs from './codecs.js';

/**
 * Names of the namespaced functions this library provides, such as `math.abs`.
 */
const QUALIFIED: ReadonlySet<string> = new Set<string>([
  'math.greatest',
  'math.least',
  'math.abs',
  'math.ceil',
  'math.floor',
  'math.round',
  'math.trunc',
  'math.sign',
  'math.sqrt',
  'math.isNaN',
  'math.isInf',
  'math.isFinite',
  'math.bitAnd',
  'math.bitOr',
  'math.bitXor',
  'math.bitNot',
  'math.bitShiftLeft',
  'math.bitShiftRight',
  'sets.contains',
  'sets.equivalent',
  'sets.intersects',
  'base64.encode',
  'base64.decode',
  'lists.range',
  'strings.quote',
  'regex.replace',
  'regex.extract',
  'regex.extractAll',
]);

const MACROS = new Set(['map', 'filter', 'all', 'exists', 'existsOne', 'sortBy']);

const TIME_ACCESSORS = new Set([
  'getDate',
  'getMonth',
  'getFullYear',
  'getHours',
  'getMinutes',
  'getSeconds',
  'getMilliseconds',
  'getDayOfWeek',
  'getDayOfYear',
]);

/**
 * Checks the argument count of a function call.
 *
 * @throws ArgumentError if the count is outside [least, most]
 */
export function require(name: string, args: unknown[], least: number, most: number): void {
  if (args.length < least || args.length > most) {
    throw new ArgumentError(
      `${name}() requires ${least === most ? least : `${least} to ${most}`} argument(s)`
    );
  }
}

/** Returns the optional time-zone argument of a timestamp accessor. */
function zone(args: unknown[]): unknown {
  return args.length > 1 ? args[1] : null;
}

/**
 * Requires a string argument.
 *
 * @throws ArgumentError if the value is not a string
 */
export function text(value: unknown, name: string): string {
  if (typeof value === 'string') {
    return value;
  }
  throw new ArgumentError(`${name}() requires string arguments`);
}

/**
 * Requires a list argument.
 *
 * @throws ArgumentError if the value is not a list
 */
export function list(value: unknown, name: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new ArgumentError(`${name}() requires a list`);
}

function single(name: string, args: unknown[], operation: (value: unknown) => unknown): unknown {
  require(name, args, 1, 1);
  return operation(args[0]);
}

function pair(
  name: string,
  args: unknown[],
  operation: (left: unknown, right: unknown) => unknown
): unknown {
  require(name, args, 2, 2);
  return operation(args[0], args[1]);
}

/**
 * Standard CEL function library implementation.
 *
 * Provides all built-in CEL functions including:
 * - Type conversions: int(), uint(), double(), string(), bool(), bytes(), dyn()
 * - Type checking: type()
 * - Collection operations: size(), has()
 * - String operations: contains(), startsWith(), endsWith(), matches()
 * - Date/time: timestamp(), duration() and the getXxx() accessors
 * - Math operations: max(), min()
 *
 * This class can be extended to add custom functions while retaining
 * all standard CEL functionality.
 */
export class StandardFunctions implements Functions {
  knows(name: string): boolean {
    return QUALIFIED.has(name);
  }

  callFunction(name: string, args: unknown[]): unknown {
    if (name.indexOf('.') > 0) {
      return this.callQualified(name, args);
    }

    switch (name) {
      case 'size':
        require(name, args, 1, 1);
        return Utilities.sizeOf(args[0]);
      case 'int':
        require(name, args, 1, 1);
        return Utilities.asInt(args[0]);
      case 'uint':
        require(name, args, 1, 1);
        return Utilities.asUInt(args[0]);
      case 'double':
        require(name, args, 1, 1);
        return Utilities.asDouble(args[0]);
      case 'string':
        require(name, args, 1, 1);
        return Utilities.asString(args[0]);
      case 'bool':
        require(name, args, 1, 1);
        return Utilities.asBool(args[0]);
      case 'type':
        require(name, args, 1, 1);
        return Utilities.typeOf(args[0]);
      case 'has':
        if (args.length !== 2) {
          throw new ArgumentError('has() requires 2 arguments');
        }
        return Utilities.has(args[0], args[1]);
      case 'matches':
        if (args.length !== 2) {
          throw new ArgumentError('matches() requires 2 arguments');
        }
        return Utilities.matches(text(args[0], name), text(args[1], name));
      case 'timestamp':
        require(name, args, 0, 1);
        return Utilities.timestamp(args.length > 0 ? args[0] : null);
      case 'duration':
        require(name, args, 1, 1);
        return Utilities.asDuration(args[0]);
      case 'getDate':
        require(name, args, 1, 2);
        return Utilities.dateOf(args[0], zone(args));
      case 'getMonth':
        require(name, args, 1, 2);
        return Utilities.monthOf(args[0], zone(args));
      case 'getFullYear':
        require(name, args, 1, 2);
        return Utilities.yearOf(args[0], zone(args));
      case 'getHours':
        require(name, args, 1, 2);
        return Utilities.hoursOf(args[0], zone(args));
      case 'getMinutes':
        require(name, args, 1, 2);
        return Utilities.minutesOf(args[0], zone(args));
      case 'getSeconds':
        require(name, args, 1, 2);
        return Utilities.secondsOf(args[0], zone(args));
      case 'getDayOfWeek':
        require(name, args, 1, 2);
        return Utilities.weekdayOf(args[0], zone(args));
      case 'getDayOfYear':
        require(name, args, 1, 2);
        return Utilities.ordinalOf(args[0], zone(args));
      case 'getMilliseconds':
        require(name, args, 1, 2);
        return Utilities.millisecondsOf(args[0], zone(args));
      case 'bytes':
        require(name, args, 1, 1);
        return Utilities.asBytes(args[0]);
      case 'dyn':
        require(name, args, 1, 1);
        return args[0];
      case 'max':
        return Utilities.max(args);
      case 'min':
        return Utilities.min(args);
      default:
        throw new ArgumentError(`Unknown function: ${name}`);
    }
  }

  callMethod(target: unknown, method: string, args: unknown[]): unknown {
    if (target === null || target === undefined) {
      throw new ArgumentError('Cannot call method on null');
    }

    switch (method) {
      case 'contains':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.includes(args[0]);
        } else if (Array.isArray(target) && args.length === 1) {
          return Utilities.containsInArray(target, args[0]);
        }
        throw new ArgumentError('Invalid arguments for contains()');

      case 'startsWith':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.startsWith(args[0]);
        }
        throw new ArgumentError('startsWith() requires string target and argument');

      case 'endsWith':
        if (typeof target === 'string' && args.length === 1 && typeof args[0] === 'string') {
          return target.endsWith(args[0]);
        }
        throw new ArgumentError('endsWith() requires string target and argument');

      case 'toLowerCase':
        if (typeof target === 'string' && args.length === 0) {
          return target.toLowerCase();
        }
        throw new ArgumentError('toLowerCase() requires string target');

      case 'toUpperCase':
        if (typeof target === 'string' && args.length === 0) {
          return target.toUpperCase();
        }
        throw new ArgumentError('toUpperCase() requires string target');

      case 'trim':
        if (typeof target === 'string' && args.length === 0) {
          return target.trim();
        }
        throw new ArgumentError('trim() requires string target');

      case 'replace':
        require(method, args, 2, 3);
        return Strings.replace(
          text(target, method),
          text(args[0], method),
          text(args[1], method),
          args.length > 2 ? Utilities.asInt(args[2]) : -1n
        );

      case 'split':
        require(method, args, 1, 2);
        return Strings.split(
          text(target, method),
          text(args[0], method),
          args.length > 1 ? Utilities.asInt(args[1]) : -1n
        );

      case 'charAt':
        require(method, args, 1, 1);
        return Strings.charAt(text(target, method), Utilities.asInt(args[0]));

      case 'indexOf':
        require(method, args, 1, 2);
        return Strings.indexOf(
          text(target, method),
          text(args[0], method),
          args.length > 1 ? Utilities.asInt(args[1]) : 0n
        );

      case 'lastIndexOf':
        require(method, args, 1, 2);
        return Strings.lastIndexOf(
          text(target, method),
          text(args[0], method),
          args.length > 1 ? Utilities.asInt(args[1]) : undefined
        );

      case 'lowerAscii':
        require(method, args, 0, 0);
        return Strings.lower(text(target, method));

      case 'upperAscii':
        require(method, args, 0, 0);
        return Strings.upper(text(target, method));

      case 'substring':
        require(method, args, 1, 2);
        return Strings.substring(
          text(target, method),
          Utilities.asInt(args[0]),
          args.length > 1 ? Utilities.asInt(args[1]) : undefined
        );

      case 'join':
        require(method, args, 0, 1);
        return Strings.join(list(target, method), args.length > 0 ? text(args[0], method) : '');

      case 'format':
        require(method, args, 1, 1);
        return Strings.format(text(target, method), list(args[0], method));

      case 'matches':
        require(method, args, 1, 1);
        return Utilities.matches(text(target, method), text(args[0], method));

      case 'reverse':
        require(method, args, 0, 0);
        return Array.isArray(target)
          ? Lists.reverse(target)
          : Strings.reverse(text(target, method));

      case 'distinct':
        require(method, args, 0, 0);
        return Lists.distinct(list(target, method));

      case 'flatten':
        require(method, args, 0, 1);
        return Lists.flatten(list(target, method), args.length > 0 ? Utilities.asInt(args[0]) : 1n);

      case 'slice':
        require(method, args, 2, 2);
        return Lists.slice(
          list(target, method),
          Utilities.asInt(args[0]),
          Utilities.asInt(args[1])
        );

      case 'sort':
        require(method, args, 0, 0);
        return Lists.sort(list(target, method));

      case 'first':
        require(method, args, 0, 0);
        return Lists.first(list(target, method));

      case 'last':
        require(method, args, 0, 0);
        return Lists.last(list(target, method));

      case 'size':
        return Utilities.sizeOf(target);

      default:
        if (TIME_ACCESSORS.has(method)) {
          require(method, args, 0, 1);
          return this.callFunction(method, [target, ...args]);
        }
        // Macro functions are handled in the interpreter with special logic
        if (MACROS.has(method)) {
          throw new EvaluationError(
            `Macro function ${method} was not properly handled by the interpreter`
          );
        }
        return this.callNativeMethod(target, method, args);
    }
  }

  /**
   * Dispatches a namespaced function such as `math.abs`.
   *
   * @throws ArgumentError if the name is unknown
   */
  protected callQualified(name: string, args: unknown[]): unknown {
    switch (name) {
      case 'math.greatest':
        return Maths.greatest(args);
      case 'math.least':
        return Maths.least(args);
      case 'math.abs':
        return single(name, args, Maths.abs);
      case 'math.ceil':
        return single(name, args, Maths.ceil);
      case 'math.floor':
        return single(name, args, Maths.floor);
      case 'math.round':
        return single(name, args, Maths.round);
      case 'math.trunc':
        return single(name, args, Maths.trunc);
      case 'math.sign':
        return single(name, args, Maths.sign);
      case 'math.sqrt':
        return single(name, args, Maths.sqrt);
      case 'math.isNaN':
        return single(name, args, Maths.isNaN);
      case 'math.isInf':
        return single(name, args, Maths.isInf);
      case 'math.isFinite':
        return single(name, args, Maths.isFinite);
      case 'math.bitAnd':
        return pair(name, args, Maths.and);
      case 'math.bitOr':
        return pair(name, args, Maths.or);
      case 'math.bitXor':
        return pair(name, args, Maths.xor);
      case 'math.bitNot':
        return single(name, args, Maths.not);
      case 'math.bitShiftLeft':
        return pair(name, args, Maths.left);
      case 'math.bitShiftRight':
        return pair(name, args, Maths.right);
      case 'sets.contains':
        require(name, args, 2, 2);
        return Sets.contains(list(args[0], name), list(args[1], name));
      case 'sets.equivalent':
        require(name, args, 2, 2);
        return Sets.equivalent(list(args[0], name), list(args[1], name));
      case 'sets.intersects':
        require(name, args, 2, 2);
        return Sets.intersects(list(args[0], name), list(args[1], name));
      case 'base64.encode':
        require(name, args, 1, 1);
        return Codecs.encode(args[0]);
      case 'base64.decode':
        require(name, args, 1, 1);
        return Codecs.decode(text(args[0], name));
      case 'lists.range':
        require(name, args, 1, 1);
        return Lists.range(Utilities.asInt(args[0]));
      case 'strings.quote':
        require(name, args, 1, 1);
        return Strings.quote(text(args[0], name));
      case 'regex.replace':
        require(name, args, 3, 4);
        return Regexes.replace(
          text(args[0], name),
          text(args[1], name),
          text(args[2], name),
          args.length > 3 ? Utilities.asInt(args[3]) : -1n
        );
      case 'regex.extract':
        require(name, args, 2, 2);
        return Regexes.extract(text(args[0], name), text(args[1], name));
      case 'regex.extractAll':
        require(name, args, 2, 2);
        return Regexes.extractAll(text(args[0], name), text(args[1], name));
      default:
        throw new ArgumentError(`Unknown function: ${name}`);
    }
  }

  /**
   * Attempts to call a native JavaScript method on the target object.
   *
   * This is the last resort after every named method, the analogue of the Java
   * library's reflective method call.
   *
   * @throws ArgumentError if the method doesn't exist
   * @throws EvaluationError if the call fails
   */
  private callNativeMethod(target: unknown, name: string, args: unknown[]): unknown {
    const candidate = (target as Record<string, unknown>)[name];
    if (typeof candidate === 'function') {
      try {
        return (candidate as (...params: unknown[]) => unknown).apply(target, args);
      } catch (e) {
        throw new EvaluationError(
          `Invocation of method '${name}' failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    throw new ArgumentError(
      `No such method '${name}' on type ${Utilities.typeOf(target)} with ${args.length} argument(s)`
    );
  }
}
