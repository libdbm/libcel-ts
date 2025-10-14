/**
 * Functions module for CEL expressions.
 *
 * This module exports the Functions interface, StandardFunctions implementation,
 * utility helpers, and error types for function evaluation.
 */

export type { Functions } from './functions.js';
export { EvaluationError } from './functions.js';
export { StandardFunctions } from './standard-functions.js';
import * as Utilities from './utilities.js';
export { Utilities };
