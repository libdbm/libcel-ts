/**
 * Error thrown by the interpreter when an expression cannot be evaluated.
 *
 * Covers undefined variables, type mismatches in operators, division by zero,
 * integer overflow and evaluation limits.
 */
export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Error thrown when a function receives an argument it cannot accept.
 *
 * This is the analogue of Java's IllegalArgumentException: wrong arity, an
 * unsupported type, an out-of-range index or an unparsable literal. The logical
 * operators absorb this error alongside EvaluationError.
 */
export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

/**
 * Reports whether an error is one of the CEL error types that the logical
 * operators may absorb.
 *
 * @param error The caught value
 * @returns true for EvaluationError and ArgumentError
 */
export function isCelError(error: unknown): error is EvaluationError | ArgumentError {
  return error instanceof EvaluationError || error instanceof ArgumentError;
}
