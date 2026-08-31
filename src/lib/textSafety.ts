/**
 * Text safety and sanitization utilities for user-submitted free text (e.g. comments, solver names).
 */

export function sanitizeText(input: string, maxLength: number = 500): string {
  if (!input) return "";
  
  // Strip HTML tags and escape HTML entities to prevent XSS attacks
  const sanitized = input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/&/g, "&amp;");

  return sanitized.trim().slice(0, maxLength);
}

export function validateCommentText(
  text: string,
  maxLength: number = 500
): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, error: "Comment text cannot be empty or whitespace only." };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Comment exceeds maximum length of ${maxLength} characters.` };
  }
  return { valid: true };
}
