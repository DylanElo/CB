/**
 * Sanitizes input text by removing non-printing control characters and normalizing Unicode.
 * This prevents potential issues with TTS engines, homoglyph attacks, and ensures clean text rendering.
 *
 * Operations:
 * 1. Normalize Unicode to NFKC form (compatibility decomposition)
 * 2. Remove Bidi control characters (potential spoofing vectors)
 * 3. Remove ASCII control characters
 *
 * Removes:
 * - \x00-\x08 (Null, Bell, Backspace, etc.)
 * - \x0B (Vertical Tab)
 * - \x0C (Form Feed)
 * - \x0E-\x1F (Shift Out/In, etc.)
 * - \x7F (Delete)
 * - \u202A-\u202E (Bidi Embedding/Override)
 * - \u2066-\u2069 (Bidi Isolate)
 *
 * Preserves:
 * - \x09 (Tab)
 * - \x0A (Line Feed/New Line)
 * - \x0D (Carriage Return)
 */
export const sanitizeInputText = (text) => {
  if (typeof text !== 'string') return '';

  // 1. Normalize Unicode (e.g. convert ligatures "ﬁ" -> "fi")
  let sanitized = text.normalize('NFKC');

  // 2. Remove Bidi control characters (Right-to-Left overrides, etc.)
  sanitized = sanitized.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

  // 3. Remove ASCII control characters (keeping \n, \r, \t)
  // eslint-disable-next-line no-control-regex
  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};
