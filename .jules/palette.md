## 2025-05-23 - Accessibility Wins in React
**Learning:** Adding `role="option"`, `tabIndex={0}`, and `onKeyDown` to custom list items instantly makes them keyboard accessible without complex focus management libraries.
**Action:** Always check custom "clickable" divs for keyboard support and basic ARIA roles.

## 2025-12-30 - Focus Visibility for Custom Controls
**Learning:** Custom interactive elements (like `div` based lists or styled buttons) often lack default focus styles, making keyboard navigation confusing. Explicit `:focus-visible` styles with `outline` and `outline-offset` significantly improve the experience for keyboard users without affecting mouse users.
**Action:** Always add `:focus-visible` styles to custom interactive components, ensuring high contrast and clear visibility.
