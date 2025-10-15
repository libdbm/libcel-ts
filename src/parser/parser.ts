import {
  Expression,
  Literal,
  Identifier,
  Select,
  Index,
  Call,
  ListExpression,
  MapExpression,
  MapEntry,
  Struct,
  FieldInitializer,
  Unary,
  Binary,
  Conditional,
  BinaryOp,
  UnaryOp,
  LiteralType,
} from '../ast/index.js';
import { Lexer, Token, TokenType, ParseError } from './lexer.js';

// Re-export ParseError for convenience
export { ParseError } from './lexer.js';

/**
 * Set of macro method names that require special handling.
 */
const MACRO_METHODS = new Set(['map', 'filter', 'all', 'exists', 'existsOne']);

/**
 * Recursive descent parser for CEL (Common Expression Language).
 * Parses CEL expressions into an Abstract Syntax Tree (AST).
 */
export class Parser {
  private readonly lexer: Lexer;
  private current: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.current = this.lexer.next();
  }

  /**
   * Parse a CEL expression from the input string.
   * @returns The parsed Expression AST node
   * @throws ParseError if the input contains syntax errors
   */
  parse(): Expression {
    const expr = this.parseExpr();
    if (this.current.type !== TokenType.EOF) {
      throw new ParseError(
        `Unexpected token after expression: ${this.current.value}`,
        this.current.line,
        this.current.column
      );
    }
    return expr;
  }

  // expr = conditionalOr ( '?' conditionalOr ':' expr )?
  private parseExpr(): Expression {
    const condition = this.parseConditionalOr();

    if (this.match(TokenType.QUESTION)) {
      const thenExpr = this.parseConditionalOr();
      this.expect(TokenType.COLON);
      const otherwiseExpr = this.parseExpr();
      return new Conditional(condition, thenExpr, otherwiseExpr);
    }

    return condition;
  }

  // conditionalOr = conditionalAnd ( '||' conditionalAnd )*
  private parseConditionalOr(): Expression {
    let left = this.parseConditionalAnd();

    while (this.match(TokenType.LOGICAL_OR)) {
      const right = this.parseConditionalAnd();
      left = new Binary(BinaryOp.LOGICAL_OR, left, right);
    }

    return left;
  }

  // conditionalAnd = relation ( '&&' relation )*
  private parseConditionalAnd(): Expression {
    let left = this.parseRelation();

    while (this.match(TokenType.LOGICAL_AND)) {
      const right = this.parseRelation();
      left = new Binary(BinaryOp.LOGICAL_AND, left, right);
    }

    return left;
  }

  // relation = addition ( relop addition )*
  // relop = '<=' | '>=' | '!=' | '==' | '<' | '>' | 'in'
  private parseRelation(): Expression {
    let left = this.parseAddition();

    while (this.isRelationalOp(this.current.type)) {
      const op = this.current.type;
      this.advance();
      const right = this.parseAddition();
      left = new Binary(this.toBinaryOp(op), left, right);
    }

    return left;
  }

  // addition = multiplication ( ('+' | '-') multiplication )*
  private parseAddition(): Expression {
    let left = this.parseMultiplication();

    while (this.current.type === TokenType.PLUS || this.current.type === TokenType.MINUS) {
      const op = this.current.type;
      this.advance();
      const right = this.parseMultiplication();
      left = new Binary(op === TokenType.PLUS ? BinaryOp.ADD : BinaryOp.SUBTRACT, left, right);
    }

    return left;
  }

  // multiplication = unary ( ('*' | '/' | '%') unary )*
  private parseMultiplication(): Expression {
    let left = this.parseUnary();

    while (
      this.current.type === TokenType.STAR ||
      this.current.type === TokenType.SLASH ||
      this.current.type === TokenType.PERCENT
    ) {
      const op = this.current.type;
      this.advance();
      const right = this.parseUnary();
      const operator =
        op === TokenType.STAR
          ? BinaryOp.MULTIPLY
          : op === TokenType.SLASH
          ? BinaryOp.DIVIDE
          : BinaryOp.MODULO;
      left = new Binary(operator, left, right);
    }

    return left;
  }

  // unary = '!'+ member | '-'+ member | member
  private parseUnary(): Expression {
    if (this.current.type === TokenType.BANG) {
      this.advance();
      return new Unary(UnaryOp.NOT, this.parseUnary());
    } else if (this.current.type === TokenType.MINUS) {
      this.advance();
      return new Unary(UnaryOp.NEGATE, this.parseUnary());
    }

    return this.parseMember();
  }

  // member = primary ( selector | index | fieldCall )*
  private parseMember(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.current.type === TokenType.DOT) {
        this.advance();
        const field = this.expectIdentifier();

        // Check if it's a method call or a field selection
        // @ts-expect-error - Token type changes after advance()
        if (this.current.type === TokenType.LPAREN) {
          this.advance();
          const args = this.parseExprList();
          this.expect(TokenType.RPAREN);
          const isMacro = MACRO_METHODS.has(field);
          expr = new Call(expr, field, args, isMacro);
        } else {
          expr = new Select(expr, field);
        }
      } else if (this.current.type === TokenType.LBRACKET) {
        this.advance();
        const index = this.parseExpr();
        this.expect(TokenType.RBRACKET);
        expr = new Index(expr, index);
      } else {
        break;
      }
    }

    return expr;
  }

  // primary = literal | ident callArgs? | listLiteral | mapLiteral | structLiteral | '(' expr ')' | '.' ident callArgs?
  private parsePrimary(): Expression {
    // Check for literals
    if (this.isLiteralToken(this.current.type)) {
      return this.parseLiteral();
    }

    // List literal
    if (this.current.type === TokenType.LBRACKET) {
      return this.parseListLiteral();
    }

    // Map or struct literal
    if (this.current.type === TokenType.LBRACE) {
      return this.parseMapOrStructLiteral(null);
    }

    // Parenthesized expression
    if (this.current.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Leading dot (e.g., .identifier or .method())
    if (this.current.type === TokenType.DOT) {
      this.advance();
      const field = this.expectIdentifier();

      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.LPAREN) {
        this.advance();
        const args = this.parseExprList();
        this.expect(TokenType.RPAREN);
        return new Call(null, field, args);
      }

      return new Select(null, field);
    }

    // Identifier (possibly followed by call args or struct literal)
    if (this.current.type === TokenType.IDENTIFIER) {
      const name = this.current.value;
      this.advance();

      // Function call
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.LPAREN) {
        this.advance();
        const args = this.parseExprList();
        this.expect(TokenType.RPAREN);
        return new Call(null, name, args);
      }

      // Check for qualified identifier followed by struct literal
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.DOT && this.isQualifiedStructLiteral()) {
        const qualified = this.parseQualifiedIdent(name);
        return this.parseMapOrStructLiteral(qualified);
      }

      // Check for struct literal with simple type name
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.LBRACE) {
        return this.parseMapOrStructLiteral(name);
      }

      return new Identifier(name);
    }

    throw new ParseError(
      `Unexpected token: ${this.current.value}`,
      this.current.line,
      this.current.column
    );
  }

  // listLiteral = '[' exprList? ','? ']'
  private parseListLiteral(): Expression {
    this.expect(TokenType.LBRACKET);

    const elements: Expression[] = [];
    if (this.current.type !== TokenType.RBRACKET) {
      elements.push(...this.parseExprList());
      // Optional trailing comma
      if (this.current.type === TokenType.COMMA) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACKET);
    return new ListExpression(elements);
  }

  // mapLiteral or structLiteral
  private parseMapOrStructLiteral(typeName: string | null): Expression {
    this.expect(TokenType.LBRACE);

    if (this.current.type === TokenType.RBRACE) {
      this.advance();
      if (typeName !== null) {
        return new Struct(typeName, []);
      }
      return new MapExpression([]);
    }

    // Try to determine if this is a struct (field: expr) or map (expr: expr)
    const isStruct =
      this.current.type === TokenType.IDENTIFIER && this.peekAhead(1).type === TokenType.COLON;

    if (isStruct || typeName !== null) {
      const fields = this.parseFieldInits();
      if (this.current.type === TokenType.COMMA) {
        this.advance();
      }
      this.expect(TokenType.RBRACE);
      return new Struct(typeName, fields);
    } else {
      const entries = this.parseMapInits();
      if (this.current.type === TokenType.COMMA) {
        this.advance();
      }
      this.expect(TokenType.RBRACE);
      return new MapExpression(entries);
    }
  }

  // exprList = expr ( ',' expr )*
  private parseExprList(): Expression[] {
    const expressions: Expression[] = [];

    // Check for empty list - current could be RPAREN or RBRACKET
    const currentType = this.current.type;
    if (currentType === TokenType.RPAREN || currentType === TokenType.RBRACKET) {
      return expressions;
    }

    expressions.push(this.parseExpr());

    while (this.current.type === TokenType.COMMA) {
      this.advance();
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.RPAREN || this.current.type === TokenType.RBRACKET) {
        break;
      }
      expressions.push(this.parseExpr());
    }

    return expressions;
  }

  // mapInits = mapInit ( ',' mapInit )*
  private parseMapInits(): MapEntry[] {
    const entries: MapEntry[] = [];

    entries.push(this.parseMapInit());
    while (this.current.type === TokenType.COMMA) {
      this.advance();
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.RBRACE) {
        break;
      }
      entries.push(this.parseMapInit());
    }

    return entries;
  }

  // mapInit = expr ':' expr
  private parseMapInit(): MapEntry {
    const key = this.parseExpr();
    this.expect(TokenType.COLON);
    const value = this.parseExpr();
    return new MapEntry(key, value);
  }

  // fieldInits = fieldInit ( ',' fieldInit )*
  private parseFieldInits(): FieldInitializer[] {
    const fields: FieldInitializer[] = [];

    fields.push(this.parseFieldInit());
    while (this.current.type === TokenType.COMMA) {
      this.advance();
      // @ts-expect-error - Token type changes after advance()
      if (this.current.type === TokenType.RBRACE) {
        break;
      }
      fields.push(this.parseFieldInit());
    }

    return fields;
  }

  // fieldInit = ident ':' expr
  private parseFieldInit(): FieldInitializer {
    const field = this.expectIdentifier();
    this.expect(TokenType.COLON);
    const value = this.parseExpr();
    return new FieldInitializer(field, value);
  }

  // qualifiedIdent = ident ( '.' ident )*
  private parseQualifiedIdent(first: string): string {
    let qualified = first;

    while (this.current.type === TokenType.DOT) {
      this.advance();
      qualified += '.';
      qualified += this.expectIdentifier();
    }

    return qualified;
  }

  private parseLiteral(): Expression {
    const token = this.current;
    this.advance();

    switch (token.type) {
      case TokenType.NULL:
        return new Literal(null, LiteralType.NULL_VALUE);
      case TokenType.TRUE:
        return new Literal(true, LiteralType.BOOL);
      case TokenType.FALSE:
        return new Literal(false, LiteralType.BOOL);
      case TokenType.INT:
        return new Literal(this.parseIntLiteral(token.value), LiteralType.INT);
      case TokenType.UINT:
        return new Literal(this.parseUintLiteral(token.value), LiteralType.UINT);
      case TokenType.DOUBLE:
        return new Literal(parseFloat(token.value), LiteralType.DOUBLE);
      case TokenType.STRING:
        return new Literal(this.parseStringLiteral(token.value), LiteralType.STRING);
      case TokenType.BYTES:
        return new Literal(this.parseBytesLiteral(token.value), LiteralType.BYTES);
      default:
        throw new ParseError(`Not a literal: ${token.value}`, token.line, token.column);
    }
  }

  private parseIntLiteral(value: string): number {
    if (value.startsWith('-0x') || value.startsWith('-0X')) {
      return -parseInt(value.substring(3), 16);
    } else if (value.startsWith('0x') || value.startsWith('0X')) {
      return parseInt(value.substring(2), 16);
    } else {
      return parseInt(value, 10);
    }
  }

  private parseUintLiteral(value: string): number {
    // Remove 'u' or 'U' suffix
    const number = value.substring(0, value.length - 1);
    if (number.startsWith('0x') || number.startsWith('0X')) {
      return parseInt(number.substring(2), 16);
    } else {
      return parseInt(number, 10);
    }
  }

  private parseStringLiteral(value: string): string {
    const isRaw = value.startsWith('r') || value.startsWith('R');
    let content: string;

    if (isRaw && (value.substring(1).startsWith('"""') || value.substring(1).startsWith("'''"))) {
      // Raw triple-quoted string: r"""...""" or r'''...'''
      content = value.substring(4, value.length - 3);
    } else if (value.startsWith('"""') || value.startsWith("'''")) {
      // Triple-quoted string: """...""" or '''...'''
      content = value.substring(3, value.length - 3);
      content = this.unescapeString(content);
    } else if (isRaw) {
      // Raw string: r"..." or r'...'
      content = value.substring(2, value.length - 1);
    } else {
      // Regular string: "..." or '...'
      content = value.substring(1, value.length - 1);
      content = this.unescapeString(content);
    }

    return content;
  }

  private parseBytesLiteral(value: string): string {
    // Remove b"..." or B'...' wrapper and process escapes
    const content = value.substring(2, value.length - 1);
    return this.unescapeString(content);
  }

  private unescapeString(value: string): string {
    let result = '';
    let i = 0;

    while (i < value.length) {
      if (value[i] === '\\' && i + 1 < value.length) {
        const next = value[i + 1]!;
        switch (next) {
          case '\\':
            result += '\\';
            i += 2;
            break;
          case '"':
            result += '"';
            i += 2;
            break;
          case "'":
            result += "'";
            i += 2;
            break;
          case '`':
            result += '`';
            i += 2;
            break;
          case '?':
            result += '?';
            i += 2;
            break;
          case 'a':
            result += '\u0007';
            i += 2;
            break;
          case 'b':
            result += '\b';
            i += 2;
            break;
          case 'f':
            result += '\f';
            i += 2;
            break;
          case 'n':
            result += '\n';
            i += 2;
            break;
          case 'r':
            result += '\r';
            i += 2;
            break;
          case 't':
            result += '\t';
            i += 2;
            break;
          case 'v':
            result += '\u000B';
            i += 2;
            break;
          case 'x':
            // Hexadecimal escape: \xHH
            if (i + 3 < value.length) {
              const hex = value.substring(i + 2, i + 4);
              result += String.fromCharCode(parseInt(hex, 16));
              i += 4;
            } else {
              result += value[i]!;
              i++;
            }
            break;
          case 'u':
            // Unicode escape: \uHHHH
            if (i + 5 < value.length) {
              const hex = value.substring(i + 2, i + 6);
              result += String.fromCharCode(parseInt(hex, 16));
              i += 6;
            } else {
              result += value[i]!;
              i++;
            }
            break;
          case 'U':
            // Unicode escape: \UHHHHHHHH
            if (i + 9 < value.length) {
              const hex = value.substring(i + 2, i + 10);
              const codePoint = parseInt(hex, 16);
              result += String.fromCodePoint(codePoint);
              i += 10;
            } else {
              result += value[i]!;
              i++;
            }
            break;
          default:
            // Check for octal escape: \[0-3][0-7][0-7]
            if (
              i + 3 < value.length &&
              next >= '0' &&
              next <= '3' &&
              value[i + 2]! >= '0' &&
              value[i + 2]! <= '7' &&
              value[i + 3]! >= '0' &&
              value[i + 3]! <= '7'
            ) {
              const octal = value.substring(i + 1, i + 4);
              result += String.fromCharCode(parseInt(octal, 8));
              i += 4;
            } else {
              result += value[i]!;
              i++;
            }
        }
      } else {
        result += value[i]!;
        i++;
      }
    }

    return result;
  }

  private isLiteralToken(type: TokenType): boolean {
    return (
      type === TokenType.NULL ||
      type === TokenType.TRUE ||
      type === TokenType.FALSE ||
      type === TokenType.INT ||
      type === TokenType.UINT ||
      type === TokenType.DOUBLE ||
      type === TokenType.STRING ||
      type === TokenType.BYTES
    );
  }

  private isRelationalOp(type: TokenType): boolean {
    return (
      type === TokenType.LT ||
      type === TokenType.LE ||
      type === TokenType.GT ||
      type === TokenType.GE ||
      type === TokenType.EQ ||
      type === TokenType.NE ||
      type === TokenType.IN
    );
  }

  private toBinaryOp(type: TokenType): BinaryOp {
    switch (type) {
      case TokenType.LT:
        return BinaryOp.LESS;
      case TokenType.LE:
        return BinaryOp.LESS_EQUAL;
      case TokenType.GT:
        return BinaryOp.GREATER;
      case TokenType.GE:
        return BinaryOp.GREATER_EQUAL;
      case TokenType.EQ:
        return BinaryOp.EQUAL;
      case TokenType.NE:
        return BinaryOp.NOT_EQUAL;
      case TokenType.IN:
        return BinaryOp.IN;
      default:
        throw new ParseError(
          `Unknown relational operator: ${type}`,
          this.current.line,
          this.current.column
        );
    }
  }

  private match(type: TokenType): boolean {
    if (this.current.type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): void {
    if (this.current.type !== type) {
      throw new ParseError(
        `Expected ${type} but found ${this.current.type}`,
        this.current.line,
        this.current.column
      );
    }
    this.advance();
  }

  private expectIdentifier(): string {
    if (this.current.type !== TokenType.IDENTIFIER) {
      throw new ParseError(
        `Expected identifier but found ${this.current.value}`,
        this.current.line,
        this.current.column
      );
    }
    const name = this.current.value;
    this.advance();
    return name;
  }

  private advance(): void {
    this.current = this.lexer.next();
  }

  private peekAhead(count: number): Token {
    return this.lexer.peek(count);
  }

  // Check if we have a pattern like: . ident ( . ident )* {
  private isQualifiedStructLiteral(): boolean {
    let lookahead = 1;
    let token = this.peekAhead(lookahead);

    // Must start with identifier after dot
    if (token.type !== TokenType.IDENTIFIER) {
      return false;
    }

    lookahead++;
    token = this.peekAhead(lookahead);

    // Skip additional .ident sequences
    while (token.type === TokenType.DOT) {
      lookahead++;
      token = this.peekAhead(lookahead);
      if (token.type !== TokenType.IDENTIFIER) {
        return false;
      }
      lookahead++;
      token = this.peekAhead(lookahead);
    }

    // Must end with {
    return token.type === TokenType.LBRACE;
  }
}
