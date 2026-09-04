import {
  Binary,
  BinaryOp,
  Call,
  Comprehension,
  Conditional,
  Expression,
  Identifier,
  Index,
  ListExpression,
  Literal,
  LiteralType,
  MapExpression,
  Select,
  Struct,
  Unary,
  UnaryOp,
  Visitor,
} from '../ast/index.js';
import { ArgumentError } from '../errors.js';
import * as Strings from '../functions/strings.js';
import * as Utilities from '../functions/utilities.js';
import { javaDoubleToString } from '../values/numbers.js';

const CONDITIONAL = 1;
const MEMBER = 8;
const PRIMARY = 9;

/**
 * Rendering options for {@link Printer}.
 */
export class PrinterOptions {
  /**
   * @param wrap Whether to break long constructs across lines
   * @param indent The number of spaces per indentation level
   * @param width The maximum line width before a construct is broken
   */
  constructor(
    readonly wrap: boolean,
    readonly indent: number,
    readonly width: number
  ) {}

  /** Options for a single line rendering. */
  static compact(): PrinterOptions {
    return new PrinterOptions(false, 0, Number.MAX_SAFE_INTEGER);
  }

  /** Options for a multi-line rendering indented by two spaces at a width of 100. */
  static pretty(): PrinterOptions {
    return new PrinterOptions(true, 2, 100);
  }
}

/**
 * Renders an expression tree back into CEL source text.
 *
 * The compact form is a single line that parses back into an equivalent tree,
 * with parentheses only where operator precedence requires them. The pretty form
 * breaks lists, maps, structs, argument lists and logical chains across lines
 * once they no longer fit within the configured width.
 *
 * Expressions built by the parser always round-trip. A {@link Comprehension},
 * which the parser never produces, is rendered in a diagnostic form that is not
 * valid CEL.
 *
 * @example
 * ```typescript
 * const expr = new Parser('a + (b * c)').parse();
 * Printer.print(expr);                          // 'a + b * c'
 * Printer.print(expr, PrinterOptions.pretty()); // same, it fits on one line
 * ```
 */
export class Printer implements Visitor<string> {
  private level = 0;

  private constructor(private readonly options: PrinterOptions) {}

  /**
   * Renders the given expression as CEL source.
   *
   * @param expr The expression to render
   * @param options The rendering options; compact by default
   * @returns The rendered text
   */
  static print(expr: Expression, options: PrinterOptions = PrinterOptions.compact()): string {
    return new Printer(options).text(expr);
  }

  private static precedence(expr: Expression): number {
    if (expr instanceof Conditional) {
      return CONDITIONAL;
    }
    if (expr instanceof Binary) {
      switch (expr.op) {
        case BinaryOp.LOGICAL_OR:
          return 2;
        case BinaryOp.LOGICAL_AND:
          return 3;
        case BinaryOp.EQUAL:
        case BinaryOp.NOT_EQUAL:
        case BinaryOp.LESS:
        case BinaryOp.LESS_EQUAL:
        case BinaryOp.GREATER:
        case BinaryOp.GREATER_EQUAL:
        case BinaryOp.IN:
          return 4;
        case BinaryOp.ADD:
        case BinaryOp.SUBTRACT:
          return 5;
        case BinaryOp.MULTIPLY:
        case BinaryOp.DIVIDE:
        case BinaryOp.MODULO:
          return 6;
      }
    }
    if (expr instanceof Unary) {
      return 7;
    }
    return PRIMARY;
  }

  private static spelling(op: BinaryOp): string {
    switch (op) {
      case BinaryOp.ADD:
        return '+';
      case BinaryOp.SUBTRACT:
        return '-';
      case BinaryOp.MULTIPLY:
        return '*';
      case BinaryOp.DIVIDE:
        return '/';
      case BinaryOp.MODULO:
        return '%';
      case BinaryOp.EQUAL:
        return '==';
      case BinaryOp.NOT_EQUAL:
        return '!=';
      case BinaryOp.LESS:
        return '<';
      case BinaryOp.LESS_EQUAL:
        return '<=';
      case BinaryOp.GREATER:
        return '>';
      case BinaryOp.GREATER_EQUAL:
        return '>=';
      case BinaryOp.LOGICAL_AND:
        return '&&';
      case BinaryOp.LOGICAL_OR:
        return '||';
      case BinaryOp.IN:
        return 'in';
    }
  }

  private static decimal(value: number): string {
    if (!Number.isFinite(value)) {
      throw new ArgumentError(`Cannot render ${value} as a CEL literal`);
    }
    return javaDoubleToString(value);
  }

  // Renders a node without any enclosing parentheses
  private text(expr: Expression): string {
    if (this.options.wrap) {
      const compact = Printer.print(expr, PrinterOptions.compact());
      if (this.level * this.options.indent + compact.length <= this.options.width) {
        return compact;
      }
    }
    return expr.accept(this);
  }

