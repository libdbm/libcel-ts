# libcel-ts - Common Expression Language for TypeScript

A complete TypeScript implementation of Google's [Common Expression Language (CEL)](https://github.com/google/cel-spec) specification, ported from the Java implementation.

## Overview

CEL is a non-Turing complete expression language designed for simplicity, speed, and safety. It's commonly used for evaluating user-provided expressions in a secure sandbox environment.

## Features

- **Complete CEL Implementation**: All CEL operators, functions, and macros
- **Extension Libraries**: strings, lists, sets, math, regex and base64 functions using the cel-go names
- **Round-trip Printing**: render a parsed expression back to CEL source, compact or pretty printed
- **Exact 64-bit Integers**: CEL ints are `bigint`, with overflow detection and exact mixed int/double comparison
- **Type Safe**: Leverages TypeScript's type system with strict typing
- **High Performance**: Hand-written recursive descent parser with AST compilation
- **Extensible**: Easy to add custom functions
- **Well Tested**: 275 comprehensive tests, including a specification conformance suite
- **Zero External Dependencies**: Pure TypeScript implementation, runs in Node and browsers
- **Vite-Powered**: Modern tooling with fast builds and excellent DX

## Installation

```bash
npm install @libdbm/libcel-ts
# or
pnpm add @libdbm/libcel-ts
# or
yarn add @libdbm/libcel-ts
```

## Quick Start

### Basic Usage

```typescript
import { CEL } from '@libdbm/libcel-ts';

const cel = new CEL();

// Simple expression evaluation; CEL ints are JavaScript bigints
console.log(cel.eval('2 + 3 * 4', {})); // 14n

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
const result1 = program.evaluate({ price: 10, quantity: 5, discount: 0.1 }); // 45
const result2 = program.evaluate({ price: 20, quantity: 3, discount: 0.2 }); // 48
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
import { CEL, StandardFunctions } from '@libdbm/libcel-ts';

class CustomFunctions extends StandardFunctions {
  override callFunction(name: string, args: unknown[]): unknown {
    if (name === 'reverse') {
      return Array.from(args[0] as string)
        .reverse()
        .join('');
    }
    return super.callFunction(name, args);
  }
}

const cel = new CEL(new CustomFunctions());
console.log(cel.eval("reverse('hello')", {})); // "olleh"
```

Results returned by custom functions are converted into the CEL value model: plain objects
become maps and `Date` becomes a timestamp. A JavaScript `number` returned by a function is a
CEL double; return a `bigint` to produce a CEL int.

## Value Model

CEL values are represented by JavaScript values as follows.

| CEL type    | Result type                    | Accepted as a variable                                 |
| ----------- | ------------------------------ | ------------------------------------------------------ |
| `int`       | `bigint`                       | `bigint`, or a `number` with an integer value          |
| `uint`      | `bigint` (not a distinct type) | as `int`                                               |
| `double`    | `number`                       | a `number` with a fractional part, `NaN` or infinities |
| `bool`      | `boolean`                      | `boolean`                                              |
| `string`    | `string`                       | `string`                                               |
| `bytes`     | `Uint8Array`                   | `Uint8Array`                                           |
| `list`      | `Array`                        | `Array`                                                |
| `map`       | `Map`                          | `Map`, or a plain object (string keys)                 |
| `null`      | `null`                         | `null` or `undefined`                                  |
| `timestamp` | `Timestamp`                    | `Timestamp` or `Date`                                  |
| `duration`  | `Duration`                     | `Duration`                                             |
| `type`      | `Type`                         | `Type`                                                 |

Variables are normalised when evaluation starts: an integer-valued `number` such as `30` is a
CEL int, so `age / 7` truncates. Write `double(age)` in the expression when a double is wanted,
or pass a value with a fractional part. Map literals evaluate to `Map`, and maps may use keys
of any type; a key stored as `1` matches a probe of `1.0`.

`bigint` results cannot be passed to `JSON.stringify` directly; supply a replacer such as
`(_, v) => (typeof v === 'bigint' ? Number(v) : v)`.

## Supported Features

### Literals

- Null: `null`
- Booleans: `true`, `false`
- Integers: `42`, `-7`, `0xFF` (hexadecimal)
- Unsigned: `42u`, `0xFFu`
- Doubles: `3.14`, `6.022e23`
- Strings: `"hello"`, `'world'`, `r"raw\nstring"`, `"""multi-line"""`
- Bytes: `b"data"`, `b"\x00\xff"`
- Lists: `[1, 2, 3]`
- Maps: `{"key": "value"}`

