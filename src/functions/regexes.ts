/**
 * Regular expression functions from the CEL regex extension library.
 *
 * Replacement strings refer to capture groups as `\1` through `\9`, and `\0` for
 * the whole match. Functions are exported so library users can call them directly.
 */
import { ArgumentError } from '../errors.js';
import * as Utilities from './utilities.js';

type Piece = { text: string } | { group: number };

function compile(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch {
    throw new ArgumentError(`Invalid regular expression: ${pattern}`);
  }
}

/** Counts the capture groups a pattern declares. */
export function groupCount(pattern: string): number {
  compile(pattern, '');
  return new RegExp(`${pattern}|`).exec('')!.length - 1;
}

/**
 * Replaces matches of the pattern with the given replacement.
 *
 * @param limit The maximum number of replacements, or -1 for all
 * @throws ArgumentError if the pattern or a group reference is invalid
 */
export function replace(
  value: string,
  pattern: string,
  replacement: string,
  limit: bigint = -1n
): string {
  const regex = compile(pattern, 'g');
  const pieces = rewrite(replacement, groupCount(pattern), pattern);
  let result = '';
  let last = 0;
  let count = 0n;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (limit >= 0n && count >= limit) {
      break;
    }
    result += value.substring(last, match.index) + expand(pieces, match);
    Utilities.limit(result.length, 'regex.replace()');
    last = match.index + match[0].length;
    if (match[0].length === 0) {
      // Step past an empty match so the search advances
      regex.lastIndex++;
    }
    count++;
  }
  result += value.substring(last);
  Utilities.limit(result.length, 'regex.replace()');
  return result;
}

/**
 * Returns the first match of the pattern, or null when there is none.
 *
 * If the pattern declares a capture group, the first group is returned instead of
 * the whole match.
 *
 * @throws ArgumentError if the pattern is invalid or declares more than one group
 */
export function extract(value: string, pattern: string): string | null {
  const groups = groupCount(pattern);
  if (groups > 1) {
    throw new ArgumentError(`extract() supports at most one capture group: ${pattern}`);
  }
  const match = compile(pattern, '').exec(value);
  if (match === null) {
    return null;
  }
  return groups === 1 ? (match[1] ?? null) : match[0];
}

/**
 * Returns every match of the pattern in the given text.
 *
 * If the pattern declares a capture group, the first group of each match is
 * returned instead of the whole match; matches where the group did not
 * participate are skipped.
 *
 * @throws ArgumentError if the pattern is invalid or declares more than one group
 */
export function extractAll(value: string, pattern: string): string[] {
  const groups = groupCount(pattern);
  if (groups > 1) {
    throw new ArgumentError(`extractAll() supports at most one capture group: ${pattern}`);
  }
  const regex = compile(pattern, 'g');
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const found = groups === 1 ? match[1] : match[0];
    if (found !== undefined) {
      result.push(found);
    }
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }
  return result;
}

// Parses backslash group references out of a replacement template
function rewrite(replacement: string, groups: number, pattern: string): Piece[] {
  const pieces: Piece[] = [];
  let text = '';
  let i = 0;
  while (i < replacement.length) {
    const ch = replacement[i]!;
    if (ch === '\\' && i + 1 < replacement.length) {
      const next = replacement[i + 1]!;
      if (next >= '0' && next <= '9') {
        const group = next.charCodeAt(0) - 48;
        if (group > groups) {
          throw new ArgumentError(
            `Replacement refers to group ${group} but ${pattern} has ${groups}`
          );
        }
        if (text.length > 0) {
          pieces.push({ text });
          text = '';
        }
        pieces.push({ group });
      } else {
        text += '\\' + next;
      }
      i += 2;
    } else {
      text += ch;
      i++;
    }
  }
  if (text.length > 0) {
    pieces.push({ text });
  }
  return pieces;
}

function expand(pieces: Piece[], match: RegExpExecArray): string {
  let result = '';
  for (const piece of pieces) {
    if ('text' in piece) {
      result += piece.text;
    } else {
      result += match[piece.group] ?? '';
    }
  }
  return result;
}
