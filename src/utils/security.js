/**
 * Sanitizes input text by removing non-printing control characters.
 * This prevents potential issues with TTS engines and ensures clean text rendering.
 *
 * Removes ASCII control characters:
 * - \x00-\x08 (Null, Bell, Backspace, etc.)
 * - \x0B (Vertical Tab)
 * - \x0C (Form Feed)
 * - \x0E-\x1F (Shift Out/In, etc.)
 * - \x7F (Delete)
 *
 * Preserves:
 * - \x09 (Tab)
 * - \x0A (Line Feed/New Line)
 * - \x0D (Carriage Return)
 */
export const sanitizeInputText = (text) => {
  if (typeof text !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};
