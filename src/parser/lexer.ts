/**
 * ParseError is thrown when the lexer or parser encounters invalid syntax.
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number
  ) {
    super(`${message} at ${line}:${column}`);
    this.name = 'ParseError';
  }
}

/**
 * Token types for CEL lexical analysis.
 */
export enum TokenType {
  // Literals
  NULL = 'NULL',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  INT = 'INT',
  UINT = 'UINT',
  DOUBLE = 'DOUBLE',
  STRING = 'STRING',
  BYTES = 'BYTES',
  IDENTIFIER = 'IDENTIFIER',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  EQ = 'EQ',
  NE = 'NE',
  LT = 'LT',
  LE = 'LE',
  GT = 'GT',
  GE = 'GE',
  LOGICAL_AND = 'LOGICAL_AND',
  LOGICAL_OR = 'LOGICAL_OR',
  BANG = 'BANG',
  IN = 'IN',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  DOT = 'DOT',
  COMMA = 'COMMA',
  COLON = 'COLON',
  QUESTION = 'QUESTION',

  // Special
  EOF = 'EOF',
}

/**
 * Token representation for lexical analysis.
 */
export class Token {
  constructor(
    public readonly type: TokenType,
    public readonly value: string,
    public readonly line: number,
    public readonly column: number
  ) {}

  toString(): string {
    return `${this.type}(${this.value})`;
  }
}

/**
 * Lexer for tokenizing CEL expressions.
 * Performs character-by-character scanning to produce tokens.
 */
export class Lexer {
  private position = 0;
  private line = 1;
  private column = 1;
  private readonly lookahead: Token[] = [];

  constructor(private readonly input: string) {}

  /**
   * Get the next token from the input.
   */
  next(): Token {
    if (this.lookahead.length > 0) {
      return this.lookahead.shift()!;
    }
    return this.token();
  }

  /**
   * Peek ahead at future tokens without consuming them.
   * @param count Number of tokens to look ahead (1-indexed)
   */
  peek(count: number): Token {
    while (this.lookahead.length < count) {
      this.lookahead.push(this.token());
    }
    return this.lookahead[count - 1]!;
  }

  private step(): void {
    if (this.position >= this.input.length) return;

    const ch = this.input[this.position]!;
    this.position++;

    if (ch === '\r') {
      // Handle CRLF as a single newline
      if (this.position < this.input.length && this.input[this.position] === '\n') {
        this.position++;
      }
      this.line++;
      this.column = 1;
    } else if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }

  private forward(n: number): void {
    for (let i = 0; i < n; i++) {
      this.step();
    }
  }

