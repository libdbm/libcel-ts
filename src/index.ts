/**
 * libcel-ts - TypeScript implementation of Google's Common Expression Language (CEL)
 *
 * A complete TypeScript implementation of Google's Common Expression Language (CEL)
 * specification, providing a non-Turing complete expression language designed for
 * simplicity, speed, and safety.
 *
 * @example Basic usage
 * ```typescript
 * import { CEL } from 'libcel-ts';
 *
 * const cel = new CEL();
 *
 * // Simple expression evaluation
 * console.log(cel.eval('2 + 3 * 4', {})); // 14
 *
 * // Using variables
 * const vars = { name: 'Alice', age: 30 };
 * console.log(cel.eval('name + " is " + string(age) + " years old"', vars));
 * // Output: Alice is 30 years old
 *
 * // Boolean logic
 * console.log(cel.eval('age >= 18 && age < 65', vars)); // true
 * ```
 *
 * @example Compiling and reusing programs
 * ```typescript
 * const cel = new CEL();
 * const program = cel.compile('price * quantity * (1 - discount)');
 *
 * // Reuse with different variables
 * const result1 = program.evaluate({ price: 10, quantity: 5, discount: 0.1 });
 * const result2 = program.evaluate({ price: 20, quantity: 3, discount: 0.2 });
 * ```
 *
 * @module libcel-ts
 */

// Main API
export { CEL } from './cel.js';
export { Program } from './program.js';

// AST types
export * from './ast/index.js';

// Parser
export { Parser, ParseError } from './parser/index.js';

// Interpreter
export { Interpreter } from './interpreter/index.js';

// Functions
export type { Functions } from './functions/index.js';
export { StandardFunctions, EvaluationError } from './functions/index.js';

// Utilities (optional, for advanced users)
import * as Utilities from './functions/utilities.js';
export { Utilities };
