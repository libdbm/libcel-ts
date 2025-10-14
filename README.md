# libcel-ts - Common Expression Language for TypeScript

A complete TypeScript implementation of Google's [Common Expression Language (CEL)](https://github.com/google/cel-spec) specification, ported from the Java implementation.

## Overview

CEL is a non-Turing complete expression language designed for simplicity, speed, and safety. It's commonly used for evaluating user-provided expressions in a secure sandbox environment.

## Features

- **Complete CEL Implementation**: All CEL operators, functions, and macros
- **Type Safe**: Leverages TypeScript's type system with strict typing
- **High Performance**: Hand-written recursive descent parser with AST compilation
- **Extensible**: Easy to add custom functions
- **Well Tested**: 100+ comprehensive tests ensuring functional equivalence
- **Zero External Dependencies**: Pure TypeScript implementation (except dev dependencies)
- **Vite-Powered**: Modern tooling with fast builds and excellent DX

## Installation

```bash
npm install libcel-ts
# or
pnpm add libcel-ts
# or
yarn add libcel-ts
```

## Quick Start

### Basic Usage

```typescript
import { CEL } from 'libcel-ts';

const cel = new CEL();

// Simple expression evaluation
console.log(cel.eval('2 + 3 * 4', {})); // 14

// Using variables
const vars = { name: 'Alice', age: 30 };
console.log(cel.eval('name + " is " + string(age) + " years old"', vars));
// Output: Alice is 30 years old

// Boolean logic
console.log(cel.eval('age >= 18 && age < 65', vars)); // true
```

### Compiling and Reusing Programs

For better performance when evaluating the same expression multiple times:

```typescript
const cel = new CEL();
const program = cel.compile('price * quantity * (1 - discount)');

// Reuse with different variables
const result1 = program.evaluate({ price: 10, quantity: 5, discount: 0.1 });
const result2 = program.evaluate({ price: 20, quantity: 3, discount: 0.2 });
```

### Working with Complex Data

```typescript
const cel = new CEL();
const data = {
  user: {
    name: 'Alice',
    roles: ['admin', 'user'],
    metadata: { active: true },
  },
  permissions: ['read', 'write', 'delete'],
};

// Check complex conditions
const canDelete = cel.eval('"admin" in user.roles && "delete" in permissions', data);
// true

// Use macro functions
const users = [
  { name: 'Alice', active: true },
  { name: 'Bob', active: false },
  { name: 'Charlie', active: true },
];

const activeNames = cel.eval('users.filter(u, u.active).map(u, u.name)', { users });
// ['Alice', 'Charlie']
```

### Custom Functions

Extend the standard library with custom functions:

```typescript
import { CEL, StandardFunctions } from 'libcel-ts';

class CustomFunctions extends StandardFunctions {
  callFunction(name: string, args: any[]): any {
    if (name === 'reverse') {
      return (args[0] as string).split('').reverse().join('');
    }
    return super.callFunction(name, args);
  }
}

const cel = new CEL(new CustomFunctions());
console.log(cel.eval("reverse('hello')", {})); // "olleh"
```

## Supported Features

### Literals

- Null: `null`
- Booleans: `true`, `false`
- Integers: `42`, `-7`, `0xFF` (hexadecimal)
- Unsigned: `42u`, `0xFFu`
- Doubles: `3.14`, `6.022e23`
- Strings: `"hello"`, `'world'`, `r"raw\nstring"`, `"""multi-line"""`
- Bytes: `b"data"`
- Lists: `[1, 2, 3]`
- Maps: `{"key": "value"}`

### Operators

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Comparison**: `<`, `<=`, `>`, `>=`, `==`, `!=`
- **Logical**: `&&`, `||`, `!`
- **Conditional**: `condition ? trueValue : falseValue`
- **Membership**: `in` (for lists, maps, strings)

### Functions

- **Type conversions**: `int()`, `double()`, `string()`, `bool()`
- **Type checking**: `type()`
- **Collections**: `size()`, `has()`
- **String methods**: `contains()`, `startsWith()`, `endsWith()`, `toLowerCase()`, `toUpperCase()`, `trim()`, `replace()`, `split()`
- **Regex**: `matches()`
- **Math**: `max()`, `min()`

### Macro Functions

```typescript
// map - Transform each element
cel.eval('[1, 2, 3].map(x, x * 2)', {}); // [2, 4, 6]

// filter - Keep elements matching condition
cel.eval('[1, 2, 3, 4].filter(x, x % 2 == 0)', {}); // [2, 4]

// exists - Check if any element matches
cel.eval('[1, 2, 3].exists(x, x > 2)', {}); // true

// all - Check if all elements match
cel.eval('[1, 2, 3].all(x, x > 0)', {}); // true

// existsOne - Check if exactly one element matches
cel.eval('[1, 2, 3].existsOne(x, x == 2)', {}); // true
```

## Building

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the library
npm run build

# Type check
npm run typecheck

# Lint and format
npm run lint
npm run format
```

## Testing

The project includes comprehensive test coverage:

- 32 parser tests
- 21 interpreter tests
- 50 integration tests
- All tests from the Java implementation ported and passing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Architecture

- **expression.ts**: Abstract Syntax Tree (AST) with visitor pattern
- **parser.ts**: Hand-written recursive descent parser with integrated lexer
- **interpreter.ts**: AST evaluator using Visitor pattern
- **functions.ts**: Extensible function library
- **cel.ts**: Main API entry point
- **program.ts**: Compiled, reusable programs

## Functional Equivalence

This TypeScript implementation is functionally equivalent to the [Java libcel](https://github.com/libdbm/libcel-java) implementation:

- Same AST structure and expression types
- Identical parsing rules and operator precedence
- Same evaluation semantics
- Equivalent macro function behavior
- Compatible error handling

All tests from the Java version have been ported to ensure equivalence.

## Requirements

- Node.js 18+ or modern browser
- TypeScript 5.0+ (for development)

## API Documentation

### CEL Class

```typescript
class CEL {
  constructor(functions?: Functions | null);
  compile(expression: string): Program;
  eval(expression: string, variables?: Record<string, any>): any;

  static compile(expression: string, functions: Functions): Program;
  static eval(expression: string, functions: Functions, variables: Record<string, any>): any;
}
```

### Program Class

```typescript
class Program {
  evaluate(variables?: Record<string, any>): any;
}
```

### Functions Interface

```typescript
interface Functions {
  callFunction(name: string, args: any[]): any;
  callMethod(target: any, method: string, args: any[]): any;
}
```

## Examples

See the [examples](./examples) directory for more detailed examples:

- [quickstart.ts](./examples/quickstart.ts) - Comprehensive usage examples
- [parser-example.ts](./examples/parser-example.ts) - Parser API demonstration
- [interpreter-example.ts](./examples/interpreter-example.ts) - Interpreter API demonstration

## License

BSD 3-Clause License - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Based on the [Common Expression Language](https://github.com/google/cel-spec) specification by Google
- Ported from the [Java libcel](https://github.com/libdbm/libcel-java) implementation
- Original [Dart libcel](https://pub.dev/packages/libcel) implementation

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Links

- [CEL Specification](https://github.com/google/cel-spec)
- [Java Implementation](https://github.com/libdbm/libcel-java)
- [Dart Implementation](https://pub.dev/packages/libcel)
