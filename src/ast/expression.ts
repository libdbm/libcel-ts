import { BinaryOp, UnaryOp, LiteralType } from './operators.js';

/**
 * Visitor interface for traversing and operating on CEL expression nodes.
 * Implements the Visitor pattern for AST traversal.
 *
 * @template T The return type of visit operations
 */
export interface Visitor<T> {
  visitLiteral(expr: Literal): T;
  visitIdentifier(expr: Identifier): T;
  visitSelect(expr: Select): T;
  visitIndex(expr: Index): T;
  visitCall(expr: Call): T;
  visitList(expr: ListExpression): T;
  visitMap(expr: MapExpression): T;
  visitStruct(expr: Struct): T;
  visitComprehension(expr: Comprehension): T;
  visitUnary(expr: Unary): T;
  visitBinary(expr: Binary): T;
  visitConditional(expr: Conditional): T;
}

/**
 * Base interface for all CEL expression nodes in the Abstract Syntax Tree.
 * Uses the Visitor pattern to enable different operations on expressions.
 */
export interface Expression {
  /**
   * Accepts a visitor to perform operations on this expression node.
   *
   * @template T The return type of the visitor's visit operations
   * @param visitor The visitor that will operate on this expression node
   * @returns The result of the visitor's visit operation
   */
  accept<T>(visitor: Visitor<T>): T;
}

/**
 * Literal value expression (null, boolean, number, string, bytes).
 */
export class Literal implements Expression {
  constructor(
    public readonly value: any,
    public readonly literalType: LiteralType
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitLiteral(this);
  }
}

/**
 * Identifier expression (variable reference).
 */
export class Identifier implements Expression {
  constructor(public readonly name: string) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitIdentifier(this);
  }
}

/**
 * Field selection expression (operand.field).
 */
export class Select implements Expression {
  constructor(
    public readonly operand: Expression | null,
    public readonly field: string,
    public readonly isTest: boolean = false
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitSelect(this);
  }
}

/**
 * Index expression for array/map access (operand[index]).
 */
export class Index implements Expression {
  constructor(
    public readonly operand: Expression,
    public readonly index: Expression
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitIndex(this);
  }
}

/**
 * Function or method call expression.
 */
export class Call implements Expression {
  constructor(
    public readonly target: Expression | null,
    public readonly functionName: string,
    public readonly args: Expression[],
    public readonly isMacro: boolean = false
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCall(this);
  }
}

/**
 * List literal expression ([1, 2, 3]).
 */
export class ListExpression implements Expression {
  constructor(public readonly elements: Expression[]) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitList(this);
  }
}

/**
 * Map entry (key-value pair in a map literal).
 */
export class MapEntry {
  constructor(
    public readonly key: Expression,
    public readonly value: Expression
  ) {}
}

/**
 * Map literal expression ({key: value}).
 */
export class MapExpression implements Expression {
  constructor(public readonly entries: MapEntry[]) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitMap(this);
  }
}

/**
 * Field initializer in a struct literal.
 */
export class FieldInitializer {
  constructor(
    public readonly field: string,
    public readonly value: Expression
  ) {}
}

/**
 * Struct literal expression (Type{field: value}).
 */
export class Struct implements Expression {
  constructor(
    public readonly typeName: string | null,
    public readonly fields: FieldInitializer[]
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitStruct(this);
  }
}

/**
 * Comprehension expression for advanced iteration constructs.
 */
export class Comprehension implements Expression {
  constructor(
    public readonly variable: string,
    public readonly range: Expression,
    public readonly accumulator: string,
    public readonly initializer: Expression,
    public readonly condition: Expression,
    public readonly step: Expression,
    public readonly result: Expression
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitComprehension(this);
  }
}

/**
 * Unary operation expression (!, -).
 */
export class Unary implements Expression {
  constructor(
    public readonly op: UnaryOp,
    public readonly operand: Expression
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitUnary(this);
  }
}

/**
 * Binary operation expression (+, -, *, /, etc.).
 */
export class Binary implements Expression {
  constructor(
    public readonly op: BinaryOp,
    public readonly left: Expression,
    public readonly right: Expression
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitBinary(this);
  }
}

/**
 * Conditional (ternary) expression (condition ? then : otherwise).
 */
export class Conditional implements Expression {
  constructor(
    public readonly condition: Expression,
    public readonly thenExpr: Expression,
    public readonly otherwiseExpr: Expression
  ) {}

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitConditional(this);
  }
}
