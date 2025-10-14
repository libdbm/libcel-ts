import { Parser, Interpreter } from '../src/index.js';

/** Example demonstrating the CEL interpreter usage. */

function format(value: any): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function evaluate(expression: string): void {
  try {
    const parser = new Parser(expression);
    const ast = parser.parse();
    const interpreter = new Interpreter();
    const result = interpreter.evaluate(ast);
    console.log(`${expression} = ${format(result)}`);
  } catch (e) {
    console.log(`${expression} => ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function evaluateWithVars(expression: string, vars: Record<string, any>): void {
  try {
    const parser = new Parser(expression);
    const ast = parser.parse();
    const interpreter = new Interpreter(vars);
    const result = interpreter.evaluate(ast);
    console.log(`${expression} = ${format(result)}`);
  } catch (e) {
    console.log(`${expression} => ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Example 1: Simple arithmetic
console.log('=== Simple Arithmetic ===');
evaluate('2 + 3 * 4');
evaluate('10 / 3');
evaluate('10 % 3');

// Example 2: String operations
console.log('\n=== String Operations ===');
evaluate('"Hello" + " " + "World"');
evaluate('"abc" * 3');

// Example 3: Logical operations
console.log('\n=== Logical Operations ===');
evaluate('true && false');
evaluate('true || false');
evaluate('!false');

// Example 4: Variables
console.log('\n=== Variables ===');
const vars: Record<string, any> = {
  name: 'Alice',
  age: 30,
  score: 85.5,
};

evaluateWithVars('name + " is " + string(age) + " years old"', vars);
evaluateWithVars('age > 18 ? "adult" : "minor"', vars);
evaluateWithVars('score >= 90.0 ? "A" : score >= 80.0 ? "B" : "C"', vars);

// Example 5: Collections
console.log('\n=== Collections ===');
vars.numbers = [1, 2, 3, 4, 5];
vars.fruits = ['apple', 'banana', 'cherry'];
delete vars.name;
delete vars.age;
delete vars.score;

evaluateWithVars('size(numbers)', vars);
evaluateWithVars('numbers[0]', vars);
evaluateWithVars('3 in numbers', vars);
evaluateWithVars('[1, 2] + [3, 4]', vars);

// Example 6: Map operations
console.log('\n=== Map Operations ===');
const person = {
  name: 'Bob',
  age: 25,
  city: 'New York',
};

evaluateWithVars('person.name', { person });
evaluateWithVars('person["city"]', { person });
evaluateWithVars('has(person, "age")', { person });

// Example 7: Macro functions
console.log('\n=== Macro Functions ===');
const numbers = [1, 2, 3, 4, 5];

evaluateWithVars('numbers.map(x, x * 2)', { numbers });
evaluateWithVars('numbers.filter(x, x > 2)', { numbers });
evaluateWithVars('numbers.all(x, x > 0)', { numbers });
evaluateWithVars('numbers.exists(x, x > 4)', { numbers });
evaluateWithVars('numbers.existsOne(x, x == 3)', { numbers });

// Example 8: String methods
console.log('\n=== String Methods ===');
const text = 'Hello World';

evaluateWithVars('text.contains("World")', { text });
evaluateWithVars('text.startsWith("Hello")', { text });
evaluateWithVars('text.endsWith("World")', { text });
evaluateWithVars('text.toLowerCase()', { text });

// Example 9: Complex expressions
console.log('\n=== Complex Expressions ===');
const users = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false },
  { name: 'Charlie', age: 35, active: true },
];

evaluateWithVars('users.filter(u, u.active).map(u, u.name)', { users });
evaluateWithVars('users.all(u, u.age > 18)', { users });
evaluateWithVars('users.exists(u, u.name == "Bob")', { users });

// Example 10: Deep equality and comparison
console.log('\n=== Deep Equality and Comparison ===');
evaluate('[1, 2, 3] == [1, 2, 3]');
evaluate('[1, 2] < [1, 3]');
evaluate('[1, 2] < [1, 2, 3]');
