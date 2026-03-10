/**
 * Sanitizes user-provided text before injection into AI prompts.
 * Neutralizes prompt injection attempts while preserving legitimate content.
 */

const DEFAULT_MAX_LENGTH_TITLE = 500;
const DEFAULT_MAX_LENGTH_DESCRIPTION = 10_000;
const TRUNCATION_SUFFIX = ' ... [truncated]';

/**
 * Sequences that are commonly used as prompt delimiters in LLM systems.
 * We escape these by inserting a zero-width space so they lose their
 * special meaning while remaining readable.
 */
const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/<\|/g, '<\u200b|'],
  [/\|>/g, '|\u200b>'],
  [/<</g, '<\u200b<'],
  [/>>/g, '>\u200b>'],
  [/\[INST\]/gi, '[\u200bINST]'],
  [/\[\/INST\]/gi, '[/\u200bINST]'],
  [/<system>/gi, '<\u200bsystem>'],
  [/<\/system>/gi, '</\u200bsystem>'],
  [/<\|im_start\|>/gi, '<\u200b|im_start|>'],
  [/<\|im_end\|>/gi, '<\u200b|im_end|>'],
  [/<\|endoftext\|>/gi, '<\u200b|endoftext|>'],
];

export interface SanitizeOptions {
  maxLength?: number;
  fieldName?: string;
}

/**
 * Sanitizes a single user-provided string for safe inclusion in an AI prompt.
 *
 * - Removes null bytes and non-printable control characters (preserves \n, \r, \t)
 * - Escapes known prompt-injection delimiter sequences
 * - Wraps the result in [USER_INPUT] delimiters to make the boundary explicit
 * - Enforces a maximum length, truncating with a visible suffix
 *
 * Returns an empty string for null/undefined input.
 */
export function sanitizeForPrompt(
  input: string | null | undefined,
  options?: SanitizeOptions
): string {
  if (input == null || input === '') {
    return '';
  }

  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH_DESCRIPTION;
  const fieldName = options?.fieldName ?? 'content';

  // 1. Remove null bytes and control characters (keep \n \r \t)
  let sanitized = input.replace(/\0/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // 2. Escape prompt-injection delimiter patterns
  for (const [pattern, replacement] of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // 3. Enforce max length (before wrapping)
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + TRUNCATION_SUFFIX;
  }

  // 4. Wrap in explicit delimiters
  return `[USER_INPUT field="${fieldName}"]${sanitized}[/USER_INPUT]`;
}

export interface SanitizedTicket {
  title: string;
  description: string;
}

/**
 * Sanitize a ticket's user-provided fields for prompt inclusion.
 * Null fields become empty strings.
 */
export function sanitizeTicketForPrompt(ticket: {
  title?: string | null;
  description?: string | null;
}): SanitizedTicket {
  return {
    title: sanitizeForPrompt(ticket.title, {
      maxLength: DEFAULT_MAX_LENGTH_TITLE,
      fieldName: 'title',
    }),
    description: sanitizeForPrompt(ticket.description, {
      maxLength: DEFAULT_MAX_LENGTH_DESCRIPTION,
      fieldName: 'description',
    }),
  };
}
