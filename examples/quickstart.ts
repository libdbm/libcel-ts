import { CEL, Parser, Printer, StandardFunctions } from '../src/index.js';

/** Quick start examples demonstrating the libcel library. */

const cel = new CEL();

console.log('=== Basic Expressions ===\n');

// Arithmetic
// CEL ints are JavaScript bigints
console.log(cel.eval('2 + 3 * 4', {})); // 14n
console.log(cel.eval('(2 + 3) * 4', {})); // 20n
console.log(cel.eval('7 / 2', {})); // 3n, integer division truncates
console.log(cel.eval('7.0 / 2', {})); // 3.5

// Variables
const vars = { x: 10, y: 20 };
console.log(cel.eval('x + y', vars)); // 30n
console.log(cel.eval('x * 2 + y', vars)); // 40n

console.log('\n=== Working with Strings ===\n');

// String concatenation
console.log(cel.eval("'Hello, ' + 'World!'", {})); // Hello, World!

// String methods
console.log(cel.eval("'hello'.toUpperCase()", {})); // HELLO
console.log(cel.eval("'  trim me  '.trim()", {})); // trim me
console.log(cel.eval("'a,b,c'.split(',')", {})); // [ 'a', 'b', 'c' ]

console.log('\n=== Working with Collections ===\n');

// Lists
console.log(cel.eval('[1, 2, 3] + [4, 5]', {})); // [ 1n, 2n, 3n, 4n, 5n ]
console.log(cel.eval('[1, 2, 3][1]', {})); // 2n
console.log(cel.eval('size([1, 2, 3])', {})); // 3n

// Maps
const user = { name: 'Alice', age: 30 };
console.log(cel.eval('user.name', { user })); // Alice
console.log(cel.eval("user['age']", { user })); // 30n
console.log(cel.eval('has(user.email)', { user })); // false, presence test
console.log(cel.eval('{"a": 1}', {})); // Map(1) { 'a' => 1n }

console.log('\n=== Boolean Logic ===\n');

console.log(cel.eval('true && false', {})); // false
console.log(cel.eval('true || false', {})); // true
console.log(cel.eval('!false', {})); // true

// Comparisons
console.log(cel.eval('10 > 5', {})); // true
console.log(cel.eval("'abc' < 'xyz'", {})); // true

// Conditional (ternary)
console.log(cel.eval("age >= 18 ? 'adult' : 'minor'", { age: 25 })); // adult

console.log('\n=== Macro Functions ===\n');

// map - Transform elements
console.log(cel.eval('[1, 2, 3].map(x, x * 2)', {})); // [ 2n, 4n, 6n ]

// filter - Select elements
console.log(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2)', {})); // [ 3n, 4n, 5n ]

// all - Check all elements
console.log(cel.eval('[2, 4, 6].all(x, x % 2 == 0)', {})); // true

// exists - Check any element
console.log(cel.eval('[1, 2, 3].exists(x, x > 2)', {})); // true

// existsOne - Check exactly one
console.log(cel.eval('[1, 2, 3].existsOne(x, x == 2)', {})); // true

// Chaining macros
console.log(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2).map(x, x * 10)', {}));
// [ 30n, 40n, 50n ]

// sortBy and the three-argument map
console.log(cel.eval('[3, 1, 2].sortBy(x, -x)', {})); // [ 3n, 2n, 1n ]
console.log(cel.eval('[1, 2, 3, 4].map(x, x % 2 == 0, x * 2)', {})); // [ 4n, 8n ]

console.log('\n=== Working with Complex Data ===\n');

const data = {
  users: [
    { name: 'Alice', age: 30, active: true },
    { name: 'Bob', age: 25, active: false },
    { name: 'Charlie', age: 35, active: true },
  ],
};

// Filter and map
console.log(cel.eval('users.filter(u, u.active).map(u, u.name)', data));
// [ 'Alice', 'Charlie' ]

// Complex conditions
console.log(cel.eval('users.exists(u, u.age > 30 && u.active)', data)); // true

console.log('\n=== Compiled Programs ===\n');

// Compile once, evaluate many times
const program = cel.compile('price * quantity * (1 - discount)');

console.log(program.evaluate({ price: 10, quantity: 5, discount: 0.1 }));
// 45

console.log(program.evaluate({ price: 20, quantity: 3, discount: 0.2 }));
// 48

console.log('\n=== Type Conversions ===\n');

console.log(cel.eval("int('42')", {})); // 42n
console.log(cel.eval('double(42)', {})); // 42
console.log(cel.eval('string(42)', {})); // 42
console.log(cel.eval('type([1, 2, 3])', {})); // Type { name: 'list' }
console.log(cel.eval('type(42) == int', {})); // true

console.log('\n=== Extension Libraries ===\n');

console.log(cel.eval("'%d apples at %.2f'.format([3, 1.5])", {})); // 3 apples at 1.50
console.log(cel.eval("regex.replace('ab', '(\\\\w)', '[\\\\1]')", {})); // [a][b]
console.log(cel.eval('math.greatest(1, 3, 2)', {})); // 3n
console.log(cel.eval('[1, 2, 2, 3].distinct()', {})); // [ 1n, 2n, 3n ]
console.log(cel.eval("base64.encode('hello')", {})); // aGVsbG8=
console.log(cel.eval("timestamp('2024-03-05T14:30:45Z').getHours('America/New_York')", {})); // 9n
console.log(cel.eval("string(duration('1h30m'))", {})); // 5400s

console.log('\n=== Printing Expressions ===\n');

console.log(Printer.print(new Parser('a + (b * c)').parse())); // a + b * c
console.log(Printer.print(new Parser('(a + b) * c').parse())); // (a + b) * c

console.log('\n=== Custom Functions ===\n');

/** Example custom function library extending standard functions. */
class CustomFunctions extends StandardFunctions {
  override callFunction(name: string, args: unknown[]): unknown {
    switch (name) {
      case 'reverse':
        return Array.from(args[0] as string)
          .reverse()
          .join('');
      case 'twice': {
        const str = args[0] as string;
        return str + str;
      }
      default:
        return super.callFunction(name, args);
    }
  }
}

const customCel = new CEL(new CustomFunctions());
console.log(customCel.eval("reverse('hello')", {})); // olleh
console.log(customCel.eval("twice('world')", {})); // worldworld