  private token(): Token {
    this.whitespace();

    if (this.position >= this.input.length) {
      return new Token(TokenType.EOF, '', this.line, this.column);
    }

    const start = this.position;
    const line = this.line;
    const column = this.column;
    const ch = this.input[this.position]!;

    // Single character tokens
    switch (ch) {
      case '(':
        this.step();
        return new Token(TokenType.LPAREN, '(', line, column);
      case ')':
        this.step();
        return new Token(TokenType.RPAREN, ')', line, column);
      case '[':
        this.step();
        return new Token(TokenType.LBRACKET, '[', line, column);
      case ']':
        this.step();
        return new Token(TokenType.RBRACKET, ']', line, column);
      case '{':
        this.step();
        return new Token(TokenType.LBRACE, '{', line, column);
      case '}':
        this.step();
        return new Token(TokenType.RBRACE, '}', line, column);
      case ',':
        this.step();
        return new Token(TokenType.COMMA, ',', line, column);
      case '.':
        this.step();
        return new Token(TokenType.DOT, '.', line, column);
      case ':':
        this.step();
        return new Token(TokenType.COLON, ':', line, column);
      case '?':
        this.step();
        return new Token(TokenType.QUESTION, '?', line, column);
      case '+':
        this.step();
        return new Token(TokenType.PLUS, '+', line, column);
      case '*':
        this.step();
        return new Token(TokenType.STAR, '*', line, column);
      case '/':
        this.step();
        return new Token(TokenType.SLASH, '/', line, column);
      case '%':
        this.step();
        return new Token(TokenType.PERCENT, '%', line, column);
    }

    // Multi-character operators
    if (ch === '&' && this.peekChar() === '&') {
      this.forward(2);
      return new Token(TokenType.LOGICAL_AND, '&&', line, column);
    }
    if (ch === '|' && this.peekChar() === '|') {
      this.forward(2);
      return new Token(TokenType.LOGICAL_OR, '||', line, column);
    }
    if (ch === '=' && this.peekChar() === '=') {
      this.forward(2);
      return new Token(TokenType.EQ, '==', line, column);
    }
    if (ch === '!' && this.peekChar() === '=') {
      this.forward(2);
      return new Token(TokenType.NE, '!=', line, column);
    }
    if (ch === '<' && this.peekChar() === '=') {
      this.forward(2);
      return new Token(TokenType.LE, '<=', line, column);
    }
    if (ch === '>' && this.peekChar() === '=') {
      this.forward(2);
      return new Token(TokenType.GE, '>=', line, column);
    }
    if (ch === '<') {
      this.step();
      return new Token(TokenType.LT, '<', line, column);
    }
    if (ch === '>') {
      this.step();
      return new Token(TokenType.GT, '>', line, column);
    }
    if (ch === '!') {
      this.step();
      return new Token(TokenType.BANG, '!', line, column);
    }
    if (ch === '-') {
      this.step();
      return new Token(TokenType.MINUS, '-', line, column);
    }

    // String literals
    if (ch === '"' || ch === "'") {
      return this.string(line, column, start);
    }

    // Raw strings or triple-quoted strings
    if ((ch === 'r' || ch === 'R') && this.position + 1 < this.input.length) {
      const next = this.input[this.position + 1]!;
      if (next === '"' || next === "'") {
        return this.string(line, column, start);
      }
    }

    // Bytes literals
    if ((ch === 'b' || ch === 'B') && this.position + 1 < this.input.length) {
      const next = this.input[this.position + 1]!;
      if (next === '"' || next === "'") {
        return this.bytes(line, column, start);
      }
    }

    // Numbers
    if (this.isDigit(ch)) {
      return this.number(line, column, start);
    }

    // Identifiers and keywords
    if (this.isLetter(ch) || ch === '_') {
      return this.identifier(line, column, start);
    }

    throw new ParseError(`Unexpected character: ${ch}`, line, column);
  }

  private string(line: number, column: number, offset: number): Token {
    let isRaw = false;

    // Check for raw prefix
    if (this.input[this.position] === 'r' || this.input[this.position] === 'R') {
      isRaw = true;
      this.step();
    }

    // Check for triple-quoted string
    if (this.position + 2 < this.input.length) {
      const prefix = this.input.substring(this.position, this.position + 3);
      if (prefix === '"""' || prefix === "'''") {
        const quote = this.input[this.position]!;
        this.forward(3);

        // Find closing triple quotes
        while (this.position + 2 < this.input.length) {
          if (
            this.input[this.position] === quote &&
            this.input[this.position + 1] === quote &&
            this.input[this.position + 2] === quote
          ) {
            this.forward(3);
            return new Token(TokenType.STRING, this.input.substring(offset, this.position), line, column);
          }
          this.step();
        }
        throw new ParseError('Unterminated triple-quoted string', line, column);
      }
    }

    // Regular string
    const quote = this.input[this.position]!;
    this.step(); // consume opening quote

    while (this.position < this.input.length) {
      const ch = this.input[this.position]!;
      if (ch === quote) {
        this.step();
        return new Token(TokenType.STRING, this.input.substring(offset, this.position), line, column);
      }
      if (ch === '\\' && !isRaw && this.position + 1 < this.input.length) {
        // Skip escape sequence as two chars
        this.forward(2);
      } else {
        this.step();
      }
    }

    throw new ParseError('Unterminated string', line, column);
  }