### Operators

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Comparison**: `<`, `<=`, `>`, `>=`, `==`, `!=`, compared exactly across int and double, so an
  int beyond the range a double can represent is not mistaken for the double it would round to
- **Logical**: `&&`, `||`, `!`
- **Conditional**: `condition ? trueValue : falseValue`
- **Membership**: `in` (for lists, maps, strings)

### Functions

- **Type conversions**: `int()`, `uint()`, `double()`, `string()`, `bool()`, `bytes()`, `dyn()`
- **Type checking**: `type()`, which returns a type value comparable against the bare type names
  `null_type`, `bool`, `int`, `uint`, `double`, `string`, `bytes`, `list`, `map`, `timestamp`,
  `duration` and `type`
- **Collections**: `size()`, `has()`
- **Math**: `max()`, `min()`
- **Regex**: `matches()`, as a function and as a string method

### String functions

Receiver style, following the cel-go strings extension:

`charAt()`, `indexOf()`, `lastIndexOf()`, `lowerAscii()`, `upperAscii()`, `substring()`, `reverse()`,
`trim()`, `contains()`, `startsWith()`, `endsWith()`, `replace(from, to[, limit])`,
`split(separator[, limit])`, `join([separator])` on a list of strings, `format(list)`, and the global
`strings.quote()`.

```typescript
cel.eval("'hello'.charAt(1)", {}); // "e"
cel.eval("'a,b,c'.split(',', 2)", {}); // ["a", "b,c"]
cel.eval("['a','b'].join('-')", {}); // "a-b"
cel.eval("'%d apples at %.2f'.format([3, 1.5])", {}); // "3 apples at 1.50"
```

`format()` supports the verbs `%s %d %f %e %b %o %x %X %%` with an optional precision such as `%.3f`.

Positions and sizes count Unicode code points, not UTF-16 code units, so `charAt()`, `substring()`,
`indexOf()`, `lastIndexOf()`, string indexing and `size()` never split a supplementary character:

```typescript
cel.eval("size('\\U0001F600b')", {}); // 2n
cel.eval("'\\U0001F600b'.charAt(0)", {}); // the whole emoji, not a lone surrogate
```

### Regex functions

```typescript
cel.eval("regex.replace('a b c', ' ', '-')", {}); // "a-b-c"
cel.eval("regex.replace('ab', '(\\\\w)', '[\\\\1]')", {}); // "[a][b]"
cel.eval("regex.extract('id=123', '=([0-9]+)')", {}); // "123"
cel.eval("regex.extractAll('a1b2', '[0-9]')", {}); // ["1", "2"]
```

`regex.replace()` takes an optional fourth argument limiting the number of replacements. Capture
groups are referenced as `\1` through `\9`, and `\0` for the whole match. Patterns use the
JavaScript `RegExp` dialect.

### List and set functions

```typescript
cel.eval('[1, 2, 2, 3].distinct()', {}); // [1n, 2n, 3n]
cel.eval('[[1, 2], [3]].flatten()', {}); // [1n, 2n, 3n]
cel.eval('[3, 1, 2].sort()', {}); // [1n, 2n, 3n]
cel.eval('[1, 2, 3, 4].slice(1, 3)', {}); // [2n, 3n]
cel.eval('[1, 2, 3].reverse()', {}); // [3n, 2n, 1n]
cel.eval('[1, 2].first()', {}); // 1n
cel.eval('lists.range(3)', {}); // [0n, 1n, 2n]
cel.eval('sets.contains([1, 2, 3], [1, 3])', {}); // true
cel.eval('sets.equivalent([1, 2, 2], [2, 1])', {}); // true
cel.eval('sets.intersects([1, 2], [2, 3])', {}); // true
```

### Math functions

`math.greatest()`, `math.least()`, `math.abs()`, `math.ceil()`, `math.floor()`, `math.round()`,
`math.trunc()`, `math.sign()`, `math.sqrt()`, `math.isNaN()`, `math.isInf()`, `math.isFinite()`,
`math.bitAnd()`, `math.bitOr()`, `math.bitXor()`, `math.bitNot()`, `math.bitShiftLeft()`,
`math.bitShiftRight()`.

`abs()` and `sign()` preserve the numeric type of their argument; `math.greatest()` and
`math.least()` also accept a single list. Bit operations work on the full signed 64-bit range.

