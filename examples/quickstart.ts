import { CEL, StandardFunctions } from '../src/index.js';

/** Quick start examples demonstrating the libcel library. */

const cel = new CEL();

console.log('=== Basic Expressions ===\n');

// Arithmetic
console.log(cel.eval('2 + 3 * 4', {})); // 14
console.log(cel.eval('(2 + 3) * 4', {})); // 20

// Variables
const vars = { x: 10, y: 20 };
console.log(cel.eval('x + y', vars)); // 30
console.log(cel.eval('x * 2 + y', vars)); // 40

console.log('\n=== Working with Strings ===\n');

// String concatenation
console.log(cel.eval("'Hello, ' + 'World!'", {})); // Hello, World!

// String methods
console.log(cel.eval("'hello'.toUpperCase()", {})); // HELLO
console.log(cel.eval("'  trim me  '.trim()", {})); // trim me
console.log(cel.eval("'a,b,c'.split(',')", {})); // [ 'a', 'b', 'c' ]

console.log('\n=== Working with Collections ===\n');

// Lists
console.log(cel.eval('[1, 2, 3] + [4, 5]', {})); // [ 1, 2, 3, 4, 5 ]
console.log(cel.eval('[1, 2, 3][1]', {})); // 2
console.log(cel.eval('size([1, 2, 3])', {})); // 3

// Maps
const user = { name: 'Alice', age: 30 };
console.log(cel.eval('user.name', { user })); // Alice
console.log(cel.eval("user['age']", { user })); // 30

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
console.log(cel.eval('[1, 2, 3].map(x, x * 2)', {})); // [ 2, 4, 6 ]

// filter - Select elements
console.log(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2)', {})); // [ 3, 4, 5 ]

// all - Check all elements
console.log(cel.eval('[2, 4, 6].all(x, x % 2 == 0)', {})); // true

// exists - Check any element
console.log(cel.eval('[1, 2, 3].exists(x, x > 2)', {})); // true

// existsOne - Check exactly one
console.log(cel.eval('[1, 2, 3].existsOne(x, x == 2)', {})); // true

// Chaining macros
console.log(cel.eval('[1, 2, 3, 4, 5].filter(x, x > 2).map(x, x * 10)', {}));
// [ 30, 40, 50 ]

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

console.log(cel.eval("int('42')", {})); // 42
console.log(cel.eval('double(42)', {})); // 42
console.log(cel.eval('string(42)', {})); // 42
console.log(cel.eval('type([1, 2, 3])', {})); // list

console.log('\n=== Custom Functions ===\n');

/** Example custom function library extending standard functions. */
class CustomFunctions extends StandardFunctions {
  callFunction(name: string, args: any[]): any {
    switch (name) {
      case 'reverse':
        return (args[0] as string).split('').reverse().join('');
      case 'double':
        const str = args[0] as string;
        return str + str;
      default:
        return super.callFunction(name, args);
    }
  }
}

const customCel = new CEL(new CustomFunctions());
console.log(customCel.eval("reverse('hello')", {})); // olleh
console.log(customCel.eval("double('world')", {})); // worldworld
