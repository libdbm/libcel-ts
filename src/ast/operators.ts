/**
 * Binary operators in CEL expressions.
 */
export enum BinaryOp {
  /** Addition (+) or string/list concatenation */
  ADD = 'ADD',
  /** Subtraction (-) */
  SUBTRACT = 'SUBTRACT',
  /** Multiplication (*) or string/list repetition */
  MULTIPLY = 'MULTIPLY',
  /** Division (/) */
  DIVIDE = 'DIVIDE',
  /** Modulo (%) */
  MODULO = 'MODULO',
  /** Equality (==) */
  EQUAL = 'EQUAL',
  /** Inequality (!=) */
  NOT_EQUAL = 'NOT_EQUAL',
  /** Less than (<) */
  LESS = 'LESS',
  /** Less than or equal (<=) */
  LESS_EQUAL = 'LESS_EQUAL',
  /** Greater than (>) */
  GREATER = 'GREATER',
  /** Greater than or equal (>=) */
  GREATER_EQUAL = 'GREATER_EQUAL',
  /** Membership test (in) */
  IN = 'IN',
  /** Logical AND (&&) */
  LOGICAL_AND = 'LOGICAL_AND',
  /** Logical OR (||) */
  LOGICAL_OR = 'LOGICAL_OR',
}

/**
 * Unary operators in CEL expressions.
 */
export enum UnaryOp {
  /** Logical NOT (!) */
  NOT = 'NOT',
  /** Numeric negation (-) */
  NEGATE = 'NEGATE',
}

/**
 * Types of literal values in CEL.
 */
export enum LiteralType {
  NULL_VALUE = 'NULL_VALUE',
  BOOL = 'BOOL',
  INT = 'INT',
  UINT = 'UINT',
  DOUBLE = 'DOUBLE',
  STRING = 'STRING',
  BYTES = 'BYTES',
}