### Bytes and base64

Bytes literals evaluate to a `Uint8Array`. They support `size()`, indexing, concatenation,
comparison and `string()` conversion (decoded as UTF-8).

```typescript
cel.eval("base64.encode(b'hello')", {}); // "aGVsbG8="
cel.eval("string(base64.decode('aGVsbG8='))", {}); // "hello"
```

### Timestamps and durations

`timestamp()` produces a `Timestamp` and `duration()` a `Duration`; both are exported classes with
nanosecond precision (`seconds: bigint`, `nanos: number`). A JavaScript `Date` passed as a variable
is accepted as a timestamp. Durations accept the full CEL syntax: signed, multi-unit and
fractional values with the units `ns`, `us`, `ms`, `s`, `m` and `h`, for example `1h30m`, `-1.5s`
or `100ms`. Components are accumulated exactly, and a duration beyond the specification's range
of `Utilities.SPAN` seconds either side of zero is rejected rather than silently clamped.

Accessors are available both as global functions and as methods, and default to UTC. Each takes an
optional IANA time zone as its last argument (resolved through `Intl.DateTimeFormat`).

```typescript
cel.eval("timestamp('2024-03-05T14:30:45Z').getFullYear()", {}); // 2024n
cel.eval("getHours(timestamp('2024-03-05T14:30:45Z'), 'America/New_York')", {}); // 9n
cel.eval("duration('1h30m').getMinutes()", {}); // 90n
```

The accessors are `getFullYear`, `getMonth` (zero based), `getDate`, `getDayOfWeek` (Sunday is 0),
`getDayOfYear` (zero based), `getHours`, `getMinutes`, `getSeconds` and `getMilliseconds`.

Timestamps and durations support arithmetic and comparison: `ts + dur`, `dur + ts`, `ts - dur`,
`ts - ts` (yielding a duration), `dur + dur`, `dur - dur` and `-dur`.

### Namespaced functions

`math`, `sets`, `lists`, `strings`, `base64` and `regex` are namespaces, not variables. A variable
of the same name always wins, so binding `math` in the evaluation variables makes `math.greatest`
resolve as an ordinary field selection again. Custom function libraries expose namespaced
functions by implementing `knows(name)`.

### Macro Functions

```typescript
// map - Transform each element
cel.eval('[1, 2, 3].map(x, x * 2)', {}); // [2n, 4n, 6n]

// filter - Keep elements matching condition
cel.eval('[1, 2, 3, 4].filter(x, x % 2 == 0)', {}); // [2n, 4n]

// exists - Check if any element matches
cel.eval('[1, 2, 3].exists(x, x > 2)', {}); // true

// all - Check if all elements match
cel.eval('[1, 2, 3].all(x, x > 0)', {}); // true

// existsOne - Check if exactly one element matches
cel.eval('[1, 2, 3].existsOne(x, x == 2)', {}); // true

// has - Test field presence without erroring
cel.eval('has(user.email)', { user: { name: 'Alice' } }); // false
```

`sortBy` orders a list by a computed key, and `map` accepts an optional predicate between the
variable and the transform:

```typescript
cel.eval('users.sortBy(u, u.age).map(u, u.name)', data);
cel.eval('[1, 2, 3, 4].map(x, x % 2 == 0, x * 2)', {}); // [4n, 8n]
```

Macros also accept a map as their target, iterating over its keys. Macro predicates must yield a
boolean.

## Printing expressions

`Printer` renders a parsed expression back into CEL source. The compact form is a single line that
parses back into an equivalent expression, with parentheses only where precedence requires them.

```typescript
import { Parser, Printer, PrinterOptions } from '@libdbm/libcel-ts';

const expr = new Parser('(a + b) * c').parse();
Printer.print(expr); // "(a + b) * c"
Printer.print(new Parser('a + (b * c)').parse()); // "a + b * c"
```

The pretty form breaks lists, maps, structs, argument lists and logical chains once they no longer
fit the configured width:

```typescript
Printer.print(expr, PrinterOptions.pretty()); // 2 space indent, 100 column width
Printer.print(expr, new PrinterOptions(true, 4, 60));
```

Original spacing and redundant parentheses are not preserved, and comprehension nodes, which the
parser never produces, are rendered in a diagnostic form that is not valid CEL.

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

# Type check (sources and tests)
npm run typecheck