  // Renders a node, adding parentheses when its precedence is below the required level
  private render(expr: Expression, least: number): string {
    const body = this.text(expr);
    return Printer.precedence(expr) < least ? `(${body})` : body;
  }

  // Renders children one level deeper when wrapping
  private nested<T>(body: () => T): T {
    const broken = this.options.wrap ? 1 : 0;
    this.level += broken;
    try {
      return body();
    } finally {
      this.level -= broken;
    }
  }

  visitLiteral(expr: Literal): string {
    const value = expr.value;
    switch (expr.literalType) {
      case LiteralType.NULL_VALUE:
        return 'null';
      case LiteralType.BOOL:
      case LiteralType.INT:
        return String(value);
      case LiteralType.UINT:
        return `${value}u`;
      case LiteralType.DOUBLE:
        return Printer.decimal(Utilities.asDouble(value));
      case LiteralType.STRING:
        return Strings.quote(Utilities.asString(value));
      case LiteralType.BYTES:
        return `b"${Strings.escapeBytes(Utilities.asBytes(value))}"`;
    }
  }

  visitIdentifier(expr: Identifier): string {
    return expr.name;
  }

  visitSelect(expr: Select): string {
    const operand = expr.operand === null ? '' : this.render(expr.operand, MEMBER);
    const selection = `${operand}.${expr.field}`;
    return expr.isTest ? `has(${selection})` : selection;
  }

  visitCall(expr: Call): string {
    const target = expr.target === null ? '' : `${this.render(expr.target, MEMBER)}.`;
    const args = this.nested(() => expr.args.map((arg) => this.text(arg)));
    return `${target}${expr.functionName}${this.group('(', args, ')')}`;
  }

  visitList(expr: ListExpression): string {
    return this.group('[', this.parts(expr.elements), ']');
  }

  visitMap(expr: MapExpression): string {
    const entries = this.nested(() =>
      expr.entries.map((entry) => `${this.text(entry.key)}: ${this.text(entry.value)}`)
    );
    return this.group('{', entries, '}');
  }

  visitStruct(expr: Struct): string {
    const fields = this.nested(() =>
      expr.fields.map((field) => `${field.field}: ${this.text(field.value)}`)
    );
    return `${expr.typeName ?? ''}${this.group('{', fields, '}')}`;
  }

  visitComprehension(expr: Comprehension): string {
    const parts = [
      expr.variable,
      this.text(expr.range),
      expr.accumulator,
      this.text(expr.initializer),
      this.text(expr.condition),
      this.text(expr.step),
      this.text(expr.result),
    ];
    return `__comprehension__${this.group('(', parts, ')')}`;
  }

  visitUnary(expr: Unary): string {
    const operator = expr.op === UnaryOp.NOT ? '!' : '-';
    return operator + this.render(expr.operand, 7);
  }

  visitBinary(expr: Binary): string {
    const order = Printer.precedence(expr);
    const left = this.render(expr.left, order);
    const right = this.render(expr.right, order + 1);
    const operator = Printer.spelling(expr.op);

    if (
      this.options.wrap &&
      (expr.op === BinaryOp.LOGICAL_AND || expr.op === BinaryOp.LOGICAL_OR)
    ) {
      return `${left}\n${this.pad(this.level)}${operator} ${right}`;
    }
    return `${left} ${operator} ${right}`;
  }

  visitConditional(expr: Conditional): string {
    const condition = this.render(expr.condition, CONDITIONAL + 1);
    const [then, otherwise] = this.nested(() => [
      this.render(expr.thenExpr, CONDITIONAL + 1),
      this.render(expr.otherwiseExpr, CONDITIONAL),
    ]);

    if (this.options.wrap) {
      const inner = this.pad(this.level + 1);
      return `${condition}\n${inner}? ${then}\n${inner}: ${otherwise}`;
    }
    return `${condition} ? ${then} : ${otherwise}`;
  }

  visitIndex(expr: Index): string {
    return `${this.render(expr.operand, MEMBER)}[${this.text(expr.index)}]`;
  }

  private parts(expressions: Expression[]): string[] {
    return this.nested(() => expressions.map((expr) => this.text(expr)));
  }

  private group(open: string, parts: string[], close: string): string {
    if (!this.options.wrap || parts.length === 0) {
      return `${open}${parts.join(', ')}${close}`;
    }
    const inner = this.pad(this.level + 1);
    return `${open}\n${inner}${parts.join(`,\n${inner}`)}\n${this.pad(this.level)}${close}`;
  }

  private pad(depth: number): string {
    return ' '.repeat(depth * this.options.indent);
  }
}
