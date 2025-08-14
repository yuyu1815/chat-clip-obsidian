// Validation and sanitization helpers

/**
 * Sanitize free-form title text for UI input fields.
 * Replaces filesystem-invalid characters with hyphen, keeps spaces.
 * @param {string} title
 * @returns {string}
 */
export function sanitizeTitle(title) {
  const invalidCharacterPattern = /[\\:*?"<>|/]/g;
  return String(title || '').replace(invalidCharacterPattern, '-');
}

/**
 * Sanitize a string for safe use in filenames.
 * - Removes filesystem-invalid characters
 * - Collapses whitespace to underscore
 * - Trims and falls back to a default when empty
 * @param {string} raw
 * @param {string} [fallback="untitled"]
 * @returns {string}
 */
export function sanitizeForFilename(raw, fallback = 'untitled') {
  const sanitized = String(raw || '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  return sanitized || fallback;
}