# Lint and format
npm run lint
npm run format
```

## Testing

The project includes comprehensive test coverage:

- 37 parser tests
- 26 interpreter tests
- 60 integration tests
- 15 printer tests
- 42 extension function tests
- 69 conformance tests organized after the google/cel-spec corpus
- 26 value model tests
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

- **ast/expression.ts**: Abstract Syntax Tree (AST) with visitor pattern
- **parser/lexer.ts, parser/parser.ts**: Hand-written lexer and recursive descent parser
- **interpreter/interpreter.ts**: AST evaluator using Visitor pattern
- **printer/printer.ts**: AST to CEL source renderer, also using Visitor pattern
- **values/**: The CEL value model: `Type`, `Timestamp`, `Duration`, bytes helpers, exact numeric
  ordering, canonical keys for hashing, and boundary normalisation
- **functions/functions.ts**: Extensible function library interface
- **functions/standard-functions.ts**: Built-in and extension function dispatch
- **functions/strings.ts, lists.ts, sets.ts, maths.ts, regexes.ts, codecs.ts**: Extension
  function implementations
- **functions/utilities.ts**: Conversions, equality, ordering and time helpers
- **errors.ts**: `EvaluationError` and `ArgumentError`
- **cel.ts**: Main API entry point
- **program.ts**: Compiled, reusable programs

## Functional Equivalence

This TypeScript implementation is functionally equivalent to the [Java libcel](https://github.com/libdbm/libcel-java) implementation (version 2.0.0):

- Same AST structure and expression types
- Identical parsing rules and operator precedence
- Same evaluation semantics, including exact 64-bit integer arithmetic
- Equivalent macro function behavior
- Compatible error handling

All tests from the Java version have been ported to ensure equivalence.

## Specification compliance

```typescript
cel.eval('1 / 2', {}); // 0n, integer division truncates
cel.eval('1.0 / 0.0', {}); // Infinity, not an error
cel.eval('has(a.b)', data); // presence test, false rather than an error
cel.eval('type(42) == int', {}); // true
cel.eval('false && missing', {}); // false, errors are absorbed by a false operand
```

Known deviations from the specification, kept deliberately:

- `uint` is represented as a signed 64-bit int, so `type(1u)` is `int` and `1u == 1` is true.
- `"ab" * 3` and `[1] * 2` repeat a string or list, and `"a" in "abc"` tests for a substring. CEL
  defines none of these; they are extensions this library adds.
- `has(map, key)` is also accepted as a two-argument function alongside the `has(a.b)` macro.
- Map keys are not restricted to the specification's int, uint, bool and string types, and they are
  matched with the same numeric equality the rest of the language uses. A key stored as `1`
  matches a `1.0` probe, and `{1: "a"}[1.0]` resolves. Membership, indexing, presence tests and
  map equality all follow this one rule, so `key in map ? map[key] : fallback` never fails after
  its guard succeeds, and a `Map` bound from JavaScript compares equal to the literal that
  spells it.
- Bytes are ordered the way the Java implementation orders them, byte by byte as signed values.

### Evaluation limits

CEL exists to evaluate untrusted input, so operations whose size the expression itself controls are
bounded by `Utilities.LIMIT`, one million elements or characters. `lists.range(n)`, the repetition
operators and `format()` raise an `EvaluationError` rather than exhausting the heap:

```typescript
cel.eval('lists.range(9223372036854775807)', {}); // EvaluationError
cel.eval("'x' * 2000000000", {}); // EvaluationError
cel.eval("'%.2000000f'.format([1.5])", {}); // EvaluationError
```

The ceiling bounds each operation's **output**, not only its inputs, so two separately legal values
cannot be combined into one that exhausts the heap. `join()`, `replace()`, `regex.replace()`,
`base64.encode()` and string, list and bytes concatenation are all bounded this way:

```typescript
cel.eval("lists.range(1000000).map(x, 'a').join('x' * 1000000)", {}); // EvaluationError
cel.eval("('x' * 1000000) + ('x' * 1000000)", {}); // EvaluationError
```

Collection operations resolve membership through a hash index rather than a scan, so `distinct()`
and the `sets` functions stay linear in their input and cannot burn CPU quadratically at the size
the limit allows. The parser also refuses expressions nested more than 256 levels deep.

This is a ceiling on individual operations, not a budget for a whole expression: a deeply nested
expression can still allocate a multiple of the limit.

## Breaking changes in 2.0.0

- CEL ints are now `bigint`: `cel.eval('1 + 2')` returns `3n`, and every int result (including
  `size()`, indexes and `int()`) is a `bigint`. Integer-valued JavaScript numbers passed as
  variables are ints; write `double(x)` in the expression to force a double. `JSON.stringify`
  needs a replacer for `bigint`.
- Map literals and plain-object variables evaluate to `Map` rather than plain objects, and maps may
  have non-string keys.
- Bytes literals now evaluate to `Uint8Array` instead of `string`. Use `string(value)` to decode
  them as UTF-8, or `bytes(value)` to convert the other way.
- `type()` returns a `Type` value rather than a string, so `type(42) == int` is true and
  `type(42) == "int"` is false. Use `string(type(x))` for the old string form. `type(1.0)` is
  now `double`; previously any integer-valued number reported `int`.
- Integer division returns an integer: `1 / 2` is `0n`, not `0.5`. Use a double operand for the
  old behavior. Double division by zero yields infinity instead of raising an error, and `%` now
  requires integer operands.
- Integer arithmetic raises `EvaluationError` on 64-bit overflow instead of losing precision.
- Mixed int and double comparison is exact, so `9223372036854775807 == 9223372036854775808.0` is
  false.
- `&&`, `||`, `!` and `? :` now require boolean operands instead of treating any non-true value as
  false. The logical operators absorb errors: `false && error` is false and `true || error` is
  true. Macro predicates must likewise yield a boolean.
- `has(a.b)` is a presence test resolved at parse time; `has(1)` is a `ParseError`. The two-argument
  `has(map, key)` function is still supported.
- Timestamps and durations are new: `timestamp(n)` reads `n` as epoch **seconds**, results are
  `Timestamp` and `Duration` instances (a `Date` is accepted as input), accessors default to UTC
  and return `bigint`, and `string(duration)` renders the CEL form (`"3600s"`).
- String ordering compares UTF-16 code units (previously locale-aware `localeCompare`), and string
  positions and sizes count code points rather than UTF-16 code units.
- `int('4.5')` and `double('abc')` are errors; the conversions no longer accept partial numbers.
- `null` and `undefined` variables both evaluate to CEL `null`.
- Function argument errors throw the new `ArgumentError` rather than a plain `Error`;
  `EvaluationError` is unchanged. Both are exported.
- `Utilities` signatures changed: `typeOf` returns `Type`, `sizeOf`, `asInt`, `asUInt` and the
  time accessors return `bigint`, `deepEquals` is an alias of `equals`, and `compare` no longer
  accepts `null`.
- The `Functions` interface gained an optional `knows(name)` method for namespaced functions, and
  results returned from custom functions are normalised into the CEL value model.
- An integer literal outside the 64-bit range is a `ParseError`.

## Requirements

- Node.js 18+ or a modern browser (BigInt, `TextEncoder` and `Intl.DateTimeFormat` with time
  zone support)
- TypeScript 5.0+ (for development)

## API Documentation

### CEL Class

```typescript
class CEL {
  constructor(functions?: Functions | null);
  compile(expression: string): Program;
  eval(expression: string, variables?: Record<string, unknown> | Map<string, unknown>): unknown;

