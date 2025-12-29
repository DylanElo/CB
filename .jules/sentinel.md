## 2025-05-18 - Input Sanitization for Text Processing
**Vulnerability:** Text input for TTS and rendering was only sanitized for ASCII control characters, leaving it vulnerable to Bidi spoofing (Right-to-Left Override) and homoglyph attacks.
**Learning:** Even in client-side apps, sanitizing input for "visual" or "audio" consumption is critical. Bidi characters can mask content, and unnormalized Unicode can cause issues in downstream systems (like TTS engines).
**Prevention:** Use `String.prototype.normalize('NFKC')` and strip Bidi control characters (`\u202A-\u202E`, `\u2066-\u2069`) for any text input intended for human consumption in a trusted context.
