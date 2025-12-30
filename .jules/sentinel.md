## 2025-05-18 - Input Sanitization for Text Processing
**Vulnerability:** Text input for TTS and rendering was only sanitized for ASCII control characters, leaving it vulnerable to Bidi spoofing (Right-to-Left Override) and homoglyph attacks.
**Learning:** Even in client-side apps, sanitizing input for "visual" or "audio" consumption is critical. Bidi characters can mask content, and unnormalized Unicode can cause issues in downstream systems (like TTS engines).
**Prevention:** Use `String.prototype.normalize('NFKC')` and strip Bidi control characters (`\u202A-\u202E`, `\u2066-\u2069`) for any text input intended for human consumption in a trusted context.

## 2025-05-18 - Text Chunking DoS Prevention
**Vulnerability:** Text chunking logic relied on punctuation delimiters (`/[.!?]+|$/g`). A malicious input containing a very long string without punctuation (e.g. >1MB of "a") would result in a single massive chunk. This could crash the TTS engine, freeze the UI thread, or exhaust browser memory.
**Learning:** Regex-based splitting without a fallback hard limit is a Denial of Service vector.
**Prevention:** Implement a recursive or iterative splitting strategy that strictly enforces a maximum chunk length (`maxLength`). If no natural delimiter is found within the limit, force a split at `maxLength` to ensure system stability.