  static compile(expression: string, functions: Functions): Program;
  static eval(
    expression: string,
    functions: Functions,
    variables: Record<string, unknown> | Map<string, unknown>
  ): unknown;
}
```

### Program Class

```typescript
class Program {
  evaluate(variables?: Record<string, unknown> | Map<string, unknown>): unknown;
}
```

### Functions Interface

```typescript
interface Functions {
  callFunction(name: string, args: any[]): any;
  callMethod(target: any, method: string, args: any[]): any;
  knows?(name: string): boolean;
}
```

### Printer

```typescript
class Printer {
  static print(expr: Expression, options?: PrinterOptions): string;
}

class PrinterOptions {
  constructor(wrap: boolean, indent: number, width: number);
  static compact(): PrinterOptions;
  static pretty(): PrinterOptions;
}
```

### Values

`Type`, `Timestamp`, `Duration`, `EvaluationError` and `ArgumentError` are exported, as are the
`Utilities`, `Strings`, `Lists`, `Sets`, `Maths`, `Regexes` and `Codecs` namespaces for calling the
library functions directly.

## Examples

See the [examples](./examples) directory for more detailed examples:

- [quickstart.ts](./examples/quickstart.ts) - Comprehensive usage examples
- [parser-example.ts](./examples/parser-example.ts) - Parser and Printer API demonstration
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