  private bytes(line: number, column: number, offset: number): Token {
    this.step(); // Skip 'b' or 'B'
    const quote = this.input[this.position]!;
    this.step();

    while (this.position < this.input.length) {
      const ch = this.input[this.position]!;
      if (ch === quote) {
        this.step();
        return new Token(TokenType.BYTES, this.input.substring(offset, this.position), line, column);
      }
      if (ch === '\\' && this.position + 1 < this.input.length) {
        this.forward(2); // Skip escape sequence
      } else {
        this.step();
      }
    }

    throw new ParseError('Unterminated bytes literal', line, column);
  }

  private number(line: number, column: number, offset: number): Token {
    // Check for hexadecimal
    if (this.input[this.position] === '0' && this.position + 1 < this.input.length) {
      const next = this.input[this.position + 1]!;
      if (next === 'x' || next === 'X') {
        this.forward(2);
        while (this.position < this.input.length && this.isHexDigit(this.input[this.position]!)) {
          this.step();
        }

        // Check for uint suffix
        if (this.position < this.input.length) {
          const suffix = this.input[this.position]!;
          if (suffix === 'u' || suffix === 'U') {
            this.step();
            return new Token(TokenType.UINT, this.input.substring(offset, this.position), line, column);
          }
        }

        return new Token(TokenType.INT, this.input.substring(offset, this.position), line, column);
      }
    }

    // Scan digits
    while (this.position < this.input.length && this.isDigit(this.input[this.position]!)) {
      this.step();
    }

    // Check for decimal point or exponent
    let isDouble = false;
    if (this.position < this.input.length && this.input[this.position] === '.') {
      isDouble = true;
      this.step();
      while (this.position < this.input.length && this.isDigit(this.input[this.position]!)) {
        this.step();
      }
    }

    if (this.position < this.input.length) {
      const c = this.input[this.position]!;
      if (c === 'e' || c === 'E') {
        isDouble = true;
        this.step();
        if (this.position < this.input.length) {
          const sign = this.input[this.position]!;
          if (sign === '+' || sign === '-') {
            this.step();
          }
        }
        while (this.position < this.input.length && this.isDigit(this.input[this.position]!)) {
          this.step();
        }
      }
    }

    // Check for uint suffix
    if (!isDouble && this.position < this.input.length) {
      const suffix = this.input[this.position]!;
      if (suffix === 'u' || suffix === 'U') {
        this.step();
        return new Token(TokenType.UINT, this.input.substring(offset, this.position), line, column);
      }
    }

    const type = isDouble ? TokenType.DOUBLE : TokenType.INT;
    return new Token(type, this.input.substring(offset, this.position), line, column);
  }

  private identifier(line: number, column: number, offset: number): Token {
    while (this.position < this.input.length) {
      const c = this.input[this.position]!;
      if (!this.isLetterOrDigit(c) && c !== '_') {
        break;
      }
      this.step();
    }

    const value = this.input.substring(offset, this.position);
    const type = this.typeOf(value);

    return new Token(type, value, line, column);
  }

  private typeOf(value: string): TokenType {
    switch (value) {
      case 'null':
        return TokenType.NULL;
      case 'true':
        return TokenType.TRUE;
      case 'false':
        return TokenType.FALSE;
      case 'in':
        return TokenType.IN;
      default:
        return TokenType.IDENTIFIER;
    }
  }

  private whitespace(): void {
    while (this.position < this.input.length) {
      const c = this.input[this.position]!;
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
        break;
      }
      this.step();
    }
  }

  private peekChar(): string {
    const pos = this.position + 1;
    if (pos >= this.input.length) {
      return '\0';
    }
    return this.input[pos]!;
  }

  private isHexDigit(c: string): boolean {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isLetter(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }

  private isLetterOrDigit(c: string): boolean {
    return this.isLetter(c) || this.isDigit(c);
  }
}
